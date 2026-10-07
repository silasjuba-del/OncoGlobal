import { useEffect, useMemo, useRef, useState } from "react";
import { BannerE1 } from "../consulta/BannerE1.js";
import { BarraFechamento } from "../consulta/BarraFechamento.js";
import { PainelDelta } from "../consulta/PainelDelta.js";
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
import { ImageViewerOncoAssist } from "../oncochart/ImageViewerOncoAssist.js";
import { PatientHeader } from "../oncochart/PatientHeader.js";
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
  const [sessaoExpirada, setSessaoExpirada] = useState(false);
  const [impressaoArmada, setImpressaoArmada] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [tnmMsg, setTnmMsg] = useState<string | null>(null);
  const [jornada3d, setJornada3d] = useState<string | null>(null);
  const [aba, setAba] = useState<AbaChart>("geral");
  const [revisao, setRevisao] = useState<RevisaoCaixaUnica | null>(null);
  const [acaoRevisao, setAcaoRevisao] = useState<string | null>(null);
  const [fonteAberta, setFonteAberta] = useState<string | null>(null);
  const [viewer, setViewer] = useState(false);
  const impressao = useRef<AcaoIntent | null>(null);
  const impressaoEnviada = useRef(false);
  const chaveValidar = chaves.novaChaveIntencao(`validar:${patientId}`);
  const chaveImprimir = chaves.novaChaveIntencao(`imprimir:${patientId}`);

  useEffect(() => {
    let viva = true;
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

  return (
    <main aria-label="Consulta pronta" className="tela-consulta pilha" style={{ position: "relative" }}>
      {sessaoExpirada ? <p>sessão expirada — entre de novo</p> : null}
      {flash ? <p className="oc-flash-status" role="status">{flash}</p> : null}
      {tnmMsg ? <p className="oc-flash-status" role="status">{tnmMsg}</p> : null}
      {jornada3d ? <p className="oc-flash-status" role="status">{jornada3d}</p> : null}
      {acaoRevisao ? <p className="oc-flash-status" role="status">{acaoRevisao}</p> : null}
      {fonteAberta ? <p className="oc-flash-status" role="status">fonte: {fonteAberta}</p> : null}
      <PatientHeader
        chart={chart}
        semaforo={cabecalho.semaforo}
        onFlash={() => setFlash("Consulta Flash — overlay na CURSOR-09")}
        onEditarTnm={() =>
          setTnmMsg("Edição de TNM versionada — overlay na CURSOR-09 (histórico nunca sobrescreve)")
        }
      />
      <Timeline2D
        visao={timelineSintetica(patientId, visao.hoje)}
        onVer3d={() => setJornada3d("Jornada 3D — modal na CURSOR-08")}
      />
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
            return <p className="oc-aba-placeholder">Quimioterapia — prescrição na CURSOR-10</p>;
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
            onChange={(e) => {
              if (e.target.value) setLoteId(e.target.value);
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
          onValidar={(payload) => {
            void porta.confirmar(payload);
          }}
          onImprimir={(intent) => {
            impressao.current = intent;
            impressaoEnviada.current = false;
            setImpressaoArmada(true);
          }}
        />
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
    </main>
  );
}
