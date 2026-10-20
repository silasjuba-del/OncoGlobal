import { createHash } from "node:crypto";
import { z } from "zod";
import { Id, type DraftEnvelope } from "../contracts/base.js";
import { AuditoriaOncoassist, RespostaOncoassist, type HistoricoOncoassist } from "../contracts/api/oncoassist.js";
import { lerDraft, listarDrafts, salvarDraft, transacao } from "../kernel/comandos/portas.js";
import { criarOncoassistJev } from "../kernel/llm/jev/oncoassist.js";
import { hashConteudoExibido } from "./sessao.js";
import { lerPaciente } from "./leituras.js";
import type { ServidorDeps } from "./rotas.js";

const KIND = "JEV_CLASSIFICACAO_RASCUNHO";
const POLITICA = "OA02-JEV-MARCADORES-v1";
const Contexto = z.object({ patientId: Id, encounterId: Id, tumorLotId: Id.nullable() });
type Contexto = z.infer<typeof Contexto>;
const Pedido = Contexto.extend({ draftId: Id, operationId: z.string().trim().min(1).max(240).optional() }).strict();
const Registro = z.object({ kind: z.literal(KIND), auditoria: AuditoriaOncoassist,
  identidadeHash: z.string(), estado: z.enum(["PENDENTE", "CONCLUIDA"]),
  resposta: RespostaOncoassist.nullable(), concluidoEm: z.string().nullable(),
});
type Registro = z.infer<typeof Registro>;
type Saida = { status: number; codigo: string; body: unknown };
class Recusa extends Error {
  constructor(readonly codigo: string, readonly status = 409) { super(codigo); }
}
const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const mesmoContexto = (a: Contexto, b: Contexto) => a.patientId === b.patientId
  && a.encounterId === b.encounterId && a.tumorLotId === b.tumorLotId;
const sucesso = (body: unknown): Saida => ({ status: 200, codigo: "ONCOASSIST_RESULTADO", body });

function validarContexto(deps: ServidorDeps, token: string, contexto: Contexto) {
  const sessao = deps.sessoes.obter(token);
  if (!sessao) throw new Recusa("SESSAO_INVALIDA", 401);
  const atual = deps.sessoes.consultaSelecionada(token);
  if (!atual) throw new Recusa("CONTEXTO_CONSULTA_NAO_SELECIONADO");
  if (!mesmoContexto({ ...atual, tumorLotId: atual.tumorLotId ?? null }, contexto))
    throw new Recusa("CONTEXTO_CONSULTA_ALTERADO");
  return sessao;
}

/** Fonte, vínculo e trecho são carregados exclusivamente do ledger local. */
function lerFonte(deps: ServidorDeps, contexto: Contexto, draftId: string) {
  const draft = lerDraft(deps.db, draftId);
  if (!draft || draft.patientId !== contexto.patientId) throw new Recusa("DRAFT_FORA_DO_ESCOPO");
  const payload = z.object({ kind: z.literal("EXTRACAO_RASCUNHO"),
    input: z.object({ sourceId: Id, rawTranscript: z.string().min(1) }),
    patientLinkReview: Contexto.extend({ segmentId: Id }),
    state: z.object({ segments: z.array(z.object({ id: Id, sourceId: Id, rawTranscript: z.string() }).passthrough()) }),
  }).safeParse(draft.payload);
  if (!payload.success || !mesmoContexto(payload.data.patientLinkReview, contexto))
    throw new Recusa("DRAFT_FORA_DO_ESCOPO");
  const segment = payload.data.state.segments.find(s => s.id === payload.data.patientLinkReview.segmentId
    && s.sourceId === payload.data.input.sourceId && s.sourceId === draft.sourceId);
  if (!segment) throw new Recusa("SEGMENTO_VINCULADO_NAO_CONSTA");
  return { texto: segment.rawTranscript, draftId, segmentId: segment.id, sourceId: segment.sourceId,
    fonteRevision: draft.revision, fonteSha256: sha(segment.rawTranscript),
    fontePayloadHash: hashConteudoExibido(draft.payload) };
}
type FonteLocal = ReturnType<typeof lerFonte>;
function identidade(contexto: Contexto, fonte: FonteLocal) {
  const { texto: _texto, ...referencia } = fonte;
  return hashConteudoExibido({ ...Contexto.parse(contexto), ...referencia });
}
function fonteAtual(deps: ServidorDeps, registro: Registro): boolean {
  try { return identidade(registro.auditoria, lerFonte(deps, registro.auditoria, registro.auditoria.draftId)) === registro.identidadeHash; }
  catch (erro) { if (erro instanceof Recusa) return false; throw erro; }
}
function politicaAtual(registro: Registro): "MESMA_VERSAO" | "VERSAO_DIFERENTE" | "NAO_VERIFICAVEL" {
  const capturada = registro.auditoria.politicaVersao.trim();
  if (!capturada) return "NAO_VERIFICAVEL";
  return capturada === POLITICA ? "MESMA_VERSAO" : "VERSAO_DIFERENTE";
}
function registros(deps: ServidorDeps, contexto: Contexto) {
  return listarDrafts(deps.db, contexto.patientId).flatMap(draft => {
    const p = Registro.safeParse(draft.payload);
    return p.success && mesmoContexto(p.data.auditoria, contexto) ? [{ draft, registro: p.data }] : [];
  });
}
function respostaGravada(registro: Registro) {
  return registro.resposta ?? { status: "PENDENTE", codigo: "OPERACAO_PENDENTE", auditoria: registro.auditoria };
}

/** Uma divergência é outra evidência inerte, sem texto de fonte ou resposta em logs. */
function divergencia(deps: ServidorDeps, original: DraftEnvelope, tentativaHash: string, ator: string,
  tentativa: { contexto: Contexto; draftId: string; fonte: Omit<FonteLocal, "texto"> | null }) {
  const draftId = `jev-divergencia-${sha(`${original.draftId}:${tentativaHash}`)}`;
  if (lerDraft(deps.db, draftId)) return;
  salvarDraft(deps.db, { draftId, patientId: original.patientId, sourceId: original.sourceId,
    rawRef: original.draftId, revision: 0, criadoEm: deps.agora(), diagnostics: ["OPERACAO_DIVERGENTE"],
    payload: { kind: "JEV_DIVERGENCIA_RASCUNHO", propostaId: original.draftId, tentativaHash, tentativa,
      capturadoPor: { tipo: "SESSAO", id: ator }, capturadoEm: deps.agora(), revisaoObrigatoria: true } });
}

export async function operarOncoassistPropostas(deps: ServidorDeps, token: string,
  rota: "oncoassistClassificar" | "oncoassistHistorico", raw: unknown, signal: AbortSignal): Promise<Saida> {
  try {
    if (rota === "oncoassistHistorico") {
      const parsed = Contexto.strict().safeParse(raw);
      if (!parsed.success) throw new Recusa("PAYLOAD_INVALIDO", 400);
      return transacao(deps.db, () => {
        validarContexto(deps, token, parsed.data);
        const historico: HistoricoOncoassist = { propostas: registros(deps, parsed.data).map(({ registro }) => ({
          auditoria: registro.auditoria, estado: registro.estado, resposta: registro.resposta,
          validade: fonteAtual(deps, registro) ? "ATUAL" as const : "FONTE_ALTERADA" as const,
          validadePolitica: politicaAtual(registro),
        })).sort((a, b) => b.auditoria.propostaRevision - a.auditoria.propostaRevision
          || a.auditoria.propostaId.localeCompare(b.auditoria.propostaId)) };
        return sucesso(historico);
      });
    }
    const parsed = Pedido.safeParse(raw);
    if (!parsed.success) throw new Recusa("PAYLOAD_INVALIDO", 400);
    const pedido = parsed.data;
    const contexto = Contexto.parse(pedido);
    // O consumidor legado tem uma operação estável por fonte/contexto. A UI OA02 envia uma UUID por gesto.
    const operationId = pedido.operationId ?? `legado-${hashConteudoExibido({ ...contexto, draftId: pedido.draftId })}`;
    const propostaId = `jev-proposta-${sha(operationId)}`;
    const reserva = transacao(deps.db, () => {
      const sessao = validarContexto(deps, token, contexto);
      const existente = lerDraft(deps.db, propostaId);
      if (existente) {
        const registro = Registro.parse(existente.payload);
        let tentativaHash = hashConteudoExibido({ ...contexto, draftId: pedido.draftId });
        let fonte: FonteLocal | null = null;
        try { fonte = lerFonte(deps, contexto, pedido.draftId); tentativaHash = identidade(contexto, fonte); }
        catch (erro) { if (!(erro instanceof Recusa)) throw erro; }
        if (!mesmoContexto(registro.auditoria, contexto) || registro.auditoria.draftId !== pedido.draftId
          || tentativaHash !== registro.identidadeHash) {
          const referencia = fonte ? (({ texto: _texto, ...ref }) => ref)(fonte) : null;
          divergencia(deps, existente, tentativaHash, sessao.medicoId,
            { contexto, draftId: pedido.draftId, fonte: referencia });
          // Retornar, não lançar: a evidência da divergência deve COMMITAR.
          const codigo = mesmoContexto(registro.auditoria, contexto) && registro.auditoria.draftId === pedido.draftId
            ? "FONTE_ALTERADA" : "OPERACAO_DIVERGENTE";
          return { saida: { status: 409, codigo, body: { codigo } } };
        }
        return { saida: sucesso(respostaGravada(registro)) };
      }
      if (signal.aborted) throw new Recusa("CANCELADO");
      const fonte = lerFonte(deps, contexto, pedido.draftId);
      const paciente = lerPaciente(deps.db, contexto.patientId);
      if (!paciente) throw new Recusa("PACIENTE_DESTINO_NAO_ENCONTRADO");
      const revisoes = registros(deps, contexto).filter(r => r.registro.auditoria.draftId === pedido.draftId);
      const propostaRevision = 1 + Math.max(0, ...revisoes.map(r => r.registro.auditoria.propostaRevision));
      const { texto: _texto, ...referencia } = fonte;
      const auditoria: AuditoriaOncoassist = { ...contexto, ...referencia, propostaId, operationId,
        propostaRevision, politicaVersao: POLITICA, mecanismo: "JEV_MARCADORES_DOCUMENTAIS",
        // O contrato Jev atual não fornece provedor. Não inferir a partir do nome do modelo.
        provedor: null, capturadoPor: { tipo: "SESSAO", id: sessao.medicoId },
        capturadoEm: deps.agora(), revisaoObrigatoria: true };
      const registro: Registro = { kind: KIND, auditoria, identidadeHash: identidade(contexto, fonte),
        estado: "PENDENTE", resposta: null, concluidoEm: null };
      const draft = salvarDraft(deps.db, { draftId: propostaId, patientId: contexto.patientId,
        sourceId: fonte.sourceId, rawRef: fonte.draftId, payload: registro, revision: 0,
        diagnostics: ["REVISAO_MEDICA_OBRIGATORIA", "PROPOSTA_DOCUMENTAL_NAO_PROMOVIVEL"], criadoEm: auditoria.capturadoEm });
      return { draft, registro, fonte, dicionario: { nomes: [paciente.nome],
        identificadores: [paciente.patientId, sessao.medicoId, sessao.crm,
          ...paciente.identificadores.map(item => item.valor), ...(paciente.nascimento ? [paciente.nascimento] : [])] } };
    });
    if (reserva.saida) return reserva.saida;
    // Nenhuma transação fica aberta enquanto o transporte aguarda.
    const service = deps.oncoassistJev ?? criarOncoassistJev();
    const resultado = await service.avaliar({ fonte: { id: reserva.fonte.sourceId, texto: reserva.fonte.texto } },
      { dicionario: reserva.dicionario }, signal);
    return transacao(deps.db, () => {
      validarContexto(deps, token, contexto);
      if (!fonteAtual(deps, reserva.registro)) throw new Recusa("FONTE_ALTERADA");
      if (signal.aborted) throw new Recusa("CANCELADO");
      const atual = lerDraft(deps.db, propostaId);
      if (!atual) throw new Recusa("OPERACAO_AUSENTE");
      const registro = Registro.parse(atual.payload);
      if (registro.identidadeHash !== reserva.registro.identidadeHash) throw new Recusa("OPERACAO_DIVERGENTE");
      // Uma conclusão anterior é imutável, mesmo se outro executor tardio apresentar resultado distinto.
      if (registro.estado === "CONCLUIDA") return sucesso(respostaGravada(registro));
      if (resultado.status === "PROPOSTA" && (resultado.fonte.id !== reserva.fonte.sourceId
        || resultado.fonte.sha256 !== reserva.fonte.fonteSha256)) throw new Recusa("FONTE_ALTERADA");
      const resposta = RespostaOncoassist.parse({ ...resultado, auditoria: registro.auditoria });
      salvarDraft(deps.db, { ...atual, revision: atual.revision + 1,
        payload: { ...registro, estado: "CONCLUIDA", resposta, concluidoEm: deps.agora() } satisfies Registro });
      return sucesso(resposta);
    });
  } catch (erro) {
    if (!(erro instanceof Recusa)) throw erro;
    return { status: erro.status, codigo: erro.codigo, body: { codigo: erro.codigo } };
  }
}
