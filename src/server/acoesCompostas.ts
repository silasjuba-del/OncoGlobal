import type { DatabaseSync } from "node:sqlite";
import { Ciclo, TreatmentEpisode } from "../contracts/clinico.js";
import { ContextoAcaoComposta, type BaseAcaoComposta, type ResultadoAcaoComposta } from "../contracts/api/acoesCompostas.js";
import { AcaoCompostaPreparada, BaseAcaoCompostaResposta, PrepararAcaoCompostaPedido } from "../contracts/api/execucaoAcaoComposta.js";
import { lerDraft, listarEventos, salvarDraft, transacao } from "../kernel/comandos/portas.js";
import { dadosDoEvento, eventosVigentes } from "../kernel/projections/snapshot.js";
import { prepararAcaoComposta } from "../rules/prescricao/acoesCompostas.js";
import { hashConteudoExibido, type GerenciadorSessao } from "./sessao.js";
import { verificarPrescricaoDuto } from "./dutos.js";

type Contexto = ContextoAcaoComposta;
interface Deps { db: DatabaseSync; sessoes: GerenciadorSessao; agora: () => string }
interface Resposta { status: number; body: unknown }
const negar = (codigo: string, status = 409): Resposta => ({ status, body: { codigo } });

/** A base vem do ledger confirmado; o browser fornece apenas a intenção e o hash esperado. */
export function lerBaseAcaoComposta(db: DatabaseSync, contexto: Contexto, agora: string): BaseAcaoCompostaResposta {
  const pendente = (codigo: string): BaseAcaoCompostaResposta => ({ base: null, pendencias: [codigo] });
  const instante = Date.parse(agora);
  if (!Number.isFinite(instante)) return pendente("RELOGIO_INVALIDO");
  const eventos = listarEventos(db, contexto.patientId).filter(e => e.patientId === contexto.patientId
    && ["CONFIRMADO", "ASSINADO"].includes(e.revisao) && Date.parse(e.criadoEm) <= instante);
  const atuais = eventosVigentes(eventos);
  const ciclos = atuais.filter(e => ["Ciclo", "Ciclo@1"].includes(e.tipo)
    && e.encounterId === contexto.encounterId && e.tumorLotId === contexto.tumorLotId)
    .flatMap(evento => { const p = Ciclo.safeParse(dadosDoEvento(evento)); return p.success ? [{ evento, ciclo: p.data }] : []; });
  if (ciclos.length !== 1) return pendente("CICLO_ATUAL_AUSENTE_OU_AMBIGUO");
  const { ciclo } = ciclos[0]!;
  const episodios = atuais.filter(e => ["TreatmentEpisode", "TreatmentEpisode@1"].includes(e.tipo)
    && e.tumorLotId === contexto.tumorLotId)
    .flatMap(e => { const p = TreatmentEpisode.safeParse(dadosDoEvento(e));
      return p.success && p.data.episodioId === ciclo.episodioId && p.data.tumorLotId === contexto.tumorLotId ? [p.data] : []; });
  if (episodios.length !== 1) return pendente("EPISODIO_ATUAL_AUSENTE_OU_AMBIGUO");
  if (atuais.some(e => ["TreatmentAdministration", "TreatmentAdministration@1"].includes(e.tipo)
    && dadosDoEvento(e)?.cicloId === ciclo.cicloId)) return pendente("CICLO_COM_ADMINISTRACAO_REGISTRADA");
  if (!ciclo.itens.length) return pendente("PRESCRICAO_SEM_ITENS_ESTRUTURADOS");
  if (ciclo.itens.some(i => !Number.isSafeInteger(i.doseMg)))
    return pendente("DOSE_FRACIONADA_REQUER_EDITOR_ESTRUTURADO");
  const prescricao = ciclo.prescricaoRef ? verificarPrescricaoDuto(eventos, contexto, ciclo.prescricaoRef) : null;
  const pendencias = prescricao?.ok ? [] : [prescricao?.codigo ?? "PRESCRICAO_ASSINADA_AUSENTE"];
  const snapshot = { contexto, cicloId: ciclo.cicloId, episodioId: ciclo.episodioId,
    protocoloId: episodios[0]!.esquemaId, previstoEm: ciclo.previstoEm,
    itens: ciclo.itens.map(i => ({ item: i.item, droga: i.droga, doseMg: prescricao?.ok ? i.doseMg : null })) };
  const revisao = hashConteudoExibido(eventos.map(e => ({ eventId: e.eventId, payload: e.payload,
    fontes: e.fontes, revisao: e.revisao, supersedesEventId: e.supersedesEventId })));
  const base: BaseAcaoComposta = { ...snapshot, revisao, baseHash: hashConteudoExibido({ snapshot, revisao }) };
  return BaseAcaoCompostaResposta.parse({ base, pendencias });
}

function documentoDoPlano(r: ResultadoAcaoComposta) {
  const rotulo = { MANTER_CICLO: "Manutenção de ciclo", REDUZIR_DOSE: "Ajuste de dose",
    ADIAR_CICLO: "Adiamento de ciclo", TROCAR_PROTOCOLO: "Troca de protocolo" };
  const titulo = r.tipo ? rotulo[r.tipo] : "Plano terapêutico";
  const mudancas = r.diff.map(d => `${d.campo}${d.item === null ? "" : ` · item ${d.item}`}: ${d.antes ?? "não consta"} → ${d.depois ?? "pendente"}`);
  const texto = [titulo, `Motivo informado pelo médico: ${r.motivo}`,
    `Protocolo de base: ${r.antes?.protocoloId ?? "não consta"}`,
    `Ciclo de base: ${r.antes?.cicloId ?? "não consta"}`,
    ...mudancas, ...r.pendencias.map(p => `Pendente: ${p}`),
    "Planejamento para revisão. Esta minuta não altera a prescrição vigente, não comprova administração e não libera preparo ou infusão.",
  ].join("\n");
  return { titulo, texto };
}

/** Persiste uma intenção revisável. A assinatura/execução clínica é uma operação separada. */
export function operarAcoesCompostas(deps: Deps, token: string, operacao: "base" | "preparar", raw: unknown): Resposta {
  if (!deps.sessoes.obter(token)) return negar("SESSAO_INVALIDA", 401);
  const pedido = operacao === "preparar" ? PrepararAcaoCompostaPedido.safeParse(raw) : null;
  const p = ContextoAcaoComposta.safeParse(pedido?.success ? pedido.data.contexto : raw);
  if (!p.success || operacao === "preparar" && !pedido?.success) return negar("PAYLOAD_INVALIDO", 400);
  const selecionado = deps.sessoes.consultaSelecionada(token);
  if (!selecionado || selecionado.patientId !== p.data.patientId || selecionado.encounterId !== p.data.encounterId
    || (selecionado.tumorLotId ?? null) !== p.data.tumorLotId) return negar("CONTEXTO_CONSULTA_ALTERADO");
  const leitura = lerBaseAcaoComposta(deps.db, p.data, deps.agora());
  if (operacao === "base") return { status: 200, body: leitura };
  if (!pedido?.success) return negar("PAYLOAD_INVALIDO", 400);
  if (!leitura.base || leitura.base.baseHash !== pedido.data.expectedBaseHash) return negar("BASE_ACAO_ALTERADA");
  const entrada = pedido.data;
  const resultado = prepararAcaoComposta(leitura.base, entrada.pedido);
  const documentoPlano = documentoDoPlano(resultado);
  const requestHash = hashConteudoExibido(entrada);
  const draftId = `acao-composta:${hashConteudoExibido([entrada.contexto, entrada.idempotencyKey])}`;
  return transacao(deps.db, () => {
    const anterior = lerDraft(deps.db, draftId);
    if (anterior) {
      const payload = anterior.payload as { kind?: unknown; requestHash?: unknown; resposta?: unknown };
      const resposta = AcaoCompostaPreparada.safeParse(payload.resposta);
      if (anterior.patientId !== entrada.contexto.patientId || payload.kind !== "ACAO_COMPOSTA_RASCUNHO"
        || payload.requestHash !== requestHash || !resposta.success) return negar("IDEMPOTENCIA_CONFLITO");
      return { status: 200, body: resposta.data };
    }
    const conteudoHash = hashConteudoExibido({ contexto: entrada.contexto, resultado, documentoPlano });
    const resposta = AcaoCompostaPreparada.parse({ draftId, revision: 0, conteudoHash,
      resultado, documentoPlano, criaEventoClinico: false, liberaTratamento: false });
    salvarDraft(deps.db, { draftId, patientId: entrada.contexto.patientId, sourceId: `plano:${draftId}`,
      rawRef: "referencia-local", payload: { kind: "ACAO_COMPOSTA_RASCUNHO", contexto: entrada.contexto, requestHash, resposta },
      revision: 0, diagnostics: ["REVISAO_MEDICA_OBRIGATORIA", "EXECUCAO_CLINICA_NAO_REALIZADA"], criadoEm: deps.agora() });
    return { status: 200, body: resposta };
  });
}
