import { garantirColunas } from "../ledger/migracao.js";
import { transacao as transacaoLedger } from "../ledger/db.js";
import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { detectarPhiEstrutural } from '../llm/phiEstrutural.js';

const chave = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const versao = z.string().regex(/^\d+\.\d+\.\d+$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const lista = z.array(z.string().min(1).max(200).refine(v => v !== '*', 'Wildcard exige lista vazia')).max(100);
export const AplicabilidadeBiblioteca = z.strictObject({
  tumor: lista, histologia: lista, estadio: lista, biomarcador: lista, linha: lista,
});
export const ItemBiblioteca = z.strictObject({
  schema: z.literal('ItemBiblioteca@1'), id: chave, versao, pilar: z.number().int().min(1).max(8),
  tipo: z.enum(['REFERENCIA', 'REGRA', 'TRIAL']), titulo: z.string().min(1).max(300),
  texto: z.string().min(1).max(200000), aplicabilidade: AplicabilidadeBiblioteca,
  proveniencia: z.strictObject({ fonte: z.string().url(), trecho: z.string().min(1).max(200000),
    publicadoEm: z.string().date(), recuperadoEm: z.string().datetime(), licenca: z.string().min(1).max(300) }),
  dependencias: z.array(z.strictObject({ id: chave, versao })).max(100),
});
export const ManifestoBiblioteca = z.strictObject({
  schema: z.literal('PacoteBiblioteca@1'), id: chave, versao, origem: z.enum(['GENSPARK_MANUAL', 'CURADOR_LOCAL']),
  classificacao: z.literal('PUBLIC'), criadoEm: z.string().datetime(),
  itens: z.array(z.strictObject({ id: chave, versao, arquivo: z.string().regex(/^[a-zA-Z0-9_-]+\.json$/), sha256: hash })).min(1).max(10000),
});
export type ConteudoBiblioteca = z.infer<typeof ItemBiblioteca>;
export type FiltrosBiblioteca = Partial<Record<keyof ConteudoBiblioteca['aplicabilidade'], string>>;
export type EstadoCuradoria = 'RASCUNHO' | 'CONSULTAVEL' | 'ALERTA' | 'OBSOLETO';
export interface AtivacaoBiblioteca {
  tipo: 'BIBLIOTECA_ATIVADA'; biblioteca: { id: string; versao: string }; anterior: string | null;
  motivo: 'ATIVACAO' | 'ROLLBACK';
}
export interface PortasBiblioteca {
  /** Autoridade obtida na sessão do servidor, nunca no pacote/payload. */
  autorizarCuradoria: () => { atorId: string } | null;
  /** Relógio do servidor para tornar auditável a ordem temporal das mutações. */
  agora?: () => string;
  /** Deve persistir o estímulo usando este db, dentro da transação aberta. Não fazer efeitos externos. */
  emitir: (db: DatabaseSync, evento: AtivacaoBiblioteca) => void;
}
interface Pacote { manifesto: z.infer<typeof ManifestoBiblioteca>; itens: ConteudoBiblioteca[]; }
export const sha256Biblioteca = (bytes: string): string => createHash('sha256').update(bytes, 'utf8').digest('hex');
const idPacote = (p: Pacote['manifesto']): string => `${p.id}@${p.versao}`;

function validarConteudo(manifesto: unknown, ler: (arquivo: string) => string): Pacote {
  const m = ManifestoBiblioteca.parse(manifesto);
  const ids = new Set<string>(); const arquivos = new Set<string>();
  const itens = m.itens.map((ref) => {
    if (ids.has(ref.id) || arquivos.has(ref.arquivo)) throw new Error('DUPLICATA');
    ids.add(ref.id); arquivos.add(ref.arquivo);
    const bytes = ler(ref.arquivo);
    if (sha256Biblioteca(bytes) !== ref.sha256) throw new Error('HASH_DIVERGENTE');
    if (Buffer.byteLength(bytes, 'utf8') > 1000000) throw new Error('ITEM_EXCESSIVO');
    const item = ItemBiblioteca.parse(JSON.parse(bytes));
    if (new Set(item.dependencias.map(d => d.id)).size !== item.dependencias.length) throw new Error('DEPENDENCIA_DUPLICADA');
    if (item.id !== ref.id || item.versao !== ref.versao) throw new Error('IDENTIDADE_DIVERGENTE');
    // Pacote público não aceita identificadores comuns de paciente; declaração PUBLIC não basta.
    // O ramo de e-mail só é testado quando há '@' fora do literal do schema ("ItemBiblioteca@1" sempre
    // contém '@'); sem isso, textos densos em palavras causam backtracking quadrático (170 kB ≈ 80 s/item).
    const publico = JSON.stringify(item).replace('"ItemBiblioteca@1"', '"ItemBiblioteca"');
    if (/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{11}\b|\b\d{15}\b/.test(publico)
      || (publico.includes('@') && /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(publico))) throw new Error('IDENTIFICADOR_PESSOAL');
    // A fonte bibliográfica é uma URL obrigatória. Nos textos, URLs de referência são permitidas;
    // as demais categorias estruturais (nome rotulado, endereço, nascimento...) continuam recusadas.
    const textoPublico = [item.titulo, item.texto, item.proveniencia.trecho, item.proveniencia.licenca,
      ...Object.values(item.aplicabilidade).flat()].join('\n');
    if (detectarPhiEstrutural(textoPublico).some(c => c !== 'URL_OU_IP')) throw new Error('IDENTIFICADOR_PESSOAL');
    return item;
  });
  const mapa = new Map(itens.map(i => [i.id, i]));
  const visitados = new Set<string>(); const caminho = new Set<string>();
  const visitar = (item: ConteudoBiblioteca): void => {
    if (caminho.has(item.id)) throw new Error('DEPENDENCIA_CICLICA');
    if (visitados.has(item.id)) return;
    caminho.add(item.id);
    for (const dep of item.dependencias) {
      const alvo = mapa.get(dep.id);
      if (!alvo || alvo.versao !== dep.versao) throw new Error('DEPENDENCIA_AUSENTE');
      visitar(alvo);
    }
    caminho.delete(item.id); visitados.add(item.id);
  };
  itens.forEach(visitar);
  return { manifesto: m, itens };
}

/** Índice derivado somente dos bytes validados; nenhuma inferência de elegibilidade. */
export function indexarAplicabilidade(itens: readonly ConteudoBiblioteca[]) {
  const campos = ['tumor', 'histologia', 'estadio', 'biomarcador', 'linha'] as const;
  const indice = new Map<string, Set<string>>();
  for (const item of itens) for (const campo of campos) {
    const valores = item.aplicabilidade[campo];
    for (const valor of valores.length ? valores : ['*']) {
      const chave = JSON.stringify([campo, valor]);
      if (!indice.has(chave)) indice.set(chave, new Set());
      indice.get(chave)!.add(item.id);
    }
  }
  return (filtros: FiltrosBiblioteca): Set<string> => {
    let ids = new Set(itens.map(i => i.id));
    for (const campo of campos) {
      const gerais = indice.get(JSON.stringify([campo, '*'])) ?? new Set<string>();
      const especificos = filtros[campo] === undefined ? new Set<string>() :
        indice.get(JSON.stringify([campo, filtros[campo]])) ?? new Set<string>();
      ids = new Set([...ids].filter(id => gerais.has(id) || especificos.has(id)));
    }
    return ids;
  };
}

type RegistroCuradoria = { item: string; estado: EstadoCuradoria; seq: number; ator: string; registrado_em?: string | null };
export function listarCuradoriaAtual(db: DatabaseSync, pacote: string): RegistroCuradoria[] {
  return db.prepare('SELECT * FROM biblioteca_curadoria WHERE pacote=? AND seq IN (SELECT max(seq) FROM biblioteca_curadoria WHERE pacote=? GROUP BY item) ORDER BY item').all(pacote, pacote) as RegistroCuradoria[];
}

/** Loader offline. Importação não confere aprovação; cada item exige curadoria humana separada. */
export function criarBiblioteca(db: DatabaseSync, portas: PortasBiblioteca) {
  db.exec(`CREATE TABLE IF NOT EXISTS biblioteca_pacote (id TEXT PRIMARY KEY, conteudo TEXT NOT NULL, hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS biblioteca_curadoria (seq INTEGER PRIMARY KEY, pacote TEXT NOT NULL REFERENCES biblioteca_pacote(id), item TEXT NOT NULL, estado TEXT NOT NULL CHECK(estado IN ('RASCUNHO','CONSULTAVEL','ALERTA','OBSOLETO')), ator TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS biblioteca_curadoria_pacote_item ON biblioteca_curadoria(pacote,item,seq);
    CREATE TABLE IF NOT EXISTS biblioteca_ativacao (seq INTEGER PRIMARY KEY, pacote TEXT NOT NULL REFERENCES biblioteca_pacote(id), anterior TEXT, motivo TEXT NOT NULL);
    CREATE TRIGGER IF NOT EXISTS biblioteca_pacote_no_update BEFORE UPDATE ON biblioteca_pacote BEGIN SELECT RAISE(ABORT,'biblioteca imutavel'); END;
    CREATE TRIGGER IF NOT EXISTS biblioteca_pacote_no_delete BEFORE DELETE ON biblioteca_pacote BEGIN SELECT RAISE(ABORT,'biblioteca imutavel'); END;
    CREATE TRIGGER IF NOT EXISTS biblioteca_curadoria_no_update BEFORE UPDATE ON biblioteca_curadoria BEGIN SELECT RAISE(ABORT,'curadoria imutavel'); END;
    CREATE TRIGGER IF NOT EXISTS biblioteca_curadoria_no_delete BEFORE DELETE ON biblioteca_curadoria BEGIN SELECT RAISE(ABORT,'curadoria imutavel'); END;
    CREATE TRIGGER IF NOT EXISTS biblioteca_ativacao_no_update BEFORE UPDATE ON biblioteca_ativacao BEGIN SELECT RAISE(ABORT,'ativacao imutavel'); END;
    CREATE TRIGGER IF NOT EXISTS biblioteca_ativacao_no_delete BEFORE DELETE ON biblioteca_ativacao BEGIN SELECT RAISE(ABORT,'ativacao imutavel'); END;`);
  // Migração aditiva: bancos existentes preservam seu histórico sem datas; novas linhas
  // sempre recebem ator e instante. Não reescrevemos eventos anteriores nem hashes.
  garantirColunas(db,[['biblioteca_curadoria','registrado_em','TEXT'],['biblioteca_ativacao','ator','TEXT'],['biblioteca_ativacao','registrado_em','TEXT']]);
  const agora = (): string => {
    const instante = (portas.agora ?? (() => new Date().toISOString()))();
    if (!z.iso.datetime({ offset: true }).safeParse(instante).success) throw new Error('RELOGIO_SERVICO_INVALIDO');
    return instante;
  };
  const transacao = <T>(fn: () => T): T => transacaoLedger(db, fn);
  const autoridade = (): string => {
    const ator = portas.autorizarCuradoria();
    if (!ator?.atorId.trim()) throw new Error('SEM_AUTORIDADE_CURADORIA');
    return ator.atorId;
  };
  const lerPacote = (id: string): Pacote => {
    const row = db.prepare('SELECT conteudo, hash FROM biblioteca_pacote WHERE id=?').get(id) as { conteudo: string; hash: string } | undefined;
    if (!row || sha256Biblioteca(row.conteudo) !== row.hash) throw new Error('PACOTE_INVALIDO');
    const p = JSON.parse(row.conteudo) as Pacote & { bytes: Record<string, string> };
    const validado = validarConteudo(p.manifesto, arquivo => p.bytes[arquivo] ?? '');
    if (idPacote(validado.manifesto) !== id) throw new Error('IDENTIDADE_DIVERGENTE');
    return validado;
  };
  const estado = (pacote: string, item: string): EstadoCuradoria => {
    const r = db.prepare('SELECT estado FROM biblioteca_curadoria WHERE pacote=? AND item=? ORDER BY seq DESC LIMIT 1').get(pacote, item) as { estado: EstadoCuradoria } | undefined;
    return r?.estado ?? 'RASCUNHO';
  };
  const ativa = (): string | null => (db.prepare('SELECT pacote FROM biblioteca_ativacao ORDER BY seq DESC LIMIT 1').get() as { pacote: string } | undefined)?.pacote ?? null;
  const anteriorValida = (): string | null => {
    const registros = db.prepare('SELECT pacote FROM biblioteca_ativacao ORDER BY seq DESC').all() as { pacote: string }[];
    const atual = ativa();
    for (const {pacote:id} of registros) {
      if (id === atual) continue;
      try {
        const p = lerPacote(id), estados = new Map(listarCuradoriaAtual(db,id).map(r=>[r.item,r.estado]));
        const aprovada = (item:string) => ['CONSULTAVEL','ALERTA'].includes(estados.get(item) ?? 'RASCUNHO');
        if (p.itens.some(i=>aprovada(i.id)) && !p.itens.some(i=>aprovada(i.id) && i.dependencias.some(d=>!aprovada(d.id)))) return id;
      } catch { /* pacote inválido não é candidato ao rollback */ }
    }
    return null;
  };
  const ativar = (id: string, motivo: AtivacaoBiblioteca['motivo']): void => transacao(() => {
    const ator = autoridade(); const pacote = lerPacote(id);
    const curadoria = new Map(listarCuradoriaAtual(db,id).map(r=>[r.item,r.estado]));
    const estadoItem = (item:string) => curadoria.get(item) ?? "RASCUNHO";
    if (!pacote.itens.some(i => ['CONSULTAVEL', 'ALERTA'].includes(estadoItem(i.id)))) throw new Error('SEM_ITEM_APROVADO');
    for (const item of pacote.itens) {
      if (!['CONSULTAVEL', 'ALERTA'].includes(estadoItem(item.id))) continue;
      for (const dep of item.dependencias) if (!['CONSULTAVEL', 'ALERTA'].includes(estadoItem(dep.id))) throw new Error('DEPENDENCIA_NAO_APROVADA');
    }
    const anterior = ativa();
    if (anterior === id) return;
    db.prepare('INSERT INTO biblioteca_ativacao(pacote,anterior,motivo,ator,registrado_em) VALUES(?,?,?,?,?)').run(id, anterior, motivo, ator, agora());
    portas.emitir(db, { tipo: 'BIBLIOTECA_ATIVADA', biblioteca: { id: pacote.manifesto.id, versao: pacote.manifesto.versao }, anterior, motivo });
  });
  return {
    importarPacote(manifesto: unknown, lerArquivo: (arquivo: string) => string): string {
      const m = ManifestoBiblioteca.parse(manifesto);
      const bytes = Object.fromEntries(m.itens.map(ref => [ref.arquivo, lerArquivo(ref.arquivo)]));
      const pacote = validarConteudo(m, arquivo => bytes[arquivo] ?? '');
      const id = idPacote(pacote.manifesto);
      transacao(() => {
        const existente = db.prepare('SELECT id FROM biblioteca_pacote WHERE id=?').get(id);
        if (existente) throw new Error('VERSAO_DUPLICADA');
        const armazenado = JSON.stringify({ ...pacote, bytes });
        db.prepare('INSERT INTO biblioteca_pacote(id,conteudo,hash) VALUES(?,?,?)').run(id, armazenado, sha256Biblioteca(armazenado));
      });
      return id;
    },
    revisarItem(id: string, itemId: string, novo: Exclude<EstadoCuradoria, 'RASCUNHO'>): void {
      transacao(() => {
        const ator = autoridade(); const p = lerPacote(id);
        if (!['CONSULTAVEL', 'ALERTA', 'OBSOLETO'].includes(novo)) throw new Error('CURADORIA_INVALIDA');
        const item = p.itens.find(i => i.id === itemId);
        if (!item) throw new Error('ITEM_AUSENTE');
        if (novo === 'ALERTA' && item.tipo !== 'REGRA') throw new Error('REFERENCIA_NAO_GERA_ALERTA');
        db.prepare('INSERT INTO biblioteca_curadoria(pacote,item,estado,ator,registrado_em) VALUES(?,?,?,?,?)').run(id, itemId, novo, ator, agora());
      });
    },
    ativar(id: string): void { ativar(id, 'ATIVACAO'); },
    voltarAnterior(expectedAnterior?: string): void {
      const id = anteriorValida();
      if (expectedAnterior !== undefined && id !== expectedAnterior) throw new Error('BIBLIOTECA_REVISAO_DIVERGENTE');
      if (!id) throw new Error('SEM_VERSAO_ANTERIOR_VALIDA');
      ativar(id, 'ROLLBACK');
    },
    anteriorValida,
    ativa,
    estado,
    manifesto(id: string) { return structuredClone(lerPacote(id).manifesto); },
    listar(id: string) {
      const pacote = lerPacote(id);
      const curadoria = new Map(listarCuradoriaAtual(db,id).map(r=>[r.item,r]));
      return pacote.itens.map(item => {
        const r = curadoria.get(item.id);
        return { ...item, estado: r?.estado ?? 'RASCUNHO' as EstadoCuradoria,
          curadoria: r ? { ator: r.ator, registradoEm: r.registrado_em ?? null } : null };
      });
    },
    consultar(filtros: FiltrosBiblioteca, modo: 'CONSULTA' | 'ALERTA' = 'CONSULTA'): ConteudoBiblioteca[] {
      const id = ativa(); if (!id) return [];
      const p = lerPacote(id);
      const curadoria = new Map(listarCuradoriaAtual(db,id).map(r=>[r.item,r.estado]));
      const porId = new Map(p.itens.map(i=>[i.id,i]));
      const estadoItem = (item:string) => curadoria.get(item) ?? "RASCUNHO";
      const aprovada = (alvo: ConteudoBiblioteca): boolean => ['CONSULTAVEL', 'ALERTA'].includes(estadoItem(alvo.id)) &&
        alvo.dependencias.every(dep => { const d = porId.get(dep.id); return !!d && aprovada(d); });
      const aplicaveis = indexarAplicabilidade(p.itens)(filtros);
      return p.itens.filter(item => {
        const e = estadoItem(item.id);
        if (modo === 'ALERTA' ? e !== 'ALERTA' : !['CONSULTAVEL', 'ALERTA'].includes(e)) return false;
        if (!aprovada(item)) return false;
        return aplicaveis.has(item.id);
      });
    },
  };
}
