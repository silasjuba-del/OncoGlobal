import { useCienciaAlertas } from "./useCienciaAlertas.js";
import { PropostaDoseReceita } from '../../contracts/api/propostaDoseReceita.js';
import { FontesDoseReceita } from './FontesDoseReceita.js';
import { documentoReceitaDosePendente } from '../../contracts/f1/receitaDose.js';
import { InvestigacaoMinima } from './InvestigacaoMinima.js';
import type { MinutaInvestigacao } from './InvestigacaoMinima.js';
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
import { CockpitJEV, type ComandoJEV } from "./CockpitJEV.js";
import { AcoesCompostas } from "./AcoesCompostas.js";
import type { BaseAcaoComposta, PedidoAcaoComposta, TipoAcaoComposta } from "../../contracts/api/acoesCompostas.js";
import type { AcaoCompostaPreparada } from "../../contracts/api/execucaoAcaoComposta.js";
import type { VisaoTimelineMulticamadas } from "../../contracts/api/timelineMulticamadas.js";
import { TimelineMulticamadas } from "./TimelineMulticamadas.js";
import { EditorPrescricaoExecutavel } from "./EditorPrescricaoExecutavel.js";
import { FichasPrescricaoConsulta, mensagemErroFicha } from "./FichasPrescricaoConsulta.js";
import { PrepararApacConsulta } from "./PrepararApacConsulta.js";
import type { InstanciacaoFichaResposta } from "../../contracts/api/fichasPrescricao.js";
import type { BasePrescricaoExecutavelResposta, EdicaoPrescricaoExecutavel,
  PrescricaoExecutavelPreparada } from "../../contracts/api/operacaoPrescricaoExecutavel.js";

type DocumentoPreview = { documentId: string; documentVersion: number; draftId: string;
  titulo: string; texto: string; conteudoHash: string; propostasDoseReceita:PropostaDoseReceita[] };
type Preview = { preparacao: FlashPreparada; documentos: DocumentoPreview[]; operacao: string };

/** Composição HTTP real. Nenhum cadastro, prescrição ou histórico de demonstração. */
export function ConsultaPersistida({ porta, contexto, aoAbrirApac, versaoClinica = 0,
  aoAlterarPrescricaoPendente, aoAlterarPrescricaoSalvando, aoAlterarApacPendente,
  aoAlterarApacSalvando, aoAtualizarClinico }: {
  porta: PortaConsulta; contexto: PedidoBundle; aoAbrirApac?:()=>void; versaoClinica?: number;
  aoAlterarPrescricaoPendente?: (pendente: boolean) => void;
  aoAlterarPrescricaoSalvando?: (salvando: boolean) => void;
  aoAlterarApacPendente?: (pendente: boolean) => void;
  aoAlterarApacSalvando?: (salvando: boolean) => void;
  aoAtualizarClinico?: () => void;
}) {
  const [cientes, setCientes] = useCienciaAlertas(JSON.stringify([contexto.patientId,contexto.encounterId,contexto.tumorLotId]));
  const aoAlterarApacPendenteAtual = useRef(aoAlterarApacPendente);
  aoAlterarApacPendenteAtual.current = aoAlterarApacPendente;
  const aoAlterarApacSalvandoAtual = useRef(aoAlterarApacSalvando);
  aoAlterarApacSalvandoAtual.current = aoAlterarApacSalvando;
  const [consultaCarregada, setConsultaCarregada] = useState<{
    visao: ConsultaIntegrada | null; erro: string; porta: PortaConsulta;
    contexto: PedidoBundle; versao: number; versaoClinica: number;
  } | null>(null);
  const [flash, setFlash] = useState(false);
  const [pedidoInvestigacao,setPedidoInvestigacao]=useState<MinutaInvestigacao|null>(null);
  const [pedidoRevisao,setPedidoRevisao]=useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [versao, setVersao] = useState(0);
  const [tipoAcao, setTipoAcao] = useState<TipoAcaoComposta | null>(null);
  const [instanciaAcao, setInstanciaAcao] = useState(0);
  const geracaoAcao = useRef(0);
  const [baseAcao, setBaseAcao] = useState<{ origem: ConsultaIntegrada; base: BaseAcaoComposta | null } | null>(null);
  const [acaoPreparada, setAcaoPreparada] = useState<AcaoCompostaPreparada | null>(null);
  const [acaoRevisada, setAcaoRevisada] = useState<AcaoCompostaPreparada | null>(null);
  const [linhaTempo, setLinhaTempo] = useState<{ origem: ConsultaIntegrada; dados: VisaoTimelineMulticamadas | null } | null>(null);
  const tentativaAcao = useRef<{ conteudo: string; chave: string } | null>(null);
  const [editorRx, setEditorRx] = useState(false);
  const [apacRascunhoAberto, setApacRascunhoAberto] = useState(false);
  const [origemFichaRx, setOrigemFichaRx] = useState<InstanciacaoFichaResposta | null>(null);
  const [origemAcaoRx, setOrigemAcaoRx] = useState<AcaoCompostaPreparada | null>(null);
  const [baseRx, setBaseRx] = useState<{ origem: ConsultaIntegrada; dados: BasePrescricaoExecutavelResposta } | null>(null);
  const [erroRx, setErroRx] = useState("");
  const [rxEmCurso, setRxEmCurso] = useState(false);
  const tentativaRx = useRef<{ conteudo: string; chave: string } | null>(null);
  const assinaturaRx = useRef<{ conteudo: string; chave: string } | null>(null);
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
  const visaoAtual = useRef(visao);
  visaoAtual.current = visao;
  const visaoParaEdicao = consultaCarregada?.porta === porta && consultaCarregada.contexto.patientId === patientId
    && consultaCarregada.contexto.encounterId === encounterId && consultaCarregada.contexto.tumorLotId === tumorLotId
    ? consultaCarregada.visao : null;

  useEffect(() => {
    geracao.current++;
    geracaoAcao.current++;
    emCurso.current = false; setOcupado(false); setFlash(false); setPedidoInvestigacao(null); setImpressaoPendente(null);
    tentativaPreparacao.current = null;
    tentativaAcao.current = null; setTipoAcao(null); setBaseAcao(null); setAcaoPreparada(null); setAcaoRevisada(null);
    setLinhaTempo(null);
    setMensagem("");
    setRxEmCurso(false); aoAlterarPrescricaoSalvando?.(false); aoAlterarPrescricaoPendente?.(false);
    aoAlterarApacSalvandoAtual.current?.(false); aoAlterarApacPendenteAtual.current?.(false);
    setEditorRx(false); setApacRascunhoAberto(false); setOrigemFichaRx(null); setOrigemAcaoRx(null); setBaseRx(null); setErroRx(""); tentativaRx.current = null; assinaturaRx.current = null;
    return () => {
      geracao.current++;
      aoAlterarPrescricaoSalvando?.(false); aoAlterarPrescricaoPendente?.(false);
      aoAlterarApacSalvandoAtual.current?.(false); aoAlterarApacPendenteAtual.current?.(false);
    };
  }, [porta, patientId, encounterId, tumorLotId]);

  useEffect(() => {
    const atual = ++geracaoLeitura.current;
    setPreview(null);
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

  useEffect(() => {
    geracaoAcao.current++;
    setBaseAcao(null); setAcaoPreparada(null); setAcaoRevisada(null);
    if (!visao || !porta.carregarBaseAcaoComposta) return;
    const origem = visao, abort = new AbortController();
    let ativo = true;
    void porta.carregarBaseAcaoComposta({ patientId, encounterId, tumorLotId }, abort.signal).then(r => {
      if (ativo) setBaseAcao({ origem, base: r.base });
    }, () => { if (ativo) setBaseAcao({ origem, base: null }); });
    return () => { ativo = false; abort.abort(); };
  }, [visao, porta, patientId, encounterId, tumorLotId]);
  const baseAcaoAtual = baseAcao?.origem === visao ? baseAcao.base : null;

  useEffect(() => {
    if (!editorRx || !visao || !porta.lerBasePrescricaoExecutavel) return;
    const origem = visao, abort = new AbortController();
    let ativo = true;
    setErroRx("");
    void porta.lerBasePrescricaoExecutavel({ patientId, encounterId, tumorLotId }, abort.signal).then(dados => {
      if (ativo) setBaseRx({ origem, dados });
    }, () => { if (ativo) setErroRx("Não foi possível atualizar a base da prescrição. Reabra o histórico para tentar novamente."); });
    return () => { ativo = false; abort.abort(); };
  }, [editorRx, visao, porta, patientId, encounterId, tumorLotId]);

  async function prepararRx(edicao: EdicaoPrescricaoExecutavel) {
    if (!baseRx || baseRx.origem !== visao || !porta.prepararPrescricaoExecutavel)
      throw new Error("Aguarde a atualização da base da prescrição.");
    const atual = geracao.current, origem = visao;
    const conteudo = JSON.stringify([patientId, encounterId, tumorLotId, baseRx.dados.revisao, edicao]);
    if (tentativaRx.current?.conteudo !== conteudo) tentativaRx.current = { conteudo, chave: crypto.randomUUID() };
    setRxEmCurso(true); aoAlterarPrescricaoSalvando?.(true);
    try {
      const r = await porta.prepararPrescricaoExecutavel({ contexto: { patientId, encounterId, tumorLotId },
        expectedBaseHash: baseRx.dados.revisao, idempotencyKey: tentativaRx.current.chave, edicao });
      if (atual !== geracao.current || origem !== visaoAtual.current) throw new Error("O contexto mudou. Prepare novamente.");
      return r;
    } catch (error) {
      throw new Error(mensagemErroFicha(error));
    } finally {
      if (atual === geracao.current) { setRxEmCurso(false); aoAlterarPrescricaoSalvando?.(false); }
    }
  }

  async function assinarRx(preparacao: PrescricaoExecutavelPreparada) {
    if (!baseRx || baseRx.origem !== visao || preparacao.baseHash !== baseRx.dados.revisao
      || !porta.confirmarPrescricaoExecutavel) throw new Error("A base mudou. Prepare novamente.");
    const atual = geracao.current;
    const conteudo = JSON.stringify([preparacao.draftId, preparacao.revision, preparacao.conteudoHash]);
    if (assinaturaRx.current?.conteudo !== conteudo) assinaturaRx.current = { conteudo, chave: crypto.randomUUID() };
    setRxEmCurso(true); aoAlterarPrescricaoSalvando?.(true);
    try {
      const confirmada = await porta.confirmarPrescricaoExecutavel({ contexto: { patientId, encounterId, tumorLotId },
        draftId: preparacao.draftId, expectedRevision: preparacao.revision,
        conteudoHash: preparacao.conteudoHash, idempotencyKey: assinaturaRx.current.chave });
      if (atual !== geracao.current) return;
      if (confirmada.documentId !== preparacao.conteudo.documentId
        || confirmada.documentVersion !== preparacao.conteudo.documentVersion
        || confirmada.cicloId !== preparacao.conteudo.contexto.cicloId
        || confirmada.episodioId !== preparacao.conteudo.contexto.episodioId)
        throw new Error("A confirmação não corresponde à prévia exibida. Confira o registro antes de concluir.");
      aoAlterarPrescricaoPendente?.(false);
      setOrigemAcaoRx(null); setOrigemFichaRx(null);
      if (aoAtualizarClinico) aoAtualizarClinico(); else setVersao(v => v + 1);
      setMensagem("Prescrição assinada e ciclo planejado gravados. Nenhuma administração registrada.");
    } catch (error) {
      throw new Error(mensagemErroFicha(error));
    } finally {
      if (atual === geracao.current) { setRxEmCurso(false); aoAlterarPrescricaoSalvando?.(false); }
    }
  }

  useEffect(() => {
    setLinhaTempo(null);
    if (!visao || !porta.carregarTimelineMulticamadas) return;
    const origem = visao, abort = new AbortController();
    let ativo = true;
    void porta.carregarTimelineMulticamadas({ patientId, encounterId, tumorLotId }, abort.signal).then(dados => {
      if (ativo) setLinhaTempo({ origem, dados });
    }, () => { if (ativo) setLinhaTempo({ origem, dados: null }); });
    return () => { ativo = false; abort.abort(); };
  }, [visao, porta, patientId, encounterId, tumorLotId]);

  function comandoJev(comando: ComandoJEV) {
    if (ocupado) return;
    geracaoAcao.current++;
    if (comando === "ABRIR_APAC") { aoAbrirApac?.(); return; }
    if (comando === "VER_HISTORICO") {
      setVersao(v => v + 1);
      document.getElementById("consulta-historico")?.scrollIntoView?.({ block: "start" });
      return;
    }
    if (comando === "REVISAR_DOCUMENTOS") { setPreview(null); setPedidoInvestigacao(null); setFlash(true); return; }
    setInstanciaAcao(v => v + 1);
    setTipoAcao(comando); setAcaoPreparada(null); setAcaoRevisada(null);
  }

  async function prepararComposta(pedido: PedidoAcaoComposta) {
    if (!baseAcaoAtual || !porta.prepararAcaoComposta) throw new Error("Base do ciclo indisponível.");
    const tentativaAtual = ++geracaoAcao.current;
    const atual = geracao.current, origem = visao, baseHash = baseAcaoAtual.baseHash;
    const conteudo = JSON.stringify([patientId, encounterId, tumorLotId, baseHash, pedido]);
    if (tentativaAcao.current?.conteudo !== conteudo) tentativaAcao.current = { conteudo, chave: crypto.randomUUID() };
    const resposta = await porta.prepararAcaoComposta({ contexto: { patientId, encounterId, tumorLotId },
      expectedBaseHash: baseHash, pedido, idempotencyKey: tentativaAcao.current.chave });
    if (tentativaAtual !== geracaoAcao.current || atual !== geracao.current || origem !== visaoAtual.current
      || versaoAtual.current.versao !== versao || versaoAtual.current.versaoClinica !== versaoClinica)
      throw new Error("O contexto mudou. Reabra a proposta.");
    setAcaoPreparada(resposta); setAcaoRevisada(null);
    return resposta.resultado;
  }

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
          titulo: esperado.titulo, texto: corpo.texto, propostasDoseReceita:PropostaDoseReceita.array().parse(corpo.propostasDoseReceita??[]), conteudoHash: doc.conteudoHash };
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
        reconhecerAlertas: cientes.filter(id => visao?.alertas.some(a=>a.alertaId===id)), idempotencyKey: `${exibido.operacao}:assinar` });
      if (atual !== geracao.current) return;
      if (resposta.codigo !== "GRAVADA" && resposta.codigo !== "REPLAY") throw new ErroPorta(resposta.codigo);
      setPreview(null);
      const alvo = exibido.preparacao.alvoImpressao;
      if (!alvo) {
        setMensagem("Documentos selecionados assinados e preservados no histórico. Os demais rascunhos continuam pendentes.");
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

  function baixarImpressao(doc: NonNullable<ConsultaIntegrada["historicoDocumentos"]>[number]) {
    if(!porta.documentoImpressao)return;
    void executar(async atual=>{
      const r=await porta.documentoImpressao!({patientId,encounterId:doc.encounterId,tumorLotId:doc.tumorLotId,documentId:doc.documentId,documentVersion:doc.documentVersion});
      if(atual!==geracao.current)return;
      const url=URL.createObjectURL(new Blob([r.html],{type:'text/html;charset=utf-8'}));
      const a=document.createElement('a');a.href=url;a.download='documento-assinado.html';a.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      setMensagem('Documento assinado entregue ao navegador. Abra o arquivo e use Imprimir.');
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
    ...(porta.proporDoseReceita?{aoProporDose:(medicamento:string)=>porta.proporDoseReceita!({patientId,encounterId,tumorLotId},medicamento)}:{}),
    ocupado: ocupado || !visaoPronta, rotuloFinalizar: "Revisar documentos para assinatura", aoSalvarRascunho: salvar, aoFinalizar: preparar,
  } : null;
  if(propsFlash&&pedidoInvestigacao&&visaoPronta?.retrato?.revisao!==pedidoRevisao){
    propsFlash.ocupado=true;propsFlash.iaFala=[...propsFlash.iaFala,"Investigação alterada. Reabra a proposta antes de preparar documentos."];
  }
  if(propsFlash&&pedidoInvestigacao&&visaoPronta?.retrato?.revisao===pedidoRevisao&&['LABORATORIO','IMAGEM'].includes(pedidoInvestigacao.categoria??'')){
    const antigo=propsFlash.planoInicial;
    const categoria=pedidoInvestigacao.categoria==='IMAGEM'?'imagem':'laboratorio';
    const solicitacoes={laboratorio:[...(antigo?.solicitacoes?.laboratorio??[])],imagem:[...(antigo?.solicitacoes?.imagem??[])]};
    const codigo=pedidoInvestigacao.exameCodigo;
    if(!solicitacoes[categoria].includes(codigo))solicitacoes[categoria].push(codigo);
    const referencias=[...(antigo?.propostasInvestigacao??[]).filter(p=>p.exameCodigo!==codigo),
      ...pedidoInvestigacao.regras.map(referencia=>({exameCodigo:codigo,contexto:pedidoInvestigacao.contexto,revisaoFatos:pedidoRevisao,referencia}))];
    propsFlash.iaFala=[...propsFlash.iaFala,pedidoInvestigacao.justificativa];
    propsFlash.planoInicial=antigo?{...antigo,solicitacoes,propostasInvestigacao:referencias}:{acoesMarcadas:[],receitasMarcadas:[],apac:{...propsFlash.apac,emitir:false},retorno:propsFlash.retorno,solicitacoes,propostasInvestigacao:referencias};
  }
  return <section aria-label="Consulta persistida" className="consulta-persistida">
    {!visaoPronta ? <p aria-live="polite">{cargaAtual?.erro || "Carregando consulta persistida…"}</p> : <>
    {visaoPronta.alertas.filter((a) => a.presentationOverride).map((a) =>
      <aside role="alert" data-banner="e1" key={a.alertaId}><strong>Emergência E1</strong><p>{a.texto}</p></aside>)}
    {mensagem ? <p aria-live="polite">{mensagem}</p> : null}
    <CockpitJEV visao={visaoPronta} ocupado={ocupado || rxEmCurso} aoComando={comandoJev}
      mudancasExtra={<div id="consulta-resumo" className="consulta-secao" tabIndex={-1}>
    <VisaoIntegradaMinima {...(visaoPronta.retrato ? {retrato:visaoPronta.retrato}: {})}
      {...(visaoPronta.visaoIntegrada ? {visao:visaoPronta.visaoIntegrada}: {})} />
    <h3>Evolução revisada</h3>
    <pre style={{ whiteSpace: "pre-wrap" }}>{visaoPronta.resumoEvolucao ?? "Evolução PENDENTE de revisão."}</pre>
    {visaoPronta.retratoTransversal ? <CartaoTransversal entrada={visaoPronta.retratoTransversal} />
      : <p>Cartão transversal PENDENTE de fonte estruturada.</p>}
    </div>}
      conduta={<>
    <div id="consulta-conduta" className="consulta-secao consulta-acoes" tabIndex={-1}>
    <button type="button" disabled={ocupado} onClick={() => { setPreview(null); setPedidoInvestigacao(null); setFlash(true); }}>Consulta Flash</button>
    <button type="button" disabled={ocupado} onClick={() => setVersao((v) => v + 1)}>Reabrir histórico</button>
    {porta.lerBasePrescricaoExecutavel && porta.prepararPrescricaoExecutavel && porta.confirmarPrescricaoExecutavel
      ? <button type="button" disabled={ocupado || rxEmCurso} onClick={() => setEditorRx(true)}>Prescrição estruturada</button> : null}
    {porta.lerBaseApacRascunho && porta.prepararApacRascunho && porta.confirmarApacRascunho
      ? <button type="button" disabled={ocupado || rxEmCurso} onClick={() => setApacRascunhoAberto(true)}>Preparar APAC da prescrição</button> : null}
    </div>
    <div className="consulta-acoes" aria-label="Preparar conduta">
      {([["MANTER_CICLO", "Manter ciclo"], ["REDUZIR_DOSE", "Reduzir dose"],
        ["ADIAR_CICLO", "Adiar ciclo"], ["TROCAR_PROTOCOLO", "Trocar protocolo"]] as const)
        .map(([tipo, rotulo]) => <button key={tipo} type="button" disabled={ocupado} onClick={() => comandoJev(tipo)}>{rotulo}</button>)}
    </div>
    {tipoAcao ? <AcoesCompostas key={`${patientId}:${encounterId}:${tumorLotId ?? ""}:${tipoAcao}:${instanciaAcao}`}
      base={baseAcaoAtual} tipoInicial={tipoAcao} ocupado={ocupado} aoPreparar={prepararComposta}
      aoUsar={resultado => {
        if (resultado !== acaoPreparada?.resultado || resultado.baseHash !== baseAcaoAtual?.baseHash) return;
        const proposta = acaoPreparada;
        setAcaoRevisada(proposta);
        if (["MANTER_CICLO", "ADIAR_CICLO", "REDUZIR_DOSE"].includes(proposta.resultado.tipo ?? "")) {
          if (!porta.lerBasePrescricaoExecutavel || !porta.prepararPrescricaoExecutavel || !porta.confirmarPrescricaoExecutavel) {
            setMensagem(mensagemErroFicha("ORIGEM_ACAO_AUSENTE"));
            return;
          }
          setOrigemFichaRx(null);
          setOrigemAcaoRx(proposta);
          setEditorRx(true);
        }
      }} /> : null}
    <InvestigacaoMinima porta={porta} contexto={contexto} {...(visaoPronta.retrato?{revisaoEsperada:visaoPronta.retrato.revisao}:{})}
      aoPrepararPedido={(p,revisao)=>{setPedidoInvestigacao(p);setPedidoRevisao(revisao);setPreview(null);setFlash(true);}} />
    <DutosClinica {...(visaoPronta.dutos?{dados:visaoPronta.dutos}:{})} />
    </>}
      saida={<>
    {acaoRevisada && acaoRevisada.resultado.baseHash === baseAcaoAtual?.baseHash ? <article aria-label="Plano de ação revisado">
      <h3>{acaoRevisada.documentoPlano.titulo}</h3>
      <pre style={{ whiteSpace: "pre-wrap" }}>{acaoRevisada.documentoPlano.texto}</pre>
      <p role="status">Plano salvo para revisão da prescrição.</p>
    </article> : null}
    {visaoPronta.alertas.filter(a=>a.presentationOverride && !a.reconhecidoEm).map(a=><label key={`ciente-${a.alertaId}`}><input type="checkbox" checked={cientes.includes(a.alertaId)} onChange={e=>setCientes(prev=>e.target.checked?[...prev,a.alertaId]:prev.filter(id=>id!==a.alertaId))}/>Estou ciente: {a.texto}. A ciência será registrada ao confirmar os documentos.</label>)}
    {preview ? <section aria-label="Conteúdo para assinatura">
      <h3>Confira os documentos desta consulta</h3>
      {preview.documentos.map((doc) => <article key={doc.documentId}>
        <h4>{doc.titulo} · versão {doc.documentVersion}</h4>
        <pre style={{ whiteSpace: "pre-wrap" }}>{doc.texto}</pre>
        {'propostasDoseReceita' in doc?<FontesDoseReceita propostas={doc.propostasDoseReceita}/>:null}
      </article>)}
      {preview.documentos.some(d=>documentoReceitaDosePendente({tipoDocumento:'FLASH_CONJUNTO_IMPRESSAO',texto:d.texto}))?<p role="status">Receita com dose pendente: permanece em rascunho. Volte à edição para completar a dose.</p>:null}
      <p>Ao confirmar, o médico valida as doses, a posologia e o conteúdo exibidos.</p>
      <button type="button" disabled={ocupado||preview.documentos.some(d=>documentoReceitaDosePendente({tipoDocumento:'FLASH_CONJUNTO_IMPRESSAO',texto:d.texto}))} onClick={assinar}>Confirmar e assinar conteúdo exibido</button>
    </section> : <p>Prepare os documentos na Consulta Flash para conferir e assinar.</p>}
    {impressaoPendente ? <p>
      <button type="button" disabled={ocupado} onClick={repetirImpressao}>Solicitar impressão novamente</button>
    </p> : null}
    </>}
      evidenciasExtra={<InstrumentosClinicos key={`${patientId}:${encounterId}:${tumorLotId ?? ""}`} ocupado={ocupado}
        aoAvaliar={async (pedido) => {
          if (!porta.avaliarInstrumento) throw new Error("Cálculo autenticado indisponível nesta tela.");
          return porta.avaliarInstrumento({ patientId, encounterId, tumorLotId }, pedido);
        }} />}
    />
    {porta.carregarTimelineMulticamadas ? linhaTempo?.origem === visaoPronta
      ? linhaTempo.dados ? <TimelineMulticamadas dados={linhaTempo.dados} />
        : <p role="status">Não foi possível carregar a timeline deste contexto.</p>
      : <p role="status">Carregando timeline longitudinal…</p> : null}
    </>}
    {editorRx ? <section aria-label="Editor da prescrição desta consulta">
      {erroRx ? <p role="alert">{erroRx}</p> : null}
      {porta.listarFichasPrescricao && porta.revisarFichaPrescricao && porta.instanciarFichaPrescricao
        ? <FichasPrescricaoConsulta porta={porta} contexto={{ patientId, encounterId, tumorLotId }}
          ocupado={ocupado || rxEmCurso || !visao || !baseRx || baseRx.origem !== visao}
          aoInstanciar={origem => { setOrigemAcaoRx(null); setOrigemFichaRx(origem); }}
          aoAlterarSalvando={salvando => { setRxEmCurso(salvando); aoAlterarPrescricaoSalvando?.(salvando); }} /> : null}
      {baseRx?.dados.contexto.patientId === patientId && baseRx.dados.contexto.encounterId === encounterId
        && baseRx.dados.contexto.tumorLotId === tumorLotId ? <EditorPrescricaoExecutavel key={`${patientId}:${encounterId}:${tumorLotId ?? ""}`}
        base={baseRx.dados} origemFicha={origemFichaRx} origemAcao={origemAcaoRx} ocupado={ocupado || rxEmCurso || !visao || baseRx.origem !== visao || !!erroRx}
        aoPreparar={prepararRx} aoAssinar={assinarRx}
        aoDescartarAcao={() => setOrigemAcaoRx(null)}
        {...(aoAlterarPrescricaoPendente ? { aoAlterarPendente: aoAlterarPrescricaoPendente } : {})} />
        : <p role="status">Carregando a base da prescrição…</p>}
    </section> : null}
    {apacRascunhoAberto && porta.lerBaseApacRascunho && porta.prepararApacRascunho && porta.confirmarApacRascunho
      ? <PrepararApacConsulta porta={porta} contexto={{ patientId, encounterId, tumorLotId: tumorLotId ?? null }} aberto
        ocupado={ocupado || rxEmCurso}
        {...(aoAlterarApacPendente ? { aoAlterarPendente: aoAlterarApacPendente } : {})}
        {...(aoAlterarApacSalvando ? { aoAlterarSalvando: aoAlterarApacSalvando } : {})}
        aoAtualizarClinico={() => { if (aoAtualizarClinico) aoAtualizarClinico(); else setVersao(v => v + 1); }} /> : null}
    {flash && propsFlash ? <div hidden={!visaoPronta}>
      <ConsultaFlash key={`${patientId}:${encounterId}:${tumorLotId ?? ""}:${pedidoInvestigacao?.exameCodigo??"manual"}:${pedidoInvestigacao?.contexto??""}:${pedidoRevisao}`} {...propsFlash} />
    </div> : null}
    {visaoPronta ? <>
    <section id="consulta-historico" className="consulta-secao" tabIndex={-1} aria-label="Histórico de documentos assinados"><h3>Histórico de documentos assinados</h3>
      {(visaoPronta.historicoDocumentos ?? []).length === 0 ? <p>Nenhum documento assinado neste histórico.</p>
        : visaoPronta.historicoDocumentos!.map((doc) => <article key={doc.eventId}>
          <h4>{doc.titulo} · versão {doc.documentVersion}</h4><p>{doc.assinadoEm} · {doc.autorId} · consulta {doc.encounterId} · tumor {doc.tumorLotId ?? "não selecionado"}</p>
          <pre style={{ whiteSpace: "pre-wrap" }}>{doc.texto}</pre>
        {doc.liberacaoPendente?<p role="status">{doc.liberacaoPendente}</p>:null}
          {porta.documentoImpressao&&<button type="button" disabled={ocupado||!!doc.liberacaoPendente} onClick={()=>baixarImpressao(doc)}>Baixar documento imprimível · {doc.titulo}</button>}
          <button type="button" disabled={ocupado||!!doc.liberacaoPendente} onClick={()=>reimprimir(doc)}>Reimprimir versão {doc.documentVersion} · {doc.titulo}</button>
        </article>)}
    </section>
    </> : null}
  </section>;
}
