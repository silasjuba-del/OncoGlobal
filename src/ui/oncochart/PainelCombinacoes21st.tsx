import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDialogoAcessivel } from "./dialogoAcessivel.js";
import {
  COMBINACOES_21ST,
  GRUPOS_CONSULTA_21ST,
  type Combinacao21stId,
  type GrupoConsultaId,
} from "./combinacoes21st.js";

/**
 * Dropdown interativo inspirado em Shifting Dropdown (#9865) e Help Dropdown (#25361)
 * + Modal Progressive Blur (#4667) + Partition Bar (#26545) + BeUI Bouncy Accordion (#16042).
 */
export function MenuRapido21st({
  combinacao,
  aoMudarCombinacao,
  gruposAbertos,
  aoAlternarTodosGrupos,
  aoFocarGrupo,
  metricas,
}: {
  combinacao: Combinacao21stId;
  aoMudarCombinacao: (proxima: Combinacao21stId) => void;
  gruposAbertos?: Record<GrupoConsultaId, boolean> | undefined;
  aoAlternarTodosGrupos?: ((abrir: boolean) => void) | undefined;
  aoFocarGrupo?: ((id: GrupoConsultaId) => void) | undefined;
  metricas?: Record<string, number> | undefined;
}) {
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const atual = COMBINACOES_21ST.find((c) => c.id === combinacao) ?? COMBINACOES_21ST[0]!;
  const totalAbertos = gruposAbertos
    ? Object.values(gruposAbertos).filter(Boolean).length
    : GRUPOS_CONSULTA_21ST.length;

  useEffect(() => {
    if (!dropdownAberto) return;
    const aoClicarFora = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setDropdownAberto(false);
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropdownAberto(false);
    };
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [dropdownAberto]);

  return (
    <div className="oc21-toolbar" ref={containerRef}>
      <button
        type="button"
        className="oc21-trigger-pill"
        aria-expanded={dropdownAberto}
        aria-haspopup="true"
        onClick={() => setDropdownAberto((v) => !v)}
      >
        <span
          className="oc21-dot"
          style={{ background: atual.acentoHex }}
          aria-hidden="true"
        />
        <span>Aparência · {atual.nome}</span>
        <span className="oc21-chevron" data-aberto={dropdownAberto ? "1" : "0"} aria-hidden="true">
          ▾
        </span>
      </button>

      {gruposAbertos && aoAlternarTodosGrupos ? (
        <button
          type="button"
          className="oc21-quick-btn"
          onClick={() => aoAlternarTodosGrupos(totalAbertos < GRUPOS_CONSULTA_21ST.length)}
          title="Expandir ou recolher todas as seções da consulta"
        >
          {totalAbertos < GRUPOS_CONSULTA_21ST.length
            ? `Expandir tudo (${totalAbertos}/${GRUPOS_CONSULTA_21ST.length})`
            : "Recolher painéis"}
        </button>
      ) : null}

      <button
        type="button"
        className="oc21-quick-btn oc21-quick-btn--accent"
        onClick={() => {
          setDropdownAberto(false);
          setModalAberto(true);
        }}
      >
        Aparência e seções
      </button>

      {dropdownAberto ? (
        <div className="oc21-dropdown" role="region" aria-label="Aparência e seções da consulta">
          <div className="oc21-dropdown-sec">
            <p className="oc21-dropdown-label">Aparência da tela</p>
            <div className="oc21-combo-list">
              {COMBINACOES_21ST.map((item) => {
                const selecionado = item.id === combinacao;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="oc21-combo-item"
                    data-ativo={selecionado ? "1" : "0"}
                    onClick={() => {
                      aoMudarCombinacao(item.id);
                      setDropdownAberto(false);
                    }}
                  >
                    <span
                      className="oc21-dot"
                      style={{ background: item.acentoHex }}
                      aria-hidden="true"
                    />
                    <span className="oc21-combo-txt">
                      <strong>{item.nome}</strong>
                      <small>{item.subtitulo}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {aoFocarGrupo ? (
            <div className="oc21-dropdown-sec">
              <p className="oc21-dropdown-label">Ir para a seção</p>
              <div className="oc21-focus-grid">
                {GRUPOS_CONSULTA_21ST.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className="oc21-focus-chip"
                    onClick={() => {
                      aoFocarGrupo(g.id);
                      setDropdownAberto(false);
                      document.getElementById(g.id)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
                    }}
                  >
                    <span>{g.numero}</span> {g.titulo.split(" & ")[0]}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="oc21-dropdown-foot">
            <button
              type="button"
              className="oc21-open-modal-btn"
              onClick={() => {
                setDropdownAberto(false);
                setModalAberto(true);
              }}
            >
              Abrir aparência e organização das seções
            </button>
          </div>
        </div>
      ) : null}

      {modalAberto ? (
        <ModalCombinacoes21st
          combinacao={combinacao}
          aoMudarCombinacao={aoMudarCombinacao}
          gruposAbertos={gruposAbertos}
          aoAlternarTodosGrupos={aoAlternarTodosGrupos}
          aoFocarGrupo={aoFocarGrupo}
          metricas={metricas}
          aoFechar={() => setModalAberto(false)}
        />
      ) : null}
    </div>
  );
}

function ModalCombinacoes21st({
  combinacao,
  aoMudarCombinacao,
  gruposAbertos,
  aoAlternarTodosGrupos,
  aoFocarGrupo,
  metricas,
  aoFechar,
}: {
  combinacao: Combinacao21stId;
  aoMudarCombinacao: (proxima: Combinacao21stId) => void;
  gruposAbertos?: Record<GrupoConsultaId, boolean> | undefined;
  aoAlternarTodosGrupos?: ((abrir: boolean) => void) | undefined;
  aoFocarGrupo?: ((id: GrupoConsultaId) => void) | undefined;
  metricas?: Record<string, number> | undefined;
  aoFechar: () => void;
}) {
  const ref = useDialogoAcessivel<HTMLDivElement>(aoFechar);

  const entradasMetricas = metricas ? Object.entries(metricas) : [];
  const totalCliques = entradasMetricas.reduce((acc, [, v]) => acc + v, 0);

  return (
    <div className="oc21-modal-backdrop" role="presentation" onClick={aoFechar}>
      <div
        ref={ref}
        className="oc21-modal-card"
        role="dialog"
        aria-modal="true"
        aria-label="Aparência da tela e organização das seções"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="oc21-modal-head">
          <div>
            <span className="oc21-badge">Preferência visual · não altera dados clínicos</span>
            <h2>Aparência e organização das seções</h2>
            <p>
              Escolha a aparência da tela ou organize as seções da consulta. Nenhum dado clínico é alterado.
            </p>
          </div>
          <button type="button" className="oc21-close-btn" onClick={aoFechar}>
            Fechar
          </button>
        </header>

        <section className="oc21-modal-grid" aria-label="Aparências disponíveis">
          {COMBINACOES_21ST.map((item) => {
            const ativo = item.id === combinacao;
            return (
              <article
                key={item.id}
                className="oc21-combo-card"
                data-ativo={ativo ? "1" : "0"}
                onClick={() => aoMudarCombinacao(item.id)}
              >
                <div className="oc21-combo-card-top">
                  <span
                    className="oc21-swatch"
                    style={{
                      background: `linear-gradient(135deg, ${item.acentoHex}, ${item.superficieHex})`,
                    }}
                    aria-hidden="true"
                  />
                  <div>
                    <h3>{item.nome}</h3>
                    <small>{item.subtitulo}</small>
                  </div>
                  <span className="oc21-state-pill">{ativo ? "Ativa" : "Aplicar"}</span>
                </div>
                <p>{item.descricaoCurta}</p>
              </article>
            );
          })}
        </section>

        {aoFocarGrupo && gruposAbertos ? (
          <section className="oc21-modal-sec" aria-label="Agrupamento rápido de seções">
            <div className="oc21-sec-header">
              <h3>Organização das seções</h3>
              {aoAlternarTodosGrupos ? (
                <div className="oc21-sec-actions">
                  <button type="button" onClick={() => aoAlternarTodosGrupos(true)}>
                    Expandir todas
                  </button>
                  <button type="button" onClick={() => aoAlternarTodosGrupos(false)}>
                    Recolher todas
                  </button>
                </div>
              ) : null}
            </div>
            <div className="oc21-group-matrix">
              {GRUPOS_CONSULTA_21ST.map((g) => {
                const aberto = gruposAbertos[g.id];
                return (
                  <button
                    key={g.id}
                    type="button"
                    className="oc21-group-btn"
                    data-aberto={aberto ? "1" : "0"}
                    onClick={() => {
                      aoFocarGrupo(g.id);
                      aoFechar();
                      document.getElementById(g.id)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
                    }}
                  >
                    <span className="oc21-group-num">{g.numero}</span>
                    <div>
                      <strong>{g.titulo}</strong>
                      <small>{aberto ? "Aberto · clique para focar só este" : "Recolhido · clique para focar"}</small>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {entradasMetricas.length > 0 ? (
          <section className="oc21-modal-sec" aria-label="Cliques por etapa">
            <div className="oc21-sec-header">
              <h3>Cliques por etapa nesta consulta</h3>
              <span>Total nesta consulta: {totalCliques} clique(s)</span>
            </div>
            <div className="oc21-partition-bar" role="img" aria-label={`Distribuição de ${totalCliques} cliques`}>
              {entradasMetricas.map(([etapa, qtd], idx) => {
                const pct = totalCliques > 0 ? Math.max(8, Math.round((qtd / totalCliques) * 100)) : 20;
                return (
                  <div
                    key={etapa}
                    className="oc21-partition-seg"
                    data-idx={idx % 4}
                    style={{ flexGrow: pct }}
                    title={`${etapa}: ${qtd}`}
                  >
                    <span>{etapa}</span>
                    <b>{qtd}</b>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Cabeçalho de Acordeão inspirado em BeUI Bouncy Accordion (#16042) e Accordion 05 (#8637).
 * Mantém o elemento de seção e seus filhos montados no DOM para acessibilidade e testes,
 * permitindo recolher/expandir ou focar com 1 clique.
 */
export function SecaoAcordeon21st({
  id,
  numero,
  titulo,
  resumo,
  aberto,
  aoAlternar,
  aoFocarSomenteEste,
  children,
}: {
  id: GrupoConsultaId;
  numero: string;
  titulo: string;
  resumo: string;
  aberto: boolean;
  aoAlternar: () => void;
  aoFocarSomenteEste: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="oc21-acordeon"
      data-acordeon-aberto={aberto ? "1" : "0"}
      data-grupo={id}
    >
      <div className="oc21-acordeon-bar">
        <button
          type="button"
          className="oc21-acordeon-trigger"
          aria-expanded={aberto}
          onClick={aoAlternar}
        >
          <span className="oc21-acordeon-num">{numero}</span>
          <span className="oc21-acordeon-titles">
            <strong>{titulo}</strong>
            <small>{resumo}</small>
          </span>
          <span className="oc21-acordeon-icon" data-aberto={aberto ? "1" : "0"} aria-hidden="true">
            ▾
          </span>
        </button>
        <button
          type="button"
          className="oc21-focus-only-btn"
          onClick={aoFocarSomenteEste}
          title="Recolher as outras seções e manter só esta aberta"
        >
          Focar grupo
        </button>
      </div>
      <div
        id={id}
        className="consulta-secao oc21-acordeon-body"
        tabIndex={-1}
        style={aberto ? undefined : { display: "none" }}
      >
        {children}
      </div>
    </div>
  );
}
