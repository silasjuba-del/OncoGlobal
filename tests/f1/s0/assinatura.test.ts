import { expect, it } from "vitest";
import type { ClinicalEvent } from "../../../src/contracts/operacao.js";
import { coletarFontesSalao } from "../../../src/server/f0c/salao.js";
import { hashConteudoExibido } from "../../../src/server/sessao.js";
import { presente } from "../../fixtures/triagem.js";
it("assinatura às 23:30 conserva data e 21 dias mesmo quando agora chega em UTC",()=>{
 const base={patientId:"p",encounterId:"e",tumorLotId:"l",fontes:[],revisao:"CONFIRMADO" as const,criadoEm:"2026-09-20T23:30:00-03:00",criadoPor:{tipo:"SESSAO" as const,id:"m"},supersedesEventId:null};
 const e=(id:string,tipo:string,data:unknown):ClinicalEvent=>({...base,eventId:id,operationId:id,eventIndex:0,tipo,payload:{data}});
 const ep=e("ep","TreatmentEpisode",{episodioId:"ep",tumorLotId:"l",modalidade:"QT",intencao:"ADJUVANTE",intentModifier:null,linha:1,esquemaId:"s",inicio:presente("2026-09-01"),fim:presente("2026-12-01")});
 const ci=e("ci","Ciclo",{cicloId:"c",episodioId:"ep",numero:1,previstoEm:"2026-10-10",pesoKg:presente(70),origemPeso:"MEDIDO",ciclosSemPesoConsecutivos:0,prescricaoRef:{documentId:"rx",documentVersion:1},itens:[],comMedico:true});
 const corpo={documentId:"rx",documentVersion:1,texto:"Prescrição sintética",contexto:{patientId:"p",tumorLotId:"l",episodioId:"ep"}};
 const doc={...e("doc","DOCUMENTO",{data:corpo,signature:{documentId:"rx",documentVersion:1,serverActorId:"m",documentHash:hashConteudoExibido(corpo)}}),revisao:"ASSINADO" as const};
 const entrada={eventos:[ep,ci,doc],patientId:"p",encounterId:"e",hoje:"2026-10-10",agora:"2026-10-10T15:00:00Z",offsetServico:"-03:00"};
 expect(coletarFontesSalao(entrada).prescricaoVigente?.validaAte).toBe("2026-10-10");
 expect(coletarFontesSalao({...entrada,hoje:"2026-10-11",agora:"2026-10-11T15:00:00Z"}).prescricaoVigente).toBeNull();
});
