import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { restaurarNaoClinico } from '../../scripts/restaurar-nao-clinico.mjs';

const bases: string[] = [];
afterEach(() => {
  for (const base of bases.splice(0)) {
    const resolved = resolve(base);
    if (!resolved.startsWith(resolve(tmpdir()) + sep) || !resolved.split(sep).at(-1)?.startsWith('nao-clinico-test-')) throw Error('TEMP_INESPERADO');
    rmSync(resolved, { recursive: true, force: true });
  }
});
function fixture() {
  const base = mkdtempSync(join(tmpdir(), 'nao-clinico-test-')); bases.push(base);
  const root = join(base, 'repo'); mkdirSync(root);
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  const bytes = Buffer.from([0, 1, 13, 10, 128, 255]);
  const blob = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: root, input: bytes }).toString().trim();
  const record = { caminho: 'docs/antigo/imagem.png', bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'), blobGit: blob };
  mkdirSync(join(root, 'docs/_arquivo'), { recursive: true });
  const manifest = join(root, 'docs/_arquivo/NAO-CLINICO-20261024.json');
  const save = (records = [record]) => writeFileSync(manifest, JSON.stringify({ schema: 'ArquivoNaoClinico@1', arquivos: records }));
  save();
  return { root, bytes, record, save, target: join(base, 'recuperado') };
}
it('recupera os bytes exatos fora do checkout e nunca sobrescreve um destino existente', () => {
  const f = fixture();
  expect(restaurarNaoClinico({ raiz: f.root, destino: f.target })).toMatchObject({ arquivos: 1, bytes: f.bytes.length });
  expect(readFileSync(join(f.target, f.record.caminho))).toEqual(f.bytes);
  expect(existsSync(join(f.root, f.record.caminho))).toBe(false);
  expect(() => restaurarNaoClinico({ raiz: f.root, destino: f.target })).toThrow('DESTINO_JA_EXISTE');
});
it('recusa adulteração do hash antes de criar qualquer saída', () => {
  const f = fixture(); f.save([{ ...f.record, sha256: '0'.repeat(64) }]);
  expect(() => restaurarNaoClinico({ raiz: f.root, destino: f.target })).toThrow('ORIGINAL_DIVERGENTE');
  expect(existsSync(f.target)).toBe(false);
});
it('recusa fuga de caminho e restauração dentro do checkout', () => {
  const f = fixture();
  expect(() => restaurarNaoClinico({ raiz: f.root, destino: join(f.root, 'saida') })).toThrow('DESTINO_DENTRO_DO_REPOSITORIO');
  f.save([{ ...f.record, caminho: 'docs/../../escape.png' }]);
  expect(() => restaurarNaoClinico({ raiz: f.root, destino: f.target })).toThrow('REGISTRO_INVALIDO');
  expect(existsSync(f.target)).toBe(false);
});
it('recusa seleção desconhecida e explicita blob ausente sem fetch ou saída parcial', () => {
  const f = fixture();
  expect(() => restaurarNaoClinico({ raiz: f.root, destino: f.target, caminhos: ['docs/desconhecido'] })).toThrow('ARQUIVO_NAO_INVENTARIADO');
  f.save([{ ...f.record, blobGit: '0'.repeat(40) }]);
  expect(() => restaurarNaoClinico({ raiz: f.root, destino: f.target })).toThrow('BLOB_INDISPONIVEL_USE_HISTORICO_COMPLETO');
  expect(existsSync(f.target)).toBe(false);
});
