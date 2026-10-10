import { describe, expect, it } from "vitest";
import type { ClinicalEvent } from "../../src/contracts/operacao.js";
import { coletarFontesSalao } from "../../src/server/f0c/salao.js";
import { fonteSintetica, presente } from "../fixtures/triagem.js";
import { hashConteudoExibido } from "../../src/server/sessao.js";
const entrada={patientId:"paciente-sintetico",encounterId:"consulta-sintetica",hoje:"2026-10-10",agora:"2026-10-10T12:00:00-03:00"};
function evento(id:string,tipo:string,data:unknown):ClinicalEvent {
 return {eventId:id,operationId:`op-${id}`,eventIndex:0,patientId:entrada.patientId,encounterId:entrada.encounterId,tumorLotId:null,tipo,payload:{data},fontes:[fonteSintetica("fonte-cr")],revisao:"CONFIRMADO",criadoEm:"2026-10-10T10:00:00-03:00",criadoPor:{tipo:"SESSAO",id:"medico-sintetico"},supersedesEventId:null};
}
const cr=(id:string,valor=1.2,data="2026-10-09T10:00:00-03:00",unidade="mg/dL")=>evento(id,"LabResult",{campo:"creatinina",valor,data,unidade,sourceId:"fonte-cr"});
describe("fontes salão readonly",()=>{
 it("seleciona creatinina válida do paciente com proveniência e PAD FATO confirmado",()=>{
  const eventos=[cr("cr"),{...cr("outro",9),patientId:"outro"},evento("pad","FATO",{campo:"pad",valor:80})];
  const antes=JSON.stringify(eventos); const r=coletarFontesSalao({...entrada,eventos});
  expect(r.creatininaCentesimos).toBe(120);expect(r.pad).toBe(80);expect(r.fontes.creatinina).toEqual(["cr"]);
  expect(JSON.stringify(eventos)).toBe(antes);
 });
 it("conflito mesma coleta não escolhe valor conveniente nem usa coleta antiga",()=>{
  const r=coletarFontesSalao({...entrada,eventos:[cr("a",1.2),cr("b",2.5),cr("antiga",0.8,"2026-10-08T10:00:00-03:00")]});
  expect(r.creatininaCentesimos).toBeNull();expect(r.avisos).toContain("CREATININA_CONFLITANTE_NA_MESMA_COLETA");
 });
 it.each([cr("zero",0),cr("unidade",100,undefined,"µmol/L"),{...cr("fonte"),fontes:[]},cr("vencida",1,"2026-10-01T10:00:00-03:00")])("valor/unidade/fonte/vencimento inválidos não entram no corte",e=>{
  expect(coletarFontesSalao({...entrada,eventos:[e]}).creatininaCentesimos).toBeNull();
 });
 it("sem horário mantém observação e aviso, nunca promove valor a atual",()=>{
  const r=coletarFontesSalao({...entrada,eventos:[cr("dia",1.2,"2026-10-09")]});
  expect(r.creatininaCentesimos).toBeNull();expect(r.creatininaObservada?.valor).toBe(1.2);
  expect(r.avisos.some(a=>a.startsWith("CREATININA_VALIDADE_PENDENTE"))).toBe(true);
 });
 it("PAD de outra consulta, fonte ausente ou divergente permanece ausente",()=>{
  const anterior={...evento("anterior","FATO",{campo:"pad",valor:70}),encounterId:"consulta-anterior"};
  expect(coletarFontesSalao({...entrada,eventos:[anterior]}).pad).toBeNull();
  const r=coletarFontesSalao({...entrada,eventos:[evento("p1","FATO",{campo:"pad",valor:80}),evento("p2","FATO",{campo:"pad",valor:100})]});
  expect(r.pad).toBeNull();expect(r.avisos).toContain("PAD_INVALIDA_OU_CONFLITANTE");
 });
 it("nenhuma prescrição é presumida vigente sem ciclo, assinatura e prazo",()=>{
  const r=coletarFontesSalao({...entrada,eventos:[]});
  expect(r.prescricaoVigente).toBeNull();expect(r.avisos).toContain("PRESCRICAO_CICLO_AUSENTE_OU_AMBIGUO");
 });
 it("documento íntegro ligado ao episódio ainda exige contrato de prazo; hash adulterado é recusado",()=>{
  const ep={...evento("ep","TreatmentEpisode",{episodioId:"episodio",tumorLotId:"lote",modalidade:"QT",intencao:"ADJUVANTE",intentModifier:null,linha:1,esquemaId:"esquema",inicio:presente("2026-10-01"),fim:presente("2026-11-01")}),tumorLotId:"lote"};
  const ciclo={...evento("ci","Ciclo",{cicloId:"ciclo",episodioId:"episodio",numero:1,previstoEm:"2026-10-10",pesoKg:presente(70),origemPeso:"MEDIDO",ciclosSemPesoConsecutivos:0,prescricaoRef:{documentId:"rx",documentVersion:1},itens:[],comMedico:true}),tumorLotId:"lote"};
  const corpo={documentId:"rx",documentVersion:1,texto:"Prescrição sintética",contexto:{patientId:entrada.patientId,tumorLotId:"lote",episodioId:"episodio"}};
  const assinatura={documentId:"rx",documentVersion:1,serverActorId:"medico-sintetico",documentHash:hashConteudoExibido(corpo)};
  const doc={...evento("doc","DOCUMENTO",{data:corpo,signature:assinatura}),tumorLotId:"lote",revisao:"ASSINADO" as const};
  const r=coletarFontesSalao({...entrada,eventos:[ep,ciclo,doc]});
  expect(r.prescricaoVigente).toBeNull();expect(r.avisos).toContain("PRESCRICAO_PRAZO_SEM_CONTRATO");
  const adulterado={...doc,payload:{data:{data:{...corpo,texto:"Adulterado"},signature:assinatura}}};
  expect(coletarFontesSalao({...entrada,eventos:[ep,ciclo,adulterado]}).avisos).toContain("PRESCRICAO_INTEGRIDADE_OU_CONTEXTO_PENDENTE");
 });
});
