import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Fonte,Id } from "../contracts/base.js";
import { ContextoDutosVisao } from "../contracts/api/dutos.js";
import { PedidoEstadoDoenca,ConfirmacaoEstadoDoenca } from "../contracts/fase2/estadoDoenca.js";
import { depoisDoCommit,salvarDraft,lerDraft } from "../kernel/comandos/portas.js";
import { lerLedgerIntegro } from '../kernel/ledger/leituraIntegra.js';
import { executarConfirmacao as confirmar } from "../kernel/comandos/index.js";
import { dataCivilDoServico } from "../kernel/gateway/tempo.js";
import { hashCanonico } from "../rules/conteudoCanonico.js";
import type { ServidorDeps } from "./rotas.js";

const Payload=z.object({kind:z.literal("ESTADO_DOENCA_RASCUNHO"),contexto:ContextoDutosVisao,pedido:PedidoEstadoDoenca,
  medicoId:Id,revisaoFatos:Id,operationId:Id,fonte:Fonte,texto:Id,conteudoHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
const falha=(status:number,codigo:string)=>({status,body:{codigo}});
const selo=(s:z.infer<typeof Payload>)=>hashCanonico({contexto:s.contexto,pedido:s.pedido,medicoId:s.medicoId,revisaoFatos:s.revisaoFatos,
  operationId:s.operationId,fonte:s.fonte,texto:s.texto});
const textoRegistro=(contexto:z.infer<typeof ContextoDutosVisao>,pedido:PedidoEstadoDoenca)=>`Registro médico de estado da doença\nPaciente: ${contexto.patientId}\nLote tumoral: ${contexto.tumorLotId}\nEstado: ${pedido.estado}\nData clínica: ${pedido.data}\nFundamento: ${pedido.fundamento}\nO registro não altera estadiamento histórico nem define conduta.`;
export function rotearEstadoDoenca(deps:ServidorDeps,token:string,rota:string,raw:unknown){
  if(rota!=="prepararEstadoDoenca"&&rota!=="confirmarEstadoDoenca")return null;
  const sessao=deps.sessoes.obter(token);if(!sessao)return falha(401,"SESSAO_EXPIRADA");
  const p=(rota==="prepararEstadoDoenca"?PedidoEstadoDoenca:ConfirmacaoEstadoDoenca).safeParse(raw);
  if(!p.success)return falha(400,"ESTADO_DOENCA_INVALIDO");
  const ctx=deps.sessoes.consultaSelecionada(token),contexto=ContextoDutosVisao.parse({patientId:p.data.patientId,encounterId:p.data.encounterId,tumorLotId:p.data.tumorLotId});
  if(!ctx||ctx.patientId!==contexto.patientId||ctx.encounterId!==contexto.encounterId||(ctx.tumorLotId??null)!==contexto.tumorLotId)return falha(409,"CONTEXTO_CONSULTA_ALTERADO");
  if(!contexto.tumorLotId)return falha(409,"TUMOR_LOT_OBRIGATORIO");
  if(!deps.motorF1)return falha(409,"RETRATO_INDISPONIVEL");
  if(rota==="prepararEstadoDoenca"){
    const pedido=PedidoEstadoDoenca.parse(raw),agora=deps.agora(),hoje=dataCivilDoServico(agora,"-03:00");
    if(hoje.estado!=="OK"||pedido.data>hoje.dataCivil)return falha(409,"DATA_CLINICA_FUTURA");
    const r=deps.motorF1.retrato(contexto),draftId=`estado-doenca-${randomUUID()}`;
    if(r.integridade.length||r.patientId!==contexto.patientId||r.encounterId!==contexto.encounterId||r.tumorLotId!==contexto.tumorLotId)return falha(409,"RETRATO_INVALIDO");
    const texto=textoRegistro(contexto,pedido);
    const fonte:Fonte={sourceId:`fonte-${draftId}`,classe:"MANUAL",localizador:"Registro médico explícito de estado da doença",
      dataClinica:pedido.data,dataCaptura:agora,versao:"1",contentHash:hashCanonico(pedido)};
    const payload:z.infer<typeof Payload>={kind:"ESTADO_DOENCA_RASCUNHO",contexto,pedido,medicoId:sessao.medicoId,revisaoFatos:r.revisao,
      operationId:`confirmar-${draftId}`,fonte,texto,conteudoHash:""};
    const conteudoHash=selo(payload);payload.conteudoHash=conteudoHash;
    salvarDraft(deps.db,{draftId,patientId:contexto.patientId,sourceId:fonte.sourceId,rawRef:`registro-medico:${draftId}`,
      payload,
      diagnostics:["REVISAO_MEDICA_PENDENTE"],revision:0,criadoEm:agora});
    depoisDoCommit(deps.db, () => deps.sessoes.registrarBundleExibido(token,contexto,[{documentId:draftId,documentVersion:1,conteudoHash,draftId}]));
    return {status:200,body:{codigo:"ESTADO_DOENCA_PREPARADO",contexto,draftId,conteudoHash,texto,criaEventoClinico:false}};
  }
  const pedido=ConfirmacaoEstadoDoenca.parse(raw),draft=lerDraft(deps.db,pedido.draftId),salvo=Payload.safeParse(draft?.payload);
  if(!draft||!salvo.success)return falha(404,"RASCUNHO_NAO_ENCONTRADO");
  const s=salvo.data;
  if(draft.patientId!==contexto.patientId||hashCanonico(s.contexto)!==hashCanonico(contexto)||s.medicoId!==sessao.medicoId
    ||s.conteudoHash!==pedido.conteudoHash||selo(s)!==s.conteudoHash
    ||textoRegistro(s.contexto,s.pedido)!==s.texto||s.fonte.contentHash!==hashCanonico(s.pedido)
    ||s.fonte.sourceId!==`fonte-${draft.draftId}`||s.fonte.classe!=="MANUAL"||s.fonte.dataClinica!==s.pedido.data
    ||s.pedido.patientId!==contexto.patientId||s.pedido.encounterId!==contexto.encounterId||s.pedido.tumorLotId!==contexto.tumorLotId)
      return falha(409,"ESTADO_DOENCA_CONTEUDO_DIVERGENTE");
  const valor={estado:s.pedido.estado,data:s.pedido.data,fundamento:s.pedido.fundamento};
  const esperado={campo:`doenca.estado:${s.pedido.data}`,valor,dataClinica:s.pedido.data};
  const leitura=lerLedgerIntegro(deps.db,contexto.patientId);
  if(leitura.pendenciasIntegridade.some(p=>p.patientId===contexto.patientId))return falha(409,"LEDGER_COM_DIVERGENCIA");
  const anterior=leitura.itens.find(e=>e.operationId===s.operationId);
  if(anterior){const dado=(anterior.payload as {data?:unknown})?.data;
    return anterior.encounterId===contexto.encounterId&&anterior.tumorLotId===contexto.tumorLotId&&anterior.criadoPor.id===sessao.medicoId
      &&hashCanonico(dado)===hashCanonico(esperado)?{status:200,body:{codigo:"REPLAY",eventId:anterior.eventId}}:falha(409,"OPERACAO_DIVERGENTE");}
  if(deps.motorF1.retrato(contexto).revisao!==s.revisaoFatos)return falha(409,"RETRATO_ALTERADO_REPREPARAR");
  const exibido=deps.sessoes.bundleExibido(token,contexto)?.some(d=>d.documentId===draft.draftId&&d.documentVersion===1&&d.conteudoHash===s.conteudoHash);
  if(!exibido)return falha(409,"CONTEUDO_NAO_EXIBIDO");
  const eventId=`evento-${draft.draftId}`;
  const agoraConfirmacao=deps.agora();
  let resultado:ReturnType<typeof confirmar>;
  try {resultado=confirmar(deps.db, { autorizadoEm: agoraConfirmacao, ...contexto,operationId:s.operationId,reviewDecisionId:s.operationId,sessao,em:agoraConfirmacao,
    registros:[{draftId:draft.draftId,expectedRevision:0,eventId,tipo:"FATO",payload:esperado,fontes:[s.fonte],revisao:"CONFIRMADO"}]});}
  catch(error){
    if(error instanceof Error&&error.message==="SESSAO_INVALIDA")return falha(401,"SESSAO_INVALIDA");
    if(error instanceof Error&&["PAYLOAD_FORA_DO_CONTRATO","DRAFT_ENCONTRO_DIVERGENTE","DRAFT_LOTE_DIVERGENTE","CONTEXTO_EXPLICITO_OBRIGATORIO"].includes(error.message))return falha(409,error.message);
    throw error;
  }
  return resultado.estado==="NEGADA"?falha(409,resultado.motivo??"REGISTRO_NEGADO"):{status:200,body:{codigo:resultado.estado,eventId}};
}
