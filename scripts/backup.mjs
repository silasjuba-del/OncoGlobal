import { backup, DatabaseSync } from "node:sqlite";
import { createCipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { readFileSync, realpathSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { basename, isAbsolute, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const hash = (data) => createHash("sha256").update(data).digest("hex");
const networkPath = (path) => /^(?:\\\\|\/\/|[a-z]+:\/\/)/i.test(path);
const STORE_NAMES = Object.freeze({ ledger: "ledger.sqlite", settings: "config-w10.sqlite", workspace: "workspace.sqlite" });
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
function schemaMetadata(database) {
  const rows = database.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name, tbl_name").all();
  return {
    userVersion: Number(database.prepare("PRAGMA user_version").get()?.user_version ?? 0),
    schemaSha256: hash(Buffer.from(JSON.stringify(rows))),
  };
}
function refsLedger(db, files) {
  let rows = [];
  try { rows = db.prepare("SELECT rawRef FROM draft_envelope").all(); }
  catch { /* a synthetic/minimal ledger may not define drafts */ }
  return [...new Set([...rows.map((row) => String(row.rawRef)), ...files])].sort();
}
function validateStores(stores) {
  if (!stores || typeof stores !== "object" || Array.isArray(stores)
    || Object.keys(stores).sort().join(",") !== "ledger,settings,workspace") throw new Error("STORES_INCOMPLETOS");
  for (const [key, path] of Object.entries(stores)) {
    local(path);
    if (basename(path).toLowerCase() !== STORE_NAMES[key].toLowerCase()) throw new Error("STORE_FORA_DO_ESCOPO");
    if (!statSync(path).isFile()) throw new Error("STORE_INVALIDO");
  }
}

/** SQLite backup API includes committed pages and uncheckpointed WAL for each named store. */
export async function criarBackup({ dbPath, stores, filesRoot, files = [], destino, senha, nome }) {
  local(filesRoot); local(destino);
  if (!senha || senha.length < 12) throw new Error("SENHA_INSUFICIENTE");
  if (!statSync(destino).isDirectory() || !statSync(filesRoot).isDirectory()) throw new Error("DIRETORIO_INVALIDO");
  if (!/^[a-zA-Z0-9_-]+$/.test(nome)) throw new Error("NOME_INVALIDO");
  const v2 = stores !== undefined;
  if (v2) validateStores(stores);
  else { local(dbPath); if (!statSync(dbPath).isFile()) throw new Error("STORE_INVALIDO"); }
  const output = join(destino, `${nome}.ogbak`);
  const capturedAt = new Date().toISOString();
  const sourceStores = v2 ? stores : { ledger: dbPath };
  const tempPaths = new Map(Object.keys(sourceStores).map((key) => [key, join(destino, `${nome}-${key}-${randomBytes(8).toString("hex")}.sqlite`)]));
  let written = false;
  try {
    const metadata = [];
    let ledgerRefs = [];
    for (const [key, sourcePath] of Object.entries(sourceStores)) {
      const db = new DatabaseSync(sourcePath);
      try {
        if (key === "ledger") ledgerRefs = refsLedger(db, files);
        const temp = tempPaths.get(key);
        if (!temp) throw new Error("BACKUP_TEMPORARIO_AUSENTE");
        const schema = schemaMetadata(db);
        await backup(db, temp);
        const data = readFileSync(temp);
        metadata.push({ name: STORE_NAMES[key] ?? basename(sourcePath), ...schema, sha256: hash(data), base64: data.toString("base64") });
      } finally { db.close(); }
    }
    const entries = ledgerRefs.map((ref) => {
      const source = inside(filesRoot, ref);
      if (realpathSync(source) !== source || !statSync(source).isFile()) throw new Error("REFERENCIA_INVALIDA");
      const data = readFileSync(source);
      return { ref, sha256: hash(data), base64: data.toString("base64") };
    });
    const plaintext = Buffer.from(JSON.stringify(v2
      ? { format: "oncoglobal-local-backup-v2", manifestVersion: 2, capturedAt, completedAt: new Date().toISOString(), stores: metadata, files: entries }
      : { format: "oncoglobal-local-backup-v1", database: metadata[0] && { sha256: metadata[0].sha256, base64: metadata[0].base64 }, files: entries }));
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
    for (const temp of tempPaths.values()) { try { unlinkSync(temp); } catch { /* temp may not exist */ } }
    if (!written) { /* never delete a pre-existing output */ }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , ledgerPath, settingsPath, workspacePath, filesRoot, destino, nome] = process.argv;
  const senha = process.env.ONCOGLOBAL_BACKUP_PASSWORD;
  delete process.env.ONCOGLOBAL_BACKUP_PASSWORD;
  if (!senha) { console.error("BACKUP_PASSWORD_REQUIRED"); process.exitCode = 1; }
  else {
    try {
      const stores = { ledger: ledgerPath, settings: settingsPath, workspace: workspacePath };
      criarBackup({ stores, filesRoot, destino, nome, senha, files: [] })
        .then((path) => console.log(`BACKUP_CRIADO: ${basename(path)}`))
        .catch(() => { console.error("BACKUP_FALHOU"); process.exitCode = 1; });
    } catch { console.error("BACKUP_FALHOU"); process.exitCode = 1; }
  }
}
