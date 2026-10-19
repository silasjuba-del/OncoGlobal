import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PropostaDoseReceita} from '../contracts/api/propostaDoseReceita.js';
import {doseReceitaPendente} from '../contracts/f1/receitaDose.js';
import {hashCanonico} from '../rules/conteudoCanonico.js';
const arquivo='corpus/2-receitas/suporte/receitas-suporte-oncologico.v1.RASCUNHO.json';
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const str=(v:unknown)=>typeof v==='string'&&v.trim()?v.trim():null;
export const nomeMedicamento=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');
function doseComUnidade(dose:string,unidade:string):string {
 const literal=unidade.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return new RegExp(`(?:^|[^a-zA-Z])${literal}s?(?:$|[^a-zA-Z])`,'i').test(dose)?dose:`${dose} ${unidade}`;
}

/** Copia literal de fonte documental: não ativa o corpus nem escolhe indicação para o paciente. */
export function lerPropostasDoseReceita(bruto?:string):PropostaDoseReceita[] {
 try {
  const bytes=bruto??readFileSync(new URL('../../'+arquivo,import.meta.url),'utf8');
  const raiz=obj(JSON.parse(bytes));if(raiz.consultavel!==true||!Array.isArray(raiz.itens))return [];
  const header=obj(raiz.header),hash=createHash('sha256').update(bytes,'utf8').digest('hex');
  return raiz.itens.flatMap((valor,i)=>{
   const item=obj(valor),fonte=obj(item.fonte),politica=obj(item.politicaLocal);
   if(politica.propor===false||obj(item.controle344).lista!=='comum'||fonte.estado!=='VERIFICADO'||doseReceitaPendente(item.dose))return [];
   if(!str(item.id)||!str(item.droga)||!str(item.indicacao)||!str(fonte.referencia)||!str(fonte.trecho)||!str(header.versao)||doseReceitaPendente(item.unidade))return [];
   const dados={id:String(item.id),medicamento:String(item.droga),dose:doseComUnidade(String(item.dose),String(item.unidade)),doseOriginal:String(item.dose),unidade:String(item.unidade),via:str(item.via),
    orientacao:str(item.frequencia),duracao:str(item.duracao),indicacao:String(item.indicacao),
    restricoes:[raiz.nota,item.gatilho,item.ajusteRenal,item.ajusteHepatico,item.interacoesCriticas,item.nota,item.pendencia,item.orientacaoPaciente,politica.motivo].flatMap(x=>str(x)?[String(x)]:[]),
    estado:'PROPOSTA' as const,requerValidacaoMedica:true as const,
    fonte:{arquivo,versao:String(header.versao),hash,localizador:`/itens/${i}`,referencia:String(fonte.referencia),trecho:String(fonte.trecho),curadoria:String(raiz.status??'NAO_INFORMADA')}};
   return [PropostaDoseReceita.parse({...dados,hashProposta:hashCanonico(dados)})];
  });
 }catch{return [];}
}
