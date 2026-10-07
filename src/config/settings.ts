// W10-LUNA5 · configuração local e alterações globais fora do ledger clínico.
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { Sessao, type Sessao as SessaoServidor } from "../contracts/base.js";
import {
  AlteracaoCaixa, CaixaNumerada,
  type AlteracaoCaixa as AlteracaoCaixaTipo,
  type CaixaNumerada as CaixaNumeradaTipo,
} from "../contracts/w10/clinico-w10.js";

const textoOpcional = z.string().trim().max(500).nullable();
const textoCurtoOpcional = z.string().trim().max(160).nullable();
const boolConexao = z.boolean().optional();

const PerfilSchema = z.object({
  medico: z.object({
    nome: textoCurtoOpcional,
    crm: textoCurtoOpcional,
    rqe: textoCurtoOpcional,
    telefone: textoCurtoOpcional,
    cns: textoCurtoOpcional,
  }).strict(),
  instituicao: z.object({ hospital: textoCurtoOpcional, cnes: textoCurtoOpcional }).strict(),
  preferencias: z.object({
    tema: z.enum(["DIA", "NOITE", "PERSONALIZAR"]),
    layoutPersonalizado: textoOpcional,
    impressora: textoCurtoOpcional,
    sincronizarTelefone: z.boolean(),
  }).strict(),
  conexoes: z.object({
    sites: z.object({ endereco: textoOpcional, habilitada: boolConexao }).strict(),
    telefone: z.object({ habilitada: boolConexao }).strict(),
    impressoraRede: z.object({ endereco: textoOpcional, habilitada: boolConexao }).strict(),
    skills: z.object({ selecionadas: z.array(z.string().trim().min(1).max(120)).max(100), habilitada: boolConexao }).strict(),
    plugins: z.object({ selecionados: z.array(z.string().trim().min(1).max(120)).max(100), habilitada: boolConexao }).strict(),
    mcp: z.object({ selecionados: z.array(z.string().trim().min(1).max(120)).max(100), habilitada: boolConexao }).strict(),
  }).strict(),
}).strict().superRefine((perfil, ctx) => {
  if (perfil.preferencias.tema === "PERSONALIZAR" && !perfil.preferencias.layoutPersonalizado?.trim()) {
    ctx.addIssue({ code: "custom", path: ["preferencias", "layoutPersonalizado"], message: "layout personalizado obrigatório" });
  }
  const site = perfil.conexoes.sites.endereco;
  if (site) {
    let parsed: URL;
    try { parsed = new URL(site); } catch { ctx.addIssue({ code: "custom", path: ["conexoes", "sites", "endereco"], message: "endereço de site inválido" }); return; }
    if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || parsed.username || parsed.password) {
      ctx.addIssue({ code: "custom", path: ["conexoes", "sites", "endereco"], message: "endereço de site não suportado" });
    }
  }
});

const ChangeBoxRequestSchema = z.object({
  numero: z.number().int().positive(),
  valorNovo: z.unknown(),
  expectedRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  operationId: z.string().regex(/^[A-Za-z0-9._:-]{8,160}$/),
  motivo: z.string().trim().max(1000).nullable().optional(),
  autorizacaoMedica: z.boolean().optional(),
}).strict();

export type PerfilConfiguracao = z.infer<typeof PerfilSchema>;
export type ResultadoAlteracao = {
  estado: "GRAVADA" | "REPLAY" | "CONFLITO" | "NEGADA";
  revision: number;
  alteracoes: AlteracaoCaixaTipo[];
  proveniencia: "DECISAO_MEDICA" | null;
  motivo?: string;
};

const zero = (): PerfilConfiguracao => ({
  medico: { nome: null, crm: null, rqe: null, telefone: null, cns: null },
  instituicao: { hospital: null, cnes: null },
  preferencias: { tema: "DIA", layoutPersonalizado: null, impressora: null, sincronizarTelefone: false },
  conexoes: {
    sites: { endereco: null, habilitada: false },
    telefone: { habilitada: false },
    impressoraRede: { endereco: null, habilitada: false },
    skills: { selecionadas: [], habilitada: false },
    plugins: { selecionados: [], habilitada: false },
    mcp: { selecionados: [], habilitada: false },
  },
});

/** Migrates old or malformed stored data conservatively; no legacy connection is enabled. */
function lerPerfilSeguro(value: unknown): PerfilConfiguracao {
  const defaults = zero();
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  const raw = value as Record<string, unknown>;
  const rawMedico = (raw.medico && typeof raw.medico === "object" ? raw.medico : {}) as Record<string, unknown>;
  const rawInstituicao = (raw.instituicao && typeof raw.instituicao === "object" ? raw.instituicao : {}) as Record<string, unknown>;
  const rawPref = (raw.preferencias && typeof raw.preferencias === "object" ? raw.preferencias : {}) as Record<string, unknown>;
  const rawConn = (raw.conexoes && typeof raw.conexoes === "object" ? raw.conexoes : {}) as Record<string, unknown>;
  const telefoneSync = rawPref.sincronizarTelefone;
  const conn = (key: string) => (rawConn[key] && typeof rawConn[key] === "object" ? rawConn[key] : {}) as Record<string, unknown>;
  const stringOrNull = (v: unknown, max = 500) => typeof v === "string" && v.trim().length <= max ? v.trim() || null : null;
  const list = (v: unknown) => Array.isArray(v) && v.length <= 100
    ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0 && x.length <= 120).map((x) => x.trim())
    : [];
  const theme = rawPref.tema === "NOITE" || (rawPref.tema === "PERSONALIZAR" && typeof rawPref.layoutPersonalizado === "string" && rawPref.layoutPersonalizado.trim()) ? rawPref.tema : "DIA";
  return {
    medico: {
      nome: stringOrNull(rawMedico.nome, 160), crm: stringOrNull(rawMedico.crm, 160), rqe: stringOrNull(rawMedico.rqe, 160),
      telefone: stringOrNull(rawMedico.telefone, 160), cns: stringOrNull(rawMedico.cns, 160),
    },
    instituicao: { hospital: stringOrNull(rawInstituicao.hospital, 160), cnes: stringOrNull(rawInstituicao.cnes, 160) },
    preferencias: {
      tema: theme, layoutPersonalizado: stringOrNull(rawPref.layoutPersonalizado),
      impressora: stringOrNull(rawPref.impressora, 160), sincronizarTelefone: typeof telefoneSync === "boolean" ? telefoneSync : false,
    },
    conexoes: {
      sites: { endereco: stringOrNull(conn("sites").endereco), habilitada: false },
      telefone: { habilitada: false },
      impressoraRede: { endereco: stringOrNull(conn("impressoraRede").endereco), habilitada: false },
      skills: { selecionadas: list(conn("skills").selecionadas), habilitada: false },
      plugins: { selecionados: list(conn("plugins").selecionados), habilitada: false },
      mcp: { selecionados: list(conn("mcp").selecionados), habilitada: false },
    },
  };
}

const CAMPOS_PERFIL: ReadonlyArray<{ chave: string; tipo: CaixaNumeradaTipo["tipo"]; get: (p: PerfilConfiguracao) => unknown }> = [
  { chave: "config.medico.nome", tipo: "TEXTO", get: (p) => p.medico.nome },
  { chave: "config.medico.crm", tipo: "TEXTO", get: (p) => p.medico.crm },
  { chave: "config.medico.rqe", tipo: "TEXTO", get: (p) => p.medico.rqe },
  { chave: "config.medico.telefone", tipo: "TEXTO", get: (p) => p.medico.telefone },
  { chave: "config.medico.cns", tipo: "TEXTO", get: (p) => p.medico.cns },
  { chave: "config.instituicao.hospital", tipo: "TEXTO", get: (p) => p.instituicao.hospital },
  { chave: "config.instituicao.cnes", tipo: "TEXTO", get: (p) => p.instituicao.cnes },
  { chave: "config.preferencias.tema", tipo: "TEXTO", get: (p) => p.preferencias.tema },
  { chave: "config.preferencias.layoutPersonalizado", tipo: "TEXTO", get: (p) => p.preferencias.layoutPersonalizado },
  { chave: "config.preferencias.impressora", tipo: "TEXTO", get: (p) => p.preferencias.impressora },
  { chave: "config.preferencias.sincronizarTelefone", tipo: "BOOLEANO", get: (p) => p.preferencias.sincronizarTelefone },
  { chave: "config.conexoes.sites", tipo: "TEXTO", get: (p) => p.conexoes.sites.endereco },
  { chave: "config.conexoes.redeImpressora", tipo: "TEXTO", get: (p) => p.conexoes.impressoraRede.endereco },
  { chave: "config.conexoes.skills", tipo: "LISTA", get: (p) => p.conexoes.skills.selecionadas },
  { chave: "config.conexoes.plugins", tipo: "LISTA", get: (p) => p.conexoes.plugins.selecionados },
  { chave: "config.conexoes.mcp", tipo: "LISTA", get: (p) => p.conexoes.mcp.selecionados },
];

type EstadoConfig = { perfil: PerfilConfiguracao; caixas: Record<string, unknown> };
const estadoVazio = (): EstadoConfig => ({ perfil: zero(), caixas: {} });

function seguroJson(value: unknown): boolean {
  try { return JSON.stringify(value) !== undefined; } catch { return false; }
}

function validarTipo(tipo: CaixaNumeradaTipo["tipo"], value: unknown): boolean {
  if (value === null) return true; // null representa PENDENTE/ausente.
  switch (tipo) {
    case "TEXTO": return typeof value === "string";
    case "NUMERO": return typeof value === "number" && Number.isFinite(value);
    case "DATA": return typeof value === "string" && z.iso.date().safeParse(value).success;
    case "BOOLEANO": return typeof value === "boolean";
    case "LISTA": return Array.isArray(value) && value.every((item) => typeof item === "string");
    case "REGRA_CLINICA": return !!value && typeof value === "object" && !Array.isArray(value) && seguroJson(value);
  }
}

function validarChaveConfiguracao(chave: string, value: unknown): boolean {
  if (chave === "config.preferencias.tema") return value === "DIA" || value === "NOITE" || value === "PERSONALIZAR";
  if (chave === "config.preferencias.sincronizarTelefone") return typeof value === "boolean";
  return true;
}

function normalizarValor(box: CaixaNumeradaTipo, value: unknown): unknown {
  if (value === null) return null;
  if (box.tipo === "TEXTO" && typeof value === "string") return value.trim() || null;
  if (box.tipo === "LISTA" && Array.isArray(value)) return value.map((item) => (item as string).trim()).filter(Boolean);
  return value;
}

function hash(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

function validarCatalogo(catalogo: readonly CaixaNumeradaTipo[]): Map<number, CaixaNumeradaTipo> {
  const porNumero = new Map<number, CaixaNumeradaTipo>(), chaves = new Set<string>();
  for (const raw of catalogo) {
    const caixa = CaixaNumerada.parse(raw);
    if (porNumero.has(caixa.numero) || chaves.has(caixa.chave)) throw new Error("CATALOGO_CAIXAS_DUPLICADO");
    porNumero.set(caixa.numero, caixa); chaves.add(caixa.chave);
  }
  return porNumero;
}

function transacao<T>(db: DatabaseSync, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try { const value = fn(); db.exec("COMMIT"); return value; }
  catch (error) { try { db.exec("ROLLBACK"); } catch { /* transaction already ended */ } throw error; }
}

export interface SettingsService {
  readProfile(session: SessaoServidor): { revision: number; perfil: PerfilConfiguracao; exemplos: { cnes: { valor: "2605473"; confirmado: false; editavel: true } } };
  saveProfile(input: { operationId: string; expectedRevision: number; perfil: unknown; motivo?: string | null }, session: SessaoServidor): ResultadoAlteracao;
  changeBox(input: { numero: number; valorNovo: unknown; expectedRevision: number; operationId: string; motivo?: string | null; autorizacaoMedica?: boolean }, session: SessaoServidor): ResultadoAlteracao;
  readBox(numero: number, session: SessaoServidor): { revision: number; value: unknown | null };
  readHistory(session: SessaoServidor): Array<{ operationId: string; revision: number; tipo: "PROVISORIO-W10"; alteracoes: AlteracaoCaixaTipo[]; proveniencia: "DECISAO_MEDICA" | null }>;
  close(): void;
}

/**
 * W10 global settings use their own local SQLite file. This deliberately does not write
 * clinical_event: that table requires patient/encounter identity and settings do not.
 */
export function createSettingsService(options: {
  rootDir: string; caixas: readonly CaixaNumeradaTipo[]; now?: () => string;
}): SettingsService {
  const catalog = validarCatalogo(options.caixas);
  const root = resolve(options.rootDir);
  mkdirSync(root, { recursive: true });
  const dbPath = resolve(root, "config-w10.sqlite");
  if (!dbPath.startsWith(`${root}${sep}`)) throw new Error("CAMINHO_CONFIG_FORA_DA_RAIZ");
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS settings_snapshot (
      singleton INTEGER PRIMARY KEY CHECK(singleton=1), revision INTEGER NOT NULL CHECK(revision>=1), payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings_event (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT, operationId TEXT NOT NULL, revision INTEGER NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings_operation (
      operationId TEXT PRIMARY KEY, payloadHash TEXT NOT NULL, result TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings_conflict (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT, operationId TEXT NOT NULL, expectedRevision INTEGER NOT NULL,
      atual TEXT, candidato TEXT NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS settings_event_no_update BEFORE UPDATE ON settings_event
      BEGIN SELECT RAISE(ABORT, 'settings_event append-only'); END;
    CREATE TRIGGER IF NOT EXISTS settings_event_no_delete BEFORE DELETE ON settings_event
      BEGIN SELECT RAISE(ABORT, 'settings_event append-only'); END;
    CREATE TRIGGER IF NOT EXISTS settings_operation_no_update BEFORE UPDATE ON settings_operation
      BEGIN SELECT RAISE(ABORT, 'settings_operation append-only'); END;
    CREATE TRIGGER IF NOT EXISTS settings_operation_no_delete BEFORE DELETE ON settings_operation
      BEGIN SELECT RAISE(ABORT, 'settings_operation append-only'); END;
  `);
  const now = options.now ?? (() => new Date().toISOString());

  const readState = (): { revision: number; value: EstadoConfig } => {
    const row = db.prepare("SELECT revision,payload FROM settings_snapshot WHERE singleton=1").get() as Record<string, unknown> | undefined;
    if (!row) return { revision: 0, value: estadoVazio() };
    let parsed: unknown;
    try { parsed = JSON.parse(String(row.payload)); } catch { parsed = null; }
    const raw = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    return { revision: Number(row.revision), value: { perfil: lerPerfilSeguro(raw.perfil), caixas: raw.caixas && typeof raw.caixas === "object" && !Array.isArray(raw.caixas) ? raw.caixas as Record<string, unknown> : {} } };
  };

  const assertSession = (session: SessaoServidor): SessaoServidor => {
    const actor = Sessao.parse(session);
    const nowMs = Date.parse(now());
    const issuedMs = Date.parse(actor.emitidaEm), expiresMs = Date.parse(actor.expiraEm);
    if (!actor.medicoId.trim() || !actor.crm.trim() || !Number.isFinite(nowMs)
      || !Number.isFinite(issuedMs) || !Number.isFinite(expiresMs)
      || issuedMs > nowMs || nowMs >= expiresMs || issuedMs >= expiresMs) throw new Error("SESSAO_INVALIDA");
    return actor;
  };

  const apply = (input: {
    operationId: string; expectedRevision: number; value: EstadoConfig; events: AlteracaoCaixaTipo[]; provenance: "DECISAO_MEDICA" | null; actorId: string; request: unknown;
  }): ResultadoAlteracao => {
    if (!/^[A-Za-z0-9._:-]{8,160}$/.test(input.operationId)) throw new TypeError("OPERATION_ID_INVALIDO");
    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) throw new TypeError("EXPECTED_REVISION_INVALIDA");
    const candidate = JSON.stringify(input.value);
    const payloadHash = hash({ actorId: input.actorId, request: input.request });
    return transacao(db, () => {
      const oldOperation = db.prepare("SELECT payloadHash,result FROM settings_operation WHERE operationId=?").get(input.operationId) as Record<string, unknown> | undefined;
      if (oldOperation) {
        if (oldOperation.payloadHash !== payloadHash) return { estado: "NEGADA", revision: readState().revision, alteracoes: [], proveniencia: null, motivo: "IDEMPOTENCY_CONFLICT" };
        const saved = JSON.parse(String(oldOperation.result)) as ResultadoAlteracao;
        return { ...saved, estado: "REPLAY" };
      }
      const current = readState();
      if (current.revision !== input.expectedRevision) {
        db.prepare("INSERT INTO settings_conflict(operationId,expectedRevision,atual,candidato) VALUES(?,?,?,?)")
          .run(input.operationId, input.expectedRevision, JSON.stringify(current.value), candidate);
        const result: ResultadoAlteracao = { estado: "CONFLITO", revision: current.revision, alteracoes: [], proveniencia: null };
        db.prepare("INSERT INTO settings_operation(operationId,payloadHash,result) VALUES(?,?,?)")
          .run(input.operationId, payloadHash, JSON.stringify(result));
        return result;
      }
      const revision = current.revision + 1;
      db.prepare(`INSERT INTO settings_snapshot(singleton,revision,payload) VALUES(1,?,?)
        ON CONFLICT(singleton) DO UPDATE SET revision=excluded.revision,payload=excluded.payload`).run(revision, candidate);
      const envelope = { tipo: "PROVISORIO-W10", operationId: input.operationId, revision, alteracoes: input.events, proveniencia: input.provenance };
      db.prepare("INSERT INTO settings_event(operationId,revision,payload) VALUES(?,?,?)")
        .run(input.operationId, revision, JSON.stringify(envelope));
      const result: ResultadoAlteracao = { estado: "GRAVADA", revision, alteracoes: input.events, proveniencia: input.provenance };
      db.prepare("INSERT INTO settings_operation(operationId,payloadHash,result) VALUES(?,?,?)")
        .run(input.operationId, payloadHash, JSON.stringify(result));
      return result;
    });
  };

  function replayIfRecorded(operationId: string, actorId: string, request: unknown): ResultadoAlteracao | null {
    const existing = db.prepare("SELECT payloadHash,result FROM settings_operation WHERE operationId=?").get(operationId) as Record<string, unknown> | undefined;
    if (!existing) return null;
    const payloadHash = hash({ actorId, request });
    if (existing.payloadHash !== payloadHash) return {
      estado: "NEGADA", revision: readState().revision, alteracoes: [], proveniencia: null, motivo: "IDEMPOTENCY_CONFLICT",
    };
    const saved = JSON.parse(String(existing.result)) as ResultadoAlteracao;
    return { ...saved, estado: "REPLAY" };
  }

  function makeEvent(box: CaixaNumeradaTipo, before: unknown, after: unknown, actor: SessaoServidor, reason?: string | null): AlteracaoCaixaTipo {
    return AlteracaoCaixa.parse({ numero: box.numero, valorAnterior: before ?? null, valorNovo: after ?? null,
      por: actor.medicoId, em: now(), motivo: reason?.trim() || null });
  }

  function findBoxByKey(key: string): CaixaNumeradaTipo {
    const box = [...catalog.values()].find((item) => item.chave === key);
    if (!box) throw new Error("CATALOGO_CONFIG_PENDENTE");
    return box;
  }

  function updateProfilePath(profile: PerfilConfiguracao, key: string, value: unknown): PerfilConfiguracao {
    const next = structuredClone(profile) as PerfilConfiguracao;
    switch (key) {
      case "config.medico.nome": next.medico.nome = value as string | null; break;
      case "config.medico.crm": next.medico.crm = value as string | null; break;
      case "config.medico.rqe": next.medico.rqe = value as string | null; break;
      case "config.medico.telefone": next.medico.telefone = value as string | null; break;
      case "config.medico.cns": next.medico.cns = value as string | null; break;
      case "config.instituicao.hospital": next.instituicao.hospital = value as string | null; break;
      case "config.instituicao.cnes": next.instituicao.cnes = value as string | null; break;
      case "config.preferencias.tema": next.preferencias.tema = value as PerfilConfiguracao["preferencias"]["tema"]; break;
      case "config.preferencias.layoutPersonalizado": next.preferencias.layoutPersonalizado = value as string | null; break;
      case "config.preferencias.impressora": next.preferencias.impressora = value as string | null; break;
      case "config.preferencias.sincronizarTelefone": next.preferencias.sincronizarTelefone = value === true; break;
      case "config.conexoes.sites": next.conexoes.sites.endereco = value as string | null; break;
      case "config.conexoes.redeImpressora": next.conexoes.impressoraRede.endereco = value as string | null; break;
      case "config.conexoes.skills": next.conexoes.skills.selecionadas = value as string[]; break;
      case "config.conexoes.plugins": next.conexoes.plugins.selecionados = value as string[]; break;
      case "config.conexoes.mcp": next.conexoes.mcp.selecionados = value as string[]; break;
      default: return next;
    }
    return next;
  }

  function perfilAtualizado(state: EstadoConfig, box: CaixaNumeradaTipo, value: unknown): PerfilConfiguracao {
    const next = updateProfilePath(state.perfil, box.chave, value);
    const parsed = PerfilSchema.safeParse(next);
    if (!parsed.success) throw new Error("CONFIGURACAO_INCONSISTENTE");
    return parsed.data;
  }

  function valorAtual(state: EstadoConfig, box: CaixaNumeradaTipo): unknown | null {
    const profileField = CAMPOS_PERFIL.find((field) => field.chave === box.chave);
    if (profileField) return profileField.get(state.perfil) ?? null;
    return Object.prototype.hasOwnProperty.call(state.caixas, String(box.numero)) ? state.caixas[String(box.numero)] : null;
  }

  function putProfileValue(boxes: Record<string, unknown>, box: CaixaNumeradaTipo, value: unknown): Record<string, unknown> {
    return { ...boxes, [String(box.numero)]: value };
  }

  return {
    readProfile(session) {
      assertSession(session);
      const current = readState();
      return { revision: current.revision, perfil: current.value.perfil,
        exemplos: { cnes: { valor: "2605473", confirmado: false, editavel: true } } };
    },
    saveProfile(input, session) {
      const actor = assertSession(session);
      const incoming = PerfilSchema.parse(input.perfil);
      const safe = lerPerfilSeguro(incoming); // force every connection off, including client-supplied true.
      const current = readState();
      const events: AlteracaoCaixaTipo[] = [];
      let boxes = { ...current.value.caixas };
      for (const field of CAMPOS_PERFIL) {
        const before = field.get(current.value.perfil), after = field.get(safe);
        if (JSON.stringify(before) === JSON.stringify(after)) continue;
        const box = findBoxByKey(field.chave);
        if (box.editavelPor !== "MEDICO" || box.tipo !== field.tipo || !validarTipo(box.tipo, after) || !validarChaveConfiguracao(box.chave, after)) throw new Error("CAIXA_CONFIG_INVALIDA");
        events.push(makeEvent(box, before, after, actor, input.motivo));
        boxes = putProfileValue(boxes, box, after);
      }
      return apply({ operationId: input.operationId, expectedRevision: input.expectedRevision,
        value: { ...current.value, perfil: safe, caixas: boxes }, events, provenance: null, actorId: actor.medicoId,
        request: { action: "SAVE_PROFILE", expectedRevision: input.expectedRevision, perfil: safe, motivo: input.motivo?.trim() || null } });
    },
    changeBox(input, session) {
      const requestInput = ChangeBoxRequestSchema.parse(input);
      const actor = assertSession(session);
      const box = catalog.get(requestInput.numero);
      if (!box) throw new Error("CAIXA_DESCONHECIDA");
      if (box.chave.startsWith("apac.")) throw new Error("CONTEXTO_PACIENTE_OBRIGATORIO");
      if (box.editavelPor !== "MEDICO") throw new Error("CAIXA_SISTEMA_NAO_EDITAVEL");
      if (!validarTipo(box.tipo, requestInput.valorNovo) || !validarChaveConfiguracao(box.chave, requestInput.valorNovo)) throw new TypeError("TIPO_CAIXA_INVALIDO");
      if (box.tipo === "REGRA_CLINICA" && requestInput.autorizacaoMedica !== true) throw new Error("AUTORIZACAO_MEDICA_EXPLICITA_OBRIGATORIA");
      const normalizedValue = normalizarValor(box, requestInput.valorNovo);
      if (!validarTipo(box.tipo, normalizedValue) || !validarChaveConfiguracao(box.chave, normalizedValue)) throw new TypeError("TIPO_CAIXA_INVALIDO");
      if (!seguroJson(normalizedValue)) throw new TypeError("VALOR_CAIXA_NAO_SERIALIZAVEL");
      const request = { action: "CHANGE_BOX", expectedRevision: requestInput.expectedRevision, numero: requestInput.numero,
        valorNovo: normalizedValue, motivo: requestInput.motivo?.trim() || null, autorizacaoMedica: requestInput.autorizacaoMedica === true };
      const replay = replayIfRecorded(requestInput.operationId, actor.medicoId, request);
      if (replay) return replay;
      const current = readState();
      const before = valorAtual(current.value, box);
      const perfil = perfilAtualizado(current.value, box, normalizedValue);
      const event = makeEvent(box, before, normalizedValue, actor, requestInput.motivo);
      const value: EstadoConfig = { ...current.value, caixas: { ...current.value.caixas, [String(box.numero)]: normalizedValue }, perfil };
      return apply({ operationId: requestInput.operationId, expectedRevision: requestInput.expectedRevision,
        value, events: [event], provenance: box.tipo === "REGRA_CLINICA" && requestInput.autorizacaoMedica === true ? "DECISAO_MEDICA" : null,
        actorId: actor.medicoId, request });
    },
    readBox(numero, session) {
      assertSession(session);
      if (!Number.isSafeInteger(numero) || numero < 1) throw new TypeError("NUMERO_CAIXA_INVALIDO");
      const box = catalog.get(numero);
      if (!box) throw new Error("CAIXA_DESCONHECIDA");
      const current = readState();
      return { revision: current.revision,
        value: valorAtual(current.value, box) };
    },
    readHistory(session) {
      assertSession(session);
      return db.prepare("SELECT payload FROM settings_event ORDER BY sequence").all().map((row) => JSON.parse(String((row as Record<string, unknown>).payload)) as {
        operationId: string; revision: number; tipo: "PROVISORIO-W10"; alteracoes: AlteracaoCaixaTipo[]; proveniencia: "DECISAO_MEDICA" | null;
      });
    },
    close() { db.close(); },
  };
}
