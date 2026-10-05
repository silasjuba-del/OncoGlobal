// C-05 Paciente · C-06 TumorLot · C-08 Triagem · C-09 Tratamento/Ciclo/Administração
import { z } from "zod";
import { DataCivil, Fonte, Id, Instante, dado } from "./base.js";
import { Destino, FinalidadeApac, IntencaoCx, IntencaoQtRt } from "./estados.js";

// ── C-05 Paciente (Q13: identificador exato liga; nome nunca) ────────────────
export const TipoIdentificador = z.enum(["CNS", "CPF", "PRONTUARIO"]);
export const Paciente = z.object({
  patientId: Id,
  identificadores: z.array(z.object({ tipo: TipoIdentificador, valor: z.string().min(1) }).strict()),
  nome: z.string().min(1),
  nascimento: DataCivil.nullable(),
  sexoCadastral: z.enum(["F", "M", "OUTRO", "NAO_INFORMADO"]),
  divergencia: z.boolean(),
}).strict();
export type Paciente = z.infer<typeof Paciente>;

/** K-08 · Contato ≠ identificador do paciente; telefone compartilhado não prova identidade. */
export const Contato = z.object({
  contatoId: Id,
  canal: z.enum(["WHATSAPP_SERVICO", "WHATSAPP_PESSOAL", "EMAIL", "TELEFONE"]),
  endereco: z.string().min(1), // número/e-mail — fica só no PC
  patientId: Id.nullable(), // null = contato não vinculado
  relacao: z.enum(["PACIENTE", "FAMILIAR", "CUIDADOR", "DESCONHECIDO"]),
  vinculadoEm: Instante.nullable(),
  revogadoEm: Instante.nullable(),
}).strict();
export type Contato = z.infer<typeof Contato>;

// ── C-06 TumorLot (Q36; K-07 estadiamentos coexistentes — A3) ────────────────
export const Estadiamento = z.object({
  estadiamentoId: Id,
  sistema: z.enum(["AJCC", "UICC", "FIGO", "OUTRO"]),
  edicao: z.string().min(1),
  prefixo: z.enum(["c", "p", "yp", "r", "a"]),
  T: z.string().nullable(),
  N: z.string().nullable(),
  M: z.string().nullable(),
  grupo: z.string().nullable(),
  data: DataCivil,
  fontes: z.array(Fonte).min(1),
  usoAtivo: z.array(z.enum(["PROTOCOLO", "APAC"])),
}).strict();

export const MarcoJornada = z.object({ // Andar 0 como marcos com data (Q9)
  marco: z.enum([
    "ABERTO", "DOSSIE_INCOMPLETO", "DX_CONFIRMADO", "ESTADIADO",
    "PLANO_FECHADO", "EM_TRATAMENTO", "INTERCORRENCIA", "ENCERRADO",
  ]),
  em: DataCivil,
}).strict();

export const TumorLot = z.object({
  tumorLotId: Id,
  patientId: Id,
  cid: dado(z.string().min(3)),
  topografia: dado(z.string()),
  histologia: dado(z.string()),
  estadiamentos: z.array(Estadiamento),
  finalidadeApac: dado(FinalidadeApac), // escolha humana 1×, herdada (Q33); nunca derivada
  marcos: z.array(MarcoJornada),
}).strict();
export type TumorLot = z.infer<typeof TumorLot>;

// ── C-08 Triagem (inteiros nas bordas — K-10) ────────────────────────────────
export const Triagem = z.object({
  patientId: Id,
  encounterId: Id,
  pas: dado(z.number().int()), // mmHg
  fc: dado(z.number().int()), // bpm
  spo2: dado(z.number().int()), // %
  tempDecimos: dado(z.number().int()), // 378 = 37,8 °C
  hbDgDl: dado(z.number().int()), // 80 = 8,0 g/dL
  anc: dado(z.number().int()), // /µL
  plq: dado(z.number().int()), // /µL
  coletaHemograma: dado(DataCivil), // âncora da validade de 7 dias (K-10)
  ecog: dado(z.number().int().min(0).max(4)),
  grauCtcae: dado(z.number().int().min(0).max(5)),
  tontura: z.boolean(),
  recurso: z.enum(["AMBULATORIAL", "CADEIRA", "CAMA"]),
  idadeAnos: z.number().int().min(0),
  chegadaEm: Instante,
}).strict();
export type Triagem = z.infer<typeof Triagem>;

export const Motivo = z.object({
  codigo: z.string().min(1), // ex.: "corte.pas.alta"
  texto: z.string().min(1),
  regraId: z.string().min(1),
  rulesetVersao: z.string().min(1),
}).strict();
export type Motivo = z.infer<typeof Motivo>;

export const ResultadoTriagem = z.object({
  destino: Destino,
  cortes: z.array(Motivo),
  naoCortes: z.array(Motivo), // anota e segue (FC<50, ECOG2+tontura, grau 2)
  pendentes: z.array(Motivo),
  emergencia: z.boolean(), // E1: escalona por fora da fila (A7)
  qtPodeIniciarSemMedico: z.boolean(),
  rulesetVersao: z.string().min(1),
}).strict();
export type ResultadoTriagem = z.infer<typeof ResultadoTriagem>;

// ── C-09 Tratamento · Ciclo · Administração efetiva (K-06) ───────────────────
export const TreatmentEpisode = z.object({
  episodioId: Id,
  tumorLotId: Id,
  modalidade: z.enum(["QT", "CX", "RT"]),
  intencao: z.union([IntencaoQtRt, IntencaoCx]), // persistida como termo, nunca letra (G-13)
  intentModifier: z.string().nullable(),
  linha: z.number().int().min(1),
  esquemaId: z.string().min(1),
  inicio: dado(DataCivil),
  fim: dado(DataCivil),
}).strict();
export type TreatmentEpisode = z.infer<typeof TreatmentEpisode>;

export const OrigemPeso = z.enum(["MEDIDO", "ANTERIOR", "INFORMADO_PACIENTE"]);
export const ItemPrescrito = z.object({
  item: z.number().int().min(1),
  droga: z.string().min(1),
  doseMg: z.number().int().nonnegative(),
  reducaoPct: z.union([z.literal(0), z.literal(20), z.literal(30), z.literal(40)]),
}).strict();

export const Ciclo = z.object({
  cicloId: Id,
  episodioId: Id,
  numero: z.number().int().min(1),
  previstoEm: DataCivil,
  pesoKg: dado(z.number().positive()),
  origemPeso: OrigemPeso.nullable(),
  ciclosSemPesoConsecutivos: z.number().int().nonnegative(),
  prescricaoRef: z.object({ documentId: Id, documentVersion: z.number().int().min(1) }).strict().nullable(),
  itens: z.array(ItemPrescrito),
  comMedico: z.boolean(),
}).strict();
export type Ciclo = z.infer<typeof Ciclo>;

/** K-06 · Só a administração EFETIVA alimenta dose anterior (Q29) e cumulativos. */
export const TreatmentAdministration = z.object({
  adminId: Id,
  cicloId: Id,
  prescricaoRef: z.object({ documentId: Id, documentVersion: z.number().int().min(1) }).strict(),
  item: z.number().int().min(1),
  droga: z.string().min(1),
  quantidadeEfetivaMg: z.number().int().nonnegative(),
  status: z.enum(["COMPLETA", "PARCIAL", "OMITIDA", "INTERROMPIDA"]),
  motivo: z.string().nullable(),
  inicio: Instante.nullable(),
  fim: Instante.nullable(),
  fonte: Fonte,
}).strict().superRefine((a, ctx) => {
  if (a.status === "OMITIDA" && a.quantidadeEfetivaMg !== 0)
    ctx.addIssue({ code: "custom", message: "OMITIDA exige quantidade 0" });
  if ((a.status === "PARCIAL" || a.status === "INTERROMPIDA" || a.status === "OMITIDA") && !a.motivo)
    ctx.addIssue({ code: "custom", message: `${a.status} exige motivo` });
});
export type TreatmentAdministration = z.infer<typeof TreatmentAdministration>;
