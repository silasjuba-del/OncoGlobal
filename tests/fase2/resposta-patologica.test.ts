import {expect,it} from 'vitest';
import {projetarRespostaPatologica} from '../../src/server/revisaoClinica.js';
import {RevisaoClinicaResposta} from '../../src/contracts/fase2/revisaoClinica.js';
import {fato,retrato} from './fixtures.js';
const registro=(id:string,dados:Record<string,unknown>,data='2026-10-16')=>fato('pcr','pCR',{
 ref:{eventId:id,revisao:'1'},dados:{valor:'pCR',...dados},tempoClinico:data});
it('preserva negação e incerteza sem transformar a confirmação documental em pCR positiva',()=>{
 const p=projetarRespostaPatologica(retrato([
  registro('negada',{negated:true,evidence:'EXPLICIT'}),
  registro('incerta',{negado:true,evidence:'UNCERTAIN',requiresConfirmation:true},'2026-10-15'),
 ]));
 expect(p[0]).toMatchObject({estado:'NEGADO',qualificadores:{negated:true,evidence:'EXPLICIT'},valor:'pCR'});
 expect(p[1]).toMatchObject({estado:'INCERTO',qualificadores:{negado:true,evidence:'UNCERTAIN',requiresConfirmation:true}});
 expect(RevisaoClinicaResposta.shape.respostaTumoral.shape.patologica.parse(p)).toEqual(p);
});
it('registros discordantes na mesma data permanecem separados, com conflito e fontes',()=>{
 const p=projetarRespostaPatologica(retrato([registro('positivo',{evidence:'EXPLICIT'}),registro('negativo',{negated:true,evidence:'EXPLICIT'}),
  registro('anterior',{valor:false},'2026-10-01')]));
 expect(p.map(x=>x.conflito)).toEqual([true,true,false]);expect(p.map(x=>x.fato.eventId)).toEqual(['positivo','negativo','anterior']);
 expect(p.every(x=>x.fontes.length)).toBe(true);
 expect(projetarRespostaPatologica(retrato([fato('pcr',true,{fontes:[]})]))).toEqual([]);
});
