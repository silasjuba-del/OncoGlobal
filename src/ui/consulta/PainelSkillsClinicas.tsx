import { LIMITE_TEXTO_DOCUMENTO_MANUAL, type DocumentoManualFlash } from "../../contracts/api/flash.js";
import { useEffect, useRef, useState } from "react";
import type { PortaConsulta, PedidoBundle } from "../api/porta.js";
import type { ResultadoSkillClinica, PedidoSkillClinica } from "../../contracts/skillsClinicas.js";

type Catalogo = Extract<ResultadoSkillClinica,{codigo:"SKILLS_DISPONIVEIS"}>;
type Fontes = Extract<ResultadoSkillClinica,{codigo:"SKILL_FONTES"}>["fontes"];
type Historico = Extract<ResultadoSkillClinica,{codigo:"SKILLS_HISTORICO"}>["execucoes"];
type Preparado = Extract<ResultadoSkillClinica,{codigo:"SKILL_PREPARADA"|"SKILL_REPLAY"|"SKILL_CARREGADA"}>;

export function PainelSkillsClinicas({porta,contexto,aoUsarDocumento}:{porta:PortaConsulta;contexto:PedidoBundle;aoUsarDocumento?:(d:DocumentoManualFlash)=>void}) {
  const [aberto,setAberto]=useState(false), [catalogo,setCatalogo]=useState<Catalogo|null>(null);
  const [fontes,setFontes]=useState<Fontes>([]),[historico,setHistorico]=useState<Historico>([]);
  const [selecionadas,setSelecionadas]=useState<string[]>([]),[cartoes,setCartoes]=useState<string[]>([]),[acoes,setAcoes]=useState<string[]>([]);
  const [skill,setSkill]=useState<'primeira-consulta'|'retorno'|'follow-up'>('primeira-consulta');
  const [tratamento,setTratamento]=useState(false),[ocupado,setOcupado]=useState(false),[erro,setErro]=useState('');
  const [resultado,setResultado]=useState<Preparado|null>(null);
  const geracao=useRef(0),req=useRef<AbortController|null>(null),busy=useRef(false);
  const tentativa=useRef<{chave:string;operationId:string}|null>(null);
  const ctx={patientId:contexto.patientId,encounterId:contexto.encounterId,tumorLotId:contexto.tumorLotId??null};
  const chaveCtx=JSON.stringify(ctx);
  useEffect(()=>{
    const id=++geracao.current; const ctl=new AbortController(); req.current?.abort(); req.current=ctl;
    setResultado(null);setCatalogo(null);setFontes([]);setHistorico([]);setSelecionadas([]);setCartoes([]);setAcoes([]);setErro('');tentativa.current=null;
    if (!aberto||!porta.skillsClinicas) return ()=>{geracao.current++;ctl.abort();};
    busy.current=true;setOcupado(true);
    void Promise.all([porta.skillsClinicas({acao:'CATALOGO'},ctl.signal),porta.skillsClinicas({acao:'FONTES',contexto:ctx},ctl.signal),
      porta.skillsClinicas({acao:'HISTORICO',contexto:ctx},ctl.signal)]).then(([cat,fs,hs])=>{
      if(id!==geracao.current||ctl.signal.aborted)return;
      if(cat.codigo!=='SKILLS_DISPONIVEIS'||fs.codigo!=='SKILL_FONTES'||hs.codigo!=='SKILLS_HISTORICO')throw Error();
      setCatalogo(cat);setFontes(fs.fontes);setHistorico(hs.execucoes);
    }).catch(()=>{if(id===geracao.current&&!ctl.signal.aborted)setErro('Não foi possível carregar a jornada. Reabra para tentar novamente.');})
      .finally(()=>{if(id===geracao.current){busy.current=false;setOcupado(false);}});
    return ()=>{geracao.current++;ctl.abort();};
  },[porta,aberto,chaveCtx]);
  async function executar(pedido:PedidoSkillClinica){
    if(!porta.skillsClinicas||busy.current)return;
    const id=geracao.current,ctl=new AbortController();req.current?.abort();req.current=ctl;
    busy.current=true;setOcupado(true);setErro('');setResultado(null);
    try{
      const r=await porta.skillsClinicas(pedido,ctl.signal);
      if(id!==geracao.current||ctl.signal.aborted)return;
      if(r.codigo!=='SKILL_PREPARADA'&&r.codigo!=='SKILL_REPLAY'&&r.codigo!=='SKILL_CARREGADA')throw Error();
      const mesmoContexto=(c:Preparado['execucao']['contexto'])=>c.patientId===ctx.patientId&&c.encounterId===ctx.encounterId&&c.tumorLotId===ctx.tumorLotId;
      if(!mesmoContexto(r.execucao.contexto)||r.documentos.some(d=>!mesmoContexto(d.contexto)||d.execucaoId!==r.execucao.execucaoId)
        ||(pedido.acao==='LER'&&(r.codigo!=='SKILL_CARREGADA'||r.execucao.execucaoId!==pedido.execucaoId))
        ||(pedido.acao==='EXECUTAR'&&(r.codigo==='SKILL_CARREGADA'||r.execucao.skillId!==pedido.skillId))) throw Error();
      setResultado(r);tentativa.current=null;
      try {
        const h=await porta.skillsClinicas({acao:'HISTORICO',contexto:ctx},ctl.signal);
        if(id===geracao.current&&!ctl.signal.aborted&&h.codigo==='SKILLS_HISTORICO')setHistorico(h.execucoes);
      } catch {
        if(id===geracao.current&&!ctl.signal.aborted)setErro('Rascunhos recuperados com sucesso; não foi possível atualizar a lista do histórico.');
      }
    }catch{if(id===geracao.current&&!ctl.signal.aborted)setErro('Não foi possível concluir. Confira vínculo e revisão das fontes; repetir o mesmo pedido não duplica a operação.');}
    finally{if(id===geracao.current){busy.current=false;setOcupado(false);}}
  }
  function preparar(){
    const base={acao:'EXECUTAR' as const,contexto:ctx,skillId:skill,versao:'1.0.0' as const,
      fontes:fontes.filter(f=>selecionadas.includes(f.draftId)).map(f=>({draftId:f.draftId,expectedRevision:f.revision})),
      configuracao:{documentos:['RESUMO_CASO','EVOLUCAO','PEDIDO_EXAMES','ENCAMINHAMENTO'] as const,
        estiloResumo:'POR_DOMINIO' as const,priorizarPendencias:true,receitas:[],exames:[],
        jornada:{cartoesIds:cartoes,acoesIds:acoes,discutirTratamento:tratamento}}};
    const chave=JSON.stringify(base);
    if(tentativa.current?.chave!==chave)tentativa.current={chave,operationId:crypto.randomUUID()};
    void executar({...base,configuracao:{...base.configuracao,documentos:[...base.configuracao.documentos]},operationId:tentativa.current.operationId});
  }
  if(!porta.skillsClinicas)return null;
  return <section aria-label="Jornada clínica por skills" style={{minWidth:0,maxWidth:'100%',overflowWrap:'anywhere'}}>
    <button type="button" className="oc-btn-secondary" aria-expanded={aberto} onClick={()=>setAberto(!aberto)}>Jornada por skills</button>
    {aberto&&<>
      <p>Organizar laudos, referências e rascunhos para revisão médica. Não assina documentos nem libera tratamento.</p>
      {erro&&<p role="alert">{erro}</p>}
      <label>Encontro <select aria-label="Tipo de jornada" value={skill} disabled={ocupado} onChange={e=>{setSkill(e.target.value as typeof skill);setResultado(null);}}>
        <option value="primeira-consulta">Primeira consulta</option><option value="retorno">Retorno</option><option value="follow-up">Follow-up</option>
      </select></label>
      <fieldset disabled={ocupado} style={{minWidth:0,maxWidth:'100%',boxSizing:'border-box'}}><legend>Laudos e exames vinculados</legend>
        {!fontes.length&&<p>Vincule e revise as fontes da consulta para preparar a jornada.</p>}
        {fontes.map(f=><label key={f.draftId} style={{display:'block'}}><input type="checkbox" checked={selecionadas.includes(f.draftId)}
          onChange={e=>{setSelecionadas(s=>e.target.checked?[...s,f.draftId]:s.filter(id=>id!==f.draftId));setResultado(null);}}/>{f.sourceId} · revisão {f.revision}{f.encounterId&&<small> · atendimento anterior · registrado em {f.registradoEm}</small>}</label>)}
      </fieldset>
      <label style={{display:'block'}}>Cenários do corpus — referências em revisão <select aria-label="Cenários de pulmão" multiple value={cartoes} disabled={ocupado}
        style={{display:'block',width:'100%',minWidth:0,maxWidth:'100%',boxSizing:'border-box',margin:0}}
        onChange={e=>{setCartoes(Array.from(e.target.selectedOptions,o=>o.value));setResultado(null);}}>
        {catalogo?.corpus?.cartoes.map(c=><option key={c.id} value={c.id}>{c.id} · {c.estadiamento} · {c.subtipo}</option>)}
      </select></label>
      <label style={{display:'block'}}>Exames e encaminhamentos — propostas condicionais <select aria-label="Ações da jornada" multiple value={acoes} disabled={ocupado}
        style={{display:'block',width:'100%',minWidth:0,maxWidth:'100%',boxSizing:'border-box',margin:0}}
        onChange={e=>{setAcoes(Array.from(e.target.selectedOptions,o=>o.value));setResultado(null);}}>
        {catalogo?.corpus?.acoes_consulta.map(a=><option key={a.id} value={a.id}>{a.id} · {a.contexto} · {a.rascunho}</option>)}
      </select></label>
      {!catalogo?.corpus&&<p>Corpus indisponível. A organização documental continua sem sugestões de referência.</p>}
      <label><input type="checkbox" checked={tratamento} disabled={ocupado} onChange={e=>{setTratamento(e.target.checked);setResultado(null);}}/>Incluir discussão do tratamento</label>
      <button type="button" className="oc-btn-primary" disabled={ocupado||(skill==='primeira-consulta'&&!selecionadas.length)||selecionadas.length>20||cartoes.length>12||acoes.length>20} onClick={preparar}>
        {ocupado?'Preparando…':'Preparar rascunhos da jornada'}</button>
      {resultado&&<article aria-label="Resultado da jornada">
        <p role="status">{resultado.validade==='ATUAL'?'Rascunhos preparados — revisão médica pendente.':'Entradas alteradas — somente consulta histórica; prepare nova versão.'}</p>
        {resultado.execucao.jornada?.estado==='URGENTE'&&<p role="alert">Suspeita urgente: avaliação médica prioritária. Propostas eletivas interrompidas.</p>}
        <ol>{resultado.execucao.jornada?.etapas.map(e=><li key={e.id}>{e.titulo}: {e.estado}. {e.motivo}</li>)}</ol>
        {!!resultado.execucao.jornada?.cartoes.length&&<section aria-label="Linhas de referência sem dose">
          <p>Corpus disponível para consulta com fontes. A indicação individual e a prescrição dependem da revisão médica.</p>
          {resultado.execucao.jornada.cartoes.map(c=><article key={c.id}>
            <h4>{c.id} · {c.estadiamento} · {c.subtipo}</h4>
            <ul>{Object.entries(c.linhas).flatMap(([n,l])=>{
              if(!l.opcoes.length&&(n==='4'||n==='5'))return [];
              return [<li key={`${c.id}-L${n}`}><strong>L{n}.</strong> {l.opcoes.length?l.opcoes.join(' ou '):`Sem opção extraída. ${l.condicao}`}{l.opcoes.length&&l.condicao?` ${l.condicao}`:''} Sem dose.</li>];
            })}</ul>
          </article>)}
        </section>}
        {resultado.documentos.map(d=><details key={d.documentId}><summary>{d.titulo}</summary><div style={{whiteSpace:'pre-wrap'}}>{d.texto}</div>
          {aoUsarDocumento && d.tipo !== 'RECEITA' && <button type="button" disabled={ocupado || resultado.validade !== 'ATUAL' || d.texto.length > LIMITE_TEXTO_DOCUMENTO_MANUAL}
            onClick={() => { const ref = resultado.execucao.documentos.find(r => r.documentId === d.documentId); if (!ref) return;
              aoUsarDocumento({ id: `skill-${ref.hash}`, tipo: d.tipo as DocumentoManualFlash['tipo'], titulo: d.titulo,
                destino: null, texto: d.texto, origemSkill: { contexto: ctx, execucaoId: d.execucaoId, documentId: d.documentId, hash: ref.hash } });
            }}>Revisar documento no Flash</button>}
        </details>)}
      </article>}
      {!!historico.length&&<section aria-label="Histórico das jornadas"><h4>Rascunhos salvos</h4>{historico.map(h=><p key={h.execucaoId}>
        {h.skillId} · {h.criadoEm} <button type="button" disabled={ocupado} onClick={()=>void executar({acao:'LER',contexto:ctx,execucaoId:h.execucaoId})}>Reabrir jornada</button>
      </p>)}</section>}
    </>}
  </section>;
}
