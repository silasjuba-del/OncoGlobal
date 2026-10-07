import { useState } from "react";
import { classeSemaforo } from "../tema/temas.js";

const STATUS = ["agendado", "chegou", "em_infusao", "liberado", "faltou"] as const;
type StatusSessao = (typeof STATUS)[number];

const HORAS = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00"] as const;
const POLTRONAS = ["P1", "P2", "P3", "P4"] as const;

interface Sessao {
  id: string;
  poltrona: (typeof POLTRONAS)[number];
  hora: (typeof HORAS)[number];
  paciente: string;
  status: StatusSessao;
}

function alertaGrade(sessoes: readonly Sessao[]): string | null {
  const porHora = new Map<string, number>();
  for (const s of sessoes) {
    porHora.set(s.hora, (porHora.get(s.hora) ?? 0) + 1);
  }
  for (const [hora, n] of porHora) {
    if (n > 5) return `Alerta: ${n} inícios em ${hora} (>5 / 30 min)`;
  }
  // Regra ≥5 h até 12h — sintética
  const manha = sessoes.filter((s) => s.hora <= "12:00").length;
  if (manha >= 5) return `Alerta LGPD/operacional: ${manha} sessões até 12h (≥5)`;
  return null;
}

/** Agenda de QT — grade de poltronas; regras como alerta (não bloqueio). */
export function AgendaQt() {
  const [sessoes, setSessoes] = useState<Sessao[]>([
    { id: "s1", poltrona: "P1", hora: "08:00", paciente: "Paciente A", status: "agendado" },
    { id: "s2", poltrona: "P2", hora: "08:30", paciente: "Paciente B", status: "chegou" },
    { id: "s3", poltrona: "P1", hora: "09:00", paciente: "Paciente C", status: "em_infusao" },
  ]);
  const [sel, setSel] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ciclos, setCiclos] = useState(4);

  const alerta = alertaGrade(sessoes);

  function gerar() {
    const novas: Sessao[] = [];
    for (let i = 0; i < ciclos; i++) {
      const hora = HORAS[Math.min(i, HORAS.length - 1)]!;
      const poltrona = POLTRONAS[i % POLTRONAS.length]!;
      novas.push({
        id: `gen-${i}`,
        poltrona,
        hora,
        paciente: `Ciclo ${i + 1}`,
        status: "agendado",
      });
    }
    setSessoes((s) => [...s, ...novas]);
    setAviso(`Geradas ${ciclos} sessões a partir do 1º dia (sintético)`);
  }

  const escolhida = sessoes.find((s) => s.id === sel) ?? null;

  return (
    <section className="oc-aqt" aria-label="Agenda de QT">
      <header className="oc-aqt-h">
        <h3>Agenda de QT</h3>
        <p className="oc-muted">Aviso LGPD: grade operacional sintética — sem PHI real.</p>
      </header>

      {alerta ? (
        <p className={classeSemaforo("VERMELHO")} role="status">
          {alerta}
        </p>
      ) : null}
      {aviso ? (
        <p role="status">{aviso}</p>
      ) : null}

      <div className="oc-aqt-gen">
        <label>
          Nº de ciclos
          <input
            aria-label="Número de ciclos"
            type="number"
            min={1}
            max={12}
            value={ciclos}
            onChange={(e) => setCiclos(Number(e.target.value) || 1)}
          />
        </label>
        <button type="button" className="oc-btn-primary" onClick={gerar}>
          Gerar por 1º dia + ciclos
        </button>
        <span className="oc-chip">Visão farmácia</span>
      </div>

      <div className="oc-aqt-grid" role="grid" aria-label="Poltronas por hora">
        <div className="oc-aqt-row oc-aqt-head" role="row">
          <span role="columnheader">Hora</span>
          {POLTRONAS.map((p) => (
            <span key={p} role="columnheader">
              {p}
            </span>
          ))}
        </div>
        {HORAS.map((h) => (
          <div key={h} className="oc-aqt-row" role="row">
            <span role="rowheader">{h}</span>
            {POLTRONAS.map((p) => {
              const s = sessoes.find((x) => x.hora === h && x.poltrona === p);
              return (
                <button
                  key={`${h}-${p}`}
                  type="button"
                  role="gridcell"
                  className="oc-aqt-cell"
                  data-status={s?.status ?? "vazio"}
                  draggable={!!s}
                  onDragStart={() => s && setSel(s.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (!sel) return;
                    setSessoes((list) =>
                      list.map((x) => (x.id === sel ? { ...x, hora: h, poltrona: p } : x)),
                    );
                    setAviso(`Sessão movida para ${p} · ${h}`);
                  }}
                  onClick={() => s && setSel(s.id)}
                >
                  {s ? `${s.paciente} · ${s.status}` : "—"}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {escolhida ? (
        <div className="oc-aqt-status" aria-label="Status da sessão">
          <p>
            {escolhida.paciente} · {escolhida.poltrona} · {escolhida.hora}
          </p>
          <div role="group" aria-label="Cinco estados">
            {STATUS.map((st) => (
              <button
                key={st}
                type="button"
                aria-pressed={escolhida.status === st}
                onClick={() =>
                  setSessoes((list) =>
                    list.map((x) => (x.id === escolhida.id ? { ...x, status: st } : x)),
                  )
                }
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
