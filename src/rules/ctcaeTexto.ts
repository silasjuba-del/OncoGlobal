// W12-GROK-04 · D-W9-75. Extrai critérios do texto livre. Puro: sem LLM, sem relógio, sem rede.
// A negação imediata ("sem vômitos", "não tem febre") não gera critério.

export interface CriterioExtraido {
  tipo: string;
  termo: string | null;
  inicio: number;
  fim: number;
  texto: string;
  quantidade: number | null;
  periodoDias: number | null;
  leituraQuantidade: "POR_DIA" | "NO_TOTAL" | "AMBIGUO" | null;
  sobreBasal: boolean;
  valorLaboratorio: number | null;
  analito: "plaquetas" | "neutrofilos" | "hemoglobina" | null;
  tempDecimos: number | null;
  duracaoHoras: number | null;
  intensidade: "leve" | "moderada" | "severa" | null;
  ambulatorial: boolean;
}

interface Frase {
  inicio: number;
  fim: number;
  texto: string;
}

interface Sintoma {
  termo: string;
  inicio: number;
  fim: number;
}

const SINTOMAS: readonly { termo: string; re: RegExp }[] = [
  { termo: "vomito", re: /v[oô]mitos?|vomitou|[eê]mese/gi },
  { termo: "diarreia", re: /diarreia|diarreic[oa]|evacua[cç][oõ]es|deje[cç][oõ]es/gi },
  { termo: "nausea", re: /n[aá]useas?|enjoo/gi },
  { termo: "mucositeOral", re: /mucosite|[uú]lceras?\s+orais?|aftas?/gi },
  { termo: "fadiga", re: /fadiga|cansa[cç]o/gi },
  { termo: "neuropatiaPerifericaSensitiva", re: /neuropatia|formigamento|dorm[eê]ncia/gi },
  { termo: "febre", re: /febre|febril|temperatura/gi },
  { termo: "plaquetas", re: /plaquetas?/gi },
];

function achar(texto: string, re: RegExp): RegExpMatchArray[] {
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  return [...texto.matchAll(new RegExp(re.source, flags))];
}

function negado(texto: string, inicio: number): boolean {
  const antes = texto.slice(Math.max(0, inicio - 40), inicio);
  return /(?:sem|n[aã]o(?:\s+tem|\s+houve|\s+refere|\s+apresenta)?|nega(?:ou)?|aus[eê]ncia\s+de)\s+$/i.test(antes);
}

function frasesDe(texto: string): Frase[] {
  const saida: Frase[] = [];
  let inicio = 0;
  for (const marca of achar(texto, /[.;\n]/g)) {
    const fim = marca.index ?? texto.length;
    saida.push({ inicio, fim, texto: texto.slice(inicio, fim) });
    inicio = fim + 1;
  }
  saida.push({ inicio, fim: texto.length, texto: texto.slice(inicio) });
  return saida;
}

function fraseEm(frases: readonly Frase[], indice: number): Frase {
  return frases.find((f) => indice >= f.inicio && indice <= f.fim) ?? frases[frases.length - 1] ?? { inicio: 0, fim: 0, texto: "" };
}

function termoDaPalavra(palavra: string): string | null {
  const tabela: readonly [RegExp, string][] = [
    [/v[oô]mit|vomitou|[eê]mese/i, "vomito"],
    [/diarre|evacua|deje[cç]/i, "diarreia"],
    [/n[aá]use|enjoo/i, "nausea"],
    [/mucosite|afta|[uú]lcera/i, "mucositeOral"],
    [/fadiga|cansa[cç]o/i, "fadiga"],
    [/neuropatia|formigamento|dorm[eê]ncia/i, "neuropatiaPerifericaSensitiva"],
    [/febre|febril|temperatura/i, "febre"],
    [/plaquet/i, "plaquetas"],
  ];
  return tabela.find(([re]) => re.test(palavra))?.[1] ?? null;
}

function termoProximo(sintomas: readonly Sintoma[], frase: Frase, inicio: number, fim: number): string | null {
  const naFrase = sintomas.filter((s) => s.inicio >= frase.inicio && s.inicio <= frase.fim);
  const noTrecho = naFrase.filter((s) => s.inicio >= inicio && s.inicio < fim);
  const lista = noTrecho.length > 0 ? noTrecho : naFrase;
  if (lista.length === 0) return null;
  return lista.reduce((melhor, atual) =>
    Math.abs(atual.inicio - inicio) < Math.abs(melhor.inicio - inicio) ? atual : melhor,
  ).termo;
}

function inteiroClinico(bruto: string): number | null {
  const limpo = bruto.replace(/\s/g, "");
  if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) return Number(limpo.replace(/\./g, ""));
  if (/^\d{1,3}(,\d{3})+$/.test(limpo)) return Number(limpo.replace(/,/g, ""));
  if (/^\d+$/.test(limpo)) return Number(limpo);
  return null;
}

function decimos(inteiro: string, fracao?: string): number {
  return Number(inteiro) * 10 + Number(fracao && fracao.length > 0 ? fracao[0] : "0");
}

function sobreBasal(frase: string): boolean {
  return /a\s+mais|acima\s+d[oe]|sobre\s+o\s+basal|que\s+o\s+habitual|al[eé]m\s+do\s+habitual/i.test(frase);
}

function vazio(
  tipo: string,
  termo: string | null,
  inicio: number,
  fim: number,
  texto: string,
  extra: Partial<CriterioExtraido> = {},
): CriterioExtraido {
  return {
    tipo,
    termo,
    inicio,
    fim,
    texto,
    quantidade: extra.quantidade ?? null,
    periodoDias: extra.periodoDias ?? null,
    leituraQuantidade: extra.leituraQuantidade ?? null,
    sobreBasal: extra.sobreBasal ?? false,
    valorLaboratorio: extra.valorLaboratorio ?? null,
    analito: extra.analito ?? null,
    tempDecimos: extra.tempDecimos ?? null,
    duracaoHoras: extra.duracaoHoras ?? null,
    intensidade: extra.intensidade ?? null,
    ambulatorial: extra.ambulatorial ?? false,
  };
}

/** Critérios com trecho-fonte. O mesmo texto produz a mesma lista, na mesma ordem. */
export function extrairCriteriosCtcae(texto: string): CriterioExtraido[] {
  const frases = frasesDe(texto);
  const sintomas: Sintoma[] = [];
  for (const sintoma of SINTOMAS) {
    for (const achado of achar(texto, sintoma.re)) {
      const inicio = achado.index ?? 0;
      if (negado(texto, inicio)) continue;
      sintomas.push({ termo: sintoma.termo, inicio, fim: inicio + achado[0].length });
    }
  }

  const saida: CriterioExtraido[] = [];
  const vistos = new Set<string>();
  const por = (item: CriterioExtraido) => {
    const chave = `${item.tipo}|${item.termo ?? ""}|${item.inicio}|${item.fim}|${item.leituraQuantidade ?? ""}|${item.intensidade ?? ""}`;
    if (vistos.has(chave)) return;
    vistos.add(chave);
    saida.push(item);
  };

  for (const sintoma of sintomas) {
    por(vazio("termo", sintoma.termo, sintoma.inicio, sintoma.fim, texto.slice(sintoma.inicio, sintoma.fim)));
  }

  const reAmbiguo = /(\d+)\s+epis[oó]dios?(?:\s+de\s+([A-Za-zÀ-ÿ]+))?\s+por\s+(\d+)\s+dias?\b/gi;
  for (const achado of achar(texto, reAmbiguo)) {
    const inicio = achado.index ?? 0;
    if (negado(texto, inicio)) continue;
    const frase = fraseEm(frases, inicio);
    const fim = inicio + achado[0].length;
    const termo = (achado[2] ? termoDaPalavra(achado[2]) : null) ?? termoProximo(sintomas, frase, inicio, fim);
    por(vazio("quantidade", termo, inicio, fim, achado[0], {
      quantidade: Number(achado[1]),
      periodoDias: Number(achado[3]),
      leituraQuantidade: "AMBIGUO",
      sobreBasal: sobreBasal(frase.texto),
    }));
  }

  const rePorDia = /(\d+)\s+(epis[oó]dios?(?:\s+de\s+[A-Za-zÀ-ÿ]+)?|evacua[cç][oõ]es|deje[cç][oõ]es|v[oô]mitos)(?:\s+a\s+mais)?\s+por\s+dia\b/gi;
  for (const achado of achar(texto, rePorDia)) {
    const inicio = achado.index ?? 0;
    if (negado(texto, inicio)) continue;
    const frase = fraseEm(frases, inicio);
    const fim = inicio + achado[0].length;
    const termo = termoDaPalavra(achado[2] ?? "") ?? termoProximo(sintomas, frase, inicio, fim);
    por(vazio("quantidade", termo, inicio, fim, achado[0], {
      quantidade: Number(achado[1]),
      leituraQuantidade: "POR_DIA",
      sobreBasal: sobreBasal(frase.texto),
    }));
  }

  const marcas: { re: RegExp; tipo: string; intensidade?: CriterioExtraido["intensidade"] }[] = [
    { re: /hidrata[cç][aã]o\s+(?:ev|endovenosa|venosa|intravenosa)\b/gi, tipo: "hidratacaoEv" },
    { re: /observa[cç][aã]o\s+hospitalar|\binterna[cç][aã]o\b|\bhospitaliza[cç][aã]o\b|\binternad[oa]\b/gi, tipo: "hospitalizacao" },
    { re: /atividades?\s+instrumentais|\bavd\s+instrumental/gi, tipo: "avdInstrumental" },
    { re: /autocuidado|\bavd\s+(?:b[aá]sica|de\s+autocuidado)/gi, tipo: "avdAutocuidado" },
    { re: /dieta\s+(?:modificada|pastosa|l[ií]quida)/gi, tipo: "dietaModificada" },
    { re: /n[aã]o\s+interfere(?:indo)?\s+(?:na|com|o)\s+(?:a\s+)?(?:alimenta[cç][aã]o|ingesta|via\s+oral)/gi, tipo: "ingestaoNaoInterfere" },
    { re: /interfere(?:indo)?\s+(?:na|com|o)\s+(?:a\s+)?(?:alimenta[cç][aã]o|ingesta|via\s+oral)/gi, tipo: "ingestaoInterfere" },
    { re: /n[aã]o\s+alivia\s+com\s+(?:o\s+)?repouso/gi, tipo: "naoAliviaComRepouso" },
    { re: /alivia\s+com\s+(?:o\s+)?repouso/gi, tipo: "aliviaComRepouso" },
    { re: /dor\s+intensa|dor\s+grave|dor\s+severa/gi, tipo: "dor", intensidade: "severa" },
    { re: /dor\s+moderada/gi, tipo: "dor", intensidade: "moderada" },
    { re: /dor\s+leve/gi, tipo: "dor", intensidade: "leve" },
    { re: /nutri[cç][aã]o\s+parenteral|\bnpt\b|sonda\s+(?:enteral|nasoenteral)/gi, tipo: "sonda" },
    { re: /risco\s+de\s+vida/gi, tipo: "riscoDeVida" },
    { re: /\b(?:[oó]bito|faleceu)\b/gi, tipo: "obito" },
  ];

  for (const marca of marcas) {
    for (const achado of achar(texto, marca.re)) {
      const inicio = achado.index ?? 0;
      if (marca.tipo !== "ingestaoNaoInterfere" && marca.tipo !== "naoAliviaComRepouso" && negado(texto, inicio)) continue;
      const frase = fraseEm(frases, inicio);
      const fim = inicio + achado[0].length;
      por(vazio(marca.tipo, termoProximo(sintomas, frase, inicio, fim), inicio, fim, achado[0], {
        intensidade: marca.intensidade ?? null,
        ambulatorial: marca.tipo === "hidratacaoEv" && /ambulatori/i.test(frase.texto),
      }));
    }
  }

  const reTempGraus = /(\d{2})[,.](\d)\s*(?:°\s*c|graus)\b/gi;
  const reTempPalavra = /(?:febre|temperatura)\s*(?:de|a|:)?\s*(\d{2})(?:[,.](\d))?/gi;
  const temps: { inicio: number; fim: number; texto: string; tempDecimos: number }[] = [];
  for (const re of [reTempGraus, reTempPalavra]) {
    for (const achado of achar(texto, re)) {
      const inicio = achado.index ?? 0;
      const fim = inicio + achado[0].length;
      const inteiro = achado[1];
      if (inteiro === undefined || temps.some((t) => inicio < t.fim && fim > t.inicio)) continue;
      if (negado(texto, inicio)) continue;
      temps.push({ inicio, fim, texto: achado[0], tempDecimos: decimos(inteiro, achado[2]) });
    }
  }
  for (const temp of temps) {
    const frase = fraseEm(frases, temp.inicio);
    por(vazio("temperatura", termoProximo(sintomas, frase, temp.inicio, temp.fim), temp.inicio, temp.fim, temp.texto, {
      tempDecimos: temp.tempDecimos,
    }));
  }

  for (const frase of frases) {
    if (!/febre|febril|temperatura/i.test(frase.texto) || /epis[oó]dios/i.test(frase.texto)) continue;
    for (const achado of achar(frase.texto, /por\s+(\d+)\s+horas?\b|h[aá]\s+(\d+)\s+horas?\b|por\s+(\d+)\s+dias?\b/gi)) {
      const local = achado.index ?? 0;
      const inicio = frase.inicio + local;
      if (negado(texto, inicio)) continue;
      const horas = achado[1] !== undefined ? Number(achado[1]) : achado[2] !== undefined ? Number(achado[2]) : Number(achado[3]) * 24;
      const fim = inicio + achado[0].length;
      por(vazio("duracao", "febre", inicio, fim, achado[0], { duracaoHoras: horas }));
    }
  }

  const rePlq = /\bplaquetas?\s*(?:de|a|=|:)?\s*(\d{1,3}(?:[.,]\d{3})+|\d{4,7})\b|\b(\d{1,3}(?:[.,]\d{3})+|\d{4,7})\s*plaquetas?\b/gi;
  for (const achado of achar(texto, rePlq)) {
    const inicio = achado.index ?? 0;
    if (negado(texto, inicio)) continue;
    const bruto = achado[1] ?? achado[2];
    const valor = bruto === undefined ? null : inteiroClinico(bruto);
    if (valor === null) continue;
    const fim = inicio + achado[0].length;
    por(vazio("laboratorio", "plaquetas", inicio, fim, achado[0], {
      valorLaboratorio: valor,
      analito: "plaquetas",
    }));
  }

  saida.sort((a, b) => a.inicio - b.inicio || a.fim - b.fim || (a.tipo < b.tipo ? -1 : a.tipo > b.tipo ? 1 : 0));
  return saida;
}
