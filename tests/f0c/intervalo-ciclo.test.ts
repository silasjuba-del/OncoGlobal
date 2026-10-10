import {describe,expect,it} from "vitest";
import {avaliarIntervaloCiclo} from "../../src/rules/f0c/intervaloCiclo.js";
import {projetarIntervaloCiclo} from "../../src/server/f0c/intervaloCiclo.js";
import type {ClinicalEvent} from "../../src/contracts/operacao.js";
import {ausente,fonteSintetica} from "../fixtures/triagem.js";
import {item,template} from "../rules-prescricao/_fixtures.js";
const base={patientId:"paciente",encounterId:"consulta",tumorLotId:"lote",agora:"2026-10-10T12:00:00-03:00",hoje:"2026-10-10"};
const ep={episodioId:"ep",tumorLotId:"lote",modalidade:"QT",intencao:"ADJUVANTE",intentModifier:null,linha:1,esquemaId:"ficha",inicio:ausente(),fim:ausente()};
const ci={cicloId:"c2",episodioId:"ep",numero:2,previstoEm:"2026-10-10",pesoKg:ausente(),origemPeso:null,ciclosSemPesoConsecutivos:0,prescricaoRef:null,itens:[],comMedico:true};
const anterior={...ci,cicloId:"c1",numero:1,previstoEm:"2026-09-01"};
function e(id:string,tipo:string,data:unknown,extra:Partial<ClinicalEvent>={}):ClinicalEvent {return {eventId:id,operationId:id,eventIndex:0,patientId:base.patientId,encounterId:base.encounterId,tumorLotId:base.tumorLotId,tipo,payload:{data},fontes:[fonteSintetica(id)],revisao:"CONFIRMADO",criadoEm:base.agora,criadoPor:{tipo:"SESSAO",id:"medico"},supersedesEventId:null,...extra};}
const ficha={...template([item({drug:"droga-sintetica"})]),templateId:"ficha",intervaloDias:21};
const eventos=()=>[e("ep","TreatmentEpisode",ep),e("ci","Ciclo",ci),e("ant","Ciclo",anterior)];
const ancora=(data="2026-09-19")=>e("inicio","FATO",{campo:"inicioCicloEfetivo",valor:data,cicloId:"c1",episodioId:"ep"});
const entrada=()=>({...base,episodio:ep,ciclo:ci,templates:[ficha],eventos:[...eventos(),ancora()]});
describe("intervalo nominal sem inferir início de ciclo",()=>{
 it.each([["2026-10-09","AVISO",true,0],["2026-10-10","SEM_AVISO",false,0],["2026-10-12","AVISO",false,2]] as const)("data %s compara dias civis sem tolerância",(data,estado,antes,atraso)=>{
  expect(avaliarIntervaloCiclo({inicioAnterior:"2026-09-19",dataProxima:data,intervaloDias:21})).toMatchObject({estado,antesDoPrevisto:antes,atrasoDias:atraso,condutaAutomatica:false,consultaSegue:true});
 });
 it("data inválida ou ordem invertida é pendência",()=>{
  expect(avaliarIntervaloCiclo({inicioAnterior:"2026-02-30",dataProxima:"2026-03-10",intervaloDias:21}).estado).toBe("PENDENTE");
  expect(avaliarIntervaloCiclo({inicioAnterior:"2026-10-10",dataProxima:"2026-10-09",intervaloDias:21}).estado).toBe("PENDENTE");
 });
 it("usa início real com fonte e ficha exata curada",()=>{
  const r=projetarIntervaloCiclo(entrada());expect(r.estado).toBe("SEM_AVISO");expect(r.diasObservados).toBe(21);
  expect(r.fontes.eventIds).toEqual(["inicio"]);expect(r.templateRef?.id).toBe("ficha");
 });
 it("não transforma previstoEm ou última administração D3 em início real",()=>{
  const r=projetarIntervaloCiclo({...entrada(),eventos:[...eventos(),e("d3","TreatmentAdministration",{cicloId:"c1",inicio:"2026-09-21T08:00:00-03:00"})]});
  expect(r.estado).toBe("PENDENTE");expect(r.diasObservados).toBeNull();
 });
 it("âncora de outro paciente, episódio ou RAW não conta",()=>{
  for(const ev of [{...ancora(),patientId:"outro"},{...ancora(),revisao:"RAW" as const},e("outroep","FATO",{campo:"inicioCicloEfetivo",valor:"2026-09-19",cicloId:"c1",episodioId:"ep-errado"})])
   expect(projetarIntervaloCiclo({...entrada(),eventos:[...eventos(),ev]}).estado).toBe("PENDENTE");
 });
 it("duas datas de início conflitantes ou ficha não curada não elegem valor",()=>{
  expect(projetarIntervaloCiclo({...entrada(),eventos:[...eventos(),ancora(),{...ancora("2026-09-20"),eventId:"conflito"}]}).estado).toBe("PENDENTE");
  expect(projetarIntervaloCiclo({...entrada(),templates:[{...ficha,status:"RASCUNHO"}]}).estado).toBe("PENDENTE");
  expect(projetarIntervaloCiclo({...entrada(),templates:[ficha,{...ficha,versao:"outra"}]}).estado).toBe("PENDENTE");
 });
 it("C1 torna apenas intervalo entre ciclos não aplicável, sem afirmar exposição passada",()=>{
  const r=projetarIntervaloCiclo({...entrada(),ciclo:anterior,eventos:[e("ep","TreatmentEpisode",ep),e("ci","Ciclo",anterior)]});
  expect(r).toMatchObject({estado:"SEM_AVISO",aplicavel:false,diasObservados:null});
 });
});
