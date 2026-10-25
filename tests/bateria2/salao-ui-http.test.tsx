// @vitest-environment jsdom
import { cleanup,render,screen,fireEvent,waitFor } from '@testing-library/react';
import { expect,it,vi } from 'vitest';
import { readFileSync,mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { SalaoRuleset } from '../../src/contracts/regras.js';
import { criarGateway,memoriaIdempotencia } from '../../src/kernel/gateway/gateway.js';
import { criarServidorLocal } from '../../src/server/http.js';
import { criarPortaHttp } from '../../src/ui/api/http.js';
import { TelaSalao } from '../../src/ui/telas/TelaSalao.js';
import { receberTransporteSintetico } from '../../src/server/canalEntrada.js';
import { abrirLedger } from '../../src/kernel/ledger/db.js';
import { listarEventos } from '../../src/kernel/comandos/portas.js';
import { ambiente,ctx,EM } from './fixtures.js';

it.each([false,true])('6A/6B: HTTP + tela real + SQLite preservam relato até decisão médica (vínculo posterior=%s)',async vinculoPosterior=>{
 const path=join(mkdtempSync(join(tmpdir(),'oncoglobal-b2-sintetico-')),'teste.sqlite');
 const a=ambiente(path),c={...ctx,tumorLotId:null};
 a.seed('Paciente',{patientId:ctx.patientId,nome:'Paciente Sintético B2',identificadores:[],nascimento:null,sexoCadastral:'NAO_INFORMADO',divergencia:false},'CONFIRMADO',c);
 a.seed('AgendaEntry',{patientId:ctx.patientId,encounterId:ctx.encounterId,horario:'15:00',data:'2026-10-19'},'CONFIRMADO',c);
 const remetente='+55'+'00000009999';
 if(!vinculoPosterior)a.seed('Contato',{contatoId:'contato-corrente-b2-http',canal:'WHATSAPP_SERVICO',endereco:remetente,patientId:ctx.patientId,relacao:'PACIENTE',vinculadoEm:EM,revogadoEm:null},'CONFIRMADO',c);
 for(const [id,texto] of [['reacao','fiquei toda vermelha e com coceira na infusão de ontem'],['retracao','melhorou, esquece']]){
  expect(receberTransporteSintetico(a.db,{accountId:'b2-sintetico',canal:'WHATSAPP_SERVICO',providerMessageId:id!,senderRef:remetente,providerSentAt:EM,ingestedAt:EM,
   conteudo:{tipo:'TEXT',texto:texto!,contentSha256:createHash('sha256').update(texto!).digest('hex')},cadastros:vinculoPosterior?[]:[{patientId:ctx.patientId,nome:'Paciente Sintético B2',identificadores:[{tipo:'TELEFONE',valor:remetente}],chaveDemografica:null}]}).ok).toBe(true);
 }
 const rules=SalaoRuleset.parse(JSON.parse(readFileSync('corpus/rulesets/salao-triagem.v1.json','utf8')));
 a.db.close();const db=abrirLedger(path);
 const server=criarServidorLocal({db,sessoes:a.acesso.sessoes,agora:()=>EM,log:()=>{},salaoRuleset:rules,gateway:criarGateway({agora:()=>EM,auditar:()=>{},store:memoriaIdempotencia(),executores:{}})});
 if(!server.listening)await once(server,'listening');
 const address=server.address();if(!address||typeof address==='string')throw Error('PORTA');
 const base=`http://127.0.0.1:${address.port}`,realFetch=globalThis.fetch;
 vi.stubGlobal('fetch',(input:string|URL|Request,init?:RequestInit)=>realFetch(new URL(String(input),base),init));
 try {
  const porta=criarPortaHttp({onSessaoExpirada:()=>{}});expect((await porta.login('senha-sintetica-bateria2')).ok).toBe(true);
  if(vinculoPosterior){await porta.selecionarContexto?.(c);await porta.pedirVinculo(remetente,ctx.patientId);
   expect(db.prepare('SELECT vinculoPatientId FROM canal_mensagem').all().every(r=>r.vinculoPatientId===null)).toBe(true);}
  render(<TelaSalao porta={porta}/>);
  expect(await screen.findByText(/fiquei toda vermelha/)).toBeTruthy();expect(screen.getByText(/melhorou, esquece/)).toBeTruthy();
  cleanup();render(<TelaSalao porta={porta}/>);expect(await screen.findByText(/fiquei toda vermelha/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Decisão médica sobre o relato'),{target:{value:'Relato revisto; orientação documentada na consulta sintética.'}});
  fireEvent.click(screen.getByRole('button',{name:'Registrar revisão deste relato'}));
  await waitFor(()=>expect(screen.queryByLabelText('Relato de infusão pendente')).toBeNull());
  expect(listarEventos(db,ctx.patientId).filter(e=>e.tipo==='ReviewDecision')).toHaveLength(1);
  expect(db.prepare('SELECT count(*) n FROM canal_mensagem').get()!.n).toBe(2);
 }finally {cleanup();vi.unstubAllGlobals();await new Promise<void>(r=>server.close(()=>r()));db.close();}
});
