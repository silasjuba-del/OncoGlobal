import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, sep } from "node:path";
import { expect, it } from "vitest";
import { criarExecutorImprimir } from "../../../src/kernel/gateway/executores/imprimir.js";
import { criarResolverDocumentoLedger } from "../../../src/kernel/ledger/documentos.js";
import { criarGateway, memoriaIdempotencia } from "../../../src/kernel/gateway/gateway.js";
import { abrirLedger } from "../../../src/kernel/ledger/db.js";
import { lerDraft, salvarDraft } from "../../../src/kernel/ledger/drafts.js";
import { listarEventos } from "../../../src/kernel/ledger/ledger.js";
import { prepararDocumentosConsulta, type DocumentoConsulta } from "../../../src/modules/documentos/consulta.js";
import { criarServidorLocal } from "../../../src/server/http.js";
import { criarGerenciadorSessao } from "../../../src/server/sessao.js";
import { contexto, entradaCanonica } from "./fixture.js";

async function ambiente() {
  const agora = () => "2026-10-12T10:00:00-03:00";
  const db = abrirLedger(":memory:");
  const dir = mkdtempSync(join(tmpdir(), "oncoglobal-s9-"));
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-s9", crm: "CRM-SINTETICO",
    senha: "senha-sintetica-s9", duracaoMs: 60_000, agora });
  const resolverDocumento = criarResolverDocumentoLedger(db);
  const gateway = criarGateway({ agora, auditar: () => {}, store: memoriaIdempotencia(),
    executores: { IMPRIMIR: criarExecutorImprimir({ dataDir: dir, agora, resolverDocumento }) } });
  const server = criarServidorLocal({ db, sessoes, gateway, agora, log: () => {} });
  await new Promise<void>(resolve => server.listening ? resolve() : server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("PORTA_AUSENTE");
  const token = sessoes.login("senha-sintetica-s9")!.token;
  const post = async (path: string, body: unknown) => {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() as { codigo?: string; decisao?: string } };
  };
  // Representa somente a composição entregue ao integrador: usa o MESMO draft store do servidor.
  const persistir = (docs: DocumentoConsulta[]) => {
    for (const d of docs) if (!lerDraft(db, d.documentId)) salvarDraft(db, {
      draftId: d.documentId, patientId: d.contexto.patientId, sourceId: "decisao-s9", rawRef: "fonte-s9",
      payload: d, diagnostics: ["REVISAO_MEDICA_OBRIGATORIA"], revision: 0, criadoEm: agora(),
    });
  };
  const exibir = (docs: DocumentoConsulta[]) => post("/consulta/bundle", { ...contexto, draftIds: docs.map(d => d.documentId) });
  const confirmar = (docs: DocumentoConsulta[], key: string) => post("/consulta/confirmar", {
    ...contexto, bloco: "TUDO", registros: docs.map(d => ({ id: d.documentId, expectedRevision: 0 })),
    documentosExibidos: docs.map(d => ({ documentId: d.documentId, documentVersion: d.documentVersion })),
    reconhecerAlertas: [], idempotencyKey: key,
  });
  const intent = (d: DocumentoConsulta, key: string) => ({ verbo: "IMPRIMIR", objeto: { tipo: "DOCUMENTO", id: d.documentId, versao: d.documentVersion },
    escopo: { patientId: contexto.patientId, encounterId: contexto.encounterId }, destino: null, idempotencyKey: key });
  return { db, dir, post, persistir, exibir, confirmar, intent, resolverDocumento,
    async close() {
      await new Promise<void>(resolve => server.close(() => resolve())); db.close();
      const resolved = realpathSync(dir);
      if (!resolved.toLowerCase().startsWith(realpathSync(tmpdir()).toLowerCase() + sep)
        || !basename(resolved).startsWith("oncoglobal-s9-")) throw new Error("TEMP_FORA_DO_ESCOPO");
      rmSync(resolved, { recursive: true, force: true });
    } };
}

it("S9 causal: preparar → exibir → assinar no servidor → gateway real → reimprimir sem novo encontro", async () => {
  const a = await ambiente();
  try {
    const entrada = entradaCanonica(), preparados = prepararDocumentosConsulta(entrada);
    const docs = preparados.documentos, receita = docs[0]!;
    a.persistir(docs);
    expect((await a.post("/acao", a.intent(receita, "impressao-s9-001"))).status).toBe(409);
    expect(await a.resolverDocumento.resolver({ id: receita.documentId, version: 1 })).toBeNull();
    expect((await a.confirmar(docs, "assinar-s9-001")).status).toBe(409);
    expect((await a.exibir(docs)).status).toBe(200);
    expect((await a.confirmar(docs, "assinar-s9-001")).body.codigo).toBe("GRAVADA");
    const historico = listarEventos(a.db, contexto.patientId);
    expect(historico).toHaveLength(4);
    expect(historico.every(e => e.tipo === "DOCUMENTO" && e.revisao === "ASSINADO")).toBe(true);
    expect(new Set(historico.map(e => e.encounterId))).toEqual(new Set([contexto.encounterId]));
    const assinado = await a.resolverDocumento.resolver({ id: receita.documentId, version: 1 });
    expect(assinado).not.toBeNull();
    expect((await a.post("/acao", a.intent(receita, "impressao-s9-001"))).body.decisao).toBe("EXECUTADA");
    expect((await a.post("/acao", a.intent(receita, "impressao-s9-001"))).body.decisao).toBe("REPLAY");
    expect((await a.post("/acao", a.intent(receita, "impressao-s9-002"))).body.decisao).toBe("EXECUTADA");
    const pasta = join(a.dir, "impressao", "2026-10-12");
    expect(readdirSync(pasta)).toEqual([`${receita.documentId}@1.html`]);
    const html = readFileSync(join(pasta, `${receita.documentId}@1.html`), "utf8");
    expect(html).toContain("40 mg");
    expect(html).toContain("Encontro: encontro-s9");
    expect(html).not.toContain("tarefa-retorno-s9");
    expect(html).toContain('addEventListener("click",()=>window.print())');

    // Nova geração não reconstrói documentos históricos a partir do estado atual.
    entrada.decisao!.medicamentos[0]!.dose = "20 mg";
    a.persistir(prepararDocumentosConsulta(entrada).documentos);
    expect(await a.resolverDocumento.resolver({ id: receita.documentId, version: 1 })).toEqual(assinado);
    expect(listarEventos(a.db, contexto.patientId)).toEqual(historico);
    const errado = a.intent(receita, "impressao-outro-encontro"); errado.escopo.encounterId = "outro-encontro";
    expect((await a.post("/acao", errado)).status).toBe(409);
  } finally { await a.close(); }
});

it("S9 adversarial: alterações após exibição falham antes de criar assinatura", async () => {
  const a = await ambiente();
  try {
    const docs = prepararDocumentosConsulta(entradaCanonica()).documentos;
    a.persistir(docs); expect((await a.exibir(docs)).status).toBe(200);
    const draft = lerDraft(a.db, docs[0]!.documentId)!;
    salvarDraft(a.db, { ...draft, revision: 1, payload: { ...docs[0]!, texto: "mudou após exibição" } });
    const resultado = await a.confirmar(docs, "alterado-s9-001");
    expect(resultado.status).toBe(409);
    expect(resultado.body.codigo).toBe("CONTEUDO_ALTERADO_APOS_EXIBICAO");
    expect(listarEventos(a.db, contexto.patientId)).toEqual([]);
  } finally { await a.close(); }
});

it("S9 adversarial: HTML recebido como texto nunca vira script no impresso", async () => {
  const a = await ambiente();
  try {
    const entrada = entradaCanonica();
    entrada.decisao!.medicamentos[0]!.orientacao = '<img src="https://exemplo.invalid/x" onerror="alert(1)">&\'texto';
    const docs = prepararDocumentosConsulta(entrada).documentos;
    a.persistir(docs); expect((await a.exibir(docs)).status).toBe(200);
    expect((await a.confirmar(docs, "escape-s9-001")).status).toBe(200);
    const documento = await a.resolverDocumento.resolver({ id: docs[0]!.documentId, version: 1 });
    expect(documento!.html).toContain("&lt;img");
    expect(documento!.html).toContain("&quot;");
    expect(documento!.html).toContain("&amp;&#39;");
    expect(documento!.html).not.toContain("<img");
    expect(documento!.html).not.toContain("<script");
  } finally { await a.close(); }
});
