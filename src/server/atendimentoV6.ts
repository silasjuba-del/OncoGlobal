import { z } from "zod";
import { AtendimentoV6Resposta, BaseAtendimentoV6, ContextoAtendimentoV6, PrepararAtendimentoV6, RascunhoAtendimentoV6 } from "../contracts/api/atendimentoV6.js";
import { lerDraft,listarDrafts,salvarDraft,transacao } from "../kernel/comandos/portas.js";
import { comporDocumentosAtendimentoV6 } from "../modules/documentos/atendimentoV6.js";
import { hashConteudoExibido as hash } from "./sessao.js";
import { lerPaciente, lerEventosComIntegridade } from "./leituras.js";
import { AnotacaoEvolucao } from "../contracts/f1/anotacaoEvolucao.js";
import { dadosDoEvento, eventosVigentes } from "../kernel/projections/snapshot.js";
import type { ServidorDeps } from "./rotas.js";

const Registro=z.object({kind:z.literal("SINTESE_RASCUNHO"),formato:z.literal("ATENDIMENTO_V6"),
 contexto:ContextoAtendimentoV6,requestHash:z.string().regex(/^[a-f0-9]{64}$/),rascunho:RascunhoAtendimentoV6}).strict();
class Recusa extends Error {constructor(readonly codigo:string,readonly status=409){super(codigo);}}
const mesmo=(a:unknown,b:unknown)=>hash(a)===hash(b);
function validarRegistro(bruto:unknown){
 const r=Registro.parse(bruto),{conteudoHash,...conteudo}=r.rascunho;
 if(hash({contexto:r.contexto,requestHash:r.requestHash,...conteudo})!==conteudoHash)throw new Recusa("RASCUNHO_INTEGRIDADE_INVALIDA");
 return r;
}
/** Recupera apenas fontes do servidor. Salva versões inertes; não confirma fatos ou documentos. */
export function operarAtendimentoV6(deps:ServidorDeps,token:string,operacao:"recuperar"|"preparar",raw:unknown){
 const sessao=deps.sessoes.obter(token);if(!sessao)return {status:401,body:{codigo:"SESSAO_INVALIDA"}};
 const pedido=(operacao==="recuperar"?ContextoAtendimentoV6:PrepararAtendimentoV6).safeParse(raw);
 if(!pedido.success)return {status:400,body:{codigo:"PAYLOAD_INVALIDO"}};
 const contexto=ContextoAtendimentoV6.parse({patientId:pedido.data.patientId,encounterId:pedido.data.encounterId,tumorLotId:pedido.data.tumorLotId});
 const atual=deps.sessoes.consultaSelecionada(token);
 if(!atual||!mesmo(atual,contexto))return {status:409,body:{codigo:"CONTEXTO_CONSULTA_ALTERADO"}};
 try{return transacao(deps.db,()=>{
  const paciente=lerPaciente(deps.db,contexto.patientId);
  if(!paciente||!deps.motorF1)throw new Recusa("CONTEXTO_CLINICO_INDISPONIVEL");
  const retrato=deps.motorF1.retrato(contexto),refs=new Map(retrato.fatos.map(f=>[hash(f.ref),f]));
  if(!mesmo({patientId:retrato.patientId,encounterId:retrato.encounterId,tumorLotId:retrato.tumorLotId},contexto))throw new Recusa("RETRATO_FORA_CONTEXTO");
  const leitura=lerEventosComIntegridade(deps.db,contexto.patientId);
  const idsNotasContexto=new Set(deps.db.prepare("SELECT eventId FROM clinical_event WHERE patientId=? AND encounterId=? AND tumorLotId IS ?")
   .all(contexto.patientId,contexto.encounterId,contexto.tumorLotId).map(r=>String(r.eventId)));
  const falhasNotas=leitura.pendenciasIntegridade.filter(p=>idsNotasContexto.has(p.eventoId)&&/^AnotacaoEvolucao(?:@1)?$/.test(p.tipo??''));
  const pendenciasAnotacoes=falhasNotas.map(p=>`Anotação ${p.eventoId} indisponível: integridade a conferir.`);
  const anotacoes=eventosVigentes(leitura.itens).filter(e=>e.tipo==='AnotacaoEvolucao'&&e.encounterId===contexto.encounterId
   &&e.tumorLotId===contexto.tumorLotId&&e.revisao==='CONFIRMADO').flatMap(e=>{
    const nota=AnotacaoEvolucao.parse(dadosDoEvento(e));
    const origem=leitura.itens.find(m=>m.eventId===nota.origemMensagem.eventId&&m.tipo==='ChatMessage');
    if(!mesmo(nota.contexto,contexto)||e.criadoPor.tipo!=='SESSAO'||e.criadoPor.id!==nota.atorId
     ||!origem||origem.patientId!==contexto.patientId||origem.encounterId!==contexto.encounterId||origem.tumorLotId!==contexto.tumorLotId
     ||hash(origem)!==nota.origemMensagem.contentHash||dadosDoEvento(origem)?.mensagemId!==nota.mensagemId
     ||nota.aceitaEm!==e.criadoEm){pendenciasAnotacoes.push(`Anotação ${e.eventId} indisponível: proveniência a conferir.`);return [];}
    return [{texto:nota.texto,autor:nota.atorId,em:nota.aceitaEm,mensagemId:nota.mensagemId,eventId:e.eventId,mensagemEventId:origem.eventId,hashMensagem:nota.origemMensagem.contentHash}];
   });
  const base=BaseAtendimentoV6.parse({revisao:anotacoes.length||pendenciasAnotacoes.length?hash({retrato:retrato.revisao,anotacoes,pendenciasAnotacoes}):retrato.revisao,pacienteNome:paciente.nome,dataReferencia:retrato.dataClinicaEncontro??null,
   recuperadoEm:deps.agora(),delta:retrato.delta,anotacoesChat:anotacoes,pendenciasAnotacoes,
   integridade:retrato.integridade.filter(i=>!falhasNotas.some(n=>n.eventoId===i.eventoId)).map(i=>`A conferir: ${i.eventoId} · ${i.motivo}`),
   citacoes:retrato.resumo.map(c=>({texto:c.fatos.length===1&&refs.get(hash(c.fatos[0]))?.tipo==="Weight"
    && typeof refs.get(hash(c.fatos[0]))?.dados.kg==="number"
      ?`Peso registrado: ${refs.get(hash(c.fatos[0]))!.dados.kg} kg · origem: ${refs.get(hash(c.fatos[0]))!.dados.origem}.`:c.texto,
    referencias:c.fatos.map(ref=>{
    const f=refs.get(hash(ref));if(!f)throw new Recusa("RESUMO_SEM_REFERENCIA_VIGENTE");
    return {ref:f.ref,tempoClinico:f.tempoClinico,tempoRegistro:f.tempoRegistro,unidade:typeof f.dados.unidade==="string"?f.dados.unidade:null,fontes:f.fontes};
   })}))});
  const versoes=listarDrafts(deps.db,contexto.patientId).flatMap(d=>{
   const p=d.payload;if(!p||typeof p!=="object"||!("formato" in p)||p.formato!=="ATENDIMENTO_V6")return [];
   const r=validarRegistro(p);if(!mesmo(r.contexto,contexto))return [];
   if(r.rascunho.id!==d.draftId)throw new Recusa("RASCUNHO_INTEGRIDADE_INVALIDA");return [r.rascunho];
  }).sort((a,b)=>b.versao-a.versao);
  if(new Set(versoes.map(r=>r.versao)).size!==versoes.length)throw new Recusa("VERSAO_RASCUNHO_CONFLITANTE");
  const resposta=(codigo:AtendimentoV6Resposta["codigo"],rascunho:RascunhoAtendimentoV6|null)=>AtendimentoV6Resposta.parse({codigo,
   formato:"ONCOLOGIA_V6",contexto,base,rascunho,estadoRascunho:!rascunho?"AUSENTE":rascunho.revisaoBase===base.revisao?"ATUAL":"DESATUALIZADO",
   criaEventoClinico:false,assinado:false});
  if(operacao==="recuperar")return {status:200,body:resposta("ATENDIMENTO_BASE",versoes[0]??null)};
  const p=PrepararAtendimentoV6.parse(raw),requestHash=hash({...p,medicoId:sessao.medicoId}),id=`atendimento-v6:${hash(p.idempotencyKey)}`;
  const anterior=lerDraft(deps.db,id);
  if(anterior){const r=validarRegistro(anterior.payload);
   if(anterior.patientId!==contexto.patientId||!mesmo(r.contexto,contexto)||r.requestHash!==requestHash)throw new Recusa("IDEMPOTENCIA_CONFLITO");
   return {status:200,body:resposta("ATENDIMENTO_REPLAY",r.rascunho)};
  }
  if(p.expectedBaseHash!==base.revisao)throw new Recusa("RETRATO_ALTERADO_RECARREGAR");
  if(p.expectedVersion!==(versoes[0]?.versao??null))throw new Recusa("VERSAO_RASCUNHO_CONFLITANTE");
  const conteudo={id,versao:(versoes[0]?.versao??0)+1,revisaoBase:base.revisao,entrada:p.entrada,dataClinica:base.dataReferencia,
   referenciasBase:{retratoRevisao:retrato.revisao,anotacaoEventIds:anotacoes.map(n=>n.eventId)},
   autor:{medicoId:sessao.medicoId,crm:sessao.crm},salvoEm:deps.agora(),documentos:comporDocumentosAtendimentoV6(base,p.entrada)};
  const rascunho=RascunhoAtendimentoV6.parse({...conteudo,conteudoHash:hash({contexto,requestHash,...conteudo})});
  salvarDraft(deps.db,{draftId:id,patientId:contexto.patientId,sourceId:`atendimento-v6:${base.revisao}`,rawRef:`retrato-local:${retrato.revisao}`,
   payload:Registro.parse({kind:"SINTESE_RASCUNHO",formato:"ATENDIMENTO_V6",contexto,requestHash,rascunho}),
   revision:0,diagnostics:["REVISAO_MEDICA_OBRIGATORIA","NAO_ASSINADO"],criadoEm:rascunho.salvoEm});
  const gravado=lerDraft(deps.db,id);if(!gravado||!mesmo(validarRegistro(gravado.payload).rascunho,rascunho))throw new Recusa("RASCUNHO_NAO_VERIFICADO");
  return {status:201,body:resposta("ATENDIMENTO_PREPARADO",rascunho)};
 });}catch(e){return {status:e instanceof Recusa?e.status:503,body:{codigo:e instanceof Recusa?e.codigo:"ATENDIMENTO_INDISPONIVEL"}};}
}

/** Resolve a versão escolhida sem aceitar texto clínico enviado pelo cliente. */
export function resolverEvolucaoFlash(deps: ServidorDeps, token: string,
 contexto: import("./flash.js").ContextoFlash,
 referencia: NonNullable<import("../contracts/api/flash.js").PlanoFlash["evolucaoAtendimento"]>) {
 const resultado = operarAtendimentoV6(deps, token, "recuperar", contexto);
 const leitura = AtendimentoV6Resposta.safeParse(resultado.body);
 if (!leitura.success || leitura.data.estadoRascunho !== "ATUAL") return null;
 const r = leitura.data.rascunho;
 if (!r || r.id !== referencia.id || r.versao !== referencia.versao || r.conteudoHash !== referencia.conteudoHash) return null;
 const documento = r.documentos.find(d => d.tipo === "EVOLUCAO");
 if (!documento || documento.estado !== "PRONTO_PARA_REVISAO") return null;
 return { referencia, texto: documento.texto.replace(/^RASCUNHO — revisão e assinatura pendentes\n/, ""),
  autor: r.autor, dataClinica: r.dataClinica };
}
