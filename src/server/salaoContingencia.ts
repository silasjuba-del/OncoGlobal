import { createHash } from "node:crypto";
import { ContextoContingenciaSalao, GerarContingenciaSalao } from "../contracts/api/salaoContingencia.js";
import { Instante } from "../contracts/base.js";
import { FolhaContingenciaSalao } from "../contracts/f3/salaoOperacional.js";
import { dataCivilDoServico } from "../kernel/gateway/tempo.js";
import { transacao } from "../kernel/ledger/db.js";
import { hashCanonico } from "../modules/hash.js";
import { lerPaciente } from "./leituras.js";
import {listarEventos} from '../kernel/comandos/portas.js';
import {projetarAlertasConsulta} from './alertasConsulta.js';
import { garantirSchemaSalaoF3, gerarFolhaContingenciaSalaoF3, listarFolhasContingenciaSalaoF3 } from "./salaoF3.js";
import type { ServidorDeps } from "./rotas.js";

/** Cópia operacional local: entrada médica explícita, sem aplicar novas regras clínicas. */
export function operarContingenciaSalao(deps: ServidorDeps, token: string, rota: string, raw: unknown) {
  const sessao = deps.sessoes.obter(token);
  if (!sessao) return { status: 401, body: { codigo: "SESSAO_INVALIDA" } };
  const pedido = (rota === "gerarContingenciaSalao" ? GerarContingenciaSalao : ContextoContingenciaSalao).safeParse(raw);
  if (!pedido.success) return { status: 400, body: { codigo: "PAYLOAD_INVALIDO" } };
  const ctx = deps.sessoes.consultaSelecionada(token);
  if (!ctx || ctx.patientId !== pedido.data.patientId || ctx.encounterId !== pedido.data.encounterId) {
    return { status: 409, body: { codigo: "CONTEXTO_CONSULTA_ALTERADO" } };
  }
  if (rota === "historicoContingenciaSalao") {
    const paciente = lerPaciente(deps.db, ctx.patientId);
    const encontro = deps.db.prepare("SELECT 1 FROM clinical_event WHERE patientId = ? AND encounterId = ? LIMIT 1")
      .get(ctx.patientId, ctx.encounterId);
    if (!paciente || !encontro) return { status: 404, body: { codigo: "PACIENTE_OU_ENCONTRO_AUSENTE" } };
    return { status: 200, body: { folhas: listarFolhasContingenciaSalaoF3(deps.db, ctx.patientId)
      .filter(f => f.encounterId === ctx.encounterId) } };
  }
  const entrada = GerarContingenciaSalao.parse(pedido.data);
  const agora = deps.agora();
  if (!Instante.safeParse(agora).success) return { status: 503, body: { codigo: "DATA_SERVICO_INDISPONIVEL" } };
  if (Date.parse(sessao.expiraEm) <= Date.parse(agora)) return { status: 401, body: { codigo: "SESSAO_INVALIDA" } };
  const id = createHash("sha256").update(JSON.stringify([ctx.patientId, ctx.encounterId, entrada.operationId])).digest("hex");
  const folhaId = `folha-${id}`, pedidoSha256 = hashCanonico(entrada);
  try {
    garantirSchemaSalaoF3(deps.db);
    return transacao(deps.db, () => {
      const atual = deps.sessoes.consultaSelecionada(token);
      if (!atual || atual.patientId !== ctx.patientId || atual.encounterId !== ctx.encounterId) {
        return { status: 409, body: { codigo: "CONTEXTO_CONSULTA_ALTERADO" } };
      }
      const paciente = lerPaciente(deps.db, ctx.patientId);
      const encontro = deps.db.prepare("SELECT 1 FROM clinical_event WHERE patientId = ? AND encounterId = ? LIMIT 1")
        .get(ctx.patientId, ctx.encounterId);
      if (!paciente || !encontro) return { status: 404, body: { codigo: "PACIENTE_OU_ENCONTRO_AUSENTE" } };
      const row = deps.db.prepare("SELECT patientId, encounterId, folhaJson, pedidoSha256 FROM salao_folha_contingencia WHERE folhaId = ?")
        .get(folhaId) as { patientId: string; encounterId: string; folhaJson: string; pedidoSha256: string | null } | undefined;
      const persistida = row ? FolhaContingenciaSalao.parse(JSON.parse(row.folhaJson)) : null;
      const dataServidor=dataCivilDoServico(agora,'-03:00');
      if(dataServidor.estado!=='OK')return {status:503,body:{codigo:'DATA_SERVICO_INDISPONIVEL'}};
      const e1Servidor=projetarAlertasConsulta(deps.db,listarEventos(deps.db,ctx.patientId),ctx,dataServidor.dataCivil,agora,deps.salaoRuleset)
        .filter(a=>a.natureza==='AMEACA_IMEDIATA');
      if(persistida&&e1Servidor.some(a=>!persistida.emergenciaAtiva||!persistida.alertasOperacionaisE1.includes(a.texto)))return {status:409,body:{codigo:'FOLHA_DESATUALIZADA_POR_E1'}};
      if (row && (row.patientId !== ctx.patientId || row.encounterId !== ctx.encounterId
        || persistida?.folhaId !== folhaId || persistida.patientId !== ctx.patientId || persistida.encounterId !== ctx.encounterId)) {
        return { status: 409, body: { codigo: "FOLHA_ID_CONFLITANTE" } };
      }
      if (row && row.pedidoSha256 !== null) {
        // Replay do pedido, antes de recalcular data, template ou HTML com metadados atuais.
        return row.pedidoSha256 === pedidoSha256
          ? { status: 200, body: { folha: persistida! } }
          : { status: 409, body: { codigo: "FOLHA_ID_CONFLITANTE" } };
      }
      const data = dataCivilDoServico(agora, "-03:00");
      if (data.estado !== "OK") return { status: 503, body: { codigo: "DATA_SERVICO_INDISPONIVEL" } };
      const resultado = gerarFolhaContingenciaSalaoF3(deps.db, { sessoes: deps.sessoes, token, agora }, {
        folhaId, patientId: ctx.patientId, encounterId: ctx.encounterId,
        // Legados NULL usam apenas a comparação estrita anterior, sem atribuir fingerprint.
        ...(row ? {} : { pedidoSha256 }),
        nomePaciente: paciente.nome, dataImpressao: persistida?.dataImpressao ?? data.dataCivil, destino: entrada.destino,
        emergenciaAtiva: entrada.emergenciaAtiva||e1Servidor.length>0, alertasOperacionaisE1: [...new Set([...entrada.alertasOperacionaisE1,...e1Servidor.map(a=>a.texto)])],
        resumoTriagem: { ...entrada.resumoTriagem, Origem: "Registro operacional informado pelo médico; não substitui prescrição assinada." },
      });
      if (!resultado.ok) return { status: resultado.codigo === "ERRO_RENDERIZACAO_FOLHA" ? 503 : 409,
        body: { codigo: resultado.codigo } };
      return { status: 200, body: { folha: resultado.folha } };
    });
  } catch {
    return { status: 503, body: { codigo: "ERRO_RENDERIZACAO_FOLHA" } };
  }
}
