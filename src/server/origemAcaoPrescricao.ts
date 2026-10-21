import { z } from "zod";
import type { DatabaseSync } from "node:sqlite";
import { ContextoAcaoComposta, PedidoAcaoComposta } from "../contracts/api/acoesCompostas.js";
import { AcaoCompostaPreparada } from "../contracts/api/execucaoAcaoComposta.js";
import type { BasePrescricaoExecutavelResposta, EdicaoPrescricaoExecutavel } from "../contracts/api/operacaoPrescricaoExecutavel.js";
import { lerDraft } from "../kernel/comandos/portas.js";
import { edicaoDaAcao } from "../modules/prescricao/acaoParaPrescricao.js";
import { prepararAcaoComposta } from "../rules/prescricao/acoesCompostas.js";
import { lerBaseAcaoComposta } from "./acoesCompostas.js";
import { hashConteudoExibido as hash } from "./sessao.js";

const Registro = z.object({
  kind: z.literal("ACAO_COMPOSTA_RASCUNHO"), contexto: ContextoAcaoComposta,
  atorId: z.string().min(1), pedido: PedidoAcaoComposta, requestHash: z.string(),
  resposta: AcaoCompostaPreparada,
}).strict();

/** Resolves a persisted clinical intention; it cannot promote it or authorize administration. */
export function validarOrigemAcao(db: DatabaseSync, edicao: EdicaoPrescricaoExecutavel,
  base: BasePrescricaoExecutavelResposta, atorId: string, em: string): { codigo: string | null; avisos: string[] } {
  const recusar = (codigo: string) => ({ codigo, avisos: [] });
  const pointer = edicao.origemProposta;
  if (!pointer) return recusar("ORIGEM_ACAO_AUSENTE");
  const draft = lerDraft(db, pointer.draftId), p = Registro.safeParse(draft?.payload);
  if (!draft || !p.success || draft.patientId !== base.contexto.patientId
    || draft.revision !== pointer.revision || p.data.resposta.revision !== pointer.revision
    || p.data.resposta.draftId !== draft.draftId) return recusar("ORIGEM_ACAO_INVALIDA");
  const r = p.data;
  if (r.atorId !== atorId || hash(r.contexto) !== hash(base.contexto)) return recusar("ORIGEM_ACAO_FORA_DO_CONTEXTO");
  const { resultado, documentoPlano } = r.resposta;
  const digest = hash({ contexto: r.contexto, atorId: r.atorId, pedido: r.pedido, resultado, documentoPlano });
  if (pointer.hash !== digest || r.resposta.conteudoHash !== digest) return recusar("ORIGEM_ACAO_INVALIDA");
  const atual = lerBaseAcaoComposta(db, base.contexto, em);
  if (!atual.base || atual.pendencias.length || resultado.baseHash !== atual.base.baseHash
    || hash(prepararAcaoComposta(atual.base, r.pedido)) !== hash(resultado))
    return recusar("ORIGEM_ACAO_BASE_ALTERADA");
  const proposta = edicaoDaAcao(base, r.resposta);
  if (!proposta.edicao) return recusar("ORIGEM_ACAO_PENDENTE");
  // Pharmacy routing is an independent explicit choice, not part of the proposed clinical change.
  const { encaminharFarmacia: _envio, ...recebida } = edicao;
  const { encaminharFarmacia: _proposto, ...esperada } = proposta.edicao;
  if (hash(recebida) !== hash(esperada)) return recusar("ORIGEM_ACAO_EDICAO_ALTERADA");
  return { codigo: null, avisos: ["Ação composta vinculada à prescrição anterior. Confira o diff e o motivo antes de assinar."] };
}
