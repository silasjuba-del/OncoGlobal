import { backup, DatabaseSync } from "node:sqlite";
import { createCipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { readFileSync, realpathSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { basename, isAbsolute, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const hash = (data) => createHash("sha256").update(data).digest("hex");
const networkPath = (path) => /^(?:\\\\|\/\/|[a-z]+:\/\/)/i.test(path);
function local(path) {
  if (typeof path !== "string" || !isAbsolute(path) || networkPath(path))
    throw new Error("CAMINHO_LOCAL_ABSOLUTO_OBRIGATORIO");
}
function inside(root, rel) {
  if (!rel || isAbsolute(rel) || networkPath(rel) || rel.split(/[\\/]/).includes(".."))
    throw new Error("REFERENCIA_FORA_DA_RAIZ");
  const full = resolve(root, rel);
  if (!full.startsWith(resolve(root) + sep)) throw new Error("REFERENCIA_FORA_DA_RAIZ");
  return full;
}

/**
 * Database backup API includes uncheckpointed WAL. Referenced files are supplied
 * explicitly by the local caller; no recursive inventory or cloud transport.
 */
export async function criarBackup({ dbPath, filesRoot, files = [], destino, senha, nome }) {
  local(dbPath); local(filesRoot); local(destino);
  if (!senha || senha.length < 12) throw new Error("SENHA_INSUFICIENTE");
  if (!statSync(destino).isDirectory() || !statSync(filesRoot).isDirectory())
    throw new Error("DIRETORIO_INVALIDO");
  if (!/^[a-zA-Z0-9_-]+$/.test(nome)) throw new Error("NOME_INVALIDO");
  const output = join(destino, `${nome}.ogbak`);
  const temporaryDb = join(destino, `${nome}-${randomBytes(8).toString("hex")}.sqlite`);
  let written = false;
  try {
    const db = new DatabaseSync(dbPath);
    let refs;
    try {
      // Referenced draft files cannot be silently omitted by the CLI.
      const rows = db.prepare("SELECT rawRef FROM draft_envelope").all();
      refs = [...new Set([...rows.map((row) => String(row.rawRef)), ...files])].sort();
      await backup(db, temporaryDb);
    } finally { db.close(); }
    const database = readFileSync(temporaryDb);
    const entries = refs.map((ref) => {
      const source = inside(filesRoot, ref);
      if (realpathSync(source) !== source || !statSync(source).isFile())
        throw new Error("REFERENCIA_INVALIDA");
      const data = readFileSync(source);
      return { ref, sha256: hash(data), base64: data.toString("base64") };
    });
    const plaintext = Buffer.from(JSON.stringify({
      format: "oncoglobal-local-backup-v1", database: { sha256: hash(database), base64: database.toString("base64") },
      files: entries,
    }));
    const salt = randomBytes(16), nonce = randomBytes(12);
    const key = scryptSync(senha, salt, 32);
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    key.fill(0);
    const envelope = Buffer.from(JSON.stringify({
      format: "oncoglobal-aes256gcm-v1", salt: salt.toString("base64"), nonce: nonce.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64"),
    }));
    writeFileSync(output, envelope, { flag: "wx", mode: 0o600 });
    written = true;
    return output;
  } finally {
    try { unlinkSync(temporaryDb); } catch { /* backup API may have failed before temp creation */ }
    if (!written) { /* never delete pre-existing output */ }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , dbPath, filesRoot, destino, nome] = process.argv;
  const senha = process.env.ONCOGLOBAL_BACKUP_PASSWORD;
  delete process.env.ONCOGLOBAL_BACKUP_PASSWORD;
  if (!senha) { console.error("BACKUP_PASSWORD_REQUIRED"); process.exitCode = 1; }
  else {
    criarBackup({ dbPath, filesRoot, destino, nome, senha, files: [] })
      .then((path) => console.log(`BACKUP_CRIADO: ${basename(path)}`))
      .catch(() => { console.error("BACKUP_FALHOU"); process.exitCode = 1; });
  }
}
