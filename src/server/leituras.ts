import type { DatabaseSync } from "node:sqlite";
import { z, type ZodType } from "zod";
import { DataCivil, Fonte } from "../contracts/base.js";
import { ClinicalEvent, Apac } from "../contracts/operacao.js";
import { Paciente, TumorLot, Triagem, TreatmentEpisode, Ciclo } from "../contracts/clinico.js";
import { Conversation } from "../contracts/agentes.js";
import { Contato } from "../contracts/clinico.js";
import { dadosDoEvento, eventosVigentes } from "../kernel/projections/snapshot.js";
import { apacTimeline } from "../kernel/projections/apacTimeline.js";
import { dataCivilDoServico } from "../kernel/gateway/tempo.js";
import { apacPrazo } from "../rules/apac.js";
import { listarDrafts } from "../kernel/ledger/drafts.js";
import type { Sessao } from "../contracts/base.js";
import type { SetorChat } from "../ui/api/porta.js";
import { SalaoRuleset, type ContextoTriagem } from "../contracts/regras.js";
import { avaliarCorteSalao, avaliarTriagem } from "../rules/triagem.js";
import { ordenarFila } from "../rules/fila.js";
import { antiglosa, CAMPOS_OBRIGATORIOS_PADRAO } from "../apac/antiglosa.js";
import type { CaixaNumerada } from "../contracts/w10/clinico-w10.js";
import type { TabelasSigtap } from "../apac/sigtap.js";
import { avaliarSerieRecist, type RecistSerieInput } from "../rules/recist/index.js";
import { ClinicalFact } from "../contracts/w10/extracao.js";
import { reconciliarCampos } from "../kernel/extracao/reconciliacao.js";
import { normalizarDataCivil } from "../kernel/extracao/normalizacao.js";
import { projetarDatasFixas } from "../kernel/projections/datasFixas.js";
import { projetarHistoricoTratamento, type FatoSistemico } from "../kernel/projections/historicoTratamento.js";
import { labSeries } from "../kernel/projections/series.js";
import { avaliarAlertaPlaquetas, type AlertaPlaquetas, type LimiarAlertaPlaquetas } from "../rules/plaquetasAlerta.js";
import { elegibilidadeCiclo, type SinalElegibilidade } from "../rules/elegibilidadeCiclo.js";
import { projetarFlash, rascunhoFlashDoContexto, type ModeloFlash } from "./flash.js";
import { projetarVinculosContato, type ContatoProjetado } from "../kernel/projections/vinculosContato.js";
import { hashConteudoExibido } from "./sessao.js";
import { projetarRetratoTransversal } from "./retratoTransversal.js";
import { projetarContextoClinico, projetarHistoricoClinico } from "./f0c/contextoClinico.js";
import { avaliarConsulta, type EntradaAvaliacaoConsulta } from "./f0c/avaliacaoConsulta.js";
import { coletarFontesSalao } from "./f0c/salao.js";
import { projetarInstrumentosClinicos } from "./f0c/instrumentosClinicos.js";
import type { RegraInstrumento } from "../contracts/f0c/instrumentos.js";
import { projetarCondicionaisClinicas, type EntradaCondicionaisClinicas } from "./f0c/condicionaisClinicas.js";
import { projetarIntervaloCiclo } from "./f0c/intervaloCiclo.js";
import { avaliarInteracoesCondicionadasDaConsulta } from "./f0c/interacoesCondicionadas.js";
import { projetarCumulativoClinico } from "./f0c/cumulativoClinico.js";

const RecistSerieSchema = z.object({
  patientId: z.string().min(1), tumorLotId: z.string().nullable(), episodioId: z.string().min(1),
  baselineEventId: z.string().min(1),
  alvos: z.array(z.object({ codigo: z.string(), tipo: z.enum(["NAO_NODAL", "LINFONODO"]),
    eixo: z.enum(["MAIOR", "CURTO"]), orgaoId: z.string().nullable(),
    elegibilidadeBasal: z.enum(["ELEGIVEL", "NAO_ELEGIVEL"]).nullable(),
    fonteElegibilidadeIds: z.array(z.string()) }).strict()),
  pontos: z.array(z.object({ eventId: z.string(), patientId: z.string(), tumorLotId: z.string().nullable(),
    episodioId: z.string(), data: z.string(), metodo: z.enum(["TC", "CXR", "CALIPER", "RM", "US", "OUTRO"]),
    tecnicaId: z.string().nullable(), espessuraCorteMm: z.number().nullable(),
    qualidadeMedicao: z.enum(["ADEQUADA", "INADEQUADA", "NAO_AVALIADA"]),
    lesoes: z.array(z.object({ codigo: z.string(), diametroMm: z.number(), fonteIds: z.array(z.string()),
      unidadeOriginal: z.enum(["mm", "cm"]).nullable().optional(), valorOriginal: z.number().nullable().optional()
    }).strict().transform(({ unidadeOriginal, valorOriginal, ...l }) => ({ ...l,
      ...(unidadeOriginal === undefined ? {} : { unidadeOriginal }), ...(valorOriginal === undefined ? {} : { valorOriginal }) }))),
    novasLesoes: z.boolean().nullable(),
    naoAlvos: z.enum(["AUSENTE_DOCUMENTADO", "PERSISTENTE_SEM_PROGRESSAO", "PROGRESSAO_INEQUIVOCA", "NAO_AVALIADO"]),
    fonteIds: z.array(z.string()) }).strict()),
}).strict();

/** W10 provisional operational envelopes. They carry no inferred clinical values. */
const AgendaEntry = z.object({
  patientId: z.string().min(1), encounterId: z.string().min(1),
  horario: z.string().regex(/^\d{2}:\d{2}$/), data: DataCivil,
}).strict();
const CanalMessage = z.object({
  mensagemId: z.string().min(1), contatoId: z.string().min(1),
  patientId: z.string().nullable(), texto: z.string(),
  em: z.string(), redFlag: z.boolean(),
}).strict();
const ChatMessage = z.object({
  mensagemId: z.string().min(1), patientId: z.string().min(1), encounterId: z.string().min(1),
  setor: z.enum(["TRIAGEM", "FARMACIA", "SECRETARIA", "MEDICO"]),
  autor: z.string().min(1), texto: z.string(),
}).strict();

function eventos(db: DatabaseSync) {
  return db.prepare("SELECT * FROM clinical_event").all().flatMap((row) => {
    try {
      return [ClinicalEvent.parse({ ...row, payload: JSON.parse(String(row.payload)),
        fontes: JSON.parse(String(row.fontes)), criadoPor: JSON.parse(String(row.criadoPor)) })];
    } catch { return []; }
  }).sort((a, b) => Date.parse(a.criadoEm) - Date.parse(b.criadoEm)
    || a.operationId.localeCompare(b.operationId) || a.eventIndex - b.eventIndex);
}
function data(e: ReturnType<typeof eventos>[number]) { return dadosDoEvento(e); }
function valorCandidatoResumo(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const v = value as Record<string, unknown>;
    if (typeof v.marker === "string") return `${v.marker}: ${v.value ?? v.raw ?? "NÃO CONSTA"}${typeof v.unit === "string" ? ` ${v.unit}` : ""}`;
    if (typeof v.siteRaw === "string" || typeof v.measureRaw === "string")
      return `${typeof v.siteRaw === "string" ? v.siteRaw : "sítio NÃO CONSTA"}: ${typeof v.measureRaw === "string" ? `${v.measureRaw} ${String(v.unit ?? "")}`.trim() : "medida NÃO CONSTA"}`;
    if (typeof v.raw === "string") return v.raw;
  }
  return JSON.stringify(value) ?? String(value);
}
function porTipo<T>(all: ReturnType<typeof eventos>, tipo: string, schema: ZodType<T>) {
  const groups = new Map<string, ReturnType<typeof eventos>>();
  for (const event of all.filter((e) => e.tipo === tipo)) {
    const scope = JSON.stringify([event.patientId, event.tumorLotId]);
    const group = groups.get(scope) ?? [];
    group.push(event); groups.set(scope, group);
  }
  const current = [...groups.values()].flatMap((group) => eventosVigentes(group));
  return current.flatMap((e) => {
    const p = schema.safeParse(data(e)); return p.success ? [{ event: e, value: p.data }] : [];
  });
}
function contatoUnico(contatoId: string, patientId: string, projetados: readonly ContatoProjetado[] = []) {
  const matches = projetados.filter((c) => c.value.contatoId === contatoId
    && c.patientIdResolvido === patientId && c.estadoVinculo === "VINCULADO"
    && c.value.revogadoEm === null);
  return matches.length === 1 ? matches[0]!.value : null;
}

const DATA_CIVIL_LEITURA = /^\d{4}-\d{2}-\d{2}$/;

/** W11-H22: linha do tempo a partir dos ciclos confirmados. Campo ausente no payload fica null (PENDENTE). */
function historicoDaConsulta(eventosDaConsulta: ReturnType<typeof eventos>) {
  const fatos = eventosVigentes(eventosDaConsulta).filter((e) => e.tipo === "TreatmentCycle").flatMap((e): FatoSistemico[] => {
    const d = data(e);
    if (!d || typeof d.dataClinica !== "string" || !DATA_CIVIL_LEITURA.test(d.dataClinica)) return [];
    return [{ tipo: "SISTEMICO", id: e.eventId, data: d.dataClinica,
      ciclo: typeof d.ciclo === "number" && Number.isInteger(d.ciclo) && d.ciclo >= 1 ? d.ciclo : null,
      protocolo: typeof d.protocolo === "string" ? d.protocolo : null,
      doseRelativaPct: typeof d.doseRelativaPct === "number" ? d.doseRelativaPct : null,
      previstoEm: typeof d.previstoEm === "string" && DATA_CIVIL_LEITURA.test(d.previstoEm) ? d.previstoEm : null,
      observacao: typeof d.observacao === "string" ? d.observacao : null }];
  });
  try {
    return { linhas: projetarHistoricoTratamento(fatos), estado: "PARCIAL" as const, codigo: null };
  } catch {
    return { linhas: [], estado: "PENDENTE" as const, codigo: "HISTORICO_INVALIDO" };
  }
}

/** W11-H22: alerta de plaquetas do valor mais recente. Empate de data com valores diferentes = ausente (nunca eleito). */
function alertaPlaquetasDaConsulta(eventosDaConsulta: ReturnType<typeof eventos>,
  limiar: LimiarAlertaPlaquetas | null): AlertaPlaquetas | null {
  if (limiar === null) return null;
  const pontos = labSeries(eventosDaConsulta).filter((p) => p.campo === "plaquetas" && DATA_CIVIL_LEITURA.test(p.data));
  const maisRecente = pontos.reduce<string | null>((max, p) => max === null || p.data > max ? p.data : max, null);
  const doDia = pontos.filter((p) => p.data === maisRecente);
  const entrada = maisRecente === null || new Set(doDia.map((p) => p.valor)).size !== 1
    ? { valor: null, data: null } : { valor: doDia[0]!.valor, data: maisRecente };
  const [alerta] = avaliarAlertaPlaquetas(entrada, limiar, () => ({ grau: null, estado: "PENDENTE",
    confirmadoPeloMedico: false, motivo: "graduação CTCAE fora da visão de consulta" }));
  return alerta;
}

function sinalPlaquetas(alerta: AlertaPlaquetas | null): SinalElegibilidade | null {
  if (alerta === null) return null;
  if (alerta.estado === "ALERTA") return { estado: "VERMELHO", motivos: [{ texto: alerta.motivo }] };
  if (alerta.estado === "SEM_ALERTA") return { estado: "VERDE", motivos: [] };
  return { estado: "PENDENTE", motivos: [{ texto: alerta.motivo }] };
}

export function lerPaciente(db: DatabaseSync, patientId: string) {
  return porTipo(eventos(db), "Paciente", Paciente)
    .filter((x) => x.value.patientId === patientId && x.event.patientId === patientId).at(-1)?.value ?? null;
}
export function lerConsulta(db: DatabaseSync, patientId: string, agora: string, sessao: Sessao,
  tumorLotId?: string | null, config: { limiarPlaquetas?: LimiarAlertaPlaquetas | null; modeloFlash?: ModeloFlash | null;
    templates?: readonly unknown[]; salaoRuleset?: unknown; interacoes?: EntradaAvaliacaoConsulta["interacoes"];
    catalogo?: EntradaAvaliacaoConsulta["catalogo"]; feveRuleset?: EntradaAvaliacaoConsulta["feveRuleset"];
    instrumentos?: readonly RegraInstrumento[];
    condicionais?: {regras:EntradaCondicionaisClinicas["regras"];termos:NonNullable<EntradaCondicionaisClinicas["regrasTermos"]>} } = {}) {
  const all = eventos(db), paciente = porTipo(all, "Paciente", Paciente)
    .filter((x) => x.value.patientId === patientId && x.event.patientId === patientId).at(-1)?.value;
  if (!paciente) return { codigo: "PACIENTE_NAO_ENCONTRADO" as const };
  const patientEvents = eventosVigentes(all.filter((e) => e.patientId === patientId));
  const current = patientEvents.at(-1);
  if (!current) return { codigo: "CONSULTA_NAO_ENCONTRADA" as const };
  const civil = dataCivilDoServico(agora, "-03:00");
  if (civil.estado !== "OK") return { codigo: civil.codigo };
  const lotes = porTipo(all, "TumorLot", TumorLot)
    .filter((x) => x.value.patientId === patientId && x.event.patientId === patientId).map((x) => x.value);
  if (tumorLotId !== undefined && tumorLotId !== null && !lotes.some((lote) => lote.tumorLotId === tumorLotId))
    return { codigo: "TUMOR_LOT_FORA_DO_PACIENTE" as const };
  const lotesNoEncontro = [...new Set(patientEvents.filter((event) => event.encounterId === current.encounterId
    && event.tumorLotId !== null).map((event) => event.tumorLotId!))];
  const loteAmbiguo = tumorLotId === undefined && current.tumorLotId === null && lotesNoEncontro.length > 1;
  const tumorLotSelecionado = tumorLotId !== undefined ? tumorLotId
    : current.tumorLotId ?? (lotesNoEncontro.length === 1 ? lotesNoEncontro[0]! : null);
  const lote = !loteAmbiguo && tumorLotSelecionado
    ? lotes.find((x) => x.tumorLotId === tumorLotSelecionado) ?? null : null;
  const episodios = lote ? porTipo(all, "TreatmentEpisode", TreatmentEpisode)
    .filter((x) => x.event.patientId === patientId && x.event.tumorLotId === lote.tumorLotId
      && x.value.tumorLotId === lote.tumorLotId).map((x) => x.value) : [];
  const episodio = episodios.at(-1) ?? null;
  const ciclos = episodio ? porTipo(all, "Ciclo", Ciclo)
    .filter((x) => x.event.patientId === patientId && x.event.tumorLotId === episodio.tumorLotId
      && x.value.episodioId === episodio.episodioId).map((x) => x.value) : [];
  const todosDrafts = listarDrafts(db, patientId);
  const draftNoEscopo = (payload: unknown): boolean => {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
    const outer = payload as Record<string, unknown>;
    const inner = outer.contexto && typeof outer.contexto === "object" && !Array.isArray(outer.contexto)
      ? outer.contexto as Record<string, unknown> : outer;
    return inner.encounterId === current.encounterId && inner.tumorLotId === (lote?.tumorLotId ?? null);
  };
  // Extraction envelopes await explicit field-by-field medical reconciliation;
  // they must not enter the existing generic confirmation/signature bundle.
  const drafts = todosDrafts.filter((draft) => !(draft.payload && typeof draft.payload === "object"
    && "kind" in draft.payload && ["EXTRACAO_RASCUNHO", "PRESCRICAO_RASCUNHO", "FLASH_RASCUNHO", "FLASH_APAC_RASCUNHO"].includes(String(draft.payload.kind)))
    && draftNoEscopo(draft.payload));
  const docs = drafts.flatMap((draft) => {
    const payload = draft.payload;
    if (!payload || typeof payload !== "object") return [];
    const d = payload as Record<string, unknown>;
    if (typeof d.documentId !== "string" || !Number.isInteger(d.documentVersion)) return [];
    return [{ documentId: d.documentId, documentVersion: d.documentVersion as number,
      titulo: typeof d.titulo === "string" ? d.titulo : "Documento em revisão",
      preMarcado: false, visivel: true }];
  });
  const evolucoesRascunho = drafts.flatMap((draft) => {
    const payload = draft.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
    const value = payload as Record<string, unknown>;
    const review = value.review && typeof value.review === "object" ? value.review as Record<string, unknown> : null;
    const revisaoRegistrada = !!review && all.some((event) => event.operationId === review.operationId
      && event.patientId === patientId && event.encounterId === current.encounterId
      && event.tumorLotId === (lote?.tumorLotId ?? null)
      && (event.revisao === "CONFIRMADO" || event.revisao === "ASSINADO"));
    return value.kind === "EVOLUCAO_RASCUNHO" && typeof value.resumo === "string"
      ? [{ draftId: draft.draftId, revision: draft.revision, status: "RASCUNHO" as const, resumo: value.resumo,
        revisaoRegistrada, somentePreparada: !!value.origem && !revisaoRegistrada }]
      : [];
  });
  const evolucoesRevisadas = evolucoesRascunho.filter((item) => !item.somentePreparada);
  const resumoEvolucao = evolucoesRevisadas.length
    ? evolucoesRevisadas.map((item) => item.resumo).join("\n\n--- Próximo rascunho de evolução ---\n\n")
    : null;
  const fatosRevisados = eventosVigentes(all.filter((event) => event.patientId === patientId
    && event.encounterId === current.encounterId && event.tumorLotId === (lote?.tumorLotId ?? null)
    && (event.revisao === "CONFIRMADO" || event.revisao === "ASSINADO")))
    .filter((event) => event.tipo === "FATO").flatMap((event) => {
    const fact = data(event);
    if (!fact || typeof fact.campo !== "string"
      || (!fact.campo.startsWith("extracao.") && fact.campo !== "TNM")
      || typeof fact.factId !== "string" || typeof fact.sourceType !== "string"
      || typeof fact.sourceId !== "string" || typeof fact.rawEvidence !== "string") return [];
    const domain = typeof fact.domain === "string" ? fact.domain
      : fact.campo === "TNM" ? "stage" : fact.campo.slice("extracao.".length).split(":")[0];
    const parsed = ClinicalFact.safeParse({ id: fact.factId, segmentId: `reviewed:${event.eventId}`,
      patientCandidateId: null, domain,
      value: fact.valor, sourceType: fact.sourceType, evidence: fact.evidence, sourceId: fact.sourceId,
      rawEvidence: fact.rawEvidence, confidence: fact.confidence, requiresConfirmation: fact.requiresConfirmation,
      ...(typeof fact.factDate === "string" ? { date: fact.factDate } : {}),
      ...(typeof fact.page === "number" ? { page: fact.page } : {}),
      ...(typeof fact.regra === "string" ? { regra: fact.regra } : {}) });
    return parsed.success ? [parsed.data] : [];
  });
  const conflitosRevisaoExtracao = Object.entries(reconciliarCampos(fatosRevisados))
    .filter(([, field]) => field.conflict)
    .map(([chave, field]) => ({ chave, dominio: field.domain,
      candidatos: field.candidates.map((fact) => ({ factId: fact.id, sourceId: fact.sourceId,
        valor: fact.value, evidence: fact.evidence, rawEvidence: fact.rawEvidence,
        dataClinica: typeof fact.date === "string" ? normalizarDataCivil(fact.date) : null })) }));
  const textoConflitos = conflitosRevisaoExtracao.length
    ? ["Divergências entre fontes — candidatos preservados, sem eleição automática",
      ...conflitosRevisaoExtracao.flatMap((conflito) => [
        `${conflito.dominio} (${conflito.chave})`,
        ...conflito.candidatos.map((candidate) => `- ${candidate.sourceId}: ${candidate.rawEvidence}`
          + (candidate.dataClinica ? `; data clínica ${candidate.dataClinica}` : "; data clínica NÃO CONSTA")
          + `; valor extraído ${valorCandidatoResumo(candidate.valor)}`),
      ])].join("\n") : null;
  const resumoEvolucaoComConflitos = resumoEvolucao && textoConflitos
    ? `${resumoEvolucao}\n\n${textoConflitos}` : resumoEvolucao;
  // Só resumos cuja revisão foi efetivamente registrada entram em novo documento.
  const resumoRegistrado = evolucoesRascunho.filter((e) => e.revisaoRegistrada).map((e) => e.resumo).join("\n\n");
  const resumoConfirmadoParaDocumento = resumoRegistrado
    ? [resumoRegistrado, ...(textoConflitos ? [textoConflitos] : [])].join("\n\n") : null;
  const pendenciasLeitura = [
    "SNAPSHOT_DE_CAMPOS_NAO_PERSISTIDO", "ALERGIAS_NAO_CARREGADAS", "COMORBIDADES_NAO_CARREGADAS",
    "ALERTAS_NAO_PERSISTIDOS", "DELTA_ANTERIOR_NAO_PROJETADO",
    ...(!lote ? [loteAmbiguo ? "TUMOR_LOT_AMBIGUO_NO_ENCONTRO" : "TUMOR_LOT_NAO_ENCONTRADO"] : []),
    ...(!episodio ? ["EPISODIO_NAO_ENCONTRADO"] : []),
  ];
  const pendenciasCampos = lotes.reduce((n, item) => n + [item.cid, item.topografia, item.histologia, item.finalidadeApac]
    .filter((field) => field.estado === "PENDENTE").length, lote ? 0 : 1);
  // Escopo da consulta: eventos do paciente no lote selecionado ou sem lote (ex.: biópsia, paciente).
  const eventosDaConsulta = all.filter((event) => event.patientId === patientId
    && (event.tumorLotId === null || event.tumorLotId === (lote?.tumorLotId ?? undefined)));
  const alertaPlaquetas = alertaPlaquetasDaConsulta(eventosDaConsulta, config.limiarPlaquetas ?? null);
  const contextoClinico = projetarContextoClinico({ eventos: all, patientId, tumorLotId: lote?.tumorLotId ?? null,
    encounterId: current.encounterId, agora, episodio, ciclo: ciclos.at(-1) ?? null, ...(config.templates ? {templates:config.templates} : {}) });
  const condicionais=projetarCondicionaisClinicas({eventos:all,patientId,tumorLotId:lote?.tumorLotId ?? null,
    encounterId:current.encounterId,agora,programados:ciclos.at(-1)?.itens.map(item=>item.droga) ?? null,
    regras:config.condicionais?.regras ?? [],regrasTermos:config.condicionais?.termos ?? []});
  const avisosCondicionais=condicionais.avaliacoes.filter(r=>r.estado==="AVISO").flatMap(r=>r.motivos);
  const pendenciasCondicionais=condicionais.avaliacoes.filter(r=>r.estado==="PENDENTE").flatMap(r=>r.pendencias);
  const intervalo=projetarIntervaloCiclo({eventos:all,patientId,tumorLotId:lote?.tumorLotId ?? null,
    encounterId:current.encounterId,agora,hoje:civil.dataCivil,episodio,ciclo:ciclos.at(-1) ?? null,templates:config.templates ?? []});
  const interacoesCondicionadas=avaliarInteracoesCondicionadasDaConsulta({eventos:all,patientId,tumorLotId:lote?.tumorLotId ?? null,
    encounterId:current.encounterId,agora,regrasInteracoes:config.interacoes?.interacoes ?? [],...(config.catalogo?{catalogo:config.catalogo}:{})});
  const avisosInteracoesCondicionadas=interacoesCondicionadas.resultados.filter(r=>r.estado==="AVISO");
  const cumulativo=projetarCumulativoClinico({eventos:all,patientId,tumorLotId:lote?.tumorLotId ?? null,
    encounterId:current.encounterId,agora,limites:[],
    programados:ciclos.at(-1)?.itens.map(item=>item.droga).filter(d=>d.trim().toLowerCase()==="doxorrubicina") ?? null});
  const avaliacao = avaliarConsulta({ eventos: all, patientId, tumorLotId: lote?.tumorLotId ?? null,
    encounterId:current.encounterId, agora, hoje:civil.dataCivil, paciente, episodio, ciclo:ciclos.at(-1) ?? null,
    plaquetas:sinalPlaquetas(alertaPlaquetas), salaoRuleset:config.salaoRuleset,
    ...(config.interacoes ? {interacoes:config.interacoes} : {}), ...(config.catalogo ? {catalogo:config.catalogo} : {}),
    ...(config.feveRuleset ? {feveRuleset:config.feveRuleset} : {}),
    ...(interacoesCondicionadas.resultados.length ? {interacoesCondicionadas:{
      estado:avisosInteracoesCondicionadas.length?"VERMELHO" as const:interacoesCondicionadas.resultados.some(r=>r.estado==="PENDENTE")?"PENDENTE" as const:"VERDE" as const,
      motivos:interacoesCondicionadas.resultados.filter(r=>r.estado!=="NAO_APLICAVEL").map(r=>({texto:r.motivo}))}} : {}),
    ...(intervalo.aplicavel !== false ? {intervalo:{estado:intervalo.estado==="AVISO"?"VERMELHO" as const:intervalo.estado==="PENDENTE"?"PENDENTE" as const:"VERDE" as const,
      motivos:intervalo.estado==="SEM_AVISO"?[]:[{texto:`Intervalo do ciclo: ${intervalo.motivo ?? "PENDENTE"}`} ]}} : {}),
    ...(condicionais.avaliacoes.some(r=>r.estado!=="NAO_APLICAVEL") ? {condicionais:{
      estado:avisosCondicionais.length ? "VERMELHO" as const : pendenciasCondicionais.length ? "PENDENTE" as const : "VERDE" as const,
      motivos:[...avisosCondicionais,...pendenciasCondicionais].map(texto=>({texto}))}} : {}) });
  pendenciasLeitura.push(...contextoClinico.pendencias);
  const historicoClinico = projetarHistoricoClinico({ eventos:all,patientId,tumorLotId:lote?.tumorLotId ?? null,
    encounterId:current.encounterId,agora });
  const historicoSistemico = historicoDaConsulta(eventosDaConsulta);
  let documentosComIntegridadePendente = 0;
  const historicoDocumentos = eventosDaConsulta.filter((evento) => evento.tipo === "DOCUMENTO"
    && evento.revisao === "ASSINADO").flatMap((evento) => {
    const envelope = data(evento);
    const corpo = envelope?.data && typeof envelope.data === "object" && !Array.isArray(envelope.data)
      ? envelope.data as Record<string, unknown> : null;
    const assinatura = envelope?.signature && typeof envelope.signature === "object"
      ? envelope.signature as Record<string, unknown> : null;
    if (!corpo || typeof corpo.documentId !== "string" || typeof corpo.texto !== "string"
      || !assinatura || assinatura.documentId !== corpo.documentId
      || assinatura.documentVersion !== corpo.documentVersion
      || assinatura.serverActorId !== evento.criadoPor.id
      || assinatura.documentHash !== hashConteudoExibido(corpo)) {
      documentosComIntegridadePendente++; return [];
    }
    return [{ eventId: evento.eventId, documentId: corpo.documentId,
      titulo: typeof corpo.titulo === "string" ? corpo.titulo : "Documento assinado",
      texto: corpo.texto, assinadoEm: evento.criadoEm, autorId: evento.criadoPor.id,
      encounterId: evento.encounterId }];
  });
  if (documentosComIntegridadePendente) pendenciasLeitura.push("DOCUMENTO_COM_INTEGRIDADE_PENDENTE");
  return {
    hoje: civil.dataCivil, patientId, encounterId: current.encounterId,
    tumorLotId: lote?.tumorLotId ?? null,
    cabecalho: { hoje: civil.dataCivil, paciente, lotes, loteSelecionadoId: lote?.tumorLotId ?? null,
      episodio, ciclo: ciclos.at(-1) ?? null, semaforo: avaliacao.elegibilidade.cor,
      pendentes: pendenciasLeitura.length + pendenciasCampos, contatosDesdeUltima: (() => {
        const contacts = porTipo(all, "Contato", Contato);
        const projected = projetarVinculosContato(contacts, all);
        return contacts.map((x) => contatoUnico(x.value.contatoId, patientId, projected))
          .filter((x): x is Contato => x !== null);
      })(),
      alergiasPaciente: contextoClinico.flash.alergia === "Não informada" ? [] : [contextoClinico.flash.alergia],
      comorbidadesPaciente: Array.isArray(contextoClinico.campos.comorbidades.valor)
        ? contextoClinico.campos.comorbidades.valor.filter((v):v is string=>typeof v === "string") : [] },
    alertas: [], delta: { temSnapshotAnterior: false, itens: [] }, evidencias: [],
    evolucoesRascunho,
    resumoEvolucao: resumoEvolucaoComConflitos,
    resumoConfirmadoParaDocumento,
    retratoTransversal: projetarRetratoTransversal({ patientId, tumorLotId: lote?.tumorLotId ?? null,
      fatos: fatosRevisados }),
    historicoDocumentos,
    conflitosRevisaoExtracao,
    fechamento: { blocoAtual: "EVOLUCAO" as const,
      registros: drafts.map((d) => ({ id: d.draftId, expectedRevision: d.revision })),
      documentos: docs, autorExibido: sessao.crm, alvoImpressao: null, alertasVermelhos: [] },
    estado: "PARCIAL" as const, pendenciasLeitura,
    // W11-H22: calculados aqui, a partir do ledger, com a data do servidor passada explicitamente.
    datasFixas: projetarDatasFixas(eventosDaConsulta, civil.dataCivil),
    historicoTratamento: { ...historicoSistemico,
      linhas:[...historicoSistemico.linhas,...historicoClinico.linhas].sort((a,b)=>(a.data ?? a.periodo?.inicio ?? "").localeCompare(b.data ?? b.periodo?.inicio ?? "")),
      codigo:historicoSistemico.codigo ?? historicoClinico.codigo },
    alertaPlaquetas,
    // W12-F4: Flash calculada do ledger; a data de referência é a do servidor, passada explicitamente.
    flash: { ...projetarFlash(eventosDaConsulta, civil.dataCivil, config.modeloFlash ?? null,
      rascunhoFlashDoContexto(db, { patientId, encounterId: current.encounterId, tumorLotId: lote?.tumorLotId ?? null })),
      ...contextoClinico.flash, avisos:[...avaliacao.avisosFlash,...avisosCondicionais,...avisosInteracoesCondicionadas.map(r=>r.motivo)],sugestoesLaboratorio:avaliacao.sugestoesLaboratorio },
    elegibilidade: avaliacao.elegibilidade,
    avaliacaoClinica: avaliacao,
    condicionaisClinicas:condicionais,
    interacoesCondicionadas,
    intervaloCiclo:intervalo,
    cumulativoClinico:cumulativo,
    camposClinicos: contextoClinico.campos,
    instrumentosClinicos:projetarInstrumentosClinicos({eventos:all,patientId,tumorLotId:lote?.tumorLotId ?? null,
      encounterId:current.encounterId,agora,regras:config.instrumentos ?? []}).avaliacoes,
  };
}
export function lerLotes(db: DatabaseSync, patientId: string) {
  return porTipo(eventos(db), "TumorLot", TumorLot)
    .filter((x) => x.event.patientId === patientId && x.value.patientId === patientId).map((x) => x.value);
}
export function lerAgenda(db: DatabaseSync, agora: string) {
  const civil = dataCivilDoServico(agora, "-03:00");
  if (civil.estado !== "OK") return { codigo: civil.codigo, hoje: null, itens: [], estado: "PENDENTE" as const };
  const all = eventos(db), rows = porTipo(all, "AgendaEntry", AgendaEntry);
  const items = rows.filter(({ event, value }) => value.data === civil.dataCivil
    && event.patientId === value.patientId && event.encounterId === value.encounterId).flatMap(({ value }) => {
    const patient = lerPaciente(db, value.patientId);
    return patient ? [{ horario: value.horario, patientId: value.patientId, encounterId: value.encounterId, nome: patient.nome,
      prontuario: patient.identificadores.find((i) => i.tipo === "PRONTUARIO")?.valor ?? "",
      semaforo: "PENDENTE" as const, pendentes: 1, preConsultaPronta: false,
      contatosDesdeUltima: 0, temE1: false }] : [];
  }).sort((a, b) => a.horario.localeCompare(b.horario));
  return { hoje: civil.dataCivil, itens: items, estado: rows.length ? "PARCIAL" : "FONTE_AUSENTE" };
}
export function lerCanal(db: DatabaseSync) {
  const all = eventos(db), contatos = porTipo(all, "Contato", Contato), rows = porTipo(all, "CanalMessage", CanalMessage);
  const projected = projetarVinculosContato(contatos, all);
  const mensagens = rows.flatMap(({ event, value }) => {
    const registros = projected.filter((c) => c.value.contatoId === value.contatoId);
    if (!registros.length) return [];
    const revogado = registros.some((record) => record.value.revogadoEm !== null);
    const conflict = registros.length > 1 || registros.some((record) => record.estadoVinculo === "CONFLITO");
    const allTargets = [...new Set(registros.flatMap((record) => record.candidatosVinculo))];
    const resolved = registros.filter((record) => record.estadoVinculo === "VINCULADO");
    const linkedPatientId = !revogado && !conflict && resolved.length === 1 ? resolved[0]!.patientIdResolvido : null;
    // A persisted payload identity and the event envelope are independent evidence.
    // Never let a Contact projection silently move a message across either boundary.
    const sourceMismatch = value.patientId !== null && event.patientId !== value.patientId;
    const projectedMismatch = value.patientId !== null && linkedPatientId !== null
      && linkedPatientId !== value.patientId;
    const unresolvedPayloadIdentity = value.patientId !== null && linkedPatientId === null && !revogado;
    const hasConflict = conflict || sourceMismatch || projectedMismatch || unresolvedPayloadIdentity;
    const patientId = revogado || hasConflict ? null : linkedPatientId;
    const patient = patientId ? lerPaciente(db, patientId) : null;
    if (patientId && !patient) return [];
    const candidatos = revogado ? [] : hasConflict
      ? [...new Set([...allTargets, ...(value.patientId ? [value.patientId] : []), event.patientId])]
      : allTargets.length ? allTargets
      : [...new Set(all.filter((candidate) => candidate.tipo === "Paciente").map((candidate) => candidate.patientId))];
    return [{ mensagemId: value.mensagemId, texto: value.texto, em: value.em, redFlag: value.redFlag,
      contatoId: value.contatoId, patientId, nomePaciente: patient?.nome ?? null,
      estadoVinculo: revogado ? "REVOGADO" as const : hasConflict ? "CONFLITO" as const
        : patientId ? "VINCULADO" as const : "SEM_VINCULO" as const,
      candidatos: candidatos.flatMap((patientId) => { const cadastro = lerPaciente(db, patientId);
        return cadastro ? [{ patientId, nome: cadastro.nome }] : []; }) }];
  });
  return { mensagens, estado: mensagens.length ? "PARCIAL" : rows.length ? "PENDENTE" : "FONTE_AUSENTE" };
}
export function validarCatalogoApac(caixas: readonly CaixaNumerada[]):
  | { estado: "DISPONIVEL"; caixas: readonly CaixaNumerada[] }
  | { estado: "PENDENTE" } {
  const caixasApac = caixas.filter((caixa) => caixa.chave.startsWith("apac."));
  const chaves = new Set(caixasApac.map((caixa) => caixa.chave));
  if (!CAMPOS_OBRIGATORIOS_PADRAO.every((campo) => chaves.has(`apac.${campo}`))) return { estado: "PENDENTE" };
  return { estado: "DISPONIVEL", caixas: caixasApac };
}

export function lerApacs(db: DatabaseSync, agora: string, config: {
  caixas: readonly CaixaNumerada[]; sigtap: TabelasSigtap; cnesConfigurado: string;
}) {
  const all = eventos(db), apacs = apacTimeline(all);
  const catalogoApac = validarCatalogoApac(config.caixas);
  const civil = dataCivilDoServico(agora, "-03:00");
  if (civil.estado !== "OK") return { hoje: null, itens: [], estado: "PENDENTE", codigo: civil.codigo };
  const lots = porTipo(all, "TumorLot", TumorLot), patients = porTipo(all, "Paciente", Paciente);
  return { hoje: civil.dataCivil, itens: apacs.flatMap((apac) => {
    const event = all.find((e) => e.eventId === apac.eventId);
    const lote = lots.find((x) => x.value.tumorLotId === apac.tumorLotId
      && x.event.patientId === event?.patientId)?.value;
    if (!lote) return [];
    const paciente = patients.find((x) => x.value.patientId === lote.patientId
      && x.event.patientId === lote.patientId)?.value;
    if (!paciente || !event || event.patientId !== paciente.patientId) return [];
    let prazo: ReturnType<typeof apacPrazo> | null = null;
    try { prazo = apacPrazo(apac.dataGeracaoApp, civil.dataCivil, null); } catch { /* malformed civil date stays pending */ }
    const doLote = apacs.filter((other) => other.competencia === apac.competencia);
    const resultadoAntiglosa = catalogoApac.estado === "DISPONIVEL"
      ? antiglosa(apac, { hoje: civil.dataCivil, sigtap: config.sigtap, caixas: catalogoApac.caixas,
        cnesConfigurado: config.cnesConfigurado, apacsDoLote: doLote }) : null;
    return [{ apac, lote, nomePaciente: paciente.nome, patientId: paciente.patientId,
      encounterId: event.encounterId,
      ultimoAvisoEm: null, campoOrigem: null,
      motivoNegativa: apac.resultadoExterno?.valor === "NEGADA" ? apac.resultadoExterno.motivo : null,
      prazo: prazo ? { ...prazo, estado: prazo.dias < 0 ? "PENDENTE" : prazo.estado } : { estado: "PENDENTE" },
      antiglosa: resultadoAntiglosa,
      antiglosaEstado: resultadoAntiglosa ? "AVALIADA_COM_TABELA_SIGTAP_AUSENTE" : "PENDENTE_CATALOGO_AUSENTE" }];
  }), estado: apacs.length ? "PARCIAL" : "FONTE_AUSENTE" };
}
export function lerConversas(db: DatabaseSync) {
  const all = eventos(db), conversations = porTipo(all, "Conversation", Conversation)
    .filter((x) => x.event.patientId === x.value.patientId);
  const contacts = porTipo(all, "Contato", Contato);
  const projected = projetarVinculosContato(contacts, all);
  return conversations.map(({ value }) => {
    const links = projected.filter((item) => item.value.contatoId === value.contatoId);
    const link = links.length === 1 && links[0]!.estadoVinculo === "VINCULADO" ? links[0]! : null;
    return { value: link && link.patientIdResolvido ? { ...value, patientId: link.patientIdResolvido } : value,
      contato: link?.value ?? null };
  });
}
export function lerTriagens(db: DatabaseSync) {
  const persisted = porTipo(eventos(db), "Triagem", Triagem).filter(({ event, value }) =>
    event.patientId === value.patientId && event.encounterId === value.encounterId).map(({ event, value }) => ({
    patientId: value.patientId, encounterId: value.encounterId, chegadaEm: value.chegadaEm,
    paciente: lerPaciente(db, value.patientId), triagem: value, fontes: event.fontes, eventId: event.eventId,
    draftId: null as string | null, revision: null as number | null, criadoEm: event.criadoEm,
  }));
  const drafts = listarDrafts(db).flatMap((draft) => {
    const payload = draft.payload && typeof draft.payload === "object" && !Array.isArray(draft.payload)
      ? draft.payload as Record<string, unknown> : null;
    if (payload?.kind !== "SALAO_TRIAGEM_RASCUNHO" || !payload.triagem) return [];
    const triagem = Triagem.safeParse(payload.triagem);
    if (!triagem.success || !draft.patientId || draft.patientId !== triagem.data.patientId) return [];
    const contexto = payload.contexto && typeof payload.contexto === "object"
      ? payload.contexto as Record<string, unknown> : null;
    if (!contexto || contexto.encounterId !== triagem.data.encounterId) return [];
    const paciente = lerPaciente(db, draft.patientId);
    if (!paciente) return [];
    const fontes = [triagem.data.pas, triagem.data.fc, triagem.data.spo2, triagem.data.tempDecimos,
      triagem.data.hbDgDl, triagem.data.anc, triagem.data.plq, triagem.data.coletaHemograma,
      triagem.data.ecog, triagem.data.grauCtcae].flatMap((field) => field.fontes);
    const fonteTriagem = Fonte.safeParse(payload.source);
    if (fonteTriagem.success && !fontes.length) fontes.push(fonteTriagem.data);
    return [{ patientId: draft.patientId, encounterId: triagem.data.encounterId,
      chegadaEm: triagem.data.chegadaEm, paciente, triagem: triagem.data, fontes,
      eventId: null as string | null, draftId: draft.draftId, revision: draft.revision,
      criadoEm: draft.criadoEm }];
  });
  // Preserve every event and draft. The Salon projection scopes by clinical arrival
  // date and marks multiple same-day entries pending; createdAt is not a clinical
  // ordering signal and must never erase a duplicate or an older clinical arrival.
  return [...persisted, ...drafts].map(({ criadoEm: _criadoEm, ...item }) => item);
}
export function lerSalao(db: DatabaseSync, agora: string, rulesetInput: unknown) {
  const civil = dataCivilDoServico(agora, "-03:00");
  const parsedRuleset = SalaoRuleset.safeParse(rulesetInput);
  const triagensTodas = lerTriagens(db);
  const agendaHoje = lerAgenda(db, agora).itens;
  const agendaOrdem = new Map(agendaHoje.map((item, index) =>
    [JSON.stringify([item.patientId, item.encounterId]), index] as const));
  const agendaCandidatos = agendaHoje.flatMap((item) => {
    if (triagensTodas.some((triagem) => triagem.patientId === item.patientId && triagem.encounterId === item.encounterId)) return [];
    const paciente = lerPaciente(db, item.patientId);
    if (!paciente) return [];
    const hoje = civil.estado === "OK" ? civil.dataCivil : `${agora.slice(0, 10)}`;
    return [{ patientId: item.patientId, encounterId: item.encounterId, chegadaEm: `${hoje}T${item.horario}:00-03:00`,
      nome: paciente.nome, draftId: null, revision: null, estadoRascunho: null }];
  });
  const allEvents = eventos(db);
  const decisoes = allEvents.flatMap((event) => {
    if (event.tipo !== "ReviewDecision") return [];
    const value = data(event) as Record<string, unknown> | null;
    return value?.campo === "liberacaoComCorteSalao" && typeof value.motivo === "string"
      ? [{ patientId: event.patientId, motivo: value.motivo, encounterId: event.encounterId,
        eventId: event.eventId, draftId: typeof value.triagemDraftId === "string" ? value.triagemDraftId : null,
        revision: typeof value.triagemRevision === "number" ? value.triagemRevision : null }] : [];
  });
  if (civil.estado !== "OK" || !parsedRuleset.success) {
    return { codigo: civil.estado === "PENDENTE" ? civil.codigo : "RULESET_SALAO_INVALIDO",
      hoje: null, estado: "PENDENTE" as const, motivo: "RULESET_OU_DATA_CIVIL_INDISPONIVEL",
      pacientes: [...triagensTodas.map((p) => ({ patientId: p.patientId, encounterId: p.encounterId,
      chegadaEm: p.chegadaEm, nome: p.paciente?.nome ?? "", draftId: p.draftId, revision: p.revision,
      estadoRascunho: p.draftId ? "RASCUNHO" as const : null })), ...agendaCandidatos], cartoes: [], decisoes };
  }
  const doDia = triagensTodas.filter((item) => {
    const data = dataCivilDoServico(item.chegadaEm, "-03:00");
    return data.estado === "OK" && data.dataCivil === civil.dataCivil;
  });
  const porPaciente = new Map<string, typeof doDia>();
  for (const item of doDia) porPaciente.set(item.patientId, [...(porPaciente.get(item.patientId) ?? []), item]);
  const triagens = [...porPaciente.values()].filter((items) => items.length === 1).map((items) => items[0]!);
  const pacientesComTriagemDuplicada = [...porPaciente.values()].filter((items) => items.length > 1)
    .map((items) => ({ patientId: items[0]!.patientId, encounterId: items[0]!.encounterId, chegadaEm: items[0]!.chegadaEm,
      paciente: items[0]!.paciente, triagemDuplicada: true }));
  const ruleset = parsedRuleset.data;
  const contexto: ContextoTriagem = { hoje: civil.dataCivil, prescricaoVigente: null,
    requisitosAplicaveis: ["pas", "fc", "spo2", "tempDecimos", "hbDgDl", "anc", "plq", "coletaHemograma", "ecog", "grauCtcae"] };
  const calculados = triagens.flatMap((p) => {
    if (!p.paciente || !p.fontes[0]) return [];
    const fontesSalao = coletarFontesSalao({eventos:allEvents,patientId:p.patientId,encounterId:p.encounterId,hoje:civil.dataCivil,agora});
    const base = avaliarTriagem(p.triagem, {...contexto,prescricaoVigente:fontesSalao.prescricaoVigente}, ruleset);
    const brutoPortao = avaliarCorteSalao(p.triagem, { pad: fontesSalao.pad, crCentesimos: fontesSalao.creatininaCentesimos }, ruleset);
    // D-W9-82: ausência do dado não coletado no salão vira aviso, sem encaminhamento universal.
    // Plausibilidade/conflito de dados presentes e os outros critérios não são suprimidos.
    const portao = {...brutoPortao,pendentes:brutoPortao.pendentes.filter(m =>
      !(fontesSalao.creatininaCentesimos === null && m.codigo === "pendente.corteSalao.cr.alta")
      && !(fontesSalao.pad === null && m.codigo === "pendente.corteSalao.pad.alta"))};
    const temCorte = base.cortes.length > 0 || portao.motivos.length > 0;
    const temPendencia = base.pendentes.length > 0 || portao.pendentes.length > 0;
    const destino = temCorte || temPendencia ? "FILA_MEDICO" as const : base.destino;
    return [{ card: { entrada: { patientId: p.patientId, ecog: p.triagem.ecog.valor,
      recurso: p.triagem.recurso, idadeAnos: p.triagem.idadeAnos, chegadaEm: p.chegadaEm },
      destino, emergencia: base.emergencia, temCorte, nome: p.paciente.nome },
      base, portao, fonte: p.fontes[0], avisos:fontesSalao.avisos.map(texto=>({patientId:p.patientId,texto})) }];
  });
  const ordenadas = ordenarFila(calculados.map((x) => x.card.entrada), ruleset);
  const byPatient = new Map(calculados.map((x) => [x.card.entrada.patientId, x.card]));
  const cartoes = ordenadas.flatMap((e) => { const c = byPatient.get(e.patientId); return c ? [c] : []; });
  const decisionesVisiveis = decisoes.map(({ patientId, motivo }) => ({ patientId, motivo }));
  const pacientesBase = [...[...triagens, ...pacientesComTriagemDuplicada].map((p) => ({ patientId: p.patientId, encounterId: p.encounterId,
    chegadaEm: p.chegadaEm, nome: p.paciente?.nome ?? "",
    draftId: "draftId" in p ? p.draftId : null, revision: "revision" in p ? p.revision : null,
    estadoRascunho: "draftId" in p && p.draftId
      ? (decisoes.some((decision) => decision.patientId === p.patientId && decision.encounterId === p.encounterId
        && decision.draftId === p.draftId && decision.revision !== null && decision.revision + 1 === p.revision)
        ? "DECISAO_REGISTRADA" as const : "RASCUNHO" as const) : null })),
    ...agendaCandidatos.filter((agenda) => !triagens.some((triagem) => triagem.patientId === agenda.patientId
      && triagem.encounterId === agenda.encounterId))];
  const pacientesOrdenados = pacientesBase.sort((a, b) => {
    const ordemA = agendaOrdem.get(JSON.stringify([a.patientId, a.encounterId]));
    const ordemB = agendaOrdem.get(JSON.stringify([b.patientId, b.encounterId]));
    if (ordemA !== undefined || ordemB !== undefined) {
      if (ordemA === undefined) return 1;
      if (ordemB === undefined) return -1;
      return ordemA - ordemB;
    }
    return Date.parse(a.chegadaEm) - Date.parse(b.chegadaEm);
  });
  return { hoje: civil.dataCivil, ruleset, contexto, fonte: calculados[0]?.fonte ?? null,
    cartoes, pacientes: pacientesOrdenados, decisoes: decisionesVisiveis,
    avisos:calculados.flatMap(x=>x.avisos),
    estado: "PARCIAL" as const,
    pendencias: [...calculados.flatMap((x) => [...x.base.pendentes, ...x.portao.pendentes]),
      ...pacientesComTriagemDuplicada.map(() => ({ codigo: "TRIAGEM_DUPLICADA", estado: "PENDENTE" as const }))] };
}
export function lerMensagensChat(db: DatabaseSync, setor: SetorChat, contexto: { patientId: string; encounterId: string }) {
  return porTipo(eventos(db), "ChatMessage", ChatMessage).filter((m) => m.value.setor === setor
    && m.value.patientId === contexto.patientId && m.value.encounterId === contexto.encounterId
    && m.event.patientId === contexto.patientId && m.event.encounterId === contexto.encounterId)
    .map((m) => ({ mensagemId: m.value.mensagemId, autor: m.value.autor, texto: m.value.texto }));
}
export function lerRecist(db: DatabaseSync, patientId: string) {
  const all = eventos(db), patientEvents = all.filter((e) => e.patientId === patientId);
  const series = porTipo(all, "RecistSerie", RecistSerieSchema).filter(({ event, value }) =>
    event.patientId === patientId && value.patientId === patientId);
  if (!patientEvents.length) return { estado: "PENDENTE", codigo: "PACIENTE_NAO_ENCONTRADO", series: [] };
  if (!series.length) return { estado: "PENDENTE", codigo: "SERIE_RECIST_AUSENTE", series: [] };
  const byId = new Map(all.map((e) => [e.eventId, e]));
  const sourceIds = new Set(patientEvents.flatMap((e) => e.fontes.map((f) => f.sourceId)));
  return { estado: "PARCIAL", series: series.map(({ value }) => {
    const scoped = value.pontos.every((p) => {
      const event = byId.get(p.eventId);
      return p.patientId === patientId && event?.patientId === patientId
        && event.tumorLotId === p.tumorLotId && p.tumorLotId === value.tumorLotId
        && p.episodioId === value.episodioId;
    });
    const provenance = [...value.alvos.flatMap((a) => a.fonteElegibilidadeIds),
      ...value.pontos.flatMap((p) => [...p.fonteIds, ...p.lesoes.flatMap((l) => l.fonteIds)])];
    if (!scoped || provenance.some((id) => !sourceIds.has(id))) {
      return { estado: "PENDENTE", codigo: "ESCOPO_OU_PROVENIENCIA_INVALIDA", resultado: null };
    }
    const resultado = avaliarSerieRecist(value as RecistSerieInput);
    return { estado: resultado.estado, resultado, categoriaNuncaAssinada: true };
  }) };
}
export const validadoresLeitura = { Paciente, Contato, TumorLot, Triagem, TreatmentEpisode, Ciclo, Apac, Conversation };
