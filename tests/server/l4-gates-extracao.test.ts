import {expect,it,afterEach} from 'vitest';
import {abrirAmbiente,cadastrarPaciente,carregarConsulta,criarDiretorio,removerDiretorio,extrair,confirmarFatos,PACIENTE,ENCONTRO,AGORA} from '../f0-fecha/fixtures/consulta-completa.js';
import {RevisaoPreparada} from '../../src/contracts/api/revisaoExtracao.js';
import {salvarDraft} from '../../src/kernel/comandos/portas.js';
import {executarConfirmacao} from '../../src/kernel/comandos/index.js';
let a:Awaited<ReturnType<typeof abrirAmbiente>>|undefined;
afterEach(async()=>{if(a){await a.close();removerDiretorio(a.dir);a=undefined;}});
async function abrir(){a=await abrirAmbiente(criarDiretorio());cadastrarPaciente(a);await carregarConsulta(a);return a;}
it.each([['biópsia',false],['ressecção cirúrgica',true],['não informado',false]])('pTNM de %s não é promovido sem prova; laboratório independente segue',async(material,promove)=>{
 const a=await abrir();const e=await extrair(a,{sourceId:'path-sintetico',sourceType:'pathology',text:`Paciente: ${PACIENTE}\nMaterial: ${material}\nPaciente atualmente com pT2N0M0\n09/10/2026 Hemoglobina 11,5 g/dL.`});
 const ids=e.facts.filter(f=>['stage','lab'].includes(f.domain)).map(f=>f.id);expect(ids.length).toBeGreaterThan(1);
 const fluxo=await confirmarFatos(a,e,ids,`g09-${material}`);expect(fluxo.preview.status).toBe(200);
 const r=await fluxo.confirmar(fluxo.preview.data.comprovanteExibicao);expect(r.status).toBe(200);
 const gravados=a.eventos().filter(e=>e.operationId===fluxo.selecao.operationId);
 const fatos=gravados.filter(e=>e.tipo==='FATO').map(e=>(e.payload as {data:{domain:string}}).data);
 expect(fatos.some(f=>f.domain==='lab'),JSON.stringify(e.facts)).toBe(true);expect(fatos.some(f=>f.domain==='stage')).toBe(promove);
 expect((await fluxo.confirmar(fluxo.preview.data.comprovanteExibicao)).data.codigo).toBe('REPLAY');
});
it('divergência G08 exige ciência específica e preserva o alerta no fato e no recibo',async()=>{
 const a=await abrir(),cadastro=a.eventos().find(e=>e.tipo==='Paciente')!;
 salvarDraft(a.db,{draftId:'sexo-cadastro',patientId:PACIENTE,sourceId:'cadastro',rawRef:'cadastro',payload:{},revision:0,diagnostics:[],criadoEm:AGORA});
 executarConfirmacao(a.db,{patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null,operationId:'sexo-cadastro',reviewDecisionId:'sexo-cadastro',sessao:a.sessoes.obter(a.token)!,em:AGORA,
  registros:[{draftId:'sexo-cadastro',expectedRevision:0,eventId:'sexo-cadastro',tipo:'Paciente',payload:{patientId:PACIENTE,nome:PACIENTE,identificadores:[],nascimento:null,sexoCadastral:'F',divergencia:false},fontes:[],revisao:'CONFIRMADO',supersedesEventId:cadastro.eventId}]});
 const e=await extrair(a,{sourceId:'anatomia-sintetica',sourceType:'pathology',text:`Paciente: ${PACIENTE}\nPaciente atualmente com carcinoma de próstata.`});
 const ids=e.facts.filter(f=>f.domain==='diagnosis').map(f=>f.id);expect(ids).toHaveLength(1);
 const fluxo=await confirmarFatos(a,e,ids,'g08-ciencia');expect(fluxo.preview.status).toBe(200);
 const previa=RevisaoPreparada.parse(fluxo.preview.data);expect(previa.conteudo.verificacoesClinicas,JSON.stringify(e.facts)).toBeDefined();const ciencias=previa.conteudo.verificacoesClinicas!.filter(g=>g.decisao==='ALERTA').map(g=>g.id);expect(ciencias).toHaveLength(1);
 const antes=a.eventos();expect(await fluxo.confirmar(previa.comprovanteExibicao)).toMatchObject({status:409,data:{codigo:'CIENCIA_GATES_OBRIGATORIA'}});expect(a.eventos()).toEqual(antes);
 const pedido={...fluxo.selecao,comprovanteExibicao:previa.comprovanteExibicao,cienciasGates:ciencias};
 expect((await a.request('/consulta/rascunho/revisar',{...pedido,cienciasGates:['outro-alerta']})).status).toBe(409);
 expect((await a.request('/consulta/rascunho/revisar',pedido)).status).toBe(200);
 const registros=a.eventos().filter(e=>e.operationId==='g08-ciencia');
 expect(registros.some(e=>e.tipo==='FATO'&&JSON.stringify(e.payload).includes(ciencias[0]!))).toBe(true);
 expect(registros.some(e=>e.tipo==='ReviewDecision'&&JSON.stringify(e.payload).includes('cienciasGatesConfirmadas'))).toBe(true);
 expect((await a.request('/consulta/rascunho/revisar',pedido)).data.codigo).toBe('REPLAY');
});
it('G07 confronta fontes da mesma lesão neste contexto e exige ciência do novo alerta',async()=>{
 const a=await abrir();
 const path=await extrair(a,{sourceId:'path-lado',sourceType:'pathology',text:`Paciente: ${PACIENTE}\nLesão L1: paciente atualmente com carcinoma de mama direita.`});
 const primeira=await confirmarFatos(a,path,path.facts.filter(f=>f.domain==='diagnosis').map(f=>f.id),'g07-primeira');
 expect((await primeira.confirmar(primeira.preview.data.comprovanteExibicao)).status).toBe(200);
 const rads=await extrair(a,{sourceId:'rads-lado',sourceType:'imaging_report',text:`Paciente: ${PACIENTE}\nLesão L1: paciente atualmente com carcinoma de mama esquerda.`});
 const segunda=await confirmarFatos(a,rads,rads.facts.filter(f=>f.domain==='diagnosis').map(f=>f.id),'g07-segunda');
 expect(segunda.preview.status).toBe(200);
 const previa=RevisaoPreparada.parse(segunda.preview.data),alerta=previa.conteudo.verificacoesClinicas?.find(g=>g.gate==='G-07'&&g.decisao==='ALERTA');
 expect(alerta).toBeDefined();expect(alerta?.sourceIds).toEqual(['path-lado','rads-lado']);
 const antes=a.eventos();expect((await segunda.confirmar(previa.comprovanteExibicao)).status).toBe(409);expect(a.eventos()).toEqual(antes);
 const pedido={...segunda.selecao,comprovanteExibicao:previa.comprovanteExibicao,cienciasGates:[alerta!.id]};
 expect((await a.request('/consulta/rascunho/revisar',pedido)).status).toBe(200);
 expect((await a.request('/consulta/rascunho/revisar',pedido)).data.codigo).toBe('REPLAY');
});
