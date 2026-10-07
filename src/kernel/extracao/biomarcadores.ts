// FUGU-11b · Biomarker Requirement Engine (código, nunca LLM) — spec §9 / D-W9-33.
// Lê a tabela de dados e diz o que falta. Ausente = PENDENTE: nada é preenchido sozinho.
import type { ClinicalFact, ReviewException } from "./tipos.js";
import { orgaoCanonico } from "./normalizacao.js";
import {
  REQUISITOS_BIOMARCADORES, TUMORES_SEM_TABELA,
  type GrupoRequisitos, type RequisitoBiomarcador,
} from "./dados/biomarcadoresRequeridos.js";

/** Dados que qualquer tumor exige para a timeline (FUGU-10) e que nunca são inferidos. */
export const DADOS_OBRIGATORIOS: readonly string[] = ["HISTOLOGIA", "ESTADIAMENTO"];

export interface RequisitosCalculados {
  /** false quando não há tumor identificado: nada a exigir (nada é inventado). */
  readonly aplicavel: boolean;
  readonly tumor: string | null;
  readonly fonte: string | null;
  /** Biomarcadores exigidos para o tumor/histologia/estádio informados. */
  readonly biomarcadores: readonly RequisitoBiomarcador[];
  /** Histologia e estadiamento (sempre exigidos quando há tumor identificado). */
  readonly dadosObrigatorios: readonly string[];
  /** Tumores sem tabela curada ⇒ `[VERIFICAR]` em PEDIDOS. */
  readonly verificar: readonly string[];
}

function combina(grupo: GrupoRequisitos, tumor: string, histologia: string | null, estadio: string | null): boolean {
  if (grupo.tumor !== tumor) return false;
  if (grupo.histologia !== null && grupo.histologia !== histologia) return false;
  if (grupo.estadio !== null && grupo.estadio !== estadio) return false;
  return true;
}

/** `requiredBiomarkers({tumor, histologia, estadio})` — tabela de dados, sem LLM. */
export function requiredBiomarkers(contexto: Readonly<{
  tumor?: string | null; histologia?: string | null; estadio?: string | null;
}>): RequisitosCalculados {
  const tumor = orgaoCanonico(contexto.tumor ?? null);
  if (!tumor) {
    return { aplicavel: false, tumor: null, fonte: null, biomarcadores: [],
      dadosObrigatorios: [], verificar: [] };
  }
  const histologia = contexto.histologia ? orgaoCanonico(contexto.histologia) : null;
  const estadio = contexto.estadio ? String(contexto.estadio).trim().toLocaleUpperCase("pt-BR") : null;
  const grupos = REQUISITOS_BIOMARCADORES.filter((g) => combina(g, tumor, histologia, estadio));
  if (!grupos.length) {
    // Sem tabela curada para este tumor/histologia/estádio: registra `[VERIFICAR]`, não inventa regra.
    return { aplicavel: true, tumor, fonte: null, biomarcadores: [],
      dadosObrigatorios: [...DADOS_OBRIGATORIOS],
      verificar: TUMORES_SEM_TABELA.includes(tumor) ? [tumor] : [`${tumor} (${histologia ?? "qualquer"} / ${estadio ?? "qualquer"})`] };
  }
  const marcadores = new Map<string, RequisitoBiomarcador>();
  for (const grupo of grupos) for (const req of grupo.biomarcadores) marcadores.set(req.marcador, req);
  return {
    aplicavel: true,
    tumor,
    fonte: grupos[0]!.fonte,
    biomarcadores: [...marcadores.values()],
    dadosObrigatorios: [...DADOS_OBRIGATORIOS],
    verificar: [],
  };
}

function marcadoresPresentes(fatos: readonly ClinicalFact[]): Set<string> {
  const presentes = new Set<string>();
  for (const fact of fatos) {
    if (fact.domain !== "biomarker") continue;
    const v = typeof fact.value === "object" && fact.value !== null
      ? fact.value as Record<string, unknown> : {};
    const nome = typeof v.marker === "string" ? v.marker : "";
    if (nome.trim()) presentes.add(nome.trim().toLocaleUpperCase("pt-BR"));
  }
  return presentes;
}

function normalizarMarcador(marcador: string): string {
  return marcador.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleUpperCase("pt-BR").trim();
}

function presente(presentes: Set<string>, marcador: string): boolean {
  const alvo = normalizarMarcador(marcador);
  for (const nome of presentes) {
    const atual = normalizarMarcador(nome);
    if (atual === alvo || alvo.startsWith(`${atual} `) || atual.startsWith(`${alvo} `)) return true;
  }
  return false;
}

/** Exceções de campo obrigatório ausente, na forma da caixa de revisão. */
export function faltantesObrigatorios(
  fatos: readonly ClinicalFact[],
  requisitos: RequisitosCalculados,
  segmentId: string | null,
): readonly ReviewException[] {
  if (!requisitos.aplicavel) return [];
  const presentes = marcadoresPresentes(fatos);
  const faltando: string[] = [];
  for (const req of requisitos.biomarcadores) {
    if (req.indicacao === "SEMPRE" && !presente(presentes, req.marcador)) faltando.push(req.marcador);
  }
  if (requisitos.dadosObrigatorios.includes("HISTOLOGIA")
      && !fatos.some((f) => f.domain === "histology")) faltando.push("HISTOLOGIA");
  if (requisitos.dadosObrigatorios.includes("ESTADIAMENTO")
      && !fatos.some((f) => f.domain === "stage")) faltando.push("ESTADIAMENTO");
  return faltando.map((campo) => ({
    id: `exc:MISSING_REQUIRED:${segmentId ?? "sem-segmento"}:${campo}`,
    kind: "MISSING_REQUIRED" as const,
    segmentId,
    factIds: [],
    reason: `campo obrigatório ausente para ${requisitos.tumor}: ${campo} (NÃO SEI — nunca inferido)`,
    sourceIds: [],
  }));
}
