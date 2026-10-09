import { useEffect, useRef, useState } from "react";
import type { ConsultaVisao, FlashPreparada, PedidoBundle, PortaConsulta } from "../api/porta.js";
import { ErroPorta } from "../api/porta.js";
import { ConsultaResposta } from "../api/respostas.js";
import { ConsultaFlash, type ConsultaFlashProps, type PlanoFlash } from "./ConsultaFlash.js";
import { CartaoTransversal } from "./CartaoTransversal.js";

type DocumentoPreview = { documentId: string; documentVersion: number; draftId: string;
  titulo: string; texto: string; conteudoHash: string };
type Preview = { preparacao: FlashPreparada; documentos: DocumentoPreview[]; operacao: string };

/** Composição HTTP real. Nenhum cadastro, prescrição ou histórico de demonstração. */
export function ConsultaPersistida({ porta, contexto }: { porta: PortaConsulta; contexto: PedidoBundle }) {
  const [visao, setVisao] = useState<ConsultaVisao | null>(null);
  const [flash, setFlash] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [versao, setVersao] = useState(0);
  const geracao = useRef(0);
  const emCurso = useRef(false);
  const tentativaPreparacao = useRef<{ plano: string; operacao: string } | null>(null);
  const { patientId, encounterId, tumorLotId } = contexto;

  useEffect(() => {
    const atual = ++geracao.current;
    emCurso.current = false; setOcupado(false); setVisao(null); setPreview(null); setFlash(false);
    tentativaPreparacao.current = null;
    void porta.carregarConsulta(patientId, tumorLotId).then((bruto) => {
      if (atual !== geracao.current) return;
      const r = ConsultaResposta.safeParse(bruto);
      if (!r.success || r.data.patientId !== patientId || r.data.encounterId !== encounterId
        || r.data.tumorLotId !== tumorLotId) {
        setMensagem("Consulta completa PENDENTE: contexto ou dados ainda indisponíveis."); return;
      }
      setVisao(r.data);
    }, () => { if (atual === geracao.current) setMensagem("Não foi possível carregar a consulta persistida."); });
    return () => { geracao.current++; };
  }, [porta, patientId, encounterId, tumorLotId, versao]);

  async function executar(acao: (atual: number) => Promise<void>) {
    if (emCurso.current) return;
    emCurso.current = true; setOcupado(true); setMensagem("");
    const atual = geracao.current;
    try { await acao(atual); }
    catch (erro) { if (atual === geracao.current) setMensagem(erro instanceof ErroPorta
      ? erro.message === "FLASH_JA_FINALIZADA" ? "Este conteúdo já foi finalizado. Reabra o histórico para conferir."
        : `Operação não concluída (${erro.codigo}). Reabra o conteúdo para conferir.`
      : "Operação não concluída. O conteúdo permanece pendente de revisão."); }
    finally { if (atual === geracao.current) { emCurso.current = false; setOcupado(false); } }
  }

  function salvar(plano: PlanoFlash) {
    if (!porta.salvarRascunhoFlash || !visao) return;
    void executar(async (atual) => {
      const resultado = await porta.salvarRascunhoFlash!({ patientId, encounterId, tumorLotId, plano,
        expectedRevision: visao.flash?.rascunho?.revision ?? null });
      if (atual !== geracao.current) return;
      setMensagem("Rascunho salvo; sem assinatura.");
      setVisao((v) => v?.flash ? { ...v, flash: { ...v.flash,
        rascunho: { draftId: resultado.draftId, revision: resultado.revision } } } : v);
    });
  }

  function preparar(plano: PlanoFlash) {
    if (!porta.prepararFinalizacaoFlash) return;
    void executar(async (atual) => {
      const chavePlano = JSON.stringify([patientId, encounterId, tumorLotId, plano]);
      // Uma resposta perdida não cria outro conjunto de documentos ao repetir o mesmo plano.
      if (tentativaPreparacao.current?.plano !== chavePlano)
        tentativaPreparacao.current = { plano: chavePlano, operacao: crypto.randomUUID() };
      const { operacao } = tentativaPreparacao.current;
      const preparacao = await porta.prepararFinalizacaoFlash!({ patientId, encounterId, tumorLotId,
        plano, idempotencyKey: operacao });
      if (atual !== geracao.current) return;
      if (!preparacao.registros.length || !preparacao.documentos.length) throw new Error("DOCUMENTOS_AUSENTES");
      const bundle = await porta.exibirBundle({ patientId, encounterId, tumorLotId,
        draftIds: preparacao.registros.map((r) => r.id) });
      if (atual !== geracao.current) return;
      if (bundle.patientId !== patientId || bundle.encounterId !== encounterId
        || bundle.documentos.length !== preparacao.documentos.length) throw new Error("BUNDLE_DIVERGENTE");
      const documentos = bundle.documentos.map((doc): DocumentoPreview => {
        const esperado = preparacao.documentos.find((d) => d.documentId === doc.documentId
          && d.documentVersion === doc.documentVersion);
        const corpo = doc.conteudo && typeof doc.conteudo === "object" && !Array.isArray(doc.conteudo)
          ? doc.conteudo as Record<string, unknown> : null;
        const ctx = corpo?.contexto as Record<string, unknown> | undefined;
        if (!esperado || !doc.draftId || !preparacao.registros.some((r) => r.id === doc.draftId)
          || !doc.conteudoHash || !/^[a-f0-9]{64}$/.test(doc.conteudoHash)
          || typeof corpo?.texto !== "string" || (ctx?.patientId !== undefined && ctx.patientId !== patientId)
          || ctx?.encounterId !== encounterId || ctx.tumorLotId !== tumorLotId) throw new Error("CONTEUDO_NAO_EXIBIVEL");
        return { documentId: doc.documentId, documentVersion: doc.documentVersion, draftId: doc.draftId,
          titulo: esperado.titulo, texto: corpo.texto, conteudoHash: doc.conteudoHash };
      });
      if (new Set(documentos.map((d) => d.documentId)).size !== documentos.length) throw new Error("DOCUMENTO_DUPLICADO");
      setPreview({ preparacao, documentos, operacao }); setFlash(false);
    });
  }

  function assinar() {
    if (!preview) return;
    const exibido = preview;
    void executar(async (atual) => {
      // Não solicita outro bundle aqui: conteúdo alterado depois da tela tem de ser recusado.
      const resposta = await porta.confirmar({ patientId, encounterId, tumorLotId, bloco: "TUDO",
        registros: [...exibido.preparacao.registros],
        documentosExibidos: exibido.documentos.map(({ documentId, documentVersion }) => ({ documentId, documentVersion })),
        reconhecerAlertas: [], idempotencyKey: `${exibido.operacao}:assinar` });
      if (atual !== geracao.current) return;
      if (resposta.codigo !== "GRAVADA" && resposta.codigo !== "REPLAY") throw new ErroPorta(resposta.codigo);
      setPreview(null); setMensagem("Consulta finalizada. Documentos assinados e preservados no histórico.");
      setVersao((v) => v + 1);
    });
  }

  if (!visao) return <section aria-label="Consulta persistida"><p aria-live="polite">
    {mensagem || "Carregando consulta persistida…"}</p></section>;
  const lote = visao.cabecalho.lotes.find((l) => l.tumorLotId === tumorLotId);
  const diagnostico = lote?.histologia.campo === "PRESENTE" ? lote.histologia.valor : null;
  const cid = lote?.cid.campo === "PRESENTE" ? lote.cid.valor : null;
  const f = visao.flash;
  const propsFlash: ConsultaFlashProps = {
    cabecalho: diagnostico ? { diagnostico } : {}, exames: f?.exames ?? [],
    acoesHoje: [], receitas: [], iaFala: [],
    apac: { cid: cid ?? "", sigtap: "", finalidade: "", competencia: "", estado: "PENDENTE", pendencias: [] },
    retorno: { dias: f?.retornoDias ?? null, examesAntesDoRetorno: [] }, linhaPontualizada: true,
    tarefasRetorno: { modeloPadraoSalvo: f?.modeloPadraoSalvo ?? false,
      retorno: { id: "retorno", rotulo: "Retorno", origem: "MODELO_MEDICO", preMarcado: true },
      laboratorio: { id: "laboratorio", rotulo: "Laboratório", origem: "MODELO_MEDICO", preMarcado: f?.laboratorioPreMarcado ?? false },
      imagem: { id: "imagem", rotulo: "Imagem", origem: "MODELO_MEDICO", preMarcado: f?.imagemPreMarcada ?? false } },
    ocupado, rotuloFinalizar: "Revisar documentos para assinatura", aoSalvarRascunho: salvar, aoFinalizar: preparar,
  };
  return <section aria-label="Consulta persistida">
    <h2>{visao.cabecalho.paciente.nome} · consulta local</h2>
    <p>{visao.hoje} · Dados pendentes: {visao.cabecalho.pendentes}</p>
    {visao.alertas.filter((a) => a.presentationOverride).map((a) =>
      <aside role="alert" data-banner="e1" key={a.alertaId}><strong>Emergência E1</strong><p>{a.texto}</p></aside>)}
    {mensagem ? <p aria-live="polite">{mensagem}</p> : null}
    <h3>Evolução revisada</h3>
    <pre style={{ whiteSpace: "pre-wrap" }}>{visao.resumoEvolucao ?? "Evolução PENDENTE de revisão."}</pre>
    {visao.retratoTransversal ? <CartaoTransversal entrada={visao.retratoTransversal} />
      : <p>Cartão transversal PENDENTE de fonte estruturada.</p>}
    <button type="button" disabled={ocupado} onClick={() => { setPreview(null); setFlash(true); }}>Consulta Flash</button>
    <button type="button" disabled={ocupado} onClick={() => setVersao((v) => v + 1)}>Reabrir histórico</button>
    {flash ? <ConsultaFlash {...propsFlash} /> : null}
    {preview ? <section aria-label="Conteúdo para assinatura">
      <h3>Confira os documentos desta consulta</h3>
      {preview.documentos.map((doc) => <article key={doc.documentId}>
        <h4>{doc.titulo} · versão {doc.documentVersion}</h4>
        <pre style={{ whiteSpace: "pre-wrap" }}>{doc.texto}</pre>
      </article>)}
      <button type="button" disabled={ocupado} onClick={assinar}>Confirmar e assinar conteúdo exibido</button>
    </section> : null}
    <section aria-label="Histórico de documentos assinados"><h3>Histórico de documentos assinados</h3>
      {(visao.historicoDocumentos ?? []).length === 0 ? <p>Nenhum documento assinado neste histórico.</p>
        : visao.historicoDocumentos!.map((doc) => <article key={doc.eventId}>
          <h4>{doc.titulo}</h4><p>{doc.assinadoEm} · {doc.autorId} · {doc.encounterId}</p>
          <pre style={{ whiteSpace: "pre-wrap" }}>{doc.texto}</pre>
        </article>)}
    </section>
  </section>;
}
