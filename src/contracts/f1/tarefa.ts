import { z } from "zod";
import { DataCivil, Id, Instante } from "../base.js";

export const ReferenciaPedido = z.object({documentId:Id,documentVersion:z.number().int().positive()}).strict();
export const FonteResultadoPedido = z.object({draftId:Id,revision:z.number().int().nonnegative(),sourceId:Id,hash:z.string().regex(/^[a-f0-9]{64}$/),encounterId:Id}).strict();
export const AcompanhamentoPedido = z.object({pedido:ReferenciaPedido,
 estado:z.enum(["SOLICITADO","REALIZADO","RESULTADO_DISPONIVEL","REVISADO"]),realizadoEm:DataCivil.nullable(),
 resultado:FonteResultadoPedido.nullable(),disponivelEm:Instante.nullable(),revisadoEm:Instante.nullable(),revisadoPor:Id.nullable(),
}).strict().superRefine((r,c)=>{
 if(r.estado==="SOLICITADO"&&(r.realizadoEm!==null||r.resultado!==null||r.disponivelEm!==null))c.addIssue({code:"custom",message:"RESULTADO_PREMATURO"});
 if(r.estado==="REALIZADO"&&(r.resultado!==null||r.disponivelEm!==null))c.addIssue({code:"custom",message:"RESULTADO_PREMATURO"});
 if(r.estado!=="SOLICITADO"&&!r.realizadoEm)c.addIssue({code:"custom",message:"REALIZACAO_SEM_DATA"});
 if(["RESULTADO_DISPONIVEL","REVISADO"].includes(r.estado)&&(!r.resultado||!r.disponivelEm))c.addIssue({code:"custom",message:"RESULTADO_SEM_FONTE"});
 if(r.estado==="REVISADO"&&(!r.revisadoEm||!r.revisadoPor))c.addIssue({code:"custom",message:"REVISAO_SEM_AUTOR"});
 if(r.estado!=="REVISADO"&&(r.revisadoEm!==null||r.revisadoPor!==null))c.addIssue({code:"custom",message:"REVISAO_PREMATURA"});
});
export type AcompanhamentoPedido=z.infer<typeof AcompanhamentoPedido>;
export const EstadoTarefa = z.enum(["RASCUNHO", "CONFIRMADA", "CONCLUIDA", "CANCELADA", "SUPERSEDED"]);
export const Tarefa = z.object({ tarefaId: Id, patientId: Id, encounterId: Id, tumorLotId: Id.nullable(),
  operationId: Id, titulo: Id, responsavel: Id, prazo: Instante.nullable(), estado: EstadoTarefa,
  recebidoEm: Instante.nullable(), criadoPor: Id, substituiTarefaId: Id.nullable(),
  dataAlvo: DataCivil.nullable().default(null),
  pedidoRefs: z.array(z.object({documentId:Id,documentVersion:z.number().int().positive()}).strict()).default([]),
  retornoRef: z.object({documentId:Id,documentVersion:z.number().int().positive()}).strict().nullable().default(null),
  acompanhamentoPedidos:z.array(AcompanhamentoPedido).default([]),
  atualizadoNoEncontroId:Id.nullable().default(null),
  geradaPorEventoId: Id.nullable().default(null), rulesetVersao: Id.nullable().default(null),
}).strict().superRefine((t,c)=>{
 const chave=(p:{documentId:string;documentVersion:number})=>`${p.documentId}@${p.documentVersion}`;
 if(new Set(t.acompanhamentoPedidos.map(r=>chave(r.pedido))).size!==t.acompanhamentoPedidos.length||t.acompanhamentoPedidos.some(r=>!t.pedidoRefs.some(p=>chave(p)===chave(r.pedido))))c.addIssue({code:"custom",message:"ACOMPANHAMENTO_FORA_PEDIDO"});
});
export type Tarefa = z.infer<typeof Tarefa>;
export const EventoTarefa = z.enum(["EV-T1", "EV-T2", "EV-T3", "EV-T4", "EV-T5", "EV-T6"]);
