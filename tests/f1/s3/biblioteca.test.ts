import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { criarBiblioteca, sha256Biblioteca, type AtivacaoBiblioteca } from '../../../src/kernel/corpus/biblioteca.js';
function ambiente() {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE estimulos (tipo TEXT, versao TEXT)');
  let autorizado = true; let falhar = false;
  const biblioteca = criarBiblioteca(db, { autorizarCuradoria: () => autorizado ? { atorId: 'sessao-medico' } : null,
    agora: () => '2026-10-14T15:30:00.000Z',
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
  it.each(['tumor', 'histologia', 'estadio', 'biomarcador', 'linha'])('identificador em aplicabilidade.%s é recusado antes de persistir', campo => {
    const { db, biblioteca: b } = ambiente();
    const p = pacote('1.0.0', { aplicabilidade: { tumor: [], histologia: [], estadio: [], biomarcador: [], linha: [], [campo]: ['Paciente: Pessoa Sintética'] } });
    try {
      expect(() => b.importarPacote(p.manifesto, p.ler)).toThrow('IDENTIFICADOR_PESSOAL');
      expect(db.prepare('SELECT count(*) AS n FROM biblioteca_pacote').get()?.n).toBe(0);
    } finally { db.close(); }
  });
  it.each(['Paciente: Pessoa Sintética', 'Endereço: Rua Sintética', 'Nascimento: 01/01/2000'])(
    'pacote público com identificador estrutural é recusado antes de persistir (%s)', texto => {
      const { db, biblioteca: b } = ambiente(); const p = pacote('1.0.0', { texto });
      expect(() => b.importarPacote(p.manifesto, p.ler)).toThrow('IDENTIFICADOR_PESSOAL');
      expect(db.prepare('SELECT count(*) AS n FROM biblioteca_pacote').get()?.n).toBe(0);
      db.close();
    });
  it('importação nunca aprova; curadoria item a item distingue consulta e alerta', () => {
    const { biblioteca: b } = ambiente(); const p = pacote(); const id = b.importarPacote(p.manifesto, p.ler);
    expect(b.estado(id, 'item-a')).toBe('RASCUNHO'); expect(() => b.ativar(id)).toThrow('SEM_ITEM_APROVADO');
    b.revisarItem(id, 'item-a', 'CONSULTAVEL'); b.ativar(id);
    expect(b.consultar({ tumor: 'sintetico' })).toHaveLength(1);
    expect(b.consultar({ tumor: 'sintetico' }, 'ALERTA')).toEqual([]);
    expect(b.consultar({})).toEqual([]); expect(b.consultar({ tumor: 'outro' })).toEqual([]);
    b.revisarItem(id, 'item-a', 'ALERTA'); expect(b.consultar({ tumor: 'sintetico' }, 'ALERTA')).toHaveLength(1);
    b.revisarItem(id, 'item-a', 'OBSOLETO'); expect(b.consultar({ tumor: 'sintetico' })).toEqual([]);
    expect(b.listar(id)[0]?.curadoria).toEqual({ ator: 'sessao-medico', registradoEm: '2026-10-14T15:30:00.000Z' });
  });
  it('rollback restaura última versão válida sem rede e emissão é atômica', () => {
    const a = ambiente(); const b = a.biblioteca;
    for (const v of ['1.0.0','2.0.0']) { const p = pacote(v); const id = b.importarPacote(p.manifesto, p.ler); b.revisarItem(id, 'item-a', 'CONSULTAVEL'); b.ativar(id); }
    expect(a.db.prepare('SELECT ator,registrado_em FROM biblioteca_ativacao ORDER BY seq LIMIT 1').get()).toEqual({ ator: 'sessao-medico', registrado_em: '2026-10-14T15:30:00.000Z' });
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
    for (const extra of [{ curadoria: 'ALERTA' }, { texto: 'CPF 000.000.000-00' }, { dependencias: [{ id: 'ausente', versao: '1.0.0' }] }, { dependencias: [{ id: 'item-a', versao: '1.0.0' }] }]) {
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
  it.each(['', 'sem-data', '2026-02-30T10:00:00-03:00'])('relógio inválido não deixa curadoria ou ativação parcial (%s)', invalido => {
    const db = new DatabaseSync(':memory:');
    let instante = invalido;
    const b = criarBiblioteca(db, { autorizarCuradoria: () => ({ atorId: 'medico-sintetico' }),
      agora: () => instante, emitir: () => {} });
    try {
      const p = pacote(); const id = b.importarPacote(p.manifesto, p.ler);
      expect(() => b.revisarItem(id, 'item-a', 'CONSULTAVEL')).toThrow('RELOGIO_SERVICO_INVALIDO');
      expect(db.prepare('SELECT count(*) n FROM biblioteca_curadoria').get()?.n).toBe(0);
      instante = '2026-10-14T10:00:00-03:00';
      b.revisarItem(id, 'item-a', 'CONSULTAVEL');
      expect(b.listar(id)[0]?.curadoria?.registradoEm).toBe(instante);
      instante = invalido;
      expect(() => b.ativar(id)).toThrow('RELOGIO_SERVICO_INVALIDO');
      expect(b.ativa()).toBeNull();
      expect(db.prepare('SELECT count(*) n FROM biblioteca_ativacao').get()?.n).toBe(0);
    } finally { db.close(); }
  });
  it('migra schema legado de forma aditiva e mantém os registros sem data como desconhecidos', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE biblioteca_pacote (id TEXT PRIMARY KEY, conteudo TEXT NOT NULL, hash TEXT NOT NULL);
      CREATE TABLE biblioteca_curadoria (seq INTEGER PRIMARY KEY, pacote TEXT NOT NULL REFERENCES biblioteca_pacote(id), item TEXT NOT NULL, estado TEXT NOT NULL CHECK(estado IN ('RASCUNHO','CONSULTAVEL','ALERTA','OBSOLETO')), ator TEXT NOT NULL);
      CREATE TABLE biblioteca_ativacao (seq INTEGER PRIMARY KEY, pacote TEXT NOT NULL REFERENCES biblioteca_pacote(id), anterior TEXT, motivo TEXT NOT NULL);`);
    const p = pacote();
    const conteudo = JSON.stringify({ manifesto: p.manifesto, itens: [JSON.parse(p.bytes)], bytes: { 'item-a.json': p.bytes } });
    db.prepare('INSERT INTO biblioteca_pacote(id,conteudo,hash) VALUES(?,?,?)').run('teste@1.0.0', conteudo, sha256Biblioteca(conteudo));
    db.prepare('INSERT INTO biblioteca_curadoria(pacote,item,estado,ator) VALUES(?,?,?,?)').run('teste@1.0.0', 'item-a', 'CONSULTAVEL', 'legado');
    const b = criarBiblioteca(db, { autorizarCuradoria: () => ({ atorId: 'sessao-medico' }), agora: () => '2026-10-14T15:30:00.000Z', emitir: () => {} });
    try {
      expect(b.listar('teste@1.0.0')[0]?.curadoria).toEqual({ ator: 'legado', registradoEm: null });
      b.revisarItem('teste@1.0.0', 'item-a', 'OBSOLETO');
      expect(b.listar('teste@1.0.0')[0]?.curadoria).toEqual({ ator: 'sessao-medico', registradoEm: '2026-10-14T15:30:00.000Z' });
    } finally { db.close(); }
  });
});
