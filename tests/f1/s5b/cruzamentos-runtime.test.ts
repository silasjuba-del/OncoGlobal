import { createHash } from "node:crypto";
import { reconciliar } from "../../../src/modules/reconciliador/index.js";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { criarCruzamentosMotor } from "../../../src/kernel/corpus/cruzamentos.js";
import type { Retrato,FatoRetrato } from "../../../src/contracts/f1/retrato.js";
import type { ContextoInteracoesCondicionadas } from "../../../src/contracts/f0c/interacoesCondicionadas.js";
import type { RulesetInteracoes } from "../../../src/rules/w8/interacoes.js";
import { fonteSintetica } from "../../fixtures/triagem.js";
const agora="2026-10-10T12:00:00-03:00";
const bytes=readFileSync("corpus/rulesets/interacoes.v1.json","utf8");
const regras=JSON.parse(bytes) as RulesetInteracoes;
const catalogo=JSON.parse(readFileSync("corpus/f0c/classes-farmacos.v1.json","utf8"));
const referencia={id:regras.header!.id,versao:regras.header!.versao,hash:createHash("sha256").update(bytes).digest("hex")};
const opcoes={interacoes:{referencia,status:"CONFERIDA_MEDICO" as const,fonte:"corpus/rulesets/interacoes.v1.json",conteudo:regras}};
const contexto:ContextoInteracoesCondicionadas={versao:1,referencia:agora,offsetServico:"-03:00",medicamentosAtuais:["pemetrexede","ibuprofeno"],reconciliacao:{confirmada:true,em:agora,fonte:"reconciliacao"},historicoConferido:true,exposicoesCompletas:true,
 exposicoes:[{droga:"pemetrexede",formulacao:"SISTEMICA_CONVENCIONAL",ultimaDose:null,proximaDose:agora,termino:null,fonte:"pemetrexede"},{droga:"ibuprofeno",formulacao:"SISTEMICA_CONVENCIONAL",ultimaDose:"2026-10-09T12:00:00-03:00",proximaDose:null,termino:null,fonte:"ibuprofeno"}],coadministracoes:[],clearance:{valorMlMin:55,metodo:"COCKCROFT_GAULT",coleta:"2026-10-09T12:00:00-03:00",fonte:"renal",validoParaDose:true},vacinas:[],quimioterapia:null,recuperacaoImune:null};
function f(id:string,campo:string,dados:Record<string,unknown>,fontes:string[]):FatoRetrato{return{ref:{eventId:id,revisao:`revisao-${id}`},tipo:"FATO",campo,patientId:"p",encounterId:"e",tumorLotId:"l",escopo:"PACIENTE",tempoClinico:"2026-10-09",tempoRegistro:agora,fontes:fontes.map(fonteSintetica),dados:{campo,...dados}};}
const renal=f("renal","clearance",{valor:contexto.clearance},["renal"]),interacoes=f("ctx","interacoesContexto",{valor:contexto},["reconciliacao","pemetrexede","ibuprofeno"]);
const retrato:Retrato={schema:"Retrato@1",patientId:"p",encounterId:"e",tumorLotId:"l",revisao:"R1",versaoProjecao:"1",geradoEm:agora,regras:[referencia],biblioteca:{id:"biblioteca",versao:"1",hash:"bib"},fatos:[renal,interacoes],integridade:[],delta:{encounterAnteriorId:null,novos:[],substituidos:[]},resumo:[]};
it("cruzamento reutiliza regra condicionada existente e liga dois fatos e versão sem alterar retrato",()=>{
 const callbacks=criarCruzamentosMotor(opcoes,catalogo);expect(callbacks).toHaveLength(1);
 expect(regras.interacoes.find(r=>"regraId" in r&&r.regraId==="F0C-INT-08")?.severidade).toBeNull();
 const antes=structuredClone(retrato);const achados=callbacks[0]!.avaliar(retrato,[]);
 expect(achados).toHaveLength(1);expect(achados[0]).toMatchObject({estado:"PENDENTE",setores:["LABORATORIO","INTERACOES"],regras:[referencia]});
 expect(achados[0]?.texto).toContain("Aviso condicionado");
 expect(achados[0]?.fatos).toEqual([interacoes.ref,renal.ref]);expect(retrato).toEqual(antes);
});
it("creatinina isolada não vira ClCr; ausência ou fonte divergente não vira contraindicação",()=>{
 const callback=criarCruzamentosMotor(opcoes,catalogo)[0]!;
 expect(callback.avaliar({...retrato,fatos:[interacoes]},[])).toEqual([]);
 expect(callback.avaliar({...retrato,fatos:[interacoes,f("cr","creatinina",{valor:2,unidade:"mg/dL"},["renal"])]},[])).toEqual([]);
 expect(callback.avaliar({...retrato,fatos:[interacoes,{...renal,fontes:[fonteSintetica("outra")]}]},[])).toEqual([]);
});
it("contexto antigo, outra identidade ou regra não vigente não cria achado cruzado",()=>{
 const callback=criarCruzamentosMotor(opcoes,catalogo)[0]!;
 expect(callback.avaliar({...retrato,fatos:[renal,{...interacoes,encounterId:"antigo"}]},[])).toEqual([]);
 expect(callback.avaliar({...retrato,fatos:[interacoes,{...renal,patientId:"outro"}]},[])).toEqual([]);
 expect(callback.avaliar({...retrato,regras:[]},[])).toEqual([]);
});

it("callback compõe visão real do reconciliador com regra e fatos atuais; ausência mantém cobertura sem achado",()=>{
 const correlacao={patientId:"p",encounterId:"e",tumorLotId:"l",operationId:"op",revisaoFatos:retrato.revisao,regras:[referencia],biblioteca:retrato.biblioteca,proposta:null};
 const resultados=(["LABORATORIO","INTERACOES"] as const).map(setor=>({id:setor,resultado:"ok" as const,tentativas:1,saida:{schema:"AchadosSetor@1",setor,correlacao,entradas:retrato.fatos.map(f=>f.ref),cobertura:{avaliados:1,semRegraAprovada:0},achados:[],lacunas:[]}}));
 const visao=reconciliar(resultados,retrato,correlacao,["LABORATORIO","INTERACOES"],criarCruzamentosMotor(opcoes,catalogo));
 expect(visao.achados).toHaveLength(1);expect(visao.achados[0]?.regras).toEqual([referencia]);expect(visao.achados[0]?.fatos).toHaveLength(2);
 const semRenal={...retrato,fatos:[interacoes],revisao:"R2"};
 const rs=resultados.map(r=>({...r,saida:{...r.saida,correlacao:{...correlacao,revisaoFatos:"R2"},entradas:[interacoes.ref],lacunas:r.id==="LABORATORIO"?[{codigo:"DADO_RENAL_AUSENTE",texto:"Clearance confirmado ausente",setor:"LABORATORIO",fatos:[]}]:[]}}));
 const pendente=reconciliar(rs,semRenal,{...correlacao,revisaoFatos:"R2"},["LABORATORIO","INTERACOES"],criarCruzamentosMotor(opcoes,catalogo));
 expect(pendente.achados).toEqual([]);expect(pendente.lacunas.some(l=>l.codigo==="DADO_RENAL_AUSENTE")).toBe(true);
});
it("discordância de dados renais, validade ausente ou contexto ambíguo não escolhe fato conveniente",()=>{
 const callback=criarCruzamentosMotor(opcoes,catalogo)[0]!;
 expect(callback.avaliar({...retrato,fatos:[interacoes,renal,{...renal,ref:{eventId:"renal-divergente",revisao:"outra"},dados:{campo:"clearance",valor:{...contexto.clearance,valorMlMin:60}}}]},[])).toEqual([]);
 expect(callback.avaliar({...retrato,fatos:[renal,interacoes,{...interacoes,ref:{eventId:"ctx-duplicado",revisao:"outra"}}]},[])).toEqual([]);
 const c={...contexto,clearance:{...contexto.clearance!,validoParaDose:false}};
 expect(callback.avaliar({...retrato,fatos:[renal,{...interacoes,dados:{campo:"interacoesContexto",valor:c}}]},[])).toEqual([]);
});
