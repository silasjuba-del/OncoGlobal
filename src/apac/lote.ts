// W10-INT-APAC-05 · Lote do dia (D-W5-10): vários pacientes, cada APAC validada individualmente,
// uma competência por lote (outro mês vai para o lote dele; competência ausente fica fora).
// Exportação SIA: BLOQUEADO_DEPENDENCIA até Layout_Exportacao_APAC.pdf entrar em docs/referencias/.
import type { Apac } from "../contracts/operacao.js";
import type { VereditoAntiglosa } from "../contracts/w10/clinico-w10.js";
import { antiglosa, type ContextoAntiglosa } from "./antiglosa.js";

export interface ItemLote { apacId: string; veredito: VereditoAntiglosa }
export interface LoteApac {
  competencia: string;
  itens: ItemLote[];
  /** Exportável só se TODAS as APACs forem exportáveis (o lote é uma saída externa). */
  exportavel: boolean;
}
export interface ForaDoLote { apacId: string; motivo: "COMPETENCIA_AUSENTE" }
export interface LotesDoDia { lotes: LoteApac[]; foraDoLote: ForaDoLote[] }

export type ContextoLote = Omit<ContextoAntiglosa, "competenciaLote" | "apacsDoLote">;

const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;

export function montarLotesDoDia(apacs: readonly Apac[], ctx: ContextoLote): LotesDoDia {
  const grupos = new Map<string, Apac[]>();
  const foraDoLote: ForaDoLote[] = [];
  for (const a of apacs) {
    if (!COMPETENCIA.test(a.competencia)) { foraDoLote.push({ apacId: a.apacId, motivo: "COMPETENCIA_AUSENTE" }); continue; }
    const g = grupos.get(a.competencia) ?? [];
    g.push(a);
    grupos.set(a.competencia, g);
  }
  const lotes = [...grupos.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([competencia, membros]) => {
    const itens = membros.map((a) => ({
      apacId: a.apacId,
      veredito: antiglosa(a, { ...ctx, competenciaLote: competencia, apacsDoLote: membros }),
    }));
    return { competencia, itens, exportavel: itens.every((i) => i.veredito.exportavel) };
  });
  return { lotes, foraDoLote };
}

export type ResultadoExportacaoSia = {
  status: "BLOQUEADO_DEPENDENCIA";
  motivo: string;
};

export const MOTIVO_EXPORTACAO_SIA =
  "Layout_Exportacao_APAC.pdf (rev. 08/07/2026; TXT posicional, registros 01/14/13/07/08, CRLF) ainda não está em docs/referencias/ (D-W9-12, W10-PLANO C6).";

/** Interface da exportação SIA. Implementação real só depois do layout oficial entrar no repo. */
export interface ExportadorSia {
  exportar(lote: LoteApac): ResultadoExportacaoSia;
}

export const exportadorSia: ExportadorSia = {
  exportar: () => ({ status: "BLOQUEADO_DEPENDENCIA", motivo: MOTIVO_EXPORTACAO_SIA }),
};
