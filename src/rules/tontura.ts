import type { EntradaVertigem } from "../contracts/w12/regrasClinicas.js";
export type { EntradaVertigem } from "../contracts/w12/regrasClinicas.js";
// D-W9-76 · tontura não é critério. A exceção é vertigem subjetiva de início novo, sem histórico anterior.
// Histórico e início novo são dados distintos. O texto do alerta sai do corpus.
// Alerta nunca bloqueia. Histórico ausente não vira "novo".
export interface AchadoVertigem {
  codigo: string;
  texto: string;
}

export interface AlertaVertigem extends AchadoVertigem {
  bloqueiaSalvar: false;
}

export interface ResultadoVertigem {
  estado: "ALERTA" | "PENDENTE" | "SEM_ALERTA";
  classificacao: "NOVO" | "REGISTRO" | "PENDENTE";
  alertas: AlertaVertigem[];
  pendencias: AchadoVertigem[];
  bloqueiaSalvar: false;
  confirmadoPeloMedico: false;
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

/** Lê a frase do alerta no ruleset injetado. A frase não fica neste arquivo. */
export function lerAlertaVertigem(json: unknown): string {
  const raiz = objeto(json, "triagem");
  const bloco = objeto(raiz.vertigem, "vertigem");
  if (bloco.bloqueiaSalvar !== false) throw new Error("vertigem.bloqueiaSalvar inválido");
  return texto(bloco.alertaSnc, "vertigem.alertaSnc");
}

function pendente(codigo: string, corpo: string): AchadoVertigem {
  return { codigo, texto: corpo };
}

/**
 * Tontura isolada só registra. Alerta só quando o início é novo e o histórico anterior é falso.
 * Qualquer um dos dois ausente fica PENDENTE e a classificação não vira NOVO.
 */
export function alertarVertigemNova(entrada: EntradaVertigem, alertaSnc: string): ResultadoVertigem {
  const pendencias: AchadoVertigem[] = [];
  const alertas: AlertaVertigem[] = [];

  if (entrada.tontura === null) {
    pendencias.push(pendente("pendente.tontura", "tontura desconhecida; não vira ausência"));
  } else if (entrada.tontura === true) {
    if (entrada.inicioNovo === null) {
      pendencias.push(pendente("pendente.inicio", "início da vertigem ausente; não vira novo"));
    }
    if (entrada.historicoAnterior === null) {
      pendencias.push(pendente("pendente.historico", "histórico de vertigem ausente; não vira novo"));
    }
    if (entrada.inicioNovo === true && entrada.historicoAnterior === false) {
      alertas.push({ codigo: "alerta.vertigem.snc", texto: alertaSnc, bloqueiaSalvar: false });
    }
  }

  const classificacao = pendencias.length > 0 ? "PENDENTE" : alertas.length > 0 ? "NOVO" : "REGISTRO";
  const estado = alertas.length > 0 ? "ALERTA" : pendencias.length > 0 ? "PENDENTE" : "SEM_ALERTA";
  return {
    estado,
    classificacao,
    alertas,
    pendencias,
    bloqueiaSalvar: false,
    confirmadoPeloMedico: false,
  };
}
