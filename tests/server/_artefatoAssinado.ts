import type { DatabaseSync } from "node:sqlite";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import {hashCanonico} from '../../src/rules/conteudoCanonico.js';

/** Grava um artefato sintético ASSINADO pelo mesmo caminho do servidor (draft → confirmar). */
export function artefatoAssinado(db: DatabaseSync, o: { patientId: string; encounterId: string; documentId: string;
  versao?: number; em?: string }): void {
  const em = o.em ?? "2026-10-05T12:00:00.000Z", versao = o.versao ?? 1, draftId = `draft-${o.documentId}-${versao}`;
  const data={documentId:o.documentId,documentVersion:versao,texto:'documento sintético'};
  salvarDraft(db, { draftId, patientId: o.patientId, sourceId: "sintetico", rawRef: "opaco", diagnostics: [],
    revision: 0, criadoEm: em, payload: { documentId: o.documentId, documentVersion: versao } });
  confirmar(db, { operationId: `op-assina-${o.documentId}-${versao}`, patientId: o.patientId, tumorLotId: null,
    encounterId: o.encounterId, reviewDecisionId: "revisao-sintetica", em,
    sessao: { medicoId: "medico-teste", crm: "CRM-TESTE", emitidaEm: em, expiraEm: "2099-01-01T00:00:00.000Z" },
    registros: [{ draftId, expectedRevision: 0, eventId: `ev-assina-${o.documentId}-${versao}`, tipo: "DOCUMENTO",
      payload: { data, signature: { documentId: o.documentId, documentVersion: versao,
        documentHash: hashCanonico(data), reviewDecisionId: "revisao-sintetica", serverActorId: "medico-teste" } },
      fontes: [], revisao: "ASSINADO" }] });
}
