import { z } from 'zod';
import { Id, Fonte } from '../base.js';
import { Apac } from '../operacao.js';
import { TreatmentAdministration } from '../clinico.js';
import { ConferenciaFarmacia, PrescricaoAssinadaRef, ValidacaoApacPersistida } from '../f1/dutos.js';
import { Tarefa } from '../f1/tarefa.js';
export const ContextoDutosVisao=z.object({patientId:Id,encounterId:Id,tumorLotId:Id.nullable()}).strict();
export const DutosClinicaVisao=z.object({
 schema:z.literal('DutosClinicaVisao@1'),contexto:ContextoDutosVisao,
 farmacia:z.array(z.object({eventId:Id,registro:ConferenciaFarmacia,referenciaValida:z.boolean(),motivo:z.string().nullable()}).strict()),
 tarefas:z.array(z.object({eventId:Id,tarefa:Tarefa}).strict()),
 apacs:z.array(z.object({eventId:Id,apac:Apac,validacao:ValidacaoApacPersistida.nullable(),estado:z.enum(['VALIDADA','PENDENTE']),motivo:z.string().nullable()}).strict()),
 administracoes:z.array(z.object({eventId:Id,dados:TreatmentAdministration,avisos:z.array(z.string()).optional(),prescricao:PrescricaoAssinadaRef.nullable(),referenciaValida:z.boolean(),motivo:z.string().nullable()}).strict()),
 exposicoesLocais:z.array(z.object({droga:Id,unidade:z.literal('mg/m2'),origem:z.literal('ADMINISTRADO_LOCAL'),
  total:z.number().finite().nullable(),pendentes:z.array(Id),administracoes:z.array(z.object({adminId:Id,mg:z.number().finite(),
   mgM2:z.number().finite().nullable(),fonte:Fonte,sc:z.object({valorM2:z.number().finite().positive(),fonte:Fonte}).nullable()}).strict())}).strict()).optional(),
 integridade:z.array(z.object({eventId:Id,codigo:Id}).strict()),
}).strict().superRefine((v,c)=>{
 const mesmo=(x:{patientId:string;encounterId:string;tumorLotId:string|null})=>x.patientId===v.contexto.patientId&&x.encounterId===v.contexto.encounterId&&x.tumorLotId===v.contexto.tumorLotId;
 if(v.farmacia.some(f=>!mesmo(f.registro.prescricao))||v.tarefas.some(t=>!mesmo(t.tarefa))||v.apacs.some(a=>a.apac.tumorLotId!==v.contexto.tumorLotId||a.validacao&&!mesmo(a.validacao))||v.administracoes.some(a=>a.prescricao&&!mesmo(a.prescricao)))
  c.addIssue({code:'custom',message:'DUTOS_FORA_CONTEXTO'});
 if(v.farmacia.some(f=>f.referenciaValida&&f.motivo!==null)||v.apacs.some(a=>a.estado==='VALIDADA'&&(!a.validacao||a.motivo!==null))||v.administracoes.some(a=>a.referenciaValida&&(!a.prescricao||a.motivo!==null)))
  c.addIssue({code:'custom',message:'VALIDADE_DUTO_INCONSISTENTE'});
});
export type DutosClinicaVisao=z.infer<typeof DutosClinicaVisao>;
