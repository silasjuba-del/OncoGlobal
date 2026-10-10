import { Apac, type Apac as ApacTipo } from "../contracts/operacao.js";
import type { TumorLot } from "../contracts/clinico.js";

export interface PrescricaoAssinada {
  apacId: string;
  documentId: string;
  documentVersion: number;
  revisao: "ASSINADO";
  competencia: string;
  /** Fields are transported 1:1, not inferred from prose or clinical intent. */
  campos: Record<string, unknown>;
}

/** FN-10. Pure draft only: release/issuance requires a separate gateway action. */
export function apacGerar(prescricaoAssinada: PrescricaoAssinada, tumorLot: TumorLot, hoje: string): ApacTipo {
  if (prescricaoAssinada.revisao !== "ASSINADO") throw new Error("PRESCRICAO_NAO_ASSINADA");
  const { finalidadeApac } = tumorLot;
  const finalidade = finalidadeApac.campo === "PRESENTE" && finalidadeApac.revisao === "CONFIRMADO"
    || finalidadeApac.campo === "PRESENTE" && finalidadeApac.revisao === "ASSINADO"
    ? finalidadeApac : {
      valor: null, estado: "PENDENTE" as const, campo: "NAO_INFORMADO" as const,
      motivo: "Finalidade APAC depende de escolha humana",
      fontes: [], revisao: "REVISAR" as const,
    };
  // Avoid ever accepting an APAC purpose smuggled in from prescription intent.
  const { finalidadeApac: _ignorada, intencao: _intencao, ...campos } = prescricaoAssinada.campos;
  return Apac.parse({
    apacId: prescricaoAssinada.apacId, tumorLotId: tumorLot.tumorLotId,
    prescricaoAssinadaRef: { documentId: prescricaoAssinada.documentId,
      documentVersion: prescricaoAssinada.documentVersion },
    dataGeracaoApp: hoje, competencia: prescricaoAssinada.competencia,
    campos: { ...campos, finalidadeApac: finalidade }, estado: "RASCUNHO",
    resultadoExterno: null, versao: 1, substituiApacId: null,
  });
}

export interface ValidacaoEmissao {
  podeEmitir: boolean;
  camposFaltantes: string[];
  apac: ApacTipo;
  /** Administrative failure only blocks the document, never the consultation. */
  documento: "PRONTO" | "BLOQUEADO";
}
export function validarEmissaoApac(apac: ApacTipo, camposObrigatorios: readonly string[]): ValidacaoEmissao {
  const valid = Apac.parse(apac);
  const faltantes = camposObrigatorios.filter((campo) => {
    const value = valid.campos[campo];
    if (value == null || value === "") return true;
    if (typeof value === "object" && "campo" in value && "valor" in value) {
      const dado = value as { campo: unknown; valor: unknown };
      return dado.campo !== "PRESENTE" || dado.valor == null;
    }
    return false;
  });
  // Never reissue/erase a negative or an externally authorized APAC.
  const podeEmitir = valid.estado === "RASCUNHO" && faltantes.length === 0;
  return { podeEmitir, camposFaltantes: faltantes, apac: valid,
    documento: podeEmitir ? "PRONTO" : "BLOQUEADO" };
}

function diasCivis(inicio: string, fim: string): number {
  const start = Date.parse(`${inicio}T00:00:00.000Z`);
  const end = Date.parse(`${fim}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || new Date(start).toISOString().slice(0, 10) !== inicio
    || new Date(end).toISOString().slice(0, 10) !== fim) throw new Error("DATA_INVALIDA");
  return Math.round((end - start) / 86_400_000);
}
export interface ResultadoPrazo {
  dias: number;
  aviso: boolean;
  estado: "RASCUNHO" | "VENCIDA";
  faturamentoPodeEmitir: boolean;
  consultaSegue: true;
}
/** FN-12. Day thresholds are administrative decisions Q20/Q35, never a clinical cutoff. */
export function apacPrazo(dataGeracao: string, hoje: string, ultimoAvisoEm: string | null): ResultadoPrazo {
  const dias = diasCivis(dataGeracao, hoje);
  // F0-COMPLEMENTO corrige aviso perdido D90+.
  return { dias, aviso: dias >= 85 && ultimoAvisoEm === null,
    estado: dias >= 90 ? "VENCIDA" : "RASCUNHO",
    faturamentoPodeEmitir: dias >= 0 && dias < 90, consultaSegue: true };
}

export type CodigoNegativa = "ESTADIO_AUSENTE" | "HISTOLOGIA_AUSENTE"
  | "TOPOGRAFIA_AUSENTE" | "CID_AUSENTE" | "OUTRO";
export interface MotivoNegativa {
  codigo: CodigoNegativa;
  comprovanteRef: string;
  apacId: string;
}
export interface PendenciaRetrograda {
  apacId: string;
  comprovanteRef: string;
  campoOrigem: "estadiamentos" | "histologia" | "topografia" | "cid" | null;
  estado: "PENDENTE";
}
/** FN-13. Only typed external denial codes may identify the clinical source field. */
export function apacRetrograda(motivoNegativa: MotivoNegativa): PendenciaRetrograda {
  const mapa: Record<CodigoNegativa, PendenciaRetrograda["campoOrigem"]> = {
    ESTADIO_AUSENTE: "estadiamentos", HISTOLOGIA_AUSENTE: "histologia",
    TOPOGRAFIA_AUSENTE: "topografia", CID_AUSENTE: "cid", OUTRO: null,
  };
  if (!motivoNegativa.comprovanteRef) throw new Error("NEGATIVA_SEM_COMPROVANTE");
  return { apacId: motivoNegativa.apacId, comprovanteRef: motivoNegativa.comprovanteRef,
    campoOrigem: mapa[motivoNegativa.codigo] ?? null, estado: "PENDENTE" };
}
