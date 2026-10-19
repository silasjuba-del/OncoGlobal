import { createHash } from "node:crypto";
import { ContextoContingenciaSalao, GerarContingenciaSalao } from "../contracts/api/salaoContingencia.js";
import { dataCivilDoServico } from "../kernel/gateway/tempo.js";
import { lerPaciente } from "./leituras.js";
import { gerarFolhaContingenciaSalaoF3, listarFolhasContingenciaSalaoF3 } from "./salaoF3.js";
import type { ServidorDeps } from "./rotas.js";

/** Cópia operacional local: entrada médica explícita, sem aplicar novas regras clínicas. */
export function operarContingenciaSalao(deps: ServidorDeps, token: string, rota: string, raw: unknown) {
  const pedido = (rota === "gerarContingenciaSalao" ? GerarContingenciaSalao : ContextoContingenciaSalao).safeParse(raw);
  if (!pedido.success) return { status: 400, body: { codigo: "PAYLOAD_INVALIDO" } };
  const ctx = deps.sessoes.consultaSelecionada(token);
  if (!ctx || ctx.patientId !== pedido.data.patientId || ctx.encounterId !== pedido.data.encounterId) {
    return { status: 409, body: { codigo: "CONTEXTO_CONSULTA_ALTERADO" } };
  }
  const paciente = lerPaciente(deps.db, ctx.patientId);
  const encontro = deps.db.prepare("SELECT 1 FROM clinical_event WHERE patientId = ? AND encounterId = ? LIMIT 1")
    .get(ctx.patientId, ctx.encounterId);
  if (!paciente || !encontro) return { status: 404, body: { codigo: "PACIENTE_OU_ENCONTRO_AUSENTE" } };
  if (rota === "historicoContingenciaSalao") {
    return { status: 200, body: { folhas: listarFolhasContingenciaSalaoF3(deps.db, ctx.patientId)
      .filter(f => f.encounterId === ctx.encounterId) } };
  }
  const entrada = GerarContingenciaSalao.parse(pedido.data);
  const agora = deps.agora();
  const data = dataCivilDoServico(agora, "-03:00");
  if (data.estado !== "OK") return { status: 503, body: { codigo: "DATA_SERVICO_INDISPONIVEL" } };
  const id = createHash("sha256").update(JSON.stringify([ctx.patientId, ctx.encounterId, entrada.operationId])).digest("hex");
  const persistida = listarFolhasContingenciaSalaoF3(deps.db, ctx.patientId).find(f => f.folhaId === `folha-${id}`
    && f.encounterId === ctx.encounterId);
  const resultado = gerarFolhaContingenciaSalaoF3(deps.db, { sessoes: deps.sessoes, token, agora }, {
    folhaId: `folha-${id}`, patientId: ctx.patientId, encounterId: ctx.encounterId,
    nomePaciente: paciente.nome, dataImpressao: persistida?.dataImpressao ?? data.dataCivil, destino: entrada.destino,
    emergenciaAtiva: entrada.emergenciaAtiva, alertasOperacionaisE1: entrada.alertasOperacionaisE1,
    resumoTriagem: { ...entrada.resumoTriagem, Origem: "Registro operacional informado pelo médico; não substitui prescrição assinada." },
  });
  if (!resultado.ok) return { status: resultado.codigo === "ERRO_RENDERIZACAO_FOLHA" ? 503 : 409,
    body: { codigo: resultado.codigo } };
  return { status: 200, body: { folha: resultado.folha } };
}
