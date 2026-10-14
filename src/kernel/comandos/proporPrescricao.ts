import type { DatabaseSync } from "node:sqlite";
import { Sessao } from "../../contracts/base.js";
import { PrescricaoProposta } from "../../contracts/f1/prescricaoProposta.js";
import { hashCanonico } from "../../modules/hash.js";
import { lerDraft, salvarDraft } from "../ledger/drafts.js";
import { transacao } from "../ledger/db.js";
import { gravarEstimulo } from "../orquestracao/estimulos/gravar.js";

/** Proposta local: somente rascunho tipado. Não cria ato clínico, assinatura ou administração. */
export function proporPrescricao(db: DatabaseSync, entrada: PrescricaoProposta, sessao: Sessao, em: string, expectedRevision: number | null) {
  const s = Sessao.parse(sessao), p = PrescricaoProposta.parse(entrada), t = Date.parse(em);
  if (!Number.isFinite(t) || Date.parse(s.emitidaEm) > t || Date.parse(s.expiraEm) <= t)
    throw Error("SESSAO_INVALIDA");
  if (expectedRevision !== null && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0))
    throw Error("REVISAO_PROPOSTA_CONFLITANTE");
  if (p.correlacao.proposta?.id !== p.id || p.correlacao.proposta.revisao !== p.revisao)
    throw Error("CORRELACAO_PROPOSTA_DIVERGENTE");
  return transacao(db, () => {
    const antigo = lerDraft(db, p.id);
    if (antigo) {
      const anterior = PrescricaoProposta.safeParse(antigo.payload);
      if (!anterior.success || antigo.patientId !== p.correlacao.patientId
        || anterior.data.correlacao.patientId !== p.correlacao.patientId
        || anterior.data.correlacao.encounterId !== p.correlacao.encounterId
        || anterior.data.correlacao.tumorLotId !== p.correlacao.tumorLotId)
        throw Error("CONTEXTO_PROPOSTA_DIVERGENTE");
      // Exact content replay does not create another draft revision or stimulus.
      if (hashCanonico(anterior.data) === hashCanonico(p)) return antigo;
    }
    if ((antigo?.revision ?? null) !== expectedRevision) throw Error("REVISAO_PROPOSTA_CONFLITANTE");
    const revision = antigo ? antigo.revision + 1 : 0;
    const salvo = salvarDraft(db, { draftId: p.id, patientId: p.correlacao.patientId,
      sourceId: "proposta-medica-local", rawRef: "proposta-local", payload: p,
      diagnostics: ["REVISAO_MEDICA_OBRIGATORIA"], revision, criadoEm: em });
    gravarEstimulo(db, { schema: "EstimuloTecnico@1", id: `proposta:${p.id}:${p.revisao}`,
      operationId: p.correlacao.operationId, tipo: "PRESCRICAO_PROPOSTA",
      patientId: p.correlacao.patientId, encounterId: p.correlacao.encounterId,
      tumorLotId: p.correlacao.tumorLotId, revisaoEntrada: p.correlacao.revisaoFatos,
      criadoEm: em, ator: "SISTEMA" });
    return salvo;
  });
}
