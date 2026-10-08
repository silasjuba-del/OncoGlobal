import { createDecipheriv, createHash, scryptSync } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const hash = (data) => createHash("sha256").update(data).digest("hex");
const STORE_NAMES = new Set(["ledger.sqlite", "config-w10.sqlite", "workspace.sqlite"]);
function validLocal(path) {
  if (typeof path !== "string" || !isAbsolute(path) || /^(?:\\\\|\/\/|[a-z]+:\/\/)/i.test(path))
    throw new Error("CAMINHO_LOCAL_ABSOLUTO_OBRIGATORIO");
}
function fileTarget(root, ref) {
  if (typeof ref !== "string" || !ref || isAbsolute(ref) || ref.split(/[\\/]/).includes("..")
    || /^(?:\\\\|\/\/|[a-z]+:\/\/)/i.test(ref)) throw new Error("REFERENCIA_INVALIDA");
  const result = resolve(root, ref);
  if (!result.startsWith(resolve(root) + sep)) throw new Error("REFERENCIA_INVALIDA");
  return result;
}
function schemaMetadata(db) {
  const rows = db.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name, tbl_name").all();
  return {
    userVersion: Number(db.prepare("PRAGMA user_version").get()?.user_version ?? 0),
    schemaSha256: hash(Buffer.from(JSON.stringify(rows))),
  };
}
function validarBanco(path, expected) {
  const db = new DatabaseSync(path);
  try {
    if (db.prepare("PRAGMA integrity_check").get()?.integrity_check !== "ok") throw new Error("SQLITE_INTEGRITY_INVALID");
    if (expected) {
      const atual = schemaMetadata(db);
      if (atual.userVersion !== expected.userVersion || atual.schemaSha256 !== expected.schemaSha256)
        throw new Error("SCHEMA_VERSION_INVALID");
    }
  } finally { db.close(); }
}
function decodificarBanco(item, expectedName) {
  if (!item || item.name !== expectedName || !Number.isInteger(item.userVersion) || item.userVersion < 0
    || !/^[a-f0-9]{64}$/.test(item.sha256) || !/^[a-f0-9]{64}$/.test(item.schemaSha256)
    || typeof item.base64 !== "string") throw new Error("MANIFESTO_INVALIDO");
  const data = Buffer.from(item.base64, "base64");
  if (hash(data) !== item.sha256) throw new Error("HASH_INVALIDO");
  return { data, expected: { userVersion: item.userVersion, schemaSha256: item.schemaSha256 } };
}

/** All authentication, manifest, hash and SQLite checks finish in staging before destination appears. */
export function restaurarBackup({ arquivo, destino, senha }) {
  validLocal(arquivo); validLocal(destino);
  if (typeof senha !== "string" || senha.length < 12) throw new Error("SENHA_INSUFICIENTE");
  if (existsSync(destino)) throw new Error("DESTINO_NAO_ESTA_LIMPO");
  const envelope = JSON.parse(readFileSync(arquivo, "utf8"));
  if (envelope.format !== "oncoglobal-aes256gcm-v1") throw new Error("FORMATO_INVALIDO");
  const key = scryptSync(senha, Buffer.from(envelope.salt, "base64"), 32);
  let decoded;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.nonce, "base64"));
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
    decoded = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]);
  } finally { key.fill(0); }
  const bundle = JSON.parse(decoded.toString("utf8"));
  const legacy = bundle.format === "oncoglobal-local-backup-v1";
  const multi = bundle.format === "oncoglobal-local-backup-v2" && bundle.manifestVersion === 2;
  if ((!legacy && !multi) || !Array.isArray(bundle.files)) throw new Error("FORMATO_INVALIDO");
  if (multi && (!Number.isFinite(Date.parse(bundle.capturedAt)) || !Number.isFinite(Date.parse(bundle.completedAt))
    || Date.parse(bundle.completedAt) < Date.parse(bundle.capturedAt))) throw new Error("MANIFESTO_INVALIDO");
  const databases = new Map();
  if (legacy) {
    const item = bundle.database;
    if (!item || typeof item.base64 !== "string" || !/^[a-f0-9]{64}$/.test(item.sha256)) throw new Error("MANIFESTO_INVALIDO");
    const data = Buffer.from(item.base64, "base64");
    if (hash(data) !== item.sha256) throw new Error("HASH_INVALIDO");
    databases.set("ledger.sqlite", { data, expected: null });
  } else {
    if (bundle.stores.length !== 3) throw new Error("STORES_INCOMPLETOS");
    for (const name of STORE_NAMES) {
      const item = bundle.stores.find((store) => store?.name === name);
      if (!item) throw new Error("STORES_INCOMPLETOS");
      databases.set(name, decodificarBanco(item, name));
    }
    if (new Set(bundle.stores.map((store) => store?.name)).size !== bundle.stores.length) throw new Error("MANIFESTO_INVALIDO");
  }
  const files = bundle.files.map((entry) => {
    const target = fileTarget(destino, entry?.ref);
    const relative = entry.ref.replaceAll("\\", "/");
    if (STORE_NAMES.has(relative) || !/^[a-f0-9]{64}$/.test(entry.sha256) || typeof entry.base64 !== "string")
      throw new Error("MANIFESTO_INVALIDO");
    const data = Buffer.from(entry.base64, "base64");
    if (hash(data) !== entry.sha256) throw new Error("HASH_INVALIDO");
    return { target, data };
  });
  const staging = `${destino}.restaurando`;
  if (existsSync(staging)) throw new Error("STAGING_EXISTENTE");
  mkdirSync(staging);
  try {
    for (const [name, item] of databases) {
      const path = join(staging, name);
      writeFileSync(path, item.data, { flag: "wx", mode: 0o600 });
      validarBanco(path, item.expected);
    }
    for (const item of files) {
      const stagedPath = fileTarget(staging, item.target.slice(destino.length + 1));
      mkdirSync(dirname(stagedPath), { recursive: true });
      writeFileSync(stagedPath, item.data, { flag: "wx", mode: 0o600 });
    }
    renameSync(staging, destino);
    const database = join(destino, "ledger.sqlite");
    return multi
      ? { database, databases: Object.fromEntries([...databases.keys()].map((name) => [name, join(destino, name)])), arquivos: files.length }
      : { database, arquivos: files.length };
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , arquivo, destino] = process.argv;
  const senha = process.env.ONCOGLOBAL_BACKUP_PASSWORD;
  delete process.env.ONCOGLOBAL_BACKUP_PASSWORD;
  if (!senha) { console.error("BACKUP_PASSWORD_REQUIRED"); process.exitCode = 1; }
  else {
    try { restaurarBackup({ arquivo, destino, senha }); console.log("BACKUP_RESTAURADO"); }
    catch { console.error("BACKUP_RESTAURACAO_FALHOU"); process.exitCode = 1; }
  }
}
