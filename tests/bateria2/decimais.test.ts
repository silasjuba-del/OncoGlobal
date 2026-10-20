import { expect,it } from 'vitest';
import { avaliarCumulativoAlerta } from '../../src/rules/cumulativoAlerta.js';
import { administracaoCompleta,limiteCumulativo } from '../w3/fixtures.js';
import { AvaliacaoDoseCicloSalao } from '../../src/contracts/f3/salaoOperacional.js';
it.each([[0.1,0.2,99.7],[99.9],[100.1],[1e-309]])('dose efetiva decimal, mesmo comparador e limite: %j',(...doses)=>{
 const administracoes=doses.map((d,i)=>administracaoCompleta(`a${i}`,d));
 const r=avaliarCumulativoAlerta({patientId:administracoes[0]!.patientId,episodioId:administracoes[0]!.episodioId,droga:administracoes[0]!.droga,administracoes},{...limiteCumulativo,maximo:100});
 const esperado=doses.length===3?100:doses[0]!;
 expect(r.total).toBe(esperado);expect(r.achado.estado).toBe(esperado>100?'VERMELHO':'VERDE');
});
it('contrato F3 preserva observação fracionária do ciclo anterior sem mudar redução',()=>{
 expect(AvaliacaoDoseCicloSalao.shape.doseAdministradaCicloAnteriorMg.parse(45.9)).toBe(45.9);
});
