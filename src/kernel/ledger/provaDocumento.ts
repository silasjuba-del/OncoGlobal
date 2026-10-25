import {z} from 'zod';
import {SignatureReference,type ClinicalEvent} from '../../contracts/operacao.js';
import {hashCanonico} from '../../rules/conteudoCanonico.js';
const Conteudo=z.object({documentId:z.string().min(1),documentVersion:z.number().int().positive(),texto:z.string()}).passthrough();
const Envelope=z.object({reviewDecisionId:z.string().min(1),data:z.object({data:Conteudo,signature:SignatureReference.passthrough()}).passthrough()}).passthrough();
/** Prova comum à leitura, autorização e impressão; não confia apenas no rótulo ASSINADO. */
export function provarDocumentoAssinado(e:ClinicalEvent){
 if(!/^DOCUMENTO(?:@1)?$/.test(e.tipo)||e.revisao!=='ASSINADO'||e.criadoPor.tipo!=='SESSAO')return null;
 const p=Envelope.safeParse(e.payload);if(!p.success)return null;
 const corpo=p.data.data.data,assinatura=p.data.data.signature;
 if(assinatura.documentId!==corpo.documentId||assinatura.documentVersion!==corpo.documentVersion
   ||assinatura.serverActorId!==e.criadoPor.id||assinatura.reviewDecisionId!==p.data.reviewDecisionId
   ||assinatura.documentHash!==hashCanonico(corpo))return null;
 return {corpo,assinatura};
}
