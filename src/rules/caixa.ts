import type { DraftEnvelope } from "../contracts/base.js";

export type ClasseCaixa = "DEMOGRAFICO" | "CLINICO" | "DOCUMENTO" | "COMANDO" | "DESCONHECIDO";
export interface ClassificacaoCaixa {
  classe: ClasseCaixa;
  origem: "TEXTO_DIRETO" | "DOCUMENTO";
  sourceId: string;
}
export type DestinoCaixa = "SECRETARIA" | "MEDICO_RASCUNHO" | "EXTRATOR"
  | "INTENCAO" | "REVISAR";
export interface RotaCaixa {
  destinos: DestinoCaixa[];
  estado: "PENDENTE" | "VERDE";
  salvarDraft: true;
  draftId: string;
}
const rotas: Record<ClasseCaixa, DestinoCaixa> = {
  DEMOGRAFICO: "SECRETARIA",
  CLINICO: "MEDICO_RASCUNHO",
  DOCUMENTO: "EXTRATOR",
  COMANDO: "INTENCAO",
  DESCONHECIDO: "REVISAR",
};

/** FN-25. Classification is untrusted metadata; document text has zero command authority. */
export function rotearCaixa(classificacao: readonly ClassificacaoCaixa[], envelope: DraftEnvelope): RotaCaixa {
  const vazio = envelope.payload == null
    || typeof envelope.payload === "string" && envelope.payload.trim() === "";
  if (vazio || !classificacao.length)
    return { destinos: ["REVISAR"], estado: "PENDENTE", salvarDraft: true, draftId: envelope.draftId };
  const destinos = [...new Set(classificacao.map((item) =>
    item.origem === "DOCUMENTO" ? "EXTRATOR" : rotas[item.classe]))];
  return { destinos, estado: destinos.includes("REVISAR") ? "PENDENTE" : "VERDE",
    salvarDraft: true, draftId: envelope.draftId };
}
