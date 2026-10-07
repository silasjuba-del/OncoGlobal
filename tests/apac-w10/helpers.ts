// Só para teste: leitor do CSV de referência + fábricas sintéticas. Nada disso entra em src/.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Apac } from "../../src/contracts/operacao.js";
import type { CaixaNumerada } from "../../src/contracts/w10/clinico-w10.js";
import { calcularCnsDefinitivo } from "../../src/apac/cns.js";
import { montarTabelaSigtap, type ProcedimentoSigtap, type TabelaSigtap } from "../../src/apac/sigtap.js";

function linhaCsv(l: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i]!;
    if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

export function lerCsvSigtapReferencia(): { tabela: TabelaSigtap; linhas: Record<string, string>[] } {
  const caminho = fileURLToPath(new URL("../../docs/referencias/onco-referencia/01-sigtap.csv", import.meta.url));
  const linhas = readFileSync(caminho, "utf-8").replace(/^﻿/, "").split("\n").map((l) => l.replace(/\r+$/, "")).filter((l) => l.trim() !== "");
  const cab = linhaCsv(linhas[0]!);
  const rows = linhas.slice(1).map((l) => Object.fromEntries(linhaCsv(l).map((v, i) => [cab[i]!, v])));
  const [mes, ano] = rows[0]!["competencia"]!.split("/");
  const itens: ProcedimentoSigtap[] = rows.map((r) => ({
    codigo: r["codigo_10dig"]!, nome: r["nome"]!, sexo: null, idadeMinMeses: null, idadeMaxMeses: null,
    cidsCompativeis: null, finalidadeDoGrupo: null, modalidade: null,
  }));
  return { tabela: montarTabelaSigtap(`${ano}-${mes}`, itens), linhas: rows };
}

// CNS sintético gerado pelo próprio algoritmo (nunca de pessoa real)
export const CNS_OK = calcularCnsDefinitivo("10000000001"); // prefixo 1
export const CNS_OK2 = calcularCnsDefinitivo("20000000002");
export const CNS_SOLIC = calcularCnsDefinitivo("10000000003");
export const CNS_RUIM = CNS_OK.slice(0, 14) + String((Number(CNS_OK[14]) + 1) % 10);

export const COD_QT = "0304020044"; // QT paliativa estômago (CSV)
export const COD_ZERO = "0301010072"; // começa com zero

export const CAIXAS: CaixaNumerada[] = ["pacienteCns", "cidPrincipal", "finalidadeApac", "procedimentoPrincipal", "pacienteNascimento", "cnesSolicitante", "pacienteSexo"]
  .map((c, i) => ({
    numero: 100 + i, chave: `apac.${c}`, nome: c, significado: c, ondeAparece: ["laudo APAC"], tipo: "TEXTO" as const, editavelPor: "MEDICO" as const,
  }));

export function proc(over: Partial<ProcedimentoSigtap> = {}): ProcedimentoSigtap {
  return {
    codigo: COD_QT, nome: "QUIMIOTERAPIA DO ADENOCARCINOMA DE ESTÔMAGO AVANÇADO", sexo: "AMBOS", idadeMinMeses: 216, idadeMaxMeses: null,
    cidsCompativeis: ["C160", "C161"], finalidadeDoGrupo: "PALIATIVA", modalidade: "QT", ...over,
  };
}

export function camposOk(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    pacienteNome: "Paciente Teste 01", pacienteCns: CNS_OK, pacienteNascimento: "1960-05-10", pacienteSexo: "M", nomeMae: "Mae Teste",
    procedimentoPrincipal: COD_QT, quantidadePrincipal: 1, cidPrincipal: "C16.1", finalidadeApac: "PALIATIVA", modalidade: "QT",
    nomeEstabelecimento: "Estabelecimento Teste", cnesSolicitante: "2605473", solicitanteNome: "Médico Teste", solicitanteCns: CNS_SOLIC,
    dataSolicitacao: "2026-09-10", justificativa: "Justificativa sintética", descricaoDiagnostico: "Adenocarcinoma gástrico",
    ...over,
  };
}

export function apac(id: string, over: Record<string, unknown> = {}, extra: { competencia?: string; dataGeracaoApp?: string } = {}): Apac {
  return Apac.parse({
    apacId: id, tumorLotId: "lot-1", prescricaoAssinadaRef: { documentId: "doc-1", documentVersion: 1 },
    dataGeracaoApp: extra.dataGeracaoApp ?? "2026-09-10", competencia: extra.competencia ?? "2026-09", campos: camposOk(over),
    estado: "RASCUNHO", resultadoExterno: null, versao: 1, substituiApacId: null,
  });
}
