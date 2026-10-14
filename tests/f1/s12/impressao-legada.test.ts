import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, realpathSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { abrirLedger } from "../../../src/kernel/ledger/db.js";
import { criarResolverDocumentoLedger } from "../../../src/kernel/ledger/documentos.js";
import { criarExecutorImprimir, htmlComImpressaoPorClique } from "../../../src/kernel/gateway/executores/imprimir.js";
import { hashCanonico } from "../../../src/rules/conteudoCanonico.js";
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) {
  const real = realpathSync(dir);
  if (dirname(real) !== realpathSync(tmpdir()) || !basename(real).startsWith("s12-print-")) throw Error("TEMP_FORA_ESCOPO");
  rmSync(real, { recursive: true, force: true });
} });
const paciente = "paciente-sintetico", em = "2026-10-10T12:00:00-03:00";
const corpo = { documentId: "doc-legado", documentVersion: 1, titulo: "Receita", texto: "Conteúdo sintético preservado" };
const htmlLegado = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Receita</title></head><body><h1>Receita</h1><p>Prontuário: ${paciente}</p><pre style="white-space:pre-wrap;font-family:inherit">${corpo.texto}</pre><p>Responsável: medico · ${em}</p></body></html>`;
function registrar(db: ReturnType<typeof abrirLedger>, id: string, tipo: string, data: unknown, criadoEm: string, revisao = "CONFIRMADO") {
  db.prepare("INSERT INTO operation VALUES (?,?,?,?)").run(id, "hash-sintetico", null, criadoEm);
  db.prepare("INSERT INTO clinical_event VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").run(id, id, 0, paciente, null, "encontro", tipo,
    JSON.stringify({ reviewDecisionId: "review", data }), "[]", revisao, criadoEm, JSON.stringify({ tipo: "SESSAO", id: "medico" }), null);
}
function assinar(db: ReturnType<typeof abrirLedger>, hash = hashCanonico(corpo)) {
  registrar(db, "assinatura", "DOCUMENTO", { data: corpo, signature: { documentId: corpo.documentId, documentVersion: 1,
    documentHash: hash, serverActorId: "medico", reviewDecisionId: "review" } }, em, "ASSINADO");
}
const intent = { verbo: "IMPRIMIR" as const, objeto: { tipo: "DOCUMENTO", id: corpo.documentId, versao: 1 }, escopo: { patientId: paciente, encounterId: "encontro" }, destino: null, idempotencyKey: "impressao-sintetica" };
// Nome do arquivo sintético deriva do identificador e versão do documento, não é endereço de contato.
const nomeArquivo = `${corpo.documentId}@${intent.objeto.versao}.html`;
it("versão legada conserva HTML e hash exatos no mesmo dia e em outro dia, sem acrescentar nome não assinado", async () => {
  const db = abrirLedger(":memory:"), dir = mkdtempSync(join(tmpdir(), "s12-print-")); dirs.push(dir);
  try {
    registrar(db, "cadastro", "Paciente", { patientId: paciente, nome: "Nome Sintético", identificadores: [], nascimento: null, sexoCadastral: "NAO_INFORMADO", divergencia: false }, "2026-10-09T12:00:00-03:00");
    assinar(db);
    const original = db.prepare("SELECT * FROM clinical_event WHERE eventId='assinatura'").get();
    const resolver = criarResolverDocumentoLedger(db);
    expect(await resolver.resolver({ id: corpo.documentId, version: 1 })).toMatchObject({ html: htmlLegado, hash: createHash("sha256").update(htmlLegado).digest("hex") });
    const pasta = join(dir, "impressao", "2026-10-10"); mkdirSync(pasta, { recursive: true });
    const arquivo = join(pasta, nomeArquivo), bytes = htmlComImpressaoPorClique(htmlLegado); writeFileSync(arquivo, bytes);
    for (const dia of ["2026-10-10", "2026-10-13"]) {
      const imprimir = criarExecutorImprimir({ dataDir: dir, agora: () => `${dia}T12:00:00-03:00`, resolverDocumento: resolver });
      expect(await imprimir.executar({ ...intent, idempotencyKey: `impressao-${dia}` })).toMatchObject({ ok: true });
      expect(readFileSync(join(dir, "impressao", dia, nomeArquivo), "utf8")).toBe(bytes);
    }
    expect(readFileSync(arquivo, "utf8")).toBe(bytes);
    expect(db.prepare("SELECT * FROM clinical_event WHERE eventId='assinatura'").get()).toEqual(original);
  } finally { db.close(); }
});
it("arquivo existente não substitui prova de assinatura, hash ou unicidade da versão", async () => {
  for (const falha of ["hash", "duplicata", "sem-assinatura"]) {
    const db = abrirLedger(":memory:"), dir = mkdtempSync(join(tmpdir(), "s12-print-")); dirs.push(dir);
    try {
      if (falha !== "sem-assinatura") assinar(db, falha === "hash" ? "hash-adulterado" : hashCanonico(corpo));
      if (falha === "duplicata") registrar(db, "assinatura-duplicada", "DOCUMENTO", { data: corpo, signature: { documentId: corpo.documentId,
        documentVersion: 1, documentHash: hashCanonico(corpo), serverActorId: "medico", reviewDecisionId: "review" } }, em, "ASSINADO");
      const pasta = join(dir, "impressao", "2026-10-13"); mkdirSync(pasta, { recursive: true });
      const arquivo = join(pasta, nomeArquivo); writeFileSync(arquivo, htmlComImpressaoPorClique(htmlLegado));
      const imprimir = criarExecutorImprimir({ dataDir: dir, agora: () => "2026-10-13T12:00:00-03:00", resolverDocumento: criarResolverDocumentoLedger(db) });
      expect(await imprimir.executar(intent)).toMatchObject({ ok: false, erro: "DOCUMENTO_NAO_RESOLVIDO" });
      expect(readFileSync(arquivo, "utf8")).toBe(htmlComImpressaoPorClique(htmlLegado));
    } finally { db.close(); }
  }
});
