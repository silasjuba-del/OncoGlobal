import {LoteCompleto,SETORES_PACK,TITULOS_SETORES,type ItemLoteCompleto} from '../../contracts/fase2/loteCompleto.js';
type Setor=typeof SETORES_PACK[number];
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const str=(v:unknown)=>typeof v==='string'?v.trim():'';
const esc=(s:string)=>s.replaceAll('~','~0').replaceAll('/','~1');
const DOMINIOS:Record<number,Setor>={1:'diagnostico',2:'estadiamento',3:'biomarcadores',4:'exames',5:'pre_tratamento',6:'tratamento',7:'seguranca',8:'suporte',9:'resposta',10:'seguimento',11:'encaminhamentos',12:'documentos'};
const CHAVES:Record<string,Setor>={cenarios:'cenarios',protocolos:'tratamento',radioterapia:'tratamento',cirurgia:'tratamento',biomarcadorTratamento:'biomarcadores',suporte:'suporte',ensaios:'ensaios',seguimento:'seguimento',exames:'exames',interacoesConsultar:'seguranca',ctcaeAcao:'seguranca',suporteReceitas:'suporte',orientacoes:'orientacoes',encaminhamentos:'encaminhamentos',laudos:'documentos',formulasXYZ:'relacoes',examesFontes:'fontes',fonte:'fontes',interacoesFonte:'fontes',resposta:'resposta',reavaliacao:'resposta'};

/** Composição documental: nenhuma opção é excluída por idade, referência ou acesso. O original inteiro acompanha o lote. */
export function montarLoteCompleto(original:unknown,arquivo:string,sha256:string):LoteCompleto{
 const p=obj(original),h=obj(p.header),identidade=obj(p.identidade),u=obj(p.tumor_pack_universal);
 const setores=SETORES_PACK.map(id=>({id,titulo:TITULOS_SETORES[id],itens:[] as ItemLoteCompleto[]}));
 const usados=new Set<string>();
 function adicionar(setor:Setor,localizador:string,valor:unknown,origem:ItemLoteCompleto['origem']='LEGADO',rotulo?:string){
  if(valor===undefined)return;
  if(Array.isArray(valor)){valor.forEach((v,i)=>adicionar(setor,`${localizador}/${i}`,v,origem,rotulo));return;}
  if(usados.has(localizador))return;usados.add(localizador);
  const o=obj(valor),nome=['nome','rotulo','titulo','termo','exame','droga','cenario','tema','id','texto'].map(k=>str(o[k])).find(Boolean);
  const titulo=nome||str(valor)||rotulo||localizador.split('/').at(-1)||'Conteúdo preservado';
  const cenarios=typeof o.cenario==='string'?[o.cenario]:Array.isArray(o.cenarios)?o.cenarios.filter((x):x is string=>typeof x==='string'):[];
  setores.find(s=>s.id===setor)!.itens.push({id:localizador,setor,titulo,localizador,origem,cenarios,conteudo:valor as ItemLoteCompleto['conteudo']});
 }
 adicionar('identidade','/identidade',p.identidade);
 adicionar('cenarios','/identidade/cenarios',identidade.cenarios);
 for(const [k,v] of Object.entries(obj(p.diagnostico)))adicionar(k==='patologico'?'diagnostico':'exames',`/diagnostico/${esc(k)}`,v);
 adicionar('estadiamento','/estadiamento',p.estadiamento);
 // APAC/SIGTAP organiza acesso documental; o conteúdo e o ponteiro de origem permanecem intactos.
 for(const [k,v] of Object.entries(obj(p.tratamento)))adicionar(k==='apacSigtap'?'documentos':CHAVES[k]??'tratamento',`/tratamento/${esc(k)}`,v);
 for(const [k,v] of Object.entries(obj(p.ligacoes)))adicionar(CHAVES[k]??'complementos',`/ligacoes/${esc(k)}`,v);
 const raizes:Record<string,Setor>={biomarcadores:'biomarcadores',preQt:'pre_tratamento',completudeKit:'pre_tratamento',criteriosResposta:'resposta',resposta:'resposta',seguimento:'seguimento',suporte:'suporte',pendencias:'pendencias',conflitos:'conflitos',curadoria:'fontes',correcoes:'fontes',header:'fontes',auditoria:'fontes',reconciliacao:'fontes',indice_itens_legados:'fontes'};
 for(const [k,v] of Object.entries(p))if(!['identidade','diagnostico','tratamento','ligacoes','tumor_pack_universal'].includes(k))adicionar(raizes[k]??(k.includes('auditor')||k.includes('reconcil')||k.includes('indice')?'fontes':'complementos'),`/${esc(k)}`,v);
 const novos=Array.isArray(u.itens_nccn)?u.itens_nccn:[];
 novos.forEach((v,i)=>adicionar(DOMINIOS[Number(obj(v).dominio_principal)]??'complementos',`/tumor_pack_universal/itens_nccn/${i}`,v,'UNIVERSAL'));
 for(const [k,v] of Object.entries(u))if(k!=='itens_nccn'){
  const setor: Setor=k.includes('conflitos')?'conflitos':k.includes('pendencias')?'pendencias':k==='relacoes'?'relacoes':k==='ensaios'?'ensaios':k==='cenarios'?'cenarios':k.includes('seguimento')?'seguimento':'fontes';
  // Índices e auditorias são metadados, preservados como um registro em vez de milhares de linhas clínicas.
  adicionar(setor,`/tumor_pack_universal/${esc(k)}`,{nome:k,conteudo:v},'UNIVERSAL',k);
 }
 const protocolos=obj(p.tratamento).protocolos;
 return LoteCompleto.parse({schema:'LoteTumoralCompleto@1',packId:`${str(h.id)}-extract`,titulo:str(identidade.tumor),cids:Array.isArray(identidade.cid10)?identidade.cid10:[],
  original:{arquivo,sha256,versao:str(h.versao)},setores,protocolosLegados:Array.isArray(protocolos)?protocolos.length:0,itensUniversais:novos.length,
  conteudoIntegral:original,autorizaTratamento:false,avisos:['Lote documental completo: seleção não confirma diagnóstico nem indica tratamento.','Acesso SUS/privado e elegibilidade devem ser conferidos por item.','Fase e cenário organizam a leitura; nenhum protocolo é eliminado.']});
}
