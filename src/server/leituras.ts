import type { DatabaseSync } from "node:sqlite";
import { z, type ZodType } from "zod";
import { DataCivil } from "../contracts/base.js";
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
import { antiglosa } from "../apac/antiglosa.js";
import type { CaixaNumerada } from "../contracts/w10/clinico-w10.js";
import type { TabelasSigtap } from "../apac/sigtap.js";
import { avaliarSerieRecist, type RecistSerieInput } from "../rules/recist/index.js";
import { ClinicalFact } from "../contracts/w10/extracao.js";
import { reconciliarCampos } from "../kernel/extracao/reconciliacao.js";
import { normalizarDataCivil } from "../kernel/extracao/normalizacao.js";

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
function contatoUnico(contatos: readonly { event: ReturnType<typeof eventos>[number]; value: Contato }[],
  contatoId: string, patientId: string) {
  const matches = contatos.filter((c) => c.value.contatoId === contatoId
    && c.event.patientId === patientId);
  if (matches.length !== 1) return null;
  const contato = matches[0]!.value;
  return contato.revogadoEm === null ? contato : null;
}

export function lerPaciente(db: DatabaseSync, patientId: string) {
  return porTipo(eventos(db), "Paciente", Paciente)
    .filter((x) => x.value.patientId === patientId && x.event.patientId === patientId).at(-1)?.value ?? null;
}
export function lerConsulta(db: DatabaseSync, patientId: string, agora: string, sessao: Sessao,
  tumorLotId?: string | null) {
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
    && "kind" in draft.payload && ["EXTRACAO_RASCUNHO", "PRESCRICAO_RASCUNHO"].includes(String(draft.payload.kind)))
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
  const pendenciasLeitura = [
    "SNAPSHOT_DE_CAMPOS_NAO_PERSISTIDO", "ALERGIAS_NAO_CARREGADAS", "COMORBIDADES_NAO_CARREGADAS",
    "ALERTAS_NAO_PERSISTIDOS", "DELTA_ANTERIOR_NAO_PROJETADO",
    ...(!lote ? [loteAmbiguo ? "TUMOR_LOT_AMBIGUO_NO_ENCONTRO" : "TUMOR_LOT_NAO_ENCONTRADO"] : []),
    ...(!episodio ? ["EPISODIO_NAO_ENCONTRADO"] : []),
  ];
  const pendenciasCampos = lotes.reduce((n, item) => n + [item.cid, item.topografia, item.histologia, item.finalidadeApac]
    .filter((field) => field.estado === "PENDENTE").length, lote ? 0 : 1);
  return {
    hoje: civil.dataCivil, patientId, encounterId: current.encounterId,
    tumorLotId: lote?.tumorLotId ?? null,
    cabecalho: { hoje: civil.dataCivil, paciente, lotes, loteSelecionadoId: lote?.tumorLotId ?? null,
      episodio, ciclo: ciclos.at(-1) ?? null, semaforo: "PENDENTE" as const,
      pendentes: pendenciasLeitura.length + pendenciasCampos, contatosDesdeUltima: (() => {
        const contacts = porTipo(all, "Contato", Contato).filter((x) => x.event.patientId === patientId
          && x.value.patientId === patientId);
        return contacts.map((x) => contatoUnico(contacts, x.value.contatoId, patientId))
          .filter((x): x is Contato => x !== null);
      })(),
      alergiasPaciente: [], comorbidadesPaciente: [] },
    alertas: [], delta: { temSnapshotAnterior: false, itens: [] }, evidencias: [],
    evolucoesRascunho,
    resumoEvolucao: resumoEvolucaoComConflitos,
    conflitosRevisaoExtracao,
    fechamento: { blocoAtual: "EVOLUCAO" as const,
      registros: drafts.map((d) => ({ id: d.draftId, expectedRevision: d.revision })),
      documentos: docs, autorExibido: sessao.crm, alvoImpressao: null, alertasVermelhos: [] },
    estado: "PARCIAL" as const, pendenciasLeitura,
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
    return patient ? [{ horario: value.horario, patientId: value.patientId, nome: patient.nome,
      prontuario: patient.identificadores.find((i) => i.tipo === "PRONTUARIO")?.valor ?? "",
      semaforo: "PENDENTE" as const, pendentes: 1, preConsultaPronta: false,
      contatosDesdeUltima: 0, temE1: false }] : [];
  }).sort((a, b) => a.horario.localeCompare(b.horario));
  return { hoje: civil.dataCivil, itens: items, estado: rows.length ? "PARCIAL" : "FONTE_AUSENTE" };
}
export function lerCanal(db: DatabaseSync) {
  const all = eventos(db), contatos = porTipo(all, "Contato", Contato), rows = porTipo(all, "CanalMessage", CanalMessage);
  const mensagens = rows.flatMap(({ event, value }) => {
    if (event.patientId !== value.patientId) return [];
    const contato = contatoUnico(contatos, value.contatoId, event.patientId);
    if (!contato) return [];
    const linkedPatientId = contato.patientId === value.patientId ? value.patientId : null;
    const patient = linkedPatientId ? lerPaciente(db, linkedPatientId) : null;
    return [{ mensagemId: value.mensagemId, texto: value.texto, em: value.em, redFlag: value.redFlag,
      contatoId: value.contatoId, patientId: linkedPatientId, nomePaciente: patient?.nome ?? null,
      candidatos: [] }];
  });
  return { mensagens, estado: mensagens.length ? "PARCIAL" : rows.length ? "PENDENTE" : "FONTE_AUSENTE" };
}
export function lerApacs(db: DatabaseSync, agora: string, config: {
  caixas: readonly CaixaNumerada[]; sigtap: TabelasSigtap; cnesConfigurado: string;
}) {
  const all = eventos(db), apacs = apacTimeline(all);
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
    const resultadoAntiglosa = config.caixas.length === 47
      ? antiglosa(apac, { hoje: civil.dataCivil, sigtap: config.sigtap, caixas: config.caixas,
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
  return conversations.map(({ event, value }) => ({ value,
    contato: contatoUnico(contacts, value.contatoId, event.patientId) }));
}
export function lerTriagens(db: DatabaseSync) {
  return porTipo(eventos(db), "Triagem", Triagem).filter(({ event, value }) =>
    event.patientId === value.patientId && event.encounterId === value.encounterId).map(({ event, value }) => ({
    patientId: value.patientId, encounterId: value.encounterId, chegadaEm: value.chegadaEm,
    paciente: lerPaciente(db, value.patientId), triagem: value, fontes: event.fontes, eventId: event.eventId,
  }));
}
export function lerSalao(db: DatabaseSync, agora: string, rulesetInput: unknown) {
  const civil = dataCivilDoServico(agora, "-03:00");
  const parsedRuleset = SalaoRuleset.safeParse(rulesetInput);
  const triagensTodas = lerTriagens(db);
  if (civil.estado !== "OK" || !parsedRuleset.success) {
    return { codigo: civil.estado === "PENDENTE" ? civil.codigo : "RULESET_SALAO_INVALIDO",
      hoje: null, estado: "PENDENTE" as const, motivo: "RULESET_OU_DATA_CIVIL_INDISPONIVEL",
      pacientes: triagensTodas.map((p) => ({ patientId: p.patientId, encounterId: p.encounterId,
        chegadaEm: p.chegadaEm, nome: p.paciente?.nome ?? "" })), cartoes: [], decisoes: [] };
  }
  const doDia = triagensTodas.filter((item) => {
    const data = dataCivilDoServico(item.chegadaEm, "-03:00");
    return data.estado === "OK" && data.dataCivil === civil.dataCivil;
  });
  const porPaciente = new Map<string, typeof doDia>();
  for (const item of doDia) porPaciente.set(item.patientId, [...(porPaciente.get(item.patientId) ?? []), item]);
  const triagens = [...porPaciente.values()].filter((items) => items.length === 1).map((items) => items[0]!);
  const pacientesComTriagemDuplicada = [...porPaciente.values()].filter((items) => items.length > 1)
    .map((items) => ({ patientId: items[0]!.patientId, encounterId: "", chegadaEm: items[0]!.chegadaEm,
      paciente: items[0]!.paciente, triagemDuplicada: true }));
  const ruleset = parsedRuleset.data;
  const contexto: ContextoTriagem = { hoje: civil.dataCivil, prescricaoVigente: null,
    requisitosAplicaveis: ["pas", "fc", "spo2", "tempDecimos", "hbDgDl", "anc", "plq", "coletaHemograma", "ecog", "grauCtcae"] };
  const calculados = triagens.flatMap((p) => {
    if (!p.paciente || !p.fontes[0]) return [];
    const base = avaliarTriagem(p.triagem, contexto, ruleset);
    const portao = avaliarCorteSalao(p.triagem, { pad: null, crCentesimos: null }, ruleset);
    const temCorte = base.cortes.length > 0 || portao.motivos.length > 0;
    const temPendencia = base.pendentes.length > 0 || portao.pendentes.length > 0;
    const destino = temCorte || temPendencia ? "FILA_MEDICO" as const : base.destino;
    return [{ card: { entrada: { patientId: p.patientId, ecog: p.triagem.ecog.valor,
      recurso: p.triagem.recurso, idadeAnos: p.triagem.idadeAnos, chegadaEm: p.chegadaEm },
      destino, emergencia: base.emergencia, temCorte, nome: p.paciente.nome },
      base, portao, fonte: p.fontes[0] }];
  });
  const ordenadas = ordenarFila(calculados.map((x) => x.card.entrada), ruleset);
  const byPatient = new Map(calculados.map((x) => [x.card.entrada.patientId, x.card]));
  const cartoes = ordenadas.flatMap((e) => { const c = byPatient.get(e.patientId); return c ? [c] : []; });
  return { hoje: civil.dataCivil, ruleset, contexto, fonte: calculados[0]?.fonte ?? null,
    cartoes, pacientes: [...triagens, ...pacientesComTriagemDuplicada].map((p) => ({ patientId: p.patientId, encounterId: p.encounterId,
      chegadaEm: p.chegadaEm, nome: p.paciente?.nome ?? "" })), decisoes: [],
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
