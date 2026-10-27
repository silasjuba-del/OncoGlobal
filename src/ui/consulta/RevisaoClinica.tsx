import { useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { RevisaoClinicaResposta, type CampoFichaMinima } from "../../contracts/fase2/revisaoClinica.js";
import { BLOCOS_TUMOR_PACK } from "../../contracts/fase2/tumorPack.js";
import type { PedidoBundle, PortaConsulta } from "../api/porta.js";
import { EstadoDoenca } from './EstadoDoenca.js';
import { LoteTumoralCompleto } from './LoteTumoralCompleto.js';
import { useDialogoAcessivel } from "../oncochart/dialogoAcessivel.js";

const ROTULOS_BLOCOS = {
  identidade: "Identidade do tumor",
  diagnostico: "Diagnóstico",
  estadiamento: "Estadiamento",
  biomarcadores: "Biomarcadores",
  c1_lacunas: "Lacunas da primeira consulta",
  pre_qt: "Pré-QT",
  tratamento: "Tratamento",
  toxicidades: "Toxicidades e interações",
  resposta: "Critérios de resposta",
  seguimento: "Seguimento",
  documentos: "Documentos e orientações",
  fontes: "Fontes",
};

function formatarValorFicha(valor: unknown): string {
  if (valor === null) return "Não consta";
  if (Array.isArray(valor) && valor.length === 0) return "Nenhum — registrado explicitamente";
  if (typeof valor === "string" || typeof valor === "number") return String(valor);
  return JSON.stringify(valor);
}

export function RevisaoClinica({
  porta,
  contexto,
  versaoClinica,
  aoRegistrar = () => {},
}: {
  porta: PortaConsulta;
  contexto: PedidoBundle;
  versaoClinica: number;
  aoRegistrar?: () => void;
}) {
  const [dados, setDados] = useState<RevisaoClinicaResposta | null>(null);
  const [selecao, setSelecao] = useState({ chave: "", id: "" });
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [filtroFicha, setFiltroFicha] = useState<FiltroFicha>("TODOS");
  const [modalFontesAberto, setModalFontesAberto] = useState(false);
  // Ausência da chave = abertura inicial motivada pelos dados; toggle nativo
  // e botão global atualizam a mesma fonte de verdade por subseção.
  const [subsecoes, setSubsecoes] = useState<Partial<Record<"preQt" | "resposta" | "historico", boolean>>>({});
  const [blocosAbertos, setBlocosAbertos] = useState<Partial<Record<string, boolean>>>({});
  const [imprimindo, setImprimindo] = useState(false);
  const geracao = useRef(0);
  const chave = JSON.stringify([contexto.patientId, contexto.encounterId, contexto.tumorLotId]);
  const packId = selecao.chave === chave ? selecao.id : "";

  useEffect(() => {
    // O navegador monta a página impressa logo após beforeprint, antes de qualquer
    // render agendado: sem flushSync os <details> fechados saem vazios no papel.
    const antesDeImprimir = () => flushSync(() => setImprimindo(true));
    const depoisDeImprimir = () => flushSync(() => setImprimindo(false));
    window.addEventListener("beforeprint", antesDeImprimir);
    window.addEventListener("afterprint", depoisDeImprimir);
    return () => {
      window.removeEventListener("beforeprint", antesDeImprimir);
      window.removeEventListener("afterprint", depoisDeImprimir);
    };
  }, []);

  useEffect(() => {
    const atual = ++geracao.current;
    const abort = new AbortController();
    setDados(null);
    setErro("");
    setModalFontesAberto(false);
    setSubsecoes({});
    setBlocosAbertos({});
    if (!porta.revisaoClinica) {
      setErro("Revisão integrada ainda indisponível.");
      return;
    }
    setOcupado(true);
    void porta
      .revisaoClinica(contexto, packId || undefined, abort.signal, !!porta.fontePack)
      .then((bruto) => {
        if (atual !== geracao.current) return;
        const r = RevisaoClinicaResposta.safeParse(bruto);
        if (
          !r.success ||
          r.data.contexto.patientId !== contexto.patientId ||
          r.data.contexto.encounterId !== contexto.encounterId ||
          r.data.contexto.tumorLotId !== contexto.tumorLotId
        ) {
          setErro("Revisão com contexto divergente; reabra a consulta.");
          return;
        }
        setDados(r.data);
      })
      .catch(() => {
        if (atual === geracao.current) setErro("Não foi possível carregar a revisão integrada.");
      })
      .finally(() => {
        if (atual === geracao.current) setOcupado(false);
      });
    return () => {
      geracao.current++;
      abort.abort();
    };
  }, [porta, chave, packId, versaoClinica]);

  const atual =
    dados?.contexto.patientId === contexto.patientId &&
    dados.contexto.encounterId === contexto.encounterId &&
    dados.contexto.tumorLotId === contexto.tumorLotId
      ? dados
      : null;

  // Lista e contador usam o mesmo predicado: o rótulo nunca diverge do que é exibido.
  const fichaVisivel = atual ? atual.ficha.filter((f) => filtroFicha === "TODOS" || grupoFicha(f) === filtroFicha) : [];
  const qtdPorGrupo = (g: Exclude<FiltroFicha, "TODOS">) => atual ? atual.ficha.filter((f) => grupoFicha(f) === g).length : 0;
  const preQtAberta = subsecoes.preQt ?? false;
  const respostaAberta = subsecoes.resposta ?? (!!atual && (atual.respostaTumoral.series.length > 0
    || atual.respostaTumoral.patologica.length > 0));
  const historicoAberto = subsecoes.historico ?? (!!atual && atual.estadosDoenca.length > 0);
  const algumaSubsecaoAberta = preQtAberta || respostaAberta || historicoAberto;
  // O evento toggle é assíncrono: os gerados pela impressão chegam depois de afterprint,
  // já iguais ao estado renderizado. Só a divergência do renderizado é ação do usuário.
  const registrarToggle = (chave: "preQt" | "resposta" | "historico", aberto: boolean, renderizado: boolean) => {
    if (aberto === renderizado) return;
    setSubsecoes(atual => atual[chave] === aberto ? atual : { ...atual, [chave]: aberto });
  };
  const registrarToggleBloco = (nome: string, aberto: boolean, renderizado: boolean) => {
    if (aberto === renderizado) return;
    setBlocosAbertos(atual => atual[nome] === aberto ? atual : { ...atual, [nome]: aberto });
  };

  const blocos = atual?.pack && "blocos" in atual.pack ? atual.pack.blocos : null;
  return (
    <section aria-label="Ficha e revisão clínica" className="revisao-clinica-bento" aria-busy={ocupado}>
      <div className="revisao-clinica-topo">
        <div>
          <h2>Ficha e revisão clínica</h2>
          <p className="revisao-clinica-sub">
            Dados mínimos agrupados por estado; as fontes de cada campo podem ser conferidas em uma única janela.
          </p>
        </div>
        {atual ? (
          <div className="revisao-clinica-toolbar" role="toolbar" aria-label="Agrupamento da ficha clínica">
            <div className="oc21-segmented" role="group" aria-label="Filtrar dados da ficha">
              <button
                type="button"
                data-ativo={filtroFicha === "TODOS" ? "1" : "0"}
                aria-pressed={filtroFicha === "TODOS"}
                onClick={() => setFiltroFicha("TODOS")}
              >
                Todos ({atual.ficha.length})
              </button>
              {GRUPOS_FICHA.map(([grupo, rotulo]) => (
                <button
                  key={grupo}
                  type="button"
                  data-ativo={filtroFicha === grupo ? "1" : "0"}
                  aria-pressed={filtroFicha === grupo}
                  onClick={() => setFiltroFicha(grupo)}
                >
                  {rotulo} ({qtdPorGrupo(grupo)})
                </button>
              ))}
            </div>
            <button
              type="button"
              className="oc21-quick-btn"
              onClick={() => setSubsecoes({ preQt: !algumaSubsecaoAberta,
                resposta: !algumaSubsecaoAberta, historico: !algumaSubsecaoAberta })}
            >
              {algumaSubsecaoAberta ? "Recolher subseções" : "Expandir subseções"}
            </button>
            <button
              type="button"
              className="oc21-quick-btn oc21-quick-btn--accent"
              onClick={() => setModalFontesAberto(true)}
            >
              Conferir fontes
            </button>
          </div>
        ) : null}
      </div>

      {ocupado ? <p role="status">Conferindo dados e fontes…</p> : null}
      {erro ? <p role="status">{erro}</p> : null}

      {atual ? (
        <>
          <table className="ficha-bento-table">
            <caption>Dados mínimos da consulta</caption>
            <thead>
              <tr>
                <th>Dado</th>
                <th>Valor documentado</th>
                <th>Situação e fonte</th>
              </tr>
            </thead>
            <tbody>
              {fichaVisivel.map((f) => (
                <tr key={f.id} data-estado={f.estado}>
                  <th scope="row">{f.rotulo}</th>
                  <td data-vazio={f.valor === null ? "1" : "0"}>{formatarValorFicha(f.valor)}</td>
                  <td>
                    <span className="ficha-estado-pill" data-estado={f.estado}>
                      {f.estado}
                    </span>
                    <details className="ficha-fonte-details">
                      <summary>Conferir fonte</summary>
                      <p>{f.motivo}</p>
                      <p>Data clínica: {f.data ?? "não consta"}</p>
                      <ul>
                        {f.fontes.map((fonte, i) => (
                          <li key={i}>
                            {fonte.sourceId}
                            {fonte.localizador ? ` — ${fonte.localizador}` : ""} ·{" "}
                            {fonte.dataClinica ?? "data não consta"} · versão {fonte.versao}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="revisao-clinica-acordeoes">
            <details className="oc21-details-card" open={imprimindo || preQtAberta}
              onToggle={e => registrarToggle("preQt", e.currentTarget.open, imprimindo || preQtAberta)}>
              <summary>Pré-QT · {atual.preQt.estado}</summary>
              <div className="oc21-details-body">
                <p>Completude documental e avaliações do esquema aguardam decisão médica.</p>
                <ul>
                  {atual.preQt.pendencias.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            </details>

            <details
              className="oc21-details-card"
              open={imprimindo || respostaAberta}
              onToggle={e => registrarToggle("resposta", e.currentTarget.open, imprimindo || respostaAberta)}
            >
              <summary>Resposta tumoral e patológica</summary>
              <div className="oc21-details-body">
                <p>RECIST 1.1 calculado como proposta; conferir o critério aplicável ao tumor.</p>
                {atual.respostaTumoral.pendencias.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
                {atual.respostaTumoral.series.map((s) => (
                  <section key={s.eventId}>
                    <h4>Episódio {s.episodioId}</h4>
                    <table>
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Soma (mm)</th>
                          <th>Δ baseline</th>
                          <th>Δ nadir</th>
                          <th>Proposta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.avaliacoes.map((a, i) => (
                          <tr key={`${a.data}-${i}`}>
                            <td>{a.data}</td>
                            <td>{a.somaMm}</td>
                            <td>{a.deltaBaselinePct}%</td>
                            <td>{a.deltaNadirPct}%</td>
                            <td>
                              {a.categoria ?? "PENDENTE"} · {a.revisao}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p>{s.pendencias.join("; ")}</p>
                  </section>
                ))}
                <h4>Registros de resposta patológica (pCR)</h4>
                {atual.respostaTumoral.patologica.length ? (
                  atual.respostaTumoral.patologica.map((p) => (
                    <p key={p.fato.eventId}>
                      {p.estado === "NEGADO"
                        ? "pCR negada"
                        : p.estado === "INCERTO"
                          ? "pCR incerta — A CONFERIR"
                          : "Registro de pCR"}
                      {p.conflito ? " · CONFLITO entre registros — A CONFERIR" : ""}
                      {p.qualificadores.negated === true || p.qualificadores.negado === true
                        ? " · negação explícita na fonte"
                        : ""}
                      {p.estado === "INCERTO" ? " · confirmação médica pendente" : ""}
                      {" · "}
                      {p.data ?? "Data não consta"}: {JSON.stringify(p.valor)} · fonte{" "}
                      {p.fontes.map((f) => f.sourceId).join(", ")}
                    </p>
                  ))
                ) : (
                  <p>Não consta. Resposta radiológica não determina pCR.</p>
                )}
              </div>
            </details>

            <details
              className="oc21-details-card"
              open={imprimindo || historicoAberto}
              onToggle={e => registrarToggle("historico", e.currentTarget.open, imprimindo || historicoAberto)}
            >
              <summary>Histórico de remissão e recidiva</summary>
              <div className="oc21-details-body">
                {atual.estadosDoenca.length ? (
                  <ul>
                    {atual.estadosDoenca.map((e) => (
                      <li key={e.fato.eventId}>
                        {e.data} · {e.estado}
                        {e.conflito ? " · A CONFERIR: registros divergentes nesta data" : ""}
                        <p>{e.fundamento}</p>
                        <small>Fontes: {e.fontes.map((f) => f.sourceId).join(", ")}</small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Nenhum estado documentado neste lote.</p>
                )}
              </div>
            </details>

            <EstadoDoenca porta={porta} contexto={contexto} aoRegistrar={aoRegistrar} />
          </div>

          <div className="revisao-pack-selector">
            <label>
              Tipo de tumor — disparar pack completo{" "}
              <select
                aria-label="Pack para consulta documental"
                value={packId}
                onChange={(e) => setSelecao({ chave, id: e.target.value })}
              >
                <option value="">Selecionar pelo CID documentado</option>
                {atual.packs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.titulo} · {p.estado}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {atual.pendencias.map((p, i) => (
            <p role="status" key={i}>
              {p}
            </p>
          ))}

          {atual.pack ? (
            <div aria-label="Pack documental selecionado" className="revisao-pack-card">
              <p>
                <strong>{atual.pack.titulo}</strong> · {atual.pack.estado}
              </p>
              <p>
                Fonte: {atual.pack.original.arquivo} · versão {atual.pack.referencia.versao} · estado
                original: {atual.pack.original.estado}
              </p>
              {atual.pack.estado !== "ATIVO" ? (
                <p>
                  {atual.pack.revisaoClinica === null ? "Não curado. " : ""}
                  Conteúdo consultável, com revisão clínica pendente para gerar requisitos e propostas.
                </p>
              ) : null}
              {atual.loteCompleto ? (
                <LoteTumoralCompleto
                  key={atual.loteCompleto.original.sha256}
                  lote={atual.loteCompleto}
                  carregarFonte={porta.fontePack ? signal => porta.fontePack!({...contexto,
                    packId:atual.pack!.referencia.id,hashOriginal:atual.pack!.original.hash},signal) : undefined}
                />
              ) : (
                blocos ? BLOCOS_TUMOR_PACK.map((nome) => {
                  const blocoAberto = imprimindo || (blocosAbertos[nome] ?? false);
                  return (
                  <details key={nome} className="oc21-details-card" open={blocoAberto}
                    onToggle={e => registrarToggleBloco(nome, e.currentTarget.open, blocoAberto)}>
                    <summary>
                      {ROTULOS_BLOCOS[nome]} · {blocos[nome].estado}
                    </summary>
                    <div className="oc21-details-body">
                      {blocos[nome].itens.length ? (
                        blocos[nome].itens.map((item) => (
                          <section key={item.localizador}>
                            <h4>{item.localizador}</h4>
                            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                              {JSON.stringify(item.conteudo, null, 2)}
                            </pre>
                          </section>
                        ))
                      ) : (
                        <p>Não consta neste pack.</p>
                      )}
                    </div>
                  </details>
                  );
                }) : <p>Apresentação documental indisponível.</p>
              )}
            </div>
          ) : null}

          {modalFontesAberto ? (
            <div
              className="oc21-modal-backdrop"
              role="presentation"
              onClick={() => setModalFontesAberto(false)}
            >
              <DialogoFontes aoFechar={() => setModalFontesAberto(false)}>
                <header className="oc21-modal-head">
                  <div>
                    <span className="oc21-badge">Conferência de fontes</span>
                    <h2>Fontes e Proveniência dos Dados Mínimos</h2>
                    <p>
                      Confira todos os campos da ficha clínica e suas origens documentais em uma única visão.
                    </p>
                  </div>
                  <button type="button" onClick={() => setModalFontesAberto(false)}>
                    Fechar
                  </button>
                </header>
                <div className="oc21-modal-grid">
                  {atual.ficha.map((f) => (
                    <article key={f.id} className="oc21-combo-card" data-ativo={grupoFicha(f) === "DOCUMENTADO" ? "1" : "0"}>
                      <div className="oc21-combo-card-top">
                        <div>
                          <h3>{f.rotulo}</h3>
                          <small>Data clínica: {f.data ?? "não consta"}</small>
                        </div>
                        <span className="oc21-state-pill">{f.estado}</span>
                      </div>
                      <p>
                        <strong>Valor:</strong> {formatarValorFicha(f.valor)}
                      </p>
                      <p>{f.motivo}</p>
                      {f.fontes.length > 0 ? (
                        <ul>
                          {f.fontes.map((fonte, idx) => (
                            <li key={idx}>
                              {fonte.sourceId}
                               {fonte.localizador ? ` — ${fonte.localizador}` : ""} · data clínica{" "}
                               {fonte.dataClinica ?? "não consta"} · versão {fonte.versao}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </article>
                  ))}
                </div>
              </DialogoFontes>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

type FiltroFicha = "TODOS" | CampoFichaMinima["estado"];
const GRUPOS_FICHA: readonly [Exclude<FiltroFicha, "TODOS">, string][] = [
  ["DOCUMENTADO", "Documentados"], ["CALCULADO", "Calculados"],
  ["CONFLITANTE", "Conflitantes"], ["PENDENTE", "Pendentes"],
];
/** Só DOCUMENTADO com valor conta como documentado; DOCUMENTADO sem valor é pendência. */
function grupoFicha(f: CampoFichaMinima): Exclude<FiltroFicha, "TODOS"> {
  return f.estado === "DOCUMENTADO" && f.valor === null ? "PENDENTE" : f.estado;
}

function DialogoFontes({ aoFechar, children }: { aoFechar: () => void; children: ReactNode }) {
  const ref = useDialogoAcessivel<HTMLDivElement>(aoFechar);
  return (
    <div
      ref={ref}
      className="oc21-modal-card"
      role="dialog"
      aria-modal="true"
      aria-label="Fontes consolidadas da ficha clínica"
      tabIndex={-1}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}
