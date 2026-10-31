import {it,expect} from 'vitest';
import {projetarEquivalenteClinico} from '../../src/server/f0c/cumulativoClinico.js';
import type {ClinicalEvent} from '../../src/contracts/operacao.js';
import {fonteSintetica} from '../fixtures/triagem.js';
const base={patientId:'p-equiv',tumorLotId:null,encounterId:'e-equiv',agora:'2026-10-10T12:00:00-03:00',programados:['doxorrubicina'],limites:[]};
function fato(campo:string,valor:unknown,id=campo):ClinicalEvent{return {eventId:id,operationId:`op-${id}`,eventIndex:0,patientId:base.patientId,encounterId:base.encounterId,tumorLotId:null,
 tipo:'FATO',revisao:'CONFIRMADO',criadoEm:base.agora,criadoPor:{tipo:'SESSAO',id:'medico-sintetico'},supersedesEventId:null,fontes:[fonteSintetica(id)],payload:{data:{campo,valor}}};}
function dose(droga:string,n:number,unidade='mg/m2',realizadaEm='2026-10-01T12:00:00-03:00'){
 return fato('exposicaoCumulativa',{patientId:base.patientId,droga,historicoCompleto:true,fonteCompletude:'historico-sintetico',administracoes:[{
 adminId:droga,patientId:base.patientId,episodioId:'ep-sintetico',droga,status:'COMPLETA',quantidadeEfetivaMgM2:n,unidade,fonte:droga,realizadaEm}]},droga);
}
it('equivalente usa também a antraciclina histórica, sem somar outro paciente',()=>{
 const eventos=[dose('doxorrubicina',100),dose('epirrubicina',200),fato('rtMediastino',false),{...dose('mitoxantrona',100),patientId:'outro'}];
 expect(projetarEquivalenteClinico({...base,eventos})).toMatchObject({equivalenteMgM2:260,estado:'ALARANJADO'});
});
it('dose sem unidade compatível ou futura não vira soma tranquilizadora',()=>{
 for(const d of [dose('doxorrubicina',100,'U'),dose('doxorrubicina',100,'mg/m2','2027-01-01T12:00:00-03:00')]) {
  const r=projetarEquivalenteClinico({...base,eventos:[d,fato('rtMediastino',false)]});
  expect(r?.estado).toBe('PENDENTE');expect(r?.equivalenteMgM2).toBeNull();
 }
});
it('histórico incompleto conserva o subtotal conhecido acima do limiar',()=>{
 const incompleto=dose('epirrubicina',600);
 (incompleto.payload as {data:{valor:{historicoCompleto:boolean}}}).data.valor.historicoCompleto=false;
 const r=projetarEquivalenteClinico({...base,programados:['epirrubicina'],eventos:[incompleto,fato('rtMediastino',false)]});
 expect(r?.equivalenteMgM2).toBe(480);
 expect(r?.estado).toBe('AVISO');
 expect(r?.pendencias.join(' ')).toContain('HISTORICO_LONGITUDINAL_INCOMPLETO');
});
it('agravante desconhecido permanece pendente; RT documentada mantém aviso',()=>{
 const d=dose('doxorrubicina',100);
 expect(projetarEquivalenteClinico({...base,eventos:[d]})?.estado).toBe('PENDENTE');
 expect(projetarEquivalenteClinico({...base,eventos:[d,fato('rtMediastino',true)]})?.estado).toBe('ALARANJADO');
});
