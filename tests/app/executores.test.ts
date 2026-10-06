import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import { criarExecutorDesabilitado } from "../../src/app/executores/desabilitados.js";
import { criarExecutorImprimir, htmlComImpressaoPorClique } from "../../src/app/executores/imprimir.js";

const dirs: string[] = [];
const temp = () => {
  const dir = mkdtempSync(join(tmpdir(), "onco-print-"));
  dirs.push(dir);
  return dir;
};
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

const html = "<!doctype html><html><body><main>Documento aprovado</main></body></html>";
const hash = createHash("sha256").update(html).digest("hex");
const documento = (patch: Record<string, unknown> = {}) => ({
  id: "doc-1", version: 1, patientId: "patient-1", html, assinado: true, hash, ...patch,
});
const intent = {
  verbo: "IMPRIMIR" as const,
  objeto: { tipo: "DOCUMENTO", id: "doc-1", versao: 1 },
  escopo: { patientId: "patient-1", encounterId: "enc-1" },
  destino: null, idempotencyKey: "print-op-0001",
};
const session = {
  medicoId: "med-1", crm: "CRM-1", emitidaEm: "2026-10-05T12:00:00.000Z", expiraEm: "2026-10-05T13:00:00.000Z",
};

describe("executores locais", () => {
  it("imprime via gateway e replays não geram arquivo adicional", async () => {
    const root = temp();
    const executor = criarExecutorImprimir({
      dataDir: root,
      agora: () => "2026-10-05T12:00:00.000Z",
      resolverDocumento: { async resolver() { return documento(); } },
    });
    const gateway = criarGateway({
      executores: { IMPRIMIR: executor }, store: memoriaIdempotencia(),
      agora: () => "2026-10-05T12:00:00.000Z", auditar() {},
    });
    const first = await gateway.executar(intent, session);
    const replay = await gateway.executar(intent, session);
    expect(first.decisao).toBe("EXECUTADA");
    expect(replay.decisao).toBe("REPLAY");
    expect(readdirSync(join(root, "impressao", "2026-10-05"))).toEqual(["doc-1@1.html"]);
    const saved = readFileSync(join(root, "impressao", "2026-10-05", "doc-1@1.html"), "utf8");
    expect(saved).toContain("addEventListener(\"click\",()=>window.print())");
  });

  it("publica atomicamente o mesmo artefato para chaves distintas concorrentes", async () => {
    const root = temp();
    const largeHtml = `<html><body>${"x".repeat(1_000_000)}</body></html>`;
    const largeDocument = {
      id: "doc-1", version: 1, patientId: "patient-1", html: largeHtml, assinado: true,
      hash: createHash("sha256").update(largeHtml).digest("hex"),
    };
    const executor = criarExecutorImprimir({
      dataDir: root,
      agora: () => "2026-10-05T12:00:00.000Z",
      resolverDocumento: { async resolver() { await Promise.resolve(); return largeDocument; } },
    });
    const secondIntent = { ...intent, idempotencyKey: "print-op-0002" };
    const results = await Promise.all([executor.executar(intent), executor.executar(secondIntent)]);
    expect(results).toEqual([
      expect.objectContaining({ ok: true, recibo: expect.stringContaining("doc-1@1.html") }),
      expect.objectContaining({ ok: true, recibo: expect.stringContaining("doc-1@1.html") }),
    ]);
    const files = readdirSync(join(root, "impressao", "2026-10-05"));
    expect(files).toHaveLength(1);
    expect(readFileSync(join(root, "impressao", "2026-10-05", files[0]!), "utf8")).toBe(htmlComImpressaoPorClique(largeHtml));
  });

  it("não dispara window.print ao abrir e só instala chamada no listener do clique", () => {
    const out = htmlComImpressaoPorClique(html);
    expect(out).toContain("addEventListener(\"click\",()=>window.print())");
    expect(out).not.toMatch(/<body[^>]*>\s*<script>window\.print\(\)/i);
  });

  it.each([
    [documento({ assinado: false }), intent, "DOCUMENTO_NAO_ASSINADO_OU_ESCOPO_DIVERGENTE"],
    [documento(), { ...intent, escopo: { ...intent.escopo, patientId: "patient-2" } }, "DOCUMENTO_NAO_ASSINADO_OU_ESCOPO_DIVERGENTE"],
    [documento({ html: "alterado" }), intent, "HASH_DOCUMENTO_DIVERGENTE"],
  ])("recusa estado ou escopo inválido", async (doc, action, error) => {
    const executor = criarExecutorImprimir({
      dataDir: temp(), resolverDocumento: { async resolver() { return doc as never; } },
    });
    const result = await executor.executar(action as never);
    expect(result).toMatchObject({ ok: false, erro: error });
  });

  it("aceita modelo em branco apenas quando explicitamente rotulado e sem paciente", async () => {
    const root = temp();
    const blank = "<!doctype html><p>MODELO EM BRANCO</p>";
    const executor = criarExecutorImprimir({
      dataDir: root, agora: () => "2026-10-05T12:00:00Z",
      resolverDocumento: { async resolver() { return {
        id: "blank-1", version: 1, patientId: null, html: blank, assinado: false, modeloEmBranco: true,
        hash: createHash("sha256").update(blank).digest("hex"),
      }; } },
    });
    const result = await executor.executar({ ...intent, objeto: { ...intent.objeto, id: "blank-1" }, escopo: { patientId: null, encounterId: null } } as never);
    expect(result.ok).toBe(true);
  });

  it("rejeita id de documento que poderia atravessar diretórios antes da resolução", async () => {
    const resolver = { async resolver() { throw new Error("não deve ser chamado"); } };
    const executor = criarExecutorImprimir({ dataDir: temp(), resolverDocumento: resolver });
    const result = await executor.executar({
      ...intent, objeto: { ...intent.objeto, id: "../../outside" },
    } as never);
    expect(result).toMatchObject({ ok: false, erro: "DOCUMENTO_INVALIDO" });
  });

  it("capacidades sem implementação falham sem efeitos", async () => {
    await expect(criarExecutorDesabilitado().executar(intent as never)).resolves.toEqual({
      ok: false, incerto: false, erro: "CAPACIDADE_DESABILITADA",
    });
  });
});
