import { z } from "zod";
import { InstanciarFichaPedidoSchema, InstanciacaoFichaRespostaSchema, type InstanciacaoFichaResposta } from "../contracts/api/fichasPrescricao.js";
import type { ContextoAcaoComposta } from "../contracts/api/acoesCompostas.js";
import type { EdicaoPrescricaoExecutavel } from "../contracts/api/operacaoPrescricaoExecutavel.js";
import type { OrigemPropostaPrescricaoExecutavel } from "../contracts/api/prescricaoExecutavel.js";
import { lerDraft, listarEventos, salvarDraft, transacao } from "../kernel/comandos/portas.js";
import type { criarMotorF1 } from "../kernel/orquestracao/runtime.js";
import { bsaMosteller, instanciarProtocolo } from "../rules/prescricao/instanciarProtocolo.js";
import { lerConsulta } from "./leituras.js";
import { baseAjusteAnterior } from "./f0c/baseAjusteAnterior.js";
import { hashConteudoExibido as hash } from "./sessao.js";
import { autenticarFichas, erroFicha, fichaAtual, recusarFicha, type DepsFichas, type RespostaFicha } from "./fichasPrescricao.js";

export interface DepsOrigemFicha extends DepsFichas { motorF1?: ReturnType<typeof criarMotorF1> }
const Registro = z.object({
  kind: z.literal("FICHA_PRESCRICAO_INSTANCIADA"), atorId: z.string(), requestHash: z.string(),
  resposta: InstanciacaoFichaRespostaSchema,
}).strict();
type RegistroOrigem = z.infer<typeof Registro>;
function hashOrigem(r: RegistroOrigem): string {
  const { hash: _hash, ...pointer } = r.resposta.origemProposta;
  return hash({ ...r, resposta: { ...r.resposta, origemProposta: pointer } });
}
function lerOrigem(deps: DepsOrigemFicha, pointer: OrigemPropostaPrescricaoExecutavel): RegistroOrigem {
  const draft = lerDraft(deps.db, pointer.draftId), p = Registro.safeParse(draft?.payload);
  if (!draft || !p.success || draft.patientId !== p.data.resposta.contexto.patientId
    || draft.revision !== pointer.revision || hash(p.data.resposta.origemProposta) !== hash(pointer)
    || p.data.resposta.origemProposta.draftId !== draft.draftId || hashOrigem(p.data) !== pointer.hash
    || hash(p.data.resposta.template) !== p.data.resposta.contentHash) throw new Error("ORIGEM_FICHA_INVALIDA");
  return p.data;
}
function revalidarOrigem(deps: DepsOrigemFicha, r: RegistroOrigem, contexto: ContextoAcaoComposta, atorId: string, em: string): void {
  if (r.atorId !== atorId || hash(r.resposta.contexto) !== hash(contexto)) throw new Error("ORIGEM_FICHA_FORA_DO_CONTEXTO");
  fichaAtual(deps, r.resposta.template.templateId, r.resposta.template.versao,
    r.resposta.contentHash, r.resposta.revisionFicha, true);
  if (!deps.motorF1 || deps.motorF1.retrato(contexto, undefined, undefined, em).revisao !== r.resposta.revisaoFatos)
    throw new Error("ORIGEM_FICHA_FATOS_ALTERADOS");
}
export function validarOrigemFicha(deps: DepsOrigemFicha, edicao: EdicaoPrescricaoExecutavel,
  contexto: ContextoAcaoComposta, atorId: string, em: string): { codigo: string | null; avisos: string[] } {
  try {
    if (!edicao.origemProposta) throw new Error("ORIGEM_FICHA_AUSENTE");
    const r = lerOrigem(deps, edicao.origemProposta);
    revalidarOrigem(deps, r, contexto, atorId, em);
    if (edicao.protocoloId !== r.resposta.template.nome) throw new Error("ORIGEM_FICHA_PROTOCOLO_ALTERADO");
    for (const atual of edicao.itens) {
      if (atual.item.source !== "PROTOCOL") continue;
      const original = r.resposta.itens.find(i => i.itemId === atual.itemId);
      const fixos = (i: typeof atual.item) => { const { observacao: _observacao, ...resto } = i; return resto; };
      if (!original || hash(fixos(original.item)) !== hash(fixos(atual.item))) throw new Error("ORIGEM_PROTOCOLO_ALTERADA");
    }
    return { codigo: null, avisos: r.resposta.avisos };
  } catch (error) {
    return { codigo: error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "ORIGEM_FICHA_INVALIDA", avisos: [] };
  }
}
export function instanciarFichaPrescricao(deps: DepsOrigemFicha, token: string, raw: unknown): RespostaFicha {
  const auth = autenticarFichas(deps, token);
  if (!auth) return recusarFicha("SESSAO_INVALIDA", 401);
  const p = InstanciarFichaPedidoSchema.safeParse(raw);
  if (!p.success) return recusarFicha("PAYLOAD_INVALIDO", 400);
  const { contexto } = p.data, selecionado = deps.sessoes.consultaSelecionada(token);
  if (!selecionado || selecionado.patientId !== contexto.patientId || selecionado.encounterId !== contexto.encounterId
    || (selecionado.tumorLotId ?? null) !== contexto.tumorLotId) return recusarFicha("CONTEXTO_CONSULTA_ALTERADO");
  if (!deps.motorF1) return recusarFicha("RETRATO_CLINICO_INDISPONIVEL");
  try {
    return transacao(deps.db, () => {
      const ficha = fichaAtual(deps, p.data.templateId, p.data.versao, p.data.expectedContentHash, p.data.expectedRevision, true);
      const draftId = `rx-ficha:${hash([auth.sessao.medicoId, contexto, p.data.idempotencyKey])}`;
      const requestHash = hash({ entrada: p.data, atorId: auth.sessao.medicoId });
      const anterior = lerDraft(deps.db, draftId);
      if (anterior) {
        const old = Registro.safeParse(anterior.payload);
        if (!old.success || old.data.requestHash !== requestHash) return recusarFicha("IDEMPOTENCIA_CONFLITO");
        const r = lerOrigem(deps, old.data.resposta.origemProposta);
        revalidarOrigem(deps, r, contexto, auth.sessao.medicoId, auth.em);
        return { status: 200, body: r.resposta };
      }
      const retrato = deps.motorF1!.retrato(contexto, undefined, undefined, auth.em);
      const consulta = lerConsulta(deps.db, contexto.patientId, auth.em, auth.sessao, contexto.tumorLotId, { encounterId: contexto.encounterId });
      if ("codigo" in consulta) return recusarFicha("DADOS_CLINICOS_INDISPONIVEIS");
      const medidos = consulta.avaliacaoClinica.dadosCorporais;
      const dadosCorporais = { ...medidos, bsaM2: medidos.bsaM2 ?? bsaMosteller(medidos.pesoKg, medidos.alturaCm) };
      // A aprovação local autoriza a cópia usada pelo cálculo; o original permanece intacto.
      const template = { ...ficha.template, status: "CONFERIDA_MEDICO" as const };
      const anteriores = baseAjusteAnterior(listarEventos(deps.db, contexto.patientId), contexto, template, auth.em);
      const calculo = instanciarProtocolo(template, dadosCorporais, anteriores.itens);
      if (!calculo.ok) return recusarFicha("FICHA_NAO_INSTANCIAVEL");
      const itens = calculo.itens.map((i, index) => ({ itemId: `item-ficha:${hash([draftId, index, i.item.sequence])}`, item: i.item }));
      const pendencias = calculo.itens.flatMap(i => i.motivo ? [`${i.item.drug}: ${i.motivo}`] : []);
      const avisos = calculo.itens.flatMap(i => i.aviso ? [`${i.item.drug}: ${i.aviso}`] : []);
      avisos.push("Cálculo proposto a partir da ficha conferida. Revise a indicação, os dados corporais, os exames e o preparo antes de assinar.");
      const resposta: InstanciacaoFichaResposta = InstanciacaoFichaRespostaSchema.parse({
        contexto, origemProposta: { draftId, revision: 0, hash: "0".repeat(64) },
        template: ficha.template, contentHash: ficha.contentHash, revisionFicha: ficha.revision,
        revisaoFatos: retrato.revisao, itens, pendencias, avisos, dadosCorporais,
      });
      const registro: RegistroOrigem = { kind: "FICHA_PRESCRICAO_INSTANCIADA", atorId: auth.sessao.medicoId, requestHash, resposta };
      resposta.origemProposta.hash = hashOrigem(registro);
      salvarDraft(deps.db, { draftId, patientId: contexto.patientId, sourceId: `ficha-fonte:${ficha.contentHash}`,
        rawRef: "referencia-local", payload: registro, revision: 0, criadoEm: auth.em, diagnostics: pendencias });
      return { status: 200, body: resposta };
    });
  } catch (error) { return erroFicha(error); }
}
