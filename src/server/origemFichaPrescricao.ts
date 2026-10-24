import { alturaDocumentada } from "./f0c/dadosDocumentados.js";
import { z } from "zod";
import type { Sessao } from "../contracts/base.js";
import type { Retrato } from "../contracts/f1/retrato.js";
import type { ProtocolTemplate } from "../contracts/w10/prescricao.js";
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
function calcularAtual(deps: DepsOrigemFicha, contexto: ContextoAcaoComposta, original: ProtocolTemplate,
  sessao: Sessao, em: string, retrato: Retrato, draftId: string) {
  const consulta = lerConsulta(deps.db, contexto.patientId, em, sessao, contexto.tumorLotId, { encounterId: contexto.encounterId });
  if ("codigo" in consulta) throw new Error("DADOS_CLINICOS_INDISPONIVEIS");
  const medidos = consulta.avaliacaoClinica.dadosCorporais;
  const alturaCm = alturaDocumentada(retrato, em);
  const dadosCorporais = { ...medidos, alturaCm, bsaM2: bsaMosteller(medidos.pesoKg, alturaCm) };
  // A cópia conferida só alimenta o cálculo; o original continua preservado.
  const template = { ...original, status: "CONFERIDA_MEDICO" as const };
  const anteriores = baseAjusteAnterior(listarEventos(deps.db, contexto.patientId), contexto, template, em);
  const calculo = instanciarProtocolo(template, dadosCorporais, anteriores.itens);
  if (!calculo.ok) throw new Error("FICHA_NAO_INSTANCIAVEL");
  const itens = calculo.itens.map((i, index) => ({ itemId: `item-ficha:${hash([draftId, index, i.item.sequence])}`, item: i.item }));
  const pendencias = calculo.itens.flatMap(i => i.motivo ? [`${i.item.drug}: ${i.motivo}`] : []);
  const avisos = [...consulta.avaliacaoClinica.avisosFlash, ...calculo.itens.flatMap(i => i.aviso ? [`${i.item.drug}: ${i.aviso}`] : [])];
  avisos.push("Cálculo proposto a partir da ficha conferida. Revise a indicação, os dados corporais, os exames e o preparo antes de assinar.");
  return { itens, pendencias, avisos, dadosCorporais };
}
function revalidarOrigem(deps: DepsOrigemFicha, r: RegistroOrigem, contexto: ContextoAcaoComposta, sessao: Sessao, em: string): void {
  if (r.atorId !== sessao.medicoId || hash(r.resposta.contexto) !== hash(contexto)) throw new Error("ORIGEM_FICHA_FORA_DO_CONTEXTO");
  const ficha = fichaAtual(deps, r.resposta.template.templateId, r.resposta.template.versao,
    r.resposta.contentHash, r.resposta.revisionFicha, true);
  const retrato = deps.motorF1?.retrato(contexto, undefined, undefined, em);
  if (!retrato || retrato.revisao !== r.resposta.revisaoFatos)
    throw new Error("ORIGEM_FICHA_FATOS_ALTERADOS");
  // Validade de peso/exames e cálculo podem mudar sem um novo evento no ledger.
  const atual = calcularAtual(deps, contexto, ficha.template, sessao, em, retrato, r.resposta.origemProposta.draftId);
  const { itens, pendencias, avisos, dadosCorporais } = r.resposta;
  if (hash(atual) !== hash({ itens, pendencias, avisos, dadosCorporais })) throw new Error("ORIGEM_FICHA_CALCULO_ALTERADO");
}
export function validarOrigemFicha(deps: DepsOrigemFicha, edicao: EdicaoPrescricaoExecutavel,
  contexto: ContextoAcaoComposta, atorId: string, em: string, token: string): { codigo: string | null; avisos: string[] } {
  try {
    const auth = autenticarFichas(deps, token);
    if (!auth || auth.sessao.medicoId !== atorId) throw new Error("SESSAO_INVALIDA");
    if (!edicao.origemProposta) throw new Error("ORIGEM_FICHA_AUSENTE");
    const r = lerOrigem(deps, edicao.origemProposta);
    revalidarOrigem(deps, r, contexto, auth.sessao, em);
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
        revalidarOrigem(deps, r, contexto, auth.sessao, auth.em);
        return { status: 200, body: r.resposta };
      }
      const retrato = deps.motorF1!.retrato(contexto, undefined, undefined, auth.em);
      const calculo = calcularAtual(deps, contexto, ficha.template, auth.sessao, auth.em, retrato, draftId);
      const resposta: InstanciacaoFichaResposta = InstanciacaoFichaRespostaSchema.parse({
        contexto, origemProposta: { draftId, revision: 0, hash: "0".repeat(64) },
        template: ficha.template, contentHash: ficha.contentHash, revisionFicha: ficha.revision,
        revisaoFatos: retrato.revisao, ...calculo,
      });
      const registro: RegistroOrigem = { kind: "FICHA_PRESCRICAO_INSTANCIADA", atorId: auth.sessao.medicoId, requestHash, resposta };
      resposta.origemProposta.hash = hashOrigem(registro);
      salvarDraft(deps.db, { draftId, patientId: contexto.patientId, sourceId: `ficha-fonte:${ficha.contentHash}`,
        rawRef: "referencia-local", payload: registro, revision: 0, criadoEm: auth.em, diagnostics: calculo.pendencias });
      return { status: 200, body: resposta };
    });
  } catch (error) { return erroFicha(error); }
}
