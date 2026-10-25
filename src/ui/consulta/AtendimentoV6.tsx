import { useEffect,useRef,useState } from "react";
import type { PortaConsulta } from "../api/porta.js";
import { AtendimentoV6Resposta, type EntradaAtendimentoV6 } from "../../contracts/api/atendimentoV6.js";

const nomes={RESUMO:"Resumo do caso",EVOLUCAO:"Evolução por diferenças",EXAMES:"Pedido de exames",RETORNO:"Retorno",PRESCRICAO:"Prescrição"} as const;
const vazio=():EntradaAtendimentoV6=>({hoje:"",decisao:"",saidas:["RESUMO","EVOLUCAO"]});
function TextoRascunho({texto}:{texto:string}){
 const marcador="\n\nFONTES E PROVENIÊNCIA\n",indice=texto.lastIndexOf(marcador);
 return <><pre>{indice<0?texto:texto.slice(0,indice)}</pre>{indice>=0?<details className="atendimento-v6__fontes-documento"><summary>Fontes deste rascunho</summary><pre>{texto.slice(indice+marcador.length)}</pre></details>:null}</>;
}
const mensagem=(e:unknown)=>{
 const c=e instanceof Error?e.message:"";
 if(c==="VERSAO_RASCUNHO_CONFLITANTE")return "Outra versão foi salva. Atualize a base e confira a versão recuperada; sua entrada local será preservada.";
 if(c==="RETRATO_ALTERADO_RECARREGAR")return "O prontuário mudou. Atualize a base antes de preparar novamente; sua entrada local será preservada.";
 return "Não foi possível concluir. O texto local foi preservado; o salvamento desta tentativa não está confirmado.";
};
export function AtendimentoV6({porta,contexto}:{porta:PortaConsulta;contexto:{patientId:string;encounterId:string;tumorLotId:string|null}}){
 const [dados,setDados]=useState<AtendimentoV6Resposta|null>(null),[entrada,setEntrada]=useState(vazio);
 const [ocupado,setOcupado]=useState(true),[aviso,setAviso]=useState("");
 const geracao=useRef(0),controlador=useRef<AbortController|null>(null),emCurso=useRef(false),origem=useRef<PortaConsulta|null>(null);
 const tentativa=useRef<{conteudo:string;chave:string}|null>(null);
 const contextoChave=JSON.stringify(contexto);
 function conferir(raw:unknown){
  const r=AtendimentoV6Resposta.parse(raw);
  if(r.contexto.patientId!==contexto.patientId||r.contexto.encounterId!==contexto.encounterId||r.contexto.tumorLotId!==contexto.tumorLotId)throw Error("CONTEXTO_CONSULTA_ALTERADO");return r;
 }
 async function recuperar(preservar=false){
  if(!porta.recuperarAtendimentoV6||emCurso.current)return;
  const g=++geracao.current;controlador.current?.abort();const abort=new AbortController();controlador.current=abort;
  emCurso.current=true;setOcupado(true);setAviso("");
  try{const r=conferir(await porta.recuperarAtendimentoV6(contexto,abort.signal));if(g!==geracao.current)return;
   origem.current=porta;setDados(r);if(!preservar)setEntrada(r.rascunho?.entrada??vazio());
   if(preservar)setAviso("Base atualizada. Sua entrada foi preservada; confira os dados recuperados antes de preparar.");
  }catch(e){if(g===geracao.current)setAviso(mensagem(e));}
  finally{if(g===geracao.current){emCurso.current=false;setOcupado(false);}}
 }
 useEffect(()=>{geracao.current++;controlador.current?.abort();emCurso.current=false;setDados(null);setEntrada(vazio());tentativa.current=null;
  void recuperar();return()=>{geracao.current++;controlador.current?.abort();emCurso.current=false;};
 },[porta,contextoChave]);
 const atual=dados&&origem.current===porta&&dados.contexto.patientId===contexto.patientId&&dados.contexto.encounterId===contexto.encounterId&&dados.contexto.tumorLotId===contexto.tumorLotId?dados:null;
 const alterado=!!atual?.rascunho&&JSON.stringify(entrada)!==JSON.stringify(atual.rascunho.entrada);
 const exibivel=atual?.estadoRascunho==="ATUAL"&&!alterado?atual.rascunho:null;
 async function preparar(){
  if(!atual||!porta.prepararAtendimentoV6||emCurso.current||!entrada.saidas.length)return;
  const corpo={...contexto,entrada,expectedBaseHash:atual.base.revisao,expectedVersion:atual.rascunho?.versao??null};
  const conteudo=JSON.stringify(corpo);if(tentativa.current?.conteudo!==conteudo)tentativa.current={conteudo,chave:crypto.randomUUID()};
  const g=++geracao.current;const abort=new AbortController();controlador.current=abort;
  emCurso.current=true;setOcupado(true);setAviso("");
  try{const r=conferir(await porta.prepararAtendimentoV6({...corpo,idempotencyKey:tentativa.current.chave},abort.signal));if(g!==geracao.current)return;
   origem.current=porta;setDados(r);if(r.rascunho)setEntrada(r.rascunho.entrada);
   setAviso("Rascunho salvo e recuperável. Revisão e assinatura permanecem pendentes.");
  }catch(e){if(g===geracao.current)setAviso(mensagem(e));}
  finally{if(g===geracao.current){emCurso.current=false;setOcupado(false);}}
 }
 return <section className="atendimento-v6" aria-label="Atendimento por diferenças" aria-busy={ocupado}>
  <header className="atendimento-v6__header"><div><span className="atendimento-v6__eyebrow">ONCOLOGIA · V6.0</span><h2>Atendimento por diferenças</h2>
   <p>Informe o que mudou e sua decisão. O histórico acessível já vem do prontuário.</p></div><span className="atendimento-v6__badge">Rascunhos · revisão médica</span></header>
  {atual?<><div className="atendimento-v6__contexto"><strong>{atual.base.pacienteNome}</strong><span>Referência: {atual.base.dataReferencia??"data do encontro não informada"}</span><span>{atual.base.citacoes.length} trechos recuperados com referências</span></div>
   <p className="atendimento-v6__origem">As entradas abaixo pertencem ao atendimento de {atual.base.dataReferencia??"data clínica ainda não informada"}.</p>
   {atual.base.anotacoesChat?.length?<section aria-label="Anotações médicas aceitas do chat"><h3>Anotações médicas aceitas do chat</h3>
    {atual.base.anotacoesChat.map(n=><article key={n.eventId}><p>{n.texto}</p><small>Autor: {n.autor} · Registro: {n.em} · Mensagem: {n.mensagemId}</small></article>)}
   </section>:null}
   {atual.base.pendenciasAnotacoes?.length?<p className="atendimento-v6__pendente">Há anotações indisponíveis para a evolução; confira a proveniência antes de concluir esse documento.</p>:null}
   {atual.rascunho?<p className="atendimento-v6__origem">Entrada recuperada do mesmo encontro · versão {atual.rascunho.versao} · data clínica: {atual.rascunho.dataClinica??"não informada"} · autor: {atual.rascunho.autor.medicoId}. O horário do salvamento não atualiza a data clínica.</p>:null}
   <div className="atendimento-v6__entrada"><label>Hoje — somente o que mudou<textarea rows={4} maxLength={12000} disabled={ocupado} value={entrada.hoje}
    placeholder="Ex.: fadiga G2 informada; sem febre referida." onChange={e=>setEntrada({...entrada,hoje:e.target.value})}/></label>
   <label>Decisão médica de hoje<textarea rows={4} maxLength={12000} disabled={ocupado} value={entrada.decisao}
    placeholder="Sua conduta explícita. Se não informada, não será inventada." onChange={e=>setEntrada({...entrada,decisao:e.target.value})}/></label></div>
   <fieldset className="atendimento-v6__saidas" disabled={ocupado}><legend>Saídas</legend>{(Object.keys(nomes) as (keyof typeof nomes)[]).map(tipo=><label key={tipo}>
    <input type="checkbox" checked={entrada.saidas.includes(tipo)} onChange={e=>setEntrada({...entrada,saidas:e.target.checked?[...entrada.saidas,tipo]:entrada.saidas.filter(s=>s!==tipo)})}/>{nomes[tipo]}</label>)}</fieldset>
   <div className="atendimento-v6__acoes"><button type="button" className="atendimento-v6__principal" disabled={ocupado||!entrada.saidas.length} onClick={()=>void preparar()}>Preparar rascunhos</button>
    <button type="button" disabled={ocupado} onClick={()=>void recuperar(true)}>Atualizar base preservando texto</button></div>
   {alterado?<p className="atendimento-v6__pendente">Alterações locais ainda não preparadas. A prévia anterior foi ocultada.</p>:null}
   {atual.estadoRascunho==="DESATUALIZADO"?<p className="atendimento-v6__pendente">O retrato mudou desde este rascunho. Revise a base e prepare uma nova versão.</p>:null}
   <details className="atendimento-v6__fontes"><summary>AGORA · fontes e datas recuperadas</summary>{atual.base.citacoes.map((c,i)=><article key={i}><p>{c.texto}</p>
    {c.referencias.map(f=><small key={f.ref.eventId}>Data clínica: {f.tempoClinico??"não informada"} · Registro: {f.tempoRegistro}{f.unidade?` · Unidade: ${f.unidade}`:""} · Fonte: {f.fontes.map(s=>`${s.sourceId} (${s.classe}) · ${s.localizador??"localizador não informado"} · versão ${s.versao} · data da fonte ${s.dataClinica??"não informada"} · captura ${s.dataCaptura}`).join("; ")||"não disponível"} · {f.ref.eventId}<br/></small>)}</article>)}</details>
   <p className="atendimento-v6__mudou"><strong>MUDOU</strong> · {atual.base.delta.encounterAnteriorId?`${atual.base.delta.novos.length} novas referências e ${atual.base.delta.substituidos.length} substituições desde o encontro anterior.`:"Sem comparação confirmada com encontro anterior. Isso não significa ausência de mudanças."}</p>
   {exibivel?<div className="atendimento-v6__documentos"><h3>Pronto para revisar</h3>{exibivel.documentos.map(d=><section key={d.tipo} aria-label={`${d.titulo} · ${d.estado==="FLUXO_ESPECIFICO_NECESSARIO"?"pendências":"rascunho"}`} className="atendimento-v6__documento">
    <header><h4>{d.titulo}</h4><span className={d.estado==="PRONTO_PARA_REVISAO"?"atendimento-v6__badge":"atendimento-v6__pendente"}>{d.estado==="PRONTO_PARA_REVISAO"?"Rascunho para revisão":d.estado==="PENDENTE"?"Pendência neste documento":"Fluxo específico necessário"}</span></header>
    {d.pendencias.length?<ul>{d.pendencias.map(p=><li key={p}>{p}</li>)}</ul>:null}
    {d.estado!=="FLUXO_ESPECIFICO_NECESSARIO"?<TextoRascunho texto={d.texto}/>:<p>{entrada.decisao?`Decisão disponível: ${entrada.decisao}`:"Decisão médica não informada."}</p>}
   </section>)}<p className="atendimento-v6__estado"><strong>Estado da entrega:</strong> versão {exibivel.versao} · data clínica {exibivel.dataClinica??"não informada"} · salva em {exibivel.salvoEm}. Texto informado por {exibivel.autor.medicoId}. Nenhum fato confirmado, assinatura ou envio criado.</p></div>:null}
  </>:<p>{ocupado?"Recuperando dados deste contexto…":"Dados indisponíveis. Tente recuperar novamente."}</p>}
  {!atual&&!ocupado?<button type="button" onClick={()=>void recuperar()}>Recuperar dados</button>:null}
  <p role="status" aria-live="polite">{aviso}</p>
 </section>;
}
