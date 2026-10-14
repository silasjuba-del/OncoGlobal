import { it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { criarBiblioteca, sha256Biblioteca } from '../../src/kernel/corpus/biblioteca.js';
it('hash correto do conteúdo trocado não contorna identidade/schema do manifesto', () => {
  const b = criarBiblioteca(new DatabaseSync(':memory:'), { autorizarCuradoria: () => null, emitir: () => { throw new Error('não emitir'); } });
  const bytes = JSON.stringify({ schema: 'ItemBiblioteca@1', id: 'troca', versao: '1.0.0', pilar: 1, tipo: 'REFERENCIA', titulo: 'Fixture', texto: 'Sintético',
    aplicabilidade: { tumor: [], histologia: [], estadio: [], biomarcador: [], linha: [] },
    proveniencia: { fonte: 'https://example.org', trecho: 'Sintético', publicadoEm: '2026-01-01', recuperadoEm: '2026-01-01T00:00:00Z', licenca: 'Fixture' }, dependencias: [] });
  const manifesto = { schema: 'PacoteBiblioteca@1', id: 'pacote', versao: '1.0.0', origem: 'GENSPARK_MANUAL', classificacao: 'PUBLIC', criadoEm: '2026-01-01T00:00:00Z',
    itens: [{ id: 'original', versao: '1.0.0', arquivo: 'item.json', sha256: sha256Biblioteca(bytes) }] };
  expect(() => b.importarPacote(manifesto, () => bytes)).toThrow('IDENTIDADE_DIVERGENTE');
  expect(b.ativa()).toBeNull();
});
it('hash recalculado não transforma payload paciente em biblioteca pública', () => {
  const b = criarBiblioteca(new DatabaseSync(':memory:'), { autorizarCuradoria: () => null, emitir: () => {} });
  const bytes = JSON.stringify({ patientId: 'ataque', dose: 100 });
  expect(() => b.importarPacote({ schema: 'PacoteBiblioteca@1', id: 'pacote', versao: '1.0.0', origem: 'GENSPARK_MANUAL', classificacao: 'PUBLIC', criadoEm: '2026-01-01T00:00:00Z',
    itens: [{ id: 'item', versao: '1.0.0', arquivo: 'item.json', sha256: sha256Biblioteca(bytes) }] }, () => bytes)).toThrow();
});
