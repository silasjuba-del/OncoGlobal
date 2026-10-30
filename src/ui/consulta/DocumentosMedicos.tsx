import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist";
// @ts-expect-error URL do worker local resolvida pelo Vite, sem CDN.
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { MAX_PACOTE_DOCUMENTAL_BYTES, PacoteDocumental, type ApiDocumental, type ContextoDocumental,
  type DocumentoDocumentalResposta, type ResumoDocumental } from "../../contracts/api/importacaoDocumental.js";
import type { FactSourceType } from "../../contracts/w10/extracao.js";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function bytesPdf(base64: string): Uint8Array { return Uint8Array.from(atob(base64), c => c.charCodeAt(0)); }

/** Renderização local em canvas: não executa scripts nem links contidos no PDF. */
function PaginaPdf({ base64, pagina, nome, aoTotal }: { base64: string; pagina: number; nome: string; aoTotal: (total: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null), [erro, setErro] = useState("");
  const totalAtual = useRef(aoTotal); totalAtual.current = aoTotal;
  useEffect(() => {
    let ativo = true;
    setPdf(null); setErro("");
    const tarefa = getDocument({ data: bytesPdf(base64), enableXfa: false });
    void tarefa.promise.then(doc => { if (ativo) { setPdf(doc); totalAtual.current(doc.numPages); } })
      .catch(() => { if (ativo) setErro("Visualização indisponível. O original permanece disponível para baixar e revisar."); });
    return () => { ativo = false; void tarefa.destroy(); };
  }, [base64]);
  useEffect(() => {
    if (!pdf) return;
    let ativo = true; let render: { cancel: () => void } | undefined;
    void pdf.getPage(Math.min(pagina, pdf.numPages)).then(p => {
      if (!ativo || !canvas.current) return;
      const el = canvas.current, ctx = el.getContext("2d"); if (!ctx) return;
      const viewport = p.getViewport({ scale: 1.25 }); el.width = viewport.width; el.height = viewport.height;
      const tarefa = p.render({ canvas: el, canvasContext: ctx, viewport }); render = tarefa;
      return tarefa.promise;
    }).catch(() => { if (ativo) setErro("Página não disponível para visualização."); });
    return () => { ativo = false; render?.cancel(); };
  }, [pdf, pagina]);
  return <>{erro ? <p role="alert">{erro}</p> : null}
    <canvas ref={canvas} role="img" aria-label={`${nome} — página ${pagina}`} style={{ maxWidth: "100%", height: "auto" }} />
  </>;
}

function Documento({ valor, aoRevisar }: { valor: DocumentoDocumentalResposta; aoRevisar?: ((id: string) => void) | undefined }) {
  const [pagina, setPagina] = useState(1), [total, setTotal] = useState(1), [derivado, setDerivado] = useState(false);
  const [download, setDownload] = useState<string | null>(null);
  const arquivo = derivado && valor.pacote.derivado ? valor.pacote.derivado : valor.pacote.original;
  useEffect(() => {
    setPagina(1); setTotal(1);
    const blob = new Blob([new Uint8Array(bytesPdf(arquivo.bytesBase64))], { type: "application/pdf" });
    const url = URL.createObjectURL(blob); setDownload(url);
    return () => URL.revokeObjectURL(url);
  }, [arquivo.bytesBase64]);
  return <article aria-label={`Documento ${valor.documento.nome}`} style={{ minWidth: 0 }}>
    <h4>{valor.documento.nome}</h4>
    <p>Recebido de {valor.pacote.origem.aplicativo} · autoria declarada: {valor.pacote.autor} · {valor.pacote.criadoEm}</p>
    <p>Importado por {valor.documento.importadoPor} · {valor.documento.recebidoEm}. Vínculo {valor.documento.vinculoPaciente === "PENDENTE" ? "pendente" : "revisado"}; conteúdo sujeito à revisão médica.</p>
    <details><summary>Proveniência e integridade</summary><p>SHA-256 do original: {valor.pacote.original.sha256}</p><p>Fonte: {valor.documento.sourceId}</p><p>Pacote: {valor.pacote.pacoteId}</p></details>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <button type="button" onClick={() => setDerivado(false)} aria-pressed={!derivado}>Original preservado</button>
      {valor.pacote.derivado ? <button type="button" onClick={() => setDerivado(true)} aria-pressed={derivado}>Derivado editado</button> : null}
      {download ? <a href={download} download={arquivo.nome}>Baixar {derivado ? "derivado" : "original"}</a> : null}
      {valor.documento.draftId && aoRevisar ? <button type="button" onClick={() => aoRevisar(valor.documento.draftId!)}>Revisar fonte na consulta</button> : null}
    </div>
    {derivado ? <p>Derivado: {valor.pacote.derivado?.descricao}. Não substitui o original nem representa fato confirmado.</p> : null}
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button type="button" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>Página anterior</button>
      <span>Página {pagina} de {total}</span>
      <button type="button" disabled={pagina >= total} onClick={() => setPagina(p => p + 1)}>Próxima página</button>
    </div>
    <PaginaPdf base64={arquivo.bytesBase64} pagina={pagina} nome={arquivo.nome} aoTotal={setTotal} />
    <details><summary>Texto extraído localmente do original</summary>
      {valor.textoLocal.length ? valor.textoLocal.map(p => <section key={p.pagina}><strong>Página {p.pagina}</strong><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{p.texto}</pre></section>)
        : <p>Conversão pendente ou sem texto legível. Revise o original.</p>}
    </details>
    <details><summary>Anotações e texto enviados pelo PDFForge</summary>
      <p>Conteúdo externo não revisado. Anotações de IA não são fatos do paciente.</p>
      {valor.pacote.anotacoes.map(a => <section key={a.id}><strong>{a.autorTipo === "IA" ? "Proposta da IA" : "Anotação do usuário"} · {a.autor} · página {a.pagina}</strong><p>{a.texto}</p><small>{a.criadoEm}</small></section>)}
      {valor.pacote.paginasExtraidas.map(p => <section key={p.pagina}><strong>Página externa {p.pagina}</strong><pre style={{ whiteSpace: "pre-wrap" }}>{p.texto}</pre></section>)}
    </details>
  </article>;
}

export function DocumentosMedicos({ api, contexto, aoSelecionarFonte, aoImportar, aoAtividade }: {
  api: ApiDocumental | undefined; contexto: ContextoDocumental;
  aoAtividade?: (ocupado:boolean)=>void;
  aoSelecionarFonte?: ((draftId: string) => void) | undefined; aoImportar?: (() => void) | undefined;
}) {
  const [itens, setItens] = useState<ResumoDocumental[]>([]), [arquivo, setArquivo] = useState<File | null>(null);
  const [tipoFonte, setTipoFonte] = useState<FactSourceType>("medical_note"), [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState(""), [erro, setErro] = useState("");
  const [selecoes, setSelecoes] = useState<[string, string]>(["", ""]);
  const [abertos, setAbertos] = useState<[DocumentoDocumentalResposta | null, DocumentoDocumentalResposta | null]>([null, null]);
  const geracao = useRef(0), importando = useRef(false), abort = useRef<AbortController | null>(null);
  const aberturas = useRef<[number, number]>([0, 0]);
  const chave = JSON.stringify(contexto);
  useEffect(()=>{aoAtividade?.(ocupado);return()=>aoAtividade?.(false);},[ocupado,aoAtividade]);
  useEffect(() => {
    const g = ++geracao.current; abort.current?.abort(); abort.current = new AbortController();
    importando.current = false; setOcupado(false); setArquivo(null); setItens([]); setSelecoes(["", ""]); setAbertos([null, null]); setMensagem(""); setErro("");
    if (api) void api.listar(contexto, abort.current.signal).then(r => { if (g === geracao.current) setItens(r.documentos); })
      .catch(() => { if (g === geracao.current) setErro("Não foi possível carregar documentos deste encontro."); });
    return () => { geracao.current++; abort.current?.abort(); };
  }, [api, chave]);
  async function importar() {
    if (!api || !arquivo || importando.current) return;
    const g = geracao.current; importando.current = true; setOcupado(true); setErro(""); setMensagem("");
    try {
      if (arquivo.size > MAX_PACOTE_DOCUMENTAL_BYTES) throw Error("PACOTE_DOCUMENTAL_EXCESSIVO");
      const pacote = PacoteDocumental.parse(JSON.parse(await arquivo.text()));
      if (g !== geracao.current) return;
      const r = await api.importar({ contexto, tipoFonte, pacote }, abort.current?.signal);
      if (g !== geracao.current) return;
      const lista = await api.listar(contexto, abort.current?.signal);
      if (g !== geracao.current) return;
      setItens(lista.documentos); setMensagem(`${r.codigo === "REPLAY" ? "Pacote já recebido" : "Documento recebido"}. Identidade e conteúdo aguardam conferência; nenhum fato foi confirmado.`);
      aoImportar?.();
    } catch (e) { if (g === geracao.current) setErro(e instanceof Error && /^[A-Z0-9_]{1,100}$/.test(e.message)
      ? e.message : "Pacote inválido ou importação não concluída. O conteúdo recebido não foi confirmado."); }
    finally { if (g === geracao.current) { importando.current = false; setOcupado(false); } }
  }
  async function abrir(indice: 0 | 1, pacoteId: string) {
    const g = geracao.current, abertura = ++aberturas.current[indice];
    setSelecoes(s => { const n: [string, string] = [...s]; n[indice] = pacoteId; return n; });
    setAbertos(s => { const n: typeof s = [...s]; n[indice] = null; return n; });
    if (!api || !pacoteId) return;
    try {
      const r = await api.abrir({ contexto, pacoteId }, abort.current?.signal);
      if (g !== geracao.current || abertura !== aberturas.current[indice]) return;
      setAbertos(s => { const n: typeof s = [...s]; n[indice] = r; return n; });
    } catch { if (g === geracao.current && abertura === aberturas.current[indice]) setErro("Não foi possível abrir o documento; confira o contexto e a integridade."); }
  }
  return <section aria-label="Documentos médicos"><h3>Documentos e comparação de fontes</h3>
    <p>Importe o pacote local exportado pelo PDFForge. O original permanece preservado; texto externo e anotações não confirmam fatos.</p>
    <label>Pacote documental PDFForge <input type="file" accept="application/json,.json" disabled={ocupado || !api} onChange={e => setArquivo(e.target.files?.[0] ?? null)} /></label>
    <label>Classificação da fonte <select disabled={ocupado} value={tipoFonte} onChange={e => setTipoFonte(e.target.value as FactSourceType)}>
      <option value="medical_note">Documento clínico</option><option value="pathology">Anatomopatológico</option><option value="imaging_report">Laudo de imagem</option>
      <option value="lab_feed">Laboratório</option><option value="prescription">Prescrição</option>
    </select></label>
    <button type="button" disabled={!api || !arquivo || ocupado} onClick={() => void importar()}>{ocupado ? "Recebendo documento…" : "Importar pacote documental"}</button>
    {erro ? <p role="alert">{erro}</p> : null}{mensagem ? <p role="status">{mensagem}</p> : null}
    {!api ? <p>Integração documental indisponível neste ambiente.</p> : null}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: 16 }}>
      {([0, 1] as const).map(i => <section key={i} aria-label={`Comparação ${i + 1}`} style={{ minWidth: 0 }}>
        <label>Documento {i + 1} <select value={selecoes[i]} onChange={e => void abrir(i, e.target.value)}><option value="">Selecione uma fonte</option>
          {itens.map(d => <option key={d.pacoteId} value={d.pacoteId}>{d.nome} · {d.conversao === "PENDENTE" ? "conversão pendente" : "recebido"}</option>)}</select></label>
        {abertos[i] ? <Documento key={abertos[i].pacote.pacoteId} valor={abertos[i]} aoRevisar={aoSelecionarFonte} /> : null}
      </section>)}
    </div>
  </section>;
}
