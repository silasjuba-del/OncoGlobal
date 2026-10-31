import {it,expect} from 'vitest';
import {calcularDose} from '../../src/rules/dose.js';
import {doseRuleset} from '../fixtures/rulesets.js';
const base={doseAdministradaAnteriorMg:150,reducaoPct:0 as const,pesoKg:72,alturaCm:180,origemPeso:'MEDIDO' as const,ciclosSemPesoAnteriores:0,referenciaMgM2:1000};
it('mantém precisão de SC do prescritor e não multiplica novamente a base absoluta',()=>{
 expect(calcularDose(base,doseRuleset).doseMg).toBe(Math.round(1000*(Math.round(Math.sqrt(180*72/3600)*100)/100)));
 expect(calcularDose({...base,referenciaMgM2:null},doseRuleset).doseMg).toBe(150);
});
it.each([0,-1,Number.NaN,Number.POSITIVE_INFINITY])('referência inválida não cai silenciosamente na dose anterior (%s)',referenciaMgM2=>{
 expect(calcularDose({...base,referenciaMgM2},doseRuleset).estado).toBe('PENDENTE');
});
it.each([null,0,Number.NaN])('referência mg/m² exige altura atual válida (%s)',alturaCm=>{
 expect(calcularDose({...base,alturaCm},doseRuleset).estado).toBe('PENDENTE');
});
