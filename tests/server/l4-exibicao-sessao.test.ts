import {expect,it} from 'vitest';
import {criarGerenciadorSessao} from '../../src/server/sessao.js';
it('recibo é exclusivo da sessão, contexto, finalidade e conteúdo; trocar contexto invalida',()=>{
 let agora='2026-10-25T12:00:00Z';const s=criarGerenciadorSessao({medicoId:'m',crm:'crm',senha:'senha-sintetica-recibos',duracaoMs:60000,agora:()=>agora});
 const a=s.login('senha-sintetica-recibos')!,b=s.login('senha-sintetica-recibos')!,c={patientId:'p',encounterId:'e',tumorLotId:null};
 s.selecionarConsulta(a.token,c);s.registrarConteudoExibido!(a.token,c,'VINCULO','draft','a'.repeat(64));
 expect(s.conteudoFoiExibido!(a.token,c,'VINCULO','draft','a'.repeat(64))).toBe(true);
 expect(s.conteudoFoiExibido!(b.token,c,'VINCULO','draft','a'.repeat(64))).toBe(false);
 expect(s.conteudoFoiExibido!(a.token,c,'OUTRA','draft','a'.repeat(64))).toBe(false);
 expect(s.conteudoFoiExibido!(a.token,c,'VINCULO','draft','b'.repeat(64))).toBe(false);
 s.selecionarConsulta(a.token,{...c,encounterId:'outro'});s.selecionarConsulta(a.token,c);
 expect(s.conteudoFoiExibido!(a.token,c,'VINCULO','draft','a'.repeat(64))).toBe(false);
 s.registrarConteudoExibido!(a.token,c,'VINCULO','draft','a'.repeat(64));agora='2026-10-25T12:02:00Z';
 expect(s.conteudoFoiExibido!(a.token,c,'VINCULO','draft','a'.repeat(64))).toBe(false);
});
