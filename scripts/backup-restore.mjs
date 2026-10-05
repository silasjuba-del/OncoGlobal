import { createDecipheriv, createHash, scryptSync } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const hash = (data) => createHash("sha256").update(data).digest("hex");
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

/** All integrity/authentication checks complete before the clean target is touched. */
export function restaurarBackup({ arquivo, destino, senha }) {
  validLocal(arquivo); validLocal(destino);
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
  if (bundle.format !== "oncoglobal-local-backup-v1" || !Array.isArray(bundle.files))
    throw new Error("FORMATO_INVALIDO");
  const dbData = Buffer.from(bundle.database.base64, "base64");
  if (hash(dbData) !== bundle.database.sha256) throw new Error("HASH_INVALIDO");
  const files = bundle.files.map((entry) => {
    const target = fileTarget(destino, entry.ref);
    const data = Buffer.from(entry.base64, "base64");
    if (hash(data) !== entry.sha256) throw new Error("HASH_INVALIDO");
    return { target, data };
  });
  const staging = `${destino}.restaurando`;
  if (existsSync(staging)) throw new Error("STAGING_EXISTENTE");
  mkdirSync(staging);
  try {
    writeFileSync(join(staging, "ledger.sqlite"), dbData, { flag: "wx", mode: 0o600 });
    for (const item of files) {
      const stagedPath = fileTarget(staging, item.target.slice(destino.length + 1));
      mkdirSync(dirname(stagedPath), { recursive: true });
      writeFileSync(stagedPath, item.data, { flag: "wx", mode: 0o600 });
    }
    const db = new DatabaseSync(join(staging, "ledger.sqlite"));
    try {
      if (db.prepare("PRAGMA integrity_check").get()?.integrity_check !== "ok")
        throw new Error("SQLITE_INTEGRITY_INVALID");
    } finally { db.close(); }
    renameSync(staging, destino);
    return { database: join(destino, "ledger.sqlite"), arquivos: files.length };
  } catch (error) {
    // Staging was freshly created at an explicitly checked target path.
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
