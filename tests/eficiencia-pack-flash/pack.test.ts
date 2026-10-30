import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { carregarPacksTumor } from '../../src/kernel/corpus/tumorPacks.js';
import { compactarRevisaoClinica, lerFontePack } from '../../src/server/leituraPack.js';
import { RevisaoClinicaResposta } from '../../src/contracts/fase2/revisaoClinica.js';
import { LotePackLeitura, ResumoPack } from '../../src/contracts/fase2/leituraPack.js';
import { fixturePack } from './fixtures.js';

it('compactação preserva variantes de mesmo nome, conflitos, fontes e objeto original', () => {
  const f = fixturePack(), antes = JSON.stringify(f.resposta), r = compactarRevisaoClinica(f.resposta);
  expect(RevisaoClinicaResposta.safeParse(r).success).toBe(true);
  expect(r.loteCompleto?.setores).toEqual(f.lote.setores);
  expect(r.loteCompleto?.setores.find(s => s.id === 'tratamento')?.itens).toHaveLength(2);
  expect(r.pack).not.toHaveProperty('blocos'); expect(r.loteCompleto).not.toHaveProperty('conteudoIntegral');
  expect(JSON.stringify(f.resposta)).toBe(antes);
  expect(lerFontePack(f.catalogo, f.pedido).conteudoIntegral).toEqual(f.original);
  expect(compactarRevisaoClinica({ ...f.resposta, loteCompleto: null }).pack).toBe(f.pack);
});
it('transporte compacto não aceita ativação sem revisão nem setor/ID adulterado', () => {
  const r = compactarRevisaoClinica(fixturePack().resposta);
  expect(ResumoPack.safeParse({ ...r.pack, estado: 'ATIVO', revisaoClinica: null }).success).toBe(false);
  expect(LotePackLeitura.safeParse({ ...r.loteCompleto, setores: [] }).success).toBe(false);
  const l = structuredClone(r.loteCompleto!); const setor = l.setores.find(s => s.itens.length)!;
  setor.itens.push(setor.itens[0]!);
  expect(LotePackLeitura.safeParse(l).success).toBe(false);
});
it('fonte não admite ID inexistente, hash antigo ou associação pack/original divergente', () => {
  const f = fixturePack();
  expect(() => lerFontePack(f.catalogo, { ...f.pedido, packId: '../segredo' })).toThrow('FONTE_PACK_INDISPONIVEL');
  expect(() => lerFontePack(f.catalogo, { ...f.pedido, hashOriginal: 'b'.repeat(64) })).toThrow('FONTE_PACK_ALTERADA');
  f.lote.original.arquivo = 'outro.json';
  expect(() => lerFontePack(f.catalogo, f.pedido)).toThrow('FONTE_PACK_ALTERADA');
});
it('todo o corpus conserva conteúdo e reduz transporte sem excluir protocolos', () => {
  const c = carregarPacksTumor(process.cwd()); expect(c.rejeitados).toEqual([]);
  let antes = 0, depois = 0, protocolos = 0;
  for (const pack of c.packs) {
    const lote = c.lotes![pack.referencia.id]!;
    const full = { ...fixturePack().resposta, pack, loteCompleto: lote };
    const r = compactarRevisaoClinica(full);
    expect(r.loteCompleto?.setores).toEqual(lote.setores);
    expect(lerFontePack(c, { ...full.contexto, packId: pack.referencia.id, hashOriginal: pack.original.hash }).conteudoIntegral)
      .toEqual(JSON.parse(readFileSync(pack.original.arquivo, 'utf8')));
    antes += Buffer.byteLength(JSON.stringify(full)); depois += Buffer.byteLength(JSON.stringify(r));
    protocolos += lote.protocolosLegados;
  }
  expect(c.packs.length).toBeGreaterThanOrEqual(35); expect(protocolos).toBeGreaterThanOrEqual(682);
  expect(depois).toBeLessThan(antes * .55);
  console.log(JSON.stringify({ packs: c.packs.length, protocolos, bytesAntes: antes, bytesDepois: depois, reducao: 1 - depois / antes }));
});
