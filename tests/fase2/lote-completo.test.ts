import {readFileSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {expect,it} from 'vitest';
import {carregarPacksTumor} from '../../src/kernel/corpus/tumorPacks.js';
import {montarLoteCompleto} from '../../src/kernel/corpus/loteCompleto.js';
import {SETORES_PACK} from '../../src/contracts/fase2/loteCompleto.js';
const raiz=resolve('.'),catalogo=carregarPacksTumor(raiz);
const arquivos=readdirSync(join(raiz,'corpus/6-pack-tumor'),{recursive:true}).filter((f):f is string=>typeof f==='string'&&/pack-.+\.v2\..+\.json$/.test(f));
it('todos os packs originais têm lote completo, sem rejeição nem promoção clínica',()=>{
 expect(arquivos.length).toBeGreaterThanOrEqual(35);expect(catalogo.rejeitados).toEqual([]);
 expect(Object.keys(catalogo.lotes??{})).toHaveLength(arquivos.length);
 expect(catalogo.packs.every(p=>p.estado!=='ATIVO')).toBe(true);
});
it.each(arquivos)('preserva fonte integral, protocolos, conflitos e todos os itens universais: %s',arquivo=>{
 const bruto=readFileSync(join(raiz,'corpus/6-pack-tumor',arquivo),'utf8'),p=JSON.parse(bruto);
 const l=catalogo.lotes![`${p.header.id}-extract`]!;expect(l).toBeDefined();
 expect(l.conteudoIntegral).toEqual(p);expect(l.original.sha256).toBe(createHash('sha256').update(bruto).digest('hex'));
 expect(l.setores.map(s=>s.id)).toEqual([...SETORES_PACK]);expect(l.autorizaTratamento).toBe(false);
 const itens=l.setores.flatMap(s=>s.itens);
 const protocolos=itens.filter(i=>/^\/tratamento\/protocolos\/\d+$/.test(i.localizador));
 expect(protocolos.map(i=>i.conteudo)).toEqual(p.tratamento?.protocolos??[]);
 expect(l.protocolosLegados).toBe(protocolos.length);
 const nccn=itens.filter(i=>/^\/tumor_pack_universal\/itens_nccn\/\d+$/.test(i.localizador));
 expect(nccn.map(i=>i.conteudo).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))))
  .toEqual([...(p.tumor_pack_universal?.itens_nccn??[])].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
 expect(l.itensUniversais).toBe(nccn.length);
});
it('preserva esquemas antigos, campos desconhecidos e disponibilidade literal sem inventar acesso',()=>{
 const p={header:{id:'teste',versao:'1'},identidade:{tumor:'Teste',cid10:['C18'],cenarios:['metastático']},
  tratamento:{protocolos:[{id:'mayo',nome:'Mayo',sus:{disponivel:'sim'}},{id:'roswell',nome:'Roswell Park'}]},conflitos:[{texto:'A CONFERIR'}],campoFuturo:{valor:0}};
 const l=montarLoteCompleto(p,'teste.json','a'.repeat(64));expect(l.conteudoIntegral).toEqual(p);
 expect(l.setores.find(s=>s.id==='tratamento')?.itens.map(i=>i.titulo)).toEqual(['Mayo','Roswell Park']);
 expect(l.setores.find(s=>s.id==='complementos')?.itens.some(i=>i.localizador==='/campoFuturo')).toBe(true);
 expect(JSON.stringify(l)).not.toContain('INCORPORADO');
});
