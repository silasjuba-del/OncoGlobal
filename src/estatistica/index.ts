import { ClinicalEvent, SignatureReference, type ClinicalEvent as ClinicalEventType } from "../contracts/operacao.js";
import { TreatmentAdministration, type TreatmentAdministration as TreatmentAdministrationType } from "../contracts/clinico.js";
import type { DatabaseSync } from "node:sqlite";

export const ESTATISTICA_VERSAO = "W10-LUNA4-02" as const;

export type CategoriaEventoEstatistico = "FATO" | "DOCUMENTO" | "ADMINISTRACAO" | "OUTRO";
export type StatusAdministracaoEstatistica = "COMPLETA" | "PARCIAL" | "OMITIDA" | "INTERROMPIDA";

export interface ProjecaoEstatistica {
  versao: typeof ESTATISTICA_VERSAO;
  totalPacientes: number;
  eventosPorCategoria: Record<CategoriaEventoEstatistico, number>;
  pacientesPorCategoria: Record<CategoriaEventoEstatistico, number>;
  documentosAssinados: number;
  pacientesComDocumentoAssinado: number;
  administracoesPorStatus: Record<StatusAdministracaoEstatistica, number>;
  pacientesPorStatusDeAdministracao: Record<StatusAdministracaoEstatistica, number>;
  administracoesPendentes: number;
  administracoesConflito: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function categoriaEvento(tipo: string): CategoriaEventoEstatistico {
  if (tipo === "FATO") return "FATO";
  if (tipo === "DOCUMENTO") return "DOCUMENTO";
  if (tipo === "TreatmentAdministration") return "ADMINISTRACAO";
  return "OUTRO";
}

function fingerprint(evento: ClinicalEvent): string {
  // Used only to collapse a repeated immutable ledger row; never returned.
  return JSON.stringify(evento);
}

/** Regenerable, PHI-free projection from confirmed ledger events. */
export function projetarEstatistica(eventos: readonly ClinicalEventType[]): ProjecaoEstatistica {
  const porId = new Map<string, ClinicalEventType>();
  const hashes = new Map<string, string>();
  for (const evento of eventos) {
    const anterior = porId.get(evento.eventId);
    if (anterior) {
      if (hashes.get(evento.eventId) !== fingerprint(evento)) throw new Error("EVENT_ID_CONFLICT");
      continue;
    }
    porId.set(evento.eventId, evento);
    hashes.set(evento.eventId, fingerprint(evento));
  }

  for (const evento of porId.values()) {
    if (!evento.supersedesEventId) continue;
    const anterior = porId.get(evento.supersedesEventId);
    if (!anterior) throw new Error("SUPERSESSION_TARGET_MISSING");
    if (anterior.patientId !== evento.patientId || anterior.tumorLotId !== evento.tumorLotId)
      throw new Error("SUPERSESSION_CONTEXT_INVALID");
    if (Date.parse(evento.criadoEm) < Date.parse(anterior.criadoEm))
      throw new Error("SUPERSESSION_TARGET_IS_FUTURE");
  }

  for (const inicio of porId.keys()) {
    const caminho = new Set<string>();
    let atual: string | null = inicio;
    while (atual) {
      if (caminho.has(atual)) throw new Error("SUPERSESSION_CYCLE");
      caminho.add(atual);
      atual = porId.get(atual)?.supersedesEventId ?? null;
    }
  }

  const confirmados = [...porId.values()].filter((e) => e.revisao === "CONFIRMADO" || e.revisao === "ASSINADO");
  const substituidos = new Set(confirmados.map((e) => e.supersedesEventId).filter((id): id is string => !!id));
  const vigentes = confirmados.filter((e) => !substituidos.has(e.eventId));
  const pacientes = new Set<string>();
  const pacientesPorCategoria: Record<CategoriaEventoEstatistico, Set<string>> = {
    FATO: new Set(), DOCUMENTO: new Set(), ADMINISTRACAO: new Set(), OUTRO: new Set(),
  };
  const eventosPorCategoria: ProjecaoEstatistica["eventosPorCategoria"] = {
    FATO: 0, DOCUMENTO: 0, ADMINISTRACAO: 0, OUTRO: 0,
  };
  const pacientesDocumentoAssinado = new Set<string>();
  const statusSets: Record<StatusAdministracaoEstatistica, Set<string>> = {
    COMPLETA: new Set(), PARCIAL: new Set(), OMITIDA: new Set(), INTERROMPIDA: new Set(),
  };
  const administracoesPorStatus: ProjecaoEstatistica["administracoesPorStatus"] = {
    COMPLETA: 0, PARCIAL: 0, OMITIDA: 0, INTERROMPIDA: 0,
  };
  let documentosAssinados = 0;
  const administracoesPorChave = new Map<string, Array<{ evento: ClinicalEventType; dado: TreatmentAdministrationType }>>();
  const administracoesInvalidas: ClinicalEventType[] = [];

  for (const evento of vigentes) {
    if (evento.tipo !== "TreatmentAdministration") continue;
    const payload = evento.payload;
    const data = isObject(payload) && isObject(payload.data) ? payload.data : null;
    const parsed = data ? TreatmentAdministration.safeParse(data) : null;
    if (!parsed?.success) {
      administracoesInvalidas.push(evento);
      continue;
    }
    const chave = JSON.stringify([evento.patientId, parsed.data.adminId]);
    const registros = administracoesPorChave.get(chave) ?? [];
    registros.push({ evento, dado: parsed.data });
    administracoesPorChave.set(chave, registros);
  }

  let administracoesPendentes = administracoesInvalidas.length;
  let administracoesConflito = 0;
  for (const registros of administracoesPorChave.values()) {
    const canonicos = new Set(registros.map(({ dado }) => JSON.stringify({
      adminId: dado.adminId, cicloId: dado.cicloId, prescricaoRef: dado.prescricaoRef,
      item: dado.item, droga: dado.droga, quantidadeEfetivaMg: dado.quantidadeEfetivaMg,
      status: dado.status, motivo: dado.motivo, inicio: dado.inicio, fim: dado.fim,
    })));
    if (canonicos.size > 1) {
      // Competing current versions of one administration are unresolved facts.
      administracoesConflito += 1;
      administracoesPendentes += 1;
      continue;
    }
    // Same adminId and same clinical payload is one administration, even if
    // duplicated across confirmed ledger rows with different provenance.
    const { evento, dado } = registros[0]!;
    administracoesPorStatus[dado.status] += 1;
    statusSets[dado.status].add(evento.patientId);
  }

  for (const evento of vigentes) {
    pacientes.add(evento.patientId);
    const categoria = categoriaEvento(evento.tipo);
    eventosPorCategoria[categoria] += 1;
    pacientesPorCategoria[categoria].add(evento.patientId);
    if (evento.tipo === "TreatmentAdministration") continue;

    if (evento.tipo === "DOCUMENTO" && evento.revisao === "ASSINADO") {
      const payload = evento.payload;
      const outer = isObject(payload) && isObject(payload.data) ? payload.data : null;
      const signature = outer && isObject(outer.signature) ? SignatureReference.safeParse(outer.signature) : null;
      if (signature?.success) {
        documentosAssinados += 1;
        pacientesDocumentoAssinado.add(evento.patientId);
      }
    }

  }

  return {
    versao: ESTATISTICA_VERSAO,
    totalPacientes: pacientes.size,
    eventosPorCategoria,
    pacientesPorCategoria: {
      FATO: pacientesPorCategoria.FATO.size,
      DOCUMENTO: pacientesPorCategoria.DOCUMENTO.size,
      ADMINISTRACAO: pacientesPorCategoria.ADMINISTRACAO.size,
      OUTRO: pacientesPorCategoria.OUTRO.size,
    },
    documentosAssinados,
    pacientesComDocumentoAssinado: pacientesDocumentoAssinado.size,
    administracoesPorStatus,
    pacientesPorStatusDeAdministracao: {
      COMPLETA: statusSets.COMPLETA.size,
      PARCIAL: statusSets.PARCIAL.size,
      OMITIDA: statusSets.OMITIDA.size,
      INTERROMPIDA: statusSets.INTERROMPIDA.size,
    },
    administracoesPendentes,
    administracoesConflito,
  };
}

/** Reads the complete persisted ledger; no parallel counter/cache is written. */
export function projetarEstatisticaLedger(db: DatabaseSync): ProjecaoEstatistica {
  const eventos = db.prepare("SELECT * FROM clinical_event ORDER BY criadoEm, operationId, eventIndex")
    .all().map((row) => {
      const parsed = {
        ...row,
        payload: JSON.parse(String(row.payload)),
        fontes: JSON.parse(String(row.fontes)),
        criadoPor: JSON.parse(String(row.criadoPor)),
      };
      return ClinicalEvent.parse(parsed);
    });
  return projetarEstatistica(eventos);
}
