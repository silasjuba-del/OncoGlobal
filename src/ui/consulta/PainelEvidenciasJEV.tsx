import type { ReactNode } from "react";
import type { ConsultaIntegrada } from "../api/respostas.js";

export function PainelEvidenciasJEV({ visao, extra, aberto = true, onAlternar }: {
  visao: ConsultaIntegrada; extra?: ReactNode; aberto?: boolean; onAlternar?: () => void;
}) {
  const evidencias = visao.evidencias;
  return <aside className={aberto ? "jev-evidence" : "jev-evidence jev-evidence--collapsed"} aria-label="Painel lateral de evidências">
    <header className="jev-evidence__header">
      {aberto ? <div><p className="jev-eyebrow">CONTEXTO E PROVENIÊNCIA</p><h2>Evidências</h2></div> : null}
      {onAlternar ? <button type="button" className="jev-evidence__toggle" aria-expanded={aberto}
        aria-label={aberto ? "Recolher evidências" : "Expandir evidências"} onClick={onAlternar}>
        {aberto ? "Recolher" : "Evidências"}
      </button> : null}
    </header>
    {aberto ? <>
    <p className="jev-evidence__revision">Consulta {visao.encounterId} · lote {visao.tumorLotId ?? "não selecionado"}</p>
    {visao.retrato ? <div className="jev-evidence__integrada">
      <a href="#consulta-resumo">Abrir visão clínica integrada</a>
      <p>Revisão {visao.retrato.revisao}</p>
    </div> : <p className="jev-evidence__pending">Visão integrada PENDENTE nesta resposta.</p>}
    {evidencias.length ? <details className="jev-evidence__claims">
      <summary>Afirmações e fontes ({evidencias.length})</summary>
      <ul>
        {evidencias.map((item, index) => <li className="jev-evidence__claim" key={`${item.rotulo}-${index}`}>
          <strong>{item.rotulo}</strong>
          <span data-state={item.campo}>{item.valorTexto ?? item.campo}</span>
          {item.motivo ? <small>{item.motivo}</small> : null}
          {item.fontes.length ? item.fontes.map((fonte, sourceIndex) => <details className="jev-source" key={`${fonte.sourceId}-${sourceIndex}`}>
            <summary>{fonte.sourceId} · {fonte.dataClinica ?? "data clínica pendente"}</summary>
            <span>{fonte.localizador ?? "Localizador não informado"} · captura {fonte.dataCaptura} · v{fonte.versao}</span>
            <code>{fonte.contentHash}</code>
          </details>) : <small>Fonte não retornada nesta visão.</small>}
        </li>)}
      </ul>
    </details> : <p className="jev-evidence__pending">Nenhuma afirmação foi retornada nesta visão.</p>}
    {visao.retrato?.integridade.length ? <p className="jev-evidence__critical" role="alert">
      Integridade pendente: {visao.retrato.integridade.length} referência(s) precisam de conferência.
    </p> : null}
    {extra ? <div className="jev-evidence__extra">{extra}</div> : null}
    </> : null}
  </aside>;
}
