import { z } from "zod";
import { DataCivil } from "../base.js";
import { ESTATISTICA_VERSAO } from "./estatisticaVersao.js";

const Categorias = z.object({ FATO: z.number().int().nonnegative(), DOCUMENTO: z.number().int().nonnegative(),
  ADMINISTRACAO: z.number().int().nonnegative(), OUTRO: z.number().int().nonnegative() }).strict();
const StatusAdministracao = z.object({ COMPLETA: z.number().int().nonnegative(), PARCIAL: z.number().int().nonnegative(),
  OMITIDA: z.number().int().nonnegative(), INTERROMPIDA: z.number().int().nonnegative() }).strict();

/** Contrato exato da projeção derivada; não inclui métricas que o ledger não retorna. */
export const EstatisticaServicoResposta = z.object({
  versao: z.literal(ESTATISTICA_VERSAO),
  escopo: z.enum(["LEDGER_COMPLETO", "PERIODO_CLINICO"]),
  periodoClinico: z.object({ inicio: DataCivil, fim: DataCivil }).strict().nullable(),
  denominadorPacientes: z.number().int().nonnegative(),
  exclusoes: z.object({
    eventosNaoConfirmados: z.number().int().nonnegative(),
    eventosSupersedidos: z.number().int().nonnegative(),
    linhasDuplicadas: z.number().int().nonnegative(),
    administracoesInvalidas: z.number().int().nonnegative(),
    administracoesConflito: z.number().int().nonnegative(),
    eventosSemDataClinica: z.number().int().nonnegative(),
    eventosDataClinicaInvalida: z.number().int().nonnegative(),
    eventosForaPeriodo: z.number().int().nonnegative(),
  }).strict(),
  totalPacientes: z.number().int().nonnegative(),
  eventosPorCategoria: Categorias,
  pacientesPorCategoria: Categorias,
  documentosAssinados: z.number().int().nonnegative(),
  pacientesComDocumentoAssinado: z.number().int().nonnegative(),
  administracoesPorStatus: StatusAdministracao,
  pacientesPorStatusDeAdministracao: StatusAdministracao,
  administracoesPendentes: z.number().int().nonnegative(),
  administracoesConflito: z.number().int().nonnegative(),
}).strict().superRefine((dados, contexto) => {
  if (dados.totalPacientes !== dados.denominadorPacientes)
    contexto.addIssue({ code: "custom", path: ["totalPacientes"], message: "TOTAL_DENOMINADOR_DIVERGENTE" });
  if (dados.pacientesComDocumentoAssinado > dados.denominadorPacientes)
    contexto.addIssue({ code: "custom", path: ["pacientesComDocumentoAssinado"], message: "COBERTURA_FORA_DO_DENOMINADOR" });
  if (dados.administracoesConflito !== dados.exclusoes.administracoesConflito
    || dados.administracoesConflito > dados.administracoesPendentes)
    contexto.addIssue({ code: "custom", path: ["administracoesConflito"], message: "CONFLITO_DE_ADMINISTRACAO_DIVERGENTE" });
  if ((dados.escopo === "LEDGER_COMPLETO") !== (dados.periodoClinico === null))
    contexto.addIssue({ code: "custom", path: ["periodoClinico"], message: "ESCOPO_PERIODO_DIVERGENTE" });
  if (dados.periodoClinico && dados.periodoClinico.inicio > dados.periodoClinico.fim)
    contexto.addIssue({ code: "custom", path: ["periodoClinico"], message: "PERIODO_CLINICO_INVALIDO" });
  for (const categoria of ["FATO", "DOCUMENTO", "ADMINISTRACAO", "OUTRO"] as const) {
    if (dados.pacientesPorCategoria[categoria] > dados.denominadorPacientes)
      contexto.addIssue({ code: "custom", path: ["pacientesPorCategoria", categoria], message: "CATEGORIA_FORA_DO_DENOMINADOR" });
  }
  for (const status of ["COMPLETA", "PARCIAL", "OMITIDA", "INTERROMPIDA"] as const) {
    if (dados.pacientesPorStatusDeAdministracao[status] > dados.denominadorPacientes)
      contexto.addIssue({ code: "custom", path: ["pacientesPorStatusDeAdministracao", status], message: "STATUS_FORA_DO_DENOMINADOR" });
  }
});

export type VisaoEstatisticaServico = z.infer<typeof EstatisticaServicoResposta>;
export type PeriodoClinicoEstatisticaServico = NonNullable<VisaoEstatisticaServico["periodoClinico"]>;
