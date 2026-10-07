// W10-INT-PRESC-05 · Medication → RegulatoryClassifier → PrescriptionDocumentType (D-W9-24 §3).
// A tabela regulatória é VERSIONADA e INJETADA (corpus); este arquivo não embute nenhum medicamento.
// Sem correspondência = PENDENTE (nunca SIMPLE em silêncio, a menos que a TABELA declare um padrão).
// Dois tipos diferentes para o mesmo medicamento = CONFLITO (nunca some).
import { PrescriptionDocumentType } from "../../contracts/w10/prescricao.js";

export interface EntradaRegulatoria {
  /** nomes (DCB/comerciais) a casar; comparação sem acento/caixa */
  nomes: readonly string[];
  tipo: PrescriptionDocumentType;
  /** citação da norma, ex.: "Portaria SVS/MS 344/98, lista B1" */
  fonte: string;
}
export interface TabelaRegulatoria {
  versao: string;
  fonte: string;
  entradas: readonly EntradaRegulatoria[];
  /** tipo para o que não consta na tabela; ausente = PENDENTE */
  padrao?: PrescriptionDocumentType;
}

export type ResultadoClassificacao =
  | { estado: "CLASSIFICADO"; tipo: PrescriptionDocumentType; fonte: string; tabelaVersao: string; origem: "ENTRADA" | "PADRAO_DA_TABELA" }
  | { estado: "CONFLITO"; tipo: null; candidatos: PrescriptionDocumentType[]; tabelaVersao: string; motivo: string }
  | { estado: "PENDENTE"; tipo: null; tabelaVersao: string | null; motivo: string };

const norm = (t: string): string => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

/** o nome da tabela deve aparecer como palavra(s) inteira(s) no início do texto do medicamento (ex.: "DIPIRONA 500 MG") */
function casa(medicamento: string, nome: string): boolean {
  if (nome === "") return false;
  if (medicamento === nome) return true;
  return medicamento.startsWith(nome) && /[^A-Z0-9]/.test(medicamento.charAt(nome.length));
}

export function classificarDocumento(medicamento: string, tabela: TabelaRegulatoria | null): ResultadoClassificacao {
  if (tabela === null) return { estado: "PENDENTE", tipo: null, tabelaVersao: null, motivo: "tabela regulatória não carregada" };
  const v = tabela.versao;
  const m = norm(medicamento);
  if (m === "") return { estado: "PENDENTE", tipo: null, tabelaVersao: v, motivo: "medicamento não informado" };
  const achadas: EntradaRegulatoria[] = [];
  for (const e of tabela.entradas) {
    if (!PrescriptionDocumentType.safeParse(e.tipo).success)
      return { estado: "PENDENTE", tipo: null, tabelaVersao: v, motivo: `tabela ${v} contém tipo de documento inválido` };
    if (e.nomes.some((n) => casa(m, norm(n)))) achadas.push(e);
  }
  const tipos = [...new Set(achadas.map((e) => e.tipo))];
  if (tipos.length > 1)
    return { estado: "CONFLITO", tipo: null, candidatos: tipos, tabelaVersao: v, motivo: "entradas da tabela divergem para o mesmo medicamento" };
  const unica = achadas[0];
  if (unica) return { estado: "CLASSIFICADO", tipo: unica.tipo, fonte: unica.fonte, tabelaVersao: v, origem: "ENTRADA" };
  if (tabela.padrao !== undefined) {
    if (!PrescriptionDocumentType.safeParse(tabela.padrao).success)
      return { estado: "PENDENTE", tipo: null, tabelaVersao: v, motivo: `tabela ${v} contém padrão inválido` };
    return { estado: "CLASSIFICADO", tipo: tabela.padrao, fonte: tabela.fonte, tabelaVersao: v, origem: "PADRAO_DA_TABELA" };
  }
  return { estado: "PENDENTE", tipo: null, tabelaVersao: v, motivo: "medicamento fora da tabela regulatória" };
}
