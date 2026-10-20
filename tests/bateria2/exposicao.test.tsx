// @vitest-environment jsdom
import { cleanup,render,screen } from '@testing-library/react';
import { afterEach,expect,it } from 'vitest';
import { ExposicaoCumulativaDados } from '../../src/server/f0c/cumulativoClinico.js';
import { calcularTotalExposicao } from '../../src/rules/cumulativoAlerta.js';
import { registrarAdministracaoEfetivaSalaoF3 as registrar } from '../../src/server/salaoF3.js';
import { listarEventos } from '../../src/kernel/comandos/portas.js';
import { projetarDutos } from '../../src/server/projecaoDutos.js';
import { DutosClinica } from '../../src/ui/consulta/DutosClinica.js';
import { ambiente,entrada,ctx,fonte } from './fixtures.js';
import { exposicaoLocalMgM2 } from '../../src/modules/salao/medidaAdministracao.js';
afterEach(cleanup);
it('revisão independente: replay histórico não soma duas vezes, conflito não elege dose',()=>{
 const a={...entrada('replay',102).administracao,superficieCorporalNoDia:{valorM2:1.7,fonte}};
 expect(exposicaoLocalMgM2([a,a],'doxorrubicina').total).toBe(60);
 const conflito=exposicaoLocalMgM2([a,{...a,quantidadeEfetivaMg:45.9}],'doxorrubicina');
 expect(conflito.total).toBeNull();expect(conflito.pendentes).toContain('replay');
});
it('revisão independente: administração legada sem fonte no envelope torna total pendente',()=>{
 const a=ambiente();try {
  a.assinar();const antiga=entrada('legada',102).administracao;
  a.seed('TreatmentAdministration',{...antiga,fonte:{...fonte,sourceId:'fonte-legada-separada'}});
  const nova=entrada('nova',102);Object.assign(nova.administracao,{superficieCorporalNoDia:{valorM2:1.7,fonte}});
  expect(registrar(a.db,a.acesso,nova).ok).toBe(true);
  const exposicao=projetarDutos(listarEventos(a.db,ctx.patientId),ctx).exposicoesLocais![0]!;
  expect(exposicao.total).toBeNull();expect(exposicao.pendentes).toContain('legada');expect(exposicao.administracoes).toHaveLength(2);
 }finally{a.db.close();}
});
it('7A: número externo sem unidade/fármaco/origem não vira total confirmado',()=>{
 const externo={patientId:ctx.patientId,droga:'doxorrubicina',administracoes:[{adminId:'externa',patientId:ctx.patientId,episodioId:'externo',droga:'doxorrubicina',status:'COMPLETA',quantidadeEfetivaMgM2:240,fonte:'Relato da paciente sintética; documento não disponível'}],historicoCompleto:false,fonteCompletude:null};
 expect(ExposicaoCumulativaDados.safeParse(externo).success).toBe(false);
 const explicito={...externo,administracoes:externo.administracoes.map(a=>({...a,unidade:'mg/m2'}))};
 const p=ExposicaoCumulativaDados.parse(explicito);expect(calcularTotalExposicao({...p,administracoes:p.administracoes.map(a=>({...a,realizadaEm:a.realizadaEm??null}))}).totalMgM2).toBeNull();
 expect(ExposicaoCumulativaDados.safeParse({...explicito,administracoes:[{...explicito.administracoes[0],droga:'epirrubicina'}]}).success).toBe(false);
});
it('7B: tela soma somente 102+102+45,9 mg / SC histórica 1,70, não usa SC nova 1,62',()=>{
 const a=ambiente();try{
  for(const [i,dose] of [102,102,45.9].entries()){
   const ciclo=`c${i+1}`;a.assinar(ciclo);
   const p=entrada(`a${i+1}`,dose,ciclo);
   Object.assign(p.administracao,{medidaInformada:{unidade:'mg',valor:dose},superficieCorporalNoDia:{valorM2:1.70,fonte}});
   if(i===2)Object.assign(p.administracao,{status:'INTERROMPIDA',motivo:'Interrupção sintética documentada'});
   expect(registrar(a.db,a.acesso,p).ok).toBe(true);
  }
  a.seed('FATO',{campo:'superficieCorporal',valor:1.62});
  const visao=projetarDutos(listarEventos(a.db,ctx.patientId),ctx);
  expect(visao.exposicoesLocais?.[0]?.total).toBeCloseTo(147,10);
  expect(visao.exposicoesLocais?.[0]?.administracoes.map(x=>x.sc?.valorM2)).toEqual([1.7,1.7,1.7]);
  render(<DutosClinica dados={visao}/>);expect(screen.getByText(/147 mg\/m²/)).toBeTruthy();
  expect(screen.getByText(/Histórico externo separado/)).toBeTruthy();
 }finally{a.db.close();}
});
it('8A/8B: IDs distintos preservados com aviso; unidade ausente nunca fica silenciosa',()=>{
 const a=ambiente();try {
  a.assinar();expect(registrar(a.db,a.acesso,entrada('a1',64)).ok).toBe(true);expect(registrar(a.db,a.acesso,entrada('a2',64)).ok).toBe(true);
  const v=projetarDutos(listarEventos(a.db,ctx.patientId),ctx);expect(v.administracoes).toHaveLength(2);
  expect(v.administracoes.every(x=>x.avisos?.some(t=>t.includes('Unidade de entrada não documentada')))).toBe(true);
  expect(v.administracoes.every(x=>x.avisos?.some(t=>t.includes('registros preservados')))).toBe(true);
 }finally{a.db.close();}
});
it('8B: volume exige concentração da solução e fonte; nunca usa concentração do frasco implícita',()=>{
 const a=ambiente();try{
  a.assinar();const p=entrada('a1',126);
  Object.assign(p.administracao,{medidaInformada:{unidade:'mL',valor:6.3}});
  expect(registrar(a.db,a.acesso,p).ok).toBe(false);
  Object.assign(p.administracao,{medidaInformada:{unidade:'mL',valor:6.3,concentracaoSolucaoMgMl:20,fonteConcentracao:fonte}});
  expect(registrar(a.db,a.acesso,p).ok).toBe(true);
  const errado=entrada('a2',6.3);Object.assign(errado.administracao,{medidaInformada:{unidade:'mL',valor:6.3,concentracaoSolucaoMgMl:20,fonteConcentracao:fonte}});
  expect(registrar(a.db,a.acesso,errado).ok).toBe(false);
 }finally{a.db.close();}
});
