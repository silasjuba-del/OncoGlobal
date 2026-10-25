import type {GerenciadorSessao} from './sessao.js';
/** Só publica os recibos depois de uma resposta HTTP válida concluída. */
export function adiarExibicoesHttp(original:GerenciadorSessao){
 const pendentes:Array<()=>void>=[];
 const copiarContexto=(c:{patientId:string;encounterId:string;tumorLotId:string|null})=>({patientId:c.patientId,encounterId:c.encounterId,tumorLotId:c.tumorLotId});
 const validar=(token:string,hashes:readonly string[]=[])=>{
  if(!original.obter(token))throw Error('SESSAO_EXPIRADA');
  if(hashes.some(h=>!/^[a-f0-9]{64}$/.test(h)))throw Error('HASH_EXIBIDO_INVALIDO');
 };
 const sessoes:GerenciadorSessao={...original,
  registrarBundleExibido(token,contexto,docs){validar(token,docs.map(d=>d.conteudoHash));const c=copiarContexto(contexto),copia=docs.map(d=>({...d}));
   pendentes.push(()=>original.registrarBundleExibido(token,c,copia));},
  ...(original.registrarAlertasExibidos?{registrarAlertasExibidos(token,contexto,ids){validar(token);const c=copiarContexto(contexto),copia=[...ids];
   pendentes.push(()=>original.registrarAlertasExibidos?.(token,c,copia));}}:null),
  ...(original.registrarConteudoExibido?{registrarConteudoExibido(token,contexto,finalidade,recursoId,hash){validar(token,[hash]);const c=copiarContexto(contexto);
   pendentes.push(()=>original.registrarConteudoExibido?.(token,c,finalidade,recursoId,hash));}}:null),
 };
 return {sessoes,descartar:()=>{pendentes.length=0;},confirmar:()=>{const copia=pendentes.splice(0);for(const f of copia)f();}};
}
