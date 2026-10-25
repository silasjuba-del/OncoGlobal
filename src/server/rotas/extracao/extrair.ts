import { randomUUID } from "node:crypto";
import { z } from "zod";
import { type Sessao } from "../../../contracts/base.js";
import { MetodoCapturaTranscricao } from "../../../contracts/capturaTranscricao.js";
import { lerDraft, salvarDraft } from "../../../kernel/comandos/portas.js";
import { executarPipelineExtracao } from "../../../kernel/extracao/pipeline.js";
import { avaliarGatesExtracao } from '../../../kernel/extracao/gatesClinicos.js';
import { avaliarRadsRascunho } from "../../radsRascunho.js";
import type { ServidorDeps } from "../../rotas.js";
import { sha } from "../confirmacao.js";
import type { RespostaRota } from "../salaoCanal.js";

/** Extração: pipeline puro sobre a fonte e gravação do rascunho inerte, sem vínculo de paciente. */
export function extrairRascunho(deps: ServidorDeps, token: string, sessao: Sessao, raw: unknown): RespostaRota | null {
  const reply = (status: number, codigo: string, body: unknown = { codigo }): RespostaRota => ({ status, codigo, body });
  const inputSchema = z.object({
    recordingId: z.string().min(1), sourceId: z.string().min(1),
    sourceType: z.enum(["pathology", "imaging_report", "prescription", "medical_note", "nursing", "plaud", "administration"]),
    page: z.number().int().nonnegative().optional(), rawTranscript: z.string().min(1).max(200_000),
    contexto: z.object({ patientId: z.string().min(1), encounterId: z.string().min(1), tumorLotId: z.string().nullable() }).strict().optional(),
    captureMethod: MetodoCapturaTranscricao.optional(),
    capturedTranscript: z.string().max(200_000).optional(),
  }).strict();
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
  if (!parsed.data.rawTranscript.trim()) return reply(400, "TRANSCRICAO_VAZIA");
  if (parsed.data.captureMethod && (!parsed.data.contexto || parsed.data.capturedTranscript === undefined))
    return reply(400, "PROVENIENCIA_TRANSCRICAO_INCOMPLETA");
  if ((parsed.data.captureMethod === "LOCAL_DICTATION" || parsed.data.captureMethod === "DEEPGRAM_CLOUD")
    && !parsed.data.capturedTranscript?.trim()) return reply(400, "PROVENIENCIA_TRANSCRICAO_INCOMPLETA");
  if (parsed.data.contexto) {
    const atual = deps.sessoes.consultaSelecionada(token), pedido = parsed.data.contexto;
    if (!atual || atual.patientId !== pedido.patientId || atual.encounterId !== pedido.encounterId || (atual.tumorLotId ?? null) !== pedido.tumorLotId)
      return reply(409, "CONTEXTO_TRANSCRICAO_DIVERGENTE");
  }
  const input = {
    recordingId: parsed.data.recordingId, sourceId: parsed.data.sourceId,
    sourceType: parsed.data.sourceType, rawTranscript: parsed.data.rawTranscript,
    ...(parsed.data.captureMethod ? { captureMethod: parsed.data.captureMethod } : {}),
    ...(parsed.data.page === undefined ? {} : { page: parsed.data.page }),
  };
  const draftId = parsed.data.captureMethod ? `transcricao-${sha(JSON.stringify([
    parsed.data.contexto, parsed.data.recordingId, parsed.data.sourceId,
  ])).slice(0, 40)}` : randomUUID();
  const anterior = lerDraft(deps.db, draftId);
  if (anterior) {
    const payload = anterior.payload as { input?: unknown };
    if (anterior.patientId !== null || JSON.stringify(payload.input) !== JSON.stringify(parsed.data))
      return reply(409, "TRANSCRICAO_ID_CONFLITANTE");
    return reply(200, "REPLAY", { codigo: "REPLAY", draftId, revision: anterior.revision, linkedPatientId: null, requiresMedicalReview: true });
  }
  const state = executarPipelineExtracao(input);
  const rads = avaliarRadsRascunho(parsed.data.sourceType, parsed.data.rawTranscript, parsed.data.sourceId, deps.corpus?.rads);
  const { alertasRads } = rads;
  const alerts=avaliarGatesExtracao(state.facts,parsed.data.rawTranscript);
  const saved = salvarDraft(deps.db, {
    draftId, patientId: null, sourceId: parsed.data.sourceId,
    rawRef: `importacao-local:${parsed.data.recordingId}`,
    payload: { kind: "EXTRACAO_RASCUNHO", input: parsed.data, state, alerts, alertasRads },
    diagnostics: [
      "VINCULO_MEDICO_PENDENTE", ...rads.diagnostics, ...state.confirmationRequired.map((e) => e.kind),
      ...alerts.filter((a) => a.decisao !== "PASSA").map((a) => `${a.gate}_${a.decisao}`),
    ],
    revision: 0, criadoEm: deps.agora(),
  });
  return reply(201, "RASCUNHO_SALVO", {
    codigo: "RASCUNHO_SALVO", draftId: saved.draftId, revision: saved.revision,
    linkedPatientId: null, facts: state.facts, exceptions: state.confirmationRequired,
    timeline: null, alerts, alertasRads, requiresMedicalReview: true,
  });
  return null;
}
