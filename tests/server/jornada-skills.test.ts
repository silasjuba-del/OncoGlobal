import {afterEach,it,expect} from 'vitest';
import {abrirAmbiente,cadastrarPaciente,carregarConsulta,criarDiretorio,removerDiretorio,extrair,vincular,PACIENTE,ENCONTRO,AGORA} from '../f0-fecha/fixtures/consulta-completa.js';
import {ResultadoSkillClinica} from '../../src/contracts/skillsClinicas.js';
import {operarSkillsClinicas} from '../../src/server/skillsClinicas.js';
import {carregarCorpusServidor} from '../../src/server/corpus.js';
import type {ServidorDeps} from '../../src/server/rotas.js';
import {criarGateway,memoriaIdempotencia} from '../../src/kernel/gateway/gateway.js';
import {salvarDraft} from '../../src/kernel/ledger/drafts.js';
import {confirmar} from '../../src/kernel/ledger/writeRouter.js';
import {presente,fonteSintetica} from '../fixtures/triagem.js';
import {lerConsulta} from '../../src/server/leituras.js';
import {opcoesLeituraConsulta} from '../../src/server/rotas/confirmacao.js';
import {lerDraft} from '../../src/kernel/ledger/drafts.js';
let app:Awaited<ReturnType<typeof abrirAmbiente>>|undefined,dir:string|undefined;
afterEach(async()=>{await app?.close();if(dir)removerDiretorio(dir);app=undefined;dir=undefined;});
const contexto={patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null};
async function abrir(text='Histologia: adenocarcinoma sintético. EGFR pendente.'){
 dir=criarDiretorio();app=await abrirAmbiente(dir);cadastrarPaciente(app);await carregarConsulta(app);
 const f=await extrair(app,{sourceId:'laudo-jornada-sintetico',sourceType:'imaging_report',text});
 const v=await vincular(app,f,'laudo-jornada-sintetico');expect(v.status).toBe(200);
 return {app,pedido:{acao:'EXECUTAR',contexto,skillId:'retorno',versao:'1.0.0',operationId:'jornada-sintetica-001',
   fontes:[{draftId:f.draftId,expectedRevision:v.data.revision}],configuracao:{documentos:['RESUMO_CASO','EVOLUCAO','PEDIDO_EXAMES','ENCAMINHAMENTO'],
    jornada:{cartoesIds:['PUL-26'],acoesIds:['EX-08','EN-01'],discutirTratamento:true}}}};
}
it('corpus validável, fontes e referências chegam à jornada e persistem sem emitir pedidos',async()=>{
 const a=await abrir();const antes=a.app.eventos().length;
 const cat=ResultadoSkillClinica.parse((await a.app.request('/consulta/skills',{acao:'CATALOGO'})).data);
 if(cat.codigo!=='SKILLS_DISPONIVEIS')throw Error();
 expect(cat.skills.map(s=>s.id)).toEqual(['primeira-consulta','retorno','follow-up']);expect(cat.corpus?.cartoes).toHaveLength(44);
 expect(JSON.stringify(cat)).not.toContain('C:\\Users');
 const fs=await a.app.request('/consulta/skills',{acao:'FONTES',contexto});
 expect(fs.data.fontes[0]).toMatchObject({draftId:a.pedido.fontes[0]!.draftId,revision:a.pedido.fontes[0]!.expectedRevision});
 const r=await a.app.request('/consulta/skills',a.pedido);expect(r.status,JSON.stringify(r.data)).toBe(200);
 const out=ResultadoSkillClinica.parse(r.data);if(out.codigo!=='SKILL_PREPARADA')throw Error();
 expect(out.execucao.jornada?.tipo).toBe('RETORNO');expect(out.execucao.jornada?.cartoes[0]?.id).toBe('PUL-26');
 expect(out.execucao.jornada?.etapas.map(e=>e.id)).toContain('S06');
 expect(out.documentos.find(d=>d.tipo==='PEDIDO_EXAMES')?.texto).toContain('EX-08');
 expect(out.documentos.find(d=>d.tipo==='ENCAMINHAMENTO')?.texto).toContain('EN-01');
 expect(out.execucao.jornada?.autorizaTratamento).toBe(false);expect(a.app.eventos()).toHaveLength(antes);
 await a.app.close();app=await abrirAmbiente(dir!);await carregarConsulta(app);
 const read=await app.request('/consulta/skills',{acao:'LER',contexto,execucaoId:out.execucao.execucaoId});
 expect(read.data).toMatchObject({validade:'ATUAL',execucao:out.execucao,documentos:out.documentos});
});
it('follow-up não aciona QT sem pedido e não presume uma linha por recidiva',async()=>{
 const a=await abrir();const r=await a.app.request('/consulta/skills',{...a.pedido,skillId:'follow-up',configuracao:{jornada:{acoesIds:['FU-02']}}});
 expect(r.status,JSON.stringify(r.data)).toBe(200);
 expect(r.data.execucao.jornada.etapas.map((e:{id:string})=>e.id)).toContain('S09');
 expect(r.data.execucao.jornada.etapas.map((e:{id:string})=>e.id)).not.toContain('S08');
 expect(r.data.execucao.jornada.cartoes).toEqual([]);
});
it('retorno sem laudo novo usa o prontuário; primeira consulta continua exigindo kit',async()=>{
 const a=await abrir();
 expect((await a.app.request('/consulta/skills',{...a.pedido,fontes:[]})).status).toBe(200);
 expect((await a.app.request('/consulta/skills',{...a.pedido,skillId:'primeira-consulta',fontes:[]})).status).toBe(400);
});
it('suspeita radiológica interrompe propostas eletivas sem apagar fonte nem virar diagnóstico',async()=>{
 const a=await abrir('Hidronefrose à direita com afilamento cortical e invasão tumoral. Caso sintético.');
 const r=await a.app.request('/consulta/skills',a.pedido);expect(r.status,JSON.stringify(r.data)).toBe(200);
 expect(r.data.execucao.jornada.estado).toBe('URGENTE');
 expect(r.data.execucao.jornada.alertas[0].sourceId).toBe('laudo-jornada-sintetico');
 expect(r.data.execucao.jornada.cartoes).toEqual([]);expect(r.data.execucao.jornada.acoes).toEqual([]);
 expect(r.data.execucao.jornada.divergencias).toEqual([]);expect(r.data.execucao.jornada.fontes).toEqual([]);
 expect(r.data.execucao.jornada.criterios.some((c:{id:string})=>c.id.startsWith('aplicabilidade:'))).toBe(false);
 expect(r.data.documentos.find((d:{tipo:string})=>d.tipo==='PEDIDO_EXAMES').texto).toContain('interrompidas');
});
it('follow-up sem triagem atual não anuncia urgência completamente avaliada',async()=>{
 const a=await abrir();const r=await a.app.request('/consulta/skills',{...a.pedido,skillId:'follow-up',fontes:[],configuracao:{}});
 expect(r.status).toBe(200);
 expect(r.data.execucao.jornada.etapas.find((e:{id:string})=>e.id==='S01').estado).toBe('PENDENTE');
 expect(r.data.execucao.jornada.pendencias.join(' ')).toContain('URGÊNCIA');
});
it('instalação sem corpus conserva o documento e explicita avaliação incompleta',async()=>{
 const a=await abrir();const deps:ServidorDeps={db:a.app.db,sessoes:a.app.sessoes,agora:()=>AGORA,log:()=>{},corpus:null,salaoRuleset:null,
  gateway:criarGateway({agora:()=>AGORA,auditar:()=>{},store:memoriaIdempotencia(),executores:{}})};
 const r=operarSkillsClinicas({...a.pedido,configuracao:{}},a.app.token,deps);
 expect(r.status).toBe(200);const out=ResultadoSkillClinica.parse(r.body);
 if(out.codigo!=='SKILL_PREPARADA')throw Error();
 expect(out.execucao.jornada?.etapas.find(e=>e.id==='S01')?.estado).toBe('PENDENTE');
 expect(out.execucao.jornada?.pendencias.join(' ')).toContain('CORPUS INDISPONÍVEL');
 expect(out.documentos.length).toBeGreaterThan(0);expect(out.criaEventoClinico).toBe(false);
});
it('referência inventada ou corpus indisponível não vira seleção aceita',async()=>{
 const a=await abrir();const r=await a.app.request('/consulta/skills',{...a.pedido,configuracao:{jornada:{cartoesIds:['INVENTADO']}}});
 expect(r.data.codigo).toBe('REFERENCIA_CORPUS_INDISPONIVEL');
});
it('mudança de regra RADS invalida rascunho mesmo com fonte e ledger inalterados',async()=>{
 const a=await abrir();const r=await a.app.request('/consulta/skills',a.pedido);expect(r.status).toBe(200);
 const corpus=carregarCorpusServidor();
 const deps:ServidorDeps={db:a.app.db,sessoes:a.app.sessoes,agora:()=>AGORA,log:()=>{},corpus,salaoRuleset:corpus.ruleset,
  gateway:criarGateway({agora:()=>AGORA,auditar:()=>{},store:memoriaIdempotencia(),executores:{}})};
 const pedido={acao:'LER',contexto,execucaoId:r.data.execucao.execucaoId};
 expect(operarSkillsClinicas(pedido,a.app.token,deps).body).toMatchObject({validade:'ATUAL'});
 corpus.rads.versao='versao-sintetica-alterada';
 expect(operarSkillsClinicas(pedido,a.app.token,deps).body).toMatchObject({validade:'ENTRADA_ALTERADA'});
});
it('execução com impressão digital anterior continua legível como histórico, sem reescrever documentos',async()=>{
 const a=await abrir();const r=await a.app.request('/consulta/skills',a.pedido);expect(r.status).toBe(200);
 const d=lerDraft(a.app.db,r.data.execucao.execucaoId)!;
 salvarDraft(a.app.db,{...d,revision:d.revision+1,payload:{...r.data.execucao,jornada:{...r.data.execucao.jornada,corpusHash:'politica-anterior-sintetica'}}});
 const l=await a.app.request('/consulta/skills',{acao:'LER',contexto,execucaoId:r.data.execucao.execucaoId});
 expect(l.status).toBe(200);expect(l.data.validade).toBe('ENTRADA_ALTERADA');expect(l.data.documentos).toEqual(r.data.documentos);
});
it.each(['primeira-consulta','retorno','follow-up'])('%s preserva fontes e rascunhos no reinício; replay não duplica',async(skillId)=>{
 const a=await abrir();const pedido={...a.pedido,skillId,configuracao:{jornada:{acoesIds:skillId==='follow-up'?['FU-02']:['EX-08']}}};
 const antes=a.app.eventos().length;
 const r=await a.app.request('/consulta/skills',pedido);expect(r.status,JSON.stringify(r.data)).toBe(200);
 const replay=await a.app.request('/consulta/skills',pedido);expect(replay.data.codigo).toBe('SKILL_REPLAY');
 expect(replay.data.documentos).toEqual(r.data.documentos);
 expect(r.data.documentos.every((d:{estado:string;assinatura:unknown})=>d.estado==='RASCUNHO'&&d.assinatura===null)).toBe(true);
 await a.app.close();app=await abrirAmbiente(dir!);await carregarConsulta(app);
 const l=await app.request('/consulta/skills',{acao:'LER',contexto,execucaoId:r.data.execucao.execucaoId});
 expect(l.data).toMatchObject({validade:'ATUAL',documentos:r.data.documentos});expect(app.eventos()).toHaveLength(antes);
});
it('retorno conserva o alerta condicional que já existe na consulta e a política invalida a leitura antiga',async()=>{
 const a=await abrir();const ctx={...contexto,tumorLotId:'lote-auditoria-sintetico'};
 function registrar(tipo:string,payload:unknown,id:string) {
  salvarDraft(a.app.db,{draftId:id,patientId:PACIENTE,sourceId:id,rawRef:id,payload:{},diagnostics:[],revision:0,criadoEm:AGORA});
  const r=confirmar(a.app.db,{...ctx,operationId:`op-${id}`,sessao:a.app.sessoes.obter(a.app.token)!,reviewDecisionId:`revisao-${id}`,em:AGORA,
   registros:[{draftId:id,expectedRevision:0,eventId:`ev-${id}`,tipo,payload,fontes:[fonteSintetica(id)],revisao:'CONFIRMADO'}]});
  expect(r.estado).toBe('GRAVADA');
 }
 registrar('TumorLot',{patientId:PACIENTE,tumorLotId:ctx.tumorLotId,cid:presente('C34.9'),topografia:presente('Pulmão sintético'),histologia:presente('Adenocarcinoma sintético'),estadiamentos:[],finalidadeApac:presente('PALIATIVA'),marcos:[]},'lote-auditoria');
 registrar('TreatmentEpisode',{episodioId:'ep-auditoria',tumorLotId:ctx.tumorLotId,modalidade:'QT',intencao:'PALIATIVA',intentModifier:null,linha:1,esquemaId:'esquema-sintetico',inicio:presente('2026-10-01'),fim:presente('2026-10-09')},'ep-auditoria');
 registrar('Ciclo',{cicloId:'c-auditoria',episodioId:'ep-auditoria',numero:1,previstoEm:'2026-10-09',pesoKg:presente(70),origemPeso:'MEDIDO',ciclosSemPesoConsecutivos:0,prescricaoRef:null,itens:[{item:1,droga:'cisplatina',doseMg:100,reducaoPct:0}],comMedico:true},'c-auditoria');
 registrar('FATO',{campo:'condicionaisCiclo',valor:{alergias:{lista:[{agente:'carboplatina',presente:true,fonte:'historia-sintetica'}],historicoConferido:true,fonte:'historia-sintetica'}}},'alergia-auditoria');
 a.app.sessoes.selecionarConsulta(a.app.token,ctx);
 const corpus=carregarCorpusServidor(),sessao=a.app.sessoes.obter(a.app.token)!;
 const deps:ServidorDeps={db:a.app.db,sessoes:a.app.sessoes,agora:()=>AGORA,log:()=>{},corpus,salaoRuleset:corpus.ruleset,
  gateway:criarGateway({agora:()=>AGORA,auditar:()=>{},store:memoriaIdempotencia(),executores:{}})};
 const consulta=lerConsulta(a.app.db,PACIENTE,AGORA,sessao,ctx.tumorLotId,{...opcoesLeituraConsulta(deps,sessao),encounterId:ENCONTRO});
 if(!('elegibilidade' in consulta)||!consulta.elegibilidade)throw Error('consulta ausente');
 const avisos=consulta.elegibilidade.motivos.filter(m=>m.origem==='condicionais').map(m=>m.texto);
 expect(avisos.length).toBeGreaterThan(0);
 const r=await a.app.request('/consulta/skills',{...a.pedido,contexto:ctx,fontes:[],configuracao:{}});
 expect(r.status,JSON.stringify(r.data)).toBe(200);expect(r.data.execucao.jornada.seguranca).toEqual(expect.arrayContaining(avisos));
 const ler={acao:'LER',contexto:ctx,execucaoId:r.data.execucao.execucaoId};
 expect(operarSkillsClinicas(ler,a.app.token,deps).body).toMatchObject({validade:'ATUAL'});
 corpus.condicionais.regras[0]!.versao='auditoria-versao-alterada';
 expect(operarSkillsClinicas(ler,a.app.token,deps).body).toMatchObject({validade:'ENTRADA_ALTERADA'});
});
