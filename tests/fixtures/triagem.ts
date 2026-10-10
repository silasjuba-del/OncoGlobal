// Fixtures SINTÉTICAS de triagem (S-F0-05 · E5 Kimi). Nunca dado real de paciente.
import type { ContextoTriagem, Fonte, Triagem } from "../../src/contracts/index.js";

export const HOJE = "2026-10-05";

/** Fonte sintética de proveniência (C-02). */
export const fonteSintetica = (id = "fx-fonte-1"): Fonte => ({
  sourceId: id,
  classe: "MANUAL",
  localizador: null,
  dataClinica: "2026-10-01",
  dataCaptura: "2026-10-05T08:00:00-03:00",
  versao: "1",
  contentHash: `hash-sintetico-${id}`,
});

/** Dado<T> presente e verde, com fonte sintética (VERDE exige revisão ≠ RAW — INV-02). */
export const presente = <T,>(valor: T, fonteId = "fx-fonte-1") => ({
  valor,
  estado: "VERDE" as const,
  campo: "PRESENTE" as const,
  motivo: "coletado na triagem sintética",
  fontes: [fonteSintetica(fonteId)],
  revisao: "CONFIRMADO" as const,
});

/** Torna um campo ausente: valor null, AUSENTE, PENDENTE, fontes []. */
export const ausente = <T,>() => ({
  valor: null as T | null,
  estado: "PENDENTE" as const,
  campo: "AUSENTE" as const,
  motivo: "não coletado",
  fontes: [] as Fonte[],
  revisao: "RAW" as const,
});

/** Triagem válida: todos os campos PRESENTE/VERDE/CONFIRMADO, valores fora de qualquer corte.
 *  recurso AMBULATORIAL + idade 60 → destino SALAO quando limpa (CADEIRA/CAMA iriam à FRENTE — Q26). */
export const triagemBase = (overrides: Partial<Triagem> = {}): Triagem => ({
  patientId: "paciente-teste-01",
  encounterId: "encontro-teste-01",
  pas: presente(120),
  fc: presente(78),
  spo2: presente(98),
  tempDecimos: presente(365),
  hbDgDl: presente(120),
  anc: presente(3000),
  plq: presente(210000),
  coletaHemograma: presente("2026-10-01"),
  ecog: presente(1),
  grauCtcae: presente(1),
  tontura: false,
  vertigemHistoricoAnterior: null,
  vertigemInicioNovo: null,
  recurso: "AMBULATORIAL",
  idadeAnos: 60,
  chegadaEm: "2026-10-05T08:00:00-03:00",
  ...overrides,
});

export const REQUISITOS_TODOS = [
  "pas", "fc", "spo2", "tempDecimos", "hbDgDl", "anc", "plq", "coletaHemograma", "ecog", "grauCtcae",
] as const;

/** Contexto padrão: hoje fixo, prescrição vigente, todos os requisitos aplicáveis. */
export const ctxBase = (overrides: Partial<ContextoTriagem> = {}): ContextoTriagem => ({
  hoje: HOJE,
  prescricaoVigente: { documentId: "rx-teste-01", ciclosCobertos: 2, validaAte: "2026-10-12" },
  requisitosAplicaveis: [...REQUISITOS_TODOS],
  ...overrides,
});
