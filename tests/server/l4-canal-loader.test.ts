// @vitest-environment jsdom
import {expect,it} from 'vitest';
import {carregarRulesetAlarmeCanalPadrao} from '../../src/server/canalReconciliacao.js';
it('carrega o ruleset real legível em ambiente de jornada UI sem ativar rascunhos',()=>{
 const r=carregarRulesetAlarmeCanalPadrao();expect(r).not.toBeNull();
 expect(r?.rulesetId).toBe('canal-redflags');expect(r?.sinais.length).toBeGreaterThan(0);
});
