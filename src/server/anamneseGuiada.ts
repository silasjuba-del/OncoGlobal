import { createHash } from "node:crypto";
import { PedidoAnamneseGuiada, RespostaAnamneseGuiada } from "../contracts/api/anamneseGuiada.js";
import { RoteiroAnamneseTumor, type ResumoEstruturadoAnamnese } from "../contracts/f5/anamneseEOncoChief.js";
import { listarDrafts, lerDraft, salvarDraft, transacao } from "../kernel/comandos/portas.js";
import { hashConteudoExibido as hash } from "./sessao.js";
import { lerRelatosConsultaCanal } from "./canalOperacao.js";
import { consultarConsentimentoCanal } from "./canalEntrada.js";
import { registrarResumoAnamneseGuiadaF5, lerResumoAnamneseGuiadaF5 } from "./f5AnamneseOncoChief.js";
import { dataCivilDoServico } from "../rules/tempoServico.js";
import { auditarAcessoMedico } from "./acessoSetorial.js";
import type { ServidorDeps } from "./rotas.js";

export function operarAnamneseGuiada(raw: unknown, token: string, deps: ServidorDeps) {
  const negar = (codigo: string, status = 409) => ({ status, body: { codigo } });
  const sessao = deps.sessoes.obter(token), agora = deps.agora();
  if (!sessao) return negar("SESSAO_EXPIRADA", 401);
  const p = PedidoAnamneseGuiada.safeParse(raw); if (!p.success) return negar("PEDIDO_ANAMNESE_INVALIDO", 400);
  const pedido = p.data, ctx = pedido.contexto, atual = deps.sessoes.consultaSelecionada(token);
  if (!atual || atual.patientId !== ctx.patientId || atual.encounterId !== ctx.encounterId || (atual.tumorLotId ?? null) !== ctx.tumorLotId) return negar("CONTEXTO_CONSULTA_ALTERADO");
  if (!auditarAcessoMedico(deps, token, "LER_PRONTUARIO_COMPLETO").permitida) return negar("ACESSO_SETORIAL_NEGADO", 403);
  const civil = dataCivilDoServico(agora); if (civil.estado !== "OK") return negar("RELOGIO_INVALIDO");
  const acesso = { sessoes: deps.sessoes, token, agora };
  return transacao(deps.db, () => {
    const roteiros = () => listarDrafts(deps.db).flatMap(d => {
      const x = d.payload as { kind?: string; roteiro?: unknown; hash?: string };
      if (x?.kind !== "ROTEIRO_ANAMNESE_CONFERIDO" || x.hash !== hash(x.roteiro)) return [];
      const r = RoteiroAnamneseTumor.safeParse(x.roteiro); return r.success ? [r.data] : [];
    });
    const mensagens = lerRelatosConsultaCanal(deps.db, acesso, ctx.patientId).mensagens.filter(m => {
      const consentimento = consultarConsentimentoCanal(deps.db, m.contatoId);
      return m.patientId === ctx.patientId && m.estadoVinculo === "VINCULADO" && consentimento.estado === "TERMO_ACEITO"
        && consentimento.patientId === ctx.patientId && consentimento.finalidade.includes("COMUNICACAO_CLINICA");
    });
    const historico = () => listarDrafts(deps.db, ctx.patientId).flatMap(d => {
      const x = d.payload as { kind?: string; contexto?: unknown; resumoId?: string };
      if (x?.kind !== "ANAMNESE_GUIADA_EXECUTADA" || hash(x.contexto) !== hash(ctx) || !x.resumoId) return [];
      const r = lerResumoAnamneseGuiadaF5(deps.db, x.resumoId); return r && r.patientId === ctx.patientId ? [r] : [];
    });
    const ok = (resumo: ResumoEstruturadoAnamnese | null = null) => ({ status: 200, body: RespostaAnamneseGuiada.parse({
      codigo: "ANAMNESE_GUIADA", contexto: ctx, packs: (deps.catalogoTumorPacks?.packs ?? []).map(p => ({ id: p.referencia.id, titulo: p.titulo })),
      roteiros: roteiros(), mensagens: mensagens.map(({ mensagemId, texto, em, contatoId }) => ({ mensagemId, texto, em, contatoId })), historico: historico(), resumo,
    }) });
    if (pedido.acao === "BASE") return ok();
    if (pedido.acao === "CONFERIR_ROTEIRO") {
      if (!deps.catalogoTumorPacks?.packs.some(p => p.referencia.id === pedido.tumorPackId)) return negar("PACK_NAO_ENCONTRADO");
      const id = `roteiro-anamnese:${hash([pedido.tumorPackId, pedido.contextoClinico, pedido.perguntas, sessao.medicoId])}`;
      const roteiro = RoteiroAnamneseTumor.parse({ roteiroId: id, versao: "1", tumorPackId: pedido.tumorPackId, contextoClinico: pedido.contextoClinico,
        statusCuradoria: "CONFERIDA_MEDICO", aprovadoPor: sessao.medicoId, aprovadoEm: civil.dataCivil,
        fonte: "Perguntas escritas e conferidas pelo médico na interface local", lembretesOrientacoes: [],
        passos: pedido.perguntas.map((perguntaCanonica, i) => ({ passoId: `passo-${i + 1}`, ordem: i + 1, tipo: "PERGUNTA_SINTOMA", dominioClinico: "anamnese", perguntaCanonica, obrigatorioParaResumo: true })),
      });
      if (!lerDraft(deps.db, id)) salvarDraft(deps.db, { draftId: id, patientId: null, sourceId: id, rawRef: id, revision: 0, criadoEm: agora,
        payload: { kind: "ROTEIRO_ANAMNESE_CONFERIDO", roteiro, hash: hash(roteiro) }, diagnostics: [] });
      return ok();
    }
    const roteiro = roteiros().find(r => r.roteiroId === pedido.roteiroId);
    if (!roteiro) return negar("ROTEIRO_NAO_CONFERIDO");
    if (new Set(pedido.respostas.map(r => JSON.stringify([r.passoId, r.mensagemId]))).size !== pedido.respostas.length) return negar("RESPOSTA_DUPLICADA");
    if (pedido.respostas.some(r => !roteiro.passos.some(p => p.passoId === r.passoId)
      || !mensagens.some(m => m.mensagemId === r.mensagemId && m.contatoId === pedido.contatoId))) return negar("RESPOSTA_FORA_CONTEXTO");
    const id = `anamnese:${hash([ctx, pedido.pedidoId])}`, anterior = lerDraft(deps.db, id);
    if (anterior) {
      const x = anterior.payload as { requestHash?: string };
      return x.requestHash === hash(pedido) ? ok(lerResumoAnamneseGuiadaF5(deps.db, id)) : negar("PEDIDO_ANAMNESE_DIVERGENTE");
    }
    const r = registrarResumoAnamneseGuiadaF5(deps.db, acesso, { sessaoAnamneseId: id, patientId: ctx.patientId, contatoId: pedido.contatoId,
      roteiroCandidato: roteiro, alertasRedFlag: mensagens.filter(m => m.redFlag && pedido.respostas.some(p => p.mensagemId === m.mensagemId)).map(m => `Sinal de alerta no canal: ${m.mensagemId}; conferir relato e avaliação médica.`), respostas: pedido.respostas.map(p => {
        const m = mensagens.find(m => m.mensagemId === p.mensagemId)!;
        return { passoId: p.passoId, mensagemIdOrigem: m.mensagemId, respostaLiteral: m.texto, polaridade: p.polaridade,
          documentoOuFotoRef: null, respondidoEm: m.em, fonte: { sourceId: m.mensagemId, classe: m.origemCanal === "EMAIL" ? "EMAIL" as const : m.origemCanal?.startsWith("WHATSAPP") ? "WHATSAPP" as const : "CHAT_TEXT" as const,
            localizador: "Mensagem recebida no canal e vinculada ao paciente", dataClinica: null, dataCaptura: m.em, versao: "1", contentHash: createHash("sha256").update(m.texto).digest("hex") } };
      }) });
    if (!r.ok) return negar(r.codigo);
    salvarDraft(deps.db, { draftId: id, patientId: ctx.patientId, sourceId: id, rawRef: id, revision: 0, criadoEm: agora,
      payload: { kind: "ANAMNESE_GUIADA_EXECUTADA", contexto: ctx, resumoId: id, requestHash: hash(pedido) }, diagnostics: ["RELATO_NAO_CONFIRMADO"] });
    return ok(r.resumo);
  });
}
