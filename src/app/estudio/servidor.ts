import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { criarGerenciadorSessao } from '../../server/sessao.js';
import { criarGateway, type StoreIdempotencia, type ResultadoGateway } from '../../kernel/gateway/gateway.js';
import { criarWorkspaceStore, ConflitoPersistencia } from '../persistencia/store.js';
import { criarExecutorImprimir, type DocumentoParaImpressao } from '../executores/imprimir.js';
import { criarPreferenciasImpressora } from '../impressoras.js';
import { readWorkspace, changeWorkspace } from './workspace.js';
import { renderPage, renderLogin, esc, form, type PageInput } from './pagina.js';
import { clientScript } from './cliente.js';
import { renderizarKit, type KitTemplate, type EntradaKit } from '../../impressao/kit.js';
import { renderizarApacLaudo, type TemplateApac } from '../../impressao/apacLaudo.js';
import { css } from './estilo.js';

export interface StudioOptions { dataDir:string; corpusDir:string; senha:string; medicoId:string; crm:string; port?:number; host?:string; agora?:()=>string; log?:(e:{rota:string;status:number})=>void; }
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
function civil(instant:string){return new Date(Date.parse(instant)-3*60*60*1000).toISOString().slice(0,10);}
async function body(req:IncomingMessage):Promise<URLSearchParams>{const chunks:Buffer[]=[];let size=0;for await(const chunk of req){const b=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=b.length;if(size>12_000_000)throw Error('CORPO_EXCESSIVO');chunks.push(b)}return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));}
const sample={title:'ESTUDO FICTÍCIO — teste do workspace',description:'Documento sintético. Não é um estudo registrado nem uma proposta de tratamento.',arms:[{id:'braco-teste-a',name:'Braço A (fictício)',description:'Estratégia fictícia A'},{id:'braco-teste-b',name:'Braço B (fictício)',description:'Estratégia fictícia B'}],inclusionCriteria:['Marcador demonstrativo deve ser presente.'],exclusionCriteria:['Impedimento demonstrativo informado como presente.'],outcomes:['Desfecho fictício para testar registro longitudinal.']};
/** Composição adicional de workspace, sem alterar rotas ou contratos dos outros executores. */
export async function iniciarEstudio(options:StudioOptions){
  const host=options.host??'127.0.0.1';if(host!=='127.0.0.1')throw Error('SOMENTE_LOOPBACK');
  const agora=options.agora??(()=>new Date().toISOString());
  const store=criarWorkspaceStore({rootDir:options.dataDir});
  const sessions=criarGerenciadorSessao({medicoId:options.medicoId,crm:options.crm,senha:options.senha,duracaoMs:8*60*60*1000,agora});
  const preferences=criarPreferenciasImpressora({dataDir:options.dataDir});
  const corpus=resolve(options.corpusDir,'templates','kit');
  const names=(await readdir(corpus)).filter(n=>n.endsWith('.v1.json')).map(n=>n.slice(0,-8));
  type IdemValue={payloadHash:string;resultado:ResultadoGateway;deleted?:boolean};
  const idem:StoreIdempotencia={
    get:key=>{const r=store.ler<IdemValue>('idempotencia',sha(key))?.value;return r?.deleted?undefined:r;},
    set:(key,value)=>{const id=sha(key),old=store.ler('idempotencia',id);store.gravar({collection:'idempotencia',key:id,value,expectedRevision:old?.revision??null});},
    delete:key=>{const id=sha(key),old=store.ler<IdemValue>('idempotencia',id);if(old)store.gravar({collection:'idempotencia',key:id,value:{...old.value,deleted:true},expectedRevision:old.revision});}
  };
  const gateway=criarGateway({store:idem,agora,auditar:e=>{store.append({collection:'auditoria',key:'gateway',event:e})},executores:{IMPRIMIR:criarExecutorImprimir({dataDir:options.dataDir,agora:()=>civil(agora())+'T12:00:00-03:00',resolverDocumento:{resolver:async({id,version})=>{const doc=store.ler<DocumentoParaImpressao>('documentos',id)?.value;return doc?.version===version?doc:null;}}})}});
  readWorkspace(store);
  let baseOrigin='';
  const respond=(res:ServerResponse,status:number,data:string,type='text/html; charset=utf-8')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; img-src 'self' data:; frame-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'self'"});res.end(data);};
  const handler=async(req:IncomingMessage,res:ServerResponse)=>{
    const url=new URL(req.url||'/',baseOrigin);const rawPath=(req.url||'').split('?')[0]||'';
    if(/\.\.|%2e|%5c|\\/i.test(rawPath)){respond(res,404,'Não encontrado');return;}
    if(req.headers.host!==new URL(baseOrigin).host){respond(res,403,'ORIGEM_INVALIDA');return;}
    if(req.method==='POST'&&req.headers.origin&&req.headers.origin!==baseOrigin){respond(res,403,'ORIGEM_INVALIDA');return;}
    if(req.method==='GET'&&url.pathname==='/favicon.ico'){res.writeHead(204,{'Cache-Control':'no-store'});res.end();return;}
    if(req.method==='GET'&&url.pathname==='/cliente.js'){respond(res,200,clientScript,'application/javascript; charset=utf-8');return;}
    if(url.pathname==='/entrar'&&req.method==='POST'){
      const f=await body(req);const login=sessions.login(f.get('senha')||'');if(!login){respond(res,401,renderLogin('Acesso não autorizado.'));return;}
      res.writeHead(303,{'Location':'/','Set-Cookie':`og_session=${login.token}; HttpOnly; SameSite=Strict; Path=/`,'Cache-Control':'no-store'});res.end();return;
    }
    const token=/\bog_session=([a-f0-9]+)\b/.exec(req.headers.cookie||'')?.[1]||'';
    const session=sessions.obter(token);if(!session){respond(res,req.method==='GET'&&url.pathname==='/'?200:401,renderLogin());return;}
    let record=readWorkspace(store);
    const makePage=(tab:string,extra:Partial<PageInput>={})=>renderPage({workspace:record.value,revision:record.revision,token,today:civil(agora()),tab,persona:url.searchParams.get('persona')||'',kitNames:names,...extra});
    if(req.method==='GET'&&url.pathname==='/'){respond(res,200,makePage(url.searchParams.get('tab')||'cockpit'));return;}
    if(req.method==='GET'&&url.pathname==='/exemplo-estudo'){respond(res,200,JSON.stringify(sample,null,2),'application/json; charset=utf-8');return;}
    if(req.method==='GET'&&url.pathname==='/rascunhos'){
      const drafts=store.listar<{em:string;action:string;campos:Record<string,string|string[]>}>('rascunhos');
      respond(res,200,`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Rascunhos preservados</title><style>${css}</style></head><body><main class="content"><a href="/">← Workspace</a><h1>Entradas preservadas antes da validação</h1><p class="notice">Estes registros são RAW, não fatos confirmados. Campos e anexos permanecem locais; senhas e tokens não são armazenados aqui.</p>${drafts.map(d=>`<details class="panel"><summary>${esc(d.value.action)} · ${esc(d.value.em)}</summary><pre class="source-text">${esc(JSON.stringify(d.value.campos,null,2))}</pre></details>`).join('')}</main></body></html>`);return;
    }
    if(req.method==='GET'&&url.pathname.startsWith('/fonte/')){const id=url.pathname.slice(7),s=record.value.studies.flatMap(s=>[{source:s.source,attachmentBase64:s.attachmentBase64},...s.attachments]).find(s=>s.source.sourceId===id);if(!s){respond(res,404,'FONTE_AUSENTE');return;}res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="fonte-${s.source.sourceId}.${s.source.kind==='JSON'?'json':s.source.kind==='BINARY_REFERENCE'?'bin':'txt'}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(s.attachmentBase64?Buffer.from(s.attachmentBase64,'base64'):s.source.originalContent||'');return;}
    if(req.method==='GET'&&url.pathname.startsWith('/documento/')){const id=url.pathname.slice(11);const doc=store.ler<DocumentoParaImpressao>('documentos',id)?.value;if(!doc){respond(res,404,'DOCUMENTO_AUSENTE');return;}respond(res,200,doc.html);return;}
    if(req.method==='GET'&&url.pathname.startsWith('/impresso/')){
      const saved=store.ler<{path:string}>('impressos',url.pathname.slice(10));if(!saved){respond(res,404,'ARTEFATO_AUSENTE');return;}
      const root=resolve(options.dataDir,'impressao')+sep,path=resolve(saved.value.path);if(!path.startsWith(root)){respond(res,404,'ARTEFATO_AUSENTE');return;}
      const nonce=randomBytes(18).toString('base64');const html=(await readFile(path,'utf8')).replaceAll('<script>',`<script nonce="${nonce}">`);
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':`default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`});res.end(html);return;
    }
    if(req.method!=='POST'||url.pathname!=='/comando'){respond(res,404,'Não encontrado');return;}
    const f=await body(req);if(f.get('csrf')!==token){respond(res,403,'CSRF_INVALIDO');return;}
    const draftId=randomUUID();const campos:Record<string,string|string[]>={};
    for(const key of new Set(f.keys())){if(key==='csrf'||key==='senha')continue;const values=f.getAll(key);campos[key]=values.length>1?values:values[0]||'';}
    store.gravar({collection:'rascunhos',key:draftId,value:{em:agora(),action:f.get('action')||'PENDENTE',campos},expectedRevision:null});
    const revision=Number(f.get('revision'));const tab=f.get('tab')||'cockpit';if(!Number.isSafeInteger(revision)||revision<1){respond(res,400,'REVISAO_INVALIDA');return;}
    const action=f.get('action');
    try{
      if(action==='preview-document'){
        if(revision!==record.revision)throw Error('REVISAO_DESATUALIZADA');const templateId=f.get('templateId')||'';if(!names.includes(templateId))throw Error('TEMPLATE_AUSENTE');
        const template=JSON.parse(await readFile(resolve(corpus,templateId+'.v1.json'),'utf8')) as KitTemplate&TemplateApac;
        const blank=f.get('blank')==='sim';
        const page:PageInput={workspace:record.value,revision:record.revision,token,today:civil(agora()),tab:'docs',kitNames:names};
        if(f.get('configured')!=='sim'){
          const fields=templateId==='receita-sintomaticos'?(template.itensReceita??[]).map(item=>`<label class="check"><input type="checkbox" name="item" value="${esc(item.id)}" checked><span><b>${esc(item.medicamento)} · ${esc(item.dose)}</b><br>${esc(item.orientacao)}<br><small>${esc(item.via)}</small></span></label>`).join(''):templateId==='requisicao-exames-ciclos'?`<div class="table-wrap"><table><thead><tr><th>Exame</th>${[1,2,3,4].map(n=>`<th>Ciclo ${n}<input type="date" name="date${n}" aria-label="Data ciclo ${n}"></th>`).join('')}</tr></thead><tbody>${(template.exames??[]).map((exam,i)=>`<tr><td>${esc(exam)}</td>${[1,2,3,4].map(n=>`<td><input type="checkbox" name="exam${i}_${n}" value="sim" aria-label="${esc(exam)} ciclo ${n}"></td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="field"><label for="additional">Exames adicionais (um por linha)</label><textarea id="additional" name="additional"></textarea></div>`:templateId==='relatorio-pericial'?`<div class="form-grid"><div class="field"><label for="prazo">Prazo de afastamento — decisão médica</label><input id="prazo" name="prazo" placeholder="PENDENTE"></div><div class="field"><label for="inicio">Data de início</label><input id="inicio" name="inicio" type="date"></div></div>`:templateId==='apac-laudo'?`<div class="notice">Cadastro/lote não conectado nesta composição: campos clínicos permanecem PENDENTE. AUTORIZAÇÃO e validade ficam em branco.</div><div class="field"><label for="justification">Justificativa informada pelo médico</label><textarea id="justification" name="justification"></textarea></div><div class="field"><label for="observations">Observações</label><textarea id="observations" name="observations"></textarea></div>`:'<p class="notice">Texto literal do kit do médico. [VERIFICAR acentuação].</p>';
          respond(res,200,`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preparar documento</title><style>${css}</style></head><body><main class="content" style="max-width:950px"><a href="/?tab=docs">← Documentos</a><div class="heading"><h1>${esc(templateId)}</h1></div><section class="panel">${form(page,'preview-document',`<input type="hidden" name="templateId" value="${esc(templateId)}"><input type="hidden" name="configured" value="sim">${blank?'<input type="hidden" name="blank" value="sim"><p class="notice warning">MODELO EM BRANCO — identificação e marcações serão deixadas para preenchimento manual.</p>':''}${fields}<button type="submit" class="primary">Abrir pré-visualização revisável</button>`)}</section></main></body></html>`);return;
        }
        const id=randomUUID();
        const kitInput:EntradaKit={documentId:id,documentVersion:1,cabecalho:record.value.institution,medico:record.value.doctor,paciente:{nome:record.value.patients.find(p=>p.id===record.value.activePatient)?.nome||'PENDENTE'},modeloEmBranco:blank,dataImpressao:civil(agora()),itensSelecionados:f.getAll('item'),exames:(template.exames??[]).map((exame,i)=>({exame,ciclos:[f.get(`exam${i}_1`)==='sim',f.get(`exam${i}_2`)==='sim',f.get(`exam${i}_3`)==='sim',f.get(`exam${i}_4`)==='sim']})),examesAdicionais:(f.get('additional')||'').split('\n').filter(Boolean),prazoAfastamento:f.get('prazo')||'PENDENTE',dataInicioAfastamento:f.get('inicio')||'PENDENTE',datasCiclos:[f.get('date1')||'PENDENTE',f.get('date2')||'PENDENTE',f.get('date3')||'PENDENTE',f.get('date4')||'PENDENTE']};
        const result=templateId==='apac-laudo'?renderizarApacLaudo(template,{documentId:id,documentVersion:1,valores:{'justificativa-observacoes':[f.get('justification')?'Justificativa: '+f.get('justification'):'',f.get('observations')?'Observações: '+f.get('observations'):''].filter(Boolean).join('\n'),'NOME DO PROFISSIONAL SOLICITANTE':record.value.doctor.nome,'DATA DA SOLICITAÇÃO':civil(agora())},modeloEmBranco:blank,metadados:{temTabelaSigtap:false}}):renderizarKit(template,kitInput);
        const doc:DocumentoParaImpressao={id,version:1,patientId:blank?null:record.value.activePatient,html:result.html,assinado:false,hash:sha(result.html),modeloEmBranco:blank};store.gravar({collection:'documentos',key:id,value:doc,expectedRevision:null});
        respond(res,200,`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Revisão de documento</title><style>${css}</style></head><body><main class="content" style="max-width:1100px"><a href="/?tab=docs">← Documentos</a><div class="heading"><h1>${esc(templateId)}</h1><span class="badge">${result.status}</span></div><iframe title="Pré-visualização de documento" src="/documento/${id}" style="width:100%;height:70vh;border:1px solid #dce6e3;background:white"></iframe><p class="notice">Preferência: ${esc(record.value.printer)}. O médico escolhe a impressora no diálogo do sistema. Rascunho clínico sem assinatura não é emitido; modelo em branco precisa de confirmação.</p>${form(page,'print-document',`<input type="hidden" name="documentId" value="${id}"><input type="hidden" name="printKey" value="print-${id}"><label class="check"><input type="checkbox" required name="confirm" value="sim">Conferi o documento exibido e solicito preparar a impressão.</label><button class="primary" ${blank?'':'disabled'}>Preparar impressão pelo Gateway</button>`)}</main></body></html>`);return;
      }
      if(action==='print-document'){
        if(f.get('confirm')!=='sim')throw Error('REVISAO_MEDICA_OBRIGATORIA');const id=f.get('documentId')||'';const doc=store.ler<DocumentoParaImpressao>('documentos',id)?.value;if(!doc)throw Error('DOCUMENTO_AUSENTE');
        const result=await gateway.executar({verbo:'IMPRIMIR',objeto:{tipo:'DOCUMENTO',id,versao:doc.version},escopo:{patientId:doc.patientId,encounterId:null},destino:null,idempotencyKey:f.get('printKey')||''},session);
        if((result.decisao!=='EXECUTADA'&&result.decisao!=='REPLAY')||!result.recibo)throw Error('IMPRESSAO_'+result.motivoCodigo);
        const old=store.ler('impressos',id);if(!old)store.gravar({collection:'impressos',key:id,value:{path:result.recibo},expectedRevision:null});res.writeHead(303,{Location:'/impresso/'+id,'Cache-Control':'no-store'});res.end();return;
      }
      const changed=await changeWorkspace(record.value,f,session.medicoId,agora());
      record=store.gravar({collection:'workspace',key:'principal',value:changed,expectedRevision:revision});
      if(action==='settings')await preferences.salvarPreferida(changed.printer);
      respond(res,200,makePage(tab,{notice:'Registro salvo no workspace local. Nenhuma assinatura ou envio externo foi realizado.'}));
    }catch(error){record=readWorkspace(store);const reason=error instanceof ConflitoPersistencia?'CONFLITO_REVISAO — esta tela ficou desatualizada; o candidato foi preservado. Reabra e revise.':error instanceof Error&&/^[A-Z_]+(?::[\w:-]+)?$/.test(error.message)?error.message:'ENTRADA_INVALIDA — confira fonte, campos e versão.';respond(res,error instanceof ConflitoPersistencia?409:400,makePage(tab,{error:reason}));}
  };
  const server=createServer((req,res)=>{void handler(req,res).catch(()=>{if(!res.headersSent)respond(res,400,'ENTRADA_INVALIDA');else res.end();}).finally(()=>options.log?.({rota:req.url?.startsWith('/comando')?'/comando':'/local',status:res.statusCode}));});
  server.requestTimeout=30_000;
  await new Promise<void>((done,reject)=>{server.once('error',reject);server.listen(options.port??0,host,()=>done())});
  const address=server.address();if(!address||typeof address==='string')throw Error('BIND_INVALIDO');baseOrigin=`http://127.0.0.1:${address.port}`;
  return {url:baseOrigin,server,store,async encerrar(){await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));store.fechar();}};
}
