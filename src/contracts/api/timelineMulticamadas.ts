import { z } from "zod";
import { DataCivil, Fonte, Id, Instante } from "../base.js";

export const TimelineMulticamadasTrilha = z.enum([
  "DEFINIDORES", "TRATAMENTO_RESPOSTA", "FISIOLOGIA", "SINTOMAS", "DOCUMENTOS",
]);
export type TimelineMulticamadasTrilha = z.infer<typeof TimelineMulticamadasTrilha>;

export const TimelineMulticamadasCategoria = z.enum([
  "DIAGNOSTICO", "ESTADIAMENTO", "IMAGEM", "TRATAMENTO", "CICLO", "ADMINISTRACAO",
  "CIRURGIA", "RADIOTERAPIA", "LABORATORIO", "FISIOLOGIA", "SINTOMA", "TOXICIDADE",
  "DOCUMENTO", "RECIST", "ADIAMENTO",
]);

export const EstadoTratamentoTimeline = z.enum([
  "PLANEJADO", "PRESCRITO", "ADMINISTRADO", "ADMINISTRADO_PARCIAL", "OMITIDO", "INTERROMPIDO", "ADIADO",
]);

export const DetalheTimelineMulticamadas = z.object({
  rotulo: z.string().min(1),
  valor: z.string().nullable(),
}).strict();

export const EventoTimelineMulticamadas = z.object({
  id: Id,
  eventId: Id,
  patientId: Id,
  encounterId: Id,
  tumorLotId: Id.nullable(),
  tipoEvento: Id,
  categoria: TimelineMulticamadasCategoria,
  trilha: TimelineMulticamadasTrilha,
  titulo: z.string().min(1),
  resumo: z.string(),
  dataClinica: z.string().nullable(),
  dataPlanejada: DataCivil.nullable(),
  dataRegistro: Instante,
  revisao: z.enum(["CONFIRMADO", "ASSINADO"]),
  supersedido: z.boolean(),
  trecho: z.string().nullable(),
  fontes: z.array(Fonte),
  detalhes: z.array(DetalheTimelineMulticamadas),
  tratamento: z.object({
    estado: EstadoTratamentoTimeline,
    atrasoDias: z.number().int().nonnegative().nullable(),
  }).strict().nullable(),
}).strict();
export type EventoTimelineMulticamadas = z.infer<typeof EventoTimelineMulticamadas>;

export const TimelineMulticamadasResposta = z.object({
  contexto: z.object({ patientId: Id, encounterId: Id, tumorLotId: Id.nullable() }).strict(),
  revisao: z.string().regex(/^[a-f0-9]{64}$/),
  eventos: z.array(EventoTimelineMulticamadas),
}).strict();
export type VisaoTimelineMulticamadas = z.infer<typeof TimelineMulticamadasResposta>;
