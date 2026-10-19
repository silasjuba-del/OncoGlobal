import {useState} from 'react';
import type {LoteCompleto,ItemLoteCompleto} from '../../contracts/fase2/loteCompleto.js';

const FASES={
 primeira:{titulo:'Primeira consulta · pré-tratamento',ordem:['cenarios','diagnostico','estadiamento','biomarcadores','exames','pre_tratamento','tratamento']},
 retorno:{titulo:'Retorno · durante tratamento',ordem:['seguranca','exames','resposta','tratamento','suporte','documentos','encaminhamentos']},
 seguimento:{titulo:'Follow-up · seguimento',ordem:['seguimento','exames','orientacoes','resposta','suporte','encaminhamentos']},
};
/** Dados da fonte permanecem literais, inclusive qualificadores, conflitos e disponibilidade não verificada. */
function Conteudo({valor}:{valor:ItemLoteCompleto['conteudo']}){
 if(valor===null)return <span>Não informado na fonte</span>;
 if(typeof valor!=='object')return <span style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{String(valor)}</span>;
 if(Array.isArray(valor))return valor.length?<ul>{valor.map((v,i)=><li key={i}><Conteudo valor={v}/></li>)}</ul>:<span>Nenhum registro nesta lista</span>;
 return <dl>{Object.entries(valor).map(([k,v])=><div key={k}><dt><strong>{k}</strong></dt><dd><Conteudo valor={v}/></dd></div>)}</dl>;
}
function Item({item}:{item:ItemLoteCompleto}){
 const [aberto,setAberto]=useState(false);
 return <details onToggle={e=>setAberto(e.currentTarget.open)}><summary>{item.titulo}</summary>{aberto?<>
  <small>{item.origem} · {item.localizador}</small><Conteudo valor={item.conteudo}/>
 </>:null}</details>;
}
export function LoteTumoralCompleto({lote}:{lote:LoteCompleto}){
 const [fase,setFase]=useState<keyof typeof FASES>('primeira'),[busca,setBusca]=useState(''),[original,setOriginal]=useState(false);
 const ordem=FASES[fase].ordem;
 const setores=[...lote.setores].sort((a,b)=>(ordem.includes(a.id)?ordem.indexOf(a.id):99)-(ordem.includes(b.id)?ordem.indexOf(b.id):99));
 const consulta=busca.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
 const contem=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').includes(consulta);
 return <section aria-label="Lote tumoral completo">
  <h3>{lote.titulo} · pack completo</h3>
  <p>{lote.protocolosLegados} protocolos legados preservados · {lote.itensUniversais} itens da extensão NCCN · {lote.setores.length} setores</p>
  <p>Cenários, exames, tratamento e suporte recebidos juntos para este tumor.</p>
  <label>Momento da consulta <select value={fase} onChange={e=>setFase(e.target.value as keyof typeof FASES)}>{Object.entries(FASES).map(([id,f])=><option key={id} value={id}>{f.titulo}</option>)}</select></label>
  <p>A fase altera a ordem de leitura. Todos os setores e protocolos continuam disponíveis.</p>
  <label>Buscar no pack completo <input type="search" value={busca} onChange={e=>setBusca(e.target.value)}/></label>{busca?<button onClick={()=>setBusca('')}>Limpar busca</button>:null}
  <p>Acesso SUS/privado: confira a disponibilidade e a fonte de cada item. Informação não verificada permanece pendente.</p>
  {setores.map(setor=>{const itens=consulta?setor.itens.filter(i=>contem(i.titulo)||contem(JSON.stringify(i.conteudo))):setor.itens;
   return <details key={setor.id} open={consulta?itens.length>0:undefined}><summary>{setor.titulo} · {itens.length}{consulta?` de ${setor.itens.length}`:''} itens</summary>
    {itens.length?itens.map(item=><Item key={item.id} item={item}/>):<p>{consulta?'Nenhum resultado nesta busca.':'Não consta conteúdo estruturado neste setor; conferir lacunas e fonte integral.'}</p>}
   </details>;})}
  <details onToggle={e=>setOriginal(e.currentTarget.open)}><summary>Fonte integral, versão e preservação</summary>
   <p>{lote.original.arquivo} · versão {lote.original.versao}</p><p>SHA-256: {lote.original.sha256}</p>
   {original?<pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(lote.conteudoIntegral,null,2)}</pre>:null}
  </details>
 </section>;
}
