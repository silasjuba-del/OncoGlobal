import type { CabecalhoChart } from "../oncochart/chart-visao.js";
import type { ConsultaVisao } from "../api/porta.js";
import type { ConsultaFlashProps } from "./ConsultaFlash.js";
import type { ConsultaIntegrada } from "../api/respostas.js";
import { fatosConfirmadosFlash } from "./fatosConfirmadosFlash.js";

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
export function montarPropsFlash(visao: ConsultaIntegrada, _chart: CabecalhoChart | null,
  aoFinalizar: ConsultaFlashProps["aoFinalizar"], aoSalvarRascunho: ConsultaFlashProps["aoSalvarRascunho"]): ConsultaFlashProps {
  const lote = visao.tumorLotId === null ? undefined
    : visao.cabecalho.lotes.find(l => l.tumorLotId === visao.tumorLotId && l.patientId === visao.patientId);
  const texto = (d?: {campo: string; valor: string | null}) => d?.campo === "PRESENTE" ? d.valor ?? undefined : undefined;
  const est = selecionarEstadiamentoFlash(lote?.estadiamentos ?? []);
  const dx = texto(lote?.topografia) ?? texto(lote?.histologia);
  const tnm = est ? `${est.prefixo ?? ""}${est.T ?? "?"}${est.N ?? "?"}${est.M ?? "?"}` : undefined;
  const f = visao.flash;
  const qualificadas = visao.evidencias.filter(e => ["CONFIRMADO", "ASSINADO"].includes(e.revisao));
  const formatar = (e: typeof qualificadas[number]) => `${e.rotulo}: ${e.campo === "CONFLITO" ? "A CONFERIR" : e.campo === "PRESENTE" ? e.valorTexto ?? "PENDENTE" : "PENDENTE"} (${e.fontes.map(f => `${f.sourceId} · ${f.dataClinica ?? "data não informada"}`).join("; ") || "fonte não informada"})`;
  const ecog = qualificadas.filter(e => /^(ECOG|Performance status ECOG)$/i.test(e.rotulo));
  const biomarcadores = qualificadas.filter(e => /biomarcador|pd-?l1/i.test(e.rotulo));
  const confirmados = fatosConfirmadosFlash({ ...visao, diagnostico: dx,
    conflitoCabecalho: [lote?.topografia, lote?.histologia].some(d => d?.campo === "CONFLITO"),
    laboratorios: f?.laboratorios ?? [] });
  const ciclo = f?.cicloAtual == null ? undefined : `${String(f.cicloAtual).padStart(2,"0")}/${f.ciclosPrevistos == null ? "?" : String(f.ciclosPrevistos).padStart(2,"0")}`;
  return {
    pacienteNome: visao.cabecalho.paciente.nome, hoje: visao.hoje,
    cabecalho: {
      ...(ecog.length ? { ecog: ecog.map(formatar).join("; ") } : {}),
      ...(biomarcadores.length ? { biomarcador: biomarcadores.map(formatar).join("; ") } : {}),
      ...(visao.cabecalho.episodio ? { linha: String(visao.cabecalho.episodio.linha) } : {}),
      ...(visao.cabecalho.comorbidadesPaciente.length ? { antecedentes: visao.cabecalho.comorbidadesPaciente.join("; ") } : {}),
      ...(visao.medicamentosAtuais?.conflito ? { medicacoesUso: "A CONFERIR: informações conflitantes" }
        : visao.medicamentosAtuais?.medicamentos.length ? { medicacoesUso: visao.medicamentosAtuais.medicamentos.join("; ") } : {}),
      ...(confirmados.diagnostico ? {diagnostico: confirmados.diagnostico} : {}), ...(tnm ? {tnm} : {}), ...(est?.grupo ? {estadio: est.grupo} : {}),
      ...(f?.protocolo ? {tratamentoAtual: f.protocolo} : {}), ...(ciclo ? {cicloDia: ciclo} : {}),
      ...(f?.ultimoAdministrado ? {ultimoAdministrado: f.ultimoAdministrado} : {}), ...(f?.alergia ? {alergia: f.alergia} : {}),
    },
    exames: f?.exames ?? [], laboratorios: confirmados.laboratorios, toxicidades: f?.toxicidades ?? [],
    avisos:[...(f?.avisos ?? []), ...confirmados.avisos], sugestoesLaboratorio:f?.sugestoesLaboratorio ?? [],
    ...(f?.parciaisCumulativos?.length ? {parciaisCumulativos:f.parciaisCumulativos} : {}),
    ...(f?.sugestoesClinicas?.length ? {sugestoesClinicas:f.sugestoesClinicas} : {}),
    ...(f?.rascunho?.plano ? {planoInicial: f.rascunho.plano} : {}),
    ...(f?.modeloSolicitacoes ? {modeloSolicitacoes:f.modeloSolicitacoes} : {}),
    acoesHoje: [], receitas: [],
    apac: {cid: texto(lote?.cid) ?? "", sigtap: "", finalidade: "", competencia: "", estado: "PENDENTE", pendencias: []},
    iaFala: [], retorno: {dias: f?.retornoDias ?? null, examesAntesDoRetorno: []},
    aoSalvarRascunho, aoFinalizar,
  };
}
