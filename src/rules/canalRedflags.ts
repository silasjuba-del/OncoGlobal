import type { RespostaCanal, ResultadoCanal } from "../contracts/w12/regrasClinicas.js";
export type { ResultadoCanal, RespostaCanal } from "../contracts/w12/regrasClinicas.js";
// D-W9-75 · canal do paciente. Cada sinal traz a própria orientação, lida do corpus.
// Não substitui redFlagsCanal.ts. O texto não é escrito aqui.
// Alerta ao médico. Nunca bloqueia e nunca prescreve.

export interface SinalCanal {
  id: string;
  termo: string;
  termos: readonly string[];
  orientacao: string;
  status: string;
  limiarDecimosExclusivo: number | null;
}

export interface CanalLido {
  fraseFinal: string;
  sinais: readonly SinalCanal[];
  rulesetId: string;
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

function objeto(valor: unknown, caminho: string): Bruto {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) throw new Error(`${caminho} ausente`);
  return valor as Bruto;
}

function texto(valor: unknown, caminho: string): string {
  if (typeof valor !== "string" || valor.trim().length === 0) throw new Error(`${caminho} ausente`);
  return valor.trim();
}

function dobrar(valor: string): string {
  let saida = "";
  for (const ch of valor.toLowerCase()) saida += MAPA[ch] ?? ch;
  return saida;
}

export function lerCanalRedflags(json: unknown): CanalLido {
  const raiz = objeto(json, "canal");
  const header = objeto(raiz.header, "header");
  if (!Array.isArray(raiz.sinais) || raiz.sinais.length === 0) throw new Error("sinais ausente");
  const sinais = raiz.sinais.map((item, i) => {
    const o = objeto(item, `sinais[${i}]`);
    if (!Array.isArray(o.termos) || o.termos.length === 0) throw new Error(`sinais[${i}].termos ausente`);
    const limiar = o.limiarDecimosExclusivo;
    if (limiar !== null && limiar !== undefined && (typeof limiar !== "number" || !Number.isInteger(limiar))) {
      throw new Error(`sinais[${i}].limiarDecimosExclusivo inválido`);
    }
    return {
      id: texto(o.id, `sinais[${i}].id`),
      termo: texto(o.termo, `sinais[${i}].termo`),
      termos: o.termos.map((t, j) => texto(t, `sinais[${i}].termos[${j}]`)),
      orientacao: texto(o.orientacao, `sinais[${i}].orientacao`),
      status: texto(o.status, `sinais[${i}].status`),
      limiarDecimosExclusivo: typeof limiar === "number" ? limiar : null,
    };
  });
  return {
    fraseFinal: texto(raiz.fraseFinal, "fraseFinal"),
    sinais,
    rulesetId: texto(header.id, "header.id"),
    rulesetVersao: texto(header.versao, "header.versao"),
  };
}

function negadoAntes(texto: string, inicio: number): boolean {
  const antes = texto.slice(Math.max(0, inicio - 40), inicio);
  return /(?:^|[^a-z0-9])(?:nao|sem|nunca)(?:\s+[a-z]+){0,3}\s+$/.test(antes);
}

function casaTermo(texto: string, termo: string): boolean {
  const alvo = dobrar(termo).trim();
  if (alvo.length === 0) return false;
  let from = 0;
  while (from < texto.length) {
    const i = texto.indexOf(alvo, from);
    if (i < 0) return false;
    const antes = i === 0 ? " " : texto[i - 1] ?? " ";
    const depois = i + alvo.length >= texto.length ? " " : texto[i + alvo.length] ?? " ";
    if (!/[a-z0-9]/.test(antes) && !/[a-z0-9]/.test(depois) && !negadoAntes(texto, i)) return true;
    from = i + 1;
  }
  return false;
}

function decimosDe(inteiro: string, frac: string | undefined): number | null {
  const graus = Number(inteiro);
  if (!Number.isInteger(graus) || graus < 35 || graus > 42) return null;
  const decimo = frac === undefined || frac.length === 0 ? 0 : Number(frac[0]);
  if (!Number.isInteger(decimo)) return null;
  return graus * 10 + decimo;
}

/** Temperaturas no texto. 378 = 37,8 °C. Fora de 35–42 não é febre. */
function temperaturas(texto: string): number[] {
  const achados: number[] = [];
  const re = /(?:^|[^a-z0-9])(\d{2})(?:[.,](\d))?/g;
  let m = re.exec(texto);
  while (m !== null) {
    const lido = decimosDe(m[1] ?? "", m[2]);
    if (lido !== null) achados.push(lido);
    m = re.exec(texto);
  }
  return achados;
}

function disparou(texto: string, sinal: SinalCanal): boolean {
  const afirmado = sinal.termos.some((termo) => casaTermo(texto, termo));
  const limiar = sinal.limiarDecimosExclusivo;
  if (limiar === null) return afirmado;
  const temps = temperaturas(texto);
  if (temps.length > 0) return temps.some((valor) => valor > limiar);
  return afirmado;
}

function respostaDe(sinal: SinalCanal, fraseFinal: string): RespostaCanal {
  const corpo = sinal.orientacao.endsWith(fraseFinal) ? sinal.orientacao : `${sinal.orientacao} ${fraseFinal}`;
  return {
    id: sinal.id,
    termo: sinal.termo,
    texto: corpo,
    status: sinal.status,
    alertaMedico: true,
    bloqueiaSalvar: false,
    defineDose: false,
    defineCausalidade: false,
  };
}

/** Orientações saem do corpus. Febre numérica só acima do limiar exclusivo. Negação não dispara. */
export function avaliarCanalRedflags(relato: string, canal: CanalLido): ResultadoCanal {
  const texto = dobrar(relato);
  const respostas = canal.sinais
    .filter((sinal) => disparou(texto, sinal))
    .map((sinal) => respostaDe(sinal, canal.fraseFinal))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    estado: respostas.length > 0 ? "ALERTA" : "SEM_ALERTA",
    respostas,
    alertaMedico: respostas.length > 0,
    bloqueiaSalvar: false,
    rulesetVersao: canal.rulesetVersao,
  };
}
