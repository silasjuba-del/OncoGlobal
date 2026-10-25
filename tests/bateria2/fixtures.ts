import { abrirLedger } from '../../src/kernel/ledger/db.js';
import { executarConfirmacao } from '../../src/kernel/comandos/index.js';
import { salvarDraft } from '../../src/kernel/comandos/portas.js';
import { listarEventos } from '../../src/kernel/ledger/ledger.js';
import { criarGerenciadorSessao } from '../../src/server/sessao.js';
import { registrarFontesDutoExibidas } from '../../src/server/exibicaoDutos.js';
import { hashCanonico } from '../../src/rules/conteudoCanonico.js';
import { fonteSintetica, presente } from '../fixtures/triagem.js';

export const EM='2026-10-19T18:00:00Z';
export const ctx:{patientId:string;encounterId:string;tumorLotId:string|null}={patientId:'paciente-sintetico-b2',encounterId:'encontro-sintetico-b2',tumorLotId:'lote-sintetico-b2'};
export const fonte=fonteSintetica('bateria2-sintetica');
export function ambiente(caminho=':memory:') {
 const db=abrirLedger(caminho);
 const sessoes=criarGerenciadorSessao({medicoId:'medico-sintetico-a',crm:'CRM-SINTETICO',senha:'senha-sintetica-bateria2',duracaoMs:86_400_000,agora:()=>EM});
 const login=sessoes.login('senha-sintetica-bateria2')!;
 sessoes.selecionarConsulta(login.token,ctx);
 const acesso={sessoes,token:login.token,agora:EM}; let n=0;
 function seed(tipo:string,payload:unknown,revisao:'ASSINADO'|'CONFIRMADO'='CONFIRMADO',contexto=ctx,supersedesEventId:string|null=null) {
  const id=`b2-seed-${++n}`;
  const draft=salvarDraft(db,{draftId:id,patientId:contexto.patientId,sourceId:id,rawRef:id,payload:{contexto},diagnostics:[],revision:0,criadoEm:EM});
  const r=executarConfirmacao(db,{...contexto,operationId:id,reviewDecisionId:`review-${id}`,sessao:login.sessao,em:EM,registros:[{draftId:id,expectedRevision:draft.revision,eventId:id,tipo,payload,fontes:[fonte],revisao,supersedesEventId}]});
  if(r.estado==='NEGADA')throw Error(JSON.stringify(r));return id;
 }
 function assinar(ciclo='c1',droga='doxorrubicina',doseMg=102,contexto=ctx) {
  const documentId=`rx-${ciclo}`,reviewDecisionId=`review-b2-seed-${n+1}`;
  const data={documentId,documentVersion:1,tipoDocumento:'PRESCRICAO_QT',texto:'Documento inteiramente sintético'};
  const documentoEventId=seed('DOCUMENTO',{data,signature:{documentId,documentVersion:1,documentHash:hashCanonico(data),reviewDecisionId,serverActorId:login.sessao.medicoId}},'ASSINADO',contexto);
  const cicloEventId=seed('Ciclo',{cicloId:ciclo,episodioId:'episodio-b2',numero:1,previstoEm:'2026-10-19',pesoKg:presente(70),origemPeso:'MEDIDO',ciclosSemPesoConsecutivos:0,prescricaoRef:{documentId,documentVersion:1},itens:[{item:1,droga,doseMg,reducaoPct:0}],comMedico:true},'CONFIRMADO',contexto);
  return {documentoEventId,cicloEventId};
 }
 function exibirFontesDuto(eventIds:readonly string[]) {
  const ids=new Set(eventIds),eventos=listarEventos(db,ctx.patientId).filter(e=>ids.has(e.eventId));
  if(eventos.length!==ids.size)throw Error('FONTE_DUTO_SINTETICA_AUSENTE');
  registrarFontesDutoExibidas(sessoes,login.token,ctx,eventos);
 }
 return {db,acesso,login,seed,assinar,exibirFontesDuto};
}
export function entrada(adminId='a1',quantidadeEfetivaMg=64,ciclo='c1',droga='doxorrubicina') {
 const prescricaoRef={documentId:`rx-${ciclo}`,documentVersion:1};
 return {...ctx,prescricaoAssinadaRef:prescricaoRef,fonte,administracao:{adminId,cicloId:ciclo,prescricaoRef,item:1,droga,quantidadeEfetivaMg,status:'COMPLETA' as const,motivo:null as string|null,inicio:'2026-10-19T16:00:00Z',fim:'2026-10-19T17:00:00Z',fonte}};
}
