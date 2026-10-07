// FUGU-11b · Tabela de dados do Biomarker Requirement Engine (spec §9; D-W9-33).
// DADOS, não lógica e não LLM. Curadoria do Dr. Silas; conteúdo inicial só para
// CPNPC adenocarcinoma IV e mama. Demais tumores ficam `[VERIFICAR]` em PEDIDOS.
// `resolveJsonModule` está desligado e `corpus/` está fora da faixa do FUGU:
// a tabela vive como módulo de dados e migra para o corpus quando houver consumidor (PEDIDO).

/** Condição de exigência: sempre exigido ou só quando clinicamente indicado. */
export type IndicacaoBiomarcador = "SEMPRE" | "QUANDO_INDICADO";

export interface RequisitoBiomarcador {
  readonly marcador: string;
  readonly indicacao: IndicacaoBiomarcador;
}

export interface GrupoRequisitos {
  /** Sítio canônico do tumor (ver `orgaoCanonico`). */
  readonly tumor: string;
  /** null = qualquer histologia. */
  readonly histologia: string | null;
  /** null = qualquer estágio. */
  readonly estadio: string | null;
  readonly fonte: string;
  readonly biomarcadores: readonly RequisitoBiomarcador[];
}

const SEMPRE = "SEMPRE" as const;
const QUANDO_INDICADO = "QUANDO_INDICADO" as const;
const FONTE_SPEC = "spec PIPELINE-EXTRACAO-MULTIMODAL §9 (D-W9-33) — curadoria do Dr. Silas";

export const REQUISITOS_BIOMARCADORES: readonly GrupoRequisitos[] = [
  {
    tumor: "pulmao",
    histologia: "adenocarcinoma",
    estadio: "IV",
    fonte: FONTE_SPEC,
    biomarcadores: [
      { marcador: "PD-L1", indicacao: SEMPRE },
      { marcador: "EGFR", indicacao: SEMPRE },
      { marcador: "ALK", indicacao: SEMPRE },
      { marcador: "ROS1", indicacao: SEMPRE },
      { marcador: "BRAF", indicacao: SEMPRE },
      { marcador: "KRAS G12C", indicacao: SEMPRE },
      { marcador: "MET éxon 14", indicacao: SEMPRE },
      { marcador: "RET", indicacao: SEMPRE },
      { marcador: "NTRK", indicacao: SEMPRE },
      { marcador: "HER2", indicacao: SEMPRE },
    ],
  },
  {
    tumor: "mama",
    histologia: null,
    estadio: null,
    fonte: FONTE_SPEC,
    biomarcadores: [
      { marcador: "RE", indicacao: SEMPRE },
      { marcador: "RP", indicacao: SEMPRE },
      { marcador: "HER2", indicacao: SEMPRE },
      { marcador: "Ki-67", indicacao: SEMPRE },
      { marcador: "BRCA/PALB2", indicacao: QUANDO_INDICADO },
    ],
  },
];

/** Tumores sem tabela curada: exigem `[VERIFICAR]` em PEDIDOS, nunca regra inventada. */
export const TUMORES_SEM_TABELA: readonly string[] = [
  "colon", "reto", "estomago", "esofago", "pancreas", "figado", "prostata", "bexiga",
  "rim", "utero", "ovario", "cabeca-e-pescoco", "orofaringe", "hemisferio cerebral",
];
