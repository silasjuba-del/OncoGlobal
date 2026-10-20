import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// proveniência: dados sintéticos - não utilizar em produção
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { salvarDraft, lerDraft } from "../../src/kernel/ledger/drafts.js";
import { criarBackup } from "../../scripts/backup.mjs";
import { restaurarBackup } from "../../scripts/backup-restore.mjs";

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
const SENHA = "senha-sintetica-backup";
const EM = "2026-10-19T12:00:00Z";

function cenario() {
  const dir = mkdtempSync(join(tmpdir(), "og-rawref-")); dirs.push(dir);
  const dbPath = join(dir, "ledger.sqlite"), root = join(dir, "files"), dest = join(dir, "externo");
  mkdirSync(join(root, "anexos"), { recursive: true }); mkdirSync(dest);
  writeFileSync(join(root, "anexos", "fisico.txt"), "conteudo-fisico-sintetico");
  const db = abrirLedger(dbPath);
  return { dir, dbPath, root, dest, db };
}
function draft(db: ReturnType<typeof abrirLedger>, draftId: string, rawRef: string, payload: unknown) {
  salvarDraft(db, { draftId, patientId: "paciente-sintetico", sourceId: `fonte-${draftId}`, rawRef, payload, diagnostics: [], revision: 0, criadoEm: EM });
}

describe("backup: rawRef interno conhecido vs físico vs desconhecido (ARQ-05)", () => {
  it.each<[string, unknown]>([
    ["referencia-local", { kind: "FONTE_JEV" }],
    ["consulta-flash-local", { kind: "FLASH_RASCUNHO" }],
    ["vinculo-operacional-local", { contatoId: "contato-sintetico" }],
    ["proposta-prescricao-local", { kind: "PRESCRICAO_RASCUNHO" }],
    ["proposta-local", { schema: "PrescricaoProposta@1" }],
  ])("R33-01: literal %s com arquivo físico homônimo é ambíguo e não gera backup incompleto", async (ref, payload) => {
    const c = cenario();
    writeFileSync(join(c.root, ref), "anexo-fisico-sintetico-nao-omitir");
    draft(c.db, "d-literal", ref, payload);
    c.db.close();
    await expect(criarBackup({ dbPath: c.dbPath, filesRoot: c.root, destino: c.dest, nome: "literal", senha: SENHA }))
      .rejects.toThrow("REFERENCIA_AMBIGUA");
    expect(existsSync(join(c.dest, "literal.ogbak"))).toBe(false);
  });

  it("positivos: upload, Flash, triagem, manual, Jev(entre drafts), síntese, auto-ref e físico válido restauram bytes e conteúdo lógico", async () => {
    const c = cenario();
    draft(c.db, "d-upload", "upload-local:doc-sintetico", { kind: "EXTRACAO_RASCUNHO", input: { id: "doc-sintetico" }, original: { tipo: "PDF", bytesBase64: "QUFB", contentHash: "a".repeat(64) } });
    draft(c.db, "d-flash", "consulta-flash-local", { kind: "FLASH_RASCUNHO", plano: { sintese: "sintetica" } });
    draft(c.db, "d-triagem", "triagem-local:encontro-sintetico", { kind: "SALAO_TRIAGEM_RASCUNHO", contexto: { encounterId: "encontro-sintetico" } });
    draft(c.db, "d-manual", "manual:abc123", { campo: "medicamentos", valor: ["medicamento-sintetico"] });
    draft(c.db, "d-fonte-jev", "referencia-local", { kind: "FONTE_JEV" });
    // Jev: rawRef é o draftId da fonte (referência entre drafts), não arquivo.
    draft(c.db, "d-jev", "d-fonte-jev", { kind: "JEV_PROPOSTA_RASCUNHO" });
    draft(c.db, "d-sintese", "retrato-local:rev-sintetica", { kind: "SINTESE_RASCUNHO", snapshot: "sintetico" });
    draft(c.db, "d-self", "d-self", { contexto: {}, valor: { campo: "sintetico" } });
    draft(c.db, "d-fisico", "anexos/fisico.txt", { campo: "anexo" });
    c.db.close();
    const arquivo = await criarBackup({ dbPath: c.dbPath, filesRoot: c.root, destino: c.dest, nome: "positivos", senha: SENHA });
    const saida = join(c.dir, "restaurado");
    const restored = restaurarBackup({ arquivo, destino: saida, senha: SENHA });
    expect(restored.arquivos).toBe(1);
    expect(readFileSync(join(saida, "anexos", "fisico.txt"), "utf8")).toBe("conteudo-fisico-sintetico");
    const reaberto = abrirLedger(restored.database);
    try {
      expect(lerDraft(reaberto, "d-upload")?.rawRef).toBe("upload-local:doc-sintetico");
      expect((lerDraft(reaberto, "d-upload")?.payload as { original?: { bytesBase64?: string } }).original?.bytesBase64).toBe("QUFB");
      expect(lerDraft(reaberto, "d-jev")?.rawRef).toBe("d-fonte-jev");
      expect(lerDraft(reaberto, "d-sintese")?.rawRef).toBe("retrato-local:rev-sintetica");
      expect(lerDraft(reaberto, "d-flash")?.payload).toMatchObject({ kind: "FLASH_RASCUNHO" });
    } finally { reaberto.close(); }
  });

  it("negativo: associação falsa kind×referência (upload-local com payload alheio) é recusada sem artefato", async () => {
    const c = cenario();
    draft(c.db, "d-falso", "upload-local:doc-sintetico", { kind: "FLASH_RASCUNHO" });
    c.db.close();
    await expect(criarBackup({ dbPath: c.dbPath, filesRoot: c.root, destino: c.dest, nome: "falso", senha: SENHA })).rejects.toThrow(/REFERENCIA/);
    expect(existsSync(join(c.dest, "falso.ogbak"))).toBe(false);
  });

  it("negativos: esquema desconhecido, físico ausente e opaco ausente/ambíguo são recusados sem artefato", async () => {
    const casos: Array<[string, string, unknown]> = [
      ["esquema", "provedor-desconhecido:objeto-1", { kind: "EXTRACAO_RASCUNHO" }],
      ["ausente", "anexos/ausente.txt", { campo: "anexo" }],
      ["opaco", "token-opaco-sem-arquivo", { campo: "sintetico" }],
    ];
    for (const [nome, ref, payload] of casos) {
      const c = cenario();
      draft(c.db, `d-${nome}`, ref, payload);
      c.db.close();
      await expect(criarBackup({ dbPath: c.dbPath, filesRoot: c.root, destino: c.dest, nome, senha: SENHA })).rejects.toThrow(/REFERENCIA/);
      expect(existsSync(join(c.dest, `${nome}.ogbak`))).toBe(false);
    }
  });

  it("positivos do produtor real: revisao-local aponta à origem e draft LLM herda upload-local da fonte", async () => {
    const c = cenario();
    draft(c.db, "d-origem", "upload-local:doc-sintetico", { kind: "EXTRACAO_RASCUNHO", input: { id: "doc-sintetico" }, original: { tipo: "PDF", bytesBase64: "QUFB", contentHash: "a".repeat(64) } });
    // rotas.ts: rawRef revisao-local:<draftId da ORIGEM>, draftId próprio é o derivado.
    draft(c.db, "evolucao-extracao-sintetica", "revisao-local:d-origem", { kind: "EVOLUCAO_RASCUNHO", origem: { draftId: "d-origem", revision: 0, conteudoHash: "b".repeat(64) }, resumo: "sintetico" });
    // extracaoLlm.ts: draft llm:* herda rawRef da fonte, payload carrega sourceDraftId.
    draft(c.db, "llm:sintetico", "upload-local:doc-sintetico", { kind: "LLM_EXTRACAO_RASCUNHO", operationId: "op-sintetica", sourceDraftId: "d-origem", sourceDraftHash: "c".repeat(64), resultado: { status: "PROPOSTA" } });
    c.db.close();
    const arquivo = await criarBackup({ dbPath: c.dbPath, filesRoot: c.root, destino: c.dest, nome: "derivados", senha: SENHA });
    const saida = join(c.dir, "restaurado-derivados");
    const restored = restaurarBackup({ arquivo, destino: saida, senha: SENHA });
    const reaberto = abrirLedger(restored.database);
    try {
      expect(lerDraft(reaberto, "evolucao-extracao-sintetica")?.rawRef).toBe("revisao-local:d-origem");
      expect(lerDraft(reaberto, "llm:sintetico")?.rawRef).toBe("upload-local:doc-sintetico");
    } finally { reaberto.close(); }
  });

  it("negativos: revisao-local sem origem correspondente e LLM sem fonte correspondente são recusados", async () => {
    const casos: Array<[string, string, string, unknown]> = [
      ["rev-orfao", "evolucao-x", "revisao-local:d-inexistente", { kind: "EVOLUCAO_RASCUNHO", origem: { draftId: "d-inexistente" } }],
      ["rev-divergente", "evolucao-y", "revisao-local:d-origem", { kind: "EVOLUCAO_RASCUNHO", origem: { draftId: "outra-origem" } }],
      ["llm-orfao", "llm:y", "upload-local:doc-sintetico", { kind: "LLM_EXTRACAO_RASCUNHO", sourceDraftId: "d-inexistente" }],
    ];
    for (const [nome, draftId, ref, payload] of casos) {
      const c = cenario();
      draft(c.db, "d-origem", "upload-local:doc-sintetico", { kind: "EXTRACAO_RASCUNHO" });
      draft(c.db, draftId, ref, payload);
      c.db.close();
      await expect(criarBackup({ dbPath: c.dbPath, filesRoot: c.root, destino: c.dest, nome, senha: SENHA })).rejects.toThrow(/REFERENCIA/);
      expect(existsSync(join(c.dest, `${nome}.ogbak`))).toBe(false);
    }
  });

  it("ambíguo: rawRef igual a draftId mas com arquivo físico homônimo na raiz é recusado, nunca omitido em silêncio", async () => {
    const c = cenario();
    writeFileSync(join(c.root, "d-fonte-ambigua"), "bytes-fisicos-sinteticos");
    draft(c.db, "d-fonte-ambigua", "referencia-local", { kind: "FONTE_JEV" });
    draft(c.db, "d-usa", "d-fonte-ambigua", { campo: "anexo" });
    c.db.close();
    await expect(criarBackup({ dbPath: c.dbPath, filesRoot: c.root, destino: c.dest, nome: "ambiguo", senha: SENHA })).rejects.toThrow(/REFERENCIA_AMBIGUA/);
    expect(existsSync(join(c.dest, "ambiguo.ogbak"))).toBe(false);
  });

  it("negativo: traversal e junction/symlink para fora da raiz continuam recusados", async () => {
    const c = cenario();
    draft(c.db, "d-trav", "../fora.txt", { campo: "x" });
    c.db.close();
    await expect(criarBackup({ dbPath: c.dbPath, filesRoot: c.root, destino: c.dest, nome: "trav", senha: SENHA })).rejects.toThrow(/REFERENCIA/);
    const c2 = cenario();
    const fora = join(c2.dir, "fora"); mkdirSync(fora); writeFileSync(join(fora, "segredo.txt"), "sintetico-fora");
    symlinkSync(fora, join(c2.root, "atalho"), "junction");
    draft(c2.db, "d-junction", "atalho/segredo.txt", { campo: "x" });
    c2.db.close();
    await expect(criarBackup({ dbPath: c2.dbPath, filesRoot: c2.root, destino: c2.dest, nome: "junction", senha: SENHA })).rejects.toThrow(/REFERENCIA/);
    expect(existsSync(join(c2.dest, "junction.ogbak"))).toBe(false);
  });
});
