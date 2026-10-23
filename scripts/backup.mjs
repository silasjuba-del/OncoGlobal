import { backup, DatabaseSync } from "node:sqlite";
import { createCipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { readFileSync, realpathSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { basename, isAbsolute, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const hash = (data) => createHash("sha256").update(data).digest("hex");
const networkPath = (path) => /^(?:\\\\|\/\/|[a-z]+:\/\/)/i.test(path);
const STORE_NAMES = Object.freeze({ ledger: "ledger.sqlite", settings: "config-w10.sqlite", workspace: "workspace.sqlite" });
const WINDOWS_DEVICE = /^(?:CON|PRN|AUX|NUL|CONIN\$|CONOUT\$|CLOCK\$|COM[1-9¹²³]|LPT[1-9¹²³])$/i;
function local(path) {
  if (typeof path !== "string" || !isAbsolute(path) || networkPath(path))
    throw new Error("CAMINHO_LOCAL_ABSOLUTO_OBRIGATORIO");
}
function inside(root, rel) {
  if (typeof rel !== "string" || !rel || rel.length > 240 || isAbsolute(rel) || networkPath(rel))
    throw new Error("REFERENCIA_FORA_DA_RAIZ");
  const components = rel.split(/[\\/]/);
  if (components.some((component) => {
    if (!component || component === "." || component === ".." || component.length > 255
      || /[\u0000-\u001f<>:"|?*]/.test(component) || /[. ]$/.test(component)) return true;
    const deviceStem = (component.split(".", 1)[0] ?? "").replace(/[ .]+$/g, "");
    return WINDOWS_DEVICE.test(deviceStem);
  })) throw new Error("REFERENCIA_FORA_DA_RAIZ");
  const full = resolve(root, ...components);
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
function storeDigest(database) {
  const schema = schemaMetadata(database);
  const tables = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  const dump = tables.map(({ name }) => {
    const escaped = String(name).replaceAll('"', '""');
    let rows;
    try { rows = database.prepare(`SELECT * FROM "${escaped}" ORDER BY rowid`).all(); }
    catch { rows = database.prepare(`SELECT * FROM "${escaped}"`).all(); }
    return { name, rows };
  });
  return {
    ...schema,
    contentSha256: hash(Buffer.from(JSON.stringify({ schema, dump }))),
  };
}
function parsePayload(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return null;
  try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null; }
  catch { return null; }
}
/* Referências internas conhecidas: o conteúdo já vive no snapshot SQLite do
 * ledger (payload do draft), portanto não viram entrada de arquivo. Namespace
 * com dois-pontos não basta: kind/campo do payload precisa corresponder. */
/* Os dois produtores em extracaoLlm.ts derivam de EXTRACAO_RASCUNHO.
 * Exigir a origem correspondente também recusa autorreferência/ciclos sem original. */
function originalPdfIntegro(payload) {
  const original = payload?.original;
  if (original?.tipo !== "PDF" || typeof original.bytesBase64 !== "string"
    || typeof original.contentHash !== "string") return false;
  const bytes = Buffer.from(original.bytesBase64, "base64");
  return bytes.length > 0 && bytes.toString("base64") === original.bytesBase64
    && hash(bytes) === original.contentHash;
}
const derivadoExtracao = (p, c) => ["LLM_EXTRACAO_RASCUNHO", "D66_TRANSCRICAO_RASCUNHO"].includes(p?.kind)
  && typeof p.sourceDraftId === "string" && c.porId.get(p.sourceDraftId)?.rawRef === c.ref
  && c.porId.get(p.sourceDraftId)?.payload?.kind === "EXTRACAO_RASCUNHO"
  && (p.kind !== "D66_TRANSCRICAO_RASCUNHO" || originalPdfIntegro(c.porId.get(p.sourceDraftId)?.payload));
const NAMESPACE_INTERNO = {
  "upload-local": (p, c) => p?.kind === "EXTRACAO_RASCUNHO" || derivadoExtracao(p, c),
  "importacao-local": (p, c) => p?.kind === "EXTRACAO_RASCUNHO"
    || p?.kind === "LLM_EXTRACAO_RASCUNHO" && derivadoExtracao(p, c),
  "retrato-local": (p) => p?.kind === "SINTESE_RASCUNHO",
  "registro-medico": (p, c) => p?.kind === "ESTADO_DOENCA_RASCUNHO" && c.suffix === c.draftId,
  "manual": (p) => p?.campo === "medicamentos",
  "triagem-local": (p) => p?.kind === "SALAO_TRIAGEM_RASCUNHO",
  "canal-link": (p) => p?.kind === "VinculoContato",
  "review-link": (p) => p?.kind === "PATIENT_LINK_REVIEW",
  /* rotas.ts grava revisao-local:<draftId da ORIGEM> no draft derivado
   * (evolucao-extracao-*): exige origem declarada, existente e coincidente. */
  "revisao-local": (p, c) => p?.kind === "EVOLUCAO_RASCUNHO"
    && p.origem?.draftId === c.suffix && c.draftIds.has(c.suffix),
};
const LITERAL_INTERNO = {
  "consulta-flash-local": (p) => !!p && ((typeof p.kind === "string" && p.kind.startsWith("FLASH_")) || typeof p.documentId === "string"),
  "referencia-local": (p) => !!p,
  "vinculo-operacional-local": (p) => typeof p?.contatoId === "string",
  "proposta-prescricao-local": (p) => p?.kind === "PRESCRICAO_RASCUNHO",
  "proposta-local": (p) => p?.schema === "PrescricaoProposta@1",
};
function arquivoFisicoExiste(filesRoot, ref) {
  try { return statSync(inside(filesRoot, ref)).isFile(); } catch { return false; }
}
function referenciaEntreDrafts(row, payload, porId) {
  // dutos.ts guarda o conteúdo completo em {contexto, valor}, sem arquivo.
  // Um ID arbitrário apontando a si próprio não constitui esse produtor.
  if (row.rawRef === row.draftId) {
    const contexto = payload?.contexto;
    return /^duto-[a-f0-9]{64}$/.test(row.draftId) && row.sourceId === row.draftId
      && typeof contexto?.patientId === "string" && contexto.patientId === row.patientId
      && typeof contexto.encounterId === "string" && contexto.encounterId.length > 0
      && (contexto.tumorLotId === null || typeof contexto.tumorLotId === "string")
      && typeof contexto.atorId === "string" && contexto.atorId.length > 0
      && typeof contexto.em === "string"
      && !!payload.valor && typeof payload.valor === "object" && !Array.isArray(payload.valor);
  }
  const destino = porId.get(row.rawRef)?.payload;
  // oncoassistPropostas.ts: referência declarada na auditoria ou na divergência.
  if (payload?.kind === "JEV_CLASSIFICACAO_RASCUNHO")
    return payload.auditoria?.draftId === row.rawRef && payload.auditoria?.propostaId === row.draftId
      && destino?.kind === "EXTRACAO_RASCUNHO";
  if (payload?.kind === "JEV_DIVERGENCIA_RASCUNHO")
    return payload.propostaId === row.rawRef && destino?.kind === "JEV_CLASSIFICACAO_RASCUNHO"
      && destino.auditoria?.propostaId === row.rawRef;
  return false;
}
export function refsLedger(db, files, filesRoot) {
  let rows = [];
  let comMetadados = true;
  try { rows = db.prepare("SELECT draftId, patientId, sourceId, rawRef, payload FROM draft_envelope").all(); }
  catch {
    comMetadados = false;
    try { rows = db.prepare("SELECT rawRef FROM draft_envelope").all(); }
    catch { /* a synthetic/minimal ledger may not define drafts */ }
  }
  const draftIds = new Set(rows.map((row) => row.draftId).filter((id) => typeof id === "string"));
  const porId = new Map(rows.filter((row) => typeof row.draftId === "string")
    .map((row) => [row.draftId, { rawRef: row.rawRef, payload: parsePayload(row.payload) }]));
  const fisicas = new Set(files);
  for (const row of rows) {
    const ref = row.rawRef;
    if (typeof ref !== "string" || !ref) throw new Error("REFERENCIA_FORA_DA_RAIZ");
    if (!comMetadados) { fisicas.add(ref); continue; }
    if (ref === row.draftId || draftIds.has(ref)) {
      // Referência entre drafts cujo nome também é um arquivo físico na raiz
      // é ambígua: recusar, nunca omitir os bytes em silêncio.
      if (filesRoot && arquivoFisicoExiste(filesRoot, ref)) throw new Error("REFERENCIA_AMBIGUA");
      if (!referenciaEntreDrafts(row, parsePayload(row.payload), porId)) throw new Error("REFERENCIA_AMBIGUA");
      continue;
    }
    if (Object.hasOwn(LITERAL_INTERNO, ref)) {
      if (filesRoot && arquivoFisicoExiste(filesRoot, ref)) throw new Error("REFERENCIA_AMBIGUA");
      if (!LITERAL_INTERNO[ref](parsePayload(row.payload))) throw new Error("REFERENCIA_AMBIGUA");
      continue;
    }
    const colon = ref.indexOf(":");
    if (colon > 0) {
      const namespace = ref.slice(0, colon), suffix = ref.slice(colon + 1);
      if (!Object.hasOwn(NAMESPACE_INTERNO, namespace)) throw new Error("REFERENCIA_DESCONHECIDA");
      if (!suffix || !NAMESPACE_INTERNO[namespace](parsePayload(row.payload),
        { suffix, draftId: row.draftId, ref, draftIds, porId }))
        throw new Error("REFERENCIA_AMBIGUA");
      continue;
    }
    if (colon === 0) throw new Error("REFERENCIA_DESCONHECIDA");
    fisicas.add(ref);
  }
  return [...fisicas].sort();
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
function readAttachment(filesRoot, ref) {
  const source = inside(filesRoot, ref);
  let real;
  try { real = realpathSync(source); } catch { throw new Error("REFERENCIA_AUSENTE"); }
  if (real !== source || !statSync(source).isFile()) throw new Error("REFERENCIA_INVALIDA");
  const data = readFileSync(source);
  return { ref, sha256: hash(data), base64: data.toString("base64") };
}

/** SQLite backup API includes committed pages and uncheckpointed WAL for each named store,
 *  and verifies cross-store + cross-file consistency before/during/after capture. */
export async function criarBackup({ dbPath, stores, filesRoot, files = [], destino, senha, nome, aoCapturarStore }) {
  local(filesRoot); local(destino);
  if (!senha || senha.length < 12) throw new Error("SENHA_INSUFICIENTE");
  if (!statSync(destino).isDirectory() || !statSync(filesRoot).isDirectory()) throw new Error("DIRETORIO_INVALIDO");
  if (!/^[a-zA-Z0-9_-]+$/.test(nome)) throw new Error("NOME_INVALIDO");
  if (!Array.isArray(files) || files.some((ref) => typeof ref !== "string")) throw new Error("REFERENCIAS_INVALIDAS");
  const v2 = stores !== undefined;
  if (v2) validateStores(stores);
  else { local(dbPath); if (!statSync(dbPath).isFile()) throw new Error("STORE_INVALIDO"); }
  const output = join(destino, `${nome}.ogbak`);
  const capturedAt = new Date().toISOString();
  const sourceStores = v2 ? stores : { ledger: dbPath };
  const tempPaths = new Map(Object.keys(sourceStores).map((key) => [key, join(destino, `${nome}-${key}-${randomBytes(8).toString("hex")}.sqlite`)]));
  let written = false;
  try {
    const preDigests = new Map();
    let ledgerRefs = [];
    for (const [key, sourcePath] of Object.entries(sourceStores)) {
      const db = new DatabaseSync(sourcePath);
      try {
        if (key === "ledger") ledgerRefs = refsLedger(db, files, filesRoot);
        preDigests.set(key, storeDigest(db));
      } finally { db.close(); }
    }
    const entries = ledgerRefs.map((ref) => readAttachment(filesRoot, ref));
    const metadata = [];
    for (const [key, sourcePath] of Object.entries(sourceStores)) {
      const db = new DatabaseSync(sourcePath);
      try {
        const temp = tempPaths.get(key);
        if (!temp) throw new Error("BACKUP_TEMPORARIO_AUSENTE");
        await backup(db, temp);
        if (typeof aoCapturarStore === "function") await aoCapturarStore(key);
        const tempDb = new DatabaseSync(temp);
        try {
          const snapDigest = storeDigest(tempDb);
          const expectedDigest = preDigests.get(key);
          if (!expectedDigest || snapDigest.contentSha256 !== expectedDigest.contentSha256
            || snapDigest.schemaSha256 !== expectedDigest.schemaSha256
            || snapDigest.userVersion !== expectedDigest.userVersion)
            throw new Error("CONSISTENCIA_BACKUP_VIOLADA");
          if (key === "ledger") {
            const snapRefs = refsLedger(tempDb, files, filesRoot);
            if (snapRefs.join("\u0000") !== ledgerRefs.join("\u0000"))
              throw new Error("CONSISTENCIA_BACKUP_VIOLADA");
          }
        } finally { tempDb.close(); }
        const data = readFileSync(temp);
        const expected = preDigests.get(key);
        metadata.push({
          name: STORE_NAMES[key] ?? basename(sourcePath),
          userVersion: expected.userVersion,
          schemaSha256: expected.schemaSha256,
          sha256: hash(data),
          base64: data.toString("base64"),
        });
      } finally { db.close(); }
    }
    // Re-conferência pós-captura de todos os stores e anexos físicos para comprovar corte consistente.
    for (const [key, sourcePath] of Object.entries(sourceStores)) {
      const db = new DatabaseSync(sourcePath);
      try {
        const postDigest = storeDigest(db);
        const expectedDigest = preDigests.get(key);
        if (!expectedDigest || postDigest.contentSha256 !== expectedDigest.contentSha256
          || postDigest.schemaSha256 !== expectedDigest.schemaSha256
          || postDigest.userVersion !== expectedDigest.userVersion)
          throw new Error("CONSISTENCIA_BACKUP_VIOLADA");
        if (key === "ledger") {
          let postRefs;
          try { postRefs = refsLedger(db, files, filesRoot); }
          catch { throw new Error("CONSISTENCIA_BACKUP_VIOLADA"); }
          if (postRefs.join("\u0000") !== ledgerRefs.join("\u0000"))
            throw new Error("CONSISTENCIA_BACKUP_VIOLADA");
        }
      } finally { db.close(); }
    }
    for (const entry of entries) {
      let postEntry;
      try { postEntry = readAttachment(filesRoot, entry.ref); }
      catch { throw new Error("CONSISTENCIA_BACKUP_VIOLADA"); }
      if (postEntry.sha256 !== entry.sha256)
        throw new Error("CONSISTENCIA_BACKUP_VIOLADA");
    }
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
