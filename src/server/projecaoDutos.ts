import { avisosAdministracao, exposicaoLocalMgM2 } from '../modules/salao/medidaAdministracao.js';
import { Apac, type ClinicalEvent } from '../contracts/operacao.js';
import { TreatmentAdministration } from '../contracts/clinico.js';
import { ConferenciaFarmacia, ValidacaoApacPersistida, mesmaPrescricao } from '../contracts/f1/dutos.js';
import { Tarefa } from '../contracts/f1/tarefa.js';
import { DutosClinicaVisao, ContextoDutosVisao } from '../contracts/api/dutos.js';
import { validarReferenciaApac } from '../modules/apac/validacaoPersistida.js';
import { dadosDoEvento, eventosVigentes } from '../kernel/projections/snapshot.js';
import { referenciaSigtapDuto, resolverPrescricaoDuto, type DepsDutos } from './dutos.js';
/** Read-only: o servidor fornece a mesma lista de eventos já lida para a consulta. */
export function projetarDutos(eventos:readonly ClinicalEvent[],ctx:{patientId:string;encounterId:string;tumorLotId:string|null},corpus?:DepsDutos['corpus']):DutosClinicaVisao {
 const contexto=ContextoDutosVisao.parse(ctx),out:DutosClinicaVisao={schema:'DutosClinicaVisao@1',contexto,farmacia:[],tarefas:[],apacs:[],administracoes:[],integridade:[],exposicoesLocais:[]};
 const atuais=eventosVigentes(eventos).filter(e=>e.patientId===ctx.patientId&&e.encounterId===ctx.encounterId&&e.tumorLotId===ctx.tumorLotId&&['CONFIRMADO','ASSINADO'].includes(e.revisao));
 const validar=(eventId:string,codigo:string)=>out.integridade.push({eventId,codigo});
 for(const e of atuais){const dados=dadosDoEvento(e);
  if(e.tipo==='FATO'&&dados?.campo==='farmacia.conferencia'){
   const r=ConferenciaFarmacia.safeParse(dados.valor);if(!r.success){validar(e.eventId,'CONFERENCIA_FORA_CONTRATO');continue;}
   if(r.data.prescricao.patientId!==ctx.patientId||r.data.prescricao.encounterId!==ctx.encounterId||r.data.prescricao.tumorLotId!==ctx.tumorLotId){validar(e.eventId,'CONFERENCIA_FORA_CONTEXTO');continue;}
   const ref=resolverPrescricaoDuto(eventos,contexto,r.data.prescricao),valida=!!ref&&mesmaPrescricao(ref,r.data.prescricao)&&r.data.atorId===e.criadoPor.id&&r.data.em===e.criadoEm;
   out.farmacia.push({eventId:e.eventId,registro:r.data,referenciaValida:valida,motivo:valida?null:'Prescrição ou autoria não corresponde à referência assinada vigente.'});
  }else if(e.tipo==='Tarefa'){
   const t=Tarefa.safeParse(dados);if(!t.success){validar(e.eventId,'TAREFA_FORA_CONTRATO');continue;}
   if(t.data.patientId!==ctx.patientId||t.data.encounterId!==ctx.encounterId||t.data.tumorLotId!==ctx.tumorLotId){validar(e.eventId,'TAREFA_FORA_CONTEXTO');continue;}
   out.tarefas.push({eventId:e.eventId,tarefa:t.data});
  }else if(e.tipo==='TreatmentAdministration'){
   const a=TreatmentAdministration.safeParse(dados);if(!a.success){validar(e.eventId,'ADMINISTRACAO_FORA_CONTRATO');continue;}
   const ref=resolverPrescricaoDuto(eventos,contexto,a.data.prescricaoRef);
   out.administracoes.push({eventId:e.eventId,dados:a.data,avisos:[],prescricao:ref,referenciaValida:!!ref,motivo:ref?null:'Prescrição vigente não localizada; quantidade é observação histórica e requer revisão.'});
  }else if(e.tipo==='APAC'){
   const a=Apac.safeParse(dados);if(!a.success){validar(e.eventId,'APAC_FORA_CONTRATO');continue;}
   if(a.data.tumorLotId!==ctx.tumorLotId){validar(e.eventId,'APAC_FORA_CONTEXTO');continue;}
   const validacoes=atuais.filter(v=>v.tipo==='FATO'&&dadosDoEvento(v)?.campo==='apac.validacaoEmissao').flatMap(v=>{const p=ValidacaoApacPersistida.safeParse(dadosDoEvento(v)?.valor);return p.success&&p.data.apacId===a.data.apacId?[{event:v,valor:p.data}]:[];});
   const v=validacoes.length===1?validacoes[0]!:null,rx=resolverPrescricaoDuto(eventos,contexto,a.data.prescricaoAssinadaRef),sigtap=referenciaSigtapDuto(corpus,a.data.competencia);
   const valida=!!v&&!!rx&&!!sigtap&&v.valor.validadoPor===v.event.criadoPor.id&&v.valor.validadoEm===v.event.criadoEm&&validarReferenciaApac(v.valor,{apac:a.data,prescricao:rx,sigtap});
   const mesmoContexto=v?.valor.patientId===ctx.patientId&&v.valor.encounterId===ctx.encounterId&&v.valor.tumorLotId===ctx.tumorLotId;
   out.apacs.push({eventId:e.eventId,apac:a.data,validacao:mesmoContexto?v!.valor:null,estado:valida&&mesmoContexto?'VALIDADA':'PENDENTE',motivo:valida&&mesmoContexto?null:'Validação administrativa, prescrição ou SIGTAP vigente pendente. Não comprova autorização externa.'});
  }
 }
 const provenienciaPendente:string[]=[];
 const historico=eventosVigentes(eventos).filter(e=>e.patientId===ctx.patientId&&e.tipo==='TreatmentAdministration'&&['CONFIRMADO','ASSINADO'].includes(e.revisao)).flatMap(e=>{
  const a=TreatmentAdministration.safeParse(dadosDoEvento(e));if(!a.success)return [];
  if(!e.fontes.some(f=>f.sourceId===a.data.fonte.sourceId&&f.contentHash===a.data.fonte.contentHash))provenienciaPendente.push(a.data.adminId);
  return [a.data];
 });
 for(const a of out.administracoes)a.avisos=avisosAdministracao(a.dados,historico);
 out.exposicoesLocais=[...new Set(historico.map(a=>a.droga))].map(droga=>exposicaoLocalMgM2(historico,droga,provenienciaPendente));
 return DutosClinicaVisao.parse(out);
}
