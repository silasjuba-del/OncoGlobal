// W11-H27 · Enquadramento regulatório versionado (regra MEMORY_OS → oncoMed, fontes/M-AJ).
// O bloco regulatório é UMA unidade vinculada ao contexto clínico, não quatro campos soltos.
// Mudança de estágio, linha ou intenção (ou de qualquer campo da unidade) gera NOVA VERSÃO com
// `supersedes` apontando para a anterior. Nada é apagado. Nenhuma tradução de vocabulário:
// os textos são guardados exatamente como o médico os informou. Ausente = null (PENDENTE).
import { codigoProcValido, normalizarCodigoProc } from "./sigtap.js";

export const PRIORIDADES_ENQUADRAMENTO = ["ELETIVO", "PRIORITARIO", "URGENCIA", "EMERGENCIA"] as const;
export type PrioridadeEnquadramento = (typeof PRIORIDADES_ENQUADRAMENTO)[number];

export interface EnquadramentoRegulatorio {
  cid: string; // CID-10 (ex.: "C61" ou "C50.9")
  diagnostico: string;
  estadio: string | null;
  biomarcador: string | null;
  sigtap: string | null; // 10 dígitos, sem máscara
  finalidade: string | null; // escolha do médico
  linha: number | null; // linha de tratamento do contexto clínico
  prioridade: PrioridadeEnquadramento | null; // marcada pelo médico
  competencia: string | null; // AAAA-MM
  proveniencia: string; // de onde veio o dado (documento, consulta, evento)
}

export interface VersaoEnquadramento {
  versao: number; // 1, 2, 3… dentro da unidade
  supersedes: number | null; // versão imediatamente anterior, ou null na primeira
  enquadramento: EnquadramentoRegulatorio;
}

export interface ResultadoEnquadramento {
  historico: VersaoEnquadramento[];
  criouNovaVersao: boolean;
}

const CID = /^[A-Z]\d{2}(\.\d{1,2})?$/;
const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;

function validar(e: EnquadramentoRegulatorio): EnquadramentoRegulatorio {
  if (!CID.test(e.cid)) throw new Error(`CID_INVALIDO:${e.cid}`);
  if (e.diagnostico.trim() === "") throw new Error("DIAGNOSTICO_VAZIO");
  if (e.proveniencia.trim() === "") throw new Error("PROVENIENCIA_VAZIA");
  if (e.sigtap !== null && !codigoProcValido(e.sigtap)) throw new Error(`SIGTAP_INVALIDO:${e.sigtap}`);
  if (e.competencia !== null && !COMPETENCIA.test(e.competencia)) throw new Error(`COMPETENCIA_INVALIDA:${e.competencia}`);
  if (e.prioridade !== null && !(PRIORIDADES_ENQUADRAMENTO as readonly string[]).includes(e.prioridade)) {
    throw new Error(`PRIORIDADE_INVALIDA:${e.prioridade}`);
  }
  if (e.linha !== null && (!Number.isInteger(e.linha) || e.linha < 1)) throw new Error(`LINHA_INVALIDA:${e.linha}`);
  return {
    ...e,
    sigtap: e.sigtap === null ? null : normalizarCodigoProc(e.sigtap),
  };
}

function mesmoEnquadramento(a: EnquadramentoRegulatorio, b: EnquadramentoRegulatorio): boolean {
  return (
    a.cid === b.cid &&
    a.diagnostico === b.diagnostico &&
    a.estadio === b.estadio &&
    a.biomarcador === b.biomarcador &&
    a.sigtap === b.sigtap &&
    a.finalidade === b.finalidade &&
    a.linha === b.linha &&
    a.prioridade === b.prioridade &&
    a.competencia === b.competencia &&
    a.proveniencia === b.proveniencia
  );
}

function copiaVersao(v: VersaoEnquadramento): VersaoEnquadramento {
  return { versao: v.versao, supersedes: v.supersedes, enquadramento: { ...v.enquadramento } };
}

/** Primeira versão da unidade regulatória do paciente. */
export function iniciarEnquadramento(e: EnquadramentoRegulatorio): VersaoEnquadramento[] {
  return [{ versao: 1, supersedes: null, enquadramento: validar(e) }];
}

/** Versão vigente (a última; nunca apagada, apenas superada). */
export function enquadramentoVigente(historico: readonly VersaoEnquadramento[]): VersaoEnquadramento | null {
  return historico.length === 0 ? null : copiaVersao(historico[historico.length - 1]!);
}

/**
 * Aplica uma proposta de enquadramento ao histórico.
 * - Igual à versão vigente: nada muda (criouNovaVersao = false).
 * - Diferente em qualquer campo (estágio, linha, intenção ou demais): acrescenta nova versão com
 *   supersedes = versão anterior. O histórico recebido não é alterado.
 */
export function registrarEnquadramento(
  historico: readonly VersaoEnquadramento[],
  proposta: EnquadramentoRegulatorio,
): ResultadoEnquadramento {
  const nova = validar(proposta);
  if (historico.length === 0) {
    return { historico: iniciarEnquadramento(nova), criouNovaVersao: true };
  }
  const atual = historico[historico.length - 1]!;
  if (mesmoEnquadramento(atual.enquadramento, nova)) {
    return { historico: historico.map(copiaVersao), criouNovaVersao: false };
  }
  const versao = atual.versao + 1;
  return {
    historico: [...historico.map(copiaVersao), { versao, supersedes: atual.versao, enquadramento: nova }],
    criouNovaVersao: true,
  };
}

/** Histórico consultável, da versão mais antiga para a mais recente (cópia). */
export function historicoEnquadramento(historico: readonly VersaoEnquadramento[]): VersaoEnquadramento[] {
  return historico.map(copiaVersao);
}
