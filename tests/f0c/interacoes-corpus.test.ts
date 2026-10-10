import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { semaforoInteracoes } from '../../src/rules/semaforoInteracoes.js';
import { avaliarInteracaoMedicamentosa } from '../../src/rules/w8/interacoes.js';
import { identidadeFarmaco, type CatalogoInteracoes } from '../../src/contracts/f0c/interacoes.js';
const rs=JSON.parse(readFileSync('corpus/rulesets/interacoes.v1.json','utf8'));
const catalogo=JSON.parse(readFileSync('corpus/f0c/classes-farmacos.v1.json','utf8')) as CatalogoInteracoes;
const estado=(a:string,b:string)=>semaforoInteracoes({medicamentos:[a,b]},rs,catalogo);
const novos=rs.interacoes.filter((r:{regraId?:string})=>r.regraId?.startsWith('F0C-INT-'));
describe('biblioteca documental de interações F0-COMPLEMENTO',()=>{
 it.each([
  ['capecitabina','warfarin'],['capecitabine','phenytoin'],['irinotecan','rifampicin'],['irinotecano','clarithromycin'],
  ['docetaxel','ritonavir'],['cisplatin','gentamicina IV'],['metotrexato','SMX-TMP'],['MTX','ibuprofen'],
 ])('par sustentado%s × %s avisa sem bloquear e funciona em ambas ordens',(a,b)=>{
  expect(estado(a,b)).toMatchObject({estado:'VERMELHO',bloqueiaSalvar:false});
  expect(estado(b,a).estado).toBe('VERMELHO');
  expect(avaliarInteracaoMedicamentosa(a,b,rs,catalogo)).toMatchObject({estado:'VERMELHO',regraAtiva:true});
 });
 it.each([
  ['paclitaxel','ritonavir'],['nab-paclitaxel','ritonavir'],['irinotecano lipossomal','ritonavir'],
  ['carboplatina','gentamicina IV'],['cisplatina','gentamicina tópica'],['cisplatina','vancomicina'],
  ['docetaxel','cetoconazol tópico'],['MTX','paracetamol'],['5-FU','fenitoína'],
  ['capecitabina-desconhecida','varfarina'],
 ])('não extrapola classe/formulação nem usa substring em%s × %s',(a,b)=>{
  expect(estado(a,b).estado).toBe('PENDENTE');
 });
 it.each([
  ['5-FU','brivudina'],['pemetrexede','ibuprofeno'],['pemetrexede','naproxeno'],
  ['doxorrubicina','trastuzumabe'],['capecitabina','vacina febre amarela'],
  ['capecitabina','vacina zoster recombinante'],
 ])('sem janela/exposição não inventa certeza em%s × %s',(a,b)=>expect(estado(a,b).estado).toBe('PENDENTE'));
 it('preserva34 legados e cobre documentalmente11 grupos com limites identificados',()=>{
  expect(rs.interacoes.filter((r:{regraId?:string})=>!r.regraId)).toHaveLength(34);
  expect(novos).toHaveLength(11);
  expect(rs.coberturaF0.gruposPrevistos).toBe(11);
  expect(novos.filter((r:{ativo:boolean})=>!r.ativo)).toHaveLength(4);
  for(const r of novos){
   expect(r.fonte.referencia).toMatch(/^https:\/\/(?:dailymed\.nlm\.nih\.gov|www\.ema\.europa\.eu|www\.cdc\.gov)\//);
   expect(r.fonte.trecho.trim()).not.toBe('');expect(r.fonte.edicao.trim()).not.toBe('');
   if(!r.ativo)expect(r.motivoInativo.trim()).not.toBe('');
  }
 });
 it('citações novas ficam limitadas a25 palavras por fonte, somadas entre registros',()=>{
  const palavras=new Map<string,number>();
  for(const r of novos)palavras.set(r.fonte.referencia,(palavras.get(r.fonte.referencia)??0)+r.fonte.trecho.trim().split(/\s+/).length);
  for(const n of palavras.values())expect(n).toBeLessThanOrEqual(25);
 });
 it('todos os membros declarados têm identidade explícita e aliases não ambíguos',()=>{
  for(const membros of Object.values(catalogo.classes))for(const nome of membros){
    expect(Object.keys(catalogo.aliases)).toContain(nome);expect(identidadeFarmaco(nome,catalogo)).not.toBe('');
  }
  for(const nomes of Object.values(catalogo.aliases))for(const nome of nomes)expect(identidadeFarmaco(nome,catalogo)).not.toBe('');
 });
});
