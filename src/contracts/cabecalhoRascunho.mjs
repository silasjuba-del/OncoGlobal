import {z} from 'zod';
import {RulesetHeader} from './rulesetHeader.mjs';
/** Proveniência documental de rascunho; jamais é um RulesetHeader aprovado. */
export const CabecalhoRascunho=z.object({
 schema:z.literal('CabecalhoRascunho@1'),id:RulesetHeader.shape.id,versao:RulesetHeader.shape.versao,
 redigidoEm:z.iso.date(),fonte:RulesetHeader.shape.fonte,curador:z.null(),aprovadoEm:z.null(),
}).strict().superRefine((h,ctx)=>{
 if(h.fonte.tipo!=='DECISAO_MEDICA'&&(!h.fonte.trecho?.trim()||h.fonte.trecho.includes('[VERIFICAR]')))
  ctx.addIssue({code:'custom',message:'fonte documental exige trecho verificável'});
});
