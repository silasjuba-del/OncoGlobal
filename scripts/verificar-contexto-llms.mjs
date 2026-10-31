import {execFileSync} from 'node:child_process';
import {readFileSync,realpathSync,existsSync} from 'node:fs';
import {resolve,dirname,relative,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const fontesNormativas=['docs/DECISOES.md','docs/specs/CORPUS-SKILLS-JORNADA.md','tests/auditoria-jornadas/CENARIOS.md'];
export const arquivosContexto=['CONTEXTO-LLMS.md','AGENTS.md','README.md','CLAUDE.md','GEMINI.md','.cursor/rules/00-contexto-obrigatorio.mdc','.github/copilot-instructions.md',...fontesNormativas];
const normalizar=s=>s.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
const hash=s=>createHash('sha256').update(normalizar(s)).digest('hex');
export function verificarContexto(repo=process.cwd(),referencia='origin/main',opcoes={}){
 const git=args=>execFileSync('git',args,{cwd:repo,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 const raiz=realpathSync(git(['rev-parse','--show-toplevel']));
 const refSha=git(['rev-parse','--verify','--end-of-options',referencia+'^{commit}']);
 const head=git(['rev-parse','HEAD']);const status=git(['status','--porcelain','--untracked-files=all']);
 const dentro=p=>{const r=relative(raiz,realpathSync(p));return r!== '..'&&!r.startsWith('..'+(process.platform==='win32'?'\\':'/'))&&!isAbsolute(r)};
 const arquivos=arquivosContexto.map(arquivo=>{
  const erros=[];let local=null,registrado=null;
  try{const p=resolve(raiz,arquivo);if(!dentro(p))throw Error();local=readFileSync(p,'utf8')}catch{erros.push('ARQUIVO_LOCAL_AUSENTE_OU_FORA_DA_RAIZ')}
  try{registrado=execFileSync('git',['show',refSha+':'+arquivo],{cwd:raiz,encoding:'utf8',stdio:['ignore','pipe','pipe']})}catch{erros.push('ARQUIVO_AUSENTE_NA_REFERENCIA')}
  if(local!==null&&registrado!==null&&hash(local)!==hash(registrado))erros.push('CONTEUDO_DIVERGENTE');
  if(local!==null&&arquivo!=='CONTEXTO-LLMS.md'&&!fontesNormativas.includes(arquivo)){
   const alvoContexto=resolve(raiz,'CONTEXTO-LLMS.md');
   const destinos=[...local.matchAll(/\]\(([^)]+)\)/g)].map(m=>m[1]);
   if(['CLAUDE.md','GEMINI.md'].includes(arquivo)&&normalizar(local).startsWith('@./AGENTS.md\n@./CONTEXTO-LLMS.md\n'))destinos.push('./CONTEXTO-LLMS.md');
   const aponta=destinos.some(link=>{if(/^(https?:|#)/.test(link))return false;try{return resolve(dirname(resolve(raiz,arquivo)),decodeURIComponent(link.split('#')[0].replace(/^<|>$/g,'')))===alvoContexto}catch{return false}});
   if(!aponta)erros.push('PONTEIRO_DE_LEITURA_AUSENTE');
  }
  if(local!==null&&['CLAUDE.md','GEMINI.md'].includes(arquivo)&&!normalizar(local).startsWith('@./AGENTS.md\n@./CONTEXTO-LLMS.md\n'))erros.push('IMPORTACAO_EXPLICITA_AUSENTE');
  if(local!==null&&arquivo.endsWith('.mdc')){
   const front=normalizar(local).match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/)?.[1]??'';
   const valores=[...front.matchAll(/^alwaysApply:[ \t]*(true|false)[ \t]*(?:#.*)?$/gm)].map(m=>m[1]);
   if(valores.length!==1||valores[0]!=='true')erros.push('CURSOR_NAO_APLICA_SEMPRE');
  }
  if(local!==null&&!fontesNormativas.includes(arquivo))for(const m of local.matchAll(/\]\(([^)]+)\)/g)){
   let link=m[1];if(/^(https?:|#)/.test(link))continue;
   try{link=decodeURIComponent(link.split('#')[0].replace(/^<|>$/g,''));const p=resolve(dirname(resolve(raiz,arquivo)),link);if(!existsSync(p)||!dentro(p))erros.push('LINK_LOCAL_INVALIDO:'+link)}catch{erros.push('LINK_LOCAL_INVALIDO')}
  }
  return{arquivo,hashLocal:local===null?null:hash(local),hashReferencia:registrado===null?null:hash(registrado),erros};
 });
 let remoto={solicitado:opcoes.verificarRemoto===true,verificado:false,sha:null,coincide:null};
 if(opcoes.verificarRemoto===true){
  if(!referencia.startsWith('origin/'))remoto.erro='REFERENCIA_REMOTA_NAO_MAPEAVEL';
  else try{const linha=git(['ls-remote','--exit-code','origin','refs/heads/'+referencia.slice('origin/'.length)]);const sha=linha.split(/\s+/)[0];
   if(!/^[a-f0-9]{40,64}$/.test(sha))throw Error();remoto={solicitado:true,verificado:true,sha,coincide:sha===refSha};
  }catch{remoto.erro='REMOTO_NAO_VERIFICADO'}
 }
 return{schema:'VerificacaoContexto@1',remoto,raiz,referencia,referenciaSha:refSha,headLocal:head,headCoincide:head===refSha,
  caminhosComWip:status?status.split(/\r?\n/).length:0,documentacaoCoincide:arquivos.every(a=>a.erros.length===0),arquivos,
  escopo:'Somente leitura. Sem --remoto, a referência é apenas o cache local. --remoto compara com a branch anunciada por ls-remote. Não faz fetch nem sincroniza código, WIP ou arquivos. A contagem de WIP não inclui arquivos ignorados. Igualdade documental não comprova atualização do código ou do processo do app.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{let repo=process.cwd(),ref='origin/main',live=false;for(let i=2;i<process.argv.length;i++){const a=process.argv[i];if(a==='--repo'&&process.argv[i+1])repo=process.argv[++i];else if(a==='--referencia'&&process.argv[i+1])ref=process.argv[++i];else if(a==='--remoto')live=true;else throw Error('ARGUMENTO_INVALIDO')}
  const r=verificarContexto(repo,ref,{verificarRemoto:live});console.log(JSON.stringify(r,null,2));process.exitCode=r.documentacaoCoincide&&(!live||r.remoto.coincide===true)?0:1;
 }catch{console.error(JSON.stringify({codigo:'CONTEXTO_NAO_VERIFICADO',mensagem:'Confira repositório, referência local e acesso aos arquivos. Nenhum arquivo foi alterado.'}));process.exitCode=2;}
}
