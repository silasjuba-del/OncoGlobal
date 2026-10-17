import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { BLOCOS_TUMOR_PACK, TumorPackExtract } from "../../contracts/fase2/tumorPack.js";
import { hashCanonico } from "../../rules/conteudoCanonico.js";

const objeto=(v:unknown):Record<string,unknown>=>v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:{};
const texto=(v:unknown)=>typeof v==="string"?v.trim():"";
const sha=(s:string)=>createHash("sha256").update(s).digest("hex");
const CAMINHOS:Record<typeof BLOCOS_TUMOR_PACK[number],string[]>={
  identidade:["identidade"],diagnostico:["diagnostico"],estadiamento:["estadiamento"],
  biomarcadores:["biomarcadores","tratamento.biomarcadorTratamento"],c1_lacunas:["diagnostico","ligacoes.exames","pendencias"],
  pre_qt:["preQt","completudeKit","ligacoes.formulasXYZ"],tratamento:["tratamento.cenarios","tratamento.protocolos","tratamento.cirurgia","tratamento.radioterapia"],
  toxicidades:["ligacoes.ctcaeAcao","ligacoes.interacoesConsultar","tratamento.suporte"],
  resposta:["resposta","criteriosResposta","tratamento.resposta","tratamento.reavaliacao"],seguimento:["seguimento","tratamento.seguimento"],
  documentos:["ligacoes.encaminhamentos","ligacoes.laudos","ligacoes.orientacoes","ligacoes.suporteReceitas"],fontes:["header.fonte","curadoria.fontesLidas"],
};
export function hashExtracaoPack(p:Pick<TumorPackExtract,"schema"|"referencia"|"titulo"|"cids"|"original"|"blocos"|"requisitos"|"pendencias">):string {
  return hashCanonico({schema:p.schema,id:p.referencia.id,versao:p.referencia.versao,titulo:p.titulo,cids:p.cids,
    original:p.original,blocos:p.blocos,requisitos:p.requisitos,pendencias:p.pendencias});
}

/** Transfere fragmentos literais e candidatos explicitamente universais. Nunca promove curadoria. */
export function adaptarPackDocumental(json:unknown,arquivo:string,hashOriginal:string):TumorPackExtract {
  const p=objeto(json),h=objeto(p.header),identidade=objeto(p.identidade);
  if(!texto(h.id)||!texto(h.versao)||!texto(identidade.tumor))throw Error("PACK_DOCUMENTAL_INVALIDO");
  const blocos=Object.fromEntries(BLOCOS_TUMOR_PACK.map(nome=>{
    const itens=CAMINHOS[nome].flatMap(localizador=>{
      const conteudo=localizador.split(".").reduce<unknown>((v,k)=>objeto(v)[k],p);
      return conteudo===undefined||conteudo===null||Array.isArray(conteudo)&&!conteudo.length?[]:[{localizador,conteudo}];
    });
    return [nome,{estado:itens.length?"A_CONFERIR":"AUSENTE",itens}];
  })) as TumorPackExtract["blocos"];
  const requisitos:TumorPackExtract["requisitos"]=[];
  for(const [grupo,valor] of Object.entries(objeto(p.diagnostico))){
    if(!Array.isArray(valor))continue;
    valor.forEach((v,index)=>{
      const item=objeto(v),fonte=objeto(item.fonte),codigo=texto(item.catalogoId);
      if(item.indicacao!=="universal"||!codigo||!texto(fonte.referencia)||!texto(fonte.trecho))return;
      requisitos.push({id:`diagnostico.${grupo}.${index}`,exameCodigo:codigo,contexto:texto(item.quando)||"consulta inicial",
        fonte:`${texto(fonte.referencia)}${fonte.pagina==null?"":`; página ${String(fonte.pagina)}`} — ${texto(fonte.trecho)}`,
        codigoSus:null,validadeHoras:null,categoria:grupo==="imagem"?"IMAGEM":grupo==="laboratorio"?"LABORATORIO":"OUTRO"});
    });
  }
  const candidato={schema:"tumor-pack-extract.v2" as const,referencia:{id:`${texto(h.id)}-extract`,versao:texto(h.versao),hash:hashOriginal},
    titulo:texto(identidade.tumor),cids:Array.isArray(identidade.cid10)?identidade.cid10.filter((v):v is string=>typeof v==="string"):[],
    estado:p.consultavel===true?"CONSULTAVEL" as const:"RASCUNHO" as const,original:{arquivo,hash:hashOriginal,estado:texto(p.status)||"NAO_INFORMADO"},
    revisaoClinica:null,blocos,requisitos,pendencias:["REVISAR_EXTRACAO_E_REQUISITOS_ANTES_DE_ATIVAR",...BLOCOS_TUMOR_PACK.filter(b=>!blocos[b].itens.length).map(b=>`BLOCO_AUSENTE:${b}`)]};
  candidato.referencia.hash=hashExtracaoPack(candidato);
  return TumorPackExtract.parse(candidato);
}
export interface CatalogoTumorPacks {packs:TumorPackExtract[];rejeitados:{arquivo:string;motivo:string}[]}
function raizCorpus():string|null{
  for(const inicio of [process.cwd(),dirname(fileURLToPath(import.meta.url))]){let atual=inicio;
    while(true){if(existsSync(join(atual,"corpus","6-pack-tumor")))return atual;const pai=dirname(atual);if(pai===atual)break;atual=pai;}}
  return null;
}
/** Arquivos ativos precisam corresponder tanto à extração revisada quanto aos bytes originais. */
export function carregarPacksTumor(raiz=raizCorpus()):CatalogoTumorPacks{
  const out:CatalogoTumorPacks={packs:[],rejeitados:[]};
  if(!raiz)return {packs:[],rejeitados:[{arquivo:"corpus/6-pack-tumor",motivo:"CORPUS_INDISPONIVEL"}]};
  const originais=new Map<string,string>(),extracoes:{arquivo:string;json:unknown}[]=[];
  function visitar(dir:string){for(const item of readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    const caminho=join(dir,item.name),arquivo=relative(raiz!,caminho).replace(/\\/g,"/");
    if(item.isDirectory())visitar(caminho);else if(item.isFile()&&item.name.endsWith(".json")){
      try{const bruto=readFileSync(caminho,"utf8"),json=JSON.parse(bruto) as unknown;
        originais.set(arquivo,sha(bruto));
        if(objeto(json).schema==="tumor-pack-extract.v2")extracoes.push({arquivo,json});
        else if(/^pack-.+\.v2\./.test(item.name))out.packs.push(adaptarPackDocumental(json,arquivo,sha(bruto)));
      }catch{out.rejeitados.push({arquivo,motivo:"PACK_INVALIDO_OU_ILEGIVEL"});}
    }
  }}
  try{visitar(join(raiz,"corpus","6-pack-tumor"));}catch{out.rejeitados.push({arquivo:"corpus/6-pack-tumor",motivo:"LEITURA_INCOMPLETA"});}
  const idsExtra=extracoes.map(e=>objeto(objeto(e.json).referencia).id);
  for(const e of extracoes){const p=TumorPackExtract.safeParse(e.json);
    if(p.success&&idsExtra.filter(id=>id===p.data.referencia.id).length>1){out.rejeitados.push({arquivo:e.arquivo,motivo:"EXTRACAO_DUPLICADA"});continue;}
    if(!p.success||originais.get(p.data.original.arquivo)!==p.data.original.hash||hashExtracaoPack(p.data)!==p.data.referencia.hash){out.rejeitados.push({arquivo:e.arquivo,motivo:"EXTRACAO_OU_ORIGINAL_DIVERGENTE"});continue;}
    out.packs=out.packs.filter(c=>c.referencia.id!==p.data.referencia.id);out.packs.push(p.data);
  }
  const ids=out.packs.map(p=>p.referencia.id),duplicados=new Set(ids.filter((id,i)=>ids.indexOf(id)!==i));
  for(const id of duplicados)out.rejeitados.push({arquivo:id,motivo:"PACK_DUPLICADO"});
  out.packs=out.packs.filter(p=>!duplicados.has(p.referencia.id)).sort((a,b)=>a.referencia.id.localeCompare(b.referencia.id));
  return out;
}
