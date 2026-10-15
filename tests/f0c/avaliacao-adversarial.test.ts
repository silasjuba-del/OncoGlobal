import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { avaliarConsulta, type EntradaAvaliacaoConsulta } from "../../src/server/f0c/avaliacaoConsulta.js";
import type { ClinicalEvent } from "../../src/contracts/operacao.js";
import { fonteSintetica, presente, triagemBase } from "../fixtures/triagem.js";
const paciente={patientId:"paciente-teste-01",nome:"Paciente sintético",identificadores:[],nascimento:"1970-01-01",sexoCadastral:"M" as const,divergencia:false};
const base:EntradaAvaliacaoConsulta={eventos:[],patientId:paciente.patientId,tumorLotId:null,encounterId:"encontro-teste-01",hoje:"2026-10-10",agora:"2026-10-10T12:00:00-03:00",paciente,ciclo:null,episodio:null,plaquetas:null,
 interacoes:JSON.parse(readFileSync("corpus/rulesets/interacoes.v1.json","utf8")),catalogo:JSON.parse(readFileSync("corpus/f0c/classes-farmacos.v1.json","utf8"))};
function evento(id:string,tipo:string,data:unknown):ClinicalEvent {return {eventId:id,operationId:`op-${id}`,eventIndex:0,patientId:base.patientId,encounterId:base.encounterId,tumorLotId:null,tipo,payload:{data},fontes:[fonteSintetica("fonte-medida")],revisao:"CONFIRMADO",criadoEm:"2026-10-10T10:00:00-03:00",criadoPor:{tipo:"SESSAO",id:"medico"},supersedesEventId:null};}
const lab=(id:string,campo:string,valor:number,data="2026-10-09T10:00:00-03:00",unidade="mmol/L")=>evento(id,"LabResult",{campo,valor,data,unidade,sourceId:"fonte-medida"});
describe("auditoria clínica adversarial da composição",()=>{
 it("preserva todas as fontes do envelope de um exame concordante",()=>{
  const e={...lab("multifonte","neutrofilos",2000,"2026-10-09T10:00:00-03:00","/uL"),fontes:[fonteSintetica("fonte-medida"),fonteSintetica("fonte-adicional")]};
  for(const c of avaliarConsulta({...base,eventos:[e]}).elegibilidade.criterios!.filter(c=>c.id.startsWith("neutrofilos.")))
   expect(c.fontes.map(f=>f.sourceId)).toEqual(["fonte-medida","fonte-adicional"]);
 });
 it("peso concordante preserva eventos e fontes sem eleger o primeiro",()=>{
  const pesos=["a","b"].map(id=>({...evento(`peso-${id}`,"Weight",{kg:50,origem:"MEDIDO",data:"2026-10-09",sourceId:"fonte-medida"}),fontes:[fonteSintetica("fonte-medida"),fonteSintetica(`fonte-${id}`)]}));
  for(const eventos of [pesos,[...pesos].reverse()]){
   const d=avaliarConsulta({...base,eventos}).dadosNutricionais;
   expect(d.pesoKg).toBe(50);
   expect((d as any).fontes).toEqual(expect.arrayContaining(pesos.flatMap(e=>e.fontes.map(f=>({eventId:e.eventId,sourceId:f.sourceId,medidoEm:"2026-10-09"})))));
  }
 });
 it.each([["neutrofilos",2000],["plaquetas",150000]] as const)("preserva fontes concordantes de %s nos critérios de limiar e validade",(campo,valor)=>{
  const data="2026-10-09T10:00:00-03:00";
  const exames=["a","b"].map(sufixo=>({...evento(`lab-${sufixo}`,"LabResult",{campo,valor,data,unidade:"/uL",sourceId:`fonte-${sufixo}`}),fontes:[fonteSintetica(`fonte-${sufixo}`)]}));
  const antigo=lab("antigo",campo,valor,"2026-10-08T10:00:00-03:00","/uL");
  for(const atuais of [exames,[...exames].reverse()]) {
   const r=avaliarConsulta({...base,eventos:[antigo,...atuais]});
   for(const sufixo of ["limiar","validade"]) {
    const criterio=r.elegibilidade.criterios?.find(c=>c.id===`${campo}.${sufixo}`);
    expect(criterio?.estado).toBe("ATENDE");
    expect(criterio?.fontes).toHaveLength(2);
    expect(criterio?.fontes).toEqual(expect.arrayContaining(exames.map(e=>({eventId:e.eventId,sourceId:e.fontes[0]!.sourceId,medidoEm:data}))));
   }
  }
 });
 it("critério reprovado não esconde plaquetas ausentes na porta do ciclo",()=>{
  const r=avaliarConsulta({...base,eventos:[lab("anc","neutrofilos",1000,"2026-10-09T10:00:00-03:00","/uL")]});
  expect(r.elegibilidade).toMatchObject({cor:"VERMELHO",criterios:expect.arrayContaining([
   expect.objectContaining({schema:"CriterioElegibilidade@1",id:"neutrofilos.limiar",estado:"NAO_ATENDE"}),
   expect.objectContaining({schema:"CriterioElegibilidade@1",id:"plaquetas.limiar",estado:"AUSENTE"}),
  ])});
 });
 it("Na146 atual gera aviso D06 mas não inventa emergência",()=>{
  const r=avaliarConsulta({...base,eventos:[lab("na","sodio",146)]});
  expect(r.criticos.find(c=>c.analito==="NA")?.estado).toBe("AVISO");
  expect(r.emergencia).toBe(false);expect(r.avisosFlash.some(a=>a.includes("146"))).toBe(true);
 });
 it("varfarina de uso + capecitabina do ciclo cruzam sem exigir cadastro duplicado",()=>{
  const ciclo={cicloId:"ciclo",episodioId:"episodio",numero:1,previstoEm:base.hoje,pesoKg:presente(70),origemPeso:"MEDIDO" as const,ciclosSemPesoConsecutivos:0,prescricaoRef:null,itens:[{item:1,droga:"capecitabina",doseMg:1000,reducaoPct:0 as const}],comMedico:true};
  const r=avaliarConsulta({...base,ciclo,eventos:[evento("med","FATO",{campo:"medicamentos",valor:["varfarina"]})]});
  expect(r.interacoes.estado).toBe("VERMELHO");expect(r.elegibilidade.cor).toBe("VERMELHO");
  expect(r.sugestoesLaboratorio).toContain("INR");
 });
 it("grau 0 RAW dentro de evento de Triagem confirmado não elimina pendência CTCAE",()=>{
  const triagem=triagemBase({grauCtcae:{...presente(0),estado:"PENDENTE",revisao:"RAW"}});
  const r=avaliarConsulta({...base,eventos:[evento("triagem","Triagem",triagem)]});
  expect(r.elegibilidade.motivos.some(m=>m.origem==="ctcae")).toBe(true);
 });
 it("grau confirmado sem dado longitudinal não é descrito como persistente",()=>{
  const r=avaliarConsulta({...base,eventos:[evento("triagem","Triagem",triagemBase({grauCtcae:presente(2)}))]});
  expect(r.avisosFlash.join(" ")).not.toMatch(/persistente/i);
 });
 it.each([
  ["coleta futura no mesmo dia",lab("futuro","potassio",7,"2026-10-10T15:00:00-03:00")],
  ["exame antigo",lab("antigo","potassio",7,"2026-09-01T10:00:00-03:00")],
  ["sourceId sem fonte correspondente",{...lab("sem-fonte","potassio",7),fontes:[fonteSintetica("outra-fonte")]}],
  ["sem horário",lab("civil","potassio",7,"2026-10-09")],
 ] satisfies Array<[string, ClinicalEvent]>)("%s não alimenta alerta de valor atual",(_nome,e)=>{
  const r=avaliarConsulta({...base,eventos:[e]});
  expect(r.criticos.find(c=>c.analito==="K")?.estado).toBe("PENDENTE");expect(r.emergencia).toBe(false);
 });
 it("creatinina sem fonte real não sustenta Cockcroft-Gault mesmo com peso válido",()=>{
  const peso=evento("peso","Weight",{kg:70,origem:"MEDIDO",data:"2026-10-09",sourceId:"fonte-medida"});
  const cr={...lab("cr","creatinina",1.0,"2026-10-09T10:00:00-03:00","mg/dL"),fontes:[]};
  expect(avaliarConsulta({...base,eventos:[peso,cr]}).renal.estado).toBe("PENDENTE");
 });
});

describe("horizonte do encontro e escopo do paciente (P1 PR #13)",()=>{
 it("peso e altura do paciente atravessam lotes tumorais sem herdar outro paciente",()=>{
  const peso={...evento("peso-a","Weight",{kg:70,origem:"MEDIDO",data:"2026-10-09",sourceId:"fonte-medida"}),tumorLotId:"lote-a"};
  const altura={...evento("altura-a","FATO",{campo:"alturaCm",valor:170}),tumorLotId:"lote-a"};
  const r=avaliarConsulta({...base,tumorLotId:"lote-b",eventos:[peso,altura,
   {...peso,eventId:"outro",patientId:"paciente-diferente",payload:{data:{kg:90,origem:"MEDIDO",data:"2026-10-10",sourceId:"fonte-medida"}}}]});
  expect(r.dadosNutricionais).toMatchObject({pesoKg:70,alturaCm:170});
 });
 it("lab de outro lote tumoral continua valendo para o paciente",()=>{
  const r=avaliarConsulta({...base,tumorLotId:"lote-b",eventos:[{...lab("na-lote-a","sodio",146),tumorLotId:"lote-a"}]});
  expect(r.criticos.find(c=>c.analito==="NA")?.estado).toBe("AVISO");
 });
 it("encontro antigo reaberto não usa lab registrado em encontro posterior",()=>{
  const antigo={...evento("abertura-antiga","FATO",{campo:"observacao",valor:"x"}),criadoEm:"2026-10-01T10:00:00-03:00"};
  const posterior={...lab("na-posterior","sodio",146,"2026-10-09T10:00:00-03:00"),encounterId:"encontro-posterior",criadoEm:"2026-10-09T11:00:00-03:00"};
  const r=avaliarConsulta({...base,eventos:[antigo,posterior]});
  expect(r.criticos.find(c=>c.analito==="NA")?.estado).toBe("PENDENTE");
  const atual=avaliarConsulta({...base,encounterId:"encontro-posterior",eventos:[antigo,posterior]});
  expect(atual.criticos.find(c=>c.analito==="NA")?.estado).toBe("AVISO");
 });
});
