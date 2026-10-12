import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { criarBiblioteca, sha256Biblioteca, type AtivacaoBiblioteca } from '../../../src/kernel/corpus/biblioteca.js';
function ambiente() {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE estimulos (tipo TEXT, versao TEXT)');
  let autorizado = true; let falhar = false;
  const biblioteca = criarBiblioteca(db, { autorizarCuradoria: () => autorizado ? { atorId: 'sessao-medico' } : null,
    emitir: (tx, e: AtivacaoBiblioteca) => {
      tx.prepare('INSERT INTO estimulos VALUES(?,?)').run(e.tipo, e.biblioteca.versao);
      if (falhar) throw new Error('FALHA_EMISSOR');
    } });
  return { db, biblioteca, bloquear: () => { autorizado = false; }, falhar: () => { falhar = true; } };
}
function pacote(versao = '1.0.0', extra = {}) {
  const item = { schema: 'ItemBiblioteca@1', id: 'item-a', versao, pilar: 6, tipo: 'REGRA', titulo: 'Fixture sintética sem regra médica',
    texto: 'Referência sintética para testar o loader.', aplicabilidade: { tumor: ['sintetico'], histologia: [], estadio: [], biomarcador: [], linha: [] },
    proveniencia: { fonte: 'https://example.org/fixture', trecho: 'Referência sintética', publicadoEm: '2026-01-01', recuperadoEm: '2026-01-01T00:00:00Z', licenca: 'Fixture sintética' }, dependencias: [], ...extra };
  const bytes = JSON.stringify(item);
  const manifesto = { schema: 'PacoteBiblioteca@1', id: 'teste', versao, origem: 'GENSPARK_MANUAL', classificacao: 'PUBLIC', criadoEm: '2026-01-01T00:00:00Z', itens: [{ id: 'item-a', versao, arquivo: 'item-a.json', sha256: sha256Biblioteca(bytes) }] };
  return { manifesto, ler: () => bytes, bytes };
}
describe('S3 biblioteca offline manual', () => {
  it('importação nunca aprova; curadoria item a item distingue consulta e alerta', () => {
    const { biblioteca: b } = ambiente(); const p = pacote(); const id = b.importarPacote(p.manifesto, p.ler);
    expect(b.estado(id, 'item-a')).toBe('RASCUNHO'); expect(() => b.ativar(id)).toThrow('SEM_ITEM_APROVADO');
    b.revisarItem(id, 'item-a', 'CONSULTAVEL'); b.ativar(id);
    expect(b.consultar({ tumor: 'sintetico' })).toHaveLength(1);
    expect(b.consultar({ tumor: 'sintetico' }, 'ALERTA')).toEqual([]);
    expect(b.consultar({})).toEqual([]); expect(b.consultar({ tumor: 'outro' })).toEqual([]);
    b.revisarItem(id, 'item-a', 'ALERTA'); expect(b.consultar({ tumor: 'sintetico' }, 'ALERTA')).toHaveLength(1);
    b.revisarItem(id, 'item-a', 'OBSOLETO'); expect(b.consultar({ tumor: 'sintetico' })).toEqual([]);
  });
  it('rollback restaura última versão válida sem rede e emissão é atômica', () => {
    const a = ambiente(); const b = a.biblioteca;
    for (const v of ['1.0.0','2.0.0']) { const p = pacote(v); const id = b.importarPacote(p.manifesto, p.ler); b.revisarItem(id, 'item-a', 'CONSULTAVEL'); b.ativar(id); }
    b.voltarAnterior(); expect(b.ativa()).toBe('teste@1.0.0');
    a.falhar(); expect(() => b.ativar('teste@2.0.0')).toThrow('FALHA_EMISSOR');
    expect(b.ativa()).toBe('teste@1.0.0'); expect(a.db.prepare('SELECT * FROM estimulos').all()).toHaveLength(3);
  });
  it('pacote inválido é rejeitado inteiro, sem persistência parcial', () => {
    const { db, biblioteca: b } = ambiente(); const p = pacote();
    expect(() => b.importarPacote(p.manifesto, () => p.bytes.replace('Referência', 'Trocado'))).toThrow('HASH_DIVERGENTE');
    expect(() => b.importarPacote({ ...p.manifesto, itens: [...p.manifesto.itens, ...p.manifesto.itens] }, p.ler)).toThrow('DUPLICATA');
    expect(db.prepare('SELECT * FROM biblioteca_pacote').all()).toEqual([]);
  });
  it('não permite declaração de aprovação, PHI, traversal ou dependências ausentes/cíclicas', () => {
    const { biblioteca: b } = ambiente();
    for (const extra of [{ curadoria: 'ALERTA' }, { texto: 'CPF 123.456.789-10' }, { dependencias: [{ id: 'ausente', versao: '1.0.0' }] }, { dependencias: [{ id: 'item-a', versao: '1.0.0' }] }]) {
      const p = pacote('1.0.0', extra); expect(() => b.importarPacote(p.manifesto, p.ler)).toThrow();
    }
    const p = pacote(); expect(() => b.importarPacote({ ...p.manifesto, itens: [{ ...p.manifesto.itens[0], arquivo: '../item.json' }] }, p.ler)).toThrow();
  });
  it('trials permanecem consulta e não viram alerta/elegibilidade', () => {
    const { biblioteca: b } = ambiente(); const p = pacote('1.0.0', { tipo: 'TRIAL' }); const id = b.importarPacote(p.manifesto, p.ler);
    expect(() => b.revisarItem(id, 'item-a', 'ALERTA')).toThrow('REFERENCIA_NAO_GERA_ALERTA');
    b.revisarItem(id, 'item-a', 'CONSULTAVEL'); b.ativar(id); expect(b.consultar({ tumor: 'sintetico' })[0]?.tipo).toBe('TRIAL');
  });
  it('curadoria usa autoridade server-side e pacote/ativação imutáveis', () => {
    const a = ambiente(); const p = pacote(); const id = a.biblioteca.importarPacote(p.manifesto, p.ler);
    a.bloquear(); expect(() => a.biblioteca.revisarItem(id, 'item-a', 'ALERTA')).toThrow('SEM_AUTORIDADE');
    expect(() => a.db.prepare('UPDATE biblioteca_pacote SET hash=?').run('a')).toThrow('imutavel');
    expect(() => a.biblioteca.importarPacote(p.manifesto, p.ler)).toThrow('VERSAO_DUPLICADA');
  });
});
