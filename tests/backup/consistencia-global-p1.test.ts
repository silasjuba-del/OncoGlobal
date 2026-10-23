import { afterEach, describe, expect, it } from "vitest";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { criarBackup } from "../../scripts/backup.mjs";
import { restaurarBackup } from "../../scripts/backup-restore.mjs";

const SENHA = "senha-sintetica-backup-consistencia";
const roots: string[] = [];
const closeCallbacks: Array<() => void> = [];

function criarAmbienteStores() {
  const root = mkdtempSync(join(tmpdir(), "og-backup-consistencia-"));
  roots.push(root);
  const data = join(root, "data"), files = join(root, "files"), out = join(root, "out");
  mkdirSync(data); mkdirSync(files); mkdirSync(out);
  mkdirSync(join(files, "anexos"), { recursive: true });
  writeFileSync(join(files, "anexos", "laudo-1.txt"), "laudo sintetico v1");
  writeFileSync(join(files, "anexos", "laudo-2.txt"), "laudo sintetico v2");

  const stores = {
    ledger: join(data, "ledger.sqlite"),
    settings: join(data, "config-w10.sqlite"),
    workspace: join(data, "workspace.sqlite"),
  };
  const dbs: Record<string, DatabaseSync> = {};
  for (const [key, path] of Object.entries(stores)) {
    const db = new DatabaseSync(path);
    db.exec("PRAGMA journal_mode=WAL; CREATE TABLE estado (chave TEXT PRIMARY KEY, valor TEXT NOT NULL); INSERT INTO estado VALUES ('versao', '1'); PRAGMA user_version=3;");
    if (key === "ledger") {
      db.exec(`CREATE TABLE draft_envelope (
        draftId TEXT PRIMARY KEY,
        patientId TEXT,
        sourceId TEXT NOT NULL,
        rawRef TEXT NOT NULL,
        payload TEXT NOT NULL
      );`);
      db.prepare("INSERT INTO draft_envelope VALUES (?, ?, ?, ?, ?)").run(
        "d-1", "Paciente Teste 01", "src-1", "anexos/laudo-1.txt", '{"campo":"biopsia"}',
      );
    }
    dbs[key] = db;
  }
  let closed = false;
  const finish = () => {
    if (!closed) {
      closed = true;
      for (const db of Object.values(dbs)) {
        try { db.close(); } catch { /* ignore */ }
      }
    }
  };
  closeCallbacks.push(finish);
  return { root, data, files, out, stores, dbs, finish };
}

function adulterarPacoteBackup(arquivo: string, destino: string, mutar: (bundle: Record<string, unknown>) => void): string {
  const envelope = JSON.parse(readFileSync(arquivo, "utf8")) as Record<string, string>;
  const chave = scryptSync(SENHA, Buffer.from(envelope.salt ?? "", "base64"), 32);
  let plaintext: Buffer;
  try {
    const decipher = createDecipheriv("aes-256-gcm", chave, Buffer.from(envelope.nonce ?? "", "base64"));
    decipher.setAuthTag(Buffer.from(envelope.tag ?? "", "base64"));
    plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext ?? "", "base64")), decipher.final()]);
  } finally { chave.fill(0); }
  const bundle = JSON.parse(plaintext.toString("utf8")) as Record<string, unknown>;
  mutar(bundle);
  const salt = randomBytes(16), nonce = randomBytes(12), novaChave = scryptSync(SENHA, salt, 32);
  try {
    const cipher = createCipheriv("aes-256-gcm", novaChave, nonce);
    const ciphertext = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(bundle))), cipher.final()]);
    writeFileSync(destino, JSON.stringify({
      format: "oncoglobal-aes256gcm-v1",
      salt: salt.toString("base64"),
      nonce: nonce.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    }), { flag: "wx", mode: 0o600 });
  } finally { novaChave.fill(0); }
  return destino;
}

afterEach(() => {
  for (const fn of closeCallbacks.splice(0)) fn();
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

describe("P1 · Consistência global do backup entre os 3 stores SQLite e anexos físicos", () => {
  it("recusa backup (fail-closed) quando uma nova referência de draft é inserida no ledger durante a captura", async () => {
    const env = criarAmbienteStores();
    await expect(criarBackup({
      stores: env.stores,
      filesRoot: env.files,
      destino: env.out,
      nome: "mutacao-ref-ledger",
      senha: SENHA,
      aoCapturarStore: (storeKey) => {
        if (storeKey === "ledger") {
          env.dbs.ledger!.prepare("INSERT INTO draft_envelope VALUES (?, ?, ?, ?, ?)").run(
            "d-2", "Paciente Teste 01", "src-2", "anexos/laudo-2.txt", '{"campo":"imagem"}',
          );
        }
      },
    })).rejects.toThrow("CONSISTENCIA_BACKUP_VIOLADA");
    expect(existsSync(join(env.out, "mutacao-ref-ledger.ogbak"))).toBe(false);
  });

  it("recusa backup (fail-closed) quando outro store (workspace/settings) muda entre capturas sequenciais", async () => {
    const env = criarAmbienteStores();
    await expect(criarBackup({
      stores: env.stores,
      filesRoot: env.files,
      destino: env.out,
      nome: "mutacao-workspace",
      senha: SENHA,
      aoCapturarStore: (storeKey) => {
        if (storeKey === "ledger") {
          env.dbs.workspace!.prepare("UPDATE estado SET valor='2' WHERE chave='versao'").run();
        }
      },
    })).rejects.toThrow("CONSISTENCIA_BACKUP_VIOLADA");
    expect(existsSync(join(env.out, "mutacao-workspace.ogbak"))).toBe(false);
  });

  it("recusa backup (fail-closed) quando o anexo físico referenciado pelo ledger é alterado durante a captura", async () => {
    const env = criarAmbienteStores();
    await expect(criarBackup({
      stores: env.stores,
      filesRoot: env.files,
      destino: env.out,
      nome: "mutacao-arquivo-fisico",
      senha: SENHA,
      aoCapturarStore: (storeKey) => {
        if (storeKey === "settings") {
          writeFileSync(join(env.files, "anexos", "laudo-1.txt"), "conteudo alterado durante captura");
        }
      },
    })).rejects.toThrow("CONSISTENCIA_BACKUP_VIOLADA");
    expect(existsSync(join(env.out, "mutacao-arquivo-fisico.ogbak"))).toBe(false);
  });

  it("restaurarBackup falha fechado e limpa staging se o ledger restaurado referenciar arquivo omitido do pacote", async () => {
    const env = criarAmbienteStores();
    const original = await criarBackup({
      stores: env.stores,
      filesRoot: env.files,
      destino: env.out,
      nome: "egro",
      senha: SENHA,
    });
    env.finish();

    const adulterado = adulterarPacoteBackup(original, join(env.out, "sem-anexo.ogbak"), (bundle) => {
      bundle.files = [];
    });
    const destinoInvalido = join(env.root, "restore-invalido");
    expect(() => restaurarBackup({ arquivo: adulterado, destino: destinoInvalido, senha: SENHA }))
      .toThrow("REFERENCIA_AUSENTE");
    expect(existsSync(destinoInvalido)).toBe(false);
    expect(existsSync(`${destinoInvalido}.restaurando`)).toBe(false);
  });
});
