import type { CabecalhoChart } from "../oncochart/chart-visao.js";
import type { ConsultaVisao } from "../api/porta.js";
import type { ConsultaFlashProps, ItemFlash } from "./ConsultaFlash.js";

const item = (id: string, rotulo: string, preMarcado: boolean): ItemFlash => ({
  id,
  rotulo,
  origem: "MODELO_MEDICO",
  preMarcado,
});

/** Monta as props da Flash a partir da visão. Dado ausente fica ausente (PENDENTE na tela); nada é inventado. */
export function montarPropsFlash(
  visao: ConsultaVisao,
  chart: CabecalhoChart,
  aoFinalizar: ConsultaFlashProps["aoFinalizar"],
  aoSalvarRascunho: ConsultaFlashProps["aoSalvarRascunho"],
): ConsultaFlashProps {
  const d = chart.diagnostico;
  const f = visao.flash;
  const dx = d.titulo ?? d.histologia;
  const tnm = d.t ? `${d.tnmPrefixo ?? ""}${d.t}${d.n ?? ""}${d.m ?? ""}` : undefined;
  return {
    cabecalho: {
      ...(dx ? { diagnostico: dx } : {}),
      ...(tnm ? { tnm } : {}),
      ...(d.estadio ? { estadio: d.estadio } : {}),
      ...(d.ecog != null ? { ecog: String(d.ecog) } : {}),
    },
    exames: f?.exames ?? [],
    acoesHoje: [],
    receitas: [],
    apac: { cid: d.cid ?? "", sigtap: "", finalidade: "", competencia: "", estado: "PENDENTE", pendencias: [] },
    iaFala: [],
    retorno: { dias: f?.retornoDias ?? null, examesAntesDoRetorno: [] },
    linhaPontualizada: true,
    tarefasRetorno: {
      modeloPadraoSalvo: f?.modeloPadraoSalvo ?? false,
      retorno: item("retorno", "Retorno", true),
      laboratorio: item("laboratorio", "Laboratório", f?.laboratorioPreMarcado ?? false),
      imagem: item("imagem", "Imagem", f?.imagemPreMarcada ?? false),
    },
    aoSalvarRascunho,
    aoFinalizar,
  };
}
