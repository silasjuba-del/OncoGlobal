import {
  ConteudoPrescricaoExecutavel,
  type ConteudoPrescricaoExecutavel as Conteudo,
  type ItemPrescricaoExecutavel,
} from "../../contracts/api/prescricaoExecutavel.js";

export interface AvaliacaoDocumentoExecutavel {
  /** Structural/operational formatting gate only; true is not medical approval. */
  ok: boolean;
  pendencias: string[];
  avisos: string[];
  conteudo: Conteudo | null;
  texto: string | null;
}

const numeroPtBr = (value: number): string => String(value).replace(".", ",");

type Decimal = { n: bigint; e: number };
/** Aritmética dimensional decimal; não é teto clínico nem arredondamento de dose. */
function decimal(value: number | string): Decimal {
  const [mantissa, expoente = "0"] = String(value).replace(",", ".").toLowerCase().split("e");
  const [inteiro, fracao = ""] = mantissa!.split(".");
  return { n: BigInt(`${inteiro}${fracao}`), e: Number(expoente) - fracao.length };
}
const produto = (a: Decimal, b: Decimal): Decimal => ({ n: a.n * b.n, e: a.e + b.e });
function maior(a: Decimal, b: Decimal): boolean {
  const escala = Math.min(a.e, b.e);
  return a.n * 10n ** BigInt(a.e - escala) > b.n * 10n ** BigInt(b.e - escala);
}
function doseDecimalMg(dose: number | null, unidade: string): Decimal | null {
  if (dose === null || !Number.isFinite(dose) || dose <= 0) return null;
  const u = unidade.trim().normalize("NFKC").toLowerCase();
  const ajuste = u === "mg" ? 0 : u === "g" ? 3 : ["mcg", "μg", "ug"].includes(u) ? -3 : null;
  if (ajuste === null) return null;
  const d = decimal(dose);
  return { n: d.n, e: d.e + ajuste };
}
function numeroRepresentavel(d: Decimal | null): number | null {
  if (!d) return null;
  const n = Number(`${d.n}e${d.e}`);
  return Number.isFinite(n) && n > 0 ? n : null;
}
/** Converte somente a unidade explícita, preservando a ordem e sem inferir dose. */
export function doseFinalEmMg(dose: number, unidade: string): number | null {
  return numeroRepresentavel(doseDecimalMg(dose, unidade));
}
function duracaoMinutos(texto: string | null): Decimal | null {
  const match = /^(\d+(?:[.,]\d+)?)\s*(min(?:utos?)?|h(?:oras?)?)$/iu.exec(texto?.trim() ?? "");
  if (!match) return null;
  const fator = /^h/iu.test(match[2]!) ? 60 : 1;
  const n = Number(match[1]!.replace(",", ".")) * fator;
  return Number.isFinite(n) && n > 0 ? produto(decimal(match[1]!), decimal(fator)) : null;
}

/** Recebe item validado; compara apenas os limites fornecidos, sem mudar campos. */
export function pendenciasLimitesDeclarados(prescrito: ItemPrescricaoExecutavel["item"]): string[] {
  const pendencias: string[] = [];
  const prefixo = `Item ${prescrito.sequence} · ${prescrito.drug}`;
  if (prescrito.doseMaximaMg !== undefined || prescrito.taxaMaximaMgMin !== undefined) {
    const dose = doseDecimalMg(prescrito.prescribedDose, prescrito.unit);
    const comparavel = numeroRepresentavel(dose) !== null;
    if (prescrito.doseMaximaMg !== undefined) {
      if (!dose || !comparavel)
        pendencias.push(`${prefixo}: dose/unidade não permite verificar o limite declarado em mg.`);
      else if (maior(dose, decimal(prescrito.doseMaximaMg)))
        pendencias.push(`${prefixo}: dose final excede a dose máxima declarada de ${numeroPtBr(prescrito.doseMaximaMg)} mg por administração.`);
    }
    if (prescrito.taxaMaximaMgMin !== undefined) {
      const minutos = duracaoMinutos(prescrito.infusionTime);
      if (!dose || !comparavel || !minutos)
        pendencias.push(`${prefixo}: taxa máxima declarada exige dose convertível em mg e duração positiva inequívoca em min ou h.`);
      else if (maior(dose, produto(decimal(prescrito.taxaMaximaMgMin), minutos)))
        pendencias.push(`${prefixo}: taxa de infusão excede a máxima declarada de ${numeroPtBr(prescrito.taxaMaximaMgMin)} mg/min.`);
    }
  }
  return pendencias;
}

function unidadePendente(unidade: string): boolean {
  const normalizada = unidade.normalize("NFKC").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/²/g, "2").replace(/\s+/g, "").toUpperCase();
  if (normalizada === "AUC") return true;
  return /(?:^|[^A-Z0-9])(?:MG|MCG|G)\/(?:M2|KG)(?:$|[^A-Z0-9])/.test(normalizada)
    || /^(?:MG|MCG|G)\/(?:M2|KG)$/.test(normalizada);
}

function dadosPreparo(item: ItemPrescricaoExecutavel, pendencias: string[], avisos: string[]): string[] {
  const { item: prescrito } = item;
  const prefixo = `Item ${prescrito.sequence} · ${prescrito.drug}`;
  if (prescrito.prescribedDose === null || !Number.isFinite(prescrito.prescribedDose) || prescrito.prescribedDose <= 0)
    pendencias.push(`${prefixo}: dose final prescrita ausente ou não positiva.`);
  if (!prescrito.unit.trim()) pendencias.push(`${prefixo}: unidade final ausente.`);
  else if (unidadePendente(prescrito.unit))
    pendencias.push(`${prefixo}: unidade ${prescrito.unit} ainda expressa denominador; falta dose final em unidade executável.`);
  if (!prescrito.route.trim()) pendencias.push(`${prefixo}: via ausente.`);
  if (prescrito.days.length === 0) pendencias.push(`${prefixo}: dias de administração ausentes.`);
  pendencias.push(...pendenciasLimitesDeclarados(prescrito));
  if (prescrito.adjustmentPercent !== null) {
    if (prescrito.calculatedDose === null || prescrito.prescribedDose === null) {
      pendencias.push(`${prefixo}: percentual declarado sem dose calculada de referência e dose final.`);
    } else {
      const esperada = prescrito.calculatedDose * ((100 + prescrito.adjustmentPercent) / 100);
      // Tolerância apenas do IEEE-754; não institui arredondamento de dose.
      const tolerancia = Number.EPSILON * Math.max(Math.abs(esperada), Math.abs(prescrito.prescribedDose)) * 8;
      if (!Number.isFinite(esperada) || Math.abs(prescrito.prescribedDose - esperada) > tolerancia)
        pendencias.push(`${prefixo}: dose final incompatível com o percentual sobre a dose calculada de referência.`);
    }
  }

  const faltantes: string[] = [];
  if (prescrito.diluent === null || !prescrito.diluent.trim()) {
    faltantes.push("diluente");
    avisos.push(`${prefixo}: diluente não informado; revisar preparo.`);
  }
  if (prescrito.finalVolumeMl === null) {
    faltantes.push("volume final");
    avisos.push(`${prefixo}: volume final não informado; revisar preparo.`);
  }
  if (prescrito.infusionTime === null || !prescrito.infusionTime.trim()) {
    faltantes.push("tempo de infusão");
    avisos.push(`${prefixo}: tempo de infusão não informado; revisar preparo.`);
  }
  if (prescrito.route.trim().toUpperCase() === "EV" && faltantes.length > 0)
    avisos.push(`${prefixo}: preparo EV com parâmetros incompletos; revisão obrigatória antes de preparar.`);

  if (prescrito.sequenciamentoPendente)
    pendencias.push(`${prefixo}: sequenciamento pendente — ${prescrito.sequenciamentoPendente}.`);
  if (prescrito.resgateMtx)
    pendencias.push(`${prefixo}: resgate condicional sem plano individual estruturado.`);

  const dose = prescrito.prescribedDose === null ? "não informada" : `${numeroPtBr(prescrito.prescribedDose)} ${prescrito.unit}`;
  const diluente = prescrito.diluent?.trim() || "não informado";
  const volume = prescrito.finalVolumeMl === null ? "não informado" : `${numeroPtBr(prescrito.finalVolumeMl)} mL`;
  const tempo = prescrito.infusionTime?.trim() || "não informado";
  const dias = prescrito.days.length > 0 ? prescrito.days.join(", ") : "não informados";
  const lines = [
    `Item ${prescrito.sequence} — ${prescrito.drug} (${prescrito.classe})`,
    `Dose final: ${dose}`,
    `Via: ${prescrito.route.trim() || "não informada"}`,
    `Diluente: ${diluente}`,
    `Volume final: ${volume}`,
    `Tempo de infusão: ${tempo}`,
    `Dias: ${dias}`,
    `Base de dose: ${prescrito.doseBasis}`,
    `Fonte do item: ${prescrito.source}`,
  ];
  if (prescrito.doseMaximaMg !== undefined)
    lines.push(`Dose máxima declarada por administração: ${numeroPtBr(prescrito.doseMaximaMg)} mg`);
  if (prescrito.taxaMaximaMgMin !== undefined)
    lines.push(`Taxa máxima declarada: ${numeroPtBr(prescrito.taxaMaximaMgMin)} mg/min`);
  if (prescrito.adjustmentPercent !== null)
    lines.push(`Ajuste explícito: ${Math.abs(prescrito.adjustmentPercent)}% sobre a dose calculada de referência ${prescrito.calculatedDose === null ? "não informada" : `${numeroPtBr(prescrito.calculatedDose)} ${prescrito.unit}`}`,
      `Motivo do ajuste: ${prescrito.adjustmentReason ?? "não informado"}`);
  if (prescrito.overrideMotivo) lines.push(`Motivo do override: ${prescrito.overrideMotivo}`);
  if (prescrito.observacao) lines.push(`Observação: ${prescrito.observacao}`);
  if (prescrito.sequenciamentoPendente) lines.push(`Sequenciamento: pendente — ${prescrito.sequenciamentoPendente}`);
  if (prescrito.resgateMtx) lines.push("Resgate condicional: plano individual pendente");
  return lines;
}

/**
 * Validates and renders only the supplied structured order. It never infers
 * missing administration parameters, proposes doses, signs, or persists.
 * Explicit units are converted only to check the limits supplied in the item.
 */
export function avaliarDocumentoExecutavel(entrada: unknown): AvaliacaoDocumentoExecutavel {
  const parsed = ConteudoPrescricaoExecutavel.safeParse(entrada);
  if (!parsed.success) {
    return {
      ok: false,
      pendencias: ["Conteúdo estruturado inválido; revisar campos obrigatórios, itens, sequência e versão."],
      avisos: [],
      conteudo: null,
      texto: null,
    };
  }

  const conteudo = parsed.data;
  const pendencias: string[] = [];
  const avisos: string[] = [];
  const itens = [...conteudo.itens].sort((a, b) => a.item.sequence - b.item.sequence);
  const linhas = [
    "PRESCRIÇÃO ONCOLÓGICA — QT",
    `Paciente: ${conteudo.pacienteNome ?? conteudo.contexto.patientId}`,
    `Versão ${conteudo.documentVersion}${conteudo.linha ? ` · Linha ${conteudo.linha}` : ""}${conteudo.numeroCiclo ? ` · Ciclo ${conteudo.numeroCiclo}` : ""}`,
    `Protocolo: ${conteudo.protocoloId}`,
    `Data prevista: ${conteudo.dataPrevista}`,
    `Motivo informado: ${conteudo.motivo}`,
    "",
    ...itens.flatMap((item, index) => [
      ...(index > 0 ? [""] : []),
      ...dadosPreparo(item, pendencias, avisos),
    ]),
  ];
  if (avisos.length) linhas.push("", "AVISOS PARA REVISÃO", ...avisos.map(aviso => `- ${aviso}`));
  if (pendencias.length) linhas.push("", "PENDÊNCIAS — NÃO EXECUTAR", ...pendencias.map(pendencia => `- ${pendencia}`));
  linhas.push("", "Conteúdo estruturado para revisão médica. Este documento não comprova preparo, dispensação ou administração.");

  return {
    ok: pendencias.length === 0,
    pendencias,
    avisos,
    conteudo,
    texto: linhas.join("\n"),
  };
}
