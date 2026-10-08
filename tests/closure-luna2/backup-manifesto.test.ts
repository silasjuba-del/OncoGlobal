import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { criarBackup } from "../../scripts/backup.mjs";
import { restaurarBackup } from "../../scripts/backup-restore.mjs";

const roots: string[] = [];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "og-luna2-backup-"));
  roots.push(root);
  const data = join(root, "data"), files = join(root, "files"), out = join(root, "out");
  mkdirSync(data); mkdirSync(files); mkdirSync(out);
  const stores = {
    ledger: join(data, "ledger.sqlite"),
    settings: join(data, "config-w10.sqlite"),
    workspace: join(data, "workspace.sqlite"),
  };
  for (const [name, path] of Object.entries(stores)) {
    const db = new DatabaseSync(path);
    db.exec("PRAGMA journal_mode=WAL; CREATE TABLE sample (value TEXT NOT NULL); INSERT INTO sample VALUES ('synthetic'); PRAGMA user_version=7;");
    if (name === "ledger") db.exec("CREATE TABLE draft_envelope (rawRef TEXT NOT NULL); INSERT INTO draft_envelope VALUES ('drafts/a.txt');");
    db.close();
  }
  mkdirSync(join(files, "drafts"));
  writeFileSync(join(files, "drafts", "a.txt"), "synthetic draft");
  return { root, data, files, out, stores };
}

afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe("F09 · manifesto de backup dos três stores SQLite", () => {
  it("faz snapshot consistente de ledger, settings e workspace e valida manifesto no restore", async () => {
    const f = fixture();
    const arquivo = await criarBackup({ stores: f.stores, filesRoot: f.files, destino: f.out, nome: "fixture", senha: "senha-sintetica-segura" });
    const destino = join(f.root, "restaurado");
    const restored = restaurarBackup({ arquivo, destino, senha: "senha-sintetica-segura" });
    expect(Object.keys(restored.databases ?? {}).sort()).toEqual(["config-w10.sqlite", "ledger.sqlite", "workspace.sqlite"]);
    for (const name of Object.keys(restored.databases ?? {})) {
      const db = new DatabaseSync(join(destino, name));
      expect(db.prepare("PRAGMA integrity_check").get()?.integrity_check).toBe("ok");
      expect(db.prepare("PRAGMA user_version").get()?.user_version).toBe(7);
      expect(db.prepare("SELECT value FROM sample").get()?.value).toBe("synthetic");
      db.close();
    }
  });

  it("não sobrescreve destino preexistente e credencial errada não materializa restauração", async () => {
    const f = fixture();
    const arquivo = await criarBackup({ stores: f.stores, filesRoot: f.files, destino: f.out, nome: "fixture", senha: "senha-sintetica-segura" });
    const destino = join(f.root, "restaurado");
    expect(() => restaurarBackup({ arquivo, destino, senha: "senha-incorreta" })).toThrow();
    expect(() => restaurarBackup({ arquivo, destino, senha: "senha-sintetica-segura" })).not.toThrow();
    expect(() => restaurarBackup({ arquivo, destino, senha: "senha-sintetica-segura" })).toThrow("DESTINO_NAO_ESTA_LIMPO");
  });
});
