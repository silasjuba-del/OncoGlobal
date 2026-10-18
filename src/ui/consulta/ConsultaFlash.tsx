import type { SituacaoExame, ExameRecenteFlash, ItemFlash, EstadoApacFlash, ApacFlash, RetornoFlash, TarefasRetornoFlash, ConsultaFlashProps, PlanoFlash,ReceitaManualFlash,DocumentoManualFlash } from '../../contracts/api/flash.js';
export type { SituacaoExame, ExameRecenteFlash, ItemFlash, EstadoApacFlash, ApacFlash, RetornoFlash, TarefasRetornoFlash, ConsultaFlashProps, PlanoFlash } from '../../contracts/api/flash.js';
import { useState } from "react";
import { marcadoInicialmente } from "./Bundle.js";
import type { MarcacaoTarefasRetorno } from "./TarefasRetorno.js";
// @ts-expect-error folha CSS pura, resolvida pelo Vite
import "./flash.css";
// @ts-expect-error folha CSS pura, resolvida pelo Vite
import "./consulta-local.css";









/** Compatibilidade do envelope: APAC permanece apenas como rascunho legado, fora do fluxo Flash. */

export function marcadoInicialFlash(item: ItemFlash): boolean {
  if (item.id === "liberar_tratamento") return false;
  return marcadoInicialmente({ documentId: item.id, documentVersion: 1, titulo: item.rotulo, preMarcado: item.preMarcado, visivel: true, origem: item.origem });
}
const LAB = ["HMG", "U", "Cr", "TGO", "TGP"];
const RAD = ["TC tórax", "TC abdome superior", "TC abdome inferior", "Cintilografia"];
const presente = (v?: string) => v?.trim() || "PENDENTE";
const limparOutros = (v: string) => v.split(";").map(x => x.trim()).filter(Boolean);
const situacao = { DENTRO_DO_LIMITE: "dentro do limite", FORA_DO_LIMITE: "fora do limite", SEM_REFERENCIA: "sem referência" };
type ReceitaEmEdicao = { conteudo: ReceitaManualFlash; incluir: boolean; persistida: boolean };
const novaReceita = (): ReceitaEmEdicao => ({ conteudo: { id: `receita-manual-${crypto.randomUUID()}`,
  medicamento: "", dose: null, orientacao: null, duracao: null, via: null, quantidade: null }, incluir: false, persistida: false });
const camposReceita = [["medicamento", "Medicamento"], ["dose", "Dose"], ["orientacao", "Orientação / posologia"],
  ["duracao", "Duração"], ["via", "Via"], ["quantidade", "Quantidade"]] as const;

export function ConsultaFlash(props: ConsultaFlashProps) {
  const { cabecalho: c, planoInicial: inicial } = props;
  const [documentos,setDocumentos]=useState<DocumentoManualFlash[]>(()=>structuredClone([...(inicial?.documentosManuais??[])]));
  const documentoInvalido=documentos.some(d=>!d.titulo.trim()||!d.texto.trim()||d.tipo==='ENCAMINHAMENTO'&&!d.destino?.trim());
  const selecaoInicial = inicial ? inicial.solicitacoes : props.modeloSolicitacoes;
  const [labs, setLabs] = useState<string[]>(() => selecaoInicial?.laboratorio.filter(x => LAB.includes(x)) ?? []);
  const [rad, setRad] = useState<string[]>(() => selecaoInicial?.imagem.filter(x => RAD.includes(x)) ?? []);
  const [outrosLab, setOutrosLab] = useState(() => selecaoInicial?.laboratorio.filter(x => !LAB.includes(x)).join("; ") ?? "");
  const [outrosRad, setOutrosRad] = useState(() => selecaoInicial?.imagem.filter(x => !RAD.includes(x)).join("; ") ?? "");
  // Apenas a escolha expressa salva pelo médico pode restaurar esta seleção.
  const [ciclo, setCiclo] = useState(inicial?.decisaoQt?.solicitarCiclo ?? false);
  const [data, setData] = useState(inicial?.decisaoQt?.data ?? props.hoje ?? "");
  const [prazo, setPrazo] = useState(() => { const d = inicial ? inicial.retorno.dias : props.retorno.dias; return d == null ? "" : String(d); });
  const [receitas, setReceitas] = useState<ReceitaEmEdicao[]>(() => inicial?.receitas?.length
    ? inicial.receitas.map(conteudo => ({ conteudo: { ...conteudo }, incluir: inicial.receitasMarcadas.includes(conteudo.id), persistida: true }))
    : [novaReceita()]);
  const dias = prazo.trim() === "" ? null : Number(prazo);
  const prazoInvalido = dias !== null && (!Number.isInteger(dias) || dias < 1 || dias > 3650);
  const receitaInvalida = receitas.some(r => !r.conteudo.medicamento.trim()
    && (r.incluir || r.persistida || camposReceita.some(([campo]) => r.conteudo[campo]?.trim())));
  const invalido=prazoInvalido||receitaInvalida;
  function plano(): PlanoFlash {
    const laboratorio = [...new Set([...labs, ...limparOutros(outrosLab)])];
    const imagem = [...new Set([...rad, ...limparOutros(outrosRad)])];
    const preenchidas = receitas.filter(r => r.conteudo.medicamento.trim());
    return { acoesMarcadas: [], receitasMarcadas: preenchidas.filter(r => r.incluir).map(r => r.conteudo.id),
      ...(documentos.length?{documentosManuais:documentos}:{}),
      ...(inicial?.propostasInvestigacao?{propostasInvestigacao:inicial.propostasInvestigacao.filter(p=>[...laboratorio,...imagem].includes(p.exameCodigo))}:{}),
      ...(preenchidas.length ? { receitas: preenchidas.map(r => ({ ...r.conteudo, medicamento: r.conteudo.medicamento.trim() })) } : {}),
      apac: { ...props.apac, emitir: false },
      retorno: { ...props.retorno, dias: invalido ? null : dias, examesAntesDoRetorno: [...laboratorio, ...imagem] },
      tarefasRetorno: { retorno: true, laboratorio: laboratorio.length > 0, imagem: imagem.length > 0 },
      solicitacoes: { laboratorio, imagem }, decisaoQt: { solicitarCiclo: ciclo, data: data || null } };
  }
  function selecao(titulo: string, nomes: string[], valores: string[], alterar: (v: string[]) => void, outros: string, alterarOutros: (v: string) => void, rotulo: string) {
    const todos = nomes.every(x => valores.includes(x));
    return <section className="flash-coluna" aria-label={rotulo}>
      <div className="flash-colhead"><h3>{titulo}</h3><button type="button" onClick={() => alterar(todos ? [] : [...nomes])} aria-label={`${todos ? "Desmarcar" : "Selecionar"} todos ${titulo}`}>{todos ? "Nenhum" : "Todos"}</button></div>
      {nomes.map(nome => <label className="flash-check" key={nome}><input type="checkbox" checked={valores.includes(nome)} onChange={() => alterar(valores.includes(nome) ? valores.filter(x => x !== nome) : [...valores, nome])} />{nome}</label>)}
      <label className="flash-outros">Outros<input type="text" aria-label={`Outros ${titulo}`} value={outros} onChange={e => alterarOutros(e.target.value)} placeholder="Médico escreve; separe por ;" maxLength={2000} /></label>
    </section>;
  }
  return <section className="consulta-flash" aria-label="Conteúdo da Consulta Flash">
    <header className="flash-cabecalho"><strong>Consulta Flash</strong>{props.pacienteNome && <span>{props.pacienteNome}</span>}{props.aoAbrirApac && <button type="button" onClick={props.aoAbrirApac}>Abrir APAC ↗</button>}</header>
    <div className="flash-corpo">
      <section aria-label="Revisão rápida"><h3>DIAGNÓSTICO</h3><p className="flash-diagnostico">{presente(c.diagnostico)} · TNM {presente(c.tnm)} · Estádio {presente(c.estadio)}</p>
        <p className="flash-evidencias" aria-label="Biópsia e imagem">{props.exames.length ? props.exames.map(e => `${e.data} · ${e.nome}: ${e.fraseLaudo || "PENDENTE"}`).join(" | ") : "Biópsia e imagem: PENDENTE"}</p>
      </section>
      <section className="flash-linha" aria-label="Resultados laboratoriais"><h3>LABS <small>· últimos resultados</small></h3><div className="flash-resultados">{props.laboratorios?.length ? props.laboratorios.map((e, i) => <span key={`${e.nome}-${i}`} title={situacao[e.situacao]}>{e.nome}: {e.fraseLaudo || "PENDENTE"} <small>({e.data}) · {situacao[e.situacao]}</small></span>) : <span>PENDENTE</span>}</div></section>
      <section className="flash-linha" aria-label="Tratamento vigente"><h3>QT</h3><p><strong>{presente(c.tratamentoAtual)} · ciclo {presente(c.cicloDia)}</strong> <small>Previsto · último administrado: {presente(c.ultimoAdministrado)}</small></p></section>
      <section className="flash-seguranca" aria-label="Toxicidades e alergia"><div><strong>TOX</strong> {props.toxicidades?.length ? props.toxicidades.join(" · ") : "Informação estruturada PENDENTE"}</div><div><strong>ALERGIA</strong> {c.alergia?.trim() || "Não informada"}</div></section>
      {props.avisos?.length ? <p role="alert" aria-label="Lembretes agrupados">{props.avisos.join("; ")}</p> : null}
      {props.parciaisCumulativos?.length ? <p className="flash-alaranjado" data-cor="ALARANJADO">{props.parciaisCumulativos.join("; ")}</p> : null}
      {props.sugestoesClinicas?.length ? <p className="flash-linha" aria-label="Sugestões clínicas">{props.sugestoesClinicas.join("; ")}</p> : null}
      {props.sugestoesLaboratorio?.length ? <button type="button" onClick={() => setOutrosLab(atual =>
        [...new Set([...limparOutros(atual),...props.sugestoesLaboratorio!])].join("; "))}>
        Incluir exames sugeridos: {props.sugestoesLaboratorio.join(", ")}</button> : null}
      {props.iaFala.length > 0 && <p className="flash-linha" aria-label="Pendências e alertas">{props.iaFala.join("; ")}</p>}
      <h3 className="flash-conduta">CONDUTA MÉDICA</h3>
      <fieldset className="flash-edicao" disabled={props.ocupado}><legend className="flash-sr">Solicitações e decisão médica</legend><div className="flash-colunas">
        {selecao("LAB", LAB, labs, setLabs, outrosLab, setOutrosLab, "Solicitações laboratoriais")}
        {selecao("RAD", RAD, rad, setRad, outrosRad, setOutrosRad, "Solicitações de imagem")}
        <section className="flash-coluna" aria-label="Decisão médica sobre o ciclo"><h3>QT</h3><p>{presente(c.tratamentoAtual)} · {presente(c.cicloDia)}</p><label className="flash-check"><input type="checkbox" checked={ciclo} onChange={e => setCiclo(e.target.checked)} />Liberar ciclo {c.cicloDia ?? ""}</label><label className="flash-outros">Data<input type="date" aria-label="Data do ciclo" value={data} onChange={e => setData(e.target.value)} /></label><small>Decisão do médico</small></section>
      </div></fieldset>
      <fieldset className="flash-edicao flash-receitas" disabled={props.ocupado} aria-label="Receita manual"><legend>Receitas — médico escreve</legend>
        {receitas.map((item, indice) => <section className="flash-receita" aria-label={`Receita ${indice + 1}`} key={item.conteudo.id}>
          <div className="flash-receita-titulo"><h4>Medicamento {indice + 1}</h4>
            <button type="button" aria-label={`Remover receita ${indice + 1}`} onClick={() =>
              setReceitas(atuais => atuais.filter(r => r.conteudo.id !== item.conteudo.id))}>Remover</button></div>
          <label className="flash-check"><input type="checkbox" checked={item.incluir}
            aria-label={`Incluir receita digitada${indice ? ` ${indice + 1}` : ""}`}
            onChange={e => setReceitas(atuais => atuais.map(r => r.conteudo.id === item.conteudo.id ? { ...r, incluir: e.target.checked } : r))} />Incluir na receita</label>
          <div className="flash-receita-campos">{camposReceita.map(([campo, rotulo]) =>
            <label className="flash-outros" key={campo}>{rotulo}<input type="text"
              aria-label={`${rotulo} da receita${indice ? ` ${indice + 1}` : ""}`} maxLength={campo === "orientacao" ? 2000 : 300}
              value={item.conteudo[campo] ?? ""} onChange={e => {
                const valor = campo === "medicamento" ? e.target.value : e.target.value.trim() ? e.target.value : null;
                setReceitas(atuais => atuais.map(r => r.conteudo.id === item.conteudo.id
                  ? { ...r, conteudo: { ...r.conteudo, [campo]: valor } } : r));
              }} /></label>)}</div>
        </section>)}
        <button type="button" onClick={() => setReceitas(atuais => [...atuais, novaReceita()])}>Adicionar medicamento</button>
        <small>Campos vazios continuam não informados. Dose, via e quantidade não são completadas automaticamente.</small>
      </fieldset>
      <details><summary>Encaminhamentos, laudos e orientações</summary>
        <fieldset disabled={props.ocupado}><legend>Documentos médicos</legend>
          {documentos.map((d,i)=><section key={d.id} aria-label={`Documento médico ${i+1}`}>
            <label>Título <input aria-label={`Título do documento ${i+1}`} value={d.titulo} maxLength={200}
              onChange={e=>setDocumentos(atuais=>atuais.map(a=>a.id===d.id?{...a,titulo:e.target.value}:a))}/></label>
            {d.tipo==='ENCAMINHAMENTO'?<label>Destino <input aria-label={`Destino do encaminhamento ${i+1}`} placeholder="Especialidade ou serviço" value={d.destino??''} maxLength={200}
              onChange={e=>setDocumentos(atuais=>atuais.map(a=>a.id===d.id?{...a,destino:e.target.value}:a))}/></label>:null}
            <label>Conteúdo escrito pelo médico <textarea aria-label={`Conteúdo do documento ${i+1}`} value={d.texto} maxLength={8000}
              onChange={e=>setDocumentos(atuais=>atuais.map(a=>a.id===d.id?{...a,texto:e.target.value}:a))}/></label>
            <button type="button" onClick={()=>setDocumentos(atuais=>atuais.filter(a=>a.id!==d.id))}>Remover documento {i+1}</button>
          </section>)}
          {(['ENCAMINHAMENTO','LAUDO','ORIENTACOES'] as const).map(tipo=><button type="button" key={tipo} disabled={documentos.length>=10}
            onClick={()=>setDocumentos(atuais=>[...atuais,{id:`doc-${crypto.randomUUID()}`,tipo,titulo:tipo==='ENCAMINHAMENTO'?'Encaminhamento':tipo==='LAUDO'?'Laudo clínico':'Orientações',destino:null,texto:''}])}>
            {tipo==='ENCAMINHAMENTO'?'Adicionar encaminhamento':tipo==='LAUDO'?'Adicionar laudo':'Adicionar orientações'}</button>)}
          <p>O resumo clínico confirmado será incorporado à prévia. Conteúdo e destino dependem da decisão médica.</p>
        </fieldset>
      </details>
    </div>
    <footer className="flash-rodape"><label>Retorno em <input type="number" aria-label="Prazo do retorno em dias" min={1} max={3650} value={prazo} disabled={props.ocupado} aria-invalid={invalido} onChange={e => setPrazo(e.target.value)} /> dias</label><div><button type="button" disabled={props.ocupado || invalido} onClick={() => props.aoSalvarRascunho(plano())}>SALVAR RASCUNHO</button><button type="button" disabled={props.ocupado || invalido || documentoInvalido} onClick={() => props.aoFinalizar(plano())}>{props.rotuloFinalizar ?? "REVISAR · IMPRIMIR"}</button></div></footer>
    {prazoInvalido && <p role="alert">Informe um número inteiro entre 1 e 3650 dias, ou deixe vazio para PENDENTE.</p>}
    {receitaInvalida && <p role="alert">Informe o medicamento ou remova a linha para continuar. Os outros campos serão preservados.</p>}
    {documentoInvalido&&<p role="status">Documento incompleto: pode salvar o rascunho; complete título, conteúdo e destino antes da revisão para assinatura.</p>}
  </section>;
}
