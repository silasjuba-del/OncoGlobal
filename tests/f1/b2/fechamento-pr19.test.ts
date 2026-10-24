import {expect,it} from 'vitest';
import {readFileSync, mkdtempSync, cpSync, writeFileSync, realpathSync, rmSync} from 'node:fs';
import {join, dirname, basename} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {RulesetHeader} from '../../../src/contracts/agentes.js';
const ler=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const manifesto=ler('corpus/manifesto/b2-fichas.v1.json');
const fichas=manifesto.fichasNovas.map((f:any)=>ler(f.arquivo));
const pack=(slug:string)=>ler(`corpus/6-pack-tumor/${slug}/pack-${slug}.v2.RASCUNHO.json`);
it('quadros médicos preservam fontes e situação do manifesto por ocorrência',()=>{
 const quadros=readFileSync('docs/ondas/F1-B2-QUADROS.md','utf8');
 for(const f of manifesto.fichasNovas){
  const ficha=ler(f.arquivo), titulo=`### ${ficha.nome} — ${ficha.cenario}`;
  const secao=quadros.split(titulo)[1]?.split('\n### ')[0]; expect(secao,titulo).toBeDefined();
  for(const i of ficha.itens){
   const c=f.campos.find((c:any)=>c.campo===`itens[drug=${i.drug};classe=${i.classe};days=${i.days.join(',')}].standardDose`);
   const linha=secao!.split('\n').find(l=>l.startsWith(`| ${i.sequence} | ${i.drug} | ${i.classe} |`));
   expect(linha).toBeDefined();
   for(const id of c.sourceIds??[])expect(linha).toContain(id);
   if(c.situacao==='NAO_LOCALIZADO')expect(linha).toContain('NAO_LOCALIZADO');
  }
  if(ficha.itens.some((i:any)=>i.sequenciamentoPendente))expect(secao).toContain('Sequenciamento pendente');
 }
});
it('rascunhos B2 não atribuem curador nem aprovação médica',()=>{
 for(const slug of ['ewing','osteossarcoma','cec-pele','ntg','vulva','cup']){
  const p=pack(slug);
  expect(p.header.curador).toBeNull();expect(p.header.aprovadoEm).toBeNull();
  expect(p.header.schema).toBe('CabecalhoRascunho@1');
  expect(p.curadoria.aprovacaoClinica).toBeNull();expect(p.alerta).toBe(false);
  expect(RulesetHeader.safeParse(p.header).success).toBe(false);
 }
});
it('remover o schema de rascunho não contorna o validador B2 integrado ao check:corpus',()=>{
 const root=mkdtempSync(join(tmpdir(),'b2-header-'));
 try {
  cpSync('corpus',join(root,'corpus'),{recursive:true});
  const arquivo=join(root,'corpus/6-pack-tumor/ewing/pack-ewing.v2.RASCUNHO.json');
  const p=JSON.parse(readFileSync(arquivo,'utf8'));
  p.header={id:'fixture',versao:'1.0.0',vigenteDesde:'2026-10-17',fonte:{tipo:'DECISAO_MEDICA',referencia:'fixture',trecho:null,edicao:null},curador:'fixture',aprovadoEm:'2026-10-17'};
  writeFileSync(arquivo,JSON.stringify(p));
  const resultado=spawnSync(process.execPath,['--input-type=module','-e',"import {verificarB2} from './scripts/corpus-b2.mjs'; console.log(JSON.stringify(verificarB2(process.argv[1])));",root],{encoding:'utf8'});
  expect(resultado.status,resultado.stderr).toBe(0);
  expect(JSON.parse(resultado.stdout)).toContain('pack ewing atribui aprovação indevida ao rascunho');
 } finally {
  const real=realpathSync(root);
  if(dirname(real)!==realpathSync(tmpdir())||basename(real)!==basename(root)||!basename(real).startsWith('b2-header-'))throw new Error('TEMP_FORA_ESCOPO');
  rmSync(real,{recursive:true,force:true});
 }
});
it('fase VDC limita doxorrubicina a cinco administrações e continua em VC sem antraciclina',()=>{
 const vdc=fichas.find((f:any)=>f.nome.startsWith('Ewing VDC'));
 const vc=fichas.find((f:any)=>f.nome.startsWith('Ewing VC '));
 expect(vdc.ciclos).toBe(5);expect(vc).toBeDefined();expect(vc.ciclos).toBe(2);
 const doxo=vdc.itens.find((i:any)=>i.drug==='Doxorrubicina');
 expect(doxo.standardDose*doxo.days.length*vdc.ciclos).toBe(375);
 expect(vc.itens.some((i:any)=>i.drug==='Doxorrubicina')).toBe(false);
 expect(vc.status).toBe('RASCUNHO');
 expect(pack('ewing').tratamento.protocolos.find((p:any)=>p.id==='ewing-vc').fichaId).toBe(vc.templateId);
});
it('pembrolizumabe q21d registra o máximo de 35 administrações do KEYNOTE-629',()=>{
 const p=fichas.find((f:any)=>f.tumor==='CEC de pele (cutâneo)'&&f.nome==='Pembrolizumabe');
 expect(p).toBeDefined();expect(p.ciclos).toBe(35);expect(p.fonte).toContain('KEYNOTE-629');
 expect(pack('cec-pele').tratamento.protocolos.find((p:any)=>p.id==='cec-pembro').numeroCiclos).toBe(35);
});
it('resgate TC inclui o suporte D6 documentado pela eviQ 4245',()=>{
 expect(pack('ewing').tratamento.protocolos.find((p:any)=>p.id==='ewing-tc').drogas)
  .toContainEqual(expect.objectContaining({droga:'pegfilgrastim',dose:6,unidade:'mg',via:'SC',dias:'D6'}));
});
it('vulva mantém a decisão D-F1-50 e só a pendência real de replanejamento',()=>{
 const p=pack('vulva');expect(p.tratamento.radioterapia[0]).toMatchObject({doseTotalGy:57.6,fracoes:32});
 expect(p.pendencias.some((x:any)=>/Dose total de RT|40 Gy/.test(JSON.stringify(x)))).toBe(false);
});

it('fichas preservam os limites de ciclos já documentados nos packs',()=>{
 const casos=[['Primário desconhecido (CUP)','Cisplatina + Docetaxel',8],['Primário desconhecido (CUP)','Docetaxel + Gemcitabina',6],['Vulva','Carboplatina + Paclitaxel 21/21 dias (vulva)',6],['CEC de pele (cutâneo)','Carboplatina + Paclitaxel 21/21 dias (CEC de pele)',6]] as const;
 for(const [tumor,nome,ciclos] of casos){const f=fichas.find((x:any)=>x.tumor===tumor&&x.nome===nome);expect(f,`${tumor}: ${nome}`).toBeDefined();expect(f.ciclos).toBe(ciclos);expect(f.status).toBe('RASCUNHO');}
});
it('indução EP e cisplatina com RT têm teto do curso documentado, sem extrapolar fontes de mama',()=>{
 const cemi=fichas.find((f:any)=>f.nome==='Cemiplimabe');expect(cemi.ciclos).toBe(35);expect(cemi.fonte).toContain('2 anos de calendário');
 expect(fichas.find((f:any)=>f.nome.startsWith('EP de indução')).ciclos).toBe(3);
 for(const f of fichas.filter((f:any)=>f.nome.startsWith('Cisplatina semanal + RxT')))expect(f.ciclos).toBe(6);
 const prostata=ler('corpus/fichas/prostata/carboplatina-paclitaxel-semanal__nao-especificado.json');
 expect(prostata.fonte).not.toContain('Conferido: 80');
 expect(prostata.itens.find((i:any)=>/^paclitaxel/i.test(i.drug)).observacao).toContain('fontes de mama não confirmam');
});
