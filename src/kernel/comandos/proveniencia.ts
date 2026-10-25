import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { Fonte, Id, Instante, type DraftEnvelope } from "../../contracts/base.js";
import { ClinicalEvent } from "../../contracts/operacao.js";
import { ClinicalFact, EncounterSegment, FactSourceType } from "../../contracts/w10/extracao.js";
import { MetodoCapturaTranscricao } from "../../contracts/capturaTranscricao.js";
import { prepararRevisaoExtracao } from "../extracao/prepararRevisao.js";
import { hashCanonico } from "../../modules/tipos.js";
import { lerDraft } from "../ledger/drafts.js";
import type { Confirmacao } from "../ledger/writeRouter.js";

/** Leitura histórica continua usando Fonte. Esta exigência vale para novas declarações. */
export const FonteNovaDeclarada = Fonte.refine(f=>f.sourceId.trim().length>0&&f.versao.trim().length>0
  && /^[a-fA-F0-9]{64}$/.test(f.contentHash),"PROVENIENCIA_INVALIDA");
export class ErroProveniencia extends Error {
  constructor(readonly codigo:string){super(codigo);}
}
export function fontesDeclaradasNoRascunho(payload:unknown):Fonte[]|null {
  if(!payload||typeof payload!=="object"||Array.isArray(payload)||!Object.hasOwn(payload,"fontes"))return null;
  const fontes=FonteNovaDeclarada.array().safeParse((payload as Record<string,unknown>).fontes);
  if(!fontes.success)throw new ErroProveniencia("PROVENIENCIA_INVALIDA");
  return fontes.data;
}
const Contexto=z.object({patientId:Id,encounterId:Id,tumorLotId:Id.nullable()});
const Hash=z.string().regex(/^[a-f0-9]{64}$/);
const Resumo=z.object({kind:z.literal("EVOLUCAO_RASCUNHO"),contexto:Contexto,selectedFactIds:z.array(Id),
  incluirTextoOriginal:z.literal(true).optional(),review:z.object({medicoId:Id,em:Instante,operationId:Id}),
  origem:z.object({draftId:Id,revision:z.number().int().nonnegative(),conteudoHash:Hash})}).passthrough();
const Extracao=z.object({kind:z.literal("EXTRACAO_RASCUNHO"),
  input:z.object({sourceId:Id,sourceType:FactSourceType,recordingId:Id,captureMethod:MetodoCapturaTranscricao.optional()}).passthrough(),
  state:z.object({segments:z.array(EncounterSegment),facts:z.array(z.unknown()),confirmationRequired:z.array(z.unknown())}).passthrough(),
  patientLinkReview:Contexto.extend({medicoId:Id,reviewDecisionId:Id,exceptionId:Id,segmentId:Id,sourceId:Id,sourceHash:Hash}).passthrough(),
}).passthrough();
/** Reconstitui a promoção a partir da origem/segmento, não da fonte alegada pelo chamador. */
function validarRevisaoDocumental(db:DatabaseSync,req:Confirmacao,draft:DraftEnvelope):void {
  const negar=()=>{throw new ErroProveniencia("PROVENIENCIA_DOCUMENTAL_DIVERGENTE");};
  try {
    const resumo=Resumo.parse(draft.payload),contexto={patientId:req.patientId,encounterId:req.encounterId,tumorLotId:req.tumorLotId};
    if(draft.patientId!==req.patientId||hashCanonico(resumo.contexto)!==hashCanonico(contexto)
      ||resumo.review.operationId!==req.operationId||req.reviewDecisionId!==resumo.review.operationId
      ||resumo.review.medicoId!==req.sessao.medicoId)return negar();
    const original=lerDraft(db,resumo.origem.draftId);
    if(!original||original.patientId!==req.patientId||original.revision!==resumo.origem.revision
      ||hashCanonico(original.payload)!==resumo.origem.conteudoHash)return negar();
    const fonte=Extracao.parse(original.payload),link=fonte.patientLinkReview;
    if(hashCanonico(Contexto.parse(link))!==hashCanonico(contexto)||link.medicoId!==req.sessao.medicoId
      ||fonte.input.sourceId!==original.sourceId||draft.sourceId!==original.sourceId||link.sourceId!==original.sourceId)return negar();
    const {patientLinkReview:_link,...semVinculo}=fonte;
    if(hashCanonico(semVinculo)!==link.sourceHash)return negar();
    const linhas=db.prepare("SELECT * FROM clinical_event WHERE operationId=? AND tipo='ReviewDecision'").all(link.reviewDecisionId);
    if(linhas.length!==1)return negar();
    const row=linhas[0]!;
    const evento=ClinicalEvent.parse({...row,payload:JSON.parse(String(row.payload)),fontes:JSON.parse(String(row.fontes)),criadoPor:JSON.parse(String(row.criadoPor))});
    const decisao=z.object({data:z.object({campo:z.literal("patientLink"),acao:z.literal("LIGAR_PACIENTE"),patientId:Id,segmentId:Id,exceptionId:Id,
      source:z.object({draftId:Id,sourceId:Id,revision:z.number(),contentHash:Hash})})}).parse(evento.payload).data;
    if(evento.patientId!==req.patientId||evento.encounterId!==req.encounterId||evento.tumorLotId!==req.tumorLotId
      ||evento.revisao!=="CONFIRMADO"||evento.criadoPor.tipo!=="SESSAO"||evento.criadoPor.id!==req.sessao.medicoId
      ||decisao.patientId!==req.patientId||decisao.segmentId!==link.segmentId||decisao.exceptionId!==link.exceptionId
      ||decisao.source.draftId!==original.draftId||decisao.source.sourceId!==original.sourceId
      ||decisao.source.revision!==original.revision-1||decisao.source.contentHash!==link.sourceHash
      ||!evento.fontes.some(f=>f.sourceId===original.sourceId&&f.contentHash===link.sourceHash))return negar();
    const segmentos=fonte.state.segments.filter(s=>s.id===link.segmentId&&s.sourceId===original.sourceId);
    if(segmentos.length!==1)return negar();const segmento=segmentos[0]!;
    const facts=fonte.state.facts.flatMap(f=>{const p=ClinicalFact.safeParse(f);return p.success&&p.data.segmentId===link.segmentId?[p.data]:[];});
    const exceptions=fonte.state.confirmationRequired.filter(e=>e&&typeof e==="object"&&"segmentId" in e&&e.segmentId===link.segmentId);
    const reconstruida=prepararRevisaoExtracao({draftId:original.draftId,sourceId:original.sourceId,sourceType:fonte.input.sourceType,
      rawTranscript:segmento.rawTranscript,...(fonte.input.captureMethod?{captureMethod:fonte.input.captureMethod}:{}),vinculoConfirmado:true,
      facts,exceptions,...contexto,factIds:resumo.selectedFactIds,operationId:resumo.review.operationId,medicoId:resumo.review.medicoId,em:resumo.review.em,
      ...(resumo.incluirTextoOriginal?{incluirTextoOriginal:true,segmentoVinculado:{id:segmento.id,...(segmento.page?{page:segmento.page}:{})}}:{}),origem:resumo.origem});
    if(reconstruida.draftId!==draft.draftId||hashCanonico(reconstruida.payload)!==hashCanonico(draft.payload))return negar();
    const registros=req.registros.filter(r=>r.draftId===draft.draftId);
    if(registros.length!==req.registros.length||registros.length!==reconstruida.registros.length)return negar();
    for(const [i,r] of registros.entries()){
      const esperado=reconstruida.registros[i]!;
      if(r.revisao!=="CONFIRMADO"||r.supersedesEventId!=null||!FonteNovaDeclarada.array().min(1).safeParse(r.fontes).success
        ||hashCanonico({eventId:r.eventId,tipo:r.tipo,payload:r.payload,fontes:r.fontes})!==hashCanonico({eventId:esperado.eventId,tipo:esperado.tipo,payload:esperado.payload,fontes:esperado.fontes}))return negar();
    }
  }catch(e){if(e instanceof ErroProveniencia)throw e;negar();}
}
/** Nunca substituir uma fonte declarada por uma fonte inferida ou por array vazio. */
export function validarProvenienciaConfirmacao(db:DatabaseSync,req:Confirmacao):void {
  // O writer ainda compara o hash integral dos eventos no replay. Não migra fonte histórica.
  if(db.prepare("SELECT 1 FROM operation WHERE operationId=?").get(req.operationId))return;
  const revisados=new Set<string>();
  for(const registro of req.registros){
    const draft=lerDraft(db,registro.draftId);
    if(!draft)continue; // O writer conserva sua recusa de versão/identidade.
    const kind=draft.payload&&typeof draft.payload==="object"&&"kind" in draft.payload?draft.payload.kind:null;
    if(kind==="EVOLUCAO_RASCUNHO"){
      if(!revisados.has(draft.draftId)){validarRevisaoDocumental(db,req,draft);revisados.add(draft.draftId);}continue;
    }
    if(!/^(FATO|DOCUMENTO)(?:@1)?$/.test(registro.tipo))continue;
    const fontes=fontesDeclaradasNoRascunho(draft.payload);
    if(fontes===null)continue;
    if(/^FATO(?:@1)?$/.test(registro.tipo)&&fontes.length===0)throw new ErroProveniencia("PROVENIENCIA_OBRIGATORIA_AUSENTE");
    if(hashCanonico(fontes)!==hashCanonico(registro.fontes))throw new ErroProveniencia("PROVENIENCIA_DIVERGENTE");
  }
}
