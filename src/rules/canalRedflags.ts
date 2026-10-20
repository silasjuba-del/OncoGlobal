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

// Escopo local: pontuação decimal não encerra a oração e uma oração com novo
// sujeito/predicado não herda a negação nem a medida da anterior.
function clausulas(texto: string): string[] {
  return texto.split(/(?<!\d)\.|\.(?!\d)|[!;\n]|(?<=\?)\s+|\b(?:mas|porem|contudo)\b|(?:,\s*|\be\s+)(?=(?:hoje|agora|atualmente)\b|(?:(?:eu|ele|ela|minha mae|meu pai)\s+)?(?:estou|esta|tenho|tem|sinto|sente|apresento|apresenta|mediu|medi|com)\b)/).filter(p => p.trim());
}

function afirmacaoLocal(texto: string, inicio: number, fim: number): boolean {
  const antes = texto.slice(0, inicio).replace(/\bnao so\b/g, 'tambem');
  const depois = texto.slice(fim);
  if (/\b(?:sem|nego|nega|negou|nunca|nao)\b/.test(antes) || /^\s*(?:ausente|negad[oa])\b/.test(depois)) return false;
  if (/\b(?:caso|se (?:eu )?(?:tiver|tenha)|hipotese|suspeita|talvez|sera que)\b/.test(antes)) return false;
  // Pergunta sobre conduta não desfaz afirmação anterior; existência incerta não ativa sinal.
  if (texto.includes('?') && !/[,;]\s*(?:o que|como|posso|devo)\b/.test(texto)) return false;
  if (/\b(?:ontem|anteontem|semana passada|mes passado|tive|teve)\b/.test(texto)) return false;
  return true;
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
    if (!/[a-z0-9]/.test(antes) && !/[a-z0-9]/.test(depois) && afirmacaoLocal(texto, i, i + alvo.length)) return true;
    from = i + 1;
  }
  return false;
}

/** A unidade explícita ou o rótulo imediato identifica a medida, nunca a faixa de um número solto. */
function temperaturas(texto: string): { acima: (limiar: number) => boolean }[] {
  const achados: { acima: (limiar: number) => boolean }[] = [];
  for (const m of texto.matchAll(/(?<![a-z0-9.,+\-−])([+\-−]?\d+(?:[.,]\d+)?)(?![a-z0-9.,])/g)) {
    const inicio = m.index!, fim = inicio + m[0].length;
    const antes = texto.slice(0, inicio), depois = texto.slice(fim);
    const celsius = /^\s*(?:°\s*c\b|celsius\b|graus(?:\s+celsius)?\b)/.test(depois);
    const rotulo = /\b(?:temperatura|febre)(?:\s+(?:atual|agora|de|e|esta|medida))*\s*:?\s*$/.test(antes);
    const outraUnidade = /^\s*(?:mg|mcg|ug|g|kg|ml|anos?|meses?|dias?|horas?|vezes|mil|mm|cm|°?\s*f\b|fahrenheit)\b/.test(depois);
    const sufixoDesconhecido = !celsius && /^\s*[a-zµ°]/.test(depois)
      && !/^\s*(?:agora|hoje|ontem|atualmente|neste|e|mas|porem)\b/.test(depois);
    if ((!celsius && !rotulo) || outraUnidade || sufixoDesconhecido || !afirmacaoLocal(texto, inicio, fim)) continue;
    const valor = m[1]!.replace(',', '.').replace('−', '-');
    const numero = Number(valor);
    // Mantém a faixa de representação legada; não transforma um sinal negativo em valor positivo.
    if (!Number.isFinite(numero) || numero < 35 || numero > 42) continue;
    const [inteiro, fracao = ''] = valor.replace(/^\+/, '').split('.');
    achados.push({ acima: limiar => {
      // Compara todas as casas decimais, sem truncar/arredondar 37,81 para 37,8.
      const grausLimiar = Math.floor(limiar / 10), decimo = String(limiar % 10);
      if (Number(inteiro) !== grausLimiar) return Number(inteiro) > grausLimiar;
      return fracao.padEnd(1, '0') > decimo.padEnd(Math.max(1, fracao.length), '0');
    } });
  }
  return achados;
}

function disparou(texto: string, sinal: SinalCanal): boolean {
  return clausulas(texto).some(clausula => {
    const afirmado = sinal.termos.some((termo) => casaTermo(clausula, termo));
    const limiar = sinal.limiarDecimosExclusivo;
    if (limiar === null) return afirmado;
    const temps = temperaturas(clausula);
    if (temps.length > 0) return temps.some(valor => valor.acima(limiar));
    return afirmado;
  });
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
export function avaliarCanalRedflags(relato: string, canal: CanalLido | null | undefined): ResultadoCanal {
  const identificada = !!canal?.rulesetId?.trim() && !!canal?.rulesetVersao?.trim() && !!canal?.fraseFinal?.trim();
  const sinais = Array.isArray(canal?.sinais) ? canal.sinais : [];
  const habilitados = identificada ? sinais.filter(sinal =>
    ['CONFERIDA_MEDICO', 'APROVADO'].includes(sinal.status) && !!sinal.id?.trim() && !!sinal.orientacao?.trim()
    && !!sinal.termo?.trim() && Array.isArray(sinal.termos) && sinal.termos.length > 0
    && sinal.termos.every((t: unknown) => typeof t === 'string' && !!t.trim())
    && (sinal.limiarDecimosExclusivo === null || Number.isSafeInteger(sinal.limiarDecimosExclusivo))) : [];
  const cobertura = habilitados.length === 0 ? 'INDISPONIVEL' : habilitados.length !== sinais.length ? 'PARCIAL' : 'CONFERIDA';
  const texto = dobrar(relato);
  const respostas = habilitados
    .filter((sinal) => disparou(texto, sinal))
    .map((sinal) => respostaDe(sinal, canal!.fraseFinal))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    estado: respostas.length > 0 ? "ALERTA" : cobertura === 'INDISPONIVEL' ? 'PENDENTE' : "SEM_ALERTA",
    respostas,
    alertaMedico: respostas.length > 0,
    bloqueiaSalvar: false,
    rulesetVersao: canal?.rulesetVersao ?? '',
    cobertura,
    pendencias: cobertura === 'CONFERIDA' ? [] : ['COBERTURA_PENDENTE: sinais sem curadoria ou regras indisponíveis não foram avaliados.'],
  };
}
