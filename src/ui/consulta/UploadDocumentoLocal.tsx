import { useEffect,useRef,useState } from "react";
import { ErroPorta,type PortaConsulta,type PedidoBundle,type PedidoUploadLocal } from "../api/porta.js";

/** Arquivo fica no servidor local; conversão é rascunho e exige vínculo humano posterior. */
export function UploadDocumentoLocal({porta,contexto,aoSalvar}:{porta:PortaConsulta;contexto:PedidoBundle;aoSalvar:()=>void}) {
  const [arquivo,setArquivo]=useState<File|null>(null),[tipoFonte,setTipoFonte]=useState<PedidoUploadLocal["sourceType"]>("medical_note");
  const [ocupado,setOcupado]=useState(false),[mensagem,setMensagem]=useState("");
  const geracao=useRef(0),abort=useRef<AbortController|null>(null),intent=useRef<{arquivo:File;id:string;sourceId:string}|null>(null);
  useEffect(()=>{geracao.current++;abort.current?.abort();setArquivo(null);setMensagem("");setOcupado(false);intent.current=null;
    return()=>{geracao.current++;abort.current?.abort();};},[contexto.patientId,contexto.encounterId,contexto.tumorLotId]);
  async function converter(){
    if(!arquivo||ocupado||!porta.uploadDocumentoLocal)return;
    if(arquivo.size>8*1024*1024){setMensagem("Limite local: 8 MB por arquivo.");return;}
    const tipo=arquivo.type==="application/pdf"||/\.pdf$/i.test(arquivo.name)?"PDF":arquivo.type.startsWith("image/")?"IMAGEM":null;
    if(!tipo){setMensagem("Selecione PDF ou imagem.");return;}
    const atual=geracao.current;setOcupado(true);setMensagem("");abort.current=new AbortController();
    if(intent.current?.arquivo!==arquivo)intent.current={arquivo,id:crypto.randomUUID(),sourceId:crypto.randomUUID()};
    const identificadores=intent.current;
    try{
      const bytesBase64=await new Promise<string>((resolve,reject)=>{const leitor=new FileReader();leitor.onload=()=>typeof leitor.result==="string"?resolve(leitor.result.split(",")[1]??""):reject(Error("LEITURA_INVALIDA"));leitor.onerror=()=>reject(Error("LEITURA_INVALIDA"));leitor.readAsDataURL(arquivo);});
      if(atual!==geracao.current)return;
      const r=await porta.uploadDocumentoLocal({...contexto,...{id:identificadores.id,sourceId:identificadores.sourceId},sourceType:tipoFonte,tipo,bytesBase64},abort.current.signal);
      if(atual!==geracao.current)return;
      setMensagem(r.conversionStatus!=="PRONTO"?`Original preservado. Conversão pendente (${r.motivo??"revisão necessária"}).${r.paginasPendentes?.length?` Páginas a conferir: ${r.paginasPendentes.join(", ")}.`:""}`:
        "Texto convertido em rascunho. Confira a fonte e vincule ao paciente antes de confirmar fatos.");aoSalvar();
    }catch(e){if(atual===geracao.current)setMensagem(e instanceof ErroPorta?`Upload pendente (${e.detalhe??e.codigo}). Original não foi confirmado.`:"Não foi possível converter. Reabra o arquivo local.");}
    finally{if(atual===geracao.current)setOcupado(false);}
  }
  return <section aria-label="Importar documento local"><h3>Importar PDF ou imagem</h3>
    <p>Conversão local para rascunho; identidade e fatos aguardam revisão médica.</p>
    <label>Documento local <input type="file" accept="application/pdf,image/*" disabled={ocupado} onChange={e=>{setArquivo(e.target.files?.[0]??null);intent.current=null;}}/></label>
    <label>Tipo da fonte <select value={tipoFonte} disabled={ocupado} onChange={e=>setTipoFonte(e.target.value as PedidoUploadLocal["sourceType"])}>
      <option value="medical_note">Documento clínico</option><option value="pathology">Anatomopatológico</option><option value="imaging_report">Laudo de imagem</option>
      <option value="lab_feed">Laboratório</option><option value="prescription">Prescrição</option><option value="nursing">Enfermagem</option>
    </select></label>
    <button type="button" disabled={ocupado||!arquivo||!porta.uploadDocumentoLocal} onClick={()=>void converter()}>{ocupado?"Convertendo localmente…":"Converter e revisar"}</button>
    {mensagem?<p role="status">{mensagem}</p>:null}
  </section>;
}
