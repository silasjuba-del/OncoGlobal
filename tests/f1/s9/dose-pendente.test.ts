import {expect,it} from 'vitest';
import {abrirAmbiente,cadastrarPaciente,criarDiretorio,removerDiretorio,carregarConsulta,PACIENTE,ENCONTRO} from '../../f0-fecha/fixtures/consulta-completa.js';
import {listarDrafts} from '../../../src/kernel/comandos/portas.js';
import {criarResolverDocumentoLedger} from '../../../src/kernel/ledger/documentos.js';
import {autorizarSaida} from '../../../src/server/autorizacao.js';

const contexto={patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null};
const plano=(dose:string|null)=>({acoesMarcadas:[],receitasMarcadas:['rx-sintetica'],receitas:[{id:'rx-sintetica',medicamento:'Medicamento sintético',dose,orientacao:null,duracao:null,via:null,quantidade:null}],apac:{cid:'',sigtap:'',finalidade:'',competencia:'',estado:'PENDENTE',pendencias:[],emitir:false},retorno:{dias:null,examesAntesDoRetorno:[]},solicitacoes:{laboratorio:[],imagem:[]}});
it.each([null,'PENDENTE','[VERIFICAR]','Não informado','SEM_FONTE','NAO_INFORMADO','A_CONFERIR'])('dose %s fica em rascunho e assinatura direta é recusada',async dose=>{
 const a=await abrirAmbiente(criarDiretorio());try{
  cadastrarPaciente(a);await carregarConsulta(a);
  expect((await a.request('/consulta/flash/rascunho',{...contexto,plano:plano(dose),expectedRevision:null})).status).toBe(201);
  const p=await a.request('/consulta/flash/preparar',{...contexto,plano:plano(dose),idempotencyKey:'preparar-dose-sintetica'});
  expect(p.status).toBe(200);
  const rx=p.data.documentos.find((d:any)=>d.tipoDocumento==='FLASH_RECEITA');
  const reg=p.data.registros.find((r:any)=>r.id===rx.documentId);
  expect((await a.request('/consulta/bundle',{...contexto,draftIds:[reg.id]})).status).toBe(200);
  const r=await a.request('/consulta/confirmar',{...contexto,bloco:'TUDO',registros:[reg],documentosExibidos:[{documentId:rx.documentId,documentVersion:rx.documentVersion}],reconhecerAlertas:[],idempotencyKey:'assinar-dose-sintetica'});
  expect(r.status,JSON.stringify(r.data)).toBe(409);expect(r.data.codigo).toBe('RECEITA_DOSE_PENDENTE');
  expect(a.eventos().filter(e=>e.revisao==='ASSINADO')).toHaveLength(0);
  expect(listarDrafts(a.db,PACIENTE).some(d=>d.draftId===reg.id)).toBe(true);
  expect(await criarResolverDocumentoLedger(a.db).resolver({id:rx.documentId,version:rx.documentVersion})).toBeNull();
  expect(autorizarSaida(a.db,{verbo:'IMPRIMIR',objeto:{tipo:'DOCUMENTO',id:rx.documentId,versao:rx.documentVersion},escopo:{patientId:PACIENTE,encounterId:ENCONTRO},destino:null,idempotencyKey:'imprimir-sintetico'}).ok).toBe(false);
 }finally{await a.close();removerDiretorio(a.dir);}
});
