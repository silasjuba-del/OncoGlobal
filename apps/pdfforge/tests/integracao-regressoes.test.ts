import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import { parse } from '../src/components/Markdown';
import { docKeyOf } from '../src/ai/library';
import { zipOutputs } from '../src/engine/archive';
import { createCaptureLifetime } from '../src/ai/captureLifetime';

describe('integracao sem perda ou atribuicao cruzada', () => {
  it('consome todas as formas parciais de uma tabela em streaming', () => {
    const text = '| A | B |\n| --- | --- |\n| C | D |';
    for (let i = 1; i <= text.length; i++) expect(parse(text.slice(0, i)).length).toBeGreaterThan(0);
    expect(parse('| A | B')[0]).toEqual({ type: 'para', lines: ['| A | B'] });
  });
  it('bytes distintos no mesmo caminho/nome/tamanho jamais herdam a chave de notas', async () => {
    const a = { name: 'laudo.pdf', path: 'C:/scanner/laudo.pdf', bytes: new TextEncoder().encode('SINTETICO A') };
    const b = { ...a, bytes: new TextEncoder().encode('SINTETICO B') };
    expect(await docKeyOf(a)).toBe('sha256:' + createHash('sha256').update(a.bytes).digest('hex'));
    expect(await docKeyOf(a)).not.toBe(await docKeyOf(b));
    expect(await docKeyOf({ ...a, path: 'outro.pdf' })).toBe(await docKeyOf(a));
    expect(await docKeyOf(a)).not.toBe(a.path);
  });
  it('ZIP conserva todos os bytes com nomes repetidos e sufixos preexistentes', async () => {
    const outputs = ['report.pdf', 'report.pdf', 'report (1).pdf', 'REPORT.PDF'].map((name, i) => ({ name, bytes: new Uint8Array([i]) }));
    const zip = await JSZip.loadAsync(await zipOutputs(outputs));
    const entries = Object.values(zip.files).filter(f => !f.dir);
    expect(entries).toHaveLength(4);
    expect((await Promise.all(entries.map(f => f.async('uint8array')))).map(b => b[0]).sort()).toEqual([0, 1, 2, 3]);
  });
  it('fechar a aba encerra gravacao, faixas e captura que chega depois', () => {
    const stopTrack = vi.fn(), stopRecorder = vi.fn(), late = vi.fn();
    const resources = createCaptureLifetime();
    resources.replaceStream({ getTracks: () => [{ stop: stopTrack }] as unknown as MediaStreamTrack[] });
    resources.setStopRecording(stopRecorder); resources.dispose();
    expect(stopTrack).toHaveBeenCalledOnce(); expect(stopRecorder).toHaveBeenCalledOnce();
    expect(resources.replaceStream({ getTracks: () => [{ stop: late }] as unknown as MediaStreamTrack[] })).toBe(false);
    expect(late).toHaveBeenCalledOnce(); expect(resources.isActive()).toBe(false);
  });
});
