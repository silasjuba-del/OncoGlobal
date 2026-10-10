// W12-F2 · Retrato TRANSVERSAL (intraconsulta) · schema anatomopatológico comum + extensões por tumor.
// D-W9-77c/78: mama, próstata, colorretal, pulmão, colo uterino (FIGO no `estadio` do núcleo, D-W9-78c), gástrico. D-W9-77c original: mama, próstata, cólon, pulmão, colo uterino, gástrico. PLN-037 (adendo OPS-006): cada campo
// mostra a ORIGEM — laudo (documento + data) · afirmado pelo encaminhador · não informado. Nada de default inventado.
import { z } from "zod";
import { DataCivil, Id } from "../base.js";

export const TumorTransversal = z.enum(["MAMA", "PROSTATA", "COLORRETAL", "PULMAO", "COLO_UTERINO", "GASTRICO"]);
export type TumorTransversal = z.infer<typeof TumorTransversal>;

/** De onde veio o valor. ENCAMINHADOR = só citado no relatório de encaminhamento, sem laudo próprio (não confirmado). */
export const OrigemCampoAP = z.object({
  tipo: z.enum(["LAUDO", "ENCAMINHADOR"]),
  documentoId: Id, // id opaco do documento (nunca nome de arquivo)
  dataDocumento: DataCivil.nullable(), // null = data desconhecida (nunca inventar)
  trecho: z.string().min(1).nullable(),
}).strict();
export type OrigemCampoAP = z.infer<typeof OrigemCampoAP>;

/**
 * Campo tri-estado. VALOR ⇒ valor + origem; NAO_INFORMADO / NAO_SE_APLICA ⇒ valor null e origem null.
 * confianca BAIXA = manuscrito/OCR duvidoso (tipologia dos kits: manuscrito nunca é dado firme).
 * CONFLITO ⇒ valor null, origem null e ≥2 candidatos (cada um com sua origem; o cartão mostra todos; ninguém elege).
 */
export const campoAP = <T extends z.ZodTypeAny>(valor: T) =>
  z.object({
    estado: z.enum(["VALOR", "CONFLITO", "NAO_INFORMADO", "NAO_SE_APLICA"]),
    valor: valor.nullable(),
    origem: OrigemCampoAP.nullable(),
    candidatos: z.array(z.object({ valor, origem: OrigemCampoAP }).strict()).default([]),
    confianca: z.enum(["NORMAL", "BAIXA"]).default("NORMAL"),
  }).strict().superRefine((c, ctx) => {
    const erro = (m: string) => ctx.addIssue({ code: "custom", message: m });
    const valor = (c as unknown as { valor: unknown }).valor;
    if (c.estado === "VALOR" && (valor === null || c.origem === null)) erro("VALOR exige valor e origem");
    if (c.estado === "CONFLITO" && (valor !== null || c.origem !== null || c.candidatos.length < 2)) erro("CONFLITO exige valor e origem null e ≥2 candidatos");
    if ((c.estado === "NAO_INFORMADO" || c.estado === "NAO_SE_APLICA") && c.confianca === "BAIXA") erro("confiança BAIXA só com VALOR ou CONFLITO");
    if ((c.estado === "NAO_INFORMADO" || c.estado === "NAO_SE_APLICA") && (valor !== null || c.origem !== null)) {
      erro(`${c.estado} exige valor e origem null`);
    }
  });

const texto = z.string().min(1);
const mm = z.number().positive(); // milímetros
const pct = z.number().min(0).max(100);
const simNao = z.boolean();

export const Linfonodos = z.object({ positivos: z.number().int().min(0), avaliados: z.number().int().min(0).nullable() })
  .strict().refine((l) => l.avaliados === null || l.positivos <= l.avaliados, "positivos > avaliados");
export const RespostaNeoadjuvancia = z.object({
  sistema: z.enum(["pCR", "RCB", "TRG_MANDARD", "TRG_RYAN", "TRG_BECKER", "OUTRO"]),
  resultado: texto, // ex.: "pCR", "RCB-II", "TRG 2"
}).strict();

/** Núcleo comum aos 6 tumores. Todos os campos sempre presentes (lacuna visível). */
export const NucleoAP = z.object({
  histologia: campoAP(texto), // adenocarcinoma, CEC, neuroendócrino, sarcomatoide…
  lateralidade: campoAP(z.enum(["DIREITA", "ESQUERDA", "BILATERAL", "LINHA_MEDIA"])), // G-07; conflito de lado é o mais frequente nos kits
  topografia: campoAP(texto), // sítio/subsítio literal do laudo (ex.: esôfago médio × distal = CONFLITO)
  grauHistologico: campoAP(texto),
  cTNM: campoAP(texto),
  pTNM: campoAP(texto),
  ypTNM: campoAP(texto),
  estadio: campoAP(texto), // grupo prognóstico (ou FIGO no colo)
  tamanhoMm: campoAP(mm),
  profundidade: campoAP(texto),
  linfonodos: campoAP(Linfonodos),
  metastase: campoAP(z.object({ presente: simNao, sitios: z.array(texto) }).strict()),
  invasaoAngiolinfatica: campoAP(simNao),
  invasaoPerineural: campoAP(simNao),
  margem: campoAP(z.enum(["LIVRE", "COMPROMETIDA", "EXIGUA"])),
  necrose: campoAP(simNao),
  indiceMitotico: campoAP(texto), // por 10 CGA / mm² — mantém o texto do laudo
  ki67Pct: campoAP(pct),
  neoadjuvancia: campoAP(texto), // esquema citado; nunca dose
  respostaNeoadjuvancia: campoAP(RespostaNeoadjuvancia),
  progressaoNaVigencia: campoAP(simNao),
}).strict();
export type NucleoAP = z.infer<typeof NucleoAP>;

const Mama = z.object({
  tumor: z.literal("MAMA"),
  rePct: campoAP(pct), rpPct: campoAP(pct),
  her2: campoAP(z.enum(["0", "0_ULTRALOW", "1+", "2+", "3+", "2+_ISH_POS", "2+_ISH_NEG"])),
  rcb: campoAP(texto),
}).strict();
const Prostata = z.object({
  tumor: z.literal("PROSTATA"),
  gleason: campoAP(z.object({ primario: z.number().int().min(1).max(5), secundario: z.number().int().min(1).max(5) }).strict()),
  isup: campoAP(z.number().int().min(1).max(5)),
  psaNgMl: campoAP(z.number().min(0)),
  fragmentosPositivos: campoAP(z.object({ positivos: z.number().int().min(0), total: z.number().int().min(1) }).strict()),
}).strict();
const Colorretal = z.object({
  tumor: z.literal("COLORRETAL"),
  subsitio: campoAP(z.enum(["COLON_DIREITO", "COLON_TRANSVERSO", "COLON_ESQUERDO", "SIGMOIDE", "RETO_ALTO", "RETO_MEDIO", "RETO_BAIXO"])), // D-W9-78a
  mmr: campoAP(z.enum(["PROFICIENTE", "DEFICIENTE"])), msi: campoAP(z.enum(["MSS", "MSI_L", "MSI_H"])),
  kras: campoAP(texto), nras: campoAP(texto), braf: campoAP(texto),
  trg: campoAP(texto), budding: campoAP(texto),
}).strict();
const Pulmao = z.object({
  tumor: z.literal("PULMAO"),
  egfr: campoAP(texto), alk: campoAP(texto), ros1: campoAP(texto),
  pdl1TpsPct: campoAP(pct), krasG12c: campoAP(simNao),
}).strict();
const ColoUterino = z.object({
  tumor: z.literal("COLO_UTERINO"),
  hpvP16: campoAP(texto), invasaoEstromalMm: campoAP(mm),
}).strict();
const Gastrico = z.object({
  tumor: z.literal("GASTRICO"),
  her2: campoAP(z.enum(["0", "1+", "2+", "3+", "2+_ISH_POS", "2+_ISH_NEG"])),
  mmr: campoAP(z.enum(["PROFICIENTE", "DEFICIENTE"])),
  lauren: campoAP(z.enum(["INTESTINAL", "DIFUSO", "MISTO", "INDETERMINADO"])),
  cldn18: campoAP(texto), pdl1Cps: campoAP(z.number().min(0)),
}).strict();

export const ExtensaoTumor = z.discriminatedUnion("tumor", [Mama, Prostata, Colorretal, Pulmao, ColoUterino, Gastrico]);
export type ExtensaoTumor = z.infer<typeof ExtensaoTumor>;

/** Retrato transversal de UM tumor-índice. Achados de outros órgãos ficam fora (tumor-índice × incidental). */
export const RetratoTransversal = z.object({
  pacienteRef: Id,
  tumorIndice: z.literal(true),
  nucleo: NucleoAP,
  // A ausência de classificação explícita não permite escolher uma extensão por inferência.
  extensao: ExtensaoTumor.nullable(),
}).strict();
export type RetratoTransversal = z.infer<typeof RetratoTransversal>;

/** Validador puro: nunca preenche default; devolve erros legíveis. */
export function validarRetratoTransversal(entrada: unknown):
  { ok: true; retrato: RetratoTransversal } | { ok: false; erros: string[] } {
  const r = RetratoTransversal.safeParse(entrada);
  if (r.success) return { ok: true, retrato: r.data };
  return { ok: false, erros: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
}
