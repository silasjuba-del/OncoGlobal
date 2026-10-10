import type { CabecalhoChart } from "../oncochart/chart-visao.js";
import type { ConsultaVisao } from "../api/porta.js";
import type { ConsultaFlashProps } from "./ConsultaFlash.js";

type EstadioFlash = ConsultaVisao["cabecalho"]["lotes"][number]["estadiamentos"][number];
/** O uso clínico explícito prevalece; ambiguidades nunca são resolvidas pela ordem do array. */
export function selecionarEstadiamentoFlash(itens: readonly EstadioFlash[]): EstadioFlash | undefined {
  const ativos = itens.filter(e => e.usoAtivo.includes("PROTOCOLO"));
  if (ativos.length) return ativos.length === 1 ? ativos[0] : undefined;
  const ultima = itens.reduce((data, e) => e.data > data ? e.data : data, "");
  const recentes = itens.filter(e => e.data === ultima);
  const assinaturas = new Set(recentes.map(e => JSON.stringify([e.sistema, e.edicao, e.prefixo, e.T, e.N, e.M, e.grupo])));
  return assinaturas.size === 1 ? recentes[0] : undefined;
}

/** Só fatos do lote selecionado. Ausência nunca herda diagnóstico de outro lote. */
export function montarPropsFlash(visao: ConsultaVisao, _chart: CabecalhoChart | null,
  aoFinalizar: ConsultaFlashProps["aoFinalizar"], aoSalvarRascunho: ConsultaFlashProps["aoSalvarRascunho"]): ConsultaFlashProps {
  const lote = visao.cabecalho.lotes.find(l => l.tumorLotId === (visao.tumorLotId ?? visao.cabecalho.loteSelecionadoId));
  const texto = (d?: {campo: string; valor: string | null}) => d?.campo === "PRESENTE" ? d.valor ?? undefined : undefined;
  const est = selecionarEstadiamentoFlash(lote?.estadiamentos ?? []);
  const dx = texto(lote?.topografia) ?? texto(lote?.histologia);
  const tnm = est ? `${est.prefixo ?? ""}${est.T ?? "?"}${est.N ?? "?"}${est.M ?? "?"}` : undefined;
  const f = visao.flash;
  const ciclo = f?.cicloAtual == null ? undefined : `${String(f.cicloAtual).padStart(2,"0")}/${f.ciclosPrevistos == null ? "?" : String(f.ciclosPrevistos).padStart(2,"0")}`;
  return {
    pacienteNome: visao.cabecalho.paciente.nome, hoje: visao.hoje,
    cabecalho: {
      ...(dx ? {diagnostico: dx} : {}), ...(tnm ? {tnm} : {}), ...(est?.grupo ? {estadio: est.grupo} : {}),
      ...(f?.protocolo ? {tratamentoAtual: f.protocolo} : {}), ...(ciclo ? {cicloDia: ciclo} : {}),
      ...(f?.ultimoAdministrado ? {ultimoAdministrado: f.ultimoAdministrado} : {}), ...(f?.alergia ? {alergia: f.alergia} : {}),
    },
    exames: f?.exames ?? [], laboratorios: f?.laboratorios ?? [], toxicidades: f?.toxicidades ?? [],
    avisos:f?.avisos ?? [], sugestoesLaboratorio:f?.sugestoesLaboratorio ?? [],
    ...(f?.parciaisCumulativos?.length ? {parciaisCumulativos:f.parciaisCumulativos} : {}),
    ...(f?.rascunho?.plano ? {planoInicial: f.rascunho.plano} : {}),
    ...(f?.modeloSolicitacoes ? {modeloSolicitacoes:f.modeloSolicitacoes} : {}),
    acoesHoje: [], receitas: [],
    apac: {cid: texto(lote?.cid) ?? "", sigtap: "", finalidade: "", competencia: "", estado: "PENDENTE", pendencias: []},
    iaFala: [], retorno: {dias: f?.retornoDias ?? null, examesAntesDoRetorno: []},
    aoSalvarRascunho, aoFinalizar,
  };
}
