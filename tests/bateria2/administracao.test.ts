import { expect,it } from 'vitest';
import { registrarAdministracaoEfetivaSalaoF3 as registrar,listarAdministracoesEfetivasSalaoF3 as listar } from '../../src/server/salaoF3.js';
import { listarEventos } from '../../src/kernel/comandos/portas.js';
import { cumulativos } from '../../src/kernel/projections/cumulativos.js';
import { ambiente,entrada,ctx } from './fixtures.js';

it('I02: referência inventada não substitui prescrição assinada',()=>{
 const a=ambiente();try { expect(registrar(a.db,a.acesso,entrada()).ok).toBe(false);expect(listarEventos(a.db,ctx.patientId)).toHaveLength(0); }finally{a.db.close();}
});
it('8A: duas bolsas legítimas preservam os IDs e alimentam o histórico canônico',()=>{
 const a=ambiente();try{
  a.assinar();const resposta=registrar(a.db,a.acesso,entrada('a1'));expect(resposta.ok,JSON.stringify(resposta)).toBe(true);expect(registrar(a.db,a.acesso,entrada('a2')).ok).toBe(true);
  expect(listar(a.db,ctx.patientId)).toHaveLength(2);
  expect(cumulativos(listarEventos(a.db,ctx.patientId))).toMatchObject([{quantidadeEfetivaMg:128,adminIds:['a1','a2']}]);
 }finally{a.db.close();}
});
it('8B: replay com novo horário de recebimento devolve a dose já gravada uma vez',()=>{
 const a=ambiente();try {
  a.assinar();const p=entrada('a1',127);expect(registrar(a.db,a.acesso,p).ok).toBe(true);
  expect(registrar(a.db,{...a.acesso,agora:'2026-10-19T18:02:00Z'},p)).toMatchObject({ok:true,administracao:p.administracao});
  expect(listar(a.db,ctx.patientId)).toHaveLength(1);
 }finally{a.db.close();}
});
it('I04/8B: mesmo ID com conteúdo alterado deve falhar e preservar o original',()=>{
 const a=ambiente();try {
  a.assinar();expect(registrar(a.db,a.acesso,entrada('a1',127)).ok).toBe(true);
  expect(registrar(a.db,a.acesso,entrada('a1',126)).ok).toBe(false);
  expect(listar(a.db,ctx.patientId)).toMatchObject([{quantidadeEfetivaMg:127}]);
 }finally{a.db.close();}
});
it('7B: 45,9 mg parciais não viram 76,5 nem 102 mg',()=>{
 const a=ambiente();try {
  a.assinar();const p=entrada('a1',45.9);Object.assign(p.administracao,{status:'INTERROMPIDA',motivo:'Interrupção observada sintética'});
  expect(registrar(a.db,a.acesso,p).ok).toBe(true);
  expect(cumulativos(listarEventos(a.db,ctx.patientId))).toMatchObject([{quantidadeEfetivaMg:45.9}]);
 }finally{a.db.close();}
});
