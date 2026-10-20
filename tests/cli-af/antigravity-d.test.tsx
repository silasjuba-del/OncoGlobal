// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import { montarLoteCompleto } from '../../src/kernel/corpus/loteCompleto.js';
import { LoteTumoralCompleto } from '../../src/ui/consulta/LoteTumoralCompleto.js';

afterEach(cleanup);
it('os cinco itens APAC/SIGTAP dos dois packs ficam somente em documentos, com fonte literal', () => {
  let total=0;
  for (const tumor of ['mieloma','linfoma-folicular']) {
    const arquivo=`corpus/6-pack-tumor/${tumor}/pack-${tumor}.v2.RASCUNHO.json`;
    const raw=readFileSync(arquivo,'utf8'), original=JSON.parse(raw);
    const hash=createHash('sha256').update(raw).digest('hex');
    const lote=montarLoteCompleto(original,arquivo,hash);
    const itens=lote.setores.flatMap(s=>s.itens).filter(i=>i.localizador.startsWith('/tratamento/apacSigtap/'));
    total+=itens.length;
    expect(itens.map(i=>i.conteudo)).toEqual(original.tratamento.apacSigtap);
    expect(itens.every(i=>i.setor==='documentos')).toBe(true);
    expect(itens.map(i=>i.localizador)).toEqual(original.tratamento.apacSigtap.map((_:unknown,i:number)=>`/tratamento/apacSigtap/${i}`));
    expect(lote.conteudoIntegral).toEqual(original);
    expect(lote.original).toEqual({arquivo,sha256:hash,versao:original.header.versao});
    expect(lote.autorizaTratamento).toBe(false);
    expect(lote.setores.find(s=>s.id==='tratamento')!.itens.filter(i=>i.localizador.startsWith('/tratamento/protocolos/')).map(i=>i.conteudo)).toEqual(original.tratamento.protocolos);
  }
  expect(total).toBe(5);
});

it('preserva versões repetidas, metadado APAC do protocolo e texto malicioso na interface real', () => {
  const original={header:{id:'sintetico',versao:'1'},identidade:{tumor:'Tumor sintético',cid10:['C50']},tratamento:{
    protocolos:[{nome:'PROTOCOLO_APAC_SINTETICO',sus:{apac:'METADADO_PRESERVADO'}}],
    apacSigtap:[{nome:'APAC_REPETIDA',versao:'1'},{nome:'APAC_REPETIDA',versao:'2'},{nome:'<script>APAC_DADO</script>'}],
    futuro:[{nome:'OPCAO_DESCONHECIDA'}]},'futuro/~':{texto:'preservado'}};
  const before=structuredClone(original),lote=montarLoteCompleto(original,'sintetico.json','a'.repeat(64));
  expect(lote.setores.find(s=>s.id==='documentos')!.itens).toHaveLength(3);
  expect(lote.setores.find(s=>s.id==='tratamento')!.itens.map(i=>i.titulo)).toEqual(['PROTOCOLO_APAC_SINTETICO','OPCAO_DESCONHECIDA']);
  expect(lote.setores.flatMap(s=>s.itens).find(i=>i.localizador==='/futuro~1~0')!.conteudo).toEqual(original['futuro/~']);
  const {container}=render(<LoteTumoralCompleto lote={lote}/>);
  for(const value of ['primeira','retorno','seguimento']) {
    fireEvent.change(screen.getByLabelText('Momento da consulta'),{target:{value}});
    const item=screen.getAllByText('APAC_REPETIDA')[0]!;
    const setor=item.closest('details')!.parentElement!;
    expect(within(setor).getAllByText('APAC_REPETIDA')).toHaveLength(2);
    expect(within(setor).queryByText('PROTOCOLO_APAC_SINTETICO')).toBeNull();
    expect(screen.getByText('<script>APAC_DADO</script>')).toBeTruthy();
  }
  expect(container.querySelector('script')).toBeNull();
  expect(lote.conteudoIntegral).toEqual(before);
  expect(original).toEqual(before);
});
