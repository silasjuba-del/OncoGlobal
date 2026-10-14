import { z } from 'zod';
import { Id } from '../base.js';
import { Correlacao, VersaoReferencia } from '../f1/correlacao.js';
import { ReferenciaFato } from '../f1/achadosSetor.js';
import { ContextoDutosVisao } from './dutos.js';
const Lista=z.array(Id).min(1);
const Aplicabilidade=z.object({tumor:Lista.optional(),histologia:Lista.optional(),estagio:Lista.optional(),linha:z.array(z.number().int().positive()).min(1).optional(),biomarcadores:z.array(z.object({nome:Id,resultados:Lista}).strict()).optional()}).strict();
/** Dados estruturados aprovados no servidor; conteúdo textual não é convertido em requisito. */
export const PackInvestigacaoSchema=z.object({referencia:VersaoReferencia,status:z.literal('CONFERIDA_MEDICO'),fonte:Id,requisitos:z.array(z.object({id:Id,exameCodigo:Id,contexto:Id,fonte:Id,codigoSus:Id.nullable(),validadeHoras:z.number().finite().positive().nullable(),aplicabilidade:Aplicabilidade.optional()}).strict()).min(1)}).strict();
export type PackInvestigacaoSchema=z.infer<typeof PackInvestigacaoSchema>;
const Lacuna=z.object({codigo:Id,texto:Id,fatos:z.array(ReferenciaFato)}).strict();
export const ResultadoInvestigacaoSchema=z.object({schema:z.literal('Investigacao@1'),correlacao:Correlacao,
 requisitos:z.array(z.object({id:Id,exameCodigo:Id,contexto:Id,classificacao:z.enum(['confirmado','ausente','solicitado','vencido','conflitante','naoAplicavel']),justificativa:Id,fonte:Id,fatos:z.array(ReferenciaFato),regras:z.array(VersaoReferencia)}).strict()),
 propostas:z.array(z.object({exameCodigo:Id,contexto:Id,codigoSus:Id.nullable(),pendencias:z.array(Id),justificativa:Id,fatos:z.array(ReferenciaFato),regras:z.array(VersaoReferencia)}).strict()),lacunas:z.array(Lacuna),
}).strict();
export const InvestigacaoConsultaVisao=z.object({codigo:z.literal('INVESTIGACAO_CARREGADA'),schema:z.literal('InvestigacaoConsulta@1'),contexto:ContextoDutosVisao,revisao:Id.nullable(),estado:z.enum(['PRONTA','PENDENTE']),fatos:z.array(ReferenciaFato),resultado:ResultadoInvestigacaoSchema.nullable(),lacunas:z.array(Lacuna)}).strict().superRefine((v,c)=>{
 const r=v.resultado;
 if(r&&(r.correlacao.patientId!==v.contexto.patientId||r.correlacao.encounterId!==v.contexto.encounterId||r.correlacao.tumorLotId!==v.contexto.tumorLotId||r.correlacao.revisaoFatos!==v.revisao))c.addIssue({code:'custom',message:'INVESTIGACAO_FORA_CONTEXTO'});
 const refs=new Set(v.fatos.map(f=>`${f.eventId}@${f.revisao}`));
 if([...v.lacunas,...(r?.lacunas??[]),...(r?.requisitos??[]),...(r?.propostas??[])].some(l=>l.fatos.some(f=>!refs.has(`${f.eventId}@${f.revisao}`))))c.addIssue({code:'custom',message:'REFERENCIA_INVESTIGACAO_DIVERGENTE'});
 if(v.estado==='PRONTA'&&(!r||v.lacunas.length||r.lacunas.length))c.addIssue({code:'custom',message:'INVESTIGACAO_PRONTA_INCONSISTENTE'});
});
export type InvestigacaoConsultaVisao=z.infer<typeof InvestigacaoConsultaVisao>;
