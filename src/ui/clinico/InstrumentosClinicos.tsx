import {useEffect,useRef,useState} from "react";
import type {InstrumentoId,ResultadoInstrumento} from "../../contracts/f0c/instrumentos.js";
type Campo={id:string;rotulo:string;unidade?:string;opcoes?:readonly [string,string][]};
const campos:Record<InstrumentoId,readonly Campo[]>={
 KPS:[{id:"kpsDocumentado",rotulo:"KPS documentado (0–100)"}],
 CHILD_PUGH:[{id:"bilirrubina",rotulo:"Bilirrubina",unidade:"mg/dL"},{id:"albumina",rotulo:"Albumina",unidade:"g/dL"},{id:"inr",rotulo:"INR",unidade:"INR"},
  {id:"ascite",rotulo:"Ascite",opcoes:[["AUSENTE","Ausente"],["RESPONSIVA_DIURETICO","Responsiva ao diurético"],["REFRATARIA","Refratária"]]},
  {id:"encefalopatia",rotulo:"Encefalopatia",opcoes:[["AUSENTE","Ausente"],["GRAU_1_2","Grau 1–2"],["GRAU_3_4","Grau 3–4"]]}],
 ALBI:[{id:"bilirrubina",rotulo:"Bilirrubina",unidade:"umol/L"},{id:"albumina",rotulo:"Albumina",unidade:"g/L"}],
 KHORANA:[{id:"sitio",rotulo:"Sítio tumoral",opcoes:[["ESTOMAGO","Estômago"],["PANCREAS","Pâncreas"],["PULMAO","Pulmão"],["LINFOMA","Linfoma"],["GINECOLOGICO","Ginecológico"],["BEXIGA","Bexiga"],["TESTICULO","Testículo"],["OUTRO","Outro"]]},
  {id:"plaquetas",rotulo:"Plaquetas",unidade:"10^9/L"},{id:"hemoglobina",rotulo:"Hemoglobina",unidade:"g/dL"},{id:"leucocitos",rotulo:"Leucócitos",unidade:"10^9/L"},{id:"imc",rotulo:"IMC",unidade:"kg/m2"},
  {id:"usaEstimulanteEritropoiese",rotulo:"Usa estimulante da eritropoiese",opcoes:[["true","Sim"],["false","Não"]]}],
 G8:[{id:"ingestao3Meses",rotulo:"Ingestão nos últimos 3 meses",opcoes:[["REDUCAO_GRAVE","Redução grave"],["REDUCAO_MODERADA","Redução moderada"],["SEM_REDUCAO","Sem redução"]]},
  {id:"perdaPeso3Meses",rotulo:"Perda de peso nos últimos 3 meses",opcoes:[["MAIS_3_KG","Mais de 3 kg"],["NAO_SABE","Não sabe"],["ENTRE_1_3_KG","Entre 1 e 3 kg"],["SEM_PERDA","Sem perda"]]},
  {id:"mobilidade",rotulo:"Mobilidade",opcoes:[["LEITO_CADEIRA","Restrito ao leito/cadeira"],["SAI_LEITO_NAO_CASA","Sai do leito, não sai de casa"],["SAI_CASA","Sai de casa"]]},
  {id:"neuropsicologico",rotulo:"Condição neuropsicológica",opcoes:[["DEMENCIA_OU_DEPRESSAO_GRAVE","Demência ou depressão grave"],["LEVE","Comprometimento leve"],["AUSENTE","Ausente"]]},
  {id:"imc",rotulo:"IMC",unidade:"kg/m2"},{id:"medicamentosPorDia",rotulo:"Número de medicamentos por dia"},
  {id:"autoavaliacaoSaude",rotulo:"Autoavaliação de saúde em relação a pessoas da mesma idade",opcoes:[["PIOR","Pior"],["NAO_SABE","Não sabe"],["IGUAL","Igual"],["MELHOR","Melhor"]]},
  {id:"idadeAnos",rotulo:"Idade (anos)"}],
};
const titulos:Record<InstrumentoId,string>={KPS:"KPS",CHILD_PUGH:"Child-Pugh",ALBI:"ALBI",KHORANA:"Khorana",G8:"G8"};
/** Adaptador de entrada, sem pontuação, conversão de unidade ou inferência de resposta. */
export function montarPedidoInstrumento(instrumento:InstrumentoId,valores:Readonly<Record<string,string>>,aplicavel:string,fonte:string) {
 const fonteDados=fonte.trim() || null;
 const dados:Record<string,unknown>={aplicavel:aplicavel==="true"?true:aplicavel==="false"?false:null,fonteDados};
 for(const c of campos[instrumento]) {
  const v=valores[c.id]?.trim() ?? "";
  if(c.opcoes) dados[c.id]=c.id==="usaEstimulanteEritropoiese" ? v==="true"?true:v==="false"?false:null : c.opcoes.some(([id])=>id===v)?v:null;
  else { const numero=v!=="" && Number.isFinite(Number(v)) ? Number(v):null;
   dados[c.id]=c.unidade ? {valor:numero,unidade:c.unidade,fonte:fonteDados} : numero; }
 }
 return {instrumento,dados};
}
export function InstrumentosClinicos({aoAvaliar,ocupado=false}:{aoAvaliar:(pedido:unknown)=>Promise<ResultadoInstrumento>;ocupado?:boolean}) {
 const [instrumento,setInstrumento]=useState<InstrumentoId>("KPS"),[valores,setValores]=useState<Record<string,string>>({});
 const [aplicavel,setAplicavel]=useState(""),[fonte,setFonte]=useState("");
 const [resultado,setResultado]=useState<ResultadoInstrumento|null>(null),[erro,setErro]=useState<string|null>(null),[calculando,setCalculando]=useState(false);
 const geracao=useRef(0);
 useEffect(()=>()=>{geracao.current++;},[]);
 function editar() {geracao.current++;setResultado(null);setErro(null);}
 async function calcular() {
  if(ocupado || calculando) return;
  const g=++geracao.current;setCalculando(true);setErro(null);setResultado(null);
  try {const r=await aoAvaliar(montarPedidoInstrumento(instrumento,valores,aplicavel,fonte));
   if(g!==geracao.current)return;
   if(r.instrumento!==instrumento) throw new Error("Resultado pertence a outro instrumento.");
   setResultado(r);
  }catch(e){if(g===geracao.current)setErro(e instanceof Error?e.message:"Não foi possível calcular.");}
  finally{if(g===geracao.current)setCalculando(false);}
 }
 return <section aria-label="Instrumentos clínicos">
  <h3>Instrumentos clínicos</h3><p>Escolha o instrumento e informe os dados documentados. O cálculo permanece rascunho para revisão.</p>
  <fieldset disabled={ocupado || calculando}><legend>Dados para cálculo</legend>
   <label>Instrumento<select aria-label="Instrumento" value={instrumento} onChange={e=>{editar();setInstrumento(e.target.value as InstrumentoId);setValores({});setAplicavel("");setFonte("");}}>{Object.entries(titulos).map(([id,t])=><option key={id} value={id}>{t}</option>)}</select></label>
   <label>Aplicabilidade confirmada pelo médico<select aria-label="Aplicabilidade confirmada pelo médico" value={aplicavel} onChange={e=>{editar();setAplicavel(e.target.value);}}><option value="">Não definida</option><option value="true">Aplicável</option><option value="false">Não aplicável</option></select></label>
   <label>Fonte dos dados<input type="text" aria-label="Fonte dos dados" value={fonte} onChange={e=>{editar();setFonte(e.target.value);}} placeholder="Documento, avaliação médica e data" maxLength={1000}/></label>
   {campos[instrumento].map(c=><label key={`${instrumento}-${c.id}`} style={{display:"block",marginTop:8}}>{c.rotulo}{c.unidade ? ` (${c.unidade})`:""}
    {c.opcoes ? <select aria-label={c.rotulo} value={valores[c.id]??""} onChange={e=>{editar();setValores(v=>({...v,[c.id]:e.target.value}));}}><option value="">Não informado</option>{c.opcoes.map(([id,t])=><option key={id} value={id}>{t}</option>)}</select>
    : <input type="number" step="any" aria-label={`${c.rotulo}${c.unidade?` (${c.unidade})`:""}`} value={valores[c.id]??""} onChange={e=>{editar();setValores(v=>({...v,[c.id]:e.target.value}));}}/>}
   </label>)}
   <button type="button" onClick={()=>void calcular()}>{calculando?"Calculando…":"Calcular"}</button>
  </fieldset>
  {erro && <p role="alert">{erro}</p>}
  {resultado && <section aria-label="Resultado do instrumento" aria-live="polite"><h4>{titulos[resultado.instrumento]} · rascunho</h4>
   <p>{resultado.estado==="CALCULADO"?`Resultado: ${resultado.escore ?? "PENDENTE"} · ${resultado.classificacao ?? "Sem classificação"}`:resultado.estado==="NAO_APLICAVEL"?"Não aplicável":"Pendente"}</p>
   <p>Fonte dos dados: {resultado.fonteDados ?? "PENDENTE"}</p><p>Referência: {resultado.fonteRegra ?? "PENDENTE"} · versão {resultado.regraVersao ?? "PENDENTE"}</p>
   {resultado.pendencias.length>0 && <p>Pendências: {resultado.pendencias.join("; ")}</p>}
  </section>}
 </section>;
}
