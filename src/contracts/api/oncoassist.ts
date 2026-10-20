import { z } from "zod";

export const MotivoConfigOncoassist = z.enum(["DESABILITADO", "CHAVE_AUSENTE"]);
export const CodigoRespostaOncoassist = z.enum([
  "DESABILITADO", "CHAVE_AUSENTE", "DICIONARIO_AUSENTE", "ENTRADA_INVALIDA", "SEM_MARCADORES",
  "PHI_RESIDUAL", "RESPOSTA_INVALIDA", "PROVEDOR_INDISPONIVEL", "TIMEOUT", "CANCELADO",
]);

export const EstadoOncoassist = z.object({
  status: z.enum(["DISPONIVEL", "PENDENTE"]),
  motivo: z.string().optional(),
});
export const FontesOncoassist = z.object({ fontes: z.array(z.object({
  draftId: z.string(), rotulo: z.string(), criadoEm: z.string(),
})), fontesSemVinculo: z.array(z.object({ draftId: z.string(), sourceId: z.string(),
  segmentId: z.string().nullable(), exceptionId: z.string().nullable(), rotulo: z.string(), criadoEm: z.string(), revision: z.number().int().nonnegative(),
  textoOriginal: z.string() })).default([]) });
/** Proveniência documental capturada pelo servidor; nunca equivale a revisão clínica. */
export const AuditoriaOncoassist = z.object({
  propostaId: z.string(), operationId: z.string(),
  patientId: z.string(), encounterId: z.string(), tumorLotId: z.string().nullable(),
  draftId: z.string(), segmentId: z.string(), sourceId: z.string(),
  fonteRevision: z.number().int().nonnegative(), fonteSha256: z.string(), fontePayloadHash: z.string(),
  propostaRevision: z.number().int().positive(), politicaVersao: z.string(),
  mecanismo: z.literal("JEV_MARCADORES_DOCUMENTAIS"), provedor: z.string().nullable(),
  capturadoPor: z.object({ tipo: z.literal("SESSAO"), id: z.string() }), capturadoEm: z.string(),
  revisaoObrigatoria: z.literal(true),
});
export const RespostaOncoassist = z.discriminatedUnion("status", [
  z.object({ status: z.literal("PROPOSTA"), revisaoObrigatoria: z.literal(true),
    fonte: z.object({ id: z.string(), sha256: z.string() }),
    categoria: z.enum(["LAB", "RADS", "PATH", "NOTA", "OUTRO", "INDETERMINADO"]),
    modelo: z.string().optional(), confianca: z.number().optional(),
    probabilidades: z.record(z.string(), z.number()).optional(), auditoria: AuditoriaOncoassist.optional(),
  }),
  z.object({ status: z.enum(["PENDENTE", "ERRO"]), codigo: z.string().min(1), auditoria: AuditoriaOncoassist.optional() }),
]);
export const ValidadePoliticaOncoassist = z.enum(["MESMA_VERSAO", "VERSAO_DIFERENTE", "NAO_VERIFICAVEL"]);
export const HistoricoOncoassist = z.object({ propostas: z.array(z.object({
  auditoria: AuditoriaOncoassist, estado: z.enum(["PENDENTE", "CONCLUIDA"]),
  validade: z.enum(["ATUAL", "FONTE_ALTERADA"]), validadePolitica: ValidadePoliticaOncoassist.optional(),
  resposta: RespostaOncoassist.nullable(),
})) });
export type HistoricoOncoassist = z.infer<typeof HistoricoOncoassist>;
export type AuditoriaOncoassist = z.infer<typeof AuditoriaOncoassist>;

export type MotivoConfigOncoassist = z.infer<typeof MotivoConfigOncoassist>;
export type CodigoRespostaOncoassist = z.infer<typeof CodigoRespostaOncoassist>;
export type EstadoOncoassist = z.infer<typeof EstadoOncoassist>;
export type FontesOncoassist = z.infer<typeof FontesOncoassist>;
export type RespostaOncoassist = z.infer<typeof RespostaOncoassist>;

const nomesCategoria = {
  LAB: "Laboratório", RADS: "Imagem", PATH: "Anatomia patológica",
  NOTA: "Nota clínica", OUTRO: "Outro documento", INDETERMINADO: "Classificação indeterminada",
} as const;

/** Estado operacional da interface; não é resultado clínico nem confirmação de prontuário. */
export type EstadoOperacionalOncoassist =
  | "CONSULTANDO" | "CONFIGURACAO" | "CAPACIDADE_PENDENTE" | "FONTE_AUSENTE" | "VINCULO_PENDENTE"
  | "PRONTO" | "EXECUTANDO" | "CANCELADO" | "SUCESSO_PROPOSTA" | "RESULTADO_TECNICO"
  | "CONTEXTO_ALTERADO" | "FALHA_CONSULTA";

export function classificarCapacidade(estado: EstadoOncoassist | null, portaDisponivel: boolean): EstadoOperacionalOncoassist {
  if (!portaDisponivel || estado?.status === "PENDENTE") return portaDisponivel ? "CAPACIDADE_PENDENTE" : "CONFIGURACAO";
  if (!estado) return "CONSULTANDO";
  return estado.status === "DISPONIVEL" ? "PRONTO" : "CAPACIDADE_PENDENTE";
}

export function classificarFontes(fontes: FontesOncoassist["fontes"], semVinculo: FontesOncoassist["fontesSemVinculo"]): EstadoOperacionalOncoassist | null {
  if (fontes.length > 0) return null;
  return semVinculo.length > 0 ? "VINCULO_PENDENTE" : "FONTE_AUSENTE";
}

export function mensagemCapacidade(estado: EstadoOperacionalOncoassist, motivo?: string): string {
  if (estado === "CONFIGURACAO") return "Organização de documentos aguardando configuração.";
  if (estado === "CAPACIDADE_PENDENTE") {
    if (motivo === "CHAVE_AUSENTE") {
      return "Classificação documental aguardando credencial local do provedor.";
    }
    if (motivo === "DESABILITADO") {
      return "Classificação documental desligada neste ambiente.";
    }
    return "Classificação documental indisponível no momento (motivo não informado).";
  }
  if (estado === "CONSULTANDO") return "Consultando disponibilidade…";
  if (estado === "FONTE_AUSENTE") return "Nenhum documento vinculado a esta consulta.";
  if (estado === "VINCULO_PENDENTE") return "Há trechos aguardando vínculo com o paciente antes da organização.";
  if (estado === "CONTEXTO_ALTERADO") return "A fonte ou a consulta mudou. Reabra a consulta para atualizar.";
  if (estado === "FALHA_CONSULTA") return "Não foi possível consultar o OncoAssist. Tente novamente.";
  if (estado === "EXECUTANDO") return "Organizando documento…";
  if (estado === "CANCELADO") return "Organização interrompida. O contexto da consulta foi preservado.";
  return "";
}

export function mensagemResultadoTecnico(resposta: RespostaOncoassist): string | null {
  if (resposta.status === "PROPOSTA") {
    return `${nomesCategoria[resposta.categoria]} — sugestão para revisão.`;
  }
  const conhecido = CodigoRespostaOncoassist.safeParse(resposta.codigo);
  if (!conhecido.success) {
    return "Classificação pendente. O documento foi preservado.";
  }
  const porCodigo: Record<CodigoRespostaOncoassist, string> = {
    DESABILITADO: "Classificação documental desligada neste ambiente.",
    CHAVE_AUSENTE: "Classificação documental aguardando credencial local do provedor.",
    DICIONARIO_AUSENTE: "Dados locais do paciente indisponíveis para desidentificação.",
    ENTRADA_INVALIDA: "Documento não atende aos requisitos mínimos para classificação.",
    SEM_MARCADORES: "Texto sem marcadores documentais reconhecidos; nenhuma categoria foi sugerida.",
    PHI_RESIDUAL: "Trecho ainda contém identificação; a classificação não foi enviada.",
    RESPOSTA_INVALIDA: "Resposta do classificador foi rejeitada; o documento foi preservado.",
    PROVEDOR_INDISPONIVEL: "Classificador indisponível no momento; tente novamente.",
    TIMEOUT: "A classificação expirou; o documento foi preservado.",
    CANCELADO: "Organização interrompida. O contexto da consulta foi preservado.",
  };
  return porCodigo[conhecido.data];
}

export function rotuloCategoria(resposta: RespostaOncoassist): string | null {
  return resposta.status === "PROPOSTA" ? nomesCategoria[resposta.categoria] : null;
}
