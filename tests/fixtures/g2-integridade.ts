// Fixtures sintéticas de caracterização G2 (Integridade de Operações, Hashes, Contexto e Pós-processamento HTTP).
// PROIBIÇÃO G2 (CX-005): O vetor legado abaixo usa string JSON literal e digest SHA-256 independente pré-computado;
// nunca calcula o esperado chamando hashPayload, hashCanonico ou qualquer função sob teste.
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { Fonte, Sessao } from "../../src/contracts/base.js";
import type { ClinicalEvent } from "../../src/contracts/operacao.js";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { confirmar, type Confirmacao } from "../../src/kernel/ledger/writeRouter.js";
import { criarMotorF1 } from "../../src/kernel/orquestracao/runtime.js";
import { criarServidorLocal } from "../../src/server/http.js";
import type { ServidorDeps } from "../../src/server/rotas.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";

export const G2_INSTANTE_BASE = "2026-10-10T10:00:00.000Z";
export const G2_INSTANTE_RETRY = "2026-10-10T10:05:00.000Z";
export const G2_INSTANTE_EXPIRADO = "2026-10-10T12:00:00.000Z";
export const G2_SENHA_SINTETICA = "senha-sintetica-g2-caracterizacao";

export const G2_CONTEXTO = {
  patientId: "paciente-g2-01",
  encounterId: "encontro-g2-01",
  tumorLotId: "lote-g2-01",
} as const;

export const G2_CONTEXTO_SEM_LOTE = {
  patientId: "paciente-g2-01",
  encounterId: "encontro-g2-01",
  tumorLotId: null,
} as const;

export const G2_OUTRO_CONTEXTO = {
  patientId: "paciente-g2-02",
  encounterId: "encontro-g2-02",
  tumorLotId: "lote-g2-02",
} as const;

export function criarSessaoSinteticaG2(opcoes: {
  medicoId?: string;
  crm?: string;
  emitidaEm?: string;
  expiraEm?: string;
} = {}): Sessao {
  return {
    medicoId: opcoes.medicoId ?? "medico-g2-01",
    crm: opcoes.crm ?? "CRM-G2-01",
    emitidaEm: opcoes.emitidaEm ?? G2_INSTANTE_BASE,
    expiraEm: opcoes.expiraEm ?? "2026-10-10T11:00:00.000Z",
  };
}

export function criarFonteSinteticaG2(sourceId = "fonte-legada-g2-01", contentHash = "1".repeat(64)): Fonte {
  return {
    sourceId,
    classe: "LAB_FEED",
    localizador: "linha-1",
    dataClinica: "2026-10-10",
    dataCaptura: G2_INSTANTE_BASE,
    versao: "v1",
    contentHash,
  };
}

/**
 * Vetor de operação legada congelado literalmente (independente de hashPayload e hashCanonico).
 * Note que `data` tem chaves na ordem não canônica `zCampoOrdemLegada` antes de `aCampoOrdemLegada`.
 */
export const VETOR_OPERACAO_LEGADA_G2 = Object.freeze({
  operationId: "op-legada-g2-01",
  eventId: "ev-legado-g2-01",
  patientId: G2_CONTEXTO.patientId,
  tumorLotId: G2_CONTEXTO.tumorLotId,
  encounterId: G2_CONTEXTO.encounterId,
  reviewDecisionId: "rev-legada-g2-01",
  medicoId: "medico-g2-01",
  criadoEm: G2_INSTANTE_BASE,
  draftId: "draft-legado-g2-01",
  payloadData: {
    zCampoOrdemLegada: 2,
    aCampoOrdemLegada: 1,
    campo: "creatinina",
    valor: 1.2,
  },
  payloadJsonColunaEvento:
    '{"reviewDecisionId":"rev-legada-g2-01","data":{"zCampoOrdemLegada":2,"aCampoOrdemLegada":1,"campo":"creatinina","valor":1.2}}',
  fontesJsonColunaEvento:
    '[{"sourceId":"fonte-legada-g2-01","classe":"LAB_FEED","localizador":"linha-1","dataClinica":"2026-10-10","dataCaptura":"2026-10-10T10:00:00.000Z","versao":"v1","contentHash":"1111111111111111111111111111111111111111111111111111111111111111"}]',
  criadoPorJsonColunaEvento: '{"tipo":"SESSAO","id":"medico-g2-01"}',
  /** Bytes literais exatos do array de 1 evento como gravados historicamente na coluna operation.payloadHash. */
  eventosJsonLiteral:
    '[{"eventId":"ev-legado-g2-01","operationId":"op-legada-g2-01","eventIndex":0,"patientId":"paciente-g2-01","tumorLotId":"lote-g2-01","encounterId":"encontro-g2-01","tipo":"FATO","payload":{"reviewDecisionId":"rev-legada-g2-01","data":{"zCampoOrdemLegada":2,"aCampoOrdemLegada":1,"campo":"creatinina","valor":1.2}},"fontes":[{"sourceId":"fonte-legada-g2-01","classe":"LAB_FEED","localizador":"linha-1","dataClinica":"2026-10-10","dataCaptura":"2026-10-10T10:00:00.000Z","versao":"v1","contentHash":"1111111111111111111111111111111111111111111111111111111111111111"}],"revisao":"CONFIRMADO","criadoEm":"2026-10-10T10:00:00.000Z","criadoPor":{"tipo":"SESSAO","id":"medico-g2-01"},"supersedesEventId":null}]',
  /** SHA-256 hexadecimal pré-computado de `eventosJsonLiteral` (sem chamar funções do produto). */
  payloadHashLiteralEsperado: "42a1bb87e2375d3d3b7be7fd1bc882f5dc72f9a3be8ea5d1044e10ecd83413ae",
  /** SHA-256 hexadecimal pré-computado do evento individual com chaves ordenadas canonicamente. */
  eventoCanonicoSha256Esperado: "b6c27ed4bb290b12d7a6cc7756df91e6041e02a58c614f1f5735f5e1b063f303",
  /** SHA-256 hexadecimal pré-computado do array `[evento]` com chaves ordenadas canonicamente. */
  arrayCanonicoSha256Esperado: "ea8dfdd4551a01e816593b7b610236d80698d6a11fd76555a4f457743c88816e",
});

export function sha256Independente(textoUtf8: string): string {
  return createHash("sha256").update(Buffer.from(textoUtf8, "utf8")).digest("hex");
}

/**
 * Insere diretamente no SQLite a operação e o evento legados usando os literais congelados,
 * sem passar por hashPayload ou confirmar.
 */
export function inserirOperacaoLegadaDiretoNoSqlite(db: DatabaseSync): void {
  const v = VETOR_OPERACAO_LEGADA_G2;
  db.prepare(
    "INSERT INTO draft_envelope (draftId,patientId,sourceId,rawRef,payload,diagnostics,revision,criadoEm) VALUES (?,?,?,?,?,?,?,?)",
  ).run(
    v.draftId,
    v.patientId,
    "fonte-legada-g2-01",
    "raw-legado-g2-01",
    JSON.stringify(v.payloadData),
    "[]",
    1,
    v.criadoEm,
  );
  db.prepare("INSERT INTO operation (operationId,payloadHash,resultRef,criadoEm) VALUES (?,?,?,?)").run(
    v.operationId,
    v.payloadHashLiteralEsperado,
    v.eventId,
    v.criadoEm,
  );
  db.prepare(
    `INSERT INTO clinical_event
      (eventId,operationId,eventIndex,patientId,tumorLotId,encounterId,tipo,payload,fontes,revisao,criadoEm,criadoPor,supersedesEventId)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    v.eventId,
    v.operationId,
    0,
    v.patientId,
    v.tumorLotId,
    v.encounterId,
    "FATO",
    v.payloadJsonColunaEvento,
    v.fontesJsonColunaEvento,
    "CONFIRMADO",
    v.criadoEm,
    v.criadoPorJsonColunaEvento,
    null,
  );
}

export function montarConfirmacaoDoVetorLegado(opcoes: {
  em?: string;
  sessao?: Sessao;
  payloadData?: Record<string, unknown>;
} = {}): Confirmacao {
  const v = VETOR_OPERACAO_LEGADA_G2;
  return {
    operationId: v.operationId,
    patientId: v.patientId,
    tumorLotId: v.tumorLotId,
    encounterId: v.encounterId,
    reviewDecisionId: v.reviewDecisionId,
    sessao: opcoes.sessao ?? criarSessaoSinteticaG2({ medicoId: v.medicoId, emitidaEm: v.criadoEm }),
    em: opcoes.em ?? v.criadoEm,
    registros: [
      {
        draftId: v.draftId,
        expectedRevision: 0,
        eventId: v.eventId,
        tipo: "FATO",
        payload: opcoes.payloadData ?? v.payloadData,
        fontes: [criarFonteSinteticaG2()],
        revisao: "CONFIRMADO",
      },
    ],
  };
}

export function criarBancoMemoriaG2(): DatabaseSync {
  return abrirLedger(":memory:");
}

export function criarDiretorioTempG2(sufixo = ""): { dir: string; sqlitePath: string; limpar: () => void } {
  const dir = mkdtempSync(join(tmpdir(), `oncoglobal-g2-${sufixo}`));
  return {
    dir,
    sqlitePath: join(dir, "g2-ledger.sqlite"),
    limpar: () => rmSync(dir, { recursive: true, force: true }),
  };
}

export function semearPacienteELoteG2(
  db: DatabaseSync,
  sessao: Sessao = criarSessaoSinteticaG2(),
  em: string = G2_INSTANTE_BASE,
  ctx: { patientId: string; encounterId: string; tumorLotId: string | null } = G2_CONTEXTO,
): { pacienteEventId: string; loteEventId: string | null } {
  const draftPaciente = `draft-pac-${ctx.patientId}`;
  salvarDraft(db, {
    draftId: draftPaciente,
    patientId: ctx.patientId,
    sourceId: "fonte-cadastro-g2",
    rawRef: "raw-cadastro-g2",
    payload: {},
    diagnostics: [],
    revision: 0,
    criadoEm: em,
  });
  const pacienteEventId = `ev-pac-${ctx.patientId}`;
  const resPac = confirmar(db, {
    operationId: `op-pac-${ctx.patientId}`,
    patientId: ctx.patientId,
    tumorLotId: null,
    encounterId: ctx.encounterId,
    reviewDecisionId: `rev-pac-${ctx.patientId}`,
    sessao,
    em,
    registros: [
      {
        draftId: draftPaciente,
        expectedRevision: 0,
        eventId: pacienteEventId,
        tipo: "Paciente",
        payload: {
          patientId: ctx.patientId,
          identificadores: [{ tipo: "PRONTUARIO", valor: `PRONT-${ctx.patientId}` }],
          nome: `Paciente Sintético ${ctx.patientId}`,
          nascimento: "1970-05-10",
          sexoCadastral: "F",
          divergencia: false,
        },
        fontes: [criarFonteSinteticaG2(`fonte-pac-${ctx.patientId}`)],
        revisao: "CONFIRMADO",
      },
    ],
  });
  if (resPac.estado !== "GRAVADA") throw new Error(`FALHA_SEED_PACIENTE_G2:${resPac.estado}`);

  if (!ctx.tumorLotId) return { pacienteEventId, loteEventId: null };

  const draftLote = `draft-lote-${ctx.tumorLotId}`;
  salvarDraft(db, {
    draftId: draftLote,
    patientId: ctx.patientId,
    sourceId: "fonte-lote-g2",
    rawRef: "raw-lote-g2",
    payload: {},
    diagnostics: [],
    revision: 0,
    criadoEm: em,
  });
  const loteEventId = `ev-lote-${ctx.tumorLotId}`;
  const campoPresente = <T,>(valor: T) => ({
    valor,
    estado: "VERDE" as const,
    campo: "PRESENTE" as const,
    motivo: "Semeadura sintética G2",
    fontes: [criarFonteSinteticaG2(`fonte-lote-${ctx.tumorLotId}`)],
    revisao: "CONFIRMADO" as const,
  });
  const resLote = confirmar(db, {
    operationId: `op-lote-${ctx.tumorLotId}`,
    patientId: ctx.patientId,
    tumorLotId: ctx.tumorLotId,
    encounterId: ctx.encounterId,
    reviewDecisionId: `rev-lote-${ctx.tumorLotId}`,
    sessao,
    em,
    registros: [
      {
        draftId: draftLote,
        expectedRevision: 0,
        eventId: loteEventId,
        tipo: "TumorLot",
        payload: {
          patientId: ctx.patientId,
          tumorLotId: ctx.tumorLotId,
          cid: campoPresente("C50.9"),
          topografia: campoPresente("Mama SOE"),
          histologia: campoPresente("Carcinoma ductal invasivo"),
          estadiamentos: [],
          finalidadeApac: campoPresente("PALIATIVA"),
          marcos: [],
        },
        fontes: [criarFonteSinteticaG2(`fonte-lote-${ctx.tumorLotId}`)],
        revisao: "CONFIRMADO",
      },
    ],
  });
  if (resLote.estado !== "GRAVADA") throw new Error(`FALHA_SEED_LOTE_G2:${resLote.estado}`);
  return { pacienteEventId, loteEventId };
}

export async function abrirServidorHttpG2(opcoes: {
  agoraInicial?: string;
  duracaoSessaoMs?: number;
  salaoRuleset?: ServidorDeps["salaoRuleset"];
  corpus?: ServidorDeps["corpus"];
} = {}) {
  let agora = opcoes.agoraInicial ?? G2_INSTANTE_BASE;
  const temp = criarDiretorioTempG2("http-");
  const db = abrirLedger(temp.sqlitePath);
  const logs: Array<{ rota: string; codigo: string; status: number }> = [];
  const sessoes = criarGerenciadorSessao({
    medicoId: "medico-g2-01",
    crm: "CRM-G2-01",
    senha: G2_SENHA_SINTETICA,
    duracaoMs: opcoes.duracaoSessaoMs ?? 3_600_000,
    agora: () => agora,
  });
  const motorF1 = criarMotorF1(db, () => agora, () => ({
    regras: [],
    biblioteca: { id: "bib-sintetica-g2", versao: "1.0.0", hash: "2".repeat(64) },
  }));
  const gateway = criarGateway({
    agora: () => agora,
    auditar: () => {},
    store: memoriaIdempotencia(),
    executores: {},
  });
  const server = criarServidorLocal(
    {
      db,
      sessoes,
      gateway,
      motorF1,
      agora: () => agora,
      log: (entry) => logs.push(entry),
      configRootDir: join(temp.dir, "config"),
      ...(opcoes.salaoRuleset !== undefined ? { salaoRuleset: opcoes.salaoRuleset } : {}),
      ...(opcoes.corpus !== undefined ? { corpus: opcoes.corpus } : {}),
    },
    { host: "127.0.0.1", port: 0 },
  );
  await new Promise<void>((resolve, reject) => {
    if (server.listening) return resolve();
    server.once("error", reject);
    server.once("listening", resolve);
  });
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("PORTA_EFEMERA_G2_INDISPONIVEL");
  const login = sessoes.login(G2_SENHA_SINTETICA);
  if (!login) throw new Error("LOGIN_INICIAL_G2_FALHOU");

  const post = async <T = Record<string, unknown>>(
    path: string,
    body: unknown,
    token: string | null = login.token,
  ): Promise<{ status: number; data: T }> => {
    const res = await fetch(`http://127.0.0.1:${addr.port}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    return { status: res.status, data: (await res.json()) as T };
  };

  const fechar = async () => {
    server.closeIdleConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (db.isOpen) db.close();
    temp.limpar();
  };

  return {
    db,
    sessoes,
    motorF1,
    server,
    token: login.token,
    sessao: login.sessao,
    logs,
    post,
    obterAgora: () => agora,
    definirAgora: (novoInstante: string) => {
      agora = novoInstante;
    },
    eventosDoPaciente: (patientId: string = G2_CONTEXTO.patientId): ClinicalEvent[] =>
      db
        .prepare("SELECT * FROM clinical_event WHERE patientId=? ORDER BY criadoEm, operationId, eventIndex")
        .all(patientId)
        .map((r) => ({
          ...(r as unknown as ClinicalEvent),
          payload: JSON.parse(String(r.payload)),
          fontes: JSON.parse(String(r.fontes)),
          criadoPor: JSON.parse(String(r.criadoPor)),
        })),
    fechar,
  };
}
