import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { Instante, Sessao, type Sessao as SessaoTipo } from '../contracts/base.js';
import { hashCanonico } from '../modules/hash.js';
import { criarBiblioteca, listarCuradoriaAtual, ManifestoBiblioteca, sha256Biblioteca, type FiltrosBiblioteca } from '../kernel/corpus/biblioteca.js';
import { transacao } from '../kernel/ledger/db.js';
import { gravarEstimulo } from '../kernel/orquestracao/estimulos/gravar.js';
import type { GerenciadorSessao } from './sessao.js';
interface DepsBiblioteca { db: DatabaseSync; sessoes: GerenciadorSessao; agora: () => string }
export interface ResultadoBiblioteca { status: number; body: Record<string, unknown> }
const Rotas=new Set(['/biblioteca/importar','/biblioteca/curar','/biblioteca/ativar','/biblioteca/rollback','/biblioteca/consultar','/biblioteca/estado']);
const Hash=z.string().regex(/^[a-f0-9]{64}$/),Id=z.string().min(1).max(250);
const Conteudo=z.union([z.object({texto:z.string().max(1000000)}).strict(),z.object({base64:z.string().max(1400000).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)}).strict()]);
const Importar=z.object({manifesto:ManifestoBiblioteca,arquivos:z.record(z.string().regex(/^[a-zA-Z0-9_-]+\.json$/),Conteudo)}).strict();
const Curar=z.object({pacoteId:Id,itemId:Id,expectedHash:Hash,estado:z.enum(['CONSULTAVEL','ALERTA','OBSOLETO'])}).strict();
const Ativar=z.object({pacoteId:Id,expectedHash:Hash,expectedCuradoriaHash:Hash}).strict();
const Rollback=z.object({expectedAtiva:Id,expectedHash:Hash}).strict();
const Filtros=z.object({tumor:z.string().optional(),histologia:z.string().optional(),estadio:z.string().optional(),biomarcador:z.string().optional(),linha:z.string().optional()}).strict();
const Consultar=z.object({filtros:Filtros,modo:z.enum(['CONSULTA','ALERTA']).default('CONSULTA')}).strict();
const Estado=z.object({pacoteId:Id.optional()}).strict();
function pacote(db:DatabaseSync,id:string) {return db.prepare('SELECT conteudo,hash FROM biblioteca_pacote WHERE id=?').get(id);}
function conferirHash(db:DatabaseSync,id:string,hash:string):void {
 const p=pacote(db,id);if(!p||p.hash!==hash||sha256Biblioteca(String(p.conteudo))!==p.hash)throw new Error('PACOTE_HASH_DIVERGENTE');
}
/** Revisão do pacote selecionado, inclusive inativo; seq impede aceitar um ciclo OBSOLETO→CONSULTAVEL como revisão antiga. */
export function hashCuradoriaPacote(db:DatabaseSync,id:string):string {
 const p=pacote(db,id);if(!p)throw Error('PACOTE_AUSENTE');conferirHash(db,id,String(p.hash));
 const estados=listarCuradoriaAtual(db,id).map(({item,estado,seq})=>({item,estado,seq}));
 return hashCanonico({pacoteHash:p.hash,estados});
}
/** Hash de conteúdo e curadoria efetiva: mudança de aprovação invalida avaliação em aberto. */
export function referenciaBibliotecaAtiva(db:DatabaseSync):{id:string;versao:string;hash:string}|null {
 if(!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='biblioteca_ativacao'").get())return null;
 const id=db.prepare('SELECT pacote FROM biblioteca_ativacao ORDER BY seq DESC LIMIT 1').get()?.pacote;
 if(!id)return null;const p=pacote(db,String(id));if(!p||sha256Biblioteca(String(p.conteudo))!==p.hash)throw new Error('PACOTE_HASH_DIVERGENTE');
 const conteudo=JSON.parse(String(p.conteudo)) as {manifesto:unknown};const m=ManifestoBiblioteca.parse(conteudo.manifesto);
 const estados=listarCuradoriaAtual(db,String(id)).map(({item,estado})=>({item,estado}));
 return {id:m.id,versao:m.versao,hash:hashCanonico({pacoteHash:p.hash,estados})};
}
/** Entrada manual autenticada; pacote nunca recebe autoridade nem acesso ao filesystem. */
export function rotearBiblioteca(deps:DepsBiblioteca,token:string,rota:string,body:unknown,sessaoResolvida:SessaoTipo):ResultadoBiblioteca|null {
 if(!Rotas.has(rota))return null;
 const em=deps.agora();
 if(!Instante.safeParse(em).success)return {status:503,body:{codigo:'RELOGIO_SERVICO_INVALIDO'}};
 const sessao=Sessao.safeParse(deps.sessoes.obter(token));
 if(!sessao.success||hashCanonico(sessao.data)!==hashCanonico(sessaoResolvida)||Date.parse(sessao.data.emitidaEm)>Date.parse(em)||Date.parse(sessao.data.expiraEm)<=Date.parse(em))return {status:401,body:{codigo:'SESSAO_INVALIDA'}};
 const emitir=()=>{
  const ref=referenciaBibliotecaAtiva(deps.db);if(!ref)throw new Error('BIBLIOTECA_ATIVA_AUSENTE');
  const ativacao=deps.db.prepare('SELECT max(seq) AS n FROM biblioteca_ativacao').get()?.n;
  const curadoria=deps.db.prepare('SELECT max(seq) AS n FROM biblioteca_curadoria').get()?.n;
  const id=`biblioteca:${hashCanonico([ref,ativacao,curadoria])}`;
  // Technical record: never a signed clinical fact or a PHI transport.
  gravarEstimulo(deps.db,{schema:'EstimuloTecnico@1',id,operationId:id,tipo:'BIBLIOTECA_ATIVADA',patientId:null,encounterId:null,tumorLotId:null,revisaoEntrada:ref.hash,criadoEm:em,ator:'SISTEMA'});
 };
  const lib=criarBiblioteca(deps.db,{autorizarCuradoria:()=>({atorId:sessao.data.medicoId}),agora:()=>em,emitir});
 try {
  if(rota==='/biblioteca/importar'){
   const p=Importar.parse(body),refs=new Set(p.manifesto.itens.map(i=>i.arquivo));
   if(Object.keys(p.arquivos).some(f=>!refs.has(f))||refs.size!==Object.keys(p.arquivos).length)throw new Error('ARQUIVOS_DIVERGENTES');
   const textos=new Map<string,string>();let total=0;
   for(const [nome,conteudo] of Object.entries(p.arquivos)){
    const texto='texto' in conteudo?conteudo.texto:new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(conteudo.base64,'base64'));
    total+=Buffer.byteLength(texto);if(total>8000000)throw new Error('PACOTE_EXCESSIVO');textos.set(nome,texto);
   }
   const id=lib.importarPacote(p.manifesto,n=>textos.get(n)??'');
   return {status:201,body:{codigo:'PACOTE_IMPORTADO_RASCUNHO',pacoteId:id,hash:pacote(deps.db,id)?.hash}};
  }
  if(rota==='/biblioteca/curar'){
   const p=Curar.parse(body);conferirHash(deps.db,p.pacoteId,p.expectedHash);
   // Textual knowledge has no executable threshold schema: approval for reading cannot create a medical rule.
   if(p.estado==='ALERTA')throw new Error('ALERTA_SEM_SCHEMA_EXECUTAVEL');
   transacao(deps.db,()=>{lib.revisarItem(p.pacoteId,p.itemId,p.estado);if(lib.ativa()===p.pacoteId)emitir();});
   return {status:200,body:{codigo:'ITEM_CURADO',estado:p.estado,referencia:referenciaBibliotecaAtiva(deps.db)}};
  }
  if(rota==='/biblioteca/ativar'){
   const p=Ativar.parse(body);
   transacao(deps.db,()=>{conferirHash(deps.db,p.pacoteId,p.expectedHash);
    if(hashCuradoriaPacote(deps.db,p.pacoteId)!==p.expectedCuradoriaHash)throw Error('BIBLIOTECA_REVISAO_DIVERGENTE');
    lib.ativar(p.pacoteId);});
   return {status:200,body:{codigo:'BIBLIOTECA_ATIVADA',referencia:referenciaBibliotecaAtiva(deps.db)}};
  }
  if(rota==='/biblioteca/rollback'){
   const p=Rollback.parse(body);if(lib.ativa()!==p.expectedAtiva)throw new Error('BIBLIOTECA_REVISAO_DIVERGENTE');
   conferirHash(deps.db,p.expectedAtiva,p.expectedHash);lib.voltarAnterior();
   return {status:200,body:{codigo:'BIBLIOTECA_RESTAURADA',referencia:referenciaBibliotecaAtiva(deps.db)}};
  }
  if(rota==='/biblioteca/consultar'){
   const p=Consultar.parse(body);return {status:200,body:{itens:lib.consultar(Object.fromEntries(Object.entries(p.filtros).filter(([,v])=>v!==undefined)) as FiltrosBiblioteca,p.modo),referencia:referenciaBibliotecaAtiva(deps.db)}};
  }
  const p=Estado.parse(body),id=p.pacoteId??lib.ativa(),row=id?pacote(deps.db,id):null;
  if(p.pacoteId&&!row)throw new Error('PACOTE_AUSENTE');
  if (id && row) conferirHash(deps.db,id,String(row.hash));
  const ativacao=id?deps.db.prepare('SELECT pacote,anterior,motivo,ator,registrado_em AS registradoEm FROM biblioteca_ativacao WHERE pacote=? ORDER BY seq DESC LIMIT 1').get(id):undefined;
  const ativaId=lib.ativa();
  const pacotes=(deps.db.prepare('SELECT id,hash,conteudo FROM biblioteca_pacote ORDER BY id').all() as {id:string;hash:string;conteudo:string}[]).map(r=>{
   conferirHash(deps.db,r.id,r.hash);
   const manifesto=ManifestoBiblioteca.parse((JSON.parse(r.conteudo) as {manifesto:unknown}).manifesto);
   const estados = new Map(listarCuradoriaAtual(deps.db,r.id).map(i=>[i.item,i.estado]));
   return {pacoteId:r.id,versao:manifesto.versao,hash:r.hash,ativo:r.id===ativaId,
    itens:manifesto.itens.map(i=>({id:i.id,estado:estados.get(i.id)??"RASCUNHO"}))};
  });
  return {status:200,body:{ativa:lib.ativa(),referencia:referenciaBibliotecaAtiva(deps.db),pacoteId:id,hash:row?.hash??null,curadoriaHash:id?hashCuradoriaPacote(deps.db,id):null,
    ativacao:ativacao??null,pacotes,itens:id?lib.listar(id):[]}};
 }catch(error){return {status:error instanceof z.ZodError?400:409,body:{codigo:error instanceof z.ZodError?'BIBLIOTECA_PEDIDO_INVALIDO':error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'BIBLIOTECA_OPERACAO_RECUSADA'}};}
}
