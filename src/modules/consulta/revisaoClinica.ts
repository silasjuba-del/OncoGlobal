import type { FatoRetrato, Retrato } from "../../contracts/f1/retrato.js";
import type { CampoFichaMinima } from "../../contracts/fase2/revisaoClinica.js";
import type { TumorPackExtract } from "../../contracts/fase2/tumorPack.js";
import { bsaMosteller } from "../../rules/prescricao/instanciarProtocolo.js";
import { Fonte,DataCivil,Instante } from '../../contracts/base.js';

const norm=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:{};
const canon=(v:unknown):string=>JSON.stringify(v,(_k,x:unknown)=>x&&typeof x==="object"&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const dataValida=(v:unknown):v is string=>DataCivil.safeParse(v).success||Instante.safeParse(v).success;
const CAMPOS:[string,string,string[]][]=[
  ["cid","CID",["cid","cid10"]],["ecog","ECOG",["ecog"]],["kps","KPS",["kps"]],
  ["alergias","Alergias",["alergias","alergia"]],["medicamentos","Medicamentos",["medicamentos","medicacao"]],
  ["comorbidades","Comorbidades",["comorbidades"]],["pesoKg","Peso (kg)",["pesoKg","kg"]],
  ["alturaCm","Altura (cm)",["alturaCm"]],["histologia","Histologia",["histologia","extracao.histology"]],
  ["estadiamento","Estadiamento para o protocolo",["estadiamento","estagio","tnm"]],
];
function valores(f:FatoRetrato,aliases:string[]):{bruto:unknown;f:FatoRetrato}[]{
  if(f.campo&&aliases.some(a=>norm(a)===norm(f.campo!)))return [{bruto:f.dados.valor,f}];
  if(f.tipo==="TumorLot"&&aliases.includes("estadiamento")){
    const estados=f.dados.estadiamentos;
    return Array.isArray(estados)?estados.filter(v=>Array.isArray(obj(v).usoAtivo)&&(obj(v).usoAtivo as unknown[]).includes("PROTOCOLO")).map(bruto=>({bruto,f})):[];
  }
  if(!["TumorLot","Weight","Triagem","Paciente"].includes(f.tipo))return [];
  return Object.entries(f.dados).filter(([k])=>aliases.some(a=>norm(a)===norm(k))).map(([,bruto])=>({bruto,f}));
}
/** Campos vêm do retrato já recortado por paciente, lote e horizonte; não extraem fatos de texto. */
export function montarFichaMinima(r:Retrato):CampoFichaMinima[]{
  const ficha=CAMPOS.map(([id,rotulo,aliases]):CampoFichaMinima=>{
    const base:CampoFichaMinima={id,rotulo,estado:"PENDENTE",valor:null,data:null,motivo:"Dado confirmado com fonte não disponível.",fontes:[],fatos:[]};
    let candidatos=r.fatos.flatMap(f=>valores(f,aliases)).map(c=>{
      const w=obj(c.bruto),p=Fonte.array().safeParse(w.fontes);
      const fontes=c.f.fontes.length?c.f.fontes:["TumorLot","Triagem","Weight"].includes(c.f.tipo)&&p.success?p.data:[];
      const datas=[...new Set(fontes.map(f=>f.dataClinica).filter(dataValida))];
      const tempoClinico=dataValida(w.data)?w.data:dataValida(c.f.tempoClinico)?c.f.tempoClinico:datas.length===1?datas[0]!:null;
      return {...c,f:{...c.f,fontes,tempoClinico}};
    }).filter(({f})=>f.fontes.length>0);
    if(!candidatos.length)return base;
    if(id==='estadiamento'){
      const selecionados=candidatos.filter(c=>{const usos=obj(c.bruto).usoAtivo??c.f.dados.usoAtivo;
        return Array.isArray(usos)&&usos.includes('PROTOCOLO');});
      if(!selecionados.length)return {...base,motivo:'Estadiamento sem seleção explícita para o protocolo.',fatos:candidatos.map(c=>c.f.ref),fontes:candidatos.flatMap(c=>c.f.fontes)};
      if(new Set(selecionados.map(c=>canon(c.bruto))).size>1)return {...base,estado:'CONFLITANTE',motivo:'Mais de um estadiamento selecionado para protocolo; decisão médica necessária.',fatos:selecionados.map(c=>c.f.ref),fontes:selecionados.flatMap(c=>c.f.fontes)};
      candidatos=selecionados;
    }
    const datas=candidatos.map(c=>c.f.tempoClinico),todasDatadas=datas.every(d=>d!==null&&Number.isFinite(Date.parse(d)));
    const data=todasDatadas?datas.reduce<string|null>((a,d)=>!a||Date.parse(d!)>Date.parse(a)?d:a,null):null;
    const seriado=['ecog','kps','pesoKg','alturaCm'].includes(id);
    const atuais=seriado&&todasDatadas?candidatos.filter(c=>c.f.tempoClinico===data):candidatos;
    base.data=data;base.fatos=atuais.map(c=>c.f.ref);base.fontes=atuais.flatMap(c=>c.f.fontes);
    const conflitante=atuais.some(c=>obj(c.bruto).campo==="CONFLITO"||obj(c.bruto).estado==="CONFLITO"||obj(c.bruto).estado==="CONFLITANTE");
    const elegiveis=atuais.filter(c=>{const w=obj(c.bruto);
      if(c.f.dados.requiresConfirmation===true||['INFERRED','UNCERTAIN'].includes(String(c.f.dados.evidence)))return false;
      return (w.estado===undefined||["VERDE","VERMELHO"].includes(String(w.estado)))
        &&(w.revisao===undefined||["CONFIRMADO","ASSINADO"].includes(String(w.revisao)))
        &&(w.campo===undefined||w.campo==="PRESENTE");});
    const valoresAtuais=elegiveis.map(c=>Object.hasOwn(obj(c.bruto),"valor")?obj(c.bruto).valor:c.bruto);
    const negacoes=elegiveis.map(c=>c.f.dados.negated===true||c.f.dados.negado===true);
    if(conflitante||new Set(valoresAtuais.map(canon)).size>1||new Set(negacoes).size>1)return {...base,estado:"CONFLITANTE",data:null,motivo:"Fontes discordantes; nenhum valor eleito."};
    const valor=valoresAtuais[0];
    if(!elegiveis.length||elegiveis.length!==atuais.length||valor===undefined||valor===null||typeof valor==="string"&&!valor.trim())return base;
    if(["pesoKg","alturaCm"].includes(id)&&(!Number.isFinite(valor)||typeof valor!=="number"||valor<=0))return {...base,motivo:"Medida sem valor positivo ou unidade estruturada válida."};
    if(id==="ecog"&&(!Number.isInteger(valor)||Number(valor)<0||Number(valor)>5))return {...base,motivo:"ECOG fora do domínio do instrumento."};
    if(id==="kps"&&(!Number.isInteger(valor)||Number(valor)<0||Number(valor)>100||Number(valor)%10!==0))return {...base,motivo:"KPS fora do domínio do instrumento."};
    if(["pesoKg","alturaCm"].includes(id)&&(!data||id==="pesoKg"&&atuais.some(c=>c.f.dados.origem!=="MEDIDO")))
      return {...base,valor:valor as CampoFichaMinima["valor"],motivo:"Conferir data clínica e origem medida antes do cálculo."};
    const negado=atuais.some(c=>c.f.dados.negated===true||c.f.dados.negado===true);
    if(negado&&["cid","ecog","kps","pesoKg","alturaCm","histologia","estadiamento"].includes(id))return {...base,motivo:"Negação documentada; não utilizar como valor positivo."};
    return {...base,estado:"DOCUMENTADO",valor:(negado?{negado:true,conteudo:valor}:valor) as CampoFichaMinima["valor"],motivo:negado?"Negação explícita preservada na fonte.":"Valor explícito no retrato, com fonte preservada."};
  });
  const peso=ficha.find(f=>f.id==="pesoKg")!,altura=ficha.find(f=>f.id==="alturaCm")!;
  const sc=bsaMosteller(peso.estado==="DOCUMENTADO"?peso.valor as number:null,altura.estado==="DOCUMENTADO"?altura.valor as number:null);
  ficha.push({id:"sc",rotulo:"SC (m²)",estado:sc===null?"PENDENTE":"CALCULADO",valor:sc,data:peso.data,
    motivo:sc===null?"Peso medido e altura com data/fonte necessários.":"Mosteller: √(peso kg × altura cm / 3600); confirmar uso na prescrição.",
    fontes:[...peso.fontes,...altura.fontes],fatos:[...peso.fatos,...altura.fatos]});
  return ficha;
}
export function cidsDaFicha(ficha:readonly CampoFichaMinima[]):string[]{
  const cid=ficha.find(f=>f.id==="cid");return cid?.estado==="DOCUMENTADO"&&typeof cid.valor==="string"?[cid.valor.trim().toUpperCase()]:[];
}
export function packCorrespondeAoCid(pack:TumorPackExtract,cids:readonly string[]):boolean{
  return cids.length===1&&pack.cids.some(p=>cids[0]===p.toUpperCase()||cids[0]!.startsWith(`${p.toUpperCase()}.`));
}
export function selecionarPack(r:Retrato,packs:readonly TumorPackExtract[]):TumorPackExtract|null{
  const cids=cidsDaFicha(montarFichaMinima(r)),candidatos=packs.filter(p=>packCorrespondeAoCid(p,cids));
  return candidatos.length===1?candidatos[0]!:null;
}
