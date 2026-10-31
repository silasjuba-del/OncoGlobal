import type { ServidorDeps } from "./rotas.js";
import type { OperacaoSetorialF6 } from "../contracts/f6/multiusuarioSetores.js";
import { verificarEAuditarAcessoSetorialF6 } from "./f6MultiusuarioSetores.js";
import { hashConteudoExibido } from "./sessao.js";

/** O login atual é médico/CRM. Nenhum papel ou vínculo alegado pelo browser é utilizado. */
export function auditarAcessoMedico(deps: ServidorDeps, token: string, operacao: OperacaoSetorialF6) {
  const s = deps.sessoes.obter(token);
  return verificarEAuditarAcessoSetorialF6(deps.db, {
    sessaoCandidata: s ? { sessaoId: hashConteudoExibido([s.medicoId, s.emitidaEm]), profissionalId: s.medicoId,
      papel: "MEDICO", setor: "MEDICO", registroConselho: s.crm, territorio: "WORK", emitidaEm: s.emitidaEm, expiraEm: s.expiraEm } : null,
    operacao, agora: deps.agora(),
  });
}
