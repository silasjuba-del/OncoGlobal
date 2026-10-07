// D-W9-31 · nódulo < 1 cm fica INDETERMINADO. Mx vira sugestão, nunca troca o texto do médico.
// PROVISORIO-W10: trocar AchadoNodulo / TextoEstadiamento por src/contracts/w10/ quando a ficha publicar o nódulo.

export interface AchadoNodulo {
  texto: string | null;
  medidaMm: number | null;
}

export interface TextoEstadiamento {
  texto: string | null;
}

export interface UnidadeMedida {
  simbolo: string;
  paraMm: number;
}

export interface RulesetNodulo {
  id: string;
  versao: string;
  decisao: string;
  limiteExclusivoMm: number;
  pendencia: string;
  sugestaoMx: string;
  tokenMx: string;
  modeloMotivo: string;
  modeloFaixa: string;
  modeloConflito: string;
  modeloAusente: string;
  modeloMx: string;
  unidades: readonly UnidadeMedida[];
}

export interface AchadoRegra {
  codigo: string;
  texto: string;
  regraId: string;
  rulesetVersao: string;
}

export interface ResultadoNodulo {
  classificacao: "INDETERMINADO" | null;
  estado: "ALERTA" | "PENDENTE" | "SEM_ALERTA";
  bloqueiaSalvar: false;
  geraM1: false;
  pendencia: string | null;
  motivos: AchadoRegra[];
  pendencias: AchadoRegra[];
  decisao: string;
  rulesetVersao: string;
}

export interface ResultadoMx {
  textoOriginal: string | null;
  sugestao: string | null;
  substituiu: false;
  estado: "ALERTA" | "SEM_ALERTA";
  bloqueiaSalvar: false;
  motivos: AchadoRegra[];
  decisao: string;
  rulesetVersao: string;
}

type Bruto = Record<string, unknown>;

const MAPA: Record<string, string> = {
  á: "a", à: "a", ã: "a", â: "a", ä: "a",
  é: "e", ê: "e", è: "e",
  í: "i", ì: "i",
  ó: "o", õ: "o", ô: "o",
  ú: "u", ù: "u",
  ç: "c",
};

interface NumeroLido {
  decimos: number;
  fim: number;
}

interface FaixaMm {
  minDecimos: number;
  maxDecimos: number;
}

function objeto(valor: unknown, caminho: string): Bruto {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) throw new Error(`${caminho} ausente`);
  return valor as Bruto;
}

function texto(valor: unknown, caminho: string): string {
  if (typeof valor !== "string" || valor.trim().length === 0) throw new Error(`${caminho} ausente`);
  return valor.trim();
}

function flag(valor: unknown, caminho: string, esperado: boolean): void {
  if (valor !== esperado) throw new Error(`${caminho} inválido`);
}

function inteiroPositivo(valor: unknown, caminho: string): number {
  if (typeof valor !== "number" || !Number.isInteger(valor) || valor <= 0) throw new Error(`${caminho} inválido`);
  return valor;
}

function dobrar(valor: string): string {
  let saida = "";
  for (const ch of valor.toLowerCase()) saida += MAPA[ch] ?? ch;
  return saida;
}

function limpo(valor: string | null): string | null {
  if (valor === null) return null;
  const t = valor.trim();
  return t.length === 0 ? null : t;
}

function achado(codigo: string, corpo: string, rs: RulesetNodulo): AchadoRegra {
  return { codigo, texto: `${corpo} (${rs.decisao})`, regraId: rs.decisao, rulesetVersao: rs.versao };
}

function pularEspaco(textoFonte: string, i: number): number {
  let j = i;
  while (j < textoFonte.length && /[\s]/.test(textoFonte[j] ?? "")) j += 1;
  return j;
}

function lerNumero(textoFonte: string, i: number): NumeroLido | null {
  const ch = textoFonte[i] ?? "";
  if (!/[0-9]/.test(ch)) return null;
  let j = i;
  let inteiro = 0;
  while (j < textoFonte.length && /[0-9]/.test(textoFonte[j] ?? "")) {
    inteiro = inteiro * 10 + Number(textoFonte[j]);
    j += 1;
  }
  let frac = 0;
  let casas = 0;
  const sep = textoFonte[j] ?? "";
  if ((sep === "," || sep === ".") && /[0-9]/.test(textoFonte[j + 1] ?? "")) {
    j += 1;
    while (j < textoFonte.length && /[0-9]/.test(textoFonte[j] ?? "") && casas < 4) {
      frac = frac * 10 + Number(textoFonte[j]);
      casas += 1;
      j += 1;
    }
  }
  const escala = 10 ** casas;
  const decimos = Math.round((inteiro * escala + frac) * 10 / escala);
  return { decimos, fim: j };
}

function separadorFaixa(textoFonte: string, i: number): number {
  const ch = textoFonte[i] ?? "";
  if (ch === "-" || ch === "–" || ch === "—") return i + 1;
  const resto = dobrar(textoFonte.slice(i));
  if (resto.startsWith("a ") || resto.startsWith("a\t")) return i + 1;
  return -1;
}

function casarUnidade(textoFonte: string, i: number, unidades: readonly UnidadeMedida[]): { fator: number; fim: number } | null {
  const resto = dobrar(textoFonte.slice(i));
  const ordenadas = [...unidades].sort((a, b) => dobrar(b.simbolo).length - dobrar(a.simbolo).length);
  for (const un of ordenadas) {
    const simbolo = dobrar(un.simbolo);
    if (!resto.startsWith(simbolo)) continue;
    const depois = resto[simbolo.length] ?? " ";
    if (/[a-z0-9]/.test(depois)) continue;
    return { fator: un.paraMm, fim: i + simbolo.length };
  }
  return null;
}

function faixasDe(textoFonte: string, rs: RulesetNodulo): FaixaMm[] {
  const faixas: FaixaMm[] = [];
  let i = 0;
  while (i < textoFonte.length) {
    const n1 = lerNumero(textoFonte, i);
    if (n1 === null) {
      i += 1;
      continue;
    }
    let j = pularEspaco(textoFonte, n1.fim);
    let max = n1.decimos;
    let min = n1.decimos;
    const sep = separadorFaixa(textoFonte, j);
    if (sep >= 0) {
      const depois = pularEspaco(textoFonte, sep);
      const n2 = lerNumero(textoFonte, depois);
      if (n2 !== null) {
        min = Math.min(n1.decimos, n2.decimos);
        max = Math.max(n1.decimos, n2.decimos);
        j = pularEspaco(textoFonte, n2.fim);
      }
    }
    const un = casarUnidade(textoFonte, j, rs.unidades);
    if (un === null) {
      i = n1.fim;
      continue;
    }
    faixas.push({ minDecimos: min * un.fator, maxDecimos: max * un.fator });
    i = un.fim;
  }
  return faixas;
}

function decimosDeMm(medidaMm: number): number | null {
  if (!Number.isFinite(medidaMm) || medidaMm < 0) return null;
  return Math.round(medidaMm * 10);
}

export function lerNodulo(json: unknown): RulesetNodulo {
  const raiz = objeto(json, "ruleset");
  const header = objeto(raiz.header, "header");
  const bloco = objeto(raiz.nodulo, "nodulo");
  flag(bloco.bloqueiaSalvar, "bloqueiaSalvar", false);
  flag(bloco.geraM1, "geraM1", false);
  flag(bloco.igualAoLimiteNaoIndetermina, "igualAoLimiteNaoIndetermina", true);
  const tokenMx = texto(bloco.tokenMx, "tokenMx");
  if (dobrar(tokenMx) !== "mx") throw new Error("tokenMx inválido");
  const unidadesBrutas = bloco.unidades;
  if (!Array.isArray(unidadesBrutas) || unidadesBrutas.length === 0) throw new Error("unidades ausentes");
  const unidades: UnidadeMedida[] = unidadesBrutas.map((item, i) => {
    const o = objeto(item, `unidades[${i}]`);
    return { simbolo: texto(o.simbolo, `unidades[${i}].simbolo`), paraMm: inteiroPositivo(o.paraMm, `unidades[${i}].paraMm`) };
  });
  return {
    id: texto(header.id, "header.id"),
    versao: texto(header.versao, "header.versao"),
    decisao: texto(bloco.decisao, "decisao"),
    limiteExclusivoMm: inteiroPositivo(bloco.limiteExclusivoMm, "limiteExclusivoMm"),
    pendencia: texto(bloco.pendencia, "pendencia"),
    sugestaoMx: texto(bloco.sugestaoMx, "sugestaoMx"),
    tokenMx,
    modeloMotivo: texto(bloco.modeloMotivo, "modeloMotivo"),
    modeloFaixa: texto(bloco.modeloFaixa, "modeloFaixa"),
    modeloConflito: texto(bloco.modeloConflito, "modeloConflito"),
    modeloAusente: texto(bloco.modeloAusente, "modeloAusente"),
    modeloMx: texto(bloco.modeloMx, "modeloMx"),
    unidades,
  };
}

function conflita(faixas: readonly FaixaMm[], decimos: number): boolean {
  if (faixas.length === 0) return false;
  return faixas.every((f) => f.maxDecimos !== decimos && f.minDecimos !== decimos);
}

export function avaliarNodulo(achadoNodulo: AchadoNodulo, rs: RulesetNodulo): ResultadoNodulo {
  const limite = rs.limiteExclusivoMm * 10;
  const textoLaudo = limpo(achadoNodulo.texto);
  const faixas = textoLaudo === null ? [] : faixasDe(textoLaudo, rs);
  const decimos = achadoNodulo.medidaMm === null ? null : decimosDeMm(achadoNodulo.medidaMm);
  const base = {
    bloqueiaSalvar: false as const,
    geraM1: false as const,
    classificacao: null,
    pendencia: null,
    decisao: rs.decisao,
    rulesetVersao: rs.versao,
  };
  if (decimos !== null && conflita(faixas, decimos)) {
    return {
      ...base,
      estado: "PENDENTE",
      motivos: [],
      pendencias: [achado("pendente.nodulo.conflito", rs.modeloConflito, rs)],
    };
  }
  const usadas: FaixaMm[] = decimos === null ? faixas : [{ minDecimos: decimos, maxDecimos: decimos }];
  if (usadas.length === 0) {
    return {
      ...base,
      estado: "PENDENTE",
      motivos: [],
      pendencias: [achado("pendente.nodulo.ausente", rs.modeloAusente, rs)],
    };
  }
  const sob = usadas.some((f) => f.maxDecimos < limite);
  const cruza = usadas.some((f) => f.minDecimos < limite && f.maxDecimos >= limite);
  if (sob && !cruza) {
    return {
      ...base,
      classificacao: "INDETERMINADO",
      estado: "ALERTA",
      pendencia: rs.pendencia,
      motivos: [achado("INDETERMINADO", rs.modeloMotivo.replace("{pendencia}", rs.pendencia), rs)],
      pendencias: [achado("pendente.nodulo.controle", rs.pendencia, rs)],
    };
  }
  if (cruza || (sob && cruza)) {
    return {
      ...base,
      estado: "PENDENTE",
      motivos: [],
      pendencias: [achado("pendente.nodulo.faixa", rs.modeloFaixa, rs)],
    };
  }
  return { ...base, estado: "SEM_ALERTA", motivos: [], pendencias: [] };
}

function contemMx(textoFonte: string): boolean {
  return /(?:^|[^a-z])(?:[cp])?mx(?=$|[^a-z])/.test(dobrar(textoFonte));
}

export function sugerirMx(estadiamento: TextoEstadiamento, rs: RulesetNodulo): ResultadoMx {
  const original = limpo(estadiamento.texto);
  const base = {
    textoOriginal: original,
    sugestao: null,
    substituiu: false as const,
    bloqueiaSalvar: false as const,
    decisao: rs.decisao,
    rulesetVersao: rs.versao,
  };
  if (original === null || !contemMx(original)) {
    return { ...base, estado: "SEM_ALERTA", motivos: [] };
  }
  return {
    ...base,
    sugestao: rs.sugestaoMx,
    estado: "ALERTA",
    motivos: [achado("sugestao.mx", rs.modeloMx.replace("{sugestao}", rs.sugestaoMx), rs)],
  };
}
