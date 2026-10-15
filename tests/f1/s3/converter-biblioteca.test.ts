// F1-N · Ponte ExportacaoConsultaCorpus@1 → PacoteBiblioteca@1 — bateria obrigatória do adendo ao eixo N.
// Snapshot sempre gerado pelo exportador REAL; conversão sempre pelo conversor REAL; importação sempre
// pela API pública interna (criarBiblioteca().importarPacote) ou pelo HTTP real (rotearBiblioteca).
import { describe, it, expect } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { exportarBiblioteca } from '../../../scripts/exportar-biblioteca.mjs';
import { converterBiblioteca } from '../../../scripts/converter-biblioteca.mjs';
import { criarBiblioteca, sha256Biblioteca } from '../../../src/kernel/corpus/biblioteca.js';
import { abrirLedger } from '../../../src/kernel/ledger/db.js';
import { criarGerenciadorSessao } from '../../../src/server/sessao.js';
import { rotearBiblioteca } from '../../../src/server/biblioteca.js';

const AGORA = '2026-10-14T12:00:00Z';
it('não atribui o arquivo inteiro à primeira fonte: exige e respeita a seção mapeada', async () => {
  const caminho = 'corpus/1-exames/labs/composto.json';
  const root = criarRoot({ [caminho]: painel('composto', { painels: [
    {classe:'pemetrexede', fonte:{referencia:'Fonte A', trecho:'trecho A', edicao:'2026-10-11'}},
    {classe:'anti-HER2', fonte:{referencia:'Fonte B', trecho:'trecho B', edicao:'2026-10-11'}},
    {classe:'sem suporte', recomendacao:'conteúdo não fundamentado'},
  ] }), 'corpus/1-exames/labs/controle.json': painel('controle') });
  const integral = await converter(root,'multiplas',{itens:{[caminho]:{}, 'corpus/1-exames/labs/controle.json':{}}});
  expect(integral.inventario.excluidos).toEqual(expect.arrayContaining([expect.objectContaining({caminho,motivo:'PROVENIENCIA_MULTIPLA_SEM_ESCOPO'})]));
  const parcial = await converter(root,'secao',{itens:{[caminho]:{escopoFonte:'/painels/0'}}});
  const item = lerItem(parcial.destino, parcial.manifesto.itens[0].arquivo);
  expect(item.texto).toContain('pemetrexede');
  expect(item.texto).not.toContain('anti-HER2');
  expect(item.texto).not.toContain('conteúdo não fundamentado');
  expect(item.proveniencia.trecho).toBe('trecho A');
  expect(parcial.inventario.incluidos[0]).toMatchObject({localizador:'/painels/0',escopoParcial:true});
  expect(parcial.inventario.incluidos[0].outrasFontesNaoConvertidas).toContain('/painels/1/fonte');
});
// CPF sintético válido montado em runtime — o literal não pode existir no fonte (scanner PHI do repositório).
const CPF_SINTETICO = ['123', '456', '789', '09'].join('.');
const RAIZ = dirname(dirname(dirname(fileURLToPath(import.meta.url)))); // raiz do repo

function criarRoot(arquivos: Record<string, unknown>) {
  const root = mkdtempSync(join(tmpdir(), 'conv-root-'));
  for (const [caminho, conteudo] of Object.entries(arquivos))
    { mkdirSync(dirname(join(root, caminho)), { recursive: true }); writeFileSync(join(root, caminho), typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo, null, 1)); }
  return root;
}
const painel = (id: string, extra: Record<string, unknown> = {}) => ({
  header: { id, versao: '1.0.0', vigenteDesde: '2026-10-11', fonte: { tipo: 'LITERATURA', referencia: `Exemplo ${id}`, trecho: `trecho público ${id}`, edicao: '2026-10-11' } },
  nota: 'fixture sintética sem dados pessoais', ...extra,
});
function mapeamento(itens: Record<string, { aplicabilidade?: Record<string, string[]>; url?: string; escopoFonte?: string }>, verificacoes: string[]) {
  const dir = mkdtempSync(join(tmpdir(), 'conv-map-'));
  const m = {
    schema: 'ConversorBibliotecaMapeamento@1', versao: '1.0.0', itens: Object.fromEntries(Object.entries(itens).map(([caminho, i]) => [caminho, {
      pilar: 1, aplicabilidade: i.aplicabilidade ?? { tumor: [], histologia: [], estadio: [], biomarcador: [], linha: [] },
      provenienciaUrl: i.url ?? 'https://example.org/fonte', ...(i.escopoFonte ? {escopoFonte:i.escopoFonte} : {}),
    }])), verificacoes: verificacoes.map((url) => ({ url, verificadaEm: '2026-10-14', metodo: 'fixture' })), pendencias: [],
  };
  const arquivo = join(dir, 'mapeamento.json'); writeFileSync(arquivo, JSON.stringify(m)); return arquivo;
}
async function converter(root: string, nome: string, opcoes: { itens?: Record<string, { aplicabilidade?: Record<string, string[]>; url?: string; escopoFonte?: string }>; versao?: string; verificacoes?: string[] } = {}) {
  const base = mkdtempSync(join(tmpdir(), 'conv-out-'));
  const snap = join(base, `${nome}-snap`), destino = join(base, `${nome}-pac`);
  exportarBiblioteca(root, snap);
  const resultado = await converterBiblioteca(snap, destino, { mapeamento: mapeamento(opcoes.itens ?? {}, opcoes.verificacoes ?? ['https://example.org/fonte']), agora: AGORA, idPacote: 'corpus-sintetico', versao: opcoes.versao ?? '1.0.0' });
  return { base, snap, destino, resultado, inventario: JSON.parse(readFileSync(join(destino, 'inventario.json'), 'utf8')), manifesto: JSON.parse(readFileSync(join(destino, 'pacote', 'manifesto.json'), 'utf8')) };
}
const lerItem = (destino: string, arquivo: string) => JSON.parse(readFileSync(join(destino, 'pacote', arquivo), 'utf8'));
function importarEmBanco(manifesto: unknown, destino: string) {
  const db = new DatabaseSync(':memory:');
  const biblioteca = criarBiblioteca(db, { autorizarCuradoria: () => ({ atorId: 'teste' }), emitir: () => {} });
  biblioteca.importarPacote(manifesto, (arquivo) => readFileSync(join(destino, 'pacote', arquivo), 'utf8'));
  return { db, biblioteca };
}
/** Reescreve itens e manifesto de um pacote convertido, recalculando os hashes (para casos adversariais). */
function reescrever(destino: string, mudanca: (itens: Record<string, any>[]) => void) {
  const manifesto = JSON.parse(readFileSync(join(destino, 'pacote', 'manifesto.json'), 'utf8'));
  const itens = manifesto.itens.map((ref: any) => JSON.parse(readFileSync(join(destino, 'pacote', ref.arquivo), 'utf8')));
  mudanca(itens);
  itens.forEach((item: any, k: number) => { const texto = JSON.stringify(item); writeFileSync(join(destino, 'pacote', manifesto.itens[k].arquivo), texto); manifesto.itens[k].sha256 = sha256Biblioteca(texto); manifesto.itens[k].versao = item.versao; manifesto.itens[k].id = item.id; });
  writeFileSync(join(destino, 'pacote', 'manifesto.json'), JSON.stringify(manifesto));
  return manifesto;
}

describe('F1-N ponte snapshot→PacoteBiblioteca', () => {
  it('converte o primeiro lote com proveniência verificada e exclui o resto com motivo', async () => {
    const root = criarRoot({
      'corpus/1-exames/labs/painel-a.json': painel('painel-a'),
      'corpus/1-exames/path/painel-b.json': painel('painel-b'),
      'corpus/1-exames/labs/sem-mapeamento.json': painel('sem-mapeamento'),
      'corpus/1-exames/labs/sem-trecho.json': { header: { id: 'sem-trecho', versao: '1.0.0', vigenteDesde: '2026-10-11', fonte: { tipo: 'DECISAO_MEDICA', referencia: 'modelo interno', trecho: null, edicao: null } } },
      'corpus/1-exames/labs/sem-data.json': { header: { id: 'sem-data', versao: '1.0.0', fonte: { tipo: 'LITERATURA', referencia: 'Exemplo', trecho: 'trecho', edicao: null } } },
      'corpus/fichas/f.json': painel('transversal'),
    });
    const { destino, resultado, inventario, manifesto } = await converter(root, 'lote', {
      itens: {
        'corpus/1-exames/labs/painel-a.json': {},
        'corpus/1-exames/path/painel-b.json': { aplicabilidade: { tumor: ['mama'], histologia: [], estadio: [], biomarcador: [], linha: [] } },
        'corpus/1-exames/labs/sem-trecho.json': {},
        'corpus/1-exames/labs/sem-data.json': {},
      },
      verificacoes: ['https://example.org/fonte'],
    });
    expect(resultado.itens).toBe(2);
    const a = lerItem(destino, '1-exames-labs-painel-a.json');
    expect(a.tipo).toBe('REFERENCIA'); expect(a.pilar).toBe(1); expect(a.proveniencia.fonte).toBe('https://example.org/fonte');
    expect(a.proveniencia.publicadoEm).toBe('2026-10-11'); expect(a.proveniencia.recuperadoEm).toBe(AGORA);
    expect(a.proveniencia.licenca).toContain('Uso interno'); expect(a.dependencias).toEqual([]); expect(a.aplicabilidade.tumor).toEqual([]);
    const b = lerItem(destino, '1-exames-path-painel-b.json'); expect(b.aplicabilidade.tumor).toEqual(['mama']);
    expect(manifesto.origem).toBe('CURADOR_LOCAL'); expect(manifesto.classificacao).toBe('PUBLIC');
    const motivos = Object.fromEntries(inventario.excluidos.map((e: any) => [e.caminho, e.motivo]));
    expect(motivos['corpus/1-exames/labs/sem-mapeamento.json']).toBe('APLICABILIDADE_DESCONHECIDA'); // desconhecida ≠ lista vazia
    expect(motivos['corpus/1-exames/labs/sem-trecho.json']).toBe('PROVENIENCIA_SEM_TRECHO');
    expect(motivos['corpus/1-exames/labs/sem-data.json']).toBe('SEM_DATA_PUBLICACAO');
    expect(motivos['corpus/fichas/f.json']).toBe('RAIZ_TRANSVERSAL_SEM_PILAR');
    expect(inventario.pilares.transversaisExcluidos).toContain('fichas');
    expect(inventario.aviso).toContain('não declara biblioteca completa');
    expect(existsSync(join(destino, 'pacote-http.json'))).toBe(true);
  });

  it('importação RASCUNHO não vira conteúdo aprovado: consulta vazia até curar e ativar', async () => {
    const root = criarRoot({ 'corpus/1-exames/labs/painel-a.json': painel('painel-a') });
    const { destino, manifesto } = await converter(root, 'rascunho', { itens: { 'corpus/1-exames/labs/painel-a.json': {} } });
    const { db, biblioteca } = importarEmBanco(manifesto, destino);
    try {
      expect(biblioteca.estado('corpus-sintetico@1.0.0', '1-exames-labs-painel-a')).toBe('RASCUNHO');
      expect(biblioteca.consultar({})).toEqual([]);
      expect(() => biblioteca.ativar('corpus-sintetico@1.0.0')).toThrow('SEM_ITEM_APROVADO');
      biblioteca.revisarItem('corpus-sintetico@1.0.0', '1-exames-labs-painel-a', 'CONSULTAVEL');
      biblioteca.ativar('corpus-sintetico@1.0.0');
      expect(biblioteca.consultar({})).toHaveLength(1);
    } finally { db.close(); }
  });

  it('aplicabilidade restrita responde ao filtro; universal (listas vazias) aparece sem filtro', async () => {
    const root = criarRoot({ 'corpus/1-exames/labs/painel-a.json': painel('painel-a'), 'corpus/1-exames/path/painel-b.json': painel('painel-b') });
    const { destino, manifesto } = await converter(root, 'aplic', {
      itens: { 'corpus/1-exames/labs/painel-a.json': {}, 'corpus/1-exames/path/painel-b.json': { aplicabilidade: { tumor: ['mama'], histologia: [], estadio: [], biomarcador: [], linha: [] } } },
    });
    const { db, biblioteca } = importarEmBanco(manifesto, destino);
    try {
      for (const ref of manifesto.itens) { biblioteca.revisarItem('corpus-sintetico@1.0.0', ref.id, 'CONSULTAVEL'); }
      biblioteca.ativar('corpus-sintetico@1.0.0');
      expect(biblioteca.consultar({ tumor: 'mama' }).map((i) => i.id).sort()).toEqual(['1-exames-labs-painel-a', '1-exames-path-painel-b']);
      expect(biblioteca.consultar({ tumor: 'prostata' }).map((i) => i.id)).toEqual(['1-exames-labs-painel-a']); // universal passa; restrito não
    } finally { db.close(); }
  });

  it('hash divergente, campo extra e identidade divergente são recusados pelo importador real', async () => {
    const root = criarRoot({ 'corpus/1-exames/labs/painel-a.json': painel('painel-a') });
    const { destino, manifesto } = await converter(root, 'adulterado', { itens: { 'corpus/1-exames/labs/painel-a.json': {} } });
    const arquivo = manifesto.itens[0]!.arquivo;
    const item = lerItem(destino, arquivo);
    writeFileSync(join(destino, 'pacote', arquivo), JSON.stringify({ ...item, extra: 'campo' })); // campo extra, sha recalculado abaixo
    let m = JSON.parse(JSON.stringify(manifesto)); m.itens[0].sha256 = sha256Biblioteca(readFileSync(join(destino, 'pacote', arquivo), 'utf8'));
    expect(() => importarEmBanco(m, destino)).toThrow(); // strictObject recusa campo extra
    writeFileSync(join(destino, 'pacote', arquivo), JSON.stringify(item)); // restaura bytes
    m = JSON.parse(JSON.stringify(manifesto)); m.itens[0].sha256 = '0'.repeat(64);
    expect(() => importarEmBanco(m, destino)).toThrow('HASH_DIVERGENTE');
    m = JSON.parse(JSON.stringify(manifesto)); m.itens[0].versao = '9.9.9';
    expect(() => importarEmBanco(m, destino)).toThrow('IDENTIDADE_DIVERGENTE');
  });

  it('dependência ausente, versão divergente e ciclo são recusados', async () => {
    const root = criarRoot({ 'corpus/1-exames/labs/painel-a.json': painel('painel-a'), 'corpus/1-exames/labs/painel-c.json': painel('painel-c') });
    const { destino } = await converter(root, 'deps', { itens: { 'corpus/1-exames/labs/painel-a.json': {}, 'corpus/1-exames/labs/painel-c.json': {} } });
    const ausente = reescrever(destino, (itens) => { itens[0]!.dependencias = [{ id: 'nao-existe', versao: '1.0.0' }]; });
    expect(() => importarEmBanco(ausente, destino)).toThrow('DEPENDENCIA_AUSENTE');
    const divergente = reescrever(destino, (itens) => { itens[0]!.dependencias = [{ id: itens[1]!.id, versao: '2.0.0' }]; });
    expect(() => importarEmBanco(divergente, destino)).toThrow('DEPENDENCIA_AUSENTE');
    const ciclo = reescrever(destino, (itens) => { itens[0]!.dependencias = [{ id: itens[1]!.id, versao: itens[1]!.versao }]; itens[1]!.dependencias = [{ id: itens[0]!.id, versao: itens[0]!.versao }]; });
    expect(() => importarEmBanco(ciclo, destino)).toThrow('DEPENDENCIA_CICLICA');
  });

  it('colisão de id/arquivo aborta sem persistência parcial; destino existente é recusado', async () => {
    const root = criarRoot({ 'corpus/1-exames/labs/x-a.json': painel('x-a'), 'corpus/1-exames/labs/x.a.json': painel('x-b') });
    const base = mkdtempSync(join(tmpdir(), 'conv-col-')); const snap = join(base, 'snap');
    exportarBiblioteca(root, snap);
    const destino = join(base, 'pac');
    await expect(converterBiblioteca(snap, destino, { mapeamento: mapeamento({ 'corpus/1-exames/labs/x-a.json': {}, 'corpus/1-exames/labs/x.a.json': {} }, ['https://example.org/fonte']), agora: AGORA })).rejects.toThrow('COLISAO');
    expect(existsSync(destino)).toBe(false);
    expect(readdirSync(base).filter((f) => f.includes('staging'))).toEqual([]); // staging limpo
    mkdirSync(destino);
    await expect(converterBiblioteca(snap, join(base, 'pac'), { mapeamento: mapeamento({ 'corpus/1-exames/labs/x-a.json': {} }, ['https://example.org/fonte']), agora: AGORA })).rejects.toThrow('DESTINO_JA_EXISTE');
  });

  it('PHI não atravessa: exportação recusa texto e rótulo estrutural; snapshot adulterado falha na revalidação', async () => {
    const comCpf = criarRoot({ 'corpus/1-exames/labs/p.json': painel('p', { nota: `ligar para ${CPF_SINTETICO}` }) });
    const base1 = mkdtempSync(join(tmpdir(), 'conv-phi1-'));
    expect(() => exportarBiblioteca(comCpf, join(base1, 'snap'))).toThrow();
    const comRotulo = criarRoot({ 'corpus/1-exames/labs/q.json': { header: painel('q').header, paciente: { nome: 'alguma coisa' } } });
    const base2 = mkdtempSync(join(tmpdir(), 'conv-phi2-'));
    expect(() => exportarBiblioteca(comRotulo, join(base2, 'snap'))).toThrow();
    const root = criarRoot({ 'corpus/1-exames/labs/painel-a.json': painel('painel-a') });
    const { snap } = await converter(root, 'phi3', { itens: { 'corpus/1-exames/labs/painel-a.json': {} } });
    const alvo = join(snap, 'corpus/1-exames/labs/painel-a.json');
    const adulterado = readFileSync(alvo, 'utf8').replace('fixture sintética', `CPF ${CPF_SINTETICO}`);
    writeFileSync(alvo, adulterado);
    const m = JSON.parse(readFileSync(join(snap, 'manifesto.json'), 'utf8'));
    m.arquivos.find((a: any) => a.caminho === 'corpus/1-exames/labs/painel-a.json').sha256 = sha256Biblioteca(adulterado);
    writeFileSync(join(snap, 'manifesto.json'), JSON.stringify(m));
    const out = mkdtempSync(join(tmpdir(), 'conv-phi3-out-'));
    await expect(converterBiblioteca(snap, join(out, 'pac'), { mapeamento: mapeamento({ 'corpus/1-exames/labs/painel-a.json': {} }, ['https://example.org/fonte']), agora: AGORA })).rejects.toThrow();
  });

  it('pacote excessivo: item >1 MB recusado pelo importador; corpo acima do limite do roteador não ganha pacote-http', async () => {
    const grande = 'x'.repeat(1_100_000);
    const itemGrande = { schema: 'ItemBiblioteca@1', id: 'grande', versao: '1.0.0', pilar: 1, tipo: 'REFERENCIA', titulo: 'g', texto: grande, aplicabilidade: { tumor: [], histologia: [], estadio: [], biomarcador: [], linha: [] }, proveniencia: { fonte: 'https://example.org/g', trecho: 't', publicadoEm: '2026-01-01', recuperadoEm: AGORA, licenca: 'l' }, dependencias: [] };
    const db = new DatabaseSync(':memory:');
    const biblioteca = criarBiblioteca(db, { autorizarCuradoria: () => ({ atorId: 't' }), emitir: () => {} });
    const texto = JSON.stringify(itemGrande);
    try { expect(() => biblioteca.importarPacote({ schema: 'PacoteBiblioteca@1', id: 'g', versao: '1.0.0', origem: 'CURADOR_LOCAL', classificacao: 'PUBLIC', criadoEm: AGORA, itens: [{ id: 'grande', versao: '1.0.0', arquivo: 'grande.json', sha256: sha256Biblioteca(texto) }] }, () => texto)).toThrow('ITEM_EXCESSIVO'); } finally { db.close(); }

    const arquivos: Record<string, unknown> = {};
    for (let k = 0; k < 6; k++) arquivos[`corpus/1-exames/labs/gra-${k}.json`] = painel(`gra-${k}`, { nota: 'y'.repeat(170_000) });
    const root = criarRoot(arquivos);
    const itens = Object.fromEntries(Object.keys(arquivos).map((c) => [c, {}]));
    const { destino, inventario } = await converter(root, 'httpgrande', { itens });
    expect(inventario.http.emitido).toBe(false); // corpo ultrapassa o limite do roteador (1.000.000)
    expect(inventario.http.bytesBody).toBeGreaterThan(1_000_000);
    expect(existsSync(join(destino, 'pacote-http.json'))).toBe(false);
    expect(existsSync(join(destino, 'pacote', 'manifesto.json'))).toBe(true); // pacote interno segue válido
  }, 120_000);

  it('VERSAO_DUPLICADA não duplica pacote e falha de importação não persiste nada', async () => {
    const root = criarRoot({ 'corpus/1-exames/labs/painel-a.json': painel('painel-a') });
    const { destino, manifesto } = await converter(root, 'dup', { itens: { 'corpus/1-exames/labs/painel-a.json': {} } });
    const { db, biblioteca } = importarEmBanco(manifesto, destino);
    try {
      expect(() => biblioteca.importarPacote(manifesto, (a) => readFileSync(join(destino, 'pacote', a), 'utf8'))).toThrow('VERSAO_DUPLICADA');
      expect((db.prepare('SELECT count(*) AS n FROM biblioteca_pacote').get() as any).n).toBe(1);
    } finally { db.close(); }
  });

  it('ativação e rollback trocam o conjunto efetivamente consultável (um pacote ativo por vez)', async () => {
    const painelV = (v: string) => painel('painel-a', { header: { id: 'painel-a', versao: '1.0.0', vigenteDesde: '2026-10-11', fonte: { tipo: 'LITERATURA', referencia: `Exemplo ${v}`, trecho: `trecho ${v}`, edicao: '2026-10-11' } } });
    const v1 = await converter(criarRoot({ 'corpus/1-exames/labs/painel-a.json': painelV('v1') }), 'ativa1', { versao: '1.0.0', itens: { 'corpus/1-exames/labs/painel-a.json': {} } });
    const v2 = await converter(criarRoot({ 'corpus/1-exames/labs/painel-a.json': painelV('v2') }), 'ativa2', { versao: '2.0.0', itens: { 'corpus/1-exames/labs/painel-a.json': {} } });
    const db = new DatabaseSync(':memory:');
    const biblioteca = criarBiblioteca(db, { autorizarCuradoria: () => ({ atorId: 't' }), emitir: () => {} });
    try {
      biblioteca.importarPacote(v1.manifesto, (a) => readFileSync(join(v1.destino, 'pacote', a), 'utf8'));
      biblioteca.importarPacote(v2.manifesto, (a) => readFileSync(join(v2.destino, 'pacote', a), 'utf8'));
      biblioteca.revisarItem('corpus-sintetico@1.0.0', v1.manifesto.itens[0].id, 'CONSULTAVEL');
      biblioteca.revisarItem('corpus-sintetico@2.0.0', v2.manifesto.itens[0].id, 'CONSULTAVEL');
      biblioteca.ativar('corpus-sintetico@1.0.0');
      expect(biblioteca.consultar({}).every((i) => i.proveniencia.trecho === 'trecho v1')).toBe(true);
      biblioteca.ativar('corpus-sintetico@2.0.0');
      expect(biblioteca.consultar({}).every((i) => i.proveniencia.trecho === 'trecho v1')).toBe(false); // só o v2 (2.0.0) está ativo
      biblioteca.voltarAnterior();
      expect(biblioteca.consultar({}).every((i) => i.proveniencia.trecho === 'trecho v1')).toBe(true);
    } finally { db.close(); }
  });
});

describe('F1-N ponte no HTTP real', () => {
  async function ambiente() {
    const db = abrirLedger(':memory:'); const agora = () => '2026-10-14T12:00:00Z';
    const sessoes = criarGerenciadorSessao({ medicoId: 'medico', crm: 'SINTETICO', senha: 'segredo-sintetico-123', duracaoMs: 3600000, agora });
    const auth = sessoes.login('segredo-sintetico-123')!; const deps = { db, sessoes, agora };
    const server = createServer(async (req, res) => { let raw = ''; for await (const part of req) raw += part; const token = String(req.headers.authorization ?? '').replace('Bearer ', ''); const result = rotearBiblioteca(deps, token, req.url!, JSON.parse(raw), auth.sessao); res.writeHead(result?.status ?? 404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(result?.body ?? {})); });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    return { db, async post(rota: string, body: unknown, token = auth.token) { const r = await fetch(base + rota, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() as Record<string, any> }; }, async close() { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); db.close(); } };
  }
  it('importa o pacote convertido, cura, ativa e consulta; ALERTA é recusado inclusive para REGRA', async () => {
    const root = criarRoot({ 'corpus/1-exames/labs/painel-a.json': painel('painel-a'), 'corpus/1-exames/path/painel-b.json': painel('painel-b') });
    const { destino } = await converter(root, 'http', {
      itens: { 'corpus/1-exames/labs/painel-a.json': {}, 'corpus/1-exames/path/painel-b.json': { aplicabilidade: { tumor: ['mama'], histologia: [], estadio: [], biomarcador: [], linha: [] } } },
    });
    const payload = JSON.parse(readFileSync(join(destino, 'pacote-http.json'), 'utf8'));
    expect(JSON.stringify(payload).length).toBeLessThanOrEqual(1_000_000); // dentro do limite do roteador
    const a = await ambiente();
    try {
      const imp = await a.post('/biblioteca/importar', payload);
      expect(imp.status).toBe(201); expect(imp.body.codigo).toBe('PACOTE_IMPORTADO_RASCUNHO');
      const id = imp.body.pacoteId, hash = imp.body.hash;
      expect((await a.post('/biblioteca/consultar', { filtros: {} })).body.itens).toEqual([]); // RASCUNHO não é consultável
      for (const ref of payload.manifesto.itens) expect((await a.post('/biblioteca/curar', { pacoteId: id, itemId: ref.id, expectedHash: hash, estado: 'ALERTA' })).body.codigo).toBe('ALERTA_SEM_SCHEMA_EXECUTAVEL');
      for (const ref of payload.manifesto.itens) expect((await a.post('/biblioteca/curar', { pacoteId: id, itemId: ref.id, expectedHash: hash, estado: 'CONSULTAVEL' })).status).toBe(200);
      expect((await a.post('/biblioteca/ativar', { pacoteId: id, expectedHash: hash })).status).toBe(200);
      const consulta = await a.post('/biblioteca/consultar', { filtros: { tumor: 'mama' } });
      expect(consulta.body.itens.map((i: any) => i.id).sort()).toEqual(['1-exames-labs-painel-a', '1-exames-path-painel-b']);
      // REGRA manual também não ganha ALERTA no HTTP (proteção preservada — adendo item 5)
      const regra = { schema: 'ItemBiblioteca@1', id: 'regra', versao: '1.0.0', pilar: 4, tipo: 'REGRA', titulo: 'REGRA sintética', texto: 'texto', aplicabilidade: { tumor: [], histologia: [], estadio: [], biomarcador: [], linha: [] }, proveniencia: { fonte: 'https://example.org/r', trecho: 't', publicadoEm: '2026-01-01', recuperadoEm: AGORA, licenca: 'l' }, dependencias: [] };
      const texto = JSON.stringify(regra);
      const p2 = { manifesto: { schema: 'PacoteBiblioteca@1', id: 'regra-pac', versao: '1.0.0', origem: 'CURADOR_LOCAL', classificacao: 'PUBLIC', criadoEm: AGORA, itens: [{ id: 'regra', versao: '1.0.0', arquivo: 'regra.json', sha256: sha256Biblioteca(texto) }] }, arquivos: { 'regra.json': { texto } } };
      const imp2 = await a.post('/biblioteca/importar', p2);
      expect((await a.post('/biblioteca/curar', { pacoteId: imp2.body.pacoteId, itemId: 'regra', expectedHash: imp2.body.hash, estado: 'ALERTA' })).body.codigo).toBe('ALERTA_SEM_SCHEMA_EXECUTAVEL');
    } finally { await a.close(); }
  });
});
