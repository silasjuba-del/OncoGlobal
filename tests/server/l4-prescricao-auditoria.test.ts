import {expect,it,vi,afterEach} from 'vitest';
import {ambiente,ctx,EM} from '../bateria2/fixtures.js';
import {operarPrescricaoExecutavel} from '../../src/server/prescricaoExecutavel.js';
import * as portas from '../../src/kernel/comandos/portas.js';
afterEach(()=>vi.restoreAllMocks());
it.each([['SESSAO_INVALIDA',401,'SESSAO_INVALIDA'],['falha com conteúdo sensível sintético',503,'PRESCRICAO_ARMAZENAMENTO_INDISPONIVEL']])('recusa auditada preserva classificação segura: %s',(erro,status,codigo)=>{
 const a=ambiente();try{
  vi.spyOn(portas,'listarEventos').mockImplementationOnce(()=>{throw Error(String(erro));});
  expect(operarPrescricaoExecutavel({db:a.db,sessoes:a.acesso.sessoes,agora:()=>EM},a.acesso.token,'base',ctx)).toMatchObject({status,body:{codigo}});
  const rows=a.db.prepare('SELECT * FROM audit_event').all();expect(rows).toHaveLength(1);expect(rows[0]?.motivoCodigo).toBe(codigo);
  expect(JSON.stringify(rows)).not.toContain('conteúdo sensível');
  expect(a.db.prepare('SELECT COUNT(*) AS n FROM clinical_event').get()?.n).toBe(0);
 }finally{a.db.close();}
});
