import type { FatoSistemico, FatoCirurgia, FatoRadioterapia, FatoTratamento, EstadoLinha, LinhaTratamento } from '../../contracts/api/historicoTratamento.js';
export type { FatoSistemico, FatoCirurgia, FatoRadioterapia, FatoTratamento, EstadoLinha, LinhaTratamento } from '../../contracts/api/historicoTratamento.js';
// W11-H15 · Histórico de tratamento: linha do tempo terapêutica única (Dr. Silas, "sempre com observação").
// Projeção pura a partir de fatos confirmados (administrações sistêmicas, cirurgias, radioterapia).
// Nada aqui completa dado ausente: campo faltante vira null e entra em `pendencias` (estado PENDENTE).
// Protocolo de ciclo ausente nunca é herdado do ciclo anterior. Médico e local de RT vêm só do fato.

const DATA_CIVIL = /^\d{4}-\d{2}-\d{2}$/;
const MS_DIA = 86_400_000;













function textoOuNulo(valor: string | null): string | null {
  return valor !== null && valor.trim() !== "" ? valor.trim() : null;
}

function numeroOuNulo(valor: number | null, campo: string, origem: string): number | null {
  if (valor === null) return null;
  if (!Number.isFinite(valor) || valor < 0) throw new Error(`${origem}: ${campo} inválido`);
  return valor;
}

/** Converte data civil YYYY-MM-DD em dias absolutos; rejeita formato ou data inexistente. */
function diaCivil(data: string, campo: string, origem: string): number {
  if (!DATA_CIVIL.test(data)) throw new Error(`${origem}: ${campo} fora do formato YYYY-MM-DD`);
  const [ano, mes, dia] = data.split("-").map(Number) as [number, number, number];
  const ms = Date.UTC(ano, mes - 1, dia);
  const d = new Date(ms);
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    throw new Error(`${origem}: ${campo} não é data existente`);
  }
  return Math.round(ms / MS_DIA);
}

function linhaSistemica(f: FatoSistemico): LinhaTratamento {
  diaCivil(f.data, "data", f.id);
  const protocolo = textoOuNulo(f.protocolo);
  const doseRelativaPct = numeroOuNulo(f.doseRelativaPct, "doseRelativaPct", f.id);
  const atrasoDias = f.previstoEm === null
    ? null
    : diaCivil(f.data, "data", f.id) - diaCivil(f.previstoEm, "previstoEm", f.id);
  const pendencias: string[] = [];
  if (protocolo === null) pendencias.push("protocolo");
  if (f.ciclo === null) pendencias.push("ciclo");
  if (doseRelativaPct === null) pendencias.push("doseRelativaPct");
  return {
    tipo: "SISTEMICO", data: f.data, periodo: null, protocoloOuTipo: protocolo,
    ciclo: f.ciclo, doseRelativaPct, atrasoDias,
    fracoes: null, doseTotalGy: null, boost: null, topografia: null,
    medicoResponsavel: null, local: null,
    observacao: textoOuNulo(f.observacao) ?? "", origem: f.id,
    estado: pendencias.length > 0 ? "PENDENTE" : "CONFIRMADO", pendencias,
  };
}

function linhaCirurgia(f: FatoCirurgia): LinhaTratamento {
  diaCivil(f.data, "data", f.id);
  const procedimento = textoOuNulo(f.procedimento);
  const pendencias = procedimento === null ? ["procedimento"] : [];
  return {
    tipo: "CIRURGIA", data: f.data, periodo: null, protocoloOuTipo: procedimento,
    ciclo: null, doseRelativaPct: null, atrasoDias: null,
    fracoes: null, doseTotalGy: null, boost: null, topografia: null,
    medicoResponsavel: null, local: null,
    observacao: textoOuNulo(f.observacao) ?? "", origem: f.id,
    estado: pendencias.length > 0 ? "PENDENTE" : "CONFIRMADO", pendencias,
  };
}

function linhaRadioterapia(f: FatoRadioterapia): LinhaTratamento {
  const inicioDia = diaCivil(f.inicio, "inicio", f.id);
  if (f.fim !== null && diaCivil(f.fim, "fim", f.id) < inicioDia) {
    throw new Error(`${f.id}: fim anterior ao início`);
  }
  const fim = textoOuNulo(f.fim);
  const fracoes = numeroOuNulo(f.fracoes, "fracoes", f.id);
  const doseTotalGy = numeroOuNulo(f.doseTotalGy, "doseTotalGy", f.id);
  const topografia = textoOuNulo(f.topografia);
  const medicoResponsavel = textoOuNulo(f.medicoResponsavel);
  const local = textoOuNulo(f.local);
  const pendencias: string[] = [];
  if (fim === null) pendencias.push("fim");
  if (fracoes === null) pendencias.push("fracoes");
  if (doseTotalGy === null) pendencias.push("doseTotalGy");
  if (topografia === null) pendencias.push("topografia");
  if (medicoResponsavel === null) pendencias.push("medicoResponsavel");
  if (local === null) pendencias.push("local");
  return {
    tipo: "RT", data: null, periodo: { inicio: f.inicio, fim },
    protocoloOuTipo: null, ciclo: null, doseRelativaPct: null, atrasoDias: null,
    fracoes, doseTotalGy, boost: textoOuNulo(f.boost), topografia,
    medicoResponsavel, local,
    observacao: textoOuNulo(f.observacao) ?? "", origem: f.id,
    estado: pendencias.length > 0 ? "PENDENTE" : "CONFIRMADO", pendencias,
  };
}

function chaveDeData(linha: LinhaTratamento): string {
  return linha.data ?? linha.periodo?.inicio ?? "";
}

function comparar(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Monta a linha do tempo terapêutica: ordem cronológica por data (RT pelo início),
 * empate resolvido pelo id de origem. Mesma entrada, qualquer ordem de entrada, mesma saída.
 */
export function projetarHistoricoTratamento(fatos: readonly FatoTratamento[]): readonly LinhaTratamento[] {
  const ids = new Set<string>();
  for (const f of fatos) {
    if (ids.has(f.id)) throw new Error(`origem duplicada: ${f.id}`);
    ids.add(f.id);
  }
  const linhas = fatos.map((f) => {
    switch (f.tipo) {
      case "SISTEMICO": return linhaSistemica(f);
      case "CIRURGIA": return linhaCirurgia(f);
      case "RT": return linhaRadioterapia(f);
    }
  });
  return [...linhas].sort((a, b) => comparar(chaveDeData(a), chaveDeData(b)) || comparar(a.origem, b.origem));
}
