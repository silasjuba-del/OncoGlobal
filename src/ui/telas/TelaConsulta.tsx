import { useEffect, useMemo, useRef, useState } from "react";
import { BannerE1 } from "../consulta/BannerE1.js";
import { BarraFechamento } from "../consulta/BarraFechamento.js";
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
import { AbasChart, type AbaChart } from "../oncochart/AbasChart.js";
import { cadastroSintetico } from "../oncochart/cadastro-sintetico.js";
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
import { timelineSintetica } from "../oncochart/timeline-visao.js";

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

  const chart = useMemo(() => {
    if (!visao) return null;
    const cabecalho = { ...visao.cabecalho, loteSelecionadoId: loteId };
    return montarCabecalhoChart(
      cabecalho,
      cadastroSintetico(patientId, cabecalho.paciente.nascimento),
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

  if (!visao || !chart) {
    return (
      <main aria-label="Consulta pronta" className="tela-consulta">
        <p>{sessaoExpirada ? "sessão expirada — entre de novo" : "carregando consulta"}</p>
      </main>
    );
  }

  const cabecalho = { ...visao.cabecalho, loteSelecionadoId: loteId };
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
      {fonteAberta ? <p className="oc-flash-status" role="status">fonte: {fonteAberta}</p> : null}
      <PatientHeader
        chart={chart}
        semaforo={cabecalho.semaforo}
        onFlash={() => setOverlay("flash")}
        onEditarTnm={() => setOverlay("dx")}
      />
      <Timeline2D
        visao={timelineSintetica(patientId, visao.hoje)}
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
            return <p className="oc-aba-placeholder">Dados clínicos — painéis nas fatias seguintes</p>;
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
          visao={timelineSintetica(patientId, visao.hoje)}
          onFechar={() => setJornada3d(false)}
          onAbrirTc={() => {
            setJornada3d(false);
            setViewer(true);
          }}
        />
      ) : null}
      <Dock gravando={mic} onAcao={onDock} />
      <OverlayAtivo
        id={overlay}
        onFechar={() => setOverlay(null)}
        onAbrirPaleta={() => setOverlay("interacoes")}
      />
    </main>
  );
}
