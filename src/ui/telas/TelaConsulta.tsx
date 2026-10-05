import { useEffect, useRef, useState } from "react";
import { BannerE1 } from "../consulta/BannerE1.js";
import { BarraFechamento } from "../consulta/BarraFechamento.js";
import { CabecalhoPaciente } from "../consulta/CabecalhoPaciente.js";
import { PainelDelta } from "../consulta/PainelDelta.js";
import { CardEvidencia } from "../evidencia/CardEvidencia.js";
import type { ChavesIntencao } from "../api/chaves.js";
import { ErroPorta, type AcaoIntent, type ConsultaVisao, type PortaConsulta } from "../api/porta.js";

// @ts-expect-error folha CSS pura, resolvida pelo Vite
import "./consulta.css";

/** Consulta já montada. Validar não imprime. Imprimir só depois de uma tecla de confirmação. */
export function TelaConsulta({
  patientId,
  porta,
  chaves,
}: {
  patientId: string;
  porta: PortaConsulta;
  chaves: ChavesIntencao;
}) {
  const [visao, setVisao] = useState<ConsultaVisao | null>(null);
  const [loteId, setLoteId] = useState<string | null>(null);
  const [sessaoExpirada, setSessaoExpirada] = useState(false);
  const [impressaoArmada, setImpressaoArmada] = useState(false);
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

  if (!visao) {
    return (
      <main aria-label="Consulta pronta" className="tela-consulta">
        <p>{sessaoExpirada ? "sessão expirada — entre de novo" : "carregando consulta"}</p>
      </main>
    );
  }

  const cabecalho = { ...visao.cabecalho, loteSelecionadoId: loteId };

  return (
    <main aria-label="Consulta pronta" className="tela-consulta pilha">
      {sessaoExpirada ? <p>sessão expirada — entre de novo</p> : null}
      <CabecalhoPaciente visao={cabecalho} onSelecionarLote={setLoteId} />
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
    </main>
  );
}
