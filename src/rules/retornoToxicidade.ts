// W12-GROK-05 · cadeia do retorno: grau, plaquetas, E1 e alertas de suporte.
// PROVISORIO-W12: publicar EntradaRetornoToxicidade e ResultadoRetornoToxicidade quando o contrato abrir.
// Este módulo não importa outras regras. Limites e alertas já calculados entram por parâmetro.
// Alerta nunca bloqueia, nunca altera a fila e nunca define dose ou causalidade.

import type { ClasseMedicacao } from "../contracts/w10/prescricao.js";

export interface MedicamentoRetorno {
  nome: string;
  classe: ClasseMedicacao | null;
}

export interface EntradaRetornoToxicidade {
  pacienteId: string;
  grau: number | null;
  plaquetas: number | null;
  dataPlaquetas: string | null;
  horasDiarreia: number | null;
  vomito: boolean | null;
  medicamentos: readonly (string | MedicamentoRetorno)[] | null;
  dm2: boolean | null;
  tempDecimos: number | null;
}

export interface LimitesRetorno {
  rulesetId: string;
  rulesetVersao: string;
  grauCorta: number;
  grauE1: number;
  plqCorteExclusivo: number;
  plqAlertaExclusivo: number;
  plqG4Exclusivo: number;
}

export interface AchadoInjetado {
  codigo: string;
  texto: string;
}

export interface SuporteInjetado {
  alertas: readonly AchadoInjetado[];
  pendencias: readonly AchadoInjetado[];
}

export interface AlertaPlqInjetado {
  estado: "ALERTA" | "SEM_ALERTA" | "PENDENTE";
  motivo: string;
}

export interface AlertaRetorno {
  codigo: string;
  texto: string;
  bloqueiaSalvar: false;
  alteraFila: false;
  defineDose: false;
  defineCausalidade: false;
}

export interface AchadoRetorno {
  codigo: string;
  texto: string;
}

export interface ResultadoRetornoToxicidade {
  pacienteId: string;
  destino: "FILA_MEDICO" | "SEM_FILA";
  motivos: AchadoRetorno[];
  alertas: AlertaRetorno[];
  pendencias: AchadoRetorno[];
  bloqueiaSalvar: false;
  confirmadoPeloMedico: false;
  sugestao: true;
}

type Bruto = Record<string, unknown>;

function objeto(valor: unknown, caminho: string): Bruto {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) throw new Error(`${caminho} ausente`);
  return valor as Bruto;
}

function texto(valor: unknown, caminho: string): string {
  if (typeof valor !== "string" || valor.trim().length === 0) throw new Error(`${caminho} ausente`);
  return valor.trim();
}

function inteiro(valor: unknown, caminho: string): number {
  if (typeof valor !== "number" || !Number.isInteger(valor)) throw new Error(`${caminho} inválido`);
  return valor;
}

function porCodigo(a: { codigo: string }, b: { codigo: string }): number {
  return a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0;
}

/** Lê corte do salão, alerta de plaquetas e faixa G4 do corpus injetado. Nenhum número clínico fica no código. */
export function lerLimitesRetorno(triagemJson: unknown, labJson: unknown, ctcaeJson: unknown): LimitesRetorno {
  const triagem = objeto(triagemJson, "triagem");
  const header = objeto(triagem.header, "header");
  const cortes = objeto(triagem.cortes, "cortes");

  const lab = objeto(labJson, "lab-thresholds");
  if (!Array.isArray(lab.analitos)) throw new Error("analitos ausente");
  const plqLab = lab.analitos.map((a) => objeto(a, "analito")).find((a) => a.codigo === "PLQ");
  if (plqLab === undefined) throw new Error("PLQ ausente");
  const alerta = objeto(plqLab.alertaClinico, "PLQ.alertaClinico");

  const ctcae = objeto(ctcaeJson, "ctcae");
  const graus = objeto(ctcae.graus, "graus");
  const termos = objeto(graus.termos, "termos");
  const plq = objeto(termos.plaquetas, "plaquetas");
  if (!Array.isArray(plq.faixas)) throw new Error("plaquetas.faixas ausente");
  const g4 = plq.faixas.map((f) => objeto(f, "faixa")).find((f) => f.grau === 4);
  if (g4 === undefined) throw new Error("plaquetas G4 ausente");

  return {
    rulesetId: texto(header.id, "header.id"),
    rulesetVersao: texto(header.versao, "header.versao"),
    grauCorta: inteiro(cortes.grauCtcaeCorta, "grauCtcaeCorta"),
    grauE1: inteiro(cortes.grauCtcaeEmergencia, "grauCtcaeEmergencia"),
    plqCorteExclusivo: inteiro(cortes.plqMin, "plqMin"),
    plqAlertaExclusivo: inteiro(alerta.limiarExclusivo, "PLQ.alertaClinico.limiarExclusivo"),
    plqG4Exclusivo: inteiro(g4.maxExclusivo, "plaquetas.G4.maxExclusivo"),
  };
}

function alertaDe(codigo: string, corpo: string): AlertaRetorno {
  return {
    codigo,
    texto: corpo,
    bloqueiaSalvar: false,
    alteraFila: false,
    defineDose: false,
    defineCausalidade: false,
  };
}

/**
 * Monta destino e motivos só a partir dos cortes. E1 e o alerta de plaquetas < limiar ficam em alertas.
 * Pendência vai para FILA_MEDICO. Sem motivo e sem pendência o destino é SEM_FILA, que não é liberação.
 */
export function montarRetornoToxicidade(
  entrada: EntradaRetornoToxicidade,
  limites: LimitesRetorno,
  suporte: SuporteInjetado,
  alertaPlq: AlertaPlqInjetado,
): ResultadoRetornoToxicidade {
  const motivos: AchadoRetorno[] = [];
  const pendencias: AchadoRetorno[] = [];
  const alertas: AlertaRetorno[] = [];

  if (entrada.grau === null || !Number.isFinite(entrada.grau)) {
    pendencias.push({ codigo: "pendente.grau", texto: "grau ausente; não vira 0 nem corte" });
  } else if (entrada.grau >= limites.grauCorta) {
    motivos.push({ codigo: "corte.grau", texto: "grau informado no corte do salão" });
  }

  if (entrada.plaquetas === null || !Number.isFinite(entrada.plaquetas)) {
    pendencias.push({ codigo: "pendente.plaquetas", texto: "plaquetas ausentes; corte não inventado" });
  } else if (entrada.plaquetas < limites.plqCorteExclusivo) {
    motivos.push({ codigo: "corte.plq.baixa", texto: "plaquetas abaixo do corte do salão" });
  }

  const grauE1 = entrada.grau !== null && Number.isFinite(entrada.grau) && entrada.grau >= limites.grauE1;
  const plqE1 = entrada.plaquetas !== null && Number.isFinite(entrada.plaquetas) && entrada.plaquetas < limites.plqG4Exclusivo;
  if (grauE1 || plqE1) alertas.push(alertaDe("alerta.e1", "alerta E1"));

  if (entrada.plaquetas !== null && alertaPlq.estado === "ALERTA") {
    alertas.push(alertaDe("alerta.plq", alertaPlq.motivo));
  } else if (entrada.plaquetas !== null && alertaPlq.estado === "PENDENTE") {
    pendencias.push({ codigo: "pendente.plaquetas.alerta", texto: alertaPlq.motivo });
  }

  for (const item of suporte.alertas) alertas.push(alertaDe(item.codigo, item.texto));
  for (const item of suporte.pendencias) pendencias.push({ codigo: item.codigo, texto: item.texto });

  motivos.sort(porCodigo);
  alertas.sort(porCodigo);
  pendencias.sort(porCodigo);

  return {
    pacienteId: entrada.pacienteId,
    destino: motivos.length > 0 || pendencias.length > 0 ? "FILA_MEDICO" : "SEM_FILA",
    motivos,
    alertas,
    pendencias,
    bloqueiaSalvar: false,
    confirmadoPeloMedico: false,
    sugestao: true,
  };
}
