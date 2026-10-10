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
