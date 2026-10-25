import type { DatabaseSync } from "node:sqlite";
import { Sessao } from "../../contracts/base.js";
import { validarPayloadEvento } from "../../contracts/envelope.js";
import { confirmar, type Confirmacao } from "../ledger/writeRouter.js";
import { lerDraft } from "../ledger/drafts.js";
import { validarProvenienciaConfirmacao } from "./proveniencia.js";
import { transacao } from "../ledger/db.js";

/** Única porta de confirmação: a sessão é resolvida pelo servidor, nunca pelo corpo HTTP. */
export function executarConfirmacao(db:DatabaseSync,req:Confirmacao) {
  return transacao(db,()=>confirmarValidado(db,req));
}
function confirmarValidado(db:DatabaseSync,req:Confirmacao) {
  // Autoriza no relógio atual da requisição; o instante histórico da operação não valida a sessão.
  const sessao=Sessao.safeParse(req.sessao), agora=Date.parse(req.autorizadoEm ?? req.em);
  if(!sessao.success || !Number.isFinite(agora) || Date.parse(sessao.data.emitidaEm)>agora || Date.parse(sessao.data.expiraEm)<=agora)
    throw new Error("SESSAO_INVALIDA");
  if(!req.patientId.trim() || !req.encounterId.trim()) throw new Error("CONTEXTO_EXPLICITO_OBRIGATORIO");
  for(const r of req.registros) {
    const valid=validarPayloadEvento(r.tipo,r.payload);
    if(!valid.ok) throw new Error(valid.motivo);
    const draft=lerDraft(db,r.draftId), o=draft?.payload;
    if(o && typeof o === "object" && !Array.isArray(o)) {
      const d=o as Record<string,unknown>,c=d.contexto && typeof d.contexto === "object" ? d.contexto as Record<string,unknown> : d;
      if(typeof c.encounterId === "string" && c.encounterId!==req.encounterId) throw new Error("DRAFT_ENCONTRO_DIVERGENTE");
      if(Object.hasOwn(c,"tumorLotId") && c.tumorLotId!==req.tumorLotId) throw new Error("DRAFT_LOTE_DIVERGENTE");
    }
  }
  validarProvenienciaConfirmacao(db,req);
  return confirmar(db,req);
}
export const registrarFato=executarConfirmacao;
export const confirmarBloco=executarConfirmacao;
export const assinarPrescricao=executarConfirmacao;
export const registrarAdministracao=executarConfirmacao;
export const registrarTarefa=executarConfirmacao;
export const vincularContato=executarConfirmacao;

export { proporPrescricao } from "./proporPrescricao.js";
