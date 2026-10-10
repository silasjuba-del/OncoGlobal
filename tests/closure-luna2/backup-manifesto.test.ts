import { afterEach, describe, expect, it } from "vitest";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { criarBackup } from "../../scripts/backup.mjs";
import { restaurarBackup } from "../../scripts/backup-restore.mjs";

const roots: string[] = [];
const closeFixtures: Array<() => void> = [];
const PASSWORD = "senha-sintetica-segura";

function adulterarManifestoAutenticado(arquivo: string, destino: string, alterar: (bundle: Record<string, unknown>) => void): string {
  const envelope = JSON.parse(readFileSync(arquivo, "utf8")) as Record<string, string>;
  const chave = scryptSync(PASSWORD, Buffer.from(envelope.salt ?? "", "base64"), 32);
  let plaintext: Buffer;
  try {
    const decipher = createDecipheriv("aes-256-gcm", chave, Buffer.from(envelope.nonce ?? "", "base64"));
    decipher.setAuthTag(Buffer.from(envelope.tag ?? "", "base64"));
    plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext ?? "", "base64")), decipher.final()]);
  } finally { chave.fill(0); }
  const bundle = JSON.parse(plaintext.toString("utf8")) as Record<string, unknown>;
  alterar(bundle);
  const salt = randomBytes(16), nonce = randomBytes(12), novaChave = scryptSync(PASSWORD, salt, 32);
  try {
    const cipher = createCipheriv("aes-256-gcm", novaChave, nonce);
    const ciphertext = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(bundle))), cipher.final()]);
    writeFileSync(destino, JSON.stringify({
      format: "oncoglobal-aes256gcm-v1", salt: salt.toString("base64"), nonce: nonce.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64"),
    }), { flag: "wx", mode: 0o600 });
  } finally { novaChave.fill(0); }
  return destino;
}

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
  const connections: DatabaseSync[] = [];
  for (const [name, path] of Object.entries(stores)) {
    const db = new DatabaseSync(path);
    db.exec("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE sample (value TEXT NOT NULL); INSERT INTO sample VALUES ('synthetic'); PRAGMA user_version=7;");
    if (name === "ledger") db.exec("CREATE TABLE draft_envelope (rawRef TEXT NOT NULL); INSERT INTO draft_envelope VALUES ('drafts/a.txt');");
    connections.push(db);
  }
  let closed = false;
  const finish = () => { if (!closed) { closed = true; for (const db of connections) db.close(); } };
  closeFixtures.push(finish);
  mkdirSync(join(files, "drafts"));
  writeFileSync(join(files, "drafts", "a.txt"), "synthetic draft");
  return { root, data, files, out, stores, finish };
}

afterEach(() => {
  for (const close of closeFixtures.splice(0)) close();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("F09 · manifesto de backup dos três stores SQLite", () => {
  it("faz snapshot consistente de ledger, settings e workspace e valida manifesto no restore", async () => {
    const f = fixture();
    expect(existsSync(`${f.stores.ledger}-wal`)).toBe(true);
    const arquivo = await criarBackup({ stores: f.stores, filesRoot: f.files, destino: f.out, nome: "fixture", senha: PASSWORD });
    f.finish();
    const destino = join(f.root, "restaurado");
    const restored = restaurarBackup({ arquivo, destino, senha: PASSWORD });
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
    const arquivo = await criarBackup({ stores: f.stores, filesRoot: f.files, destino: f.out, nome: "fixture", senha: PASSWORD });
    f.finish();
    const destino = join(f.root, "restaurado");
    expect(() => restaurarBackup({ arquivo, destino, senha: "senha-incorreta" })).toThrow();
    expect(() => restaurarBackup({ arquivo, destino, senha: PASSWORD })).not.toThrow();
    expect(() => restaurarBackup({ arquivo, destino, senha: PASSWORD })).toThrow("DESTINO_NAO_ESTA_LIMPO");
  });

  it("rejeita referências não portáveis em manifesto AES-GCM válido antes de criar staging ou destino", async () => {
    const f = fixture();
    const original = await criarBackup({ stores: f.stores, filesRoot: f.files, destino: f.out, nome: "fixture", senha: PASSWORD });
    f.finish();
    const badRefs = [
      "drafts/nota.txt:fluxo",
      "drafts/CON.txt",
      "drafts/LPT9.json",
      "drafts/nome./item.txt",
      "drafts/nome /item.txt",
      "drafts/./item.txt",
      "C:relativo.txt",
    ];
    for (const [index, ref] of badRefs.entries()) {
      const arquivo = adulterarManifestoAutenticado(original, join(f.out, `manifesto-${index}.ogbak`), (bundle) => {
        const files = bundle.files as Array<Record<string, unknown>>;
        const first = files[0];
        if (!first) throw new Error("fixture sem arquivo sintético");
        first.ref = ref;
      });
      const destino = join(f.root, `restore-${index}`);
      expect(() => restaurarBackup({ arquivo, destino, senha: PASSWORD })).toThrow("REFERENCIA_INVALIDA");
      expect(existsSync(destino)).toBe(false);
      expect(existsSync(`${destino}.restaurando`)).toBe(false);
    }
  });

  it("classifica stores não array e colisões de referências normalizadas como manifesto inválido", async () => {
    const f = fixture();
    const original = await criarBackup({ stores: f.stores, filesRoot: f.files, destino: f.out, nome: "fixture", senha: PASSWORD });
    f.finish();
    const storesArquivo = adulterarManifestoAutenticado(original, join(f.out, "stores-invalido.ogbak"), (bundle) => {
      bundle.stores = { length: 3 };
    });
    expect(() => restaurarBackup({ arquivo: storesArquivo, destino: join(f.root, "restore-stores"), senha: PASSWORD }))
      .toThrow("STORES_INCOMPLETOS");
    const refsArquivo = adulterarManifestoAutenticado(original, join(f.out, "refs-duplicadas.ogbak"), (bundle) => {
      const files = bundle.files as Array<Record<string, unknown>>;
      const first = files[0];
      if (!first) throw new Error("fixture sem arquivo sintético");
      files.push({ ...first, ref: "DRAFTS\\A.TXT" });
    });
    expect(() => restaurarBackup({ arquivo: refsArquivo, destino: join(f.root, "restore-refs"), senha: PASSWORD }))
      .toThrow("MANIFESTO_INVALIDO");
  });

  it("não cria artefato se a entrada do backup contém um Windows Alternate Data Stream", async () => {
    const f = fixture();
    await expect(criarBackup({ stores: f.stores, filesRoot: f.files, files: ["drafts/nota.txt:fluxo"],
      destino: f.out, nome: "ref-ads", senha: PASSWORD })).rejects.toThrow("REFERENCIA_FORA_DA_RAIZ");
    f.finish();
    expect(existsSync(join(f.out, "ref-ads.ogbak"))).toBe(false);
  });
});
