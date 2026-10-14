import type { ConsultaVisao } from "../api/porta.js";
import { LANES, type EventoTimeline, type TimelineVisao } from "./timeline-visao.js";

/** Eixo X só com datas e fatos da consulta; nenhum protocolo ou evento demonstrativo. */
export function timelineDaConsulta(v: ConsultaVisao): TimelineVisao {
  const eventos: EventoTimeline[] = (v.flash?.exames ?? []).map((e,index)=>({
    id:`exame-${index}-${e.data}`,lane:/bi[oó]ps|anatom/i.test(e.nome) ? 0 : 1,
    em:e.data,titulo:e.nome,subtitulo:e.fraseLaudo ?? "Fonte pendente",futuro:e.data>v.hoje,
  }));
  for (const h of v.historicoTratamento?.linhas ?? []) {
    const em=h.data ?? h.periodo?.inicio;
    if (!em) continue;
    eventos.push({id:h.origem,lane:h.tipo === "SISTEMICO"?2:3,em,titulo:h.protocoloOuTipo ?? h.tipo,
      subtitulo:[h.observacao,...h.pendencias].filter(Boolean).join("; "),futuro:em>v.hoje});
  }
  const lote=v.cabecalho.lotes.find(l=>l.tumorLotId===v.cabecalho.loteSelecionadoId);
  const stageHistory=(lote?.estadiamentos ?? []).map(e=>({em:e.data,estadio:e.grupo ?? "PENDENTE",
    tnm:[e.prefixo,e.T,e.N,e.M].filter(Boolean).join("")}));
  const datas=[v.hoje,...eventos.map(e=>e.em),...stageHistory.map(e=>e.em)].sort();
  const inicio=datas[0]!,ultimo=datas.at(-1)!;
  const fim=ultimo===inicio ? new Date(Date.parse(`${ultimo}T12:00:00Z`)+86_400_000).toISOString().slice(0,10) : ultimo;
  return {patientId:v.patientId,inicio,fim,hoje:v.hoje,lanes:LANES,barras:[],eventos,stageHistory,
    cicloChip:v.cabecalho.ciclo?`C${v.cabecalho.ciclo.numero}`:null};
}
