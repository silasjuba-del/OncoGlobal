import {avaliarConsulta} from "./f0c/avaliacaoConsulta.js";
import {dataCivilDoServico} from "../rules/tempoServico.js";
import {confirmacaoCancelada,cancelarConfirmacao} from "../kernel/comandos/portas.js";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { Sessao, type Fonte } from "../contracts/base.js";
import { Ciclo, Paciente, TreatmentEpisode, TumorLot } from "../contracts/clinico.js";
import type { ClinicalEvent } from "../contracts/operacao.js";
import { ContextoAcaoComposta } from "../contracts/api/acoesCompostas.js";
import { ConteudoPrescricaoExecutavel } from "../contracts/api/prescricaoExecutavel.js";
import { BasePrescricaoExecutavelResposta, ConfirmarPrescricaoExecutavelPedido,
  PrepararPrescricaoExecutavelPedido, PrescricaoExecutavelPreparada,
  type EdicaoPrescricaoExecutavel } from "../contracts/api/operacaoPrescricaoExecutavel.js";
import { executarConfirmacao } from "../kernel/comandos/index.js";
import { auditar, depoisDoCommit, lerDraft, listarEventos, salvarDraft, transacao } from "../kernel/comandos/portas.js";
import { dadosDoEvento, eventosVigentes } from "../kernel/projections/snapshot.js";
import { avaliarDocumentoExecutavel, doseFinalEmMg } from "../rules/prescricao/documentoExecutavel.js";
import { hashConteudoExibido as hash } from "./sessao.js";
import { verificarPrescricaoDuto } from "./dutos.js";
import { validarOrigemFicha, type DepsOrigemFicha } from "./origemFichaPrescricao.js";
import { validarOrigemAcao } from "./origemAcaoPrescricao.js";
import { projetarAlertasConsulta, registrarCienciaAlertas, validarCienciaAlertas } from "./alertasConsulta.js";

type Contexto = ContextoAcaoComposta;
interface Deps extends DepsOrigemFicha { salaoRuleset?: unknown }
interface Resposta { status: number; body: unknown }
const negar = (codigo: string, status = 409, pendencias?: string[]): Resposta =>
  ({ status, body: { codigo, ...(pendencias ? { pendencias } : {}) } });
const ausente = { valor: null, estado: "PENDENTE" as const, campo: "NAO_INFORMADO" as const,
  motivo: "Não informado nesta prescrição", fontes: [], revisao: "CONFIRMADO" as const };
const mesmoContexto = (a: Contexto, b: Contexto) => hash(a) === hash(b);

function eventosConfirmados(db: DatabaseSync, contexto: Contexto, em: string) {
  return listarEventos(db, contexto.patientId).filter(e => e.patientId === contexto.patientId
    && ["CONFIRMADO", "ASSINADO"].includes(e.revisao) && Date.parse(e.criadoEm) <= Date.parse(em));
}

/** Usa a mesma identidade completa na leitura e na supersessão da prescrição. */
function documentoReferenciado(eventos: readonly ClinicalEvent[], contexto: Contexto,
  ref: { documentId: string; documentVersion: number }): ClinicalEvent | undefined {
  return eventos.find(e => {
    const documento = dadosDoEvento(e)?.data as Record<string, unknown> | undefined;
    return e.tipo === "DOCUMENTO" && e.revisao === "ASSINADO" && e.patientId === contexto.patientId
      && e.encounterId === contexto.encounterId && e.tumorLotId === contexto.tumorLotId
      && documento?.documentId === ref.documentId && documento?.documentVersion === ref.documentVersion;
  });
}

/** A revisão abrange os fatos do paciente, inclusive os que mudam a segurança da ordem. */
export function lerBasePrescricaoExecutavel(db: DatabaseSync, contexto: Contexto, em: string): BasePrescricaoExecutavelResposta {
  return projetarBasePrescricaoExecutavel(listarEventos(db, contexto.patientId), contexto, em);
}

/** Permite que uma operação composta use a mesma leitura íntegra para todas as suas fontes. */
export function projetarBasePrescricaoExecutavel(fontes: readonly ClinicalEvent[], contexto: Contexto, em: string): BasePrescricaoExecutavelResposta {
  const eventos = fontes.filter(e => e.patientId === contexto.patientId
    && ["CONFIRMADO", "ASSINADO"].includes(e.revisao) && Date.parse(e.criadoEm) <= Date.parse(em));
  const vigentes = eventosVigentes(eventos);
  const pendencias: string[] = [];
  const pacientes = vigentes.filter(e => ["Paciente", "Paciente@1"].includes(e.tipo)).flatMap(e => {
    const p = Paciente.safeParse(dadosDoEvento(e));
    return p.success && p.data.patientId === contexto.patientId ? [p.data] : [];
  });
  if (pacientes.length !== 1) pendencias.push("PACIENTE_AUSENTE_OU_AMBIGUO");
  const lotes = vigentes.filter(e => ["TumorLot", "TumorLot@1"].includes(e.tipo))
    .flatMap(e => { const p = TumorLot.safeParse(dadosDoEvento(e));
      return p.success && p.data.patientId === contexto.patientId && p.data.tumorLotId === contexto.tumorLotId ? [p.data] : []; });
  if (!contexto.tumorLotId || lotes.length !== 1) pendencias.push("LOTE_AUSENTE_OU_AMBIGUO");
  const ciclos = vigentes.filter(e => ["Ciclo", "Ciclo@1"].includes(e.tipo)
    && e.encounterId === contexto.encounterId && e.tumorLotId === contexto.tumorLotId)
    .flatMap(e => { const p = Ciclo.safeParse(dadosDoEvento(e)); return p.success ? [p.data] : []; });
  if (ciclos.length > 1) pendencias.push("CICLO_ATUAL_AMBIGUO");
  const ciclo = ciclos.length === 1 ? ciclos[0]! : null;
  const selecoes = vigentes.filter(e => e.tumorLotId === contexto.tumorLotId
    && e.tipo === "FATO" && dadosDoEvento(e)?.campo === "planejamento.episodioSelecionado");
  const selecao = selecoes.length === 1 ? dadosDoEvento(selecoes[0]!)?.valor : null;
  const episodioSelecionado = selecao && typeof selecao === "object" && "episodioId" in selecao
    && typeof selecao.episodioId === "string" ? selecao.episodioId : null;
  if (!ciclo && (selecoes.length > 1 || selecoes.length === 1 && !episodioSelecionado))
    pendencias.push("SELECAO_EPISODIO_INVALIDA_OU_AMBIGUA");
  const episodiosVinculados = vigentes.filter(e => ["TreatmentEpisode", "TreatmentEpisode@1"].includes(e.tipo)
    && e.tumorLotId === contexto.tumorLotId).flatMap(e => {
    const p = TreatmentEpisode.safeParse(dadosDoEvento(e));
    return p.success && p.data.tumorLotId === contexto.tumorLotId
      && (ciclo ? p.data.episodioId === ciclo.episodioId
        : episodioSelecionado ? p.data.episodioId === episodioSelecionado : p.data.fim.valor === null) ? [p.data] : [];
  });
  // Seleção encerrada ou de outra modalidade é conhecida, mas não reutilizável
  // por uma ordem QT. Sem ciclo no atendimento, permite criar NOVA_LINHA sem
  // reabrir outro episódio antigo nem alterar CX/RT existentes.
  const selecaoConhecidaSemQtAtual = !ciclo && !!episodioSelecionado && episodiosVinculados.length === 1
    && (episodiosVinculados[0]!.modalidade !== "QT"
      || episodiosVinculados[0]!.fim.campo === "PRESENTE" && episodiosVinculados[0]!.fim.valor !== null);
  const episodios = episodiosVinculados.filter(e => e.modalidade === "QT" && (!!ciclo || e.fim.valor === null));
  if (episodios.length > 1 || (ciclo || episodioSelecionado) && episodios.length !== 1 && !selecaoConhecidaSemQtAtual)
    pendencias.push("EPISODIO_ATUAL_AUSENTE_OU_AMBIGUO");
  const episodio = episodios.length === 1 ? episodios[0]! : null;
  let vigente: ConteudoPrescricaoExecutavel | null = null;
  if (ciclo?.prescricaoRef) {
    const validacao = verificarPrescricaoDuto(eventos, contexto, ciclo.prescricaoRef);
    if (!validacao.ok) pendencias.push(validacao.codigo);
    else {
      const doc = documentoReferenciado(vigentes, contexto, ciclo.prescricaoRef);
      const p = ConteudoPrescricaoExecutavel.safeParse((doc && dadosDoEvento(doc)?.data as Record<string, unknown> | undefined)?.prescricao);
      if (p.success) {
        const { episodioId, cicloId, ...origem } = p.data.contexto;
        if (mesmoContexto(origem, contexto) && episodioId === ciclo.episodioId && cicloId === ciclo.cicloId) vigente = p.data;
        else pendencias.push("PRESCRICAO_ESTRUTURADA_FORA_DO_CONTEXTO");
      }
    }
  }
  if (ciclo && eventos.some(e => ["TreatmentAdministration", "TreatmentAdministration@1"].includes(e.tipo)
    && dadosDoEvento(e)?.cicloId === ciclo.cicloId)) pendencias.push("CICLO_COM_ADMINISTRACAO_REGISTRADA");
  return { contexto, pacienteNome: pacientes[0]?.nome ?? contexto.patientId, ciclo, episodio, vigente, pendencias,
    revisao: hash(eventos.map(e => ({ eventId: e.eventId, payload: e.payload, fontes: e.fontes,
      revisao: e.revisao, supersedesEventId: e.supersedesEventId }))) };
}

function pesoDocumentadoDoCiclo(deps:Deps,contexto:Contexto,base:BasePrescricaoExecutavelResposta,em:string) {
 const eventos=eventosConfirmados(deps.db,contexto,em),vigentes=eventosVigentes(eventos),civil=dataCivilDoServico(em);
 const paciente=vigentes.filter(e=>/^Paciente(?:@1)?$/.test(e.tipo)).flatMap(e=>{const p=Paciente.safeParse(dadosDoEvento(e));return p.success?[p.data]:[];});
 if(civil.estado!=='OK'||paciente.length!==1)throw new Error('BASE_PESO_INDISPONIVEL');
 const anteriores=vigentes.filter(e=>/^Ciclo(?:@1)?$/.test(e.tipo)&&e.tumorLotId===contexto.tumorLotId)
  .flatMap(e=>{const c=Ciclo.safeParse(dadosDoEvento(e));return c.success&&c.data.episodioId===base.episodio?.episodioId?[c.data]:[];}).sort((a,b)=>a.numero-b.numero);
 const a=avaliarConsulta({eventos,...contexto,agora:em,hoje:civil.dataCivil,paciente:paciente[0]!,ciclo:base.ciclo??anteriores.at(-1)??null,episodio:base.episodio,plaquetas:null});
 const fontes=a.dadosNutricionais.fontes.flatMap(ref=>eventos.find(e=>e.eventId===ref.eventId)?.fontes.filter(f=>f.sourceId===ref.sourceId).map(f=>({...f,dataClinica:ref.medidoEm}))??[]);
 const pesoKg:Ciclo['pesoKg']=a.dadosCorporais.pesoKg!==null&&fontes.length ? {valor:a.dadosCorporais.pesoKg,estado:'VERDE',campo:'PRESENTE',motivo:`Peso medido em ${a.dadosCorporais.medidoEm}`,fontes,revisao:'CONFIRMADO'} : {...ausente,motivo:'Peso medido válido ausente ou conflitante nesta preparação'};
 return {pesoKg,origemPeso:pesoKg.valor===null?null:'MEDIDO' as const,avisos:a.avisosFlash.filter(v=>/peso/i.test(v))};
}

const EventoPlanejado = z.object({ tipo: z.enum(["Ciclo", "TreatmentEpisode", "FATO"]),
  payload: z.unknown(), supersedesEventId: z.string().nullable() }).strict();
const PreparacaoArmazenada = z.object({
  kind: z.literal("PRESCRICAO_EXECUTAVEL_RASCUNHO"),
  regraPeso:z.literal("PESO-CICLO@1").optional(),
  contexto: ContextoAcaoComposta, atorId: z.string(), requestHash: z.string(),
  resposta: PrescricaoExecutavelPreparada, edicao: PrepararPrescricaoExecutavelPedido.shape.edicao,
  eventos: z.array(EventoPlanejado), documentoAnteriorId: z.string().nullable(),
}).strict();

type DadosPreparacao = Omit<z.infer<typeof PreparacaoArmazenada>, "kind" | "resposta"> & {
  resposta: Omit<z.infer<typeof PrescricaoExecutavelPreparada>, "conteudoHash">;
};
/** O recibo vincula também base, edição e efeitos que a confirmação consumirá. */
function hashPreparacao(p: DadosPreparacao): string {
  const { draftId, revision, baseHash, conteudo, texto, avisos, efeitos } = p.resposta;
  return hash({ contexto: p.contexto, atorId: p.atorId, requestHash: p.requestHash,
    edicao: p.edicao, eventos: p.eventos, documentoAnteriorId: p.documentoAnteriorId,
    ...(p.regraPeso ? {regraPeso:p.regraPeso} : {}),
    resposta: { draftId, revision, baseHash, conteudo, texto, avisos, efeitos } });
}

function validarOrigem(deps: Deps, edicao: EdicaoPrescricaoExecutavel, base: BasePrescricaoExecutavelResposta,
  atorId: string, em: string, token: string): { codigo: string | null; avisos: string[] } {
  if (edicao.origemProposta !== null) {
    const origem = lerDraft(deps.db, edicao.origemProposta.draftId)?.payload;
    if (origem && typeof origem === "object" && "kind" in origem && origem.kind === "ACAO_COMPOSTA_RASCUNHO")
      return validarOrigemAcao(deps.db, edicao, base, atorId, em);
    return validarOrigemFicha(deps, edicao, base.contexto, atorId, em, token);
  }
  for (const { itemId, item } of edicao.itens) {
    if (item.source !== "PROTOCOL") continue;
    const original = base.vigente?.itens.find(i => i.itemId === itemId)?.item;
    if (!original || original.source !== "PROTOCOL" || base.vigente?.protocoloId !== edicao.protocoloId)
      return { codigo: "ORIGEM_PROTOCOLO_NAO_COMPROVADA", avisos: [] };
    // Uma identidade de protocolo assinada não autoriza trocar a droga/preparo e manter a origem.
    const fixos = (i: typeof item) => { const { observacao, ...resto } = i; return resto; };
    if (hash(fixos(original)) !== hash(fixos(item))) return { codigo: "ORIGEM_PROTOCOLO_ALTERADA", avisos: [] };
  }
  return { codigo: null, avisos: [] };
}

function validarEpisodioReutilizado(edicao: EdicaoPrescricaoExecutavel, base: BasePrescricaoExecutavelResposta,
  episodioId?: string): string | null {
  if (edicao.planejamento.modo === "NOVA_LINHA") return null;
  if (!base.episodio || base.episodio.modalidade !== "QT") return "EPISODIO_QT_ATUAL_AUSENTE";
  return episodioId !== undefined && base.episodio.episodioId !== episodioId ? "EPISODIO_QT_DIVERGENTE" : null;
}

function preparar(deps: Deps, token: string, raw: unknown, contexto: Contexto, atorId: string, em: string): Resposta {
  const p = PrepararPrescricaoExecutavelPedido.safeParse(raw);
  if (!p.success) return negar("PAYLOAD_INVALIDO", 400);
  const entrada = p.data, draftId = `rx-preparada:${hash([contexto, entrada.idempotencyKey])}`;
  const requestHash = hash({ entrada, atorId });
  const base = lerBasePrescricaoExecutavel(deps.db, contexto, em);
  if (base.revisao !== entrada.expectedBaseHash) return negar("BASE_PRESCRICAO_ALTERADA");
  if (base.pendencias.length) return negar("BASE_PRESCRICAO_PENDENTE", 409, base.pendencias);
  const reutilizacao = validarEpisodioReutilizado(entrada.edicao, base);
  if (reutilizacao) return negar(reutilizacao);
  const origem = validarOrigem(deps, entrada.edicao, base, atorId, em, token);
  if (origem.codigo) return negar(origem.codigo);
  const anterior = lerDraft(deps.db, draftId);
  if (anterior) {
    const salvo = PreparacaoArmazenada.safeParse(anterior.payload);
    if (!salvo.success || anterior.patientId !== contexto.patientId || salvo.data.requestHash !== requestHash
      || anterior.revision !== salvo.data.resposta.revision) return negar("IDEMPOTENCIA_CONFLITO");
    if (hashPreparacao(salvo.data) !== salvo.data.resposta.conteudoHash
      || hash(salvo.data.edicao) !== hash(entrada.edicao)
      || salvo.data.resposta.baseHash !== entrada.expectedBaseHash)
      return negar("CONTEUDO_ALTERADO_APOS_EXIBICAO");
    const avaliacao = avaliarDocumentoExecutavel(salvo.data.resposta.conteudo);
    if (!avaliacao.ok) return negar("PRESCRICAO_INCOMPLETA", 409, avaliacao.pendencias);
    depoisDoCommit(deps.db, () => deps.sessoes.registrarBundleExibido(token, contexto, [{ documentId: salvo.data.resposta.conteudo.documentId,
      documentVersion: salvo.data.resposta.conteudo.documentVersion, conteudoHash: salvo.data.resposta.conteudoHash, draftId }]));
    return { status: 200, body: salvo.data.resposta };
  }
  const edicao = entrada.edicao, modo = edicao.planejamento.modo;
  if (modo === "CICLO_ATUAL" && (!base.ciclo || !base.episodio)) return negar("CICLO_ATUAL_AUSENTE");
  if (modo !== "CICLO_ATUAL" && base.ciclo) return negar("ATENDIMENTO_JA_TEM_CICLO");
  if (modo === "NOVO_CICLO" && !base.episodio) return negar("EPISODIO_ATUAL_AUSENTE");
  if (modo !== "NOVA_LINHA" && base.episodio?.esquemaId !== edicao.protocoloId) return negar("TROCA_PROTOCOLO_EXIGE_NOVA_LINHA");
  if (modo !== "NOVA_LINHA" && (edicao.planejamento.linha !== null && edicao.planejamento.linha !== base.episodio?.linha
    || edicao.planejamento.intencao !== null && edicao.planejamento.intencao !== base.episodio?.intencao))
    return negar("PLANEJAMENTO_DIVERGE_DO_EPISODIO");
  if (modo === "CICLO_ATUAL" && edicao.planejamento.numeroCiclo !== null && edicao.planejamento.numeroCiclo !== base.ciclo?.numero)
    return negar("NUMERO_CICLO_DIVERGENTE");
  if (modo === "NOVA_LINHA" && (!edicao.planejamento.linha || !edicao.planejamento.intencao)
    || modo !== "CICLO_ATUAL" && !edicao.planejamento.numeroCiclo) return negar("PLANEJAMENTO_INCOMPLETO");
  const eventos = eventosConfirmados(deps.db, contexto, em), vigentes = eventosVigentes(eventos);
  const chave = hash({ contexto, draftId });
  const episodioId = modo === "NOVA_LINHA" ? `episodio-${chave}` : base.episodio!.episodioId;
  const cicloId = modo === "CICLO_ATUAL" ? base.ciclo!.cicloId : `ciclo-${chave}`;
  if (modo !== "CICLO_ATUAL" && vigentes.some(e => e.tumorLotId === contexto.tumorLotId
    && ["Ciclo", "Ciclo@1"].includes(e.tipo) && dadosDoEvento(e)?.episodioId === episodioId
    && dadosDoEvento(e)?.numero === edicao.planejamento.numeroCiclo)) return negar("NUMERO_CICLO_JA_REGISTRADO");
  const refAnterior = modo === "CICLO_ATUAL" ? base.ciclo?.prescricaoRef : null;
  const documentoAnterior = refAnterior ? documentoReferenciado(vigentes, contexto, refAnterior) : null;
  const conteudo = ConteudoPrescricaoExecutavel.parse({ schema: "PrescricaoExecutavel@1",
    pacienteNome: base.pacienteNome, linha: modo === "NOVA_LINHA" ? edicao.planejamento.linha : base.episodio!.linha,
    numeroCiclo: modo === "CICLO_ATUAL" ? base.ciclo!.numero : edicao.planejamento.numeroCiclo,
    contexto: { ...contexto, episodioId, cicloId }, documentId: refAnterior?.documentId ?? `prescricao-${chave}`,
    documentVersion: (refAnterior?.documentVersion ?? 0) + 1, protocoloId: edicao.protocoloId,
    dataPrevista: edicao.dataPrevista, motivo: edicao.motivo, itens: edicao.itens, origemProposta: edicao.origemProposta });
  const avaliacao = avaliarDocumentoExecutavel(conteudo);
  if (!avaliacao.ok) return negar("PRESCRICAO_INCOMPLETA", 409, avaliacao.pendencias);
  const itens: Ciclo["itens"] = [];
  for (const { item } of edicao.itens) {
    const dose = doseFinalEmMg(item.prescribedDose!, item.unit);
    if (dose === null) return negar("UNIDADE_CICLO_NAO_SUPORTADA", 409, [`${item.drug}: ${item.unit}`]);
    itens.push({ item: item.sequence, droga: item.drug, doseMg: dose,
      reducaoPct: item.adjustmentPercent === null ? null : Math.abs(item.adjustmentPercent) });
  }
  const planejados: z.infer<typeof EventoPlanejado>[] = [];
  if (modo === "NOVA_LINHA") planejados.push({ tipo: "TreatmentEpisode", supersedesEventId: null,
    payload: TreatmentEpisode.parse({ episodioId, tumorLotId: contexto.tumorLotId, modalidade: "QT",
      intencao: edicao.planejamento.intencao, intentModifier: null, linha: edicao.planejamento.linha,
      esquemaId: edicao.protocoloId, inicio: ausente, fim: ausente }) });
  if (modo === "NOVA_LINHA") {
    const selecoes = vigentes.filter(e => e.tumorLotId === contexto.tumorLotId
      && e.tipo === "FATO" && dadosDoEvento(e)?.campo === "planejamento.episodioSelecionado");
    if (selecoes.length > 1) return negar("SELECAO_EPISODIO_AMBIGUA");
    planejados.push({ tipo: "FATO", supersedesEventId: selecoes[0]?.eventId ?? null,
      payload: { campo: "planejamento.episodioSelecionado", valor: { episodioId, motivo: edicao.motivo } } });
  }
  const cicloAnterior = modo === "CICLO_ATUAL" ? vigentes.find(e => ["Ciclo", "Ciclo@1"].includes(e.tipo)
    && e.encounterId === contexto.encounterId && e.tumorLotId === contexto.tumorLotId && dadosDoEvento(e)?.cicloId === cicloId) : null;
  const pesoAtual=pesoDocumentadoDoCiclo(deps,contexto,base,em);
  planejados.push({ tipo: "Ciclo", supersedesEventId: cicloAnterior?.eventId ?? null,
    payload: Ciclo.parse({ cicloId, episodioId, numero: modo === "CICLO_ATUAL" ? base.ciclo!.numero : edicao.planejamento.numeroCiclo,
      previstoEm: edicao.dataPrevista, pesoKg:pesoAtual.pesoKg, origemPeso:pesoAtual.origemPeso,
      ciclosSemPesoConsecutivos: base.ciclo?.ciclosSemPesoConsecutivos ?? 0,
      prescricaoRef: { documentId: conteudo.documentId, documentVersion: conteudo.documentVersion }, itens, comMedico: true }) });
  const efeitos = [`Assinar prescrição versão ${conteudo.documentVersion}.`,
    modo === "CICLO_ATUAL" ? "Substituir a versão planejada do ciclo, preservando seu histórico." : "Registrar novo ciclo planejado.",
    ...(modo === "NOVA_LINHA" ? ["Registrar e selecionar episódio para o planejamento dos próximos ciclos; início efetivo e término da linha anterior permanecem não informados."] : []),
    ...(edicao.encaminharFarmacia ? ["Enviar à fila local da farmácia para conferência; não liberar preparo ou infusão."] : []),
    "Nenhuma administração será registrada.", "A data prevista não reserva cadeira nem altera a agenda externa."];
  const texto = `${avaliacao.texto!}\n\nEFEITOS DA CONFIRMAÇÃO\n${efeitos.map(e => `- ${e}`).join("\n")}`;
  const dadosPreparacao = { regraPeso:"PESO-CICLO@1" as const, contexto, atorId, requestHash, edicao, eventos: planejados,
    documentoAnteriorId: documentoAnterior?.eventId ?? null };
  const respostaSemHash = { draftId, revision: 0, baseHash: base.revisao, conteudo, texto,
    avisos: [...avaliacao.avisos, ...origem.avisos,...pesoAtual.avisos], efeitos };
  const conteudoHash = hashPreparacao({ ...dadosPreparacao, resposta: respostaSemHash });
  const resposta = PrescricaoExecutavelPreparada.parse({ ...respostaSemHash, conteudoHash });
  const payload = PreparacaoArmazenada.parse({ kind: "PRESCRICAO_EXECUTAVEL_RASCUNHO", ...dadosPreparacao, resposta });
  salvarDraft(deps.db, { draftId, patientId: contexto.patientId, sourceId: "prescricao-medica-local",
    rawRef: "referencia-local", payload, revision: 0, diagnostics: ["AGUARDA_ASSINATURA_MEDICA"], criadoEm: em });
  depoisDoCommit(deps.db, () => deps.sessoes.registrarBundleExibido(token, contexto, [{ documentId: conteudo.documentId,
    documentVersion: conteudo.documentVersion, conteudoHash, draftId }]));
  return { status: 200, body: resposta };
}

function confirmar(deps: Deps, token: string, raw: unknown, contexto: Contexto, atorId: string, em: string): Resposta {
  const p = ConfirmarPrescricaoExecutavelPedido.safeParse(raw);
  if (!p.success) return negar("PAYLOAD_INVALIDO", 400);
  const entrada = p.data, draft = lerDraft(deps.db, entrada.draftId);
  const s = PreparacaoArmazenada.safeParse(draft?.payload);
  if (!draft || !s.success || draft.patientId !== contexto.patientId || !mesmoContexto(s.data.contexto, contexto)
    || s.data.atorId !== atorId) return negar("PREPARACAO_NAO_ENCONTRADA");
  const salvo = s.data, r = salvo.resposta;
  if (r.conteudoHash !== entrada.conteudoHash || r.revision !== entrada.expectedRevision)
    return negar("CONTEUDO_ALTERADO_APOS_EXIBICAO");
  const operationId = `rx-confirmar:${entrada.idempotencyKey}`, requestHash = hash({ entrada, atorId });
  if(confirmacaoCancelada(deps.db,operationId))return negar("INTENCAO_CANCELADA");
  const eventos = listarEventos(deps.db, contexto.patientId);
  const anteriores = eventos.filter(e => e.operationId === operationId);
  const retorno = (codigo: "GRAVADA" | "REPLAY", eventoId: string, conteudo = r.conteudo) => ({ status: 200, body: {
    codigo, documentId: conteudo.documentId, documentVersion: conteudo.documentVersion,
    eventoId, cicloId: conteudo.contexto.cicloId, episodioId: conteudo.contexto.episodioId } });
  if (anteriores.length) {
    if (anteriores.some(e => e.encounterId !== contexto.encounterId || e.tumorLotId !== contexto.tumorLotId
      || e.criadoPor.id !== atorId || e.fontes[0]?.contentHash !== requestHash)) return negar("IDEMPOTENCIA_CONFLITO");
    const doc = anteriores.find(e => e.tipo === "DOCUMENTO");
    const dados = doc ? dadosDoEvento(doc) : null;
    const documento = dados?.data && typeof dados.data === "object" && !Array.isArray(dados.data)
      ? dados.data as Record<string, unknown> : null;
    const historica = ConteudoPrescricaoExecutavel.safeParse(documento?.prescricao);
    if (!doc || !historica.success || !verificarPrescricaoDuto([doc], contexto, {
      documentId: historica.data.documentId, documentVersion: historica.data.documentVersion,
    }).ok)
      return negar("OPERACAO_INCOMPLETA");
    const { episodioId: _episodioId, cicloId: _cicloId, ...origem } = historica.data.contexto;
    if (!mesmoContexto(origem, contexto)) return negar("OPERACAO_INCOMPLETA");
    // Replay de operação já confirmada lê o documento imutável. Não reexecuta
    // efeitos nem depende do formato/estado posterior da preparação mutável.
    return retorno("REPLAY", doc.eventId, historica.data);
  }
  if (hashPreparacao(salvo) !== r.conteudoHash) return negar("CONTEUDO_ALTERADO_APOS_EXIBICAO");
  if (draft.revision !== entrada.expectedRevision) return negar("REVISAO_PREPARACAO_ALTERADA");
  const exibido = deps.sessoes.bundleExibido(token, contexto);
  if (!exibido?.some(e => e.draftId === draft.draftId && e.documentId === r.conteudo.documentId
    && e.documentVersion === r.conteudo.documentVersion && e.conteudoHash === r.conteudoHash))
    return negar("PRESCRICAO_NAO_EXIBIDA_NESTA_SESSAO");
  const civil = dataCivilDoServico(em, "-03:00");
  if (civil.estado !== "OK") return negar(civil.codigo);
  const alertas = projetarAlertasConsulta(deps.db, eventos, contexto, civil.dataCivil, em, deps.salaoRuleset);
  const ciencia = validarCienciaAlertas(alertas, deps.sessoes.alertasExibidos?.(token, contexto) ?? [], entrada.reconhecerAlertas ?? []);
  if (ciencia) return negar(ciencia);
  const base = lerBasePrescricaoExecutavel(deps.db, contexto, em);
  if (base.revisao !== r.baseHash || base.pendencias.length) return negar("BASE_PRESCRICAO_ALTERADA");
  if(salvo.regraPeso){
    const atual=pesoDocumentadoDoCiclo(deps,contexto,base,em),planejado=salvo.eventos.find(e=>e.tipo==='Ciclo');
    const ciclo=Ciclo.safeParse(planejado?.payload);
    if(!ciclo.success||hash(ciclo.data.pesoKg)!==hash(atual.pesoKg)||ciclo.data.origemPeso!==atual.origemPeso)return negar('PESO_ALTERADO_APOS_PREVIA');
  }
  const reutilizacao = validarEpisodioReutilizado(salvo.edicao, base, r.conteudo.contexto.episodioId);
  if (reutilizacao) return negar(reutilizacao);
  const origem = validarOrigem(deps, salvo.edicao, base, atorId, em, token);
  if (origem.codigo) return negar(origem.codigo);
  const avaliacao = avaliarDocumentoExecutavel(r.conteudo);
  if (!avaliacao.ok) return negar("PRESCRICAO_INCOMPLETA", 409, avaliacao.pendencias);
  const key = hash(operationId), reviewDecisionId = `rx-review-${key}`, eventoId = `rx-doc-${key}`;
  const fonte: Fonte = { sourceId: draft.sourceId, classe: "MANUAL", localizador: null,
    dataClinica: null, dataCaptura: em, versao: String(r.conteudo.documentVersion), contentHash: requestHash };
  const doc = { documentId: r.conteudo.documentId, documentVersion: r.conteudo.documentVersion,
    tipoDocumento: "PRESCRICAO_QT", texto: r.texto, contexto: r.conteudo.contexto, prescricao: r.conteudo };
  const documentHash = hash(doc);
  const registros = [{ draftId: draft.draftId, expectedRevision: draft.revision, eventId: eventoId, tipo: "DOCUMENTO",
    payload: { data: doc, signature: { documentId: doc.documentId, documentVersion: doc.documentVersion,
      documentHash, reviewDecisionId, serverActorId: atorId } } as unknown,
    fontes: [fonte], revisao: "ASSINADO" as "ASSINADO" | "CONFIRMADO", supersedesEventId: salvo.documentoAnteriorId }];
  const auxiliares: Array<{ tipo: string; payload: unknown; supersedesEventId: string | null }> = [...salvo.eventos];
  if (salvo.edicao.encaminharFarmacia) {
    const antigas = eventosVigentes(eventos).filter(e => e.encounterId === contexto.encounterId
      && e.tumorLotId === contexto.tumorLotId && e.tipo === "FATO" && dadosDoEvento(e)?.campo === "farmacia.conferencia"
      && ((dadosDoEvento(e)?.valor as Record<string, unknown>)?.prescricao as Record<string, unknown>)?.documentId === doc.documentId);
    if (antigas.length > 1) return negar("CONFERENCIA_FARMACIA_AMBIGUA");
    auxiliares.push({ tipo: "FATO", supersedesEventId: antigas[0]?.eventId ?? null,
      payload: { campo: "farmacia.conferencia", valor: { prescricao: { ...contexto, documentId: doc.documentId,
        documentVersion: doc.documentVersion, documentHash, revisao: "ASSINADO" },
        estado: "ENVIADA", motivo: null, atorId, em } } });
  }
  for (const [i, e] of auxiliares.entries()) {
    const draftId = `rx-aux-${key}-${i}`;
    if (lerDraft(deps.db, draftId)) return negar("DRAFT_AUXILIAR_CONFLITANTE");
    salvarDraft(deps.db, { draftId, patientId: contexto.patientId, sourceId: draft.sourceId,
      rawRef: "referencia-local", payload: { kind: "PRESCRICAO_EXECUTAVEL_AUXILIAR", contexto, origem: draft.draftId },
      revision: 0, diagnostics: [], criadoEm: em });
    registros.push({ draftId, expectedRevision: 0, eventId: `rx-event-${key}-${i}`, tipo: e.tipo,
      payload: e.payload, fontes: [fonte], revisao: "CONFIRMADO", supersedesEventId: e.supersedesEventId });
  }
  const gravado = executarConfirmacao(deps.db, { autorizadoEm: deps.agora(), operationId, ...contexto, reviewDecisionId,
    sessao: deps.sessoes.obter(token)!, em, registros });
  if (gravado.estado === "NEGADA") return negar(gravado.motivo ?? "PRESCRICAO_TRANSACAO_NEGADA");
  if (gravado.estado === "GRAVADA") registrarCienciaAlertas(deps.db, contexto, entrada.reconhecerAlertas ?? [], atorId, em, operationId);
  return retorno(gravado.estado, eventoId);
}

function recuperar(deps:Deps,token:string,raw:unknown,ctx:Contexto,atorId:string,em:string,cancelar=false):Resposta {
 const p=ConfirmarPrescricaoExecutavelPedido.safeParse(raw);if(!p.success)return negar("PAYLOAD_INVALIDO",400);
 if(listarEventos(deps.db,ctx.patientId).some(e=>e.operationId===`rx-confirmar:${p.data.idempotencyKey}`)) {
   const r=confirmar(deps,token,raw,ctx,atorId,em);return r.status===200?{status:200,body:{estado:"CONFIRMADA",resultado:r.body}}:r;
 }
 if(confirmacaoCancelada(deps.db,`rx-confirmar:${p.data.idempotencyKey}`))return {status:200,body:{estado:"CANCELADA"}};
 const d=lerDraft(deps.db,p.data.draftId),v=PreparacaoArmazenada.safeParse(d?.payload);
 if(!d||!v.success||d.patientId!==ctx.patientId||!mesmoContexto(v.data.contexto,ctx)||v.data.atorId!==atorId
   ||d.revision!==p.data.expectedRevision||v.data.resposta.revision!==p.data.expectedRevision
   ||v.data.resposta.conteudoHash!==p.data.conteudoHash||hashPreparacao(v.data)!==p.data.conteudoHash)return negar("PREPARACAO_NAO_ENCONTRADA");
 if(cancelar){cancelarConfirmacao(deps.db,`rx-confirmar:${p.data.idempotencyKey}`,atorId,em);return {status:200,body:{estado:"CANCELADA"}};}
 const r=v.data.resposta;
 depoisDoCommit(deps.db, () => deps.sessoes.registrarBundleExibido(token,ctx,[{documentId:r.conteudo.documentId,documentVersion:r.conteudo.documentVersion,conteudoHash:r.conteudoHash,draftId:d.draftId}]));
 return {status:200,body:{estado:"PREVIA",texto:r.texto,avisos:r.avisos}};
}

export function operarPrescricaoExecutavel(deps: Deps, token: string, operacao: "base" | "preparar" | "confirmar" | "recuperar" | "cancelar", raw: unknown): Resposta {
  const em = deps.agora(), sessao = Sessao.safeParse(deps.sessoes.obter(token));
  if (!sessao.success || !Number.isFinite(Date.parse(em)) || Date.parse(sessao.data.emitidaEm) > Date.parse(em)
    || Date.parse(sessao.data.expiraEm) <= Date.parse(em)) return negar("SESSAO_INVALIDA", 401);
  const c = ContextoAcaoComposta.safeParse(operacao === "base" ? raw :
    raw && typeof raw === "object" && "contexto" in raw ? raw.contexto : null);
  if (!c.success) return negar("PAYLOAD_INVALIDO", 400);
  const selecionado = deps.sessoes.consultaSelecionada(token);
  if (!selecionado || selecionado.patientId !== c.data.patientId || selecionado.encounterId !== c.data.encounterId
    || (selecionado.tumorLotId ?? null) !== c.data.tumorLotId) return negar("CONTEXTO_CONSULTA_ALTERADO");
  try {
    const resultado = transacao(deps.db, () => operacao === "base"
      ? { status: 200, body: BasePrescricaoExecutavelResposta.parse(lerBasePrescricaoExecutavel(deps.db, c.data, em)) }
      : operacao === "preparar" ? preparar(deps, token, raw, c.data, sessao.data.medicoId, em)
      : (operacao === "recuperar" || operacao === "cancelar") ? recuperar(deps,token,raw,c.data,sessao.data.medicoId,em,operacao === "cancelar")
      : confirmar(deps, token, raw, c.data, sessao.data.medicoId, em), r => r.status >= 400);
    // O rollback remove auxiliares e qualquer auditoria interna do gravador.
    // A recusa de confirmacao persiste uma unica vez, fora da unidade desfeita.
    if (operacao === "confirmar" && resultado.status === 409) auditar(deps.db, {
      ator: { tipo: "SESSAO", id: sessao.data.medicoId }, acaoPedida: "CONFIRMAR", decisao: "NEGADA",
      motivoCodigo: (resultado.body as { codigo: string }).codigo, politicaVersao: "W2-01", em,
    });
    return resultado;
  } catch { return negar("PRESCRICAO_ARMAZENAMENTO_INDISPONIVEL", 503); }
}
