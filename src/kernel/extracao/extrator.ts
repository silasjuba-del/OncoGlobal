import type { ClinicalFact, EncounterSegment, FactDomain, FactEvidence } from "./tipos.js";
import {
  DICIONARIO_FARMACO, normalizarFarmaco, normalizarLateralidade, normalizarSitioAnatomico,
} from "./normalizacao.js";
import { farmacosMencionados } from "./reconciliacao.js";

const aliasesFarmacos = Object.keys(DICIONARIO_FARMACO)
  .sort((a, b) => b.length - a.length)
  .map((nome) => nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"));
const padraoFarmacoPlaud = new RegExp(
  `\\b(${aliasesFarmacos.join("|")})\\b\\s+(\\d+(?:[.,]\\d+)?\\s*(?:mg|mcg|[µμ]g|g|mL|UI)(?:\\s*\\/\\s*(?:kg|m(?:2|²)))?(?:\\s*(?:\\/\\s*(?:dia|hora)|por\\s+(?:dia|hora|turno)|a\\s+cada\\s+\\d+(?:[.,]\\d+)?\\s*(?:h|horas?|dias?|semanas?)|semanal(?:mente)?|diariamente))?)`,
  "iu",
);

function chaveFarmaco(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR").trim().replace(/\s+/g, " ");
}

const CARACTERES_INVISIVEIS = /[­​-‍⁠﻿]/gu;
const LETRA_NAO_LATINA = /[\p{Script=Cyrillic}\p{Script=Greek}]/u;
const LETRA_LATINA = /\p{Script=Latin}/u;
/** Homóglifos cirílicos/gregos que se parecem com letras latinas (apenas para casar o dicionário). */
const HOMOGLIFOS_PARA_LATINO: Readonly<Record<string, string>> = {
  "а": "a", "с": "c", "е": "e", "о": "o", "р": "p", "х": "x",
  "у": "y", "і": "i", "ј": "j", "ѕ": "s",
  "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M", "Н": "H",
  "О": "O", "Р": "P", "С": "C", "Т": "T", "Х": "X", "У": "Y",
  "Α": "A", "Β": "B", "Ε": "E", "Ζ": "Z", "Η": "H", "Ι": "I",
  "Κ": "K", "Μ": "M", "Ν": "N", "Ο": "O", "Ρ": "P", "Τ": "T",
  "Υ": "Y", "Χ": "X", "ο": "o", "ι": "i",
};

export interface DeteccaoFarmaco {
  /** Texto como veio da fonte; nunca reescrito. */
  readonly raw: string;
  /** NFKC sem caracteres de largura zero. */
  readonly normalized: string;
  /** true quando a grafia é anômala (zero-width, alfabeto misto ou não latino): exige confirmação. */
  readonly incerto: boolean;
  /** Canônico do dicionário local, apenas como SUGESTÃO pendente; nunca substitui o raw. */
  readonly sugestao: string;
  readonly motivo: string;
}

/**
 * Detector de fármaco com grafia suspeita (homóglifo, zero-width, alfabeto misto).
 * Só analisa tokens anômalos: texto latino comum não é avaliado (retorna null). Um token
 * anômalo que se parece com fármaco do dicionário local devolve incerto = true.
 */
export function detectarFarmaco(valor: string): DeteccaoFarmaco | null {
  const semInvisiveis = valor.replace(CARACTERES_INVISIVEIS, "");
  const normalized = semInvisiveis.normalize("NFKC").trim();
  if (!normalized) return null;
  const motivos: string[] = [];
  if (semInvisiveis.length !== valor.length) motivos.push("caractere de largura zero removido");
  const naoLatina = LETRA_NAO_LATINA.test(normalized);
  if (naoLatina && LETRA_LATINA.test(normalized)) motivos.push("alfabetos misturados (latino + cirílico/grego)");
  else if (naoLatina) motivos.push("letras cirílicas/gregas no lugar de latinas");
  if (!motivos.length) return null;
  const esqueleto = [...normalized].map((c) => HOMOGLIFOS_PARA_LATINO[c] ?? c).join("");
  const sugestao = normalizarFarmaco(chaveFarmaco(esqueleto)).normalizado;
  if (!sugestao) return null;
  return { raw: valor, normalized, incerto: true, sugestao, motivo: motivos.join("; ") };
}

const MARCADOR_RASURA = /\[\/?RISCADO\]/giu;
function trechosNaoRiscados(linha: string, aberto: boolean): { trechos: string[]; aberto: boolean } {
  const trechos: string[] = [];
  let emRasura = aberto;
  let cursor = 0;
  MARCADOR_RASURA.lastIndex = 0;
  for (const marcador of linha.matchAll(MARCADOR_RASURA)) {
    const token = marcador[0] ?? "";
    const inicio = marcador.index ?? 0;
    const fim = inicio + token.length;
    const fechamento = /^\[\//u.test(token);
    if (fechamento) {
      if (emRasura) {
        emRasura = false;
        cursor = fim;
      } else {
        if (inicio > cursor) trechos.push(linha.slice(cursor, inicio));
        cursor = fim;
      }
    } else {
      if (!emRasura && inicio > cursor) trechos.push(linha.slice(cursor, inicio));
      emRasura = true;
      cursor = fim;
    }
  }
  if (!emRasura && cursor < linha.length) trechos.push(linha.slice(cursor));
  return { trechos: trechos.filter((trecho) => trecho.trim()), aberto: emRasura };
}

const NEGACAO_CLAUSULA = /\b(?:não há|não observamos|nega|negou|negativo para|sem\s+(?:sinais de|evidência(?: de)?|les(?:ão|ões)|nódul(?:o|os)|foc(?:o|os)|neoplasia|carcinoma|adenocarcinoma|tumor|metástase|expressão|amplificação|HER2|RE|RP|Ki-67|PD-L1))(?:\s|$)/iu;

/**
 * Comparação seriada declarada pela própria fonte (ex.: "aumentado em relação à CO de 14/05/28").
 * Aumento/redução só entram quando o texto os afirma; nada é deduzido de medidas ausentes.
 */
function comparacaoDeclarada(raw: string): { tipo: "AUMENTO" | "REDUCAO" | "ESTAVEL"; refData: string | null } | null {
  const match = raw.match(
    /\b(aument\w*|reduz\w*|diminu\w*|est[áa]vel|inalterad\w*)\b[^.;]*?(?:\bde\s+)?(\d{2}\/\d{2}\/\d{2,4})/iu,
  );
  if (!match) return null;
  const termo = match[1] ?? "";
  const tipo = /^aument/iu.test(termo) ? "AUMENTO" as const
    : /^(reduz|diminu)/iu.test(termo) ? "REDUCAO" as const : "ESTAVEL" as const;
  return { tipo, refData: match[2] ?? null };
}

export interface Extrator {
  extrair(segmento: EncounterSegment): readonly ClinicalFact[];
}

/** Dublê determinístico para textos sintéticos, não LLM, não emite ordens clínicas. */
export const extratorDeterministico: Extrator = {
  extrair(segmento) {
    const result: ClinicalFact[] = [];
    const lines = segmento.rawTranscript.split(/\r?\n/);
    let rasuraAberta = false;
    for (const [lineIndex, line] of lines.entries()) {
      const rawLinha = line.trim();
      if (!rawLinha) continue;
      const visiveis = trechosNaoRiscados(rawLinha, rasuraAberta);
      rasuraAberta = visiveis.aberto;
      const datasLinha = visiveis.trechos.flatMap((trecho) =>
        [...trecho.matchAll(/\b\d{2}\/\d{2}\/\d{2,4}\b/giu)].map((m) => m[0]));
      const referenciasNaLinha = visiveis.trechos.flatMap((trecho) => trecho.split(";"))
        .map((clausula) => comparacaoDeclarada(clausula.trim())?.refData)
        .filter((data): data is string => data !== null && data !== undefined);
      const dataUnicaNaLinha = datasLinha.length === 1 && !referenciasNaLinha.includes(datasLinha[0]!)
        ? datasLinha[0] : null;
      for (const trecho of visiveis.trechos) {
      // Uma nova afirmação explícita encerra a negação anterior; uma simples
      // lista ("nega dor, náusea") continua sob a mesma negação.
      const clausulas = trecho.split(/;|,\s*(?=(?:mas\s+)?(?:relata|refere|apresenta|informa)\b)/iu);
      for (const clausula of clausulas) {
      const raw = clausula.trim();
      if (!raw) continue;
      const datasNaClausula = [...raw.matchAll(/\b\d{2}\/\d{2}\/\d{2,4}\b/giu)].map((m) => m[0]);
      const refData = comparacaoDeclarada(raw)?.refData;
      const datasNaoReferenciais = datasNaClausula.filter((data) => data !== refData);
      const dataLiteral = datasNaClausula.length > 0
        ? datasNaoReferenciais.length === 1 ? datasNaoReferenciais[0] : null
        : dataUnicaNaLinha && dataUnicaNaLinha !== refData ? dataUnicaNaLinha : null;
      // Negação vale apenas para esta cláusula; o restante da linha continua analisável.
      const negated = NEGACAO_CLAUSULA.test(raw);
      const wordingUncertain = /\b(?:não se pode excluir|sugestiv[oa]s?|compat[ií]ve(?:l|is)(?:\s+com)?|prov[aá]vel(?:mente)?)\b/iu.test(raw);
      const add = (domain: FactDomain, value: unknown, evidence: FactEvidence = "EXPLICIT",
        confirmation = false, regra?: string): void => {
        const evidenceFinal: FactEvidence = evidence === "EXPLICIT" && wordingUncertain ? "UNCERTAIN" : evidence;
        const spokenNumber = segmento.sourceType === "plaud" &&
          /\b\d+(?:[.,]\d+)?\b|\b(?:quatorze|quinze|dez|vinte|trinta)\b/iu.test(raw);
        result.push({
          id: `${segmento.id}:f${lineIndex}:${result.length}`,
          segmentId: segmento.id,
          patientCandidateId: null,
          domain, value, sourceType: segmento.sourceType,
          evidence: evidenceFinal, sourceId: segmento.sourceId, rawEvidence: rawLinha,
          ...(segmento.page === undefined ? {} : { page: segmento.page }),
          ...(segmento.startMs === null ? {} : { timestampMs: segmento.startMs }),
          ...(dataLiteral ? { date: dataLiteral } : {}),
          confidence: spokenNumber ? 0.6 : evidenceFinal === "UNCERTAIN" ? 0.5 : 1,
          requiresConfirmation: confirmation || spokenNumber || evidenceFinal === "UNCERTAIN",
          ...(regra ? { regra } : {}),
        });
      };

      // Somente rótulos literais ou termos diagnósticos de fonte documental; ausência = nada.
      if (!negated && segmento.sourceType === "pathology") {
        const hist = raw.match(/\b(?:histologia|diagnóstico histológico)\s*:\s*([^.;]+)/iu);
        if (hist) add("histology", hist[1]?.trim());
      }
      const diagnosis = raw.match(/^\s*diagnóstico(?: oncológico)?\s*:\s*([^.;]+)/iu);
      if (diagnosis && !negated && !/\bNÃO SEI\b/iu.test(raw)) {
        add("diagnosis", diagnosis[1]?.trim());
      }
      // Menção literal de neoplasia/carcinoma (ex.: "antecedente de neoplasia mamária direita"):
      // o sítio só entra quando a tabela de órgãos o reconhece; nada é inferido de "dona Maria".
      if (!negated && !/^\s*diagn[oó]stico/iu.test(raw)) {
        const mencao = raw.match(/\b(?:neoplasia|carcinoma|adenocarcinoma)\s+(?:de\s+|do\s+|da\s+)?([\p{L}]+(?:\s+(?:uterino|do\s+ú?tero))?)/iu);
        const sitioCanonico = mencao ? normalizarSitioAnatomico(mencao[1]) : null;
        if (mencao && sitioCanonico) {
          const lateralityRaw = raw.match(/\b(?:à esquerda|esquerda|à direita|direita)\b/iu)?.[0] ?? null;
          add("diagnosis", {
            sitioCanonico,
            lateralidade: normalizarLateralidade(lateralityRaw, sitioCanonico),
            raw: mencao[0],
          });
        }
      }
      const tnm = raw.match(
        /\b(?:yp|[cp])T[0-4X](?:[a-d])?\s+(?:yp|[cp])N[0-3X](?:[a-d])?\s+(?:yp|[cp])M[0-1X](?:[a-d])?\b/iu,
      ) ?? raw.match(/\b(?:yp|[cp])T[0-4X](?:[a-d])?N[0-3X](?:[a-d])?M[0-1X](?:[a-d])?\b/iu);
      if (tnm && !negated && !/\bNÃO SEI\b/iu.test(raw)) add("stage", tnm[0]);
      else {
        const componenteN = raw.match(/\b[cp]N[0-3X](?:[a-d])?\b/iu);
        if (componenteN && !negated && !/\bNÃO SEI\b/iu.test(raw)) {
          add("stage", componenteN[0], "UNCERTAIN", true);
        }
      }

      for (const marker of ["HER2", "RE", "RP", "Ki-67", "PD-L1"] as const) {
        const pattern = marker === "HER2"
          ? /\bHER2\s*[:=]?\s*(0|1\+|2\+|3\+)(?=$|[\s,;.)])/iu
          : marker === "PD-L1"
            ? /\bPD-L1\s*(?:TPS|CPS)\s*[:=]?\s*(\d+(?:[.,]\d+)?%?)(?=$|[\s,;.)])/iu
            : new RegExp(`\\b${marker}\\s*[:=]?\\s*(\\d+(?:[.,]\\d+)?\\s*%)(?=$|[\\s,;.)])`, "iu");
        const match = raw.match(pattern);
        if (!match || negated || /\bNÃO SEI\b/iu.test(raw)) continue;
        const method = /\bIHQ\b/iu.test(raw) ? "IHQ" : null;
        const antibody = marker === "PD-L1"
          ? raw.match(/\b(?:22C3|28-8|SP142|SP263)\b/iu)?.[0] ?? null : null;
        const incomplete = marker === "PD-L1" && !antibody;
        add("biomarker", { marker, raw: match[0], method, antibody, value: match[1] },
          incomplete ? "UNCERTAIN" : "EXPLICIT", incomplete);
      }

      // Valores literais com unidade. Cada ocorrência é extraída; a negação é avaliada
      // na cláusula delimitada por ponto e vírgula para não apagar um resultado seguinte.
      const labs = /\b(Hb|hemoglobina|creatinina|PSA|CEA|plaquetas)\s*[:=]?\s*(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)\s*(g\/dL|g\/L|mg\/dL|ng\/mL|U\/mL|µmol\/L|μmol\/L|\/mm(?:3|³)|mm(?:3|³))(?=$|[\s,;.)])/giu;
      for (const lab of raw.matchAll(labs)) {
        if (negated) continue;
        const numeroAmbiguo = /^\d{1,3}\.\d{3}$/.test(lab[2] ?? "") &&
          !/^plaquetas?$/iu.test((lab[1] ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, ""));
        add("lab", {
          marker: lab[1], value: numeroAmbiguo ? null : lab[2], unit: lab[3],
          ...(numeroAmbiguo ? { raw: `${lab[2]} ${lab[3]}` } : {}),
        }, numeroAmbiguo ? "UNCERTAIN" : "EXPLICIT", numeroAmbiguo);
      }
      if (segmento.sourceType === "plaud" &&
          /\b(?:creatinina|hemoglobina|PSA|CEA)\s+(?:quatorze|quinze|vinte)\b/iu.test(raw)) {
        add("lab", { raw, value: null, unit: null }, "UNCERTAIN", true);
      }

      if (!negated && /\b(?:dormência|formigamento|náusea|dor)\b/iu.test(raw)) {
        add("symptom", raw);
      }
      // Plaud: reconhecimento lexical de fármaco conhecido + dose/frequência literal.
      // É sempre candidato UNCERTAIN; o parser não julga plausibilidade nem define conduta.
      const farmacoFalado = segmento.sourceType === "plaud" ? raw.match(padraoFarmacoPlaud) : null;
      if (farmacoFalado && !negated) {
        const alias = Object.keys(DICIONARIO_FARMACO)
          .find((nome) => chaveFarmaco(nome) === chaveFarmaco(farmacoFalado[1] ?? ""));
        const normalizado = alias ? DICIONARIO_FARMACO[alias] ?? null : null;
        add("drug", {
          raw: farmacoFalado[0], normalizado, doseRaw: farmacoFalado[2] ?? null,
        }, "UNCERTAIN", true);
      }
      const imaging = raw.match(/\b(?:lesão|nódulo|foco)\s+(?:em|no|na|de)?\s*([\p{L}0-9]+)[^.;]*?\b(\d+(?:[.,]\d+)?)\s*(mm|cm)\b/iu);
      if (imaging && !negated) {
        add("imaging", {
          siteRaw: imaging[1], measureRaw: imaging[2], unit: imaging[3],
          lateralityRaw: raw.match(/\b(?:à esquerda|esquerda|à direita|direita)\b/iu)?.[0] ?? null,
          comparacao: comparacaoDeclarada(raw),
        });
      } else if (segmento.sourceType === "imaging_report" && !negated &&
                 /\b(?:foco|lesão|nódulo)\b/iu.test(raw) && /\bL\d{1,2}\b/iu.test(raw)) {
        // Achado textual (não metástase): preserva trecho e sítio sem inventar medida.
        add("imaging", {
          siteRaw: raw.match(/\bL\d{1,2}\b/iu)?.[0], measureRaw: null, unit: null,
          lateralityRaw: raw.match(/\b(?:à esquerda|esquerda|à direita|direita)\b/iu)?.[0] ?? null,
          comparacao: comparacaoDeclarada(raw),
        });
      }
      if (segmento.sourceType === "prescription" && !negated) {
        const drug = raw.match(/\b(carboplatina|cisplatina|paclitaxel|docetaxel|oxaliplatina)\b/iu);
        if (drug) add("drug", drug[0]);
        // A regex latina não vê "сisplatina" (cirílico) nem "cis\u200Bplatina".
        // Procurar também quando há outro fármaco limpo na mesma linha.
        // Apenas um candidato de dicionário com sinal explícito de adulteração
        // entra aqui; o literal permanece na fonte e exige revisão médica.
        for (const token of raw.matchAll(/[\p{L}\p{M}\p{Cf}\u180e]+/gu)) {
          const candidato = normalizarFarmaco(token[0]);
          if (candidato.suspeito && candidato.normalizado) {
            add("drug", token[0], "UNCERTAIN", true);
          }
        }
        const cycle = raw.match(/\bciclo\s*(\d+)\b/iu);
        if (cycle) add("cycle", cycle[1]);
        const regimen = raw.match(/\b(?:protocolo|esquema)\s*:\s*([^.;]+)/iu);
        if (regimen) add("regimen", regimen[1]?.trim());
      }
      // Graduação histológica de próstata (Gleason/ISUP): literal da fonte, sem inferência.
      // Negação vale por cláusula, como nos demais biomarcadores.
      if (!negated) {
        const gleason = raw.match(/\bGleason\s*:?\s*(\d\s*\+\s*\d|\d)(?=$|[\s,;.)])/iu);
        if (gleason) add("biomarker", { marker: "Gleason", value: (gleason[1] ?? "").replace(/\s+/g, ""), raw: gleason[0] });
        const isup = raw.match(/\bISUP\s*:?\s*([1-5])(?=$|[\s,;.)])/iu);
        if (isup) add("biomarker", { marker: "ISUP", value: isup[1], raw: isup[0] });
      }
      const plan = raw.match(/^\s*(?:plano|conduta verbalizada)\s*:\s*(.+)/iu);
      if (plan) add("plan", plan[1]?.trim());
      else if (segmento.sourceType === "plaud" || segmento.sourceType === "medical_note") {
        // Apenas intenção futura literal na cláusula atual: o histórico depois
        // de vírgula ("corrigi da outra vez...") permanece na fonte, não no plano.
        const clausulaAtual = raw.split(/[,;]/u)[0]?.trim() ?? "";
        const historico = /\b(?:anteriormente|antigamente|da outra vez|no ciclo anterior)\b/iu;
        const futuro = /\b(?:vai|vou|vamos|iremos)\s+(?:fazer|receber|usar|iniciar)\b/iu;
        if (futuro.test(clausulaAtual) && !historico.test(clausulaAtual)
          && farmacosMencionados(clausulaAtual).length > 0) {
          add("plan", clausulaAtual, "UNCERTAIN", true);
        }
      }
      }
      }
    }
    return result;
  },
};
