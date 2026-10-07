// Tabelas clínicas dos gates como DADOS (curadoria do Dr. Silas). Nenhuma lógica aqui.
// Chaves sem acento e em minúsculo. Alterar uma linha = decisão médica nova (registrar em docs/DECISOES.md).

/** Valores que significam "não informado" em qualquer fonte (comparados sem acento/caixa). */
export const VALORES_AUSENTES: readonly string[] = ["", "nao_informado", "nao informado", "ni", "desconhecido", "nao_verificado", "n/d", "nd", "-"];

/** D-W9-05 · órgãos com lateralidade obrigatória (G-07) e valores válidos de cada um. */
const DE = ["DIREITO", "ESQUERDO"] as const;
export const LATERALIDADE_POR_ORGAO: Readonly<Record<string, readonly string[]>> = {
  mama: DE,
  colon: ["DIREITO", "TRANSVERSO", "ESQUERDO"],
  pulmao: DE,
  membros: DE,
  "adenopatia cervical": DE,
  "cavidade nasal": DE,
  "cavidade oral": DE,
  olhos: DE,
  "hemisferio cerebral": DE,
};

/** D-W9-05 · sinônimos de entrada → valor canônico. */
export const LATERALIDADE_SINONIMOS: Readonly<Record<string, string>> = {
  direito: "DIREITO", direita: "DIREITO", d: "DIREITO", dir: "DIREITO",
  esquerdo: "ESQUERDO", esquerda: "ESQUERDO", e: "ESQUERDO", esq: "ESQUERDO",
  transverso: "TRANSVERSO", t: "TRANSVERSO",
};

/** Aliases de órgão → chave canônica (G-07 e G-08). */
export const ALIAS_ORGAO: Readonly<Record<string, string>> = {
  olho: "olhos", membro: "membros", hemisferio: "hemisferio cerebral", cerebro: "hemisferio cerebral",
  adenopatia: "adenopatia cervical", "linfonodo cervical": "adenopatia cervical",
  nariz: "cavidade nasal", boca: "cavidade oral",
  "colo uterino": "utero", "colo do utero": "utero", endometrio: "utero",
  vulva: "vagina e vulva", vagina: "vagina e vulva",
};

/** D-W9-06 · anatomia que só existe em um sexo cadastral (G-08). Mama fica FORA (existe nos dois). */
export const ANATOMIA_SEXO_ESPERADO: Readonly<Record<string, "F" | "M">> = {
  prostata: "M", penis: "M", testiculo: "M",
  utero: "F", ovario: "F", "vagina e vulva": "F",
};

/** D-W9-06 · anatomia fora da tabela, mas que merece conferência quando o cadastro é do outro sexo (nunca incoerência). */
export const ANATOMIA_CONFERIR_SEXO: Readonly<Record<string, "F" | "M">> = { mama: "F" };

/** D-W9-07 · specimen que NUNCA sustenta pTNM (biópsia) e o que sustenta (peça de ressecção). */
export const SPECIMEN_BIOPSIA: readonly string[] = ["NEEDLE_BIOPSY", "BIOPSY", "INCISIONAL_BIOPSY", "CORE_BIOPSY", "PUNCH_BIOPSY"];
export const SPECIMEN_RESSECCAO: readonly string[] = ["SURGICAL_RESECTION"];

/** D-W9-07 · critérios de peça de ressecção reconhecida pelo conteúdo do laudo: ≥1 destes + identificação de peça cirúrgica. */
export const CRITERIOS_PECA_RESSECCAO: readonly string[] = ["dimensoes", "peso", "margens", "linfonodos"];

/** Prefixos TNM (contrato Estadiamento): patológicos exigem ressecção. */
export const PREFIXO_PATOLOGICO: readonly string[] = ["p", "yp"];
export const PREFIXO_CLINICO: readonly string[] = ["c"];
