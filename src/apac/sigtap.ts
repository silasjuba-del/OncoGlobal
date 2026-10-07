// W10-INT-APAC-02 · Tabela SIGTAP INJETADA, por competência (D-W9-11). Nunca embutida no código.
// Código de procedimento é SEMPRE string de 10 dígitos (zeros à esquerda preservados).

export type SexoProc = "M" | "F" | "AMBOS";
export type Modalidade = "QT" | "RT";

export interface ProcedimentoSigtap {
  codigo: string; // 10 dígitos, sem máscara
  nome: string;
  sexo: SexoProc | null; // null = atributo não carregado (PENDENTE)
  idadeMinMeses: number | null;
  idadeMaxMeses: number | null;
  /** CIDs compatíveis (RL_PROCEDIMENTO_CID). null = relacionamento não carregado. */
  cidsCompativeis: readonly string[] | null;
  /** Finalidade codificada no próprio grupo SIGTAP do procedimento (só comparação; nunca preenche). */
  finalidadeDoGrupo: string | null;
  modalidade: Modalidade | null;
}

export interface TabelaSigtap {
  competencia: string; // YYYY-MM
  procedimentos: Readonly<Record<string, ProcedimentoSigtap>>;
}

export function normalizarCodigoProc(c: string): string {
  return c.replace(/[.\-\s]/g, "");
}

export function codigoProcValido(c: string): boolean {
  return /^\d{10}$/.test(normalizarCodigoProc(c));
}

export function montarTabelaSigtap(competencia: string, itens: readonly ProcedimentoSigtap[]): TabelaSigtap {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) throw new Error("COMPETENCIA_INVALIDA");
  const procedimentos: Record<string, ProcedimentoSigtap> = {};
  for (const p of itens) {
    const codigo = normalizarCodigoProc(p.codigo);
    if (!/^\d{10}$/.test(codigo)) throw new Error(`CODIGO_PROC_INVALIDO:${p.codigo}`);
    if (procedimentos[codigo]) throw new Error(`CODIGO_PROC_DUPLICADO:${codigo}`);
    procedimentos[codigo] = { ...p, codigo };
  }
  return { competencia, procedimentos };
}

/** Tabelas por competência (YYYY-MM → tabela). A competência ausente NÃO cai em outra. */
export type TabelasSigtap = Readonly<Record<string, TabelaSigtap>>;

export function buscarProcedimento(t: TabelasSigtap, competencia: string, codigo: string):
  | { achou: true; proc: ProcedimentoSigtap }
  | { achou: false; motivo: "COMPETENCIA_SEM_TABELA" | "PROCEDIMENTO_INEXISTENTE" } {
  const tab = t[competencia];
  if (!tab) return { achou: false, motivo: "COMPETENCIA_SEM_TABELA" };
  const proc = tab.procedimentos[normalizarCodigoProc(codigo)];
  return proc ? { achou: true, proc } : { achou: false, motivo: "PROCEDIMENTO_INEXISTENTE" };
}
