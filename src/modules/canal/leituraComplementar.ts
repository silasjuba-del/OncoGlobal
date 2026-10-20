import { LeituraComplementarCanal, type MencaoClinicaCanal } from "../../contracts/f2/reconciliacaoCanal.js";
import { sugerirGrauCtcae, type EntradaCriterio } from "../../rules/ctcaeClinico.js";

export const normalizarCanal = (s: string): string => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

/** Marcadores do transporte/corpo não autorizam converter citações em relato atual. */
export function separarCitacaoCanal(texto: string): { relato: string; citacao: string } {
  let relato = "", citacao = "", blocoEncaminhado = false;
  const branco = (s: string) => s.replace(/[^\r\n]/g, " ");
  for (const linha of texto.split(/(?<=\n)/)) {
    const retomada = /\b(?:relato atual|resposta atual|retomando|fim da mensagem encaminhada)\s*:/i.exec(linha);
    const cabecalho = /\bmensagem (?:(?:encaminhada|original)(?: do ciclo anterior)?|anterior)\s*:/i.exec(linha);
    if (retomada && (blocoEncaminhado || (cabecalho && cabecalho.index < retomada.index))) {
      relato += branco(linha.slice(0, retomada.index)) + linha.slice(retomada.index);
      citacao += linha.slice(0, retomada.index) + branco(linha.slice(retomada.index));
      blocoEncaminhado = false;
    } else if (blocoEncaminhado || /^\s*>/.test(linha)) {
      relato += branco(linha); citacao += linha;
    } else if (cabecalho) {
      relato += linha.slice(0, cabecalho.index) + branco(linha.slice(cabecalho.index));
      citacao += branco(linha.slice(0, cabecalho.index)) + linha.slice(cabecalho.index);
      blocoEncaminhado = true;
    } else { relato += linha; citacao += branco(linha); }
  }
  return { relato, citacao };
}

function prefixoDaFrase(texto: string, indice: number): string {
  return texto.slice(0, indice).split(/(?<!\d)\.|\.(?!\d)|[!?;\n]/).at(-1) ?? "";
}

function fraseEm(texto: string, indice: number): string {
  let inicio = 0;
  for (const m of texto.matchAll(/(?<!\d)\.|\.(?!\d)|[!?;\n]/g)) {
    if (m.index! >= indice) return texto.slice(inicio, m.index);
    inicio = m.index! + m[0].length;
  }
  return texto.slice(inicio);
}

function negadoAntes(texto: string, indice: number): boolean {
  const antes = texto.slice(Math.max(0, indice - 70), indice);
  return /\b(?:nao|n|nem)(?:\s+(?:tive|tenho|teve|tem|houve|foram|evacuei|evacuou|estou|uso|tomo|tomei|sinto|fico))?\s*$/.test(antes)
    || /\b(?:sem|nego|nega)\s*$/.test(antes);
}

const NUMEROS: Record<string, number> = { zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4,
  cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14,
  quatorze: 14, quinze: 15, dezesseis: 16, dezassete: 17, dezessete: 17, dezoito: 18, dezenove: 19,
  vinte: 20, trinta: 30, quarenta: 40 };
const NUMERO = "(?:\\d+(?:[.,]\\d+)?|(?:quarenta|trinta|vinte)(?: e (?:um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove))?(?: e meio| virgula (?:zero|um|dois|tres|quatro|cinco|seis|sete|oito|nove))?|zero|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|catorze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove)";
function numero(s: string): number | null {
  if (/^[+-]?\d+(?:[.,]\d+)?$/.test(s)) return Number(s.replace(",", "."));
  if (s.includes(" virgula ")) { const [base, dec] = s.split(" virgula "); const valor = numero(base!); return valor !== null && NUMEROS[dec!] !== undefined ? valor + NUMEROS[dec!]! / 10 : null; }
  const meio = s.endsWith(" e meio");
  const partes = s.replace(/ e meio$/, "").split(" e ");
  if (partes.some(p => NUMEROS[p] === undefined)) return null;
  return partes.reduce((total, p) => total + NUMEROS[p]!, 0) + (meio ? 0.5 : 0);
}

type Temperatura = LeituraComplementarCanal["temperaturas"][number];
export function lerTemperaturasCanal(texto: string, origem: "RELATO" | "CITACAO" = "RELATO"): Temperatura[] {
  const norm = normalizarCanal(texto);
  const isolado = new RegExp(`^\\s*${NUMERO}(?:\\s*°)?\\s*[.!]?\\s*$`).test(norm);
  const serie = /^\s*\d+[.,]\d+\s+e\s+\d+[.,]\d+/.test(norm);
  const re = new RegExp(`(?<![a-z0-9:.,])([+-]?${NUMERO})(\\s*(?:°\\s*[cf]?|graus?(?:\\s+(?:celsius|fahrenheit)| e meio)?|celsius|fahrenheit|[cf]\\b))?(?![a-z0-9])`, "g");
  const saida: Temperatura[] = [];
  const concatenado = /\d+[.,]\d+°(?:c|f)?\s*\d+[.,]\d+°|\d+[.,]\d+[.,]\d+/i.test(norm);
  if (concatenado) return [{ texto: texto.slice(0, 1000), valor: null, unidade: null, celsiusDecimos: null,
    estado: "VALOR_AMBIGUO", origem, temporalidade: origem === "CITACAO" ? "PASSADO" : "NAO_INFORMADO", intervaloRelativo: null }];
  for (const m of norm.matchAll(re)) {
    const indice = m.index!;
    const fim = indice + m[0].length;
    const depois = norm.slice(fim, fim + 35);
    if (/^\s*(?:anos?|kg|mg|mcg|ml|dias?|mil|horas?|h\b|min|vezes|evacuacoes|comprimidos?)\b/.test(depois)) continue;
    const antes = norm.slice(Math.max(0, indice - 70), indice);
    const contexto = /\b(?:temperatura|tempratura|termometro|febre|febri|febril|medi)(?:\s+(?:de|em|esta|deu|foi|marcou))?\s*[:=]?\s*$/.test(antes);
    const continuaSerie = saida.length > 0 && /\b(?:e|depois)\s*$/.test(antes);
    if (!m[2] && !contexto && !isolado && !serie && !continuaSerie) continue;
    let valor = numero(m[1]!);
    const numeroInvalido = valor === null || !Number.isFinite(valor);
    if (numeroInvalido) valor = null;
    const unidadeTexto = m[2]?.trim() ?? "";
    // "graus" mantém a convenção de Celsius já aceita no contrato anterior.
    const unidade = /f|fahrenheit/.test(unidadeTexto) ? "F" : /c|grau/.test(unidadeTexto) ? "C" : null;
    if (valor !== null && / e meio$/.test(unidadeTexto)) valor += 0.5;
    const candidato = valor === null ? 0 : unidade === "F" ? Math.round((valor - 32) * 50 / 9) : Math.round(valor * 10);
    let estado: Temperatura["estado"] = unidade ? "NORMALIZADA" : "UNIDADE_A_CONFIRMAR";
    // Limites de representação legados (350..430), não limiares de alarme.
    if (unidade && (candidato < 350 || candidato > 430)) estado = "FORA_FAIXA_SUPORTADA";
    const cabeComoC = valor !== null && valor * 10 >= 350 && valor * 10 <= 430;
    const cabeComoF = valor !== null && (valor - 32) * 50 / 9 >= 350 && (valor - 32) * 50 / 9 <= 430;
    if (numeroInvalido || (!unidade && !cabeComoC && !cabeComoF)) estado = "VALOR_AMBIGUO";
    const intervalo = /^\s*((?:\d+|duas?|tres|quatro)\s+horas?\s+depois)/.exec(depois)?.[1] ?? null;
    const frase = fraseEm(norm, indice);
    const marcos = [...prefixoDaFrase(norm, indice).matchAll(/\b(?:ontem|anteontem|hoje|hj|agora|atualmente|ciclo anterior|se eu tiver|caso tenha)\b/g)];
    const marco = marcos.at(-1)?.[0] ?? /\b(?:ontem|anteontem|hoje|hj|agora|atualmente|ciclo anterior|se eu tiver|caso tenha)\b/.exec(frase)?.[0];
    const temporalidade = origem === "CITACAO" ? "PASSADO"
      : marco && /ontem|anteontem|ciclo anterior/.test(marco) ? "PASSADO"
        : marco && /se eu tiver|caso tenha/.test(marco) ? "FUTURO_DUVIDA"
          : marco ? "ATUAL" : "NAO_INFORMADO";
    saida.push({ texto: texto.slice(indice, fim).trim(), valor, unidade,
      celsiusDecimos: estado === "NORMALIZADA" ? candidato : null, estado, origem, temporalidade, intervaloRelativo: intervalo });
  }
  return saida.slice(0, 50);
}

/** Quantidades são derivadas do relato; cortes e textos de graduação vêm da regra existente. */
export function lerComplementoCanal(textoOriginal: string, mencoes: readonly MencaoClinicaCanal[], corpusCtcae?: unknown): LeituraComplementarCanal {
  const { relato, citacao } = separarCitacaoCanal(textoOriginal);
  const norm = normalizarCanal(relato);
  const terceiro = /\b(?:(?:meu|minha)\s+(?:pai|mae|esposa|esposo|marido|irma|irmao|filha|filho|familiar)|vizinha|vizinho)\b/.test(norm);
  const primeira = /\b(?:eu|estou|to|tenho|tive|evacuei|sinto|meu habitual|meu normal)\b/.test(norm);
  const sujeitoRelato = terceiro && !primeira ? "TERCEIRO_NAO_IDENTIFICADO"
    : primeira && !terceiro ? "PRIMEIRA_PESSOA_NAO_IDENTIFICADA" : "MULTIPLOS_OU_INDEFINIDO";
  const temperaturas = [...lerTemperaturasCanal(relato), ...lerTemperaturasCanal(citacao, "CITACAO")].slice(0, 50);
  const pendencias = new Set<string>(["AUTORIA_NAO_VERIFICADA"]);
  for (const t of temperaturas) {
    if (t.estado === "UNIDADE_A_CONFIRMAR") pendencias.add("TEMPERATURA_UNIDADE");
    if (t.estado === "VALOR_AMBIGUO") pendencias.add("TEMPERATURA_VALOR_AMBIGUO");
    if (t.estado === "FORA_FAIXA_SUPORTADA") pendencias.add("TEMPERATURA_FORA_FAIXA_SUPORTADA");
  }
  if (/\d+[.,]\d+[.,]\d+/.test(norm)) pendencias.add("TEMPERATURA_VALOR_AMBIGUO");
  const contextos: LeituraComplementarCanal["contextos"] = [];
  const corticoide = /\b(?:dexametasona|dexametazona|dexa|corticoide)\b/.exec(norm);
  if (corticoide && !negadoAntes(norm, corticoide.index)) contextos.push("CORTICOIDE_DECLARADO");
  if (/\b(?:tont[ao]|tontura)\b.{0,30}\b(?:levanto|levantar)\b/.test(norm)) contextos.push("TONTURA_POSTURAL_DECLARADA");
  if (/\b(?:nao|n)\s+(?:consigo|consegue)\s+(?:comer|come)\b/.test(norm)) contextos.push("DIFICULDADE_ALIMENTAR_DECLARADA");

  const mencaoOstomia = /\b(?:ileostomia|colostomia|estomia|ostomia)\b/.exec(norm);
  const ostomia = !!mencaoOstomia && !negadoAntes(norm, mencaoOstomia.index);
  const suspeita = ostomia || /\b(?:banheiro|evacuei|evacuacoes|diarreia|diarrea|soltando agua|fezes liquidas)\b/.test(norm);
  let diarreia: LeituraComplementarCanal["diarreia"] = null;
  if (suspeita) {
    const basais = [...norm.matchAll(new RegExp(`\\b(?:habitual|normal)\\s+(?:(?:e|era|sao|eram)\\s+)?(${NUMERO})\\s+evacuacoes\\s+(?:por|ao)\\s+dia\\b`, "g"))];
    const contagens = [...norm.matchAll(new RegExp(`\\bevacu(?:ei|ou)\\s+(${NUMERO})\\s+vezes\\b|\\b(${NUMERO})\\s+evacuacoes\\b`, "g"))]
      .filter(m => !basais.some(b => m.index! >= b.index! && m.index! < b.index! + b[0].length));
    const escolhida = contagens.length === 1 ? contagens[0] : undefined;
    const contextoContagem = escolhida ? fraseEm(norm, escolhida.index!) : "";
    const janela = /\b(?:hoje|hj|por dia|ao dia|nas ultimas 24 horas)\b/.test(contextoContagem)
      && !/\b(?:semana|mes|dias|total de)\b/.test(contextoContagem) ? "DIA" : "NAO_INFORMADA";
    const comparadorAntes = escolhida ? norm.slice(Math.max(0, escolhida.index! - 30), escolhida.index!) : "";
    const comparadorDesconhecido = /(?:menos de|ate|no maximo|cerca de|entre|aproximadamente|[<≤≥+\-]|<=|>=)\s*$/.test(comparadorAntes);
    const quantidadeNegada = escolhida ? negadoAntes(norm, escolhida.index!) || /\b(?:nao|n|nem|sem|nego|nega)\b/.test(prefixoDaFrase(norm, escolhida.index!)) : false;
    const delta = escolhida && /\bacima\s+(?:do\s+)?(?:meu\s+)?(?:normal|basal)\b/.test(contextoContagem);
    const valorEscolhido = escolhida ? numero(escolhida[1] ?? escolhida[2]!) : null;
    const valorBasal = basais.length === 1 ? numero(basais[0]![1]!) : null;
    const valido = (n: number | null): n is number => n !== null && Number.isSafeInteger(n) && n >= 0;
    const atual = !ostomia && !delta && !quantidadeNegada && !comparadorDesconhecido && valido(valorEscolhido) ? valorEscolhido : null;
    const basal = !ostomia && valido(valorBasal) ? valorBasal : null;
    const aumento = ostomia || quantidadeNegada || comparadorDesconhecido ? null
      : delta && valido(valorEscolhido) ? valorEscolhido : atual !== null && basal !== null && atual >= basal ? atual - basal : null;
    const operador = aumento === null ? null : /(?:mais de|>)\s*$/.test(comparadorAntes) ? "MAIOR_QUE" : "IGUAL";
    if (comparadorDesconhecido || quantidadeNegada || (valorEscolhido !== null && !valido(valorEscolhido))) pendencias.add("QUANTIDADE_A_ESCLARECER");
    const afirmada = mencoes.some(m => m.termo === "diarreia" && m.polaridade === "AFIRMADO" && m.temporalidade !== "PASSADO" && m.temporalidade !== "FUTURO_DUVIDA");
    const variosSujeitos = terceiro || /\b(?:sou cuidador|sou a cuidadora)\b/.test(norm);
    const temporalidadeAmbigua = /\b(?:ontem|anteontem|ciclo anterior|se eu tiver|se tiver|caso tenha|se eu evacuar)\b/.test(norm);
    const quantidadeConflitante = contagens.length > 1 || basais.length > 1 || /\bcorrigindo\b/.test(norm);
    diarreia = { atual, basal, aumento, operador, janela, ostomia, trechoOriginal: relato,
      grauCandidato: null, confirmadoPeloMedico: false, rulesetVersao: null, ctcaeVersao: null, criterioLiteral: null, fonteTrecho: null };
    if (ostomia) pendencias.add("OSTOMIA_REQUER_AVALIACAO");
    if (!afirmada || /\bbanheiro\b/.test(norm)) pendencias.add("QUANTIDADE_A_ESCLARECER");
    if (aumento === null) pendencias.add("DIARREIA_BASAL");
    if (janela !== "DIA") pendencias.add("DIARREIA_JANELA");
    if (variosSujeitos) pendencias.add("SUJEITO_A_CONFIRMAR");
    if (afirmada && contextos.includes("TONTURA_POSTURAL_DECLARADA")) pendencias.add("AVALIACAO_MEDICA_HIDRATACAO");
    if (temporalidadeAmbigua) pendencias.add("DIARREIA_TEMPORALIDADE");
    if (quantidadeConflitante) pendencias.add("DIARREIA_QUANTIDADES_CONFLITANTES");
    if (afirmada && !ostomia && !variosSujeitos && !temporalidadeAmbigua && !quantidadeConflitante && aumento !== null && Number.isInteger(aumento) && janela === "DIA") {
      try {
        // Para contagem inteira >N, N+1 é o menor aumento possível, não uma contagem observada.
        const quantidade = operador === "MAIOR_QUE" ? aumento + 1 : aumento;
        const criterio: EntradaCriterio = { tipo: "quantidade", termo: "diarreia", inicio: 0, fim: relato.length, texto: relato,
          quantidade, periodoDias: 1, leituraQuantidade: "POR_DIA", sobreBasal: true, valorLaboratorio: null,
          analito: null, tempDecimos: null, duracaoHoras: null, intensidade: null, ambulatorial: false };
        const r = sugerirGrauCtcae([criterio], corpusCtcae)[0];
        const superior = operador === "MAIOR_QUE" ? sugerirGrauCtcae([{ ...criterio, quantidade: Number.MAX_SAFE_INTEGER }], corpusCtcae)[0] : r;
        diarreia.grauCandidato = r?.grauSugerido === superior?.grauSugerido ? r?.grauSugerido ?? null : null;
        if (r?.grauSugerido !== superior?.grauSugerido) pendencias.add("DIARREIA_INTERVALO_CRUZA_GRAUS");
        diarreia.rulesetVersao = r?.rulesetVersao ?? null;
        const versao = (corpusCtcae as { graus?: { versaoCtcae?: unknown } } | null)?.graus?.versaoCtcae;
        diarreia.ctcaeVersao = typeof versao === "string" ? versao : null;
        diarreia.criterioLiteral = diarreia.grauCandidato !== null ? r?.criteriosUsados[0]?.criterioLiteral ?? null : null;
        diarreia.fonteTrecho = diarreia.grauCandidato !== null ? r?.criteriosUsados[0]?.fonteTrecho ?? null : null;
      } catch { /* Regra ausente/inválida é pendência, nunca grau zero. */ }
    }
    if (diarreia.grauCandidato === null) pendencias.add("DIARREIA_GRADUACAO_PENDENTE");
  }
  return LeituraComplementarCanal.parse({ versao: "F2-LEITURA-2", autoriaVerificada: false, sujeitoRelato, temperaturas, diarreia, contextos, pendencias: [...pendencias] });
}
