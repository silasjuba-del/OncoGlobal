import { readFile, mkdtemp, realpath, readdir, rm } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { PacoteDocumental } from '../../../src/contracts/api/importacaoDocumental.js';
const require = createRequire(import.meta.url);
it('handler IPC exige janela/frame/origem e grava somente pacote local válido', async () => {
  const base = await realpath(tmpdir()), dir = await mkdtemp(join(base, 'SINTETICO-ipc-'));
  if (dirname(dir) !== base) throw Error('TEMP_FORA_RAIZ');
  type Saida = { ok: boolean; caminho?: string; codigo?: string };
  let handler!: (evento: unknown, entrada: unknown) => Promise<Saida>;
  const frame = { url: 'app://pdfforge/index.html' }, webContents = { mainFrame: frame };
  const modulo = { exports: {} };
  const fonte = await readFile(resolve('integrations/pdfforge/oncoglobal-export.cjs'), 'utf8');
  runInNewContext(fonte, { module: modulo, URL, require: (id: string) => {
    if (id === 'electron') return { app: { getPath: () => dir }, ipcMain: { handle: (_nome: string, fn: typeof handler) => { handler = fn; } } };
    if (id === './exportar-pacote.cjs') return require('../../../integrations/pdfforge/exportar-pacote.cjs');
    return require(id);
  } });
  (modulo.exports as { registrar: (janela: () => unknown, dev?: string) => void }).registrar(() => ({ webContents }));
  const entrada = { original: { name: 'SINTETICO.pdf', bytes: new Uint8Array(Buffer.from('%PDF-1.4\nSINTETICO\n%%EOF')) }, autor: 'Autor SINTETICO' };
  try {
    expect(await handler({ sender: webContents, senderFrame: { url: frame.url } }, entrada)).toMatchObject({ ok: false, codigo: 'ORIGEM_NAO_AUTORIZADA' });
    frame.url = 'https://pdfforge.exemplo.invalid/';
    expect(await handler({ sender: webContents, senderFrame: frame }, entrada)).toMatchObject({ ok: false, codigo: 'ORIGEM_NAO_AUTORIZADA' });
    frame.url = 'app://pdfforge/index.html';
    const r = await handler({ sender: webContents, senderFrame: frame }, entrada);
    expect(r.ok).toBe(true);
    expect(dirname(r.caminho!)).toBe(join(dir, 'oncoglobal-export'));
    const p = PacoteDocumental.parse(JSON.parse(await readFile(r.caminho!, 'utf8')));
    expect(p.autor).toBe('Autor SINTETICO');
    expect(Buffer.from(p.original.bytesBase64, 'base64')).toEqual(Buffer.from(entrada.original.bytes));
    expect(await readdir(join(dir, 'oncoglobal-export'))).toHaveLength(1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
