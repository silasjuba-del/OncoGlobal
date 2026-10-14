import { createHash } from "node:crypto";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { expect, it, vi } from "vitest";
import type { OpcoesOpenAi } from "../../../src/kernel/llm/openai/index.js";
import { criarTranscritorDocumentoOriginal, payloadDocumentoOriginal } from "../../../src/kernel/llm/openai/documentoOriginal.js";
import { abrirLedger } from "../../../src/kernel/ledger/db.js";
import { iniciarOncoassistLocal } from "../../../src/app/oncoassistLocal.js";

const captura = vi.hoisted(() => ({ auditar: undefined as OpcoesOpenAi["auditar"] }));
vi.mock("../../../src/kernel/llm/openai/runtime.js", async importar => {
  const real = await importar<typeof import("../../../src/kernel/llm/openai/runtime.js")>();
  return { ...real, criarRuntimeExtracaoLlm: (opcoes: OpcoesOpenAi) => {
    captura.auditar = opcoes.auditar;
    return real.criarRuntimeExtracaoLlm({ ...opcoes, env: {} });
  } };
});
// O alvo deste teste é a composição real da auditoria SQLite, sem abrir rede.
vi.mock("../../../src/server/http.js", async () => {
  const { EventEmitter } = await import("node:events");
  return { criarServidorLocal: () => {
    const server = Object.assign(new EventEmitter(), {
      close(callback: () => void) { server.emit("close"); callback(); }, closeIdleConnections() {},
    });
    queueMicrotask(() => server.emit("listening")); return server;
  } };
});

it("composição local audita transcrição concluída como egresso permitido, sem texto/chave nem confirmação clínica", async () => {
  const dir = mkdtempSync(join(tmpdir(), "s12-audit-")), arquivo = join(dir, "ledger.sqlite");
  abrirLedger(arquivo).close();
  const app = await iniciarOncoassistLocal({ dataDir: dir, medicoId: "medico-sintetico", crm: "CRM-SINTETICO", senha: "senha-sintetica-s12", port: 41899 });
  const db = abrirLedger(arquivo);
  try {
    expect(captura.auditar).toBeTypeOf("function");
    const bytes = Buffer.from("%PDF-1.4\nPDF sintético para transporte injetado"), modelo = "modelo-sintetico";
    const texto = "texto-sintetico-nao-deve-ir-para-auditoria", chave = "chave-sintetica-nao-real";
    const transcritor = criarTranscritorDocumentoOriginal({ env: { ONCOASSIST_OPENAI_ENABLED: "true", ONCOASSIST_OPENAI_DOCUMENTS_ENABLED: "true", ONCOASSIST_OPENAI_MODEL: modelo, OPENAI_API_KEY: chave },
      transporte: { extrair: async () => ({ paginas: [{ n: 1, texto }] }) }, auditar: captura.auditar! });
    const r = await transcritor.transcrever(payloadDocumentoOriginal(modelo, bytes.toString("base64")), createHash("sha256").update(bytes).digest("hex"), 1);
    expect(r).toMatchObject({ status: "DERIVADO_LLM_NAO_VERIFICADO", revisaoObrigatoria: true, criaEventoClinico: false });
    const rows = db.prepare("SELECT decisao,motivoCodigo,politicaVersao FROM audit_event").all();
    expect(rows).toContainEqual({ decisao: "PERMITIDA", motivoCodigo: "D_W9_66_TRANSCRICAO_NAO_VERIFICADA", politicaVersao: "f1-documento-original@1" });
    expect(JSON.stringify(rows)).not.toContain(texto); expect(JSON.stringify(rows)).not.toContain(chave);
    expect(db.prepare("SELECT count(*) AS n FROM clinical_event").get()?.n).toBe(0);
  } finally {
    db.close(); await app.encerrar();
    const real = realpathSync(dir);
    if (dirname(real) !== realpathSync(tmpdir()) || !basename(real).startsWith("s12-audit-")) throw Error("TEMP_FORA_ESCOPO");
    rmSync(real, { recursive: true, force: true });
  }
});
