// Chaves de API: cifradas com safeStorage (DPAPI no Windows) em userData/secrets.json.
// O renderer nunca recebe o valor da chave — só o estado (salva / variável de ambiente / ausente).
const { app, safeStorage } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const ENV = {
  claude: ['ANTHROPIC_API_KEY'],
  gpt: ['OPENAI_API_KEY'],
  grok: ['XAI_API_KEY'],
  gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
};

const file = () => path.join(app.getPath('userData'), 'secrets.json');

async function readAll() {
  try {
    return JSON.parse(await fs.readFile(file(), 'utf8'));
  } catch {
    return {};
  }
}

async function writeAll(data) {
  const tmp = file() + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(data), 'utf8');
  await fs.rename(tmp, file());
}

async function getKey(provider) {
  const saved = (await readAll())[provider];
  if (saved && safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(saved, 'base64'));
    } catch {
      /* chave corrompida: cai para a variável de ambiente */
    }
  }
  for (const name of ENV[provider] ?? []) if (process.env[name]) return process.env[name];
  return null;
}

async function setKey(provider, value) {
  if (!ENV[provider]) throw new Error(`Provedor desconhecido: ${provider}`);
  const data = await readAll();
  if (!value) delete data[provider];
  else {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Criptografia do sistema indisponível; defina a chave por variável de ambiente.');
    }
    data[provider] = safeStorage.encryptString(value.trim()).toString('base64');
  }
  await writeAll(data);
  return status();
}

async function status() {
  const data = await readAll();
  const out = {};
  for (const [provider, names] of Object.entries(ENV)) {
    out[provider] = data[provider] ? 'saved' : names.some((n) => process.env[n]) ? 'env' : 'missing';
  }
  return out;
}

module.exports = { getKey, setKey, status };
