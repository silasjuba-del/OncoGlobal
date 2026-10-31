import {afterEach,it,expect} from 'vitest';
import {abrirAmbiente,cadastrarPaciente,carregarConsulta,criarDiretorio,removerDiretorio,extrair,vincular,PACIENTE,ENCONTRO} from '../f0-fecha/fixtures/consulta-completa.js';
import {ResultadoSkillClinica} from '../../src/contracts/skillsClinicas.js';
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
 expect(r.data.documentos.find((d:{tipo:string})=>d.tipo==='PEDIDO_EXAMES').texto).toContain('interrompidas');
});
it('referência inventada ou corpus indisponível não vira seleção aceita',async()=>{
 const a=await abrir();const r=await a.app.request('/consulta/skills',{...a.pedido,configuracao:{jornada:{cartoesIds:['INVENTADO']}}});
 expect(r.data.codigo).toBe('REFERENCIA_CORPUS_INDISPONIVEL');
});
