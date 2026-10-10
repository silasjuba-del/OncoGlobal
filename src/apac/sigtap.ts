import { createHash } from "node:crypto";
import { z } from "zod";
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
  financiamentoCodigo?: string;
  financiamentoNome?: string;
  valorSaCentavos?: number;
  instrumentosRegistro?: readonly string[];
  idadeMinimaOriginal?: string;
  idadeMaximaOriginal?: string;
  observacoesFonte?: string | undefined;
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

/** Metadados de cadastro administrativo: fonte conferida não significa aptidão clínica. */
export interface MetadadosSigtap {
  versao: string;
  estado: 'FONTE_OFICIAL_CONFERIDA' | 'CANDIDATO_NAO_CURADO';
  fonte: { url: string; arquivo: string; sha256: string; encoding: string };
  hashConteudo: string;
  decisao: { tipo: 'INTEGRACAO_CADASTRO_OFICIAL' | 'PENDENTE'; referencia: string };
  validacao: { competencia: string; quantidade: number; confronto: string; pendencias: string[] };
}
export type ResultadoCargaSigtap = { ativo: true; tabela: TabelaSigtap; meta: MetadadosSigtap }
  | { ativo: false; codigo: string };

/** Pins da release confrontada com os arquivos oficiais; alteração exige novo confronto documental. */
export const RELEASES_SIGTAP_CONFERIDAS = Object.freeze({
  "2026-09.v2610050950.f0c-1": Object.freeze({ competencia: "2026-09",
    fonteSha256: "e2f1a210d8de4148f946e74f18b7726d4bc8145c97f48c2338874851789a03df",
    conteudoSha256: "8ef522e129455c030300c83fab5dc3f0e930f847e823eebe72c4760bf8143aa1" }),
});

/** Carregamento offline: o chamador entrega bytes reais do ZIP oficial para validar a proveniência. */
export function carregarCompetenciaSigtap(valor: unknown, fonteOficial: Uint8Array): ResultadoCargaSigtap {
  const parsed = PacoteSigtap.safeParse(valor);
  if (!parsed.success) return { ativo: false, codigo: 'SIGTAP_PACOTE_INVALIDO' };
  const p = parsed.data;
  const release = Object.entries(RELEASES_SIGTAP_CONFERIDAS).find(([versao]) => versao === p.meta.versao)?.[1];
  if (!release || release.competencia !== p.competencia) return { ativo: false, codigo: "SIGTAP_RELEASE_NAO_CONFERIDA" };
  if (p.meta.estado !== 'FONTE_OFICIAL_CONFERIDA' || p.meta.decisao.tipo !== 'INTEGRACAO_CADASTRO_OFICIAL')
    return { ativo: false, codigo: 'SIGTAP_NAO_CURADO' };
  let host: string;
  try { host = new URL(p.meta.fonte.url).hostname; } catch { return { ativo: false, codigo: 'SIGTAP_FONTE_INVALIDA' }; }
  if (!host.endsWith('.datasus.gov.br') && host !== 'datasus.gov.br') return { ativo: false, codigo: 'SIGTAP_FONTE_NAO_OFICIAL' };
  if (createHash('sha256').update(fonteOficial).digest('hex') !== p.meta.fonte.sha256)
    return { ativo: false, codigo: 'SIGTAP_HASH_FONTE_DIVERGENTE' };
  if (p.meta.fonte.sha256 !== release.fonteSha256 || p.meta.hashConteudo !== release.conteudoSha256)
    return { ativo: false, codigo: "SIGTAP_CONTEUDO_NAO_CONFERIDO" };
  // Hash sobre o objeto serializado original, sem normalizar texto/códigos recebidos.
  const original = valor as { competencia: string; procedimentos: unknown[] };
  if (createHash('sha256').update(JSON.stringify({ competencia: original.competencia, procedimentos: original.procedimentos })).digest('hex') !== p.meta.hashConteudo)
    return { ativo: false, codigo: 'SIGTAP_HASH_CONTEUDO_DIVERGENTE' };
  if (p.meta.validacao.competencia !== p.competencia || p.meta.validacao.quantidade !== p.procedimentos.length)
    return { ativo: false, codigo: 'SIGTAP_VALIDACAO_DIVERGENTE' };
  try { return { ativo: true, tabela: montarTabelaSigtap(p.competencia, p.procedimentos), meta: p.meta }; }
  catch { return { ativo: false, codigo: 'SIGTAP_PROCEDIMENTOS_INVALIDOS' }; }
}

const ProcedimentoCarregado = z.object({
  codigo: z.string().regex(/^\d{10}$/), nome: z.string().min(1), sexo: z.enum(['M','F','AMBOS']).nullable(),
  idadeMinMeses: z.number().int().nonnegative().nullable(), idadeMaxMeses: z.number().int().nonnegative().nullable(),
  cidsCompativeis: z.array(z.string().regex(/^[A-Z][0-9]{2}[A-Z0-9]?$/)).nullable(), finalidadeDoGrupo: z.string().nullable(),
  modalidade: z.enum(['QT','RT']).nullable(), financiamentoCodigo: z.string().regex(/^\d{2}$/), financiamentoNome: z.string().min(1),
  valorSaCentavos: z.number().int().nonnegative(), instrumentosRegistro: z.array(z.string().regex(/^\d{2}$/)),
  idadeMinimaOriginal: z.string().regex(/^\d{4}$/), idadeMaximaOriginal: z.string().regex(/^\d{4}$/),
  observacoesFonte: z.string().optional(),
}).strict();
const PacoteSigtap = z.object({ competencia: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), procedimentos: z.array(ProcedimentoCarregado).min(1),
  meta: z.object({ versao: z.string().min(1), estado: z.enum(['FONTE_OFICIAL_CONFERIDA','CANDIDATO_NAO_CURADO']),
    fonte: z.object({ url:z.string().min(1),arquivo:z.string().min(1),sha256:z.string().regex(/^[a-f0-9]{64}$/),encoding:z.string().min(1) }).strict(),
    hashConteudo:z.string().regex(/^[a-f0-9]{64}$/),
    decisao:z.object({tipo:z.enum(['INTEGRACAO_CADASTRO_OFICIAL','PENDENTE']),referencia:z.string().min(1)}).strict(),
    validacao:z.object({competencia:z.string(),quantidade:z.number().int().positive(),confronto:z.string().min(1),pendencias:z.array(z.string())}).strict(),
  }).strict(),
}).strict();

/** O cadastro contém AIH e APAC: o instrumento é verificado antes do preenchimento APAC. */
export function buscarProcedimentoApac(t: TabelasSigtap, competencia: string, codigo: string, papel: 'PRINCIPAL' | 'SECUNDARIO' = 'PRINCIPAL') {
  const r = buscarProcedimento(t, competencia, codigo);
  if (!r.achou) return r;
  if (!r.proc.instrumentosRegistro) return { achou: false as const, motivo: 'INSTRUMENTO_NAO_CARREGADO' as const };
  if (!r.proc.instrumentosRegistro.includes(papel === 'PRINCIPAL' ? '06' : '07'))
    return { achou: false as const, motivo: 'INSTRUMENTO_INCOMPATIVEL_APAC' as const };
  return r;
}
