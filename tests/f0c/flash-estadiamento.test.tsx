// @vitest-environment jsdom
import { expect, it } from "vitest";
import { montarPropsFlash, selecionarEstadiamentoFlash } from "../../src/ui/consulta/flashDaVisao.js";
import { criarPortaFalsa, ID } from "../../src/ui/api/fake.js";
import { fonteSintetica } from "../fixtures/triagem.js";
const est = (id:string, data:string, grupo:string, ativo=false) => ({estadiamentoId:id,sistema:"AJCC" as const,edicao:"8",prefixo:"p" as const,T:"T3",N:"N1",M:"M0",grupo,data,fontes:[fonteSintetica()],usoAtivo:ativo ? ["PROTOCOLO" as const] : []});
it("prioriza uso ativo único; múltiplos ativos são pendência",()=>{
 const velho=est("antigo","2026-01-01","III",true),novo=est("novo","2026-10-01","IV");
 expect(selecionarEstadiamentoFlash([novo,velho])).toBe(velho);
 expect(selecionarEstadiamentoFlash([velho,{...novo,usoAtivo:["PROTOCOLO"]}])).toBeUndefined();
});
it("sem ativo usa mais recente; divergência na mesma data permanece pendente",()=>{
 const velho=est("antigo","2026-01-01","III"),novo=est("novo","2026-10-01","IV");
 expect(selecionarEstadiamentoFlash([velho,novo])).toBe(novo);
 expect(selecionarEstadiamentoFlash([novo,{...novo,grupo:"II"}])).toBeUndefined();
});
it("adapta TNM com valores do contrato sem duplicar T/N/M e sem tomar outro lote",async()=>{
 const v=await criarPortaFalsa().carregarConsulta(ID.multi);
 const lote=v.cabecalho.lotes[0]!;
 const atual={...v,tumorLotId:lote.tumorLotId,cabecalho:{...v.cabecalho,loteSelecionadoId:lote.tumorLotId,lotes:[{...lote,estadiamentos:[est("est-teste","2026-10-01","III",true)]}]}};
 expect(montarPropsFlash(atual,null,()=>{},()=>{}).cabecalho).toMatchObject({tnm:"pT3N1M0",estadio:"III"});
 expect(montarPropsFlash({...atual,tumorLotId:"lote-inexistente"},null,()=>{},()=>{}).cabecalho.tnm).toBeUndefined();
});
