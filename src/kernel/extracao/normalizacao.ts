// FUGU-06 · Normalização (D-W9-33 §4; D-W5-01; D-W9-05; D-W9-07).
// Regras puras: sem I/O, sem relógio, sem aleatoriedade. Nada é inventado:
// o que não normaliza preserva `raw` e fica PENDENTE (nunca vira valor canônico).
import type { ClinicalFact } from "./tipos.js";
import { ALIAS_ORGAO, LATERALIDADE_POR_ORGAO, LATERALIDADE_SINONIMOS } from "../harness/gates-tabelas.js";

/** D-W5-01 · fuso do serviço. Só a data civil entra na linha do tempo. */
export const OFFSET_SERVICO = "-03:00";

// ── Unidades ─────────────────────────────────────────────────────────────────
/** Unidades canônicas aceitas pela normalização de laboratório. */
export const UNIDADES_CANONICAS = ["mg/dL", "g/dL", "mm³", "×10³/µL", "°C"] as const;
export type UnidadeCanonica = (typeof UNIDADES_CANONICAS)[number];

const ALIAS_UNIDADE: Readonly<Record<string, UnidadeCanonica>> = {
  "mg/dl": "mg/dL", "g/dl": "g/dL", "mm3": "mm³", "mm³": "mm³",
  "mm^3": "mm³", "/mm3": "mm³",
  "x10³/µl": "×10³/µL", "×10³/µl": "×10³/µL", "10³/µl": "×10³/µL", "10^3/ul": "×10³/µL",
  "mil/mm3": "×10³/µL", "mil/mm³": "×10³/µL", "x10^3/ul": "×10³/µL",
  "c": "°C", "°c": "°C", "ºc": "°C",
};

/** Unidade em forma canônica; null quando o texto não é reconhecido (PENDENTE, não adivinha). */
export function normalizarUnidade(unidade: string | null | undefined): UnidadeCanonica | null {
  if (typeof unidade !== "string") return null;
  const chave = unidade.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, "");
  if (chave === "/mm³") return "mm³";
  return ALIAS_UNIDADE[chave] ?? null;
}

export interface LabNormalizado {
  marker: string;
  /** Decimal em unidade canônica; null quando o número falado é ambíguo. */
  value: number | null;
  /** Unidade canônica; null quando não reconhecida (nunca inventa). */
  unit: UnidadeCanonica | null;
  /** Texto original do valor/unidade; sempre preservado. */
  raw: string | null;
  /** false ⇒ a reconciliação trata o campo como PENDENTE. */
  normalizado: boolean;
}

function numeroDecimal(bruto: unknown): number | null {
  if (typeof bruto === "number") return Number.isFinite(bruto) ? bruto : null;
  if (typeof bruto !== "string") return null;
  const limpo = bruto.trim().replace(",", ".");
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(limpo)) return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

/** Normaliza um valor de laboratório preservando o texto de origem. */
export function normalizarLab(valor: {
  marker?: unknown; value?: unknown; unit?: unknown; raw?: unknown;
}): LabNormalizado {
  const marker = typeof valor.marker === "string" ? valor.marker.trim() : "";
  const unidade = normalizarUnidade(typeof valor.unit === "string" ? valor.unit : null);
  // Ponto como separador de milhar só é inequívoco aqui para contagem de plaquetas.
  // Mantemos a regra restrita ao marcador e preservamos o literal original em `raw`.
  const plaquetas = /^plaquetas?$/iu.test(marker.normalize("NFD").replace(/\p{Diacritic}/gu, ""));
  const numero = plaquetas && typeof valor.value === "string" && /^\d{1,3}(?:\.\d{3})+$/.test(valor.value.trim())
    ? numeroDecimal(valor.value.replace(/\./g, ""))
    : numeroDecimal(valor.value);
  const raw = typeof valor.raw === "string" ? valor.raw
    : (numero === null ? null : `${String(valor.value)} ${String(valor.unit ?? "")}`.trim());
  const normalizado = unidade !== null && numero !== null;
  return { marker, value: normalizado ? numero : null, unit: unidade, raw, normalizado };
}

/** Temperatura em décimos (K-10: inteiro na borda). "38,2 °C" ⇒ { celsius: 38.2, tempDecimos: 382 }. */
export function normalizarTemperatura(texto: string): { celsius: number; tempDecimos: number } | null {
  const match = /(\d{2})\s*[,.]\s*(\d)\s*(?:°|º)?\s*c\b/iu.exec(texto);
  if (!match) return null;
  const celsius = Number(`${match[1]}.${match[2]}`);
  if (!Number.isFinite(celsius) || celsius < 25 || celsius > 45) return null;
  return { celsius, tempDecimos: Math.round(celsius * 10) };
}

/** D-W9-38 · febre é estritamente > 37,8 °C (37,8 não dispara). */
export function ehFebre(celsius: number | null): boolean {
  return typeof celsius === "number" && Number.isFinite(celsius) && celsius > 37.8;
}

// ── Data civil ───────────────────────────────────────────────────────────────
/** dd/mm/aaaa → aaaa-mm-dd. Ano de 2 dígitos usa o corte 70 (≥70 ⇒ 19xx, senão 20xx). */
export function normalizarDataCivil(texto: string | null | undefined): string | null {
  if (typeof texto !== "string") return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto.trim());
  if (iso) return validarCivil(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const br = /^(\d{1,2})[/.](\d{1,2})[/.](\d{2}|\d{4})$/.exec(texto.trim());
  if (!br) return null;
  const dia = Number(br[1]);
  const mes = Number(br[2]);
  const anoBruto = Number(br[3]);
  const ano = String(br[3]).length === 2 ? (anoBruto >= 70 ? 1900 + anoBruto : 2000 + anoBruto) : anoBruto;
  return validarCivil(ano, mes, dia);
}

function validarCivil(ano: number, mes: number, dia: number): string | null {
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || !Number.isInteger(dia)) return null;
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) return null;
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Instante ISO com offset → data civil no fuso do serviço (−03:00). Nunca usa o fuso da máquina. */
export function dataCivilDoInstante(instante: string, offset = OFFSET_SERVICO): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:\d{2})$/.exec(instante.trim());
  if (!match) return null;
  const offsetMin = match[5] === "Z" ? 0 : (match[5]!.startsWith("-") ? -1 : 1)
    * (Number(match[5]!.slice(1, 3)) * 60 + Number(match[5]!.slice(4, 6)));
  const servicoMin = offset === "Z" ? 0 : (offset.startsWith("-") ? -1 : 1)
    * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4, 6)));
  const localMs = Date.UTC(Number(match[1]!.slice(0, 4)), Number(match[1]!.slice(5, 7)) - 1,
    Number(match[1]!.slice(8, 10)), Number(match[2]), Number(match[3]), Number(match[4] ?? "0"));
  const civilMs = localMs - offsetMin * 60_000 + servicoMin * 60_000;
  const d = new Date(civilMs);
  return validarCivil(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

// ── Lateralidade e sítio anatômico ───────────────────────────────────────────
/** D-W9-05 · valor canônico de lateralidade, validado contra o domínio do órgão. */
export function normalizarLateralidade(
  texto: string | null | undefined,
  orgao?: string | null,
): string | null {
  if (typeof texto !== "string") return null;
  const chave = texto.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
  const direto = LATERALIDADE_SINONIMOS[chave];
  const viaAlias = /^[àa]\s+(esquerda|direita)$/.test(chave)
    ? LATERALIDADE_SINONIMOS[chave.replace(/^[àa]\s+/, "")] : undefined;
  const canonico = direto ?? viaAlias ?? null;
  if (!canonico) return null;
  const dominio = orgao ? LATERALIDADE_POR_ORGAO[orgaoCanonico(orgao)] : undefined;
  if (dominio && !dominio.includes(canonico)) return null;
  return canonico;
}

const ALIAS_ORGAO_LOCAL: Readonly<Record<string, string>> = {
  mama: "mama", mamao: "mama", mamaria: "mama", mamario: "mama",
  prostata: "prostata", prostatica: "prostata", prostatico: "prostata",
  pulmao: "pulmao", pulmonar: "pulmao", broncogenico: "pulmao",
  colon: "colon", colorretal: "colon", reto: "reto",
  estomago: "estomago", gastrico: "estomago", esofago: "esofago",
  pancreas: "pancreas", pancreatico: "pancreas", figado: "figado", hepatico: "figado",
  cabeca: "cabeca-e-pescoco", pescoco: "cabeca-e-pescoco", orofaringe: "orofaringe",
  utero: "utero", ovario: "ovario", ovariano: "ovario",
  bexiga: "bexiga", rim: "rim", renal: "rim",
  linfonodo: "adenopatia cervical", cervical: "adenopatia cervical",
  osso: "osso", ossea: "osso", osseo: "osso", vertebral: "coluna", coluna: "coluna",
  cerebral: "hemisferio cerebral", cerebro: "hemisferio cerebral",
};

/** Sítio anatômico canônico (minúsculo, sem acento). null quando não reconhecido. */
export function orgaoCanonico(texto: string | null | undefined): string {
  if (typeof texto !== "string") return "";
  const chave = texto.normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
  return ALIAS_ORGAO[chave] ?? ALIAS_ORGAO_LOCAL[chave] ?? chave;
}

/** Sítio canônico só quando reconhecido pela tabela; caso contrário null (PENDENTE). */
export function normalizarSitioAnatomico(texto: string | null | undefined): string | null {
  if (typeof texto !== "string" || !texto.trim()) return null;
  const chave = texto.normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
  // "colo" sozinho também designa cólon; o complemento anatômico é obrigatório.
  if (chave === "colo uterino" || chave === "colo do utero") return "utero";
  const canonico = orgaoCanonico(texto);
  return canonico in ALIAS_ORGAO_LOCAL || Object.values(ALIAS_ORGAO_LOCAL).includes(canonico)
    ? canonico : null;
}

// ── Fármacos ─────────────────────────────────────────────────────────────────
/** Dicionário local (dados, não LLM). Nome não reconhecido nunca é normalizado em silêncio. */
export const DICIONARIO_FARMACO: Readonly<Record<string, string>> = {
  carboplatina: "CARBOPLATINA", cisplatina: "CISPLATINA", paclitaxel: "PACLITAXEL",
  docetaxel: "DOCETAXEL", oxaliplatina: "OXALIPLATINA", fluorouracil: "FLUOROURACIL",
  "5-fu": "FLUOROURACIL", "5-fluorouracil": "FLUOROURACIL", capecitabina: "CAPECITABINA",
  gemcitabina: "GEMCITABINA", irinotecano: "IRINOTECANO", etoposideo: "ETOPOSIDEO",
  doxorrubicina: "DOXORRUBICINA", ciclofosfamida: "CICLOFOSFAMIDA", metotrexato: "METOTREXATO",
  temozolomida: "TEMOZOLOMIDA", pemetrexede: "PEMETREXEDE", vinorelbina: "VINORELBINA",
  trastuzumabe: "TRASTUZUMABE", bevacizumabe: "BEVACIZUMABE", ifosfamida: "IFOSFAMIDA",
  prednisona: "PREDNISONA",
  topotecana: "TOPOTECANA", leucovorina: "LEUCOVORINA", mesna: "MESNA",
};

export interface FarmacoNormalizado {
  /** Texto como veio da fonte. */
  raw: string;
  /** Nome canônico; null quando não há casamento exato. */
  normalizado: string | null;
  /** true quando o nome só casa por aproximação fonética (⇒ INFERRED, com confiança). */
  incerto: boolean;
  confidence: number;
  /** Conteúdo invisível ou homóglifo: apenas candidato para revisão, nunca EXPLICIT. */
  suspeito?: true;
}

function semAcento(chave: string): string {
  return chave.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR").trim();
}

// Substituições usadas SOMENTE para procurar um candidato, jamais para corrigir o
// texto de origem. Scripts mistos e formatadores invisíveis são sempre suspeitos.
const HOMOGLIFOS: Readonly<Record<string, string>> = {
  "а": "a", "е": "e", "і": "i", "о": "o", "р": "p", "с": "c",
  "х": "x", "у": "y", "ο": "o", "α": "a", "ι": "i", "ρ": "p",
  "ν": "v", "ϲ": "c",
};
const INVISIVEIS = /[\p{Cf}\u034f\u180e]/gu;
const OUTRO_SCRIPT = /[\p{Script=Cyrillic}\p{Script=Greek}]/u;

function chaveVisualSuspeita(texto: string): string | null {
  if (!INVISIVEIS.test(texto) && !OUTRO_SCRIPT.test(texto)) return null;
  INVISIVEIS.lastIndex = 0;
  const visivel = texto.toLocaleLowerCase("pt-BR").replace(INVISIVEIS, "")
    .replace(/[\p{Script=Cyrillic}\p{Script=Greek}]/gu, (char) => HOMOGLIFOS[char] ?? "?");
  return semAcento(visivel);
}

function distancia(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let anterior = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const atual = dp[j]!;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
      anterior = atual;
    }
  }
  return dp[b.length]!;
}

/** Normalização de fármaco com proveniência: exato ⇒ EXPLICIT; aproximado ⇒ INFERRED incerto. */
export function normalizarFarmaco(texto: string): FarmacoNormalizado {
  const visual = chaveVisualSuspeita(texto);
  if (visual !== null) {
    // Não usamos distância de edição neste ramo: um formatador ou alfabeto estranho
    // por si só não autoriza converter uma palavra arbitrária em medicamento.
    return { raw: texto, normalizado: DICIONARIO_FARMACO[visual] ?? null,
      incerto: true, confidence: 0.5, suspeito: true };
  }
  const chave = semAcento(texto);
  const exato = DICIONARIO_FARMACO[chave];
  if (exato) return { raw: texto.trim(), normalizado: exato, incerto: false, confidence: 1 };
  let melhor: string | null = null;
  let melhorDistancia = Number.POSITIVE_INFINITY;
  for (const nome of Object.keys(DICIONARIO_FARMACO)) {
    const d = distancia(chave, nome);
    if (d < melhorDistancia) { melhorDistancia = d; melhor = nome; }
  }
  const limiar = chave.length >= 8 ? 2 : 1;
  if (melhor && melhorDistancia <= limiar) {
    return { raw: texto.trim(), normalizado: DICIONARIO_FARMACO[melhor]!, incerto: true, confidence: 0.72 };
  }
  return { raw: texto.trim(), normalizado: null, incerto: false, confidence: 0 };
}

// ── TNM por sistema e edição ─────────────────────────────────────────────────
export interface TnmNormalizado {
  /** Literal da fonte, nunca reescrito. */
  literal: string;
  /** "c" | "p" | "yp" | null (sem prefixo na fonte). */
  prefixo: string | null;
  tipo: "CLINICO" | "PATOLOGICO" | "POS_TRATAMENTO";
  sistema: "AJCC 8" | "AJCC 9";
  edicao: "8" | "9";
  /** true quando a edição depende de HPV/peça ainda não comprovados. */
  pendenteConfirmacao: boolean;
}

/**
 * AJCC 8/9 por sítio e data: orofaringe com HPV positivo é AJCC 9 desde 2026-01-01;
 * sem HPV comprovado a edição fica 8 e o fato é marcado como pendente (nada inferido).
 */
export function normalizarTnm(
  literal: string,
  contexto: Readonly<{ sitio?: string | null; data?: string | null; hpvPositivo?: boolean | null }> = {},
): TnmNormalizado {
  const prefixo = /^(yp|[cp])/i.exec(literal.trim())?.[1]?.toLocaleLowerCase("pt-BR") ?? null;
  const tipo = prefixo === "yp" ? "POS_TRATAMENTO" : prefixo === "p" ? "PATOLOGICO" : "CLINICO";
  const sitio = orgaoCanonico(contexto.sitio ?? null);
  const data = normalizarDataCivil(contexto.data ?? null);
  const vigenciaAjcc9 = data !== null && data >= "2026-01-01";
  if (sitio === "orofaringe") {
    if (contexto.hpvPositivo === true && vigenciaAjcc9) {
      return { literal, prefixo, tipo, sistema: "AJCC 9", edicao: "9", pendenteConfirmacao: false };
    }
    return { literal, prefixo, tipo, sistema: "AJCC 8", edicao: "8", pendenteConfirmacao: true };
  }
  return { literal, prefixo, tipo, sistema: "AJCC 8", edicao: "8", pendenteConfirmacao: false };
}

/** Componente M de um literal TNM ("cT2N0M0" ⇒ "0"). null quando o literal não traz M. */
export function componenteM(literal: string): "0" | "1" | "X" | null {
  const match = /(?:yp|[cp])?M([01X])(?![0-9])/iu.exec(literal);
  return match ? (match[1]!.toLocaleUpperCase("pt-BR") as "0" | "1" | "X") : null;
}

// ── Aplicação sobre os fatos ─────────────────────────────────────────────────
function comRaw(fact: ClinicalFact, raw: string): ClinicalFact {
  return { ...fact, raw };
}

function valorDe(fact: ClinicalFact): Record<string, unknown> {
  return typeof fact.value === "object" && fact.value !== null
    ? fact.value as Record<string, unknown> : {};
}

/**
 * Etapa 4 do pipeline. Reescreve o `value` dos fatos para a forma canônica, preservando
 * `rawEvidence`/`raw`. Fato que não normaliza mantém o literal e fica sem resolução.
 */
export function normalizarFatos(fatos: readonly ClinicalFact[]): readonly ClinicalFact[] {
  return fatos.map((original) => {
    let fact = original;
    if (original.date !== undefined) {
      const data = normalizarDataCivil(original.date);
      if (data === null) {
        // A data literal continua em rawEvidence; sem data clínica válida não há ordenação.
        const { date, ...semData } = original;
        void date;
        fact = { ...semData, requiresConfirmation: true };
      } else {
        fact = { ...original, date: data };
      }
    } else if (original.domain === "lab" || original.domain === "imaging") {
      // Sem data clínica de exame não se cria ordem longitudinal por hora de captura.
      fact = { ...original, requiresConfirmation: true };
    }
    if (fact.domain === "lab") {
      const v = valorDe(fact);
      const normalizado = normalizarLab({
        marker: v.marker, value: v.value, unit: v.unit, raw: v.raw,
      });
      const valor = normalizado.normalizado ? normalizado.value : null;
      return {
        ...fact,
        value: {
          marker: normalizado.marker, value: valor, unit: normalizado.unit,
          raw: normalizado.raw, normalizado: normalizado.normalizado,
        },
      };
    }
    if (fact.domain === "stage") {
      const literal = typeof fact.value === "string" ? fact.value : String(valorDe(fact).literal ?? "");
      if (!literal) return fact;
      const tnm = normalizarTnm(literal, { data: fact.date ?? null });
      return { ...fact, value: { ...tnm }, raw: literal };
    }
    if (fact.domain === "imaging") {
      const v = valorDe(fact);
      const medida = normalizarMedidaMm(v.measureRaw, v.unit);
      const sitio = normalizarSitioAnatomico(typeof v.siteRaw === "string" ? v.siteRaw : null);
      const lateralidade = normalizarLateralidade(
        typeof v.lateralityRaw === "string" ? v.lateralityRaw : null, sitio);
      return {
        ...fact,
        value: {
          ...v,
          sitioCanonico: sitio,
          lateralidade,
          measureMm: medida,
          metodo: detectarMetodoImagem(fact.rawEvidence),
        },
      };
    }
    if (fact.domain === "drug") {
      const raw = typeof fact.value === "string" ? fact.value : String(valorDe(fact).raw ?? "");
      if (!raw) return fact;
      const farmaco = normalizarFarmaco(raw);
      if (farmaco.suspeito) {
        return {
          ...fact,
          raw: farmaco.raw,
          value: { ...valorDe(fact), raw: farmaco.raw, normalizado: farmaco.normalizado,
            incerto: true, suspeito: true },
          evidence: "UNCERTAIN",
          confidence: Math.min(fact.confidence, farmaco.confidence),
          requiresConfirmation: true,
        };
      }
      if (farmaco.normalizado === null) return comRaw(fact, raw);
      return {
        ...fact,
        value: { raw: farmaco.raw, normalizado: farmaco.normalizado, incerto: farmaco.incerto },
        evidence: farmaco.incerto ? "INFERRED" : fact.evidence,
        confidence: farmaco.incerto ? farmaco.confidence : fact.confidence,
        requiresConfirmation: farmaco.incerto ? true : fact.requiresConfirmation,
        ...(farmaco.incerto ? { regra: "FARMACO-FONETICO" } : {}),
      };
    }
    return fact;
  });
}

const METODOS_IMAGEM: readonly (readonly [RegExp, string])[] = [
  [/\bcintilografia\b|\bgamagrafia\b/iu, "CINTILOGRAFIA"],
  [/\bpet\s*[-/]?\s*ct\b|\bpet\b/iu, "PET"],
  [/\bmmg\b|\bmamografia\b/iu, "MMG"],
  [/\busg\b|\bultrassom\b|\becografia\b/iu, "USG"],
  [/\brm\b|\bressonancia\b|\bressonância\b|magn[eé]tic/iu, "RM"],
  [/\btc\b|\btomografia\b/iu, "TC"],
];

/** Método de imagem reconhecido no texto da fonte; null quando não há evidência (nunca adivinha). */
export function detectarMetodoImagem(texto: string): string | null {
  for (const [padrao, nome] of METODOS_IMAGEM) if (padrao.test(texto)) return nome;
  return null;
}

/** Medida de imagem em milímetros; null quando o texto não é numérico reconhecível. */
export function normalizarMedidaMm(medida: unknown, unidade: unknown): number | null {
  const numero = numeroDecimal(medida);
  if (numero === null) return null;
  const u = typeof unidade === "string" ? unidade.trim().toLocaleLowerCase("pt-BR") : "";
  if (u === "mm") return numero;
  if (u === "cm") return Number((numero * 10).toFixed(2));
  return null;
}
