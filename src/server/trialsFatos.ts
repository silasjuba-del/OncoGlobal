import type { DatabaseSync } from "node:sqlite";
import type { ClinicalEvent } from "../contracts/operacao.js";
import type { ContextoAcaoComposta } from "../contracts/api/acoesCompostas.js";
import type { EvidenceRef, PatientFact } from "../contracts/pesquisa/tipos.js";
import { FactQualifiers } from "../contracts/w10/extracao.js";
import { SchemaFatosTrialsResposta, type FatosTrialsResposta } from "../contracts/api/trialsServico.js";
import { listarEventos } from "../kernel/comandos/portas.js";
import { dadosDoEvento, projetarSnapshot } from "../kernel/projections/snapshot.js";
import { hashConteudoExibido as hash } from "./sessao.js";

function evidencia(evento: ClinicalEvent): EvidenceRef {
  const conteudo = evento;
  return { sourceId: evento.eventId, sourceRef: `ledger:${evento.eventId}`, locator: "payload.data",
    exactText: JSON.stringify(conteudo), contentHash: hash(conteudo) };
}
const escalar = (v: unknown): v is string | number | boolean =>
  typeof v === "string" && v.trim().length > 0 || typeof v === "boolean" || typeof v === "number" && Number.isFinite(v);

function afirmacaoAtual(evento: ClinicalEvent): boolean {
  const d = dadosDoEvento(evento);
  if (!d || d.requiresConfirmation === true || d.negado === true || d.negated === true
    || ["INFERRED", "UNCERTAIN"].includes(String(d.evidence))) return false;
  if (d.qualificadores !== undefined) {
    const q = FactQualifiers.safeParse(d.qualificadores);
    if (!q.success || q.data.polaridade !== "AFIRMADA" || q.data.sujeito !== "PACIENTE" || q.data.temporalidade !== "ATUAL")
      return false;
  }
  return true;
}

/** Reusa a projeção clínica vigente. Um rascunho ou dado pendente nunca satisfaz um critério. */
export function lerFatosTrials(db: DatabaseSync, contexto: ContextoAcaoComposta, agora: string): FatosTrialsResposta {
  const eventos = listarEventos(db, contexto.patientId).filter(e => ["CONFIRMADO", "ASSINADO"].includes(e.revisao)
    && Date.parse(e.criadoEm) <= Date.parse(agora));
  const snapshot = projetarSnapshot(eventos, contexto.patientId, contexto.tumorLotId,
    contexto.encounterId, "trial-fatos@2");
  const porId = new Map(eventos.map(e => [e.eventId, e]));
  const fatos: PatientFact[] = [];
  for (const [factKey, campo] of Object.entries(snapshot.campos)) {
    const fontes = campo.eventIds.flatMap(id => porId.has(id) ? [porId.get(id)!] : []);
    if (!fontes.length || fontes.some(e => e.patientId !== contexto.patientId || !["FATO", "FATO@1"].includes(e.tipo))) continue;
    const evidencias = fontes.map(evidencia);
    if (campo.estado === "VERMELHO") {
      fatos.push({ patientId: contexto.patientId, factKey, status: "CONFLITO", sources: evidencias });
      continue;
    }
    if (campo.estado !== "VERDE" || !escalar(campo.valor) || fontes.some(e => !afirmacaoAtual(e))) continue;
    const unidades = new Set(fontes.map(e => {
      const d = dadosDoEvento(e); const unidade = d?.unidade ?? d?.unit;
      return typeof unidade === "string" && unidade.trim() ? unidade : null;
    }));
    if (unidades.size > 1) {
      fatos.push({ patientId: contexto.patientId, factKey, status: "CONFLITO", sources: evidencias });
      continue;
    }
    const unit = [...unidades][0];
    const source: EvidenceRef = evidencias.length === 1 ? evidencias[0]! : {
      sourceId: `snapshot:${snapshot.contentHash}`, sourceRef: `ledger:${campo.eventIds.join(",")}`,
      locator: `campo:${factKey}`, exactText: JSON.stringify(evidencias), contentHash: hash(evidencias),
    };
    fatos.push({ patientId: contexto.patientId, factKey, value: campo.valor, status: "CONFIRMADO",
      source, ...(unit ? { unit } : {}) });
  }
  return SchemaFatosTrialsResposta.parse({ contexto, revisaoFatos: snapshot.contentHash, fatos });
}
