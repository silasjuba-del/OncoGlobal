import { z } from "zod";
import { Id, Instante } from "../base.js";
const contexto={patientId:Id,encounterId:Id,tumorLotId:Id.nullable()};
/** Construído pelo servidor após autenticação e leitura do ledger; nunca do payload HTTP. */
export const ContextoDutoServidor=z.object({...contexto,atorId:Id,em:Instante}).strict();
export type ContextoDutoServidor=z.infer<typeof ContextoDutoServidor>;
/** Referência retornada pelo servidor após verificar assinatura e hash do documento vigente. */
export const PrescricaoAssinadaRef=z.object({...contexto,documentId:Id,documentVersion:z.number().int().positive(),documentHash:z.string().regex(/^[a-f0-9]{64}$/),revisao:z.literal("ASSINADO")}).strict();
export type PrescricaoAssinadaRef=z.infer<typeof PrescricaoAssinadaRef>;
export const ReferenciaSigtap=z.object({competencia:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),versao:Id,hash:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export type ReferenciaSigtap=z.infer<typeof ReferenciaSigtap>;
export const ConferenciaFarmacia=z.object({prescricao:PrescricaoAssinadaRef,estado:z.enum(["ENVIADA","CONFERIDA","CORRECAO_PEDIDA","ACEITA"]),motivo:z.string().nullable(),atorId:Id,em:Instante}).strict();
export type ConferenciaFarmacia=z.infer<typeof ConferenciaFarmacia>;
export const ValidacaoApacPersistida=z.object({...contexto,apacId:Id,apacVersao:z.number().int().positive(),apacHash:z.string().regex(/^[a-f0-9]{64}$/),prescricao:PrescricaoAssinadaRef,sigtap:ReferenciaSigtap,validadoPor:Id,validadoEm:Instante,exportavel:z.literal(true)}).strict();
export type ValidacaoApacPersistida=z.infer<typeof ValidacaoApacPersistida>;
export function mesmoContexto(a:{patientId:string;encounterId:string;tumorLotId:string|null},b:{patientId:string;encounterId:string;tumorLotId:string|null}){return a.patientId===b.patientId&&a.encounterId===b.encounterId&&a.tumorLotId===b.tumorLotId;}
export function mesmaPrescricao(a:PrescricaoAssinadaRef,b:PrescricaoAssinadaRef){return mesmoContexto(a,b)&&a.documentId===b.documentId&&a.documentVersion===b.documentVersion&&a.documentHash===b.documentHash;}
