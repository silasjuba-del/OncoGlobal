// Leitura tolerante de Apac.campos (valores crus ou Dado{valor,campo,revisao}). Ausente = PENDENTE.
export const FINALIDADES_QT = ["PALIATIVA", "CONTROLE_TEMPORARIO", "PREVIA", "ADJUVANTE", "CURATIVA"] as const;
export const FINALIDADES_RT = ["RADICAL", "ADJUVANTE", "ANTIALGICA", "PALIATIVA", "PREVIA", "ANTI_HEMORRAGICA"] as const;

export const ROTULO_FINALIDADE: Readonly<Record<string, string>> = {
  PALIATIVA: "Paliativa", CONTROLE_TEMPORARIO: "Para Controle Temporário", PREVIA: "Prévia",
  ADJUVANTE: "Adjuvante", CURATIVA: "Curativa", RADICAL: "Radical", ANTIALGICA: "Antiálgica",
  ANTI_HEMORRAGICA: "Anti-hemorrágica",
};

export function normalizarFinalidade(v: string): string {
  return v.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().replace(/[\s-]+/g, "_")
    .replace(/^PARA_/, "");
}

export type LeituraCampo = { estado: "PRESENTE"; valor: unknown } | { estado: "PENDENTE"; motivo: string };

export function lerCampo(campos: Record<string, unknown>, chave: string): LeituraCampo {
  const bruto = campos[chave];
  if (bruto === undefined || bruto === null) return { estado: "PENDENTE", motivo: "ausente" };
  if (typeof bruto === "object" && !Array.isArray(bruto) && "campo" in bruto && "valor" in bruto) {
    const d = bruto as { campo: unknown; valor: unknown; revisao?: unknown };
    if (d.campo !== "PRESENTE" || d.valor === null || d.valor === undefined) return { estado: "PENDENTE", motivo: "não informado" };
    if (d.revisao !== undefined && d.revisao !== "CONFIRMADO" && d.revisao !== "ASSINADO")
      return { estado: "PENDENTE", motivo: "sem confirmação do médico" };
    if (typeof d.valor === "string" && d.valor.trim() === "") return { estado: "PENDENTE", motivo: "vazio" };
    return { estado: "PRESENTE", valor: d.valor };
  }
  if (typeof bruto === "string" && bruto.trim() === "") return { estado: "PENDENTE", motivo: "vazio" };
  return { estado: "PRESENTE", valor: bruto };
}

export function lerTexto(campos: Record<string, unknown>, chave: string): string | null {
  const l = lerCampo(campos, chave);
  return l.estado === "PRESENTE" && typeof l.valor === "string" ? l.valor.trim() : null;
}

export interface ProcQtde { codigo: string; qtde: number }
export function lerSecundarios(campos: Record<string, unknown>): ProcQtde[] {
  const l = lerCampo(campos, "procedimentosSecundarios");
  if (l.estado !== "PRESENTE" || !Array.isArray(l.valor)) return [];
  const out: ProcQtde[] = [];
  for (const x of l.valor) {
    if (x && typeof x === "object" && "codigo" in x && typeof (x as { codigo: unknown }).codigo === "string") {
      const q = (x as { qtde?: unknown }).qtde;
      out.push({ codigo: (x as { codigo: string }).codigo, qtde: typeof q === "number" ? q : 1 });
    }
  }
  return out;
}
