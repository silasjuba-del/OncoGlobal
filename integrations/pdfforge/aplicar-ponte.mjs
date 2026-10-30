import { readFile, writeFile, mkdir, rename, lstat, realpath } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const origem = dirname(fileURLToPath(import.meta.url));
const sha = b => createHash('sha256').update(b).digest('hex');
export async function aplicarPonte(destino, somenteConferir = false) {
  const raiz = resolve(destino), patch = JSON.parse(await readFile(resolve(origem, 'ponte.patch.json'), 'utf8'));
  const equivalente = p => process.platform === 'win32' ? p.toLowerCase() : p;
  if (equivalente(await realpath(raiz)) !== equivalente(raiz) || (await lstat(raiz)).isSymbolicLink()) throw Error('DESTINO_COM_LINK_RECUSADO');
  const caminho = rel => {
    const p = resolve(raiz, rel), r = relative(raiz, p);
    if (!r || r.startsWith('..') || isAbsolute(r)) throw Error('DESTINO_FORA_DA_RAIZ');
    return p;
  };
  async function conferirCaminho(file) {
    const partes = relative(raiz, file).split(/[\\/]/);
    let atual = raiz;
    for (const parte of partes) {
      atual = resolve(atual, parte);
      try { if ((await lstat(atual)).isSymbolicLink()) throw Error('DESTINO_COM_LINK_RECUSADO'); }
      catch (e) { if (e.code === 'ENOENT') break; throw e; }
    }
  }
  const alteracoes = [];
  for (const a of patch.arquivos) {
    const file = caminho(a.arquivo);
    await conferirCaminho(file);
    const antes = await readFile(file);
    if (sha(antes) === a.sha256Depois) continue;
    if (sha(antes) !== a.sha256Antes) throw Error(`FONTE_DIVERGENTE_PRESERVADA: ${a.arquivo}`);
    let texto = antes.toString('utf8').replace(/\r\n/g, '\n');
    for (const s of a.substituicoes) {
      if (texto.split(s.antes).length !== 2) throw Error('ANCORA_DIVERGENTE');
      texto = texto.replace(s.antes, s.depois);
    }
    if (sha(texto) !== a.sha256Depois) throw Error('PATCH_DIVERGENTE');
    alteracoes.push({ file, texto, antes });
  }
  for (const [fonte, alvo] of Object.entries(patch.novos)) {
    const file = caminho(alvo);
    await conferirCaminho(file);
    const texto = await readFile(resolve(origem, fonte));
    let antes; try { antes = await readFile(file); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    if (antes && sha(antes) !== sha(texto)) throw Error(`ARQUIVO_EXISTENTE_PRESERVADO: ${alvo}`);
    if (!antes) alteracoes.push({ file, texto });
  }
  if (somenteConferir) return alteracoes.length;
  // Todas as fontes foram verificadas antes da primeira escrita. Backups não são sobrescritos.
  for (const a of alteracoes) {
    await conferirCaminho(a.file);
    await mkdir(dirname(a.file), { recursive: true });
    if (a.antes) {
      try { await writeFile(`${a.file}.antes-oncoglobal`, a.antes, { flag: 'wx' }); }
      catch (e) { if (e.code !== 'EEXIST') throw e; }
    }
    await writeFile(`${a.file}.oncoglobal-tmp`, a.texto, { flag: 'wx' });
    await rename(`${a.file}.oncoglobal-tmp`, a.file);
  }
  return alteracoes.length;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw Error('Uso: node aplicar-ponte.mjs <copia-pdfforge> [--check]');
  console.log({ arquivos: await aplicarPonte(process.argv[2], process.argv.includes('--check')), somenteConferir: process.argv.includes('--check') });
}
