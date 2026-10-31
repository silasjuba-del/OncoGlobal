import {it,expect} from 'vitest';
import {avaliarPeso} from '../../src/rules/peso.js';
import {salaoRuleset} from '../fixtures/rulesets.js';
it.each([0,-2,Number.NaN,Number.POSITIVE_INFINITY])('peso inválido não vira verde (%s)',kg=>{
 expect(avaliarPeso([{kg:70,data:'2026-10-01',origem:'MEDIDO'},{kg,data:'2026-10-10',origem:'MEDIDO'}],'2026-10-10',salaoRuleset).estado).toBe('PENDENTE');
});
it('conflito na mesma data não depende da ordem da entrada',()=>{
 const a=[{kg:70,data:'2026-10-10',origem:'MEDIDO' as const},{kg:60,data:'2026-10-10',origem:'MEDIDO' as const}];
 expect(avaliarPeso(a,'2026-10-10',salaoRuleset)).toEqual(avaliarPeso([...a].reverse(),'2026-10-10',salaoRuleset));
 expect(avaliarPeso(a,'2026-10-10',salaoRuleset).estado).toBe('PENDENTE');
});
