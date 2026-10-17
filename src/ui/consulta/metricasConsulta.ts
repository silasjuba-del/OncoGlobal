export const ETAPAS_CONSULTA=["ENTRADA","REVISAO_FONTE","MEDICAMENTOS","SINTESE","FICHA","CONDUTA","HISTORICO"] as const;
export type EtapaConsulta=typeof ETAPAS_CONSULTA[number];
export type MetricasConsulta=Record<EtapaConsulta,number>;
export function metricasVazias():MetricasConsulta{return Object.fromEntries(ETAPAS_CONSULTA.map(e=>[e,0])) as MetricasConsulta;}
const SECOES:Record<string,EtapaConsulta>={"consulta-documentos":"ENTRADA","consulta-revisao":"REVISAO_FONTE",
  "consulta-medicamentos":"MEDICAMENTOS","consulta-sintese":"SINTESE","consulta-fase2":"FICHA","consulta-resumo":"FICHA",
  "consulta-conduta":"CONDUTA","consulta-historico":"HISTORICO"};
/** Só etapa da aplicação e contagem. Não retém texto, valor, elemento ou identidade. */
export function etapaDoClique(alvo:EventTarget|null):EtapaConsulta|null{
  if(!(alvo instanceof Element)||!alvo.closest('button,a,input,textarea,select,summary'))return null;
  let elemento:Element|null=alvo;
  while(elemento){const etapa=SECOES[elemento.id];if(etapa)return etapa;elemento=elemento.parentElement;}
  return null;
}
export function contarClique(metricas:MetricasConsulta,etapa:EtapaConsulta):MetricasConsulta{
  return {...metricas,[etapa]:Math.min(Number.MAX_SAFE_INTEGER,metricas[etapa]+1)};
}
