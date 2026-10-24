/** Recover exported technical/reference files without changing the active checkout. */
import { readFileSync, writeFileSync, mkdirSync, existsSync, realpathSync, rmSync, renameSync, lstatSync } from 'node:fs';
import { resolve, dirname, join, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = 'docs/_arquivo/NAO-CLINICO-20261024.json';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const inside = (root, target) => { const r = relative(root, target); return r === '' || (!isAbsolute(r) && r !== '..' && !r.startsWith('..' + sep)); };

export function restaurarNaoClinico({ raiz = DEFAULT_ROOT, destino, caminhos = [] }) {
  const root = realpathSync(raiz);
  if (typeof destino !== 'string' || !destino.trim()) throw Error('DESTINO_OBRIGATORIO');
  const target = resolve(destino);
  if (inside(root, target)) throw Error('DESTINO_DENTRO_DO_REPOSITORIO');
  if (existsSync(target)) throw Error('DESTINO_JA_EXISTE');
  // Resolve the parent to prevent a junction from redirecting a supposedly external restore.
  const parent = realpathSync(dirname(target));
  const actualTarget = join(parent, relative(dirname(target), target));
  if (inside(root, actualTarget)) throw Error('DESTINO_DENTRO_DO_REPOSITORIO');
  const manifest = JSON.parse(readFileSync(join(root, MANIFEST), 'utf8'));
  if (manifest.schema !== 'ArquivoNaoClinico@1' || !Array.isArray(manifest.arquivos)) throw Error('MANIFESTO_INVALIDO');
  if (!Array.isArray(caminhos) || new Set(caminhos).size !== caminhos.length) throw Error('SELECAO_INVALIDA');
  const wanted = new Set(caminhos);
  const records = caminhos.length ? manifest.arquivos.filter(r => wanted.has(r.caminho)) : manifest.arquivos;
  if (caminhos.length && records.length !== caminhos.length) throw Error('ARQUIVO_NAO_INVENTARIADO');
  const names = new Set();
  // Verify every blob before creating any output. No overwrite, fetch or checkout side effect.
  const verified = records.map(r => {
    if (typeof r.caminho !== 'string' || !r.caminho.startsWith('docs/') || r.caminho.includes('\\')
      || r.caminho.split('/').some(p => !p || p === '.' || p === '..' || p.includes(':')) || names.has(r.caminho)
      || !/^[a-f0-9]{40}$/.test(r.blobGit) || !/^[a-f0-9]{64}$/.test(r.sha256)
      || !Number.isSafeInteger(r.bytes) || r.bytes < 0 || r.bytes > 16_000_000) throw Error('REGISTRO_INVALIDO');
    names.add(r.caminho);
    let bytes;
    try { bytes = execFileSync('git', ['cat-file', 'blob', r.blobGit], { cwd: root, maxBuffer: 16_000_001, stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch { throw Error('BLOB_INDISPONIVEL_USE_HISTORICO_COMPLETO'); }
    if (bytes.length !== r.bytes || sha256(bytes) !== r.sha256) throw Error('ORIGINAL_DIVERGENTE');
    return { path: r.caminho, bytes };
  });
  if (verified.reduce((n, r) => n + r.bytes.length, 0) > 64_000_000) throw Error('CONJUNTO_EXCESSIVO');
  const staging = join(parent, '.restauracao-nao-clinica-' + randomUUID());
  mkdirSync(staging);
  try {
    for (const r of verified) {
      const output = resolve(staging, r.path);
      if (!inside(staging, output)) throw Error('CAMINHO_INVALIDO');
      mkdirSync(dirname(output), { recursive: true });
      writeFileSync(output, r.bytes, { flag: 'wx' });
    }
    if (existsSync(actualTarget)) throw Error('DESTINO_JA_EXISTE');
    renameSync(staging, actualTarget);
  } catch (error) {
    // Only the fresh UUID-owned staging directory may be removed on failure.
    if (inside(parent, staging) && dirname(staging) === parent && !lstatSync(staging).isSymbolicLink()) rmSync(staging, { recursive: true });
    throw error;
  }
  return { destino: actualTarget, arquivos: verified.length, bytes: verified.reduce((n, r) => n + r.bytes.length, 0) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args[0] !== '--destino' || !args[1] || args[1].startsWith('--')) throw Error('USO: node scripts/restaurar-nao-clinico.mjs --destino <pasta-nova-fora-do-repositorio> [caminhos-inventariados...]');
    console.log(JSON.stringify(restaurarNaoClinico({ destino: args[1], caminhos: args.slice(2) })));
  } catch (error) { console.error(error instanceof Error ? error.message : 'RESTAURACAO_RECUSADA'); process.exitCode = 1; }
}
