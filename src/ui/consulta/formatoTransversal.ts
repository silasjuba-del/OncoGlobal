// W12-F2 · helpers puros de formatação do cartão transversal (sem React, sem estado).
import { COPY_PT_BR } from "../copy/pt-BR.js";

const T = COPY_PT_BR.transversal;

export interface CampoSpec {
  readonly chave: string;
  readonly rotulo: string;
  readonly unidade?: string;
}

/** Ordem fixa do núcleo: nenhum campo some. */
export const CAMPOS_NUCLEO: readonly CampoSpec[] = [
  { chave: "histologia", rotulo: "Histologia" },
  { chave: "lateralidade", rotulo: "Lateralidade" },
  { chave: "topografia", rotulo: "Topografia" },
  { chave: "grauHistologico", rotulo: "Grau histológico" },
  { chave: "cTNM", rotulo: "cTNM" },
  { chave: "pTNM", rotulo: "pTNM" },
  { chave: "ypTNM", rotulo: "ypTNM" },
  { chave: "estadio", rotulo: "Estádio / FIGO" },
  { chave: "tamanhoMm", rotulo: "Tamanho", unidade: "mm" },
  { chave: "profundidade", rotulo: "Profundidade" },
  { chave: "linfonodos", rotulo: "Linfonodos" },
  { chave: "metastase", rotulo: "Metástase" },
  { chave: "invasaoAngiolinfatica", rotulo: "Invasão angiolinfática" },
  { chave: "invasaoPerineural", rotulo: "Invasão perineural" },
  { chave: "margem", rotulo: "Margem" },
  { chave: "necrose", rotulo: "Necrose" },
  { chave: "indiceMitotico", rotulo: "Índice mitótico" },
  { chave: "ki67Pct", rotulo: "Ki-67", unidade: "%" },
  { chave: "neoadjuvancia", rotulo: "Neoadjuvância" },
  { chave: "respostaNeoadjuvancia", rotulo: "Resposta à neoadjuvância" },
  { chave: "progressaoNaVigencia", rotulo: "Progressão na vigência" },
];

export const CAMPOS_EXTENSAO: Readonly<Record<string, readonly CampoSpec[]>> = {
  MAMA: [
    { chave: "rePct", rotulo: "Receptor de estrogênio (RE)", unidade: "%" },
    { chave: "rpPct", rotulo: "Receptor de progesterona (RP)", unidade: "%" },
    { chave: "her2", rotulo: "HER2" },
    { chave: "rcb", rotulo: "RCB" },
  ],
  PROSTATA: [
    { chave: "gleason", rotulo: "Gleason" },
    { chave: "isup", rotulo: "Grupo ISUP" },
    { chave: "psaNgMl", rotulo: "PSA", unidade: "ng/mL" },
    { chave: "fragmentosPositivos", rotulo: "Fragmentos positivos" },
  ],
  COLORRETAL: [
    { chave: "subsitio", rotulo: "Subsítio" },
    { chave: "mmr", rotulo: "MMR" },
    { chave: "msi", rotulo: "MSI" },
    { chave: "kras", rotulo: "KRAS" },
    { chave: "nras", rotulo: "NRAS" },
    { chave: "braf", rotulo: "BRAF" },
    { chave: "trg", rotulo: "TRG" },
    { chave: "budding", rotulo: "Budding" },
  ],
  PULMAO: [
    { chave: "egfr", rotulo: "EGFR" },
    { chave: "alk", rotulo: "ALK" },
    { chave: "ros1", rotulo: "ROS1" },
    { chave: "pdl1TpsPct", rotulo: "PD-L1 (TPS)", unidade: "%" },
    { chave: "krasG12c", rotulo: "KRAS G12C" },
  ],
  COLO_UTERINO: [
    { chave: "hpvP16", rotulo: "HPV / p16" },
    { chave: "invasaoEstromalMm", rotulo: "Invasão estromal", unidade: "mm" },
  ],
  GASTRICO: [
    { chave: "her2", rotulo: "HER2" },
    { chave: "mmr", rotulo: "MMR" },
    { chave: "lauren", rotulo: "Lauren" },
    { chave: "cldn18", rotulo: "CLDN18" },
    { chave: "pdl1Cps", rotulo: "PD-L1 (CPS)" },
  ],
};

export const ROTULO_TUMOR: Readonly<Record<string, string>> = {
  MAMA: "Mama",
  PROSTATA: "Próstata",
  COLORRETAL: "Colorretal",
  PULMAO: "Pulmão",
  COLO_UTERINO: "Colo uterino",
  GASTRICO: "Gástrico",
};

const ROTULO_ENUM: Readonly<Record<string, string>> = {
  LIVRE: "livre",
  COMPROMETIDA: "comprometida",
  EXIGUA: "exígua",
  PROFICIENTE: "proficiente",
  DEFICIENTE: "deficiente",
  MSS: "MSS",
  MSI_L: "MSI-L",
  MSI_H: "MSI-H",
  INTESTINAL: "intestinal",
  DIFUSO: "difuso",
  MISTO: "misto",
  INDETERMINADO: "indeterminado",
  "2+_ISH_POS": "2+ (ISH positivo)",
  "2+_ISH_NEG": "2+ (ISH negativo)",
  TRG_MANDARD: "TRG Mandard",
  TRG_RYAN: "TRG Ryan",
  TRG_BECKER: "TRG Becker",
};

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function formatarData(data: string | null): string {
  if (data === null) return T.dataDesconhecida;
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Texto do valor de um campo (forma conhecida do contrato; nunca inventa). */
export function formatarValor(valor: unknown, unidade?: string): string {
  if (typeof valor === "boolean") return valor ? T.sim : T.nao;
  if (typeof valor === "number") return unidade ? `${valor} ${unidade}` : String(valor);
  if (typeof valor === "string") return ROTULO_ENUM[valor] ?? valor;
  if (ehObjeto(valor)) {
    if (typeof valor.presente === "boolean" && Array.isArray(valor.sitios)) {
      const sitios = valor.sitios.map(String).join(", ");
      const base = valor.presente ? T.presente : T.ausente;
      return sitios ? `${base}: ${sitios}` : base;
    }
    if (typeof valor.positivos === "number" && "avaliados" in valor) {
      return typeof valor.avaliados === "number"
        ? `${valor.positivos} positivos de ${valor.avaliados} avaliados`
        : `${valor.positivos} positivos (avaliados não informado)`;
    }
    if (typeof valor.positivos === "number" && typeof valor.total === "number") {
      return `${valor.positivos} de ${valor.total}`;
    }
    if (typeof valor.primario === "number" && typeof valor.secundario === "number") {
      return `${valor.primario}+${valor.secundario}=${valor.primario + valor.secundario}`;
    }
    if (typeof valor.sistema === "string" && typeof valor.resultado === "string") {
      return `${ROTULO_ENUM[valor.sistema] ?? valor.sistema}: ${valor.resultado}`;
    }
  }
  return String(valor);
}
