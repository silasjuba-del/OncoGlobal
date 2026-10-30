import type { ClinicalFact } from "./tipos.js";

type Qualificadores = NonNullable<ClinicalFact["qualificadores"]>;
const PARENTE = "(?:mãe|pai|irmão|irmã|filho|filha|cônjuge|espos[oa]|avô|avó|familiar|acompanhante)";
const FIM_TOKEN = "(?=$|[^\\p{L}\\p{N}_])";
const TERCEIRO = new RegExp(`(?:^|[^\\p{L}\\p{N}_])${PARENTE}${FIM_TOKEN}`, "iu");
const PACIENTE = /\b(?:paciente|eu|meu|minha|meus|minhas)\b/iu;
const RELATO_TERCEIRO = new RegExp(
  `\\b(?:relata|refere|informa|conta)\\s+que\\s+(?:(?:a|o|sua|seu)\\s+)?${PARENTE}${FIM_TOKEN}`, "iu",
);
const HIPOTESE = /\b(?:investiga[çc][ãa]o de|rastreio(?: de)?|HD de|não se pode excluir|sugestiv[oa]s?|compat[ií]ve(?:l|is)(?:\s+com)?|prov[aá]vel(?:mente)?|poss[ií]ve(?:l|is)(?:mente)?|suspeit[oa]s?|hip[oó]tese)\b/iu;
const NEGACAO = /\b(?:não\s+(?:há|observamos|apresenta|refere|relata|tem)|nega|negou|negativo para|sem\s+(?:dor|náusea|dormência|formigamento|sinais de|evidência(?: de)?|les(?:ão|ões)|nódul(?:o|os)|foc(?:o|os)|neoplasia|carcinoma|adenocarcinoma|tumor|metástase|expressão|amplificação|HER2|RE|RP|Ki-67|PD-L1))(?=$|[^\p{L}\p{N}_])/iu;
// Exclusão clínica exige objeto clínico; afastamento laboral não nega doença.
const OBJETO_CLINICO = "(?:tumor|neoplasia|carcinoma|adenocarcinoma|metástase|doença|diagnóstico|hipótese|lesão|lesões|dor|náusea)";
const EXCLUSAO_CLINICA = new RegExp(`(?:\\b(?:descartad[oa]s?|afastad[oa]s?|exclui-se|livre de)\\s+(?:(?:o|a|os|as)\\s+)?${OBJETO_CLINICO}\\b|\\b${OBJETO_CLINICO}\\s+(?:foi\\s+)?(?:descartad[oa]|afastad[oa])\\b)`, "iu");
const EXCLUSAO_INCERTA = /\bn[ãa]o\b[^,;.!?]*\b(?:livre de|descartar|descartad[oa]s?|afastar|afastad[oa]s?|excluir|exclu[ií]d[oa]s?)\b/iu;
const NEGADOR = /(?:^|[^\p{L}\p{N}_])(?:n[ãa]o|sem|aus[eê]ncia|ausente)(?=$|[^\p{L}\p{N}_])/iu;
// O mesmo vocabulário delimita predicados e qualifica o tempo; reconhecer um
// verbo na coordenação sem reconhecer seu tempo não pode herdar o tempo anterior.
const VERBOS_PASSADO = "(?:tinha|teve|tivera|havia|apresentou|apresentava|apresentara|relatou|relatava|referiu|referia|informou|informava|sentiu|sentia|negou)";
const VERBOS_PRESENTE = "(?:há|existe|apresenta|relata|refere|informa|tem|sente|nega)";
const VERBOS_FUTURO = "(?:terá|apresentará|receberá|vai\\s+(?:ter|apresentar|receber|fazer))";
const FUTURO = new RegExp(`\\b(?:futuro|futura|futuramente|amanhã|${VERBOS_FUTURO}|programad[oa]\\s+para)${FIM_TOKEN}`, "iu");
const HISTORICO = new RegExp(`\\b(?:${VERBOS_PASSADO}|ontem|anteontem|histórico|histórica|antecedente|anteriormente|no passado)${FIM_TOKEN}`, "iu");
const ATUAL = new RegExp(`\\b(?:atual(?:mente)?|hoje|agora|${VERBOS_PRESENTE})${FIM_TOKEN}`, "iu");
const SINTOMA = /\b(?:dormência|formigamento|náusea|dor)\b/giu;

// Fecha somente complementos de companhia seguidos de predicado da oração
// principal. "filha que relata" e "filha e ela relata" não são removidos.
const COMPANHIA = new RegExp(
  `,?\\s*acompanhad[oa]\\s+(?:da|do|de|por|pela|pelo)\\s+(?:(?:sua|seu|a|o)\\s+)?${PARENTE}\\s*,?\\s*(?=(?:(?:e|mas)\\s+)?(?:relata|refere|apresenta|informa)\\b)`, "giu",
);
const SUJEITO = `(?:(?:(?:a|o|sua|seu)\\s+)?(?:paciente|eu|${PARENTE})(?:\\s+d[ao]\\s+paciente)?\\s+)?`;
const PREDICADO = `(?:${VERBOS_PASSADO}|${VERBOS_PRESENTE}|${VERBOS_FUTURO}|com|sem|n[ãa]o|aus[eê]ncia|ausente)`;
// Uma lista ("nega dor, náusea e formigamento") não abre outro escopo.
const COORDENACAO = new RegExp(
  `(?:\\s*,?\\s*(?<![\\p{L}\\p{N}_])(?:e|mas|porém|contudo)\\s+|,\\s*)(?=${SUJEITO}${PREDICADO}${FIM_TOKEN})`, "iu",
);

export interface EscopoLinguistico {
  readonly texto: string;
  readonly negated: boolean;
  readonly wordingUncertain: boolean;
  readonly qualificadores: Qualificadores;
  readonly sintomas: readonly { value: string; incerto: boolean }[];
}

/**
 * Gramática lexical limitada, dentro de uma sentença/cláusula documental.
 * Só herda sujeito/tempo já declarados; negação pertence ao predicado local.
 * A fonte original deve ser conservada pelo chamador como rawEvidence.
 */
export function analisarEscopos(texto: string): readonly EscopoLinguistico[] {
  const lexical = texto.replace(COMPANHIA, (complemento: string, offset: number) => {
    const antes = texto.slice(0, offset);
    return PACIENTE.test(antes) || TERCEIRO.test(antes) ? " " : complemento;
  });
  const partes = lexical.split(COORDENACAO).map(p => p.trim()).filter(Boolean);
  let sujeito: Qualificadores["sujeito"] = "NAO_DETERMINADO";
  let tempo: Qualificadores["temporalidade"] = "NAO_DETERMINADA";
  let contextoIncerto = false;
  // Uma hipótese introdutória governa também os predicados coordenados.
  const hipoteseInicial = HIPOTESE.test(partes[0] ?? "");
  const escopos = partes.map(parte => {
    const negated = NEGACAO.test(parte) || (EXCLUSAO_CLINICA.test(parte) && !EXCLUSAO_INCERTA.test(parte));
    const terceiro = TERCEIRO.test(parte);
    const paciente = !terceiro && PACIENTE.test(parte);
    if (terceiro || paciente) {
      const novoSujeito = terceiro ? "TERCEIRO" : "PACIENTE";
      if (novoSujeito !== sujeito) tempo = "NAO_DETERMINADA";
      sujeito = novoSujeito;
      contextoIncerto = false;
    }
    // Sem novo sujeito explícito, a coordenação conserva o relato subordinado
    // ou o vínculo ambíguo de companhia que originou o contexto.
    contextoIncerto ||= RELATO_TERCEIRO.test(parte) || /\bacompanhad[oa]\b/iu.test(parte);
    tempo = FUTURO.test(parte) ? "FUTURA" : HISTORICO.test(parte) ? "HISTORICA"
      : ATUAL.test(parte) ? "ATUAL" : tempo;
    const wordingUncertain = (!negated && NEGADOR.test(parte))
      || hipoteseInicial || HIPOTESE.test(parte) || parte.includes("?") || contextoIncerto;
    const qualificadores: Qualificadores = {
      polaridade: negated ? "NEGADA" : wordingUncertain ? "NAO_DETERMINADA" : "AFIRMADA",
      sujeito, temporalidade: tempo,
    };
    const termos = [...new Set([...parte.matchAll(SINTOMA)].map(m => m[0].toLocaleLowerCase("pt-BR")))];
    return { texto: parte, negated, wordingUncertain, qualificadores, termos };
  });
  return escopos.map(escopo => ({
    ...escopo,
    sintomas: escopo.negated ? [] : partes.length === 1
      ? escopo.termos.length ? [{ value: escopo.texto, incerto: escopo.wordingUncertain }] : []
      : escopo.termos.map(termo => ({
        value: termo,
        incerto: escopo.wordingUncertain || escopos.some(outro =>
          outro !== escopo && outro.termos.includes(termo)
          && outro.qualificadores.sujeito === escopo.qualificadores.sujeito
          && (outro.negated || outro.wordingUncertain)),
      })),
  }));
}
