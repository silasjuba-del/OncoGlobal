import type { EventoTimeline, TimelineVisao } from "./timeline-visao.js";
import { posicaoNoEixo } from "./timeline-visao.js";

export type ModoChartParada = "recist" | "ctcae" | null;

export interface ParadaJornada {
  id: string;
  titulo: string;
  subtitulo: string;
  em: string;
  lane: 0 | 1 | 2 | 3;
  /** px no eixo X do mundo (−W/2 … +W/2). */
  x: number;
  z: number;
  futuro?: boolean;
  hoje?: boolean;
  chart: ModoChartParada;
  /** Narração sem conduta (D-W9 / OncoFab). */
  narracao: string;
}

const LANE_Z = [-165, -55, 55, 165] as const;
const W = 1680;

/** Remove frases de conduta tipicamente proibidas na narração assistiva. */
export function sanitizarNarracao(texto: string): string {
  return texto
    .replace(/trocar antes da HT/gi, "interação apontada: fluoxetina × tamoxifeno (fonte sintética)")
    .replace(/\b(prescreva|indique|recomend[oa]|deve iniciar)\b/gi, "achado apontado");
}

function narracaoDeEvento(
  ev: EventoTimeline & { hoje?: boolean },
  cicloChip: string | null,
): string {
  if (ev.hoje) {
    const c11 =
      cicloChip && /C11/i.test(cicloChip)
        ? "C11 liberado só após validação humana dos portões (ainda PENDENTE na UI)."
        : "Ciclo do dia — liberação só após validação humana dos portões.";
    return sanitizarNarracao(
      `${ev.titulo}. ${ev.subtitulo}. ${c11} Alerta: interação apontada: fluoxetina × tamoxifeno (fonte sintética).`,
    );
  }
  if (ev.lane === 1) {
    return sanitizarNarracao(
      `${ev.titulo}: ${ev.subtitulo}. Marco de imagem — Chart3D em modo RECIST 1.1 (lesões-alvo confirmadas).`,
    );
  }
  if (ev.lane === 2) {
    return sanitizarNarracao(
      `${ev.titulo}: ${ev.subtitulo}. Marco sistêmico — skyline CTCAE só com graus confirmados (ausente = sem caixa).`,
    );
  }
  return sanitizarNarracao(`${ev.titulo}: ${ev.subtitulo}. Narração assistiva com dados sintéticos — sem conduta.`);
}

function chartDeEvento(ev: EventoTimeline): ModoChartParada {
  if (ev.lane === 1) return "recist";
  if (ev.lane === 2) return "ctcae";
  return null;
}

export function montarParadasJornada(visao: TimelineVisao): readonly ParadaJornada[] {
  const base: ParadaJornada[] = visao.eventos.map((ev) => {
    const pct = posicaoNoEixo(ev.em, visao.inicio, visao.fim);
    const x = (pct / 100) * W - W / 2;
    const hoje = ev.em === visao.hoje;
    const parada: ParadaJornada = {
      id: ev.id,
      titulo: ev.titulo,
      subtitulo: ev.subtitulo,
      em: ev.em,
      lane: ev.lane,
      x,
      z: LANE_Z[ev.lane] ?? 0,
      hoje,
      chart: chartDeEvento(ev),
      narracao: narracaoDeEvento({ ...ev, hoje }, visao.cicloChip),
    };
    if (ev.futuro) parada.futuro = true;
    return parada;
  });
  if (!base.some((p) => p.hoje) && visao.hoje) {
    const pct = posicaoNoEixo(visao.hoje, visao.inicio, visao.fim);
    const x = (pct / 100) * W - W / 2;
    base.push({
      id: "parada-hoje",
      titulo: "Hoje · consulta",
      subtitulo: visao.cicloChip ?? "sem ciclo",
      em: visao.hoje,
      lane: 2,
      x,
      z: LANE_Z[2],
      hoje: true,
      chart: "ctcae",
      narracao: narracaoDeEvento(
        {
          id: "parada-hoje",
          lane: 2,
          em: visao.hoje,
          titulo: "Hoje · consulta",
          subtitulo: visao.cicloChip ?? "sem ciclo",
          hoje: true,
        },
        visao.cicloChip,
      ),
    });
  }
  return base;
}

export const JORNADA_WORLD_W = W;
export const JORNADA_LANE_Z = LANE_Z;
