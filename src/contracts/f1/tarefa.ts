import { z } from "zod";
import { Id, Instante } from "../base.js";

export const EstadoTarefa = z.enum(["RASCUNHO", "CONFIRMADA", "CONCLUIDA", "CANCELADA", "SUPERSEDED"]);
export const Tarefa = z.object({ tarefaId: Id, patientId: Id, encounterId: Id, tumorLotId: Id.nullable(),
  operationId: Id, titulo: Id, responsavel: Id, prazo: Instante.nullable(), estado: EstadoTarefa,
  recebidoEm: Instante.nullable(), criadoPor: Id, substituiTarefaId: Id.nullable(),
}).strict();
export type Tarefa = z.infer<typeof Tarefa>;
export const EventoTarefa = z.enum(["EV-T1", "EV-T2", "EV-T3", "EV-T4", "EV-T5", "EV-T6"]);
