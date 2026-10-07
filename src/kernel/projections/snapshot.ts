import type { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import type { ClinicalEvent } from "../../contracts/operacao.js";
import { listarEventos } from "../ledger/ledger.js";

export interface RulesetRef { id: string; version: string; hash: string }
export interface StageHistoryEntry {
  valor: string;
  eventId: string;
  data: string | null;
  sourceIds: string[];
  revisaoOriginal: ClinicalEvent["revisao"];
  superseded: boolean;
}
export interface ValorProjetado {
  valor: unknown;
  eventIds: string[];
  estado: "VERDE" | "VERMELHO" | "PENDENTE";
  candidatos?: { valor: unknown; eventId: string }[];
  /** A08: proposta CURRENT fica ao lado do fato; nunca o substitui nem apaga conflito. */
  proposta?: { valor: unknown; sourceId: string };
  /** Histórico apenas para observação explicitamente clínica e datada. */
  observacoes?: { valor: unknown; eventId: string; dataClinica: string }[];
}

/** Só CONFIRMADO/ASSINADO vira fato projetado (A06); substituídos saem (A05). Usado por snapshot e séries. */
export function eventosVigentes(eventos: readonly ClinicalEvent[]): ClinicalEvent[] {
  const confirmados = eventos.filter((e) => e.revisao === "CONFIRMADO" || e.revisao === "ASSINADO");
  const substituidos = new Set(confirmados.map((e) => e.supersedesEventId).filter((id): id is string => !!id));
  return confirmados.filter((e) => !substituidos.has(e.eventId));
}
export interface CaseSnapshot {
  kind: "CURRENT" | "CONFIRMED";
  patientId: string;
  tumorLotId: string | null;
  encounterId: string;
  projectionVersion: string;
  rulesetRefs: RulesetRef[];
  campos: Record<string, ValorProjetado>;
  /** Avaliações TNM preservadas mesmo quando uma versão foi supersedida. */
  stageHistory?: StageHistoryEntry[];
  eventIds: string[];
  contentHash: string;
}
export interface PropostaCurrent { campo: string; valor: unknown; sourceId: string }

export function dadosDoEvento(evento: ClinicalEvent): Record<string, unknown> | null {
  const wrapper = evento.payload;
  if (!wrapper || typeof wrapper !== "object" || !("data" in wrapper)) return null;
  const data = wrapper.data;
  return data && typeof data === "object" && !Array.isArray(data)
    ? data as Record<string, unknown> : null;
}

function refsDoEvento(data: Record<string, unknown>): RulesetRef[] {
  if (!Array.isArray(data.rulesetRefs)) return [];
  return data.rulesetRefs.filter((v): v is RulesetRef =>
    !!v && typeof v === "object"
    && typeof v.id === "string" && typeof v.version === "string" && typeof v.hash === "string"
    && !!v.hash);
}

function observacaoClinicaDatada(data: Record<string, unknown>): string | null {
  if (data.observacaoDatada !== true || typeof data.dataClinica !== "string") return null;
  const dia = data.dataClinica.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return null;
  const parsed = new Date(`${dia}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === dia ? dia : null;
}

function tnmHistory(eventos: readonly ClinicalEvent[]): StageHistoryEntry[] {
  const confirmados = eventos.filter((evento) => evento.revisao === "CONFIRMADO" || evento.revisao === "ASSINADO");
  const superseded = new Set(confirmados.map((evento) => evento.supersedesEventId)
    .filter((id): id is string => !!id));
  return confirmados.flatMap((evento) => {
    const data = dadosDoEvento(evento);
    if (!data || typeof data.campo !== "string" || !/^TNM$/iu.test(data.campo.trim())) return [];
    const valor = data.valor;
    const texto = typeof valor === "string" ? valor
      : valor && typeof valor === "object" && "literal" in valor
        && typeof (valor as { literal?: unknown }).literal === "string"
        ? (valor as { literal: string }).literal : "";
    if (!texto.trim()) return [];
    const sourceIds = evento.fontes.map((fonte) => fonte.sourceId);
    return [{ valor: texto, eventId: evento.eventId,
      data: typeof data.dataClinica === "string" ? data.dataClinica : null,
      sourceIds: [...new Set(sourceIds)].sort(), revisaoOriginal: evento.revisao,
      superseded: superseded.has(evento.eventId) }];
  }).sort((a, b) => (a.data ?? "9999").localeCompare(b.data ?? "9999")
    || a.eventId.localeCompare(b.eventId));
}

/** Pure replay of CONFIRMED/ASSINADO events; CURRENT overlays remain ephemeral. */
export function projetarSnapshot(
  eventos: readonly ClinicalEvent[], patientId: string, tumorLotId: string | null,
  encounterId: string, projectionVersion: string, propostas: readonly PropostaCurrent[] = [],
): CaseSnapshot {
  const alvo = eventos.filter((e) => e.patientId === patientId && e.encounterId === encounterId);
  // Instante aceita offsets: a ordem temporal não é a ordem lexical do ISO.
  // A data civil permanece responsabilidade das funções com fuso injetado.
  const cutoff = alvo.reduce((max, e) => Math.max(max, Date.parse(e.criadoEm)), -Infinity);
  // A substituição só tem autoridade dentro do horizonte da consulta projetada.
  // Uma correção de consulta futura não remove o evento da consulta histórica.
  const noHorizonte = eventos.filter((e) => e.patientId === patientId
    && (e.tumorLotId === tumorLotId || e.tumorLotId === null)
    && (!alvo.length || Date.parse(e.criadoEm) <= cutoff));
  const relevantes = eventosVigentes(noHorizonte);
  const campos: Record<string, ValorProjetado> = Object.create(null);
  const refs = new Map<string, RulesetRef>();
  const observacoesPorCampo = new Map<string, { valor: unknown; eventId: string; dataClinica: string }[]>();
  for (const e of relevantes) {
    const data = dadosDoEvento(e);
    if (!data) continue;
    for (const ref of refsDoEvento(data)) refs.set(`${ref.id}\0${ref.version}\0${ref.hash}`, ref);
    const campo = data.campo;
    if (typeof campo !== "string" || !campo) continue;
    const valor = data.valor ?? null;
    const dataClinica = observacaoClinicaDatada(data);
    if (dataClinica) {
      const historico = observacoesPorCampo.get(campo) ?? [];
      historico.push({ valor, eventId: e.eventId, dataClinica });
      observacoesPorCampo.set(campo, historico);
      continue;
    }
    const anterior = campos[campo];
    const estadoBase = valor === null ? "PENDENTE" as const : "VERDE" as const; // A07: ausente nunca é VERDE
    if (!anterior) {
      campos[campo] = { valor, eventIds: [e.eventId], estado: estadoBase };
    } else if (JSON.stringify(anterior.valor) === JSON.stringify(valor) && anterior.estado !== "VERMELHO") {
      anterior.eventIds.push(e.eventId);
    } else {
      const candidatos = anterior.candidatos ?? anterior.eventIds.map((eventId) => ({ valor: anterior.valor, eventId }));
      candidatos.push({ valor, eventId: e.eventId });
      campos[campo] = { valor: null, estado: "VERMELHO",
        eventIds: [...anterior.eventIds, e.eventId], candidatos };
    }
  }
  // Só este formato explícito recebe ordenação temporal. Datas desconhecidas,
  // outros campos e observações sem o marcador continuam sujeitos à política
  // normal de conflito. A data mais recente organiza a vista, não cria dado.
  for (const [campo, atuais] of observacoesPorCampo) {
    const eventosConfirmados = noHorizonte.filter((e) => e.revisao === "CONFIRMADO" || e.revisao === "ASSINADO");
    const todos = eventosConfirmados.flatMap((e) => {
      const dado = dadosDoEvento(e);
      if (!dado || dado.campo !== campo) return [];
      const dataClinica = observacaoClinicaDatada(dado);
      return dataClinica ? [{ valor: dado.valor ?? null, eventId: e.eventId, dataClinica }] : [];
    }).sort((a, b) => a.dataClinica.localeCompare(b.dataClinica) || a.eventId.localeCompare(b.eventId));
    const ultimaData = atuais.reduce((max, item) => item.dataClinica > max ? item.dataClinica : max, "");
    const doDia = atuais.filter((item) => item.dataClinica === ultimaData)
      .sort((a, b) => a.eventId.localeCompare(b.eventId));
    const valores = new Set(doDia.map((item) => JSON.stringify(item.valor)));
    const existente = campos[campo];
    if (existente) {
      const valorObservado = doDia[0]?.valor ?? null;
      if (existente.estado === "VERMELHO") {
        campos[campo] = { ...existente, observacoes: todos };
      } else if (existente.estado === "PENDENTE") {
        campos[campo] = { ...existente, observacoes: todos };
      } else if (JSON.stringify(existente.valor) !== JSON.stringify(valorObservado) || valores.size > 1) {
        const candidatos = existente.candidatos ?? existente.eventIds.map((eventId) => ({ valor: existente.valor, eventId }));
        candidatos.push(...doDia.map(({ valor, eventId }) => ({ valor, eventId })));
        campos[campo] = { valor: null, estado: "VERMELHO",
          eventIds: [...new Set([...existente.eventIds, ...doDia.map((item) => item.eventId)])].sort(),
          candidatos: candidatos.sort((a, b) => a.eventId.localeCompare(b.eventId)), observacoes: todos };
      } else {
        campos[campo] = { ...existente, observacoes: todos };
      }
      continue;
    }
    if (valores.size > 1) {
      campos[campo] = { valor: null, eventIds: doDia.map((item) => item.eventId).sort(),
        estado: "VERMELHO", candidatos: doDia.map(({ valor, eventId }) => ({ valor, eventId })),
        observacoes: todos };
    } else {
      const escolhido = doDia[0]!;
      campos[campo] = { valor: escolhido.valor, eventIds: doDia.map((item) => item.eventId).sort(),
        estado: escolhido.valor === null ? "PENDENTE" : "VERDE", observacoes: todos };
    }
  }
  // IDs não carregam precedência clínica: só a relação supersedes decide
  // substituição. Ordenar a representação não elege candidato nem oculta conflito.
  const eventIds = relevantes.map((e) => e.eventId).sort();
  const stageHistory = tnmHistory(noHorizonte);
  const rulesetRefs = [...refs.values()].sort((a, b) =>
    `${a.id}:${a.version}:${a.hash}`.localeCompare(`${b.id}:${b.version}:${b.hash}`));
  for (const p of propostas) {
    // Proposta nunca vira fato e nunca apaga fato/conflito confirmado (A08).
    const existente = campos[p.campo];
    if (existente) existente.proposta = { valor: p.valor, sourceId: p.sourceId };
    else campos[p.campo] = { valor: null, eventIds: [], estado: "PENDENTE", proposta: { valor: p.valor, sourceId: p.sourceId } };
  }
  const camposOrdenados: Record<string, ValorProjetado> = Object.create(null);
  for (const campo of Object.keys(campos).sort()) {
    const entrada = campos[campo]!;
    camposOrdenados[campo] = {
      ...entrada,
      eventIds: [...entrada.eventIds].sort(),
      ...(entrada.candidatos
        ? { candidatos: [...entrada.candidatos].sort((a, b) =>
          a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0) }
        : {}),
    };
  }
  const kind = propostas.length ? "CURRENT" : "CONFIRMED";
  const contentHash = createHash("sha256")
    .update(JSON.stringify({ kind, patientId, tumorLotId, encounterId, projectionVersion, rulesetRefs,
      campos: camposOrdenados, stageHistory, eventIds }))
    .digest("hex");
  return { kind, patientId, tumorLotId, encounterId, projectionVersion,
    rulesetRefs, campos: camposOrdenados, stageHistory, eventIds, contentHash };
}

export function montarSnapshot(
  db: DatabaseSync, patientId: string, tumorLotId: string | null,
  encounterId: string, projectionVersion: string, propostas: readonly PropostaCurrent[] = [],
): CaseSnapshot {
  return projetarSnapshot(listarEventos(db, patientId), patientId, tumorLotId,
    encounterId, projectionVersion, propostas);
}
