import type { DatabaseSync } from "node:sqlite";
import type { ActionIntent } from "../contracts/operacao.js";
import type { z } from "zod";
import { listarEventos } from "../kernel/ledger/ledger.js";
import { eventosVigentes } from "../kernel/projections/snapshot.js";

type Intent = z.infer<typeof ActionIntent>;
export type Autorizacao = { ok: true } | { ok: false; codigo: string };

/**
 * CP-001 · O cliente PEDE; o ledger PROVA. Antes do gateway, a saída externa só passa se o
 * próprio servidor encontrar o artefato ASSINADO, vigente (não substituído), do mesmo
 * paciente/encontro, na versão pedida. Reavaliado a cada chamada, inclusive replay.
 */
export function autorizarSaida(db: DatabaseSync, intent: Intent): Autorizacao {
  if (intent.verbo === "BACKUP_LOCAL")
    return intent.objeto.tipo === "BACKUP" && intent.destino === null ? { ok: true } : { ok: false, codigo: "BACKUP_INVALIDO" };
  // A10/G-02: canal externo exige contato vinculado e consentimento persistidos; ainda não existem.
  if (intent.verbo === "ENVIAR_WHATSAPP" || intent.verbo === "ENVIAR_EMAIL" || intent.verbo === "AGENDAR")
    return { ok: false, codigo: "CANAL_EXTERNO_NAO_HABILITADO" };
  if (intent.destino !== null) return { ok: false, codigo: "DESTINO_NAO_PERMITIDO" };
  const { patientId, encounterId } = intent.escopo;
  if (!patientId) return { ok: false, codigo: "ESCOPO_SEM_PACIENTE" };
  const assinado = eventosVigentes(listarEventos(db, patientId)).find((e) => {
    if (e.revisao !== "ASSINADO" || e.encounterId !== encounterId) return false;
    // writeRouter guarda { reviewDecisionId, data: { data, signature } } (ver rotas.confirmarBloco).
    type Sig = { documentId?: unknown; documentVersion?: unknown };
    const sig = (e.payload as { data?: { signature?: Sig } } | null)?.data?.signature;
    return sig?.documentId === intent.objeto.id && sig.documentVersion === intent.objeto.versao;
  });
  if (!assinado) return { ok: false, codigo: "ARTEFATO_NAO_ASSINADO" };
  // Validação de emissão APAC ainda não é persistida no ledger (pendência CP-001b): contenção explícita.
  if (intent.verbo === "EXPORTAR_APAC") return { ok: false, codigo: "VALIDACAO_APAC_NAO_PERSISTIDA" };
  return { ok: true };
}
