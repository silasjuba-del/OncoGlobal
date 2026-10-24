import { z } from "zod";
export const ClasseRascunho = z.enum(["INERTE", "DEDICADO", "EXTRACAO", "RESUMO"]);
/** Registro unico. Todos vedados no bundle generico. INERTE/EXTRACAO vedam a origem no kernel;
 * DEDICADO/RESUMO exigem payload reconstruido pelo fluxo especializado. RESUMO continua legivel na consulta. */
export const RASCUNHOS = Object.freeze({
  SKILL_EXECUCAO_RASCUNHO: "INERTE", SKILL_DOCUMENTO_RASCUNHO: "INERTE",
  SINTESE_RASCUNHO: "INERTE", LLM_EXTRACAO_RASCUNHO: "INERTE", D66_TRANSCRICAO_RASCUNHO: "INERTE",
  EXTRACAO_RASCUNHO: "EXTRACAO", PRESCRICAO_RASCUNHO: "DEDICADO",
  EVOLUCAO_RASCUNHO: "RESUMO", FLASH_RASCUNHO: "DEDICADO", FLASH_APAC_RASCUNHO: "DEDICADO",
  SALAO_TRIAGEM_RASCUNHO: "DEDICADO", ESTADO_DOENCA_RASCUNHO: "DEDICADO",
  PRESCRICAO_EXECUTAVEL_RASCUNHO: "DEDICADO", PRESCRICAO_EXECUTAVEL_AUXILIAR: "DEDICADO",
  JEV_CLASSIFICACAO_RASCUNHO: "INERTE", JEV_DIVERGENCIA_RASCUNHO: "INERTE",
  ACAO_COMPOSTA_RASCUNHO: "INERTE", FICHA_PRESCRICAO_INSTANCIADA: "INERTE",
  FICHA_PROTOCOLO_REVISOES: "INERTE",
  APAC_PREPARACAO_RASCUNHO: "INERTE", APAC_CONFIRMACAO_CANONICA: "DEDICADO",
} as const);
function kind(payload: unknown): keyof typeof RASCUNHOS | null {
  if (!payload || typeof payload !== "object" || !("kind" in payload)
    || typeof payload.kind !== "string" || !Object.hasOwn(RASCUNHOS, payload.kind)) return null;
  return payload.kind as keyof typeof RASCUNHOS;
}
function desconhecido(payload:unknown):boolean {
 return !!payload && typeof payload==="object" && "kind" in payload && typeof payload.kind==="string"
   && /_RASCUNHO$|_AUXILIAR$|^FICHA_/.test(payload.kind) && !Object.hasOwn(RASCUNHOS,payload.kind);
}
export function rascunhoNaoPromovivel(payload: unknown): boolean { return desconhecido(payload) || kind(payload) !== null; }
export function rascunhoInerte(payload: unknown): boolean {
  const k = kind(payload); return desconhecido(payload) || k !== null && RASCUNHOS[k] === "INERTE";
}

export const TipoRascunho = z.enum(Object.keys(RASCUNHOS) as [keyof typeof RASCUNHOS, ...(keyof typeof RASCUNHOS)[]]);
export const RegistroRascunhos = z.record(TipoRascunho, ClasseRascunho);
RegistroRascunhos.parse(RASCUNHOS);

export function fonteRascunhoNaoPromovivel(payload: unknown): boolean { const k=kind(payload); return desconhecido(payload) || k!==null && ["INERTE","EXTRACAO"].includes(RASCUNHOS[k]); }

export function rascunhoVisivelNaRevisao(payload:unknown):boolean { const k=kind(payload);return !desconhecido(payload) && (k===null || RASCUNHOS[k]==="RESUMO"); }
