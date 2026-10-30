import { createRequestLifetime } from '../src/ai/requestLifetime';
import { createSaveTracker } from '../src/ai/saveTracker';
import { shareWhatsApp } from '../src/ai/bridge';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { answerWithSources, appendSourceContext } from '../src/ai/answerSources';
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

it('exportacao inclui o snapshot literal das referencias da resposta', () => {
  const snapshot = '[1] Documento SINTETICO A, pagina 2: trecho original';
  const message = { display: 'Resposta baseada em [1].', sourceSnapshot: snapshot };
  expect(answerWithSources(message)).toContain(snapshot);
  expect(answerWithSources(message)).toContain(message.display);
});
it('desmontagem encerra o gravador com estado inativo antes do callback, sem transcrever', () => {
  const resources = createCaptureLifetime(), transcribe = vi.fn(), stop = vi.fn(() => { if(resources.isActive()) transcribe(); });
  resources.setStopRecording(stop); resources.dispose();
  expect(stop).toHaveBeenCalledOnce(); expect(transcribe).not.toHaveBeenCalled();
});

it('continuacao sem RAG conserva fontes e segunda busca usa numeros distintos', () => {
  const a = { chunk: { id: 'a', docId: 'doc-a', text: 'FONTE SINTETICA A', page: 1 }, score: 1 };
  const b = { chunk: { id: 'b', docId: 'doc-b', text: 'FONTE SINTETICA B', page: 2 }, score: 1 };
  const first = appendSourceContext([], [a], id => id);
  const followup = appendSourceContext(first.entries, [], id => id);
  expect(followup.snapshot).toBe(first.snapshot);
  expect(answerWithSources({ display: 'Resumo [1]', sourceSnapshot: followup.snapshot })).toContain('FONTE SINTETICA A');
  const second = appendSourceContext(followup.entries, [b], id => id);
  expect(second.current).toContain('[2] doc-b');
  expect(second.snapshot).toContain('[1] doc-a');
  expect(second.snapshot).toContain('FONTE SINTETICA A');
  expect(second.snapshot).toContain('FONTE SINTETICA B');
  a.chunk.text = 'ALTERADO APOS RESPOSTA';
  expect(second.snapshot).not.toContain('ALTERADO');
});

it('fecha todas as chamadas paralelas e impede resposta tardia de gravar anotacao', async () => {
  const resolvers: ((result: { text: string; stopReason: null; model: string }) => void)[] = [];
  const abort = vi.fn(), delta = vi.fn(), persistir = vi.fn();
  const lifetime = createRequestLifetime((_request, onDelta) => {
    onDelta('parcial');
    return { abort, done: new Promise(resolve => resolvers.push(resolve)) };
  });
  const request = { provider: 'claude' as const, model: 'SINTETICO', messages: [] };
  const tasks = [lifetime.start(request, delta), lifetime.start(request, delta)];
  const outcomes = tasks.map(t => t.done.then(persistir));
  const settled = Promise.allSettled(outcomes);
  lifetime.dispose();
  resolvers.forEach(resolve => resolve({ text: 'tardio', stopReason: null, model: 'SINTETICO' }));
  expect((await settled).every(r => r.status === 'rejected')).toBe(true);
  expect(abort).toHaveBeenCalledTimes(2); expect(persistir).not.toHaveBeenCalled();
  expect(() => lifetime.start(request, delta)).toThrow();
});
it('falha e gravacao pendente permanecem visiveis ate persistencia confirmada', async () => {
  let fail!: (error: Error) => void, ok!: () => void;
  const save = vi.fn().mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { fail = reject; }))
    .mockImplementationOnce(() => new Promise<void>(resolve => { ok = resolve; }));
  const tracker = createSaveTracker(save);
  const first = tracker.write({ nota: 'SINTETICA' });
  expect(tracker.getSnapshot().pending).toBe(1);
  fail(Error('DISCO_INDISPONIVEL')); await expect(first).rejects.toThrow('DISCO_INDISPONIVEL');
  expect(tracker.getSnapshot()).toEqual({ pending: 0, error: 'DISCO_INDISPONIVEL' });
  const retry = tracker.write({ nota: 'SINTETICA' });
  expect(tracker.getSnapshot().pending).toBe(1); ok(); await retry;
  expect(tracker.getSnapshot()).toEqual({ pending: 0, error: null });
});
it('biblioteca nativa serializa snapshots e preserva arquivo invalido para recuperacao', async () => {
  const require = createRequire(import.meta.url);
  const { createJsonStore } = require('../electron/services/json-store.cjs');
  const dir = await mkdtemp(join(tmpdir(), 'pdfforge-integracao-'));
  try {
    const file = join(dir, 'biblioteca.json'), store = createJsonStore(file);
    const writes = Array.from({ length: 20 }, (_, i) => store.write({ numero: i, nota: 'SINTETICA' }));
    expect(store.pending()).toBe(20); await Promise.all(writes); await store.idle();
    expect(await store.read()).toEqual({ numero: 19, nota: 'SINTETICA' });
    expect(await readdir(dir)).toEqual(['biblioteca.json']);
    await writeFile(file, 'CONTEUDO_INVALIDO_PRESERVAR');
    await expect(store.read()).rejects.toThrow();
    expect(await readFile(file, 'utf8')).toBe('CONTEUDO_INVALIDO_PRESERVAR');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
it('WhatsApp recusa texto longo antes de acessar qualquer integracao', async () => {
  await expect(shareWhatsApp('S'.repeat(3501))).rejects.toThrow('arquivo completo');
});
