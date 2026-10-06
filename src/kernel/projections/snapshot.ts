import type { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import type { ClinicalEvent } from "../../contracts/operacao.js";
import { listarEventos } from "../ledger/ledger.js";

export interface RulesetRef { id: string; version: string; hash: string }
export interface ValorProjetado {
  valor: unknown;
  eventIds: string[];
  estado: "VERDE" | "VERMELHO" | "PENDENTE";
  candidatos?: { valor: unknown; eventId: string }[];
  /** A08: proposta CURRENT fica ao lado do fato; nunca o substitui nem apaga conflito. */
  proposta?: { valor: unknown; sourceId: string };
}

/** Só CONFIRMADO/ASSINADO vira fato projetado (A06); substituídos saem (A05). Usado por snapshot e séries. */
export function eventosVigentes(eventos: readonly ClinicalEvent[]): ClinicalEvent[] {
  const confirmados = eventos.filter((e) => e.revisao === "CONFIRMADO" || e.revisao === "ASSINADO");
  const substituidos = new Set(confirmados.map((e) => e.supersedesEventId).filter((id): id is string => !!id));
  return confirmados.filter((e) => !substituidos.has(e.eventId));
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
  const relevantes = eventosVigentes(eventos).filter((e) => e.patientId === patientId
    && (e.tumorLotId === tumorLotId || e.tumorLotId === null)
    && (!cutoff || e.criadoEm <= cutoff));
  const campos: Record<string, ValorProjetado> = Object.create(null);
  const refs = new Map<string, RulesetRef>();
  for (const e of relevantes) {
    const data = dadosDoEvento(e);
    if (!data) continue;
    for (const ref of refsDoEvento(data)) refs.set(`${ref.id}\0${ref.version}\0${ref.hash}`, ref);
    const campo = data.campo;
    if (typeof campo !== "string" || !campo) continue;
    const valor = data.valor ?? null;
    const anterior = campos[campo];
    const estadoBase = valor === null ? "PENDENTE" as const : "VERDE" as const; // A07: ausente nunca é VERDE
    if (!anterior) {
      campos[campo] = { valor, eventIds: [e.eventId], estado: estadoBase };
    } else if (JSON.stringify(anterior.valor) === JSON.stringify(valor) && anterior.estado !== "VERMELHO") {
      anterior.eventIds.push(e.eventId);
    } else {
      const candidatos = anterior.candidatos ?? anterior.eventIds.map((eventId) => ({ valor: anterior.valor, eventId }));
      candidatos.push({ valor, eventId: e.eventId });
      campos[campo] = { valor: null, estado: "VERMELHO",
        eventIds: [...anterior.eventIds, e.eventId], candidatos };
    }
  }
  // IDs não carregam precedência clínica: só a relação supersedes decide
  // substituição. Ordenar a representação não elege candidato nem oculta conflito.
  const eventIds = relevantes.map((e) => e.eventId).sort();
  const rulesetRefs = [...refs.values()].sort((a, b) =>
    `${a.id}:${a.version}:${a.hash}`.localeCompare(`${b.id}:${b.version}:${b.hash}`));
  for (const p of propostas) {
    // Proposta nunca vira fato e nunca apaga fato/conflito confirmado (A08).
    const existente = campos[p.campo];
    if (existente) existente.proposta = { valor: p.valor, sourceId: p.sourceId };
    else campos[p.campo] = { valor: null, eventIds: [], estado: "PENDENTE", proposta: { valor: p.valor, sourceId: p.sourceId } };
  }
  const camposOrdenados: Record<string, ValorProjetado> = Object.create(null);
  for (const campo of Object.keys(campos).sort()) {
    const entrada = campos[campo]!;
    camposOrdenados[campo] = {
      ...entrada,
      eventIds: [...entrada.eventIds].sort(),
      ...(entrada.candidatos
        ? { candidatos: [...entrada.candidatos].sort((a, b) =>
          a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0) }
        : {}),
    };
  }
  const kind = propostas.length ? "CURRENT" : "CONFIRMED";
  const contentHash = createHash("sha256")
    .update(JSON.stringify({ kind, patientId, tumorLotId, encounterId, projectionVersion, rulesetRefs,
      campos: camposOrdenados, eventIds }))
    .digest("hex");
  return { kind, patientId, tumorLotId, encounterId, projectionVersion,
    rulesetRefs, campos: camposOrdenados, eventIds, contentHash };
}

export function montarSnapshot(
  db: DatabaseSync, patientId: string, tumorLotId: string | null,
  encounterId: string, projectionVersion: string, propostas: readonly PropostaCurrent[] = [],
): CaseSnapshot {
  return projetarSnapshot(listarEventos(db, patientId), patientId, tumorLotId,
    encounterId, projectionVersion, propostas);
}
