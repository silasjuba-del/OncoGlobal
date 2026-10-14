// G-02b · Detector de PHI independente do dicionário do paciente. Puro, sem I/O, fail-closed.
// O dicionário (desidentificar) só cobre o que é conhecido localmente; este detector barra categorias
// de identificador que podem chegar sem estar no dicionário (endereço, CEP, registros, nomes rotulados,
// datas de evento pessoal, idade ≥ 90, URL/IP). Achado aqui = texto NÃO sai; não há tentativa de mascarar.

export type CategoriaPhiEstrutural =
  | "ENDERECO" | "CEP" | "IDENTIFICADOR_ROTULADO" | "SEQUENCIA_NUMERICA_LONGA" | "RG"
  | "NOME_ROTULADO" | "DATA_EVENTO_PESSOAL" | "IDADE_90_MAIS" | "URL_OU_IP" | "REGISTRO_PROFISSIONAL";

const DATA = String.raw`\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}`;
const PADROES: readonly (readonly [CategoriaPhiEstrutural, RegExp])[] = [
  ["ENDERECO", /\b(?:rua|avenida|av\.|travessa|alameda|rodovia|estrada|pra[çc]a|bairro|condom[íi]nio|apartamento|apto\.?|endere[çc]o|resid(?:e|ente)\s+(?:em|na|no)|mora\s+(?:em|na|no)|domic[íi]lio)\s*:?\s*[\p{L}\d]/iu],
  ["CEP", /\b\d{5}-\d{3}\b|\bCEP\s*:?\s*\d/i],
  ["IDENTIFICADOR_ROTULADO", /\b(?:RG|CPF|CNS|CNH|cart[ãa]o\s+(?:SUS|nacional)|prontu[áa]rio|matr[íi]cula|carteirinha|passaporte|registro\s+(?:hospitalar|geral)|atendimento|SAME|NIS|PIS|t[íi]tulo\s+de\s+eleitor)\s*(?:n[º°o.]*|#)?\s*[:.-]?\s*\d/iu],
  ["REGISTRO_PROFISSIONAL", /\b(?:CRM|COREN|CRF|CRO)\s*[-/:]?\s*(?:[A-Z]{2}\s*[-/:]?\s*)?\d/],
  ["RG", /\b\d{1,2}\.\d{3}\.\d{3}-?[\dxX]\b/],
  ["SEQUENCIA_NUMERICA_LONGA", /(?<![\d.,])\d{7,}(?![\d.,]*\d)/],
  // Rótulo em qualquer caixa; o valor precisa começar com maiúscula + minúscula (nome próprio).
  ["NOME_ROTULADO", /\b(?:[Pp]aciente|PACIENTE|[Nn]ome(?:\s+completo)?|NOME|[Mm][ãa]e|M[ÃA]E|[Pp]ai|PAI|[Rr]espons[áa]vel|RESPONS[ÁA]VEL|[Aa]companhante|ACOMPANHANTE|[Cc][ôo]njuge|[Ee]spos[oa]|[Ff]ilh[oa]|[Dd]eclarante|[Cc]ontato)\s*:\s*\p{Lu}\p{Ll}/u],
  ["NOME_ROTULADO", /\b(?:Sr|Sra|Srta)\.?\s+\p{Lu}\p{Ll}/u],
  ["DATA_EVENTO_PESSOAL", new RegExp(String.raw`\b(?:nascid[oa]|nascimento|DN|admiss[ãa]o|admitid[oa]|interna[çc][ãa]o|internad[oa]|alta\s+(?:hospitalar|em)|[óo]bito|faleci(?:d[oa]|mento)|casament[oa]|resid[êe]ncia)\b[^.\n]{0,24}?${DATA}`, "iu")],
  ["IDADE_90_MAIS", /\b(?:9\d|1[0-4]\d)\s*(?:anos|a\b)/i],
  ["URL_OU_IP", /\bhttps?:\/\/|\bwww\.|\b\d{1,3}(?:\.\d{1,3}){3}\b/i],
];

/** Categorias de PHI encontradas no texto (já desidentificado). Vazio não prova ausência; só libera este filtro. */
export function detectarPhiEstrutural(texto: string): CategoriaPhiEstrutural[] {
  // Tokens de desidentificação (⟨NOME_1⟩) não são PHI; removidos para não disparar rótulos vazios.
  const limpo = texto.replace(/⟨[A-Z_]+_\d+⟩/g, " ");
  return [...new Set(PADROES.filter(([, re]) => re.test(limpo)).map(([c]) => c))];
}
