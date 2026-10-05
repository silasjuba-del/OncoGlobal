import type { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import type { ClinicalEvent } from "../../contracts/operacao.js";
import { listarEventos } from "../ledger/ledger.js";

export interface RulesetRef { id: string; version: string; hash: string }
export interface ValorProjetado {
  valor: unknown;
  eventIds: string[];
  estado: "VERDE" | "VERMELHO";
  candidatos?: { valor: unknown; eventId: string }[];
}
export interface CaseSnapshot {
  kind: "CURRENT" | "CONFIRMED";
  patientId: string;
  tumorLotId: string | null;
  encounterId: string;
  projectionVersion: string;
  rulesetRefs: RulesetRef[];
  campos: Record<string, ValorProjetado>;
  eventIds: string[];
  contentHash: string;
}
export interface PropostaCurrent { campo: string; valor: unknown; sourceId: string }

export function dadosDoEvento(evento: ClinicalEvent): Record<string, unknown> | null {
  const wrapper = evento.payload;
  if (!wrapper || typeof wrapper !== "object" || !("data" in wrapper)) return null;
  const data = wrapper.data;
  return data && typeof data === "object" && !Array.isArray(data)
    ? data as Record<string, unknown> : null;
}

function refsDoEvento(data: Record<string, unknown>): RulesetRef[] {
  if (!Array.isArray(data.rulesetRefs)) return [];
  return data.rulesetRefs.filter((v): v is RulesetRef =>
    !!v && typeof v === "object"
    && typeof v.id === "string" && typeof v.version === "string" && typeof v.hash === "string"
    && !!v.hash);
}

/** Pure replay of CONFIRMED/ASSINADO events; CURRENT overlays remain ephemeral. */
export function projetarSnapshot(
  eventos: readonly ClinicalEvent[], patientId: string, tumorLotId: string | null,
  encounterId: string, projectionVersion: string, propostas: readonly PropostaCurrent[] = [],
): CaseSnapshot {
  const alvo = eventos.filter((e) => e.patientId === patientId && e.encounterId === encounterId);
  const cutoff = alvo.reduce((max, e) => e.criadoEm > max ? e.criadoEm : max, "");
  const relevantes = eventos.filter((e) => e.patientId === patientId
    && (e.tumorLotId === tumorLotId || e.tumorLotId === null)
    && (!cutoff || e.criadoEm <= cutoff));
  const substituidos = new Set(relevantes.map((e) => e.supersedesEventId).filter((id): id is string => !!id));
  const campos: Record<string, ValorProjetado> = Object.create(null);
  const refs = new Map<string, RulesetRef>();
  for (const e of relevantes) {
    if (substituidos.has(e.eventId)) continue;
    const data = dadosDoEvento(e);
    if (!data) continue;
    for (const ref of refsDoEvento(data)) refs.set(`${ref.id}\0${ref.version}\0${ref.hash}`, ref);
    const campo = data.campo;
    if (typeof campo !== "string" || !campo) continue;
    const valor = data.valor ?? null;
    const anterior = campos[campo];
    if (!anterior) {
      campos[campo] = { valor, eventIds: [e.eventId], estado: "VERDE" };
    } else if (JSON.stringify(anterior.valor) === JSON.stringify(valor) && anterior.estado === "VERDE") {
      anterior.eventIds.push(e.eventId);
    } else {
      const candidatos = anterior.candidatos ?? anterior.eventIds.map((eventId) => ({ valor: anterior.valor, eventId }));
      candidatos.push({ valor, eventId: e.eventId });
      campos[campo] = { valor: null, estado: "VERMELHO",
        eventIds: [...anterior.eventIds, e.eventId], candidatos };
    }
  }
  const eventIds = relevantes.map((e) => e.eventId);
  const rulesetRefs = [...refs.values()].sort((a, b) =>
    `${a.id}:${a.version}:${a.hash}`.localeCompare(`${b.id}:${b.version}:${b.hash}`));
  for (const p of propostas) {
    // Never turn a proposal into a confirmed ledger event, even if it carries a state-like string.
    campos[p.campo] = { valor: p.valor, eventIds: [], estado: "VERDE" };
  }
  const kind = propostas.length ? "CURRENT" : "CONFIRMED";
  const contentHash = createHash("sha256")
    .update(JSON.stringify({ kind, patientId, tumorLotId, encounterId, projectionVersion, rulesetRefs, campos, eventIds }))
    .digest("hex");
  return { kind, patientId, tumorLotId, encounterId, projectionVersion,
    rulesetRefs, campos, eventIds, contentHash };
}

export function montarSnapshot(
  db: DatabaseSync, patientId: string, tumorLotId: string | null,
  encounterId: string, projectionVersion: string, propostas: readonly PropostaCurrent[] = [],
): CaseSnapshot {
  return projetarSnapshot(listarEventos(db, patientId), patientId, tumorLotId,
    encounterId, projectionVersion, propostas);
}
