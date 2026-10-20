import { useMemo, useState, type CSSProperties } from "react";
import type { EventoTimelineMulticamadas, TimelineMulticamadasTrilha, VisaoTimelineMulticamadas } from "../../contracts/api/timelineMulticamadas.js";
// @ts-expect-error folha CSS resolvida pelo Vite
import "./timeline-multicamadas.css";

const TRILHAS: readonly { id: TimelineMulticamadasTrilha; titulo: string }[] = [
  { id: "DEFINIDORES", titulo: "Definidores" },
  { id: "TRATAMENTO_RESPOSTA", titulo: "Tratamento e resposta" },
  { id: "FISIOLOGIA", titulo: "Fisiologia" },
  { id: "SINTOMAS", titulo: "Sintomas" },
  { id: "DOCUMENTOS", titulo: "Documentos" },
];

function intervaloData(valor: string): [string, string] | null {
  if (/^\d{4}$/u.test(valor)) return [`${valor}-01-01`, `${valor}-12-31`];
  if (/^\d{4}-(0[1-9]|1[0-2])$/u.test(valor)) {
    const [ano, mes] = valor.split("-").map(Number) as [number, number];
    const fim = new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
    return [`${valor}-01`, fim];
  }
  if (/^\d{4}-\d{2}-\d{2}(?:T.*)?$/u.test(valor)) {
    const data = valor.slice(0, 10);
    return [data, data];
  }
  return null;
}

function dataParaExibicao(evento: EventoTimelineMulticamadas): string {
  if (evento.dataClinica) return `Data clínica: ${evento.dataClinica}`;
  if (evento.dataPlanejada) return `Previsto: ${evento.dataPlanejada}`;
  return "Data clínica não consta";
}

function tratamentoParaExibicao(evento: EventoTimelineMulticamadas): string | null {
  if (!evento.tratamento) return null;
  const atraso = evento.tratamento.atrasoDias;
  return atraso !== null && atraso > 0
    ? `${evento.tratamento.estado} · ${atraso} dias após o previsto`
    : evento.tratamento.estado;
}

function noIntervalo(evento: EventoTimelineMulticamadas, inicio: string, fim: string): boolean {
  const valor = evento.dataClinica ?? evento.dataPlanejada;
  if (!valor) return false;
  const intervalo = intervaloData(valor);
  if (!intervalo) return false;
  return (!inicio || intervalo[1] >= inicio) && (!fim || intervalo[0] <= fim);
}

function resumoEvento(evento: EventoTimelineMulticamadas): string {
  return [evento.titulo, evento.resumo, dataParaExibicao(evento), tratamentoParaExibicao(evento),
    evento.supersedido ? "versão substituída" : null].filter(Boolean).join(" · ");
}

function seletorEvento(evento: EventoTimelineMulticamadas, selecionado: string | null, selecionar: (id: string) => void) {
  return <li key={evento.id}>
    <button type="button" className="tm-evento" aria-pressed={selecionado === evento.id}
      onClick={() => selecionar(evento.id)} onKeyDown={event => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selecionar(evento.id); }
      }}>
      <time>{dataParaExibicao(evento)}</time>
      <strong>{evento.titulo}</strong>
      <span>{evento.resumo}</span>
      {tratamentoParaExibicao(evento) ? <small>{tratamentoParaExibicao(evento)}</small> : null}
      {evento.supersedido ? <small>Versão substituída · preservada no histórico</small> : null}
    </button>
  </li>;
}

export function TimelineMulticamadas({ dados }: { dados: VisaoTimelineMulticamadas }) {
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [zoom, setZoom] = useState(1);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const estilo = { "--tm-card-width": `${12 * zoom}rem`, "--tm-card-max-width": `${20 * zoom}rem`, "--tm-gap": `${0.75 * zoom}rem` } as CSSProperties;
  const datados = useMemo(() => dados.eventos.filter(evento => noIntervalo(evento, inicio, fim)), [dados.eventos, inicio, fim]);
  const semData = useMemo(() => dados.eventos.filter(evento => !evento.dataClinica && !evento.dataPlanejada), [dados.eventos]);
  const detalhe = dados.eventos.find(evento => evento.id === selecionado) ?? null;

  return <section aria-label="Timeline multicamadas" className="tm-timeline" style={estilo}>
    <header className="tm-cabecalho">
      <div><h2>Timeline multicamadas</h2>
        <p>Paciente {dados.contexto.patientId} · Lote {dados.contexto.tumorLotId ?? "não selecionado"}</p></div>
      <small>Revisão {dados.revisao.slice(0, 12)}</small>
    </header>
    <div className="tm-controles" role="group" aria-label="Filtros da timeline">
      <label>Data inicial <input type="date" aria-label="Data inicial" value={inicio} onChange={event => setInicio(event.target.value)} /></label>
      <label>Data final <input type="date" aria-label="Data final" value={fim} onChange={event => setFim(event.target.value)} /></label>
      <label>Zoom da timeline <input type="range" min="1" max="3" step="1" value={zoom}
        onChange={event => setZoom(Number(event.target.value))} /></label>
      <output aria-live="polite">{zoom}×</output>
      <button type="button" onClick={() => { setInicio(""); setFim(""); }}>Limpar intervalo</button>
    </div>

    <div className="tm-trilhas">
      {TRILHAS.map(trilha => <section className="tm-trilha" aria-label={trilha.titulo} key={trilha.id}>
        <h3>{trilha.titulo}</h3>
        {datados.some(evento => evento.trilha === trilha.id) ? <ol className="tm-eventos">
          {datados.filter(evento => evento.trilha === trilha.id).map(evento => seletorEvento(evento, selecionado, setSelecionado))}
        </ol> : <p className="tm-vazio">Nenhum evento com data nesta trilha.</p>}
      </section>)}
    </div>

    <section className="tm-sem-data" aria-label="Eventos sem data clínica">
      <h3>Eventos sem data clínica ({semData.length})</h3>
      <p>Data clínica ausente permanece separada da data de registro.</p>
      {semData.length ? <ol className="tm-eventos">
        {semData.map(evento => seletorEvento(evento, selecionado, setSelecionado))}
      </ol> : <p className="tm-vazio">Nenhum evento sem data clínica.</p>}
    </section>

    <section className="tm-detalhes" aria-label="Detalhes do evento" aria-live="polite">
      <h3>{detalhe ? detalhe.titulo : "Selecione um evento"}</h3>
      {!detalhe ? <p>Escolha um ponto da timeline para consultar fontes e trecho persistido.</p> : <>
        <p>{detalhe.resumo}</p>
        <dl>
          <dt>Data clínica</dt><dd>{detalhe.dataClinica ?? "Não consta"}</dd>
          {detalhe.dataPlanejada ? <><dt>Data planejada</dt><dd>{detalhe.dataPlanejada}</dd></> : null}
          <dt>Data de registro</dt><dd>{detalhe.dataRegistro}</dd>
          <dt>Encontro</dt><dd>{detalhe.encounterId}</dd>
          <dt>Revisão</dt><dd>{detalhe.revisao}{detalhe.supersedido ? " · substituído" : ""}</dd>
          {tratamentoParaExibicao(detalhe) ? <><dt>Tratamento</dt><dd>{tratamentoParaExibicao(detalhe)}</dd></> : null}
        </dl>
        <h4>Fontes</h4>
        {detalhe.fontes.length ? <ul>{detalhe.fontes.map((fonte, index) => <li key={`${fonte.sourceId}-${index}`}>
          {fonte.sourceId} · {fonte.classe}{fonte.localizador ? ` · ${fonte.localizador}` : ""}
          {fonte.dataClinica ? ` · data clínica ${fonte.dataClinica}` : " · data clínica não consta"}
        </li>)}</ul> : <p>Fontes não constam.</p>}
        {detalhe.detalhes.length ? <><h4>Dados do evento</h4><dl>{detalhe.detalhes.map((item, index) => <div key={`${item.rotulo}-${index}`}>
          <dt>{item.rotulo}</dt><dd>{item.valor ?? "Não consta"}</dd>
        </div>)}</dl></> : null}
        <h4>Trecho</h4><pre>{detalhe.trecho ?? "Trecho não fornecido no evento."}</pre>
      </>}
    </section>
  </section>;
}
