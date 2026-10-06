import { describe,it,expect } from 'vitest';
import { mkdtemp,rm,readdir,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { iniciarEstudio } from '../../src/app/estudio/servidor.js';
import { readWorkspace } from '../../src/app/estudio/workspace.js';

const password='senha-apenas-fixture-local-123';
describe('composição HTTP real local',()=>{
 it('autentica, protege CSRF, preserva RAW inválido, detecta revisão e recupera SQLite após reiniciar',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'og-estudio-'));const logs:unknown[]=[];let app=await iniciarEstudio({dataDir:dir,corpusDir:resolve('corpus'),senha:password,medicoId:'medico-teste',crm:'CRM-TESTE',agora:()=> '2026-10-05T15:00:00-03:00',log:e=>logs.push(e)});
  async function login(){const response=await fetch(app.url+'/entrar',{method:'POST',body:new URLSearchParams({senha:password}),redirect:'manual'});expect(response.status).toBe(303);const cookie=response.headers.get('set-cookie')!.split(';')[0]!;return {cookie,token:cookie.split('=')[1]!};}
  try{
   expect((await fetch(app.url+'/fonte/desconhecida')).status).toBe(401);
   const auth=await login();const headers={Cookie:auth.cookie,Origin:app.url};
   const html=await (await fetch(app.url,{headers})).text();expect(html).toContain('Pesquisa clínica');expect(html).toContain('Paciente Teste 001');
   expect((await fetch(app.url+'/comando',{method:'POST',headers,body:new URLSearchParams({action:'note',revision:'1'})})).status).toBe(403);
   expect((await fetch(app.url+'/comando',{method:'POST',headers:{...headers,Origin:'https://externo.invalid'},body:new URLSearchParams({csrf:auth.token})})).status).toBe(403);
   const post=(values:Record<string,string>)=>fetch(app.url+'/comando',{method:'POST',headers,body:new URLSearchParams({csrf:auth.token,revision:String(readWorkspace(app.store).revision),tab:'pesquisa',...values})});
   const invalid=await post({action:'study-import',fileName:'invalido.json',mime:'application/json',content:'{preservar texto inválido'});expect(invalid.status).toBe(400);expect(JSON.stringify(app.store.listar('rascunhos'))).toContain('preservar texto inválido');
   const rev=readWorkspace(app.store).revision;const note={action:'note',confirm:'sim',noteType:'Flash',noteText:'Nota sintética — nega sintoma.',noteSource:'manual',revision:String(rev)};expect((await post(note)).status).toBe(200);expect((await post(note)).status).toBe(409);expect(readWorkspace(app.store).value.notes).toHaveLength(1);
   const source=await (await fetch(app.url+'/exemplo-estudo',{headers})).text();expect((await post({action:'study-import',fileName:'estudo.json',mime:'application/json',content:source})).status).toBe(200);expect(readWorkspace(app.store).value.studies).toHaveLength(1);
   const apac=await post({action:'preview-document',templateId:'apac-laudo',configured:'sim',justification:'Justificativa sintética preservada',observations:'Observação sintética preservada'});expect(apac.status).toBe(200);
   const apacPage=await apac.text();const documentPath=/src="(\/documento\/[^"]+)"/.exec(apacPage)![1]!;const apacHtml=await(await fetch(app.url+documentPath,{headers})).text();expect(apacHtml).toContain('Justificativa sintética preservada');expect(apacHtml).toContain('Observação sintética preservada');
   await app.encerrar();
   const child=execFileSync(process.execPath,['--input-type=module','-e',"import {DatabaseSync} from 'node:sqlite';const db=new DatabaseSync(process.argv[1]);const r=db.prepare(\"SELECT payload FROM workspace_record WHERE collection='workspace' AND record_key='principal'\").get();const w=JSON.parse(r.payload);process.stdout.write(JSON.stringify({studies:w.studies.length,notes:w.notes.length}));db.close();",join(dir,'workspace.sqlite')],{encoding:'utf8'});expect(JSON.parse(child)).toEqual({studies:1,notes:1});
   app=await iniciarEstudio({dataDir:dir,corpusDir:resolve('corpus'),senha:password,medicoId:'medico-teste',crm:'CRM-TESTE'});await login();expect(readWorkspace(app.store).value.studies).toHaveLength(1);expect(readWorkspace(app.store).value.notes[0]?.texto).toContain('nega');expect(JSON.stringify(logs)).not.toContain('Paciente Teste');expect(JSON.stringify(logs)).not.toContain(password);
   const files=await readdir(dir);for(const file of files){if(file.endsWith('.json'))expect(await readFile(join(dir,file),'utf8')).not.toContain(password);}
  }finally{await app.encerrar();await rm(dir,{recursive:true,force:true});}
 });
 it('gera modelo em branco via gateway uma vez e faz replay após reiniciar',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'og-print-'));let app=await iniciarEstudio({dataDir:dir,corpusDir:resolve('corpus'),senha:password,medicoId:'medico-teste',crm:'CRM-TESTE'});
  async function auth(){const r=await fetch(app.url+'/entrar',{method:'POST',body:new URLSearchParams({senha:password}),redirect:'manual'});const cookie=r.headers.get('set-cookie')!.split(';')[0]!;return {Cookie:cookie,token:cookie.split('=')[1]!};}
  try{let session=await auth();const post=(values:Record<string,string>)=>fetch(app.url+'/comando',{method:'POST',headers:{Cookie:session.Cookie,Origin:app.url},body:new URLSearchParams({csrf:session.token,revision:'1',...values}),redirect:'manual'});
   const preview=await post({action:'preview-document',templateId:'sinais-alarme',blank:'sim',configured:'sim'});expect(preview.status).toBe(200);const html=await preview.text();const documentId=/name="documentId" value="([^"]+)"/.exec(html)![1]!;
   const print={action:'print-document',documentId,printKey:'print-'+documentId,confirm:'sim'};const [one,two]=await Promise.all([post(print),post(print)]);expect(one.status).toBe(303);expect(two.status).toBe(303);expect(one.headers.get('location')).toBe(two.headers.get('location'));
   const records=app.store.listar<{path:string}>('impressos');expect(records).toHaveLength(1);const content=await readFile(records[0]!.value.path,'utf8');expect(content).toContain('window.print()');expect(content).toContain('MODELO EM BRANCO');
   await app.encerrar();app=await iniciarEstudio({dataDir:dir,corpusDir:resolve('corpus'),senha:password,medicoId:'medico-teste',crm:'CRM-TESTE'});session=await auth();expect((await post(print)).status).toBe(303);expect(app.store.listar('impressos')).toHaveLength(1);expect(await readFile(records[0]!.value.path,'utf8')).toBe(content);
  }finally{await app.encerrar();await rm(dir,{recursive:true,force:true});}
 });
});
