import { InvestigacaoMinima } from './InvestigacaoMinima.js';
import { DutosClinica } from './DutosClinica.js';
import { useEffect, useRef, useState } from "react";
import type { AcaoIntent, ConsultaVisao, FlashPreparada, PedidoBundle, PortaConsulta } from "../api/porta.js";
import { ErroPorta } from "../api/porta.js";
import { ConsultaResposta, type ConsultaIntegrada } from "../api/respostas.js";
import { VisaoIntegradaMinima } from "./VisaoIntegradaMinima.js";
import { ConsultaFlash, type ConsultaFlashProps, type PlanoFlash } from "./ConsultaFlash.js";
import { montarPropsFlash } from "./flashDaVisao.js";
import { CartaoTransversal } from "./CartaoTransversal.js";
import { InstrumentosClinicos } from "../clinico/InstrumentosClinicos.js";

type DocumentoPreview = { documentId: string; documentVersion: number; draftId: string;
  titulo: string; texto: string; conteudoHash: string };
type Preview = { preparacao: FlashPreparada; documentos: DocumentoPreview[]; operacao: string };

/** Composição HTTP real. Nenhum cadastro, prescrição ou histórico de demonstração. */
export function ConsultaPersistida({ porta, contexto, aoAbrirApac, versaoClinica = 0 }: {
  porta: PortaConsulta; contexto: PedidoBundle; aoAbrirApac?:()=>void; versaoClinica?: number;
}) {
  const [consultaCarregada, setConsultaCarregada] = useState<{
    visao: ConsultaIntegrada | null; erro: string; porta: PortaConsulta;
    contexto: PedidoBundle; versao: number; versaoClinica: number;
  } | null>(null);
  const [flash, setFlash] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [versao, setVersao] = useState(0);
  const [impressaoPendente, setImpressaoPendente] = useState<AcaoIntent | null>(null);
  const geracao = useRef(0);
  const geracaoLeitura = useRef(0);
  const versaoAtual = useRef({ versao, versaoClinica });
  versaoAtual.current = { versao, versaoClinica };
  const emCurso = useRef(false);
  const tentativaPreparacao = useRef<{ plano: string; operacao: string } | null>(null);
  const { patientId, encounterId, tumorLotId } = contexto;
  // Invalida também no render: a visão anterior não parece atual antes de o efeito recarregar.
  const cargaAtual = consultaCarregada?.porta === porta && consultaCarregada.versao === versao
    && consultaCarregada.versaoClinica === versaoClinica && consultaCarregada.contexto.patientId === patientId
    && consultaCarregada.contexto.encounterId === encounterId && consultaCarregada.contexto.tumorLotId === tumorLotId
    ? consultaCarregada : null;
  const visao = cargaAtual?.erro ? null : cargaAtual?.visao ?? null;
  const visaoParaEdicao = consultaCarregada?.porta === porta && consultaCarregada.contexto.patientId === patientId
    && consultaCarregada.contexto.encounterId === encounterId && consultaCarregada.contexto.tumorLotId === tumorLotId
    ? consultaCarregada.visao : null;

  useEffect(() => {
    geracao.current++;
    emCurso.current = false; setOcupado(false); setFlash(false); setImpressaoPendente(null);
    tentativaPreparacao.current = null;
    return () => { geracao.current++; };
  }, [porta, patientId, encounterId, tumorLotId]);

  useEffect(() => {
    const atual = ++geracaoLeitura.current;
    setMensagem(""); setPreview(null);
    const carga = { porta, contexto: { patientId, encounterId, tumorLotId }, versao, versaoClinica };
    const falhar = (erro: string) => setConsultaCarregada((anterior) => ({ ...carga, erro,
      visao: anterior?.porta === porta && anterior.contexto.patientId === patientId
        && anterior.contexto.encounterId === encounterId && anterior.contexto.tumorLotId === tumorLotId ? anterior.visao : null }));
    void porta.carregarConsulta(patientId, tumorLotId, encounterId).then((bruto) => {
      if (atual !== geracaoLeitura.current) return;
      const r = ConsultaResposta.safeParse(bruto);
      if (!r.success || r.data.patientId !== patientId || r.data.encounterId !== encounterId
        || r.data.tumorLotId !== tumorLotId) {
        falhar("Consulta completa PENDENTE: contexto ou dados ainda indisponíveis."); return;
      }
      setConsultaCarregada({ ...carga, visao: r.data, erro: "" });
    }, () => { if (atual === geracaoLeitura.current) falhar("Não foi possível carregar a consulta persistida."); });
    return () => { geracaoLeitura.current++; };
  }, [porta, patientId, encounterId, tumorLotId, versao, versaoClinica]);

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
      setConsultaCarregada((carregada) => carregada?.visao?.flash ? { ...carregada,
        visao: { ...carregada.visao, flash: { ...carregada.visao.flash,
          rascunho: { draftId: resultado.draftId, revision: resultado.revision, plano } } } } : carregada);
    });
  }

  function preparar(plano: PlanoFlash) {
    if (!porta.prepararFinalizacaoFlash) return;
    void executar(async (atual) => {
      const chavePlano = JSON.stringify([patientId, encounterId, tumorLotId, versaoClinica, plano]);
      // Uma resposta perdida não cria outro conjunto de documentos ao repetir o mesmo plano.
      if (tentativaPreparacao.current?.plano !== chavePlano)
        tentativaPreparacao.current = { plano: chavePlano, operacao: crypto.randomUUID() };
      const { operacao } = tentativaPreparacao.current;
      const preparacao = await porta.prepararFinalizacaoFlash!({ patientId, encounterId, tumorLotId,
        plano, idempotencyKey: operacao });
      if (atual !== geracao.current || versaoAtual.current.versao !== versao
        || versaoAtual.current.versaoClinica !== versaoClinica) return;
      if (!preparacao.registros.length || !preparacao.documentos.length) throw new Error("DOCUMENTOS_AUSENTES");
      const bundle = await porta.exibirBundle({ patientId, encounterId, tumorLotId,
        draftIds: preparacao.registros.map((r) => r.id) });
      if (atual !== geracao.current || versaoAtual.current.versao !== versao
        || versaoAtual.current.versaoClinica !== versaoClinica) return;
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
      setPreview(null);
      const alvo = exibido.preparacao.alvoImpressao;
      if (!alvo) {
        setMensagem("Consulta finalizada. Documentos assinados e preservados no histórico.");
        setVersao((v) => v + 1);
        return;
      }
      const intent: AcaoIntent = {
        verbo: "IMPRIMIR",
        objeto: { tipo: alvo.tipo, id: alvo.id, versao: alvo.versao },
        escopo: { patientId, encounterId },
        destino: null,
        idempotencyKey: `${exibido.operacao}:imprimir`,
      };
      setImpressaoPendente(null);
      try {
        const impresso = await porta.acao(intent);
        if (atual !== geracao.current) return;
        if (impresso.decisao === "EXECUTADA" || impresso.decisao === "REPLAY") {
          setImpressaoPendente(null);
          setMensagem("Documentos assinados. Arquivo HTML imprimível gerado no servidor local. Isso não comprova impressão física.");
        } else {
          setImpressaoPendente(intent);
          setMensagem("Documentos assinados. A impressão continua pendente; a assinatura não será repetida.");
        }
      } catch {
        if (atual !== geracao.current) return;
        setImpressaoPendente(intent);
        setMensagem("Documentos assinados. A impressão continua pendente; a assinatura não será repetida.");
      }
      setVersao((v) => v + 1);
    });
  }

  function repetirImpressao() {
    const intent = impressaoPendente;
    if (!intent) return;
    void executar(async (atual) => {
      const impresso = await porta.acao(intent);
      if (atual !== geracao.current) return;
      if (impresso.decisao !== "EXECUTADA" && impresso.decisao !== "REPLAY") {
        setMensagem("Documentos já assinados. A impressão continua pendente; a assinatura não será repetida.");
        return;
      }
      setImpressaoPendente(null);
      setMensagem("Arquivo HTML imprimível gerado no servidor local. Isso não comprova impressão física.");
    });
  }

  function reimprimir(doc: NonNullable<ConsultaIntegrada["historicoDocumentos"]>[number]) {
    const intent: AcaoIntent = {verbo:"IMPRIMIR",objeto:{tipo:"DOCUMENTO",id:doc.documentId,versao:doc.documentVersion},
      escopo:{patientId,encounterId:doc.encounterId},destino:null,idempotencyKey:crypto.randomUUID()};
    setImpressaoPendente(intent);
    void executar(async(atual)=>{
      const resposta=await porta.acao(intent);
      if(atual!==geracao.current)return;
      if(resposta.decisao!=="EXECUTADA"&&resposta.decisao!=="REPLAY") {
        setImpressaoPendente(intent);setMensagem("Documento já assinado. Reimpressão pendente; o conteúdo será preservado.");return;
      }
      setImpressaoPendente(null);setMensagem("Reimpressão solicitada para a versão assinada original. Isso não comprova impressão física.");
    });
  }

  const visaoPronta = visao && visao.patientId === patientId && visao.encounterId === encounterId
    && visao.tumorLotId === tumorLotId ? visao : null;
  const propsFlash: ConsultaFlashProps | null = visaoParaEdicao ? {
    ...montarPropsFlash(visaoParaEdicao, null, preparar, salvar),
    ...(aoAbrirApac ? {aoAbrirApac} : {}),
    ocupado: ocupado || !visaoPronta, rotuloFinalizar: "Revisar documentos para assinatura", aoSalvarRascunho: salvar, aoFinalizar: preparar,
  } : null;
  return <section aria-label="Consulta persistida">
    {!visaoPronta ? <p aria-live="polite">{cargaAtual?.erro || "Carregando consulta persistida…"}</p> : <>
    <h2>{visaoPronta.cabecalho.paciente.nome} · consulta local</h2>
    <p>{visaoPronta.hoje} · Dados pendentes: {visaoPronta.cabecalho.pendentes}</p>
    {visaoPronta.alertas.filter((a) => a.presentationOverride).map((a) =>
      <aside role="alert" data-banner="e1" key={a.alertaId}><strong>Emergência E1</strong><p>{a.texto}</p></aside>)}
    {mensagem ? <p aria-live="polite">{mensagem}</p> : null}
    <InvestigacaoMinima porta={porta} contexto={contexto} {...(visaoPronta.retrato?{revisaoEsperada:visaoPronta.retrato.revisao}:{})} />
    <DutosClinica {...(visaoPronta.dutos?{dados:visaoPronta.dutos}:{})} />
    <VisaoIntegradaMinima {...(visaoPronta.retrato ? {retrato:visaoPronta.retrato}: {})}
      {...(visaoPronta.visaoIntegrada ? {visao:visaoPronta.visaoIntegrada}: {})} />
    <h3>Evolução revisada</h3>
    <pre style={{ whiteSpace: "pre-wrap" }}>{visaoPronta.resumoEvolucao ?? "Evolução PENDENTE de revisão."}</pre>
    {visaoPronta.retratoTransversal ? <CartaoTransversal entrada={visaoPronta.retratoTransversal} />
      : <p>Cartão transversal PENDENTE de fonte estruturada.</p>}
    <button type="button" disabled={ocupado} onClick={() => { setPreview(null); setFlash(true); }}>Consulta Flash</button>
    <button type="button" disabled={ocupado} onClick={() => setVersao((v) => v + 1)}>Reabrir histórico</button>
    <InstrumentosClinicos key={`${patientId}:${encounterId}:${tumorLotId ?? ""}`} ocupado={ocupado}
      aoAvaliar={async (pedido) => {
        if (!porta.avaliarInstrumento) throw new Error("Cálculo autenticado indisponível nesta tela.");
        return porta.avaliarInstrumento({ patientId, encounterId, tumorLotId }, pedido);
      }} />
    </>}
    {flash && propsFlash ? <div hidden={!visaoPronta}>
      <ConsultaFlash key={`${patientId}:${encounterId}:${tumorLotId ?? ""}`} {...propsFlash} />
    </div> : null}
    {visaoPronta ? <>
    {preview ? <section aria-label="Conteúdo para assinatura">
      <h3>Confira os documentos desta consulta</h3>
      {preview.documentos.map((doc) => <article key={doc.documentId}>
        <h4>{doc.titulo} · versão {doc.documentVersion}</h4>
        <pre style={{ whiteSpace: "pre-wrap" }}>{doc.texto}</pre>
      </article>)}
      <button type="button" disabled={ocupado} onClick={assinar}>Confirmar e assinar conteúdo exibido</button>
    </section> : null}
    {impressaoPendente ? <p>
      <button type="button" disabled={ocupado} onClick={repetirImpressao}>Solicitar impressão novamente</button>
    </p> : null}
    <section aria-label="Histórico de documentos assinados"><h3>Histórico de documentos assinados</h3>
      {(visaoPronta.historicoDocumentos ?? []).length === 0 ? <p>Nenhum documento assinado neste histórico.</p>
        : visaoPronta.historicoDocumentos!.map((doc) => <article key={doc.eventId}>
          <h4>{doc.titulo} · versão {doc.documentVersion}</h4><p>{doc.assinadoEm} · {doc.autorId} · consulta {doc.encounterId} · tumor {doc.tumorLotId ?? "não selecionado"}</p>
          <pre style={{ whiteSpace: "pre-wrap" }}>{doc.texto}</pre>
          <button type="button" disabled={ocupado} onClick={()=>reimprimir(doc)}>Reimprimir versão {doc.documentVersion} · {doc.titulo}</button>
        </article>)}
    </section>
    </> : null}
  </section>;
}
