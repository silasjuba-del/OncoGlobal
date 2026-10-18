import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { z } from "zod";
import type { Sessao } from "../contracts/base.js";
import { FactSourceType } from "../contracts/w10/extracao.js";
import { lerDraft, salvarDraft } from "../kernel/comandos/portas.js";
import { executarPipelineExtracao } from "../kernel/extracao/pipeline.js";
import { converterPdfLocal } from "../kernel/extracao/pdfLocal.js";
import { ocrLocal, type ConfigOcrLocal, type EntradaLeitura, type ResultadoLeitura } from "../kernel/extracao/ocrLocal.js";
import type { ServidorDeps } from "./rotas.js";
import { dirname, join } from "node:path";

const MAX_BYTES=8*1024*1024;
const Upload = z.object({patientId:z.string().min(1),encounterId:z.string().min(1),tumorLotId:z.string().min(1).nullable(),
  id:z.string().min(1).max(200),sourceId:z.string().min(1).max(200),sourceType:FactSourceType,
  tipo:z.enum(["PDF","IMAGEM"]),bytesBase64:z.string().min(1).max(Math.ceil(MAX_BYTES/3)*4)}).strict();
const hash=(v:string|Uint8Array)=>createHash("sha256").update(v).digest("hex");
const requireLocal=createRequire(import.meta.url);
export function configuracaoOcrInstalada():ConfigOcrLocal|null {
  try {
    return {workerPath:requireLocal.resolve("tesseract.js/src/worker-script/node/index.js"),
      corePath:dirname(requireLocal.resolve("tesseract.js-core/tesseract-core-simd-lstm.wasm.js")),
      langPath:(requireLocal("@tesseract.js-data/por") as {langPath:string}).langPath,idioma:"por",limiarConfianca:70,timeoutMs:30_000};
  }catch{return null;}
}
export type DepsUpload = Pick<ServidorDeps,"db"|"sessoes"|"agora"> & {
  converterUpload?: (entrada:EntradaLeitura,tipo:"PDF"|"IMAGEM")=>Promise<ResultadoLeitura>;
};
/** Ingestão inerte: contexto explícito não substitui conferência humana de identidade. */
export async function processarUploadLocal(deps:DepsUpload,token:string,sessao:Sessao,raw:unknown):Promise<{status:number;body:Record<string,unknown>}> {
  if(!deps.sessoes.obter(token)||deps.sessoes.obter(token)?.medicoId!==sessao.medicoId)return {status:401,body:{codigo:"SESSAO_EXPIRADA"}};
  const p=Upload.safeParse(raw);if(!p.success)return {status:400,body:{codigo:"UPLOAD_INVALIDO_OU_EXCESSIVO"}};
  const ctx=deps.sessoes.consultaSelecionada(token);
  if(!ctx||ctx.patientId!==p.data.patientId||ctx.encounterId!==p.data.encounterId||(ctx.tumorLotId??null)!==p.data.tumorLotId)return {status:409,body:{codigo:"CONTEXTO_UPLOAD_DIVERGENTE"}};
  const base64=p.data.bytesBase64;
  const tamanhoEstimado=base64.length/4*3-(base64.endsWith("==")?2:base64.endsWith("=")?1:0);
  if(tamanhoEstimado>MAX_BYTES)return {status:413,body:{codigo:"UPLOAD_LIMITE_8MB"}};
  if(base64.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))return {status:400,body:{codigo:"UPLOAD_BASE64_INVALIDO"}};
  const bytes=Buffer.from(base64,"base64");
  if(bytes.toString("base64")!==base64)return {status:400,body:{codigo:"UPLOAD_BASE64_INVALIDO"}};
  if(!bytes.length||bytes.length>MAX_BYTES)return {status:413,body:{codigo:"UPLOAD_LIMITE_8MB"}};
  const contentHash=hash(bytes),draftId=`upload-${hash(JSON.stringify([ctx,p.data.id,p.data.sourceId])).slice(0,40)}`;
  const existente=lerDraft(deps.db,draftId);
  if(existente){const payload=existente.payload as Record<string,unknown>,original=payload.original as Record<string,unknown>|undefined;
    const input=payload.input as Record<string,unknown>|undefined;
    if(original?.contentHash!==contentHash||original.tipo!==p.data.tipo||input?.sourceType!==p.data.sourceType)return {status:409,body:{codigo:"UPLOAD_ID_CONFLITANTE"}};
    const documento=original.documento as Record<string,unknown>|undefined;
    return {status:200,body:{codigo:"REPLAY",draftId,revision:existente.revision,linkedPatientId:existente.patientId,requiresMedicalReview:true,
      conversionStatus:original.status==="PRONTO"?"PRONTO":"PENDENTE",motivo:typeof original.motivo==="string"?original.motivo:null,
      paginasPendentes:documento?.paginasPendentes??[],totalPaginas:documento?.totalPaginas??null}};
  }
  const recebidoEm=deps.agora(),entrada:EntradaLeitura={id:p.data.id,tipo:p.data.tipo==="PDF"?"PDF_DIGITAL":"IMAGEM",conteudo:new Uint8Array(bytes),recebidoEm};
  const config=configuracaoOcrInstalada();
  let leitura:ResultadoLeitura;
  try {leitura=deps.converterUpload?await deps.converterUpload(entrada,p.data.tipo)
    :p.data.tipo==="PDF"?await converterPdfLocal(entrada,config?{ocrConfig:config}:{})
    :config?await ocrLocal(entrada,config):{status:"PENDENTE",documento:{id:entrada.id,tipo:entrada.tipo,paginas:[],hash:contentHash,recebidoEm},motivo:"OCR_LOCAL_SEM_ASSETS"};}
  catch {leitura={status:"PENDENTE",documento:{id:entrada.id,tipo:entrada.tipo,paginas:[],hash:contentHash,recebidoEm},motivo:"CONVERSAO_LOCAL_PENDENTE"};}
  const textoIntegral=leitura.documento.paginas.map(p=>p.texto).join("\n");
  if(textoIntegral.length>200_000)leitura={status:"PENDENTE",documento:leitura.documento,motivo:"TEXTO_LIMITE_PIPELINE_REVISAR_ORIGINAL"};
  const rawTranscript=textoIntegral.length>200_000?"":textoIntegral;
  const input={recordingId:p.data.id,sourceId:p.data.sourceId,sourceType:p.data.sourceType,rawTranscript};
  const paginasLegiveis=leitura.documento.paginas.filter(pagina=>pagina.texto.trim());
  const primeira=paginasLegiveis[0];
  // Cada página é uma entrada do pipeline; recordingId distinto por página evita colisão multifonte.
  const state=executarPipelineExtracao(rawTranscript&&primeira?{...input,rawTranscript:primeira.texto,page:primeira.n,
    additionalSources:paginasLegiveis.slice(1).map(pagina=>({...input,recordingId:`${input.recordingId}#p${pagina.n}`,rawTranscript:pagina.texto,page:pagina.n}))}:input);
  const salvo=salvarDraft(deps.db,{draftId,patientId:null,sourceId:p.data.sourceId,rawRef:`upload-local:${p.data.id}`,
    payload:{kind:"EXTRACAO_RASCUNHO",input,state,alerts:[],alertasRads:[],
      original:{tipo:p.data.tipo,bytesBase64:base64,contentHash,documento:leitura.documento,status:leitura.status,
        confianca:"confianca" in leitura&&typeof leitura.confianca==="number"?leitura.confianca:null,
        motivo:leitura.status==="PENDENTE"?leitura.motivo:null},contextoUpload:{patientId:p.data.patientId,encounterId:p.data.encounterId,tumorLotId:p.data.tumorLotId}},
    diagnostics:["VINCULO_MEDICO_PENDENTE",...(leitura.status==="PENDENTE"?[leitura.motivo]:[]),...state.confirmationRequired.map(e=>e.kind)],revision:0,criadoEm:recebidoEm});
  return {status:201,body:{codigo:"RASCUNHO_SALVO",draftId:salvo.draftId,revision:salvo.revision,linkedPatientId:null,
    conversionStatus:leitura.status,motivo:leitura.status==="PENDENTE"?leitura.motivo:null,
    paginasPendentes:leitura.documento.paginasPendentes??[],totalPaginas:leitura.documento.totalPaginas??null,
    facts:state.facts,exceptions:state.confirmationRequired,requiresMedicalReview:true}};
}
