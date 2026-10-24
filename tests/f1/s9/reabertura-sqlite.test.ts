import { mkdtempSync, readFileSync, realpathSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, sep } from "node:path";
import { expect, it } from "vitest";
import { criarExecutorImprimir } from "../../../src/kernel/gateway/executores/imprimir.js";
import { criarResolverDocumentoLedger } from "../../../src/kernel/ledger/documentos.js";
import { criarGateway } from "../../../src/kernel/gateway/gateway.js";
import { abrirLedger } from "../../../src/kernel/ledger/db.js";
import { salvarDraft } from "../../../src/kernel/ledger/drafts.js";
import { sqliteIdempotencia } from "../../../src/kernel/ledger/idempotencia.js";
import { auditar, listarEventos } from "../../../src/kernel/ledger/ledger.js";
import { dadosDoEvento } from "../../../src/kernel/projections/snapshot.js";
import { prepararDocumentosConsulta, type DocumentoConsulta } from "../../../src/modules/documentos/consulta.js";
import { criarServidorLocal } from "../../../src/server/http.js";
import { criarGerenciadorSessao } from "../../../src/server/sessao.js";
import { contexto, entradaCanonica } from "./fixture.js";

const PREFIXO_TEMP = "oncoglobal-s9-reabertura-";

/** Confere o destino real antes da primeira escrita e novamente antes da remoção recursiva. */
function diretorioTemporarioValidado(caminho: string): string {
  const raiz = realpathSync(tmpdir());
  const real = realpathSync(caminho);
  if (!real.toLowerCase().startsWith(`${raiz.toLowerCase()}${sep}`)
    || dirname(real).toLowerCase() !== raiz.toLowerCase()
    || !basename(real).startsWith(PREFIXO_TEMP)) throw new Error("TEMP_FORA_DO_ESCOPO_S9_REABERTURA");
  return real;
}

async function iniciar(dir: string, instante: string) {
  const dataDir = diretorioTemporarioValidado(dir);
  const caminhoLedger = join(dataDir, "ledger-sintetico.sqlite");
  const db = abrirLedger(caminhoLedger);
  const agora = () => instante;
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-s9", crm: "CRM-SINTETICO",
    senha: "senha-sintetica-reabertura-s9", duracaoMs: 60_000, agora });
  const resolverDocumento = criarResolverDocumentoLedger(db);
  const gateway = criarGateway({ agora, store: sqliteIdempotencia(db),
    auditar: registro => auditar(db, { ...registro, ator: { tipo: "SISTEMA", id: "gateway-s9" }, politicaVersao: "teste-s9" }),
    executores: { IMPRIMIR: criarExecutorImprimir({ dataDir, agora, resolverDocumento }) } });
  const server = criarServidorLocal({ db, sessoes, gateway, agora, log: () => {} });
  let fechado = false;
  async function fechar() {
    if (fechado) return;
    fechado = true;
    try {
      await new Promise<void>((resolve, reject) => server.close(erro => erro ? reject(erro) : resolve()));
    } finally { db.close(); }
  }
  try {
    await new Promise<void>((resolve, reject) => {
      if (server.listening) resolve();
      else { server.once("listening", resolve); server.once("error", reject); }
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("PORTA_AUSENTE");
    const post = async (path: string, body: unknown, token?: string) => {
      const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
        method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() as Record<string, unknown> };
    };
    const login = await post("/login", { senha: "senha-sintetica-reabertura-s9" });
    if (login.status !== 200 || typeof login.body.token !== "string") throw new Error("LOGIN_SINTETICO_FALHOU");
    const token = login.body.token;
    sessoes.selecionarConsulta(token, contexto); // confirmação exige a consulta aberta (EST-02)
    const persistir = (docs: DocumentoConsulta[]) => {
      for (const d of docs) salvarDraft(db, {
        draftId: d.documentId, patientId: d.contexto.patientId, sourceId: "decisao-s9", rawRef: "fonte-s9",
        payload: d, diagnostics: ["REVISAO_MEDICA_OBRIGATORIA"], revision: 0, criadoEm: agora(),
      });
    };
    return { db, caminhoLedger, resolverDocumento, token, post, persistir, fechar,
      postAutenticado: (path: string, body: unknown) => post(path, body, token) };
  } catch (erro) { await fechar(); throw erro; }
}

const intent = (d: DocumentoConsulta, key: string) => ({
  verbo: "IMPRIMIR", objeto: { tipo: "DOCUMENTO", id: d.documentId, versao: d.documentVersion },
  escopo: { patientId: contexto.patientId, encounterId: contexto.encounterId }, destino: null, idempotencyKey: key,
});

it("S9 HTTP/SQLite: reabrir arquivo e nova sessão preserva assinatura histórica e reimprime sem novo documento/encontro", async () => {
  const dir = diretorioTemporarioValidado(mkdtempSync(join(tmpdir(), PREFIXO_TEMP)));
  let runtime: Awaited<ReturnType<typeof iniciar>> | null = null;
  try {
    runtime = await iniciar(dir, "2026-10-12T10:00:00-03:00");
    const documentos = prepararDocumentosConsulta(entradaCanonica()).documentos;
    const receita = documentos[0]!;
    runtime.persistir(documentos);
    expect((await runtime.postAutenticado("/consulta/bundle", {
      ...contexto, draftIds: documentos.map(d => d.documentId),
    })).status).toBe(200);
    expect(await runtime.postAutenticado("/consulta/confirmar", {
      ...contexto, bloco: "TUDO", registros: documentos.map(d => ({ id: d.documentId, expectedRevision: 0 })),
      documentosExibidos: documentos.map(d => ({ documentId: d.documentId, documentVersion: d.documentVersion })),
      reconhecerAlertas: [], idempotencyKey: "assinar-reabertura-s9-001",
    })).toMatchObject({ status: 200, body: { codigo: "GRAVADA" } });

    const historico = listarEventos(runtime.db, contexto.patientId);
    expect(historico).toHaveLength(4);
    expect(historico.every(e => e.tipo === "DOCUMENTO" && e.revisao === "ASSINADO")).toBe(true);
    expect(new Set(historico.map(e => e.encounterId))).toEqual(new Set([contexto.encounterId]));
    const documentoHistorico = historico.find(e =>
      (dadosDoEvento(e)?.data as { documentId?: unknown } | undefined)?.documentId === receita.documentId)!;
    expect(dadosDoEvento(documentoHistorico)?.data).toEqual(receita);
    const antes = await runtime.resolverDocumento.resolver({ id: receita.documentId, version: receita.documentVersion });
    expect(antes).toMatchObject({ id: receita.documentId, version: 1, patientId: contexto.patientId, assinado: true });
    expect(antes!.html).toContain("40 mg");
    expect(antes!.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(await runtime.postAutenticado("/acao", intent(receita, "imprimir-reabertura-s9-001")))
      .toMatchObject({ status: 200, body: { decisao: "EXECUTADA" } });
    const caminhoImpressao = join(dir, "impressao", "2026-10-12", `${receita.documentId}@1.html`);
    const htmlImpresso = readFileSync(caminhoImpressao, "utf8");
    const tokenAnterior = runtime.token;
    const caminhoLedger = runtime.caminhoLedger;
    await runtime.fechar();
    runtime = null;
    expect(statSync(caminhoLedger).isFile()).toBe(true);
    expect(statSync(caminhoLedger).size).toBeGreaterThan(0);

    // Novas instâncias de HTTP, conexão SQLite, sessões, resolver e gateway; nenhum cache reaproveitado.
    runtime = await iniciar(dir, "2026-10-12T11:00:00-03:00");
    const bancoPrincipal = runtime.db.prepare("PRAGMA database_list").all().find(b => b.name === "main");
    expect(realpathSync(String(bancoPrincipal!.file))).toBe(realpathSync(caminhoLedger));
    expect(runtime.token).not.toBe(tokenAnterior);
    expect((await runtime.post("/acao", intent(receita, "imprimir-reabertura-s9-002"), tokenAnterior)).status).toBe(401);
    expect(listarEventos(runtime.db, contexto.patientId)).toEqual(historico);
    expect(await runtime.resolverDocumento.resolver({ id: receita.documentId, version: receita.documentVersion })).toEqual(antes);

    // O estado de trabalho muda, sem confirmar nem substituir o snapshot histórico.
    const novaEntrada = entradaCanonica();
    novaEntrada.operationId = "preparar-s9-posterior";
    novaEntrada.revisao = "fatos-2";
    novaEntrada.decisao!.medicamentos[0]!.dose = "20 mg";
    const posteriores = prepararDocumentosConsulta(novaEntrada).documentos;
    expect(posteriores[0]!.documentId).not.toBe(receita.documentId);
    runtime.persistir(posteriores);
    expect(await runtime.resolverDocumento.resolver({ id: posteriores[0]!.documentId, version: 1 })).toBeNull();
    expect(await runtime.resolverDocumento.resolver({ id: receita.documentId, version: receita.documentVersion })).toEqual(antes);

    // A idempotência sobrevive à reabertura. Uma intenção NOVA imprime o mesmo histórico sem nova assinatura.
    expect(await runtime.postAutenticado("/acao", intent(receita, "imprimir-reabertura-s9-001")))
      .toMatchObject({ status: 200, body: { decisao: "REPLAY" } });
    expect(await runtime.postAutenticado("/acao", intent(receita, "imprimir-reabertura-s9-002")))
      .toMatchObject({ status: 200, body: { decisao: "EXECUTADA" } });
    expect(readFileSync(caminhoImpressao, "utf8")).toBe(htmlImpresso);
    expect(listarEventos(runtime.db, contexto.patientId)).toEqual(historico);
    expect(runtime.db.prepare("SELECT COUNT(*) AS n FROM clinical_event WHERE tipo='DOCUMENTO'").get()!.n).toBe(4);
    expect(runtime.db.prepare("SELECT COUNT(DISTINCT encounterId) AS n FROM clinical_event").get()!.n).toBe(1);
    expect(runtime.db.prepare("SELECT COUNT(*) AS n FROM operation").get()!.n).toBe(1);
    expect(runtime.db.prepare("SELECT COUNT(*) AS n FROM action_idempotency").get()!.n).toBe(2);
  } finally {
    try { await runtime?.fechar(); }
    finally { rmSync(diretorioTemporarioValidado(dir), { recursive: true, force: true }); }
  }
});
