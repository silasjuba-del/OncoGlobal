import { classeSemaforo } from "../tema/temas.js";
import type { CabecalhoChart } from "./chart-visao.js";

function tnmTexto(d: CabecalhoChart["diagnostico"]): string {
  if (d.t == null && d.n == null && d.m == null) return "PENDENTE";
  const pref = d.tnmPrefixo ?? "";
  return `${pref}${d.t ?? "–"}${d.n ?? "–"}${d.m ?? "–"}`;
}

export function PatientHeader({
  chart,
  semaforo,
  onFlash,
  onEditarTnm,
}: {
  chart: CabecalhoChart;
  semaforo: "VERDE" | "VERMELHO" | "PENDENTE";
  onFlash: () => void;
  onEditarTnm: () => void;
}) {
  const d = chart.diagnostico;
  return (
    <section
      className="oc-phead"
      aria-label="Cabeçalho do paciente"
      data-semaforo={semaforo}
    >
      <div className="oc-p-avatar" aria-hidden="true">
        <div className="oc-p-avatar-in">{chart.iniciais}</div>
      </div>
      <div className="oc-p-meta">
        <div className="oc-p-nome-linha">
          <h2 className="oc-p-name">{chart.pacienteNome}</h2>
        </div>
        <div className="oc-anag">
          <span>
            {chart.idade} · {chart.sexo}
          </span>
          <span className="oc-mono">{chart.prontuario}</span>
        </div>
        <div className="oc-tags" aria-label="Chips clínicos">
          <span className="oc-chip oc-chip-accent">{chart.diagnosticoChip}</span>
          <ChipAlergia alergia={chart.alergia} />
          <span className="oc-chip">
            ECOG {d.ecog == null ? "PENDENTE" : d.ecog}
          </span>
          {d.biomarcadores.length === 0 ? (
            <span className="oc-chip">Biomarcadores PENDENTE</span>
          ) : (
            d.biomarcadores.map((b) => (
              <span key={`${b.rotulo}-${b.fonte}`} className="oc-chip" title={`fonte: ${b.fonte}`}>
                {b.rotulo}
                <span className="oc-chip-fonte"> · {b.fonte}</span>
              </span>
            ))
          )}
        </div>
      </div>

      <article className="oc-dx" aria-label="Diagnóstico e estadiamento">
        <div className="oc-dx-h">
          <span className="oc-dx-lb">Diagnóstico &amp; estadiamento</span>
        </div>
        <div className="oc-dx-c">
          <div className="oc-cid-big" aria-label="CID">
            <span className="oc-c1">CID-10</span>
            <span className="oc-c2">{d.cid ?? "PENDENTE"}</span>
          </div>
          <div className="oc-dx-mid">
            <p className="oc-dx-title">{d.titulo ?? "PENDENTE"}</p>
            <p className="oc-muted">{d.histologia ?? "PENDENTE"}</p>
          </div>
          <button type="button" className="oc-dx-stat" aria-label="Editar TNM" onClick={onEditarTnm}>
            <span className="oc-k">TNM</span>
            <span className="oc-v">{tnmTexto(d)}</span>
            <span className="oc-k">estádio {d.estadio ?? "PENDENTE"}</span>
          </button>
          <div className="oc-dx-stat oc-eco" aria-label="ECOG">
            <span className="oc-k">ECOG</span>
            <span className="oc-v">{d.ecog == null ? "PENDENTE" : d.ecog}</span>
          </div>
        </div>
        {d.stageHistory.length > 0 ? (
          <div className="oc-dx-ev" aria-label="Histórico de estádio">
            {d.stageHistory.map((h) => (
              <span key={`${h.em}-${h.tnm}`}>
                {h.em}: {h.tnm} · {h.estadio}
              </span>
            ))}
          </div>
        ) : (
          <div className="oc-dx-ev">
            <span className={classeSemaforo("PENDENTE")}>histórico de estádio PENDENTE</span>
          </div>
        )}
      </article>

      <div className="oc-actions-col">
        <p className={classeSemaforo(semaforo)} data-semaforo={semaforo}>
          <span aria-hidden="true">●</span>
          {semaforo}
        </p>
        <button type="button" className="oc-btn-primary" onClick={onFlash}>
          Consulta Flash
        </button>
      </div>
    </section>
  );
}

function ChipAlergia({ alergia }: { alergia: CabecalhoChart["alergia"] }) {
  if (alergia.estado === "PENDENTE") {
    return (
      <span className={`oc-chip oc-chip-pendente ${classeSemaforo("PENDENTE")}`} data-alergia="pendente">
        Alergia PENDENTE
      </span>
    );
  }
  if (alergia.estado === "NEGA") {
    return (
      <span className="oc-chip" data-alergia="nega">
        Nega alergias
      </span>
    );
  }
  return (
    <span className="oc-chip oc-chip-danger" data-alergia="lista">
      Alergia: {alergia.itens.join(", ")}
    </span>
  );
}
