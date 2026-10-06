import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
// @ts-expect-error script .mjs sem declaração neste worktree
import { criarBackup } from "../../scripts/backup.mjs";
// @ts-expect-error script .mjs sem declaração neste worktree
import { restaurarBackup } from "../../scripts/backup-restore.mjs";

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe("K-23 · fronteira local/cifrada de backup (não prova agendamento diário)", () => {
  it("positivo: cria artefato opaco e restaura somente em destino limpo com a chave fornecida", async () => {
    const dir = mkdtempSync(join(tmpdir(), "oncoglobal-k23-")); dirs.push(dir);
    const dbPath = join(dir, "ledger.sqlite"), filesRoot = join(dir, "files"), destino = join(dir, "externo");
    mkdirSync(filesRoot); mkdirSync(destino);
    const db = abrirLedger(dbPath);
    try {
      db.prepare(`INSERT INTO draft_envelope
        (draftId,patientId,sourceId,rawRef,payload,diagnostics,revision,criadoEm)
        VALUES (?,?,?,?,?,?,?,?)`).run("d1", "Paciente Teste 01", "fonte-sintetica",
          "anexo-opaco", '{"texto":"marcador-sintetico-privado"}', "[]", 0, "2026-10-05T12:00:00Z");
    } finally { db.close(); }
    writeFileSync(join(filesRoot, "anexo-opaco"), "arquivo-sintetico-privado");
    const arquivo = await criarBackup({ dbPath, filesRoot, destino,
      senha: "senha-sintetica-fora-do-pc", nome: "teste-k23" });
    const bytes = readFileSync(arquivo, "utf8");
    expect(bytes).not.toContain("Paciente Teste 01");
    expect(bytes).not.toContain("marcador-sintetico-privado");
    expect(bytes).not.toContain("arquivo-sintetico-privado");
    const restaurado = join(dir, "restaurado");
    const result = restaurarBackup({ arquivo, destino: restaurado, senha: "senha-sintetica-fora-do-pc" });
    expect(readFileSync(join(restaurado, "anexo-opaco"), "utf8")).toBe("arquivo-sintetico-privado");
    const reopened = abrirLedger(result.database);
    try {
      expect(reopened.prepare("SELECT patientId FROM draft_envelope WHERE draftId='d1'").get()?.patientId)
        .toBe("Paciente Teste 01");
    } finally { reopened.close(); }
  });

  it("negativo: referência fora da raiz e restauração com senha incorreta não tocam o destino", async () => {
    const dir = mkdtempSync(join(tmpdir(), "oncoglobal-k23-")); dirs.push(dir);
    const dbPath = join(dir, "ledger.sqlite"), filesRoot = join(dir, "files"), destino = join(dir, "externo");
    mkdirSync(filesRoot); mkdirSync(destino);
    const db = abrirLedger(dbPath); db.close();
    await expect(criarBackup({ dbPath, filesRoot, destino, files: ["../fora-da-raiz"],
      senha: "senha-sintetica-fora-do-pc", nome: "referencia-invalida" }))
      .rejects.toThrow("REFERENCIA_FORA_DA_RAIZ");
    const arquivo = await criarBackup({ dbPath, filesRoot, destino,
      senha: "senha-sintetica-fora-do-pc", nome: "valido" });
    const restaurado = join(dir, "nao-criado");
    expect(() => restaurarBackup({ arquivo, destino: restaurado, senha: "senha-incorreta" })).toThrow();
    expect(existsSync(restaurado)).toBe(false);
  });
});
