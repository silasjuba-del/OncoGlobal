import { useEffect, useMemo, useRef, useState } from "react";
import { BannerE1 } from "../consulta/BannerE1.js";
import { BarraFechamento } from "../consulta/BarraFechamento.js";
import { CartaoTransversal } from "../consulta/CartaoTransversal.js";
import { montarPropsFlash } from "../consulta/flashDaVisao.js";
import { OverlayFlash } from "../consulta/OverlayFlash.js";
import { PainelDelta } from "../consulta/PainelDelta.js";
import {
  confirmacaoPreparouImpressao,
  validarComExibicao,
} from "../consulta/validarComExibicao.js";
import { PainelOncoassist } from "../consulta/PainelOncoassist.js";
import { CardEvidencia } from "../evidencia/CardEvidencia.js";
import type { ChavesIntencao } from "../api/chaves.js";
import { ID } from "../api/fake.js";
import { ErroPorta, type AcaoIntent, type ConsultaVisao, type PortaConsulta } from "../api/porta.js";
import type { PlanoFlash } from "../consulta/ConsultaFlash.js";
import { conferirPreviewFlash, type DocumentoPreviewFlash } from "../consulta/previewFlash.js";
import type { FlashPreparada } from "../api/porta.js";
import { COPY_PT_BR } from "../copy/pt-BR.js";
import { AbasChart, type AbaChart } from "../oncochart/AbasChart.js";
import { CaixaRevisao } from "../oncochart/CaixaRevisao.js";
import {
  montarRevisaoSintetica,
  type RevisaoCaixaUnica,
} from "../oncochart/caixa-revisao-visao.js";
import { CardsVisaoGeral } from "../oncochart/CardsVisaoGeral.js";
import { montarCabecalhoChart, type CabecalhoChart } from "../oncochart/chart-visao.js";
import { Dock, type AcaoDock } from "../oncochart/Dock.js";
import { ImageViewerOncoAssist } from "../oncochart/ImageViewerOncoAssist.js";
import { Jornada3D } from "../oncochart/Jornada3D.js";
import { OverlayAtivo, type OverlayId } from "../oncochart/Overlays.js";
import { PatientHeader } from "../oncochart/PatientHeader.js";
import { PrescricaoPainel } from "../oncochart/PrescricaoPainel.js";
import { prescricaoSintetica } from "../oncochart/prescricao-visao.js";
import { Timeline2D } from "../oncochart/Timeline2D.js";
import { timelineDaConsulta } from "../oncochart/timelineDaConsulta.js";
import { InstrumentosClinicos } from "../clinico/InstrumentosClinicos.js";

// @ts-expect-error folha CSS pura, resolvida pelo Vite
import "./consulta.css";

const CANDIDATOS = [
  { patientId: ID.verde, nome: "Paciente Teste", prontuario: "PR-VERDE" },
  { patientId: ID.vermelho, nome: "Paciente Teste", prontuario: "PR-VERMELHO" },
  { patientId: ID.pendente, nome: "Paciente Teste 03", prontuario: "PR-PENDENTE" },
] as const;

/** Consulta já montada. Validar não imprime. Imprimir só depois de uma tecla de confirmação. */
export function TelaConsulta({
  patientId,
  porta,
  chaves,
  onChart,
}: {
  patientId: string;
  porta: PortaConsulta;
  chaves: ChavesIntencao;
  onChart?: (chart: CabecalhoChart | null) => void;
}) {
  const [visao, setVisao] = useState<ConsultaVisao | null>(null);
  const [loteId, setLoteId] = useState<string | null>(null);
  const [selecionandoLote, setSelecionandoLote] = useState(false);
  const pacienteAtual = useRef(patientId);
  pacienteAtual.current = patientId;
  const [sessaoExpirada, setSessaoExpirada] = useState(false);
  const [impressaoArmada, setImpressaoArmada] = useState(false);
  const [jornada3d, setJornada3d] = useState(false);
  const [aba, setAba] = useState<AbaChart>("geral");
  const [revisao, setRevisao] = useState<RevisaoCaixaUnica | null>(null);
  const [acaoRevisao, setAcaoRevisao] = useState<string | null>(null);
  const [fonteAberta, setFonteAberta] = useState<string | null>(null);
  const [viewer, setViewer] = useState(false);
  const [overlay, setOverlay] = useState<OverlayId>(null);
  const [mic, setMic] = useState(false);
  const [statusFechamento, setStatusFechamento] = useState<string | null>(null);
  const [validando, setValidando] = useState(false);
  const [flashOcupado, setFlashOcupado] = useState(false);
  const [flashErro, setFlashErro] = useState<string | null>(null);
  const [avisoFlash, setAvisoFlash] = useState<string | null>(null);
  const flashRevisao = useRef<number | null>(null);
  const contextoAtivo = useRef("");
  contextoAtivo.current = JSON.stringify([patientId, visao?.encounterId ?? null, loteId]);
  const [previewFlash, setPreviewFlash] = useState<{ preparada: FlashPreparada; documentos: DocumentoPreviewFlash[];
    chave: string; contexto: { patientId: string; encounterId: string; tumorLotId: string | null }; selo: string } | null>(null);
  const impressao = useRef<AcaoIntent | null>(null);
  const impressaoEnviada = useRef(false);
  const chaveValidar = chaves.novaChaveIntencao(`validar:${patientId}`);
  const chaveImprimir = chaves.novaChaveIntencao(`imprimir:${patientId}`);

  useEffect(() => {
    let viva = true;
    setSelecionandoLote(false);
    impressao.current = null;
    impressaoEnviada.current = false;
    setImpressaoArmada(false);
    porta.carregarConsulta(patientId).then(
      (proxima) => {
        if (!viva) return;
        setVisao(proxima);
        setLoteId(proxima.cabecalho.loteSelecionadoId);
      },
      (erro: unknown) => {
        if (!viva) return;
        if (erro instanceof ErroPorta && erro.codigo === "SESSAO_EXPIRADA") setSessaoExpirada(true);
      },
    );
    return () => {
      viva = false;
    };
  }, [patientId, porta]);

  useEffect(() => {
    flashRevisao.current = visao?.flash?.rascunho?.revision ?? null;
  }, [visao]);

  useEffect(() => { setPreviewFlash(null); setFlashOcupado(false); }, [patientId, loteId]);

  const chart = useMemo(() => {
    if (!visao) return null;
    const cabecalho = { ...visao.cabecalho, loteSelecionadoId: loteId };
    return montarCabecalhoChart(
      cabecalho,
      {convenio:null,matricula:null,cns:cabecalho.paciente.identificadores.find(i=>i.tipo==="CNS")?.valor ?? null,
        dataHoraAtendimento:null,nascimento:cabecalho.paciente.nascimento,profissao:null,mae:null,responsavel:null,cidadeUf:null,endereco:null,obs:null},
      { ecog: null, biomarcadores: [] },
    );
  }, [visao, loteId, patientId]);

  useEffect(() => {
    onChart?.(chart);
    return () => onChart?.(null);
  }, [chart, onChart]);

  function abrirRevisao(origemRotulo: string, texto: string) {
    setRevisao(
      montarRevisaoSintetica({
        origemRotulo,
        texto,
        patientIdAberto: patientId,
        candidatos: CANDIDATOS,
      }),
    );
    setAcaoRevisao(null);
    setFonteAberta(null);
  }

  function dispararImpressao() {
    const intent = impressao.current;
    if (!intent || impressaoEnviada.current) return;
    impressaoEnviada.current = true;
    setImpressaoArmada(false);
    void porta.acao(intent);
  }

  useEffect(() => {
    function noTeclado(evento: KeyboardEvent) {
      if (evento.key !== "Enter" || !impressao.current || impressaoEnviada.current) return;
      evento.preventDefault();
      dispararImpressao();
    }
    window.addEventListener("keydown", noTeclado);
    return () => window.removeEventListener("keydown", noTeclado);
  }, [porta]);

  if (!visao || visao.patientId !== patientId || !chart) {
    return (
      <main aria-label="Consulta pronta" className="tela-consulta">
        <p>{sessaoExpirada ? "sessão expirada — entre de novo" : "carregando consulta"}</p>
      </main>
    );
  }

  const cabecalho = { ...visao.cabecalho, loteSelecionadoId: loteId };

  const CF = COPY_PT_BR.flashFechamento;
  const contextoFlash = { patientId: visao.patientId, encounterId: visao.encounterId, tumorLotId: loteId };
  const textoErroFlash = (base: string, erro: unknown): string => {
    const detalhe = erro instanceof ErroPorta ? (erro.detalhe ?? erro.codigo) : "FALHA_INESPERADA";
    return `${base}: ${detalhe}. ${CF.marcacoesMantidas}`;
  };

  /** SALVAR RASCUNHO: só grava rascunho. Nunca assina. Erro mantém o overlay aberto e as marcações. */
  const salvarRascunhoFlash = (plano: PlanoFlash) => {
    if (flashOcupado) return;
    if (!porta.salvarRascunhoFlash) {
      setFlashErro(textoErroFlash(CF.erroRascunho, new ErroPorta("SERVIDOR_PENDENTE")));
      return;
    }
    setFlashOcupado(true);
    setFlashErro(null);
    const seloSalvar = contextoAtivo.current;
    void porta.salvarRascunhoFlash({ ...contextoFlash, plano, expectedRevision: flashRevisao.current }).then(
      (r) => {
        if (contextoAtivo.current !== seloSalvar) return;
        flashRevisao.current = r.revision;
        setVisao(v => v?.flash ? {...v,flash:{...v.flash,rascunho:{draftId:r.draftId,revision:r.revision,plano}}} : v);
        setFlashOcupado(false);
        setAvisoFlash(CF.rascunhoSalvo);
        setOverlay(null);
      },
      (erro: unknown) => {
        if (contextoAtivo.current !== seloSalvar) return;
        setFlashOcupado(false);
        if (erro instanceof ErroPorta && erro.codigo === "SESSAO_EXPIRADA") setSessaoExpirada(true);
        setFlashErro(textoErroFlash(CF.erroRascunho, erro));
        // Revisão defasada: recarrega a visão para pegar a revisão corrente; a tela e o overlay continuam como estão.
        if (erro instanceof ErroPorta && erro.detalhe === "REVISAO_RASCUNHO_CONFLITANTE") {
          void porta.carregarConsulta(patientId, loteId).then((proxima) => {
            if (pacienteAtual.current === patientId) flashRevisao.current = proxima.flash?.rascunho?.revision ?? null;
          }, () => undefined);
        }
      },
    );
  };

  /**
   * FINALIZAR: o médico confirma o plano exibido. O servidor gera os documentos em rascunho e o caminho de
   * sempre (exibir bundle + confirmar) assina SÓ o que foi exibido. Nenhum envio externo.
   */
  const finalizarFlash = (plano: PlanoFlash) => {
    if (flashOcupado) return;
    if (!porta.prepararFinalizacaoFlash) {
      setFlashErro(textoErroFlash(CF.erroFinalizar, new ErroPorta("SERVIDOR_PENDENTE")));
      return;
    }
    setFlashOcupado(true);
    setFlashErro(null);
    const chave = chaves.novaChaveIntencao(`flash-finalizar:${patientId}:${loteId ?? ""}:${JSON.stringify(plano)}`);
    const selo = contextoAtivo.current;
    void (async () => {
      const preparada = await porta.prepararFinalizacaoFlash!({ ...contextoFlash, plano, idempotencyKey: chave });
      if (contextoAtivo.current !== selo) return null;
      const bundle = await porta.exibirBundle({ ...contextoFlash, draftIds: preparada.registros.map((r) => r.id) });
      const documentos = conferirPreviewFlash(preparada, bundle, contextoFlash);
      return { preparada, documentos };
    })().then(
      (preview) => {
        if (contextoAtivo.current !== selo || preview === null) return;
        setFlashOcupado(false);
        setPreviewFlash({ ...preview, chave, contexto: contextoFlash, selo });
        setAvisoFlash("Revise os documentos preparados. Ainda não assinados.");
        setOverlay(null);
      },
      (erro: unknown) => {
        if (contextoAtivo.current !== selo) return;
        setFlashOcupado(false);
        if (erro instanceof ErroPorta && erro.codigo === "SESSAO_EXPIRADA") setSessaoExpirada(true);
        setFlashErro(textoErroFlash(CF.erroFinalizar, erro));
      },
    );
  };

  const confirmarFlashExibida = () => {
    const exibido = previewFlash;
    if (!exibido || flashOcupado || exibido.selo !== contextoAtivo.current) return;
    setFlashOcupado(true);
    void porta.confirmar({ ...exibido.contexto, bloco: "TUDO", registros: [...exibido.preparada.registros],
      documentosExibidos: exibido.documentos.map(({ documentId, documentVersion }) => ({ documentId, documentVersion })),
      reconhecerAlertas: [], idempotencyKey: `${exibido.chave}:confirmar` }).then((resultado) => {
        if (exibido.selo !== contextoAtivo.current) return;
        if (resultado.codigo !== "REPLAY" && !confirmacaoPreparouImpressao(resultado.codigo)) throw new ErroPorta("FLASH_RECUSADA", resultado.codigo);
        setFlashOcupado(false); setPreviewFlash(null); setAvisoFlash(CF.finalizada);
        if (exibido.preparada.alvoImpressao) {
          const alvo = exibido.preparada.alvoImpressao;
          impressao.current = {
            verbo: "IMPRIMIR",
            objeto: { tipo: alvo.tipo, id: alvo.id, versao: alvo.versao },
            escopo: { patientId: exibido.contexto.patientId, encounterId: exibido.contexto.encounterId },
            destino: null,
            idempotencyKey: `${exibido.chave}:imprimir`,
          };
          // O clique confirma o conjunto já exibido e solicita sua impressão pelo gateway existente.
          impressaoEnviada.current = true;
          setImpressaoArmada(false);
          void porta.acao(impressao.current).then(r => {
            if (r.decisao !== "EXECUTADA" && r.decisao !== "REPLAY") throw new Error("IMPRESSAO_PENDENTE");
          }).catch(() => {
            if (exibido.selo === contextoAtivo.current) setAvisoFlash("Documentos assinados; impressão pendente. Reabra pelo histórico.");
          });
        }
      }).catch((erro: unknown) => {
        if (exibido.selo !== contextoAtivo.current) return;
        setFlashOcupado(false);
        if (erro instanceof ErroPorta && erro.codigo === "SESSAO_EXPIRADA") setSessaoExpirada(true);
        setAvisoFlash(textoErroFlash(CF.erroFinalizar, erro));
      });
  };

  const temHidronefrose = /hidronefrose/i.test(revisao?.origemRotulo ?? "");

  function onDock(acao: AcaoDock) {
    if (acao === "mic") {
      setMic((v) => !v);
      return;
    }
    if (acao === "jornada") {
      setJornada3d(true);
      return;
    }
    if (acao === "whatsapp") {
      setOverlay("whatsapp");
      return;
    }
    if (acao === "pack") {
      setOverlay("pack");
      return;
    }
    if (acao === "trials") {
      setOverlay("trials");
      return;
    }
    if (acao === "ciclo") {
      setOverlay("liberacao");
      return;
    }
    if (acao === "exame") {
      setOverlay("interacoes");
      return;
    }
    if (acao === "novo") {
      setAba("evo");
      setOverlay("paleta");
    }
  }

  return (
    <main aria-label="Consulta pronta" className="tela-consulta pilha" style={{ position: "relative" }}>
      {sessaoExpirada ? <p>sessão expirada — entre de novo</p> : null}
      {acaoRevisao ? <p className="oc-flash-status" role="status">{acaoRevisao}</p> : null}
      {avisoFlash ? <p className="oc-flash-status" role="status" aria-label="status da Consulta Flash">{avisoFlash}</p> : null}
      {previewFlash ? <section aria-label="Revisão dos documentos Flash">
        {previewFlash.documentos.map((d) => <article key={d.documentId}><h3>{d.titulo}</h3>
          <pre style={{ whiteSpace: "pre-wrap" }}>{d.texto}</pre></article>)}
        <button type="button" disabled={flashOcupado} onClick={confirmarFlashExibida}>CONFIRMAR E IMPRIMIR</button>
        <button type="button" disabled={flashOcupado} onClick={() => setPreviewFlash(null)}>Continuar sem assinar</button>
      </section> : null}
      {fonteAberta ? <p className="oc-flash-status" role="status">fonte: {fonteAberta}</p> : null}
      <PatientHeader
        chart={chart}
        semaforo={cabecalho.semaforo}
        onFlash={() => {
          setFlashErro(null);
          setAvisoFlash(null);
          setOverlay("flash");
        }}
        onEditarTnm={() => setOverlay("dx")}
      />
      {visao.retratoTransversal !== undefined && visao.retratoTransversal !== null ? (
        <CartaoTransversal entrada={visao.retratoTransversal} />
      ) : null}
      <Timeline2D
        visao={timelineDaConsulta(visao)}
        onVer3d={() => setJornada3d(true)}
      />
      <PainelOncoassist key={`${patientId}:${visao.encounterId}:${loteId ?? ""}`} porta={porta}
        contexto={{ patientId, encounterId: visao.encounterId, tumorLotId: loteId }} />
      <button type="button" className="oc-btn-primary" style={{ alignSelf: "flex-start" }} onClick={() => setViewer(true)}>
        Abrir TC
      </button>
      <AbasChart
        valor={aba}
        onChange={setAba}
        cicloChip={chart.cicloNumero != null ? `C${chart.cicloNumero}` : null}
      >
        {(atual) => {
          if (atual === "geral") {
            return (
              <>
                <CardsVisaoGeral
                  protocolo={cabecalho.episodio?.esquemaId ?? null}
                  ciclo={chart.cicloNumero != null ? `C${chart.cicloNumero}` : null}
                  tnm={
                    chart.diagnostico.t
                      ? `${chart.diagnostico.tnmPrefixo ?? ""}${chart.diagnostico.t}${chart.diagnostico.n ?? ""}${chart.diagnostico.m ?? ""}`
                      : null
                  }
                  recist={null}
                  ecog={chart.diagnostico.ecog != null ? String(chart.diagnostico.ecog) : null}
                  ctcae={null}
                  onSoltarArquivo={(nome, texto) => abrirRevisao(nome, texto)}
                  onColarTexto={(texto) => abrirRevisao("colar", texto)}
                  onSalvarRascunho={() => undefined}
                />
                {revisao ? (
                  <CaixaRevisao
                    revisao={revisao}
                    onFechar={() => setRevisao(null)}
                    onAbrirFonte={(f) => setFonteAberta(`${f.origem} · ${f.trecho}`)}
                    onConfirmar={(id) => setAcaoRevisao(`confirmado: ${id}`)}
                    onCorrigir={(id) => setAcaoRevisao(`corrigir: ${id}`)}
                    onDescartar={(id) => {
                      setRevisao((r) =>
                        r ? { ...r, excecoes: r.excecoes.filter((e) => e.id !== id) } : null,
                      );
                      setAcaoRevisao(`descartado: ${id}`);
                    }}
                    onLigar={(excecaoId, pid) => {
                      setRevisao((r) => {
                        if (!r) return r;
                        return {
                          ...r,
                          excecoes: r.excecoes.map((e) =>
                            e.id === excecaoId ? { ...e, patientId: pid } : e,
                          ),
                        };
                      });
                      setAcaoRevisao(`ligado: ${excecaoId} → ${pid}`);
                    }}
                  />
                ) : null}
              </>
            );
          }
          if (atual === "qt") {
            return <PrescricaoPainel inicial={prescricaoSintetica()} />;
          }
          if (atual === "clin") {
            return <>
              <section aria-label="Instrumentos registrados"><h3>Instrumentos registrados</h3>
                {!visao.instrumentosClinicos?.length ? <p>Nenhum instrumento estruturado registrado nesta consulta.</p>
                  : visao.instrumentosClinicos.map(i=><article key={i.instrumento}><h4>{i.instrumento}</h4>
                    <p>{i.avaliacao.estado} · {i.avaliacao.escore ?? "PENDENTE"} · {i.avaliacao.classificacao ?? "sem classificação"}</p>
                    <p>{i.avaliacao.pendencias.join("; ")}</p><p>Fonte: {i.avaliacao.fonteRegra ?? "PENDENTE"}</p></article>)}
              </section>
              <InstrumentosClinicos key={`${patientId}:${visao.encounterId}:${loteId ?? ""}`} ocupado={flashOcupado || selecionandoLote}
                aoAvaliar={async (pedido) => {
                  if (!porta.avaliarInstrumento) throw new Error("Cálculo autenticado indisponível nesta tela.");
                  return porta.avaliarInstrumento({ patientId, encounterId: visao.encounterId, tumorLotId: loteId }, pedido);
                }} />
            </>;
          }
          return <p className="oc-aba-placeholder">Evolução — rascunho também na Visão geral</p>;
        }}
      </AbasChart>
      {cabecalho.lotes.length > 1 ? (
        <label>
          Tumor / lote
          <select
            aria-label="Tumor / lote"
            value={loteId ?? ""}
            disabled={selecionandoLote}
            onChange={(e) => {
              const escolhido = e.target.value;
              if (!escolhido) return;
              setSelecionandoLote(true);
              impressao.current = null;
              setImpressaoArmada(false);
              void porta.carregarConsulta(patientId, escolhido).then((proxima) => {
                if (pacienteAtual.current !== patientId) return;
                setVisao(proxima); setLoteId(proxima.cabecalho.loteSelecionadoId);
              }, () => {
                if (pacienteAtual.current === patientId) setAcaoRevisao("Não foi possível selecionar o lote. Reabra a consulta.");
              }).finally(() => { if (pacienteAtual.current === patientId) setSelecionandoLote(false); });
            }}
          >
            {cabecalho.lotes.map((l) => (
              <option key={l.tumorLotId} value={l.tumorLotId}>
                {l.topografia.campo === "PRESENTE" && l.topografia.valor
                  ? l.topografia.valor
                  : l.tumorLotId}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <BannerE1
        alertas={visao.alertas}
        agora={`${visao.hoje}T08:00:00-03:00`}
        onReconhecer={() => undefined}
      />
      <PainelDelta temSnapshotAnterior={visao.delta.temSnapshotAnterior} itens={visao.delta.itens} />
      <section aria-label="Evidências" className="pilha">
        {visao.evidencias.map((afirmacao) => (
          <CardEvidencia key={afirmacao.rotulo} afirmacao={afirmacao} />
        ))}
      </section>
      <div className="barra-fixa">
        <BarraFechamento
          patientId={visao.patientId}
          tumorLotId={loteId}
          encounterId={visao.encounterId}
          blocoAtual={visao.fechamento.blocoAtual}
          registros={visao.fechamento.registros}
          documentos={visao.fechamento.documentos}
          alertasVermelhosExibidos={visao.fechamento.alertasVermelhos}
          idempotencyKey={chaveValidar}
          autorExibido={visao.fechamento.autorExibido}
          alvoImpressao={visao.fechamento.alvoImpressao}
          chaveImpressao={chaveImprimir}
          ocupado={validando}
          onValidar={(payload) => {
            if (validando) return;
            setValidando(true);
            setStatusFechamento("exibindo e validando");
            void validarComExibicao(
              porta,
              {
                patientId: visao.patientId,
                encounterId: visao.encounterId,
                tumorLotId: loteId,
              },
              payload,
            ).then(
              (resultado) => {
                setValidando(false);
                setStatusFechamento(resultado.codigo);
                if (
                  confirmacaoPreparouImpressao(resultado.codigo)
                  && visao.fechamento.alvoImpressao
                ) {
                  const alvo = visao.fechamento.alvoImpressao;
                  impressao.current = {
                    verbo: "IMPRIMIR",
                    objeto: { tipo: alvo.tipo, id: alvo.id, versao: alvo.versao },
                    escopo: { patientId: visao.patientId, encounterId: visao.encounterId },
                    destino: null,
                    idempotencyKey: chaveImprimir,
                  };
                  impressaoEnviada.current = false;
                  setImpressaoArmada(true);
                }
              },
              (erro: unknown) => {
                setValidando(false);
                setStatusFechamento(
                  erro instanceof ErroPorta ? erro.codigo : "FALHA_VALIDACAO",
                );
              },
            );
          }}
          onImprimir={(intent) => {
            impressao.current = intent;
            impressaoEnviada.current = false;
            setImpressaoArmada(true);
          }}
        />
        {statusFechamento ? (
          <p role="status" aria-label="status do fechamento">{statusFechamento}</p>
        ) : null}
        {impressaoArmada ? (
          <p role="status">
            Enter confirma a impressão
            <button type="button" onClick={dispararImpressao}>confirmar impressão</button>
          </p>
        ) : null}
      </div>
      {viewer ? (
        <ImageViewerOncoAssist
          exameTitulo="TC abdome sintético"
          laudo={
            temHidronefrose
              ? "Hidronefrose à direita descrita no laudo sintético."
              : "Laudo sintético sem emergência RADS destacada."
          }
          achados={[
            {
              id: "ach-1",
              texto: "Achado já extraído (proposta)",
              trechoFonte: "trecho do laudo sintético",
            },
          ]}
          alertasRads={
            temHidronefrose
              ? [{ id: "rads-1", rotulo: "RADS hidronefrose", trecho: "hidronefrose à direita" }]
              : []
          }
          onFechar={() => setViewer(false)}
          onTrecho={(t) => setFonteAberta(t)}
        />
      ) : null}
      {jornada3d ? (
        <Jornada3D
          visao={timelineDaConsulta(visao)}
          onFechar={() => setJornada3d(false)}
          onAbrirTc={() => {
            setJornada3d(false);
            setViewer(true);
          }}
        />
      ) : null}
      <Dock gravando={mic} onAcao={onDock} />
      {overlay === "flash" ? (
        <OverlayFlash
          flash={{
            ...montarPropsFlash(visao, chart, finalizarFlash, salvarRascunhoFlash),
            ocupado: flashOcupado,
          }}
          erro={flashErro}
          onFechar={() => {
            if (flashOcupado) return;
            setFlashErro(null);
            setOverlay(null);
          }}
        />
      ) : null}
      <OverlayAtivo
        id={overlay === "flash" ? null : overlay}
        onFechar={() => setOverlay(null)}
        onAbrirPaleta={() => setOverlay("interacoes")}
      />
    </main>
  );
}
