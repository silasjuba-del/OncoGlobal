import { z } from "zod";
import { DataCivil, Id } from "../base.js";
import { Ciclo, TreatmentEpisode } from "../clinico.js";
import { IntencaoQtRt } from "../estados.js";
import { ContextoAcaoComposta } from "./acoesCompostas.js";
import { ConteudoPrescricaoExecutavel, ItemPrescricaoExecutavel, OrigemPropostaPrescricaoExecutavel } from "./prescricaoExecutavel.js";

export const PlanejamentoPrescricaoExecutavel = z.object({
  modo: z.enum(["CICLO_ATUAL", "NOVO_CICLO", "NOVA_LINHA"]),
  linha: z.number().int().positive().nullable(),
  intencao: IntencaoQtRt.nullable(),
  numeroCiclo: z.number().int().positive().nullable(),
}).strict();
export const EdicaoPrescricaoExecutavel = z.object({
  protocoloId: Id,
  dataPrevista: DataCivil,
  motivo: z.string().trim().min(1).max(2000),
  planejamento: PlanejamentoPrescricaoExecutavel,
  itens: z.array(ItemPrescricaoExecutavel).min(1).max(100),
  origemProposta: OrigemPropostaPrescricaoExecutavel.nullable(),
  encaminharFarmacia: z.boolean().default(false),
}).strict();
export type EdicaoPrescricaoExecutavel = z.infer<typeof EdicaoPrescricaoExecutavel>;

export const BasePrescricaoExecutavelResposta = z.object({
  contexto: ContextoAcaoComposta,
  revisao: z.string().regex(/^[a-f0-9]{64}$/),
  pacienteNome: Id,
  episodio: TreatmentEpisode.nullable(),
  ciclo: Ciclo.nullable(),
  vigente: ConteudoPrescricaoExecutavel.nullable(),
  pendencias: z.array(Id),
}).strict();
export type BasePrescricaoExecutavelResposta = z.infer<typeof BasePrescricaoExecutavelResposta>;

export const PrepararPrescricaoExecutavelPedido = z.object({
  contexto: ContextoAcaoComposta,
  expectedBaseHash: z.string().regex(/^[a-f0-9]{64}$/),
  idempotencyKey: Id,
  edicao: EdicaoPrescricaoExecutavel,
}).strict();
export type PrepararPrescricaoExecutavelPedido = z.infer<typeof PrepararPrescricaoExecutavelPedido>;
export const PrescricaoExecutavelPreparada = z.object({
  draftId: Id,
  revision: z.number().int().nonnegative(),
  conteudoHash: z.string().regex(/^[a-f0-9]{64}$/),
  baseHash: z.string().regex(/^[a-f0-9]{64}$/),
  conteudo: ConteudoPrescricaoExecutavel,
  texto: Id,
  avisos: z.array(Id),
  efeitos: z.array(Id),
}).strict();
export type PrescricaoExecutavelPreparada = z.infer<typeof PrescricaoExecutavelPreparada>;
export const ConfirmarPrescricaoExecutavelPedido = z.object({
  contexto: ContextoAcaoComposta,
  draftId: Id,
  expectedRevision: z.number().int().nonnegative(),
  conteudoHash: z.string().regex(/^[a-f0-9]{64}$/),
  idempotencyKey: Id,
}).strict();
export type ConfirmarPrescricaoExecutavelPedido = z.infer<typeof ConfirmarPrescricaoExecutavelPedido>;
export const PrescricaoExecutavelConfirmada = z.object({
  codigo: z.enum(["GRAVADA", "REPLAY"]),
  documentId: Id,
  documentVersion: z.number().int().positive(),
  eventoId: Id,
  cicloId: Id,
  episodioId: Id,
}).strict();
export type PrescricaoExecutavelConfirmada = z.infer<typeof PrescricaoExecutavelConfirmada>;
