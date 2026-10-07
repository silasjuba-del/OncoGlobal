// PROVISORIO-W10: trocar por projeção longitudinal (Fugu) via src/contracts/w10 + porta.

export type LaneTimeline = "Diagnóstico" | "Imagem" | "Sistêmico" | "Cirurgia · RT";

export interface EventoTimeline {
  id: string;
  lane: 0 | 1 | 2 | 3;
  em: string; // YYYY-MM-DD
  titulo: string;
  subtitulo: string;
  futuro?: boolean;
  miniatura?: boolean;
}

export interface BarraTimeline {
  id: string;
  lane: 0 | 1 | 2 | 3;
  de: string;
  ate: string;
  rotulo: string;
  futuro?: boolean;
}

export interface TimelineVisao {
  patientId: string;
  inicio: string;
  fim: string;
  hoje: string;
  cicloChip: string | null;
  lanes: readonly LaneTimeline[];
  barras: readonly BarraTimeline[];
  eventos: readonly EventoTimeline[];
  /** Histórico de estádio: só leitura; nunca sobrescreve o atual. */
  stageHistory: readonly { em: string; estadio: string; tnm: string }[];
}

export const LANES: readonly LaneTimeline[] = [
  "Diagnóstico",
  "Imagem",
  "Sistêmico",
  "Cirurgia · RT",
];

/** Posição % no eixo. */
export function posicaoNoEixo(em: string, inicio: string, fim: string): number {
  const a = Date.parse(`${inicio}T12:00:00Z`);
  const b = Date.parse(`${fim}T12:00:00Z`);
  const x = Date.parse(`${em}T12:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(x) || b <= a) return 0;
  return Math.max(0, Math.min(100, ((x - a) / (b - a)) * 100));
}

export function mesesDoEixo(inicio: string, fim: string): readonly { em: string; rotulo: string }[] {
  const out: { em: string; rotulo: string }[] = [];
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [yi, mi] = inicio.split("-").map(Number);
  const [yf, mf] = fim.split("-").map(Number);
  if (!yi || !mi || !yf || !mf) return out;
  let y = yi;
  let m = mi;
  while (y < yf || (y === yf && m <= mf)) {
    const em = `${y}-${String(m).padStart(2, "0")}-01`;
    out.push({ em, rotulo: nomes[m - 1] ?? "" });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/** Timeline sintética por paciente — espelha a porta falsa até a projeção do Fugu. */
export function timelineSintetica(patientId: string, hoje: string): TimelineVisao {
  const pendente = patientId.includes("pendente");
  if (pendente) {
    return {
      patientId,
      inicio: "2026-05-01",
      fim: "2026-12-01",
      hoje,
      cicloChip: null,
      lanes: LANES,
      barras: [],
      eventos: [],
      stageHistory: [],
    };
  }
  return {
    patientId,
    inicio: "2026-05-01",
    fim: "2027-01-31",
    hoje,
    cicloChip: "Ciclo sintético · C1",
    lanes: LANES,
    barras: [
      {
        id: "bar-qt",
        lane: 2,
        de: "2026-06-02",
        ate: "2026-10-20",
        rotulo: "QT sintética",
      },
      {
        id: "bar-qt-fut",
        lane: 2,
        de: "2026-10-21",
        ate: "2026-12-15",
        rotulo: "QT futura",
        futuro: true,
      },
    ],
    eventos: [
      {
        id: "ev-dx",
        lane: 0,
        em: "2026-05-12",
        titulo: "Diagnóstico",
        subtitulo: "biopsia sintética",
      },
      {
        id: "ev-img",
        lane: 1,
        em: "2026-09-28",
        titulo: "TC",
        subtitulo: "reavaliação",
        miniatura: true,
      },
      {
        id: "ev-fut",
        lane: 3,
        em: "2026-12-01",
        titulo: "RT",
        subtitulo: "agendada",
        futuro: true,
      },
    ],
    stageHistory: [
      { em: "2026-05-12", estadio: "IIB", tnm: "cT2N1M0" },
      { em: "2026-09-28", estadio: "ypT1N0M0", tnm: "ypT1N0M0" },
    ],
  };
}
