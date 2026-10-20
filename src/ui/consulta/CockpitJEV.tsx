import { useState, type ReactNode } from "react";
import type { ConsultaIntegrada } from "../api/respostas.js";
import { CabecalhoJEV } from "./CabecalhoJEV.js";
import { ComandosJEV, type ComandoJEV } from "./ComandosJEV.js";
import { PainelEvidenciasJEV } from "./PainelEvidenciasJEV.js";
import { PainelDelta } from "./PainelDelta.js";
// @ts-expect-error folha CSS pura, resolvida pelo Vite
import "./jev-cockpit.css";

export type { ComandoJEV } from "./ComandosJEV.js";

/** Composição visual da consulta recebida pela porta HTTP; comandos abrem rascunhos. */
export interface CockpitJEVProps {
  visao: ConsultaIntegrada;
  ocupado?: boolean;
  conduta: ReactNode;
  saida: ReactNode;
  mudancasExtra?: ReactNode;
  evidenciasExtra?: ReactNode;
  aoComando: (comando: ComandoJEV) => void;
}

export function CockpitJEV({ visao, ocupado = false, conduta, saida, mudancasExtra, evidenciasExtra, aoComando }: CockpitJEVProps) {
  const [evidenciasAbertas, setEvidenciasAbertas] = useState(true);
  return <section className="jev-cockpit" aria-label="Cockpit JEV">
    <CabecalhoJEV visao={visao} ocupado={ocupado} />
    <div className="jev-cockpit__toolbar"><ComandosJEV ocupado={ocupado} aoComando={aoComando} /></div>
    <div className={evidenciasAbertas ? "jev-cockpit__layout" : "jev-cockpit__layout jev-cockpit__layout--evidencias-fechadas"}>
      <div className="jev-cockpit__cards">
        <section className="jev-card jev-card--mudancas" aria-label="Mudanças e pré-consulta">
          <header className="jev-card__header"><div><p className="jev-eyebrow">PRÉ-CONSULTA</p><h2>Mudanças</h2></div>
            <span className="jev-card__contexto">{visao.delta.temSnapshotAnterior ? "Desde a última consulta" : "Linha de base"}</span></header>
          <PainelDelta temSnapshotAnterior={visao.delta.temSnapshotAnterior} itens={visao.delta.itens} />
          {mudancasExtra ? <div className="jev-card__extra">{mudancasExtra}</div> : null}
        </section>
        <section className="jev-card jev-card--conduta" aria-label="Conduta e protocolo">
          <header className="jev-card__header"><div><p className="jev-eyebrow">PLANO EM REVISÃO</p><h2>Conduta / protocolo</h2></div></header>
          {conduta ?? <p className="jev-empty">Conduta ainda não carregada nesta visão.</p>}
        </section>
        <section className="jev-card jev-card--saida" aria-label="Bundle de saída">
          <header className="jev-card__header"><div><p className="jev-eyebrow">PRÉVIA</p><h2>Bundle de saída</h2></div></header>
          {saida ?? <p className="jev-empty">Bundle ainda não preparado.</p>}
        </section>
      </div>
      <PainelEvidenciasJEV visao={visao} extra={evidenciasExtra} aberto={evidenciasAbertas}
        onAlternar={() => setEvidenciasAbertas(aberto => !aberto)} />
    </div>
  </section>;
}
