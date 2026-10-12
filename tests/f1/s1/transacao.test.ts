import { describe,expect,it } from "vitest";
import { abrirLedger } from "../../../src/kernel/ledger/db.js";
import { aoCommitar, confirmar, salvarDraft } from "../../../src/kernel/ledger/writeRouter.js";
import { gravarEstimulo,listarExecucoesPendentes } from "../../../src/kernel/orquestracao/estimulos/gravar.js";
const em="2026-10-12T08:00:00-03:00";
function ambiente(){const db=abrirLedger(":memory:");salvarDraft(db,{draftId:"draft",patientId:"p",sourceId:"s",rawRef:"local",payload:{campo:"alergias",valor:[]},diagnostics:[],revision:0,criadoEm:em});
 const req={operationId:"op",patientId:"p",encounterId:"enc",tumorLotId:null,reviewDecisionId:"review",sessao:{medicoId:"m",crm:"CRM-SINTETICO",emitidaEm:em,expiraEm:"2026-10-12T09:00:00-03:00"},em,
  registros:[{draftId:"draft",expectedRevision:0,eventId:"ev",tipo:"FATO",payload:{campo:"alergias",valor:[]},fontes:[],revisao:"CONFIRMADO" as const}]};return{db,req};}
describe("F1-S1 commit clínico e estímulo atômicos",()=>{
 it("replay não duplica fila; queda após commit conserva pendente",()=>{const{db,req}=ambiente();
  aoCommitar(db,(r)=>gravarEstimulo(db,{schema:"EstimuloTecnico@1",id:r.operationId,operationId:r.operationId,tipo:"FATO_CONFIRMADO",patientId:r.patientId,encounterId:r.encounterId,tumorLotId:null,revisaoEntrada:"rev",criadoEm:em,ator:"SISTEMA"}));
  expect(confirmar(db,req).estado).toBe("GRAVADA");expect(confirmar(db,req).estado).toBe("REPLAY");
  expect(listarExecucoesPendentes(db)).toHaveLength(1);expect(db.prepare("SELECT count(*) n FROM clinical_event").get()?.n).toBe(1);db.close();});
 it("falha do gancho reverte fatos, drafts e fila na mesma transação",()=>{const{db,req}=ambiente();
  aoCommitar(db,()=>{throw new Error("QUEDA_SINTETICA");});expect(()=>confirmar(db,req)).toThrow("QUEDA_SINTETICA");
  expect(db.prepare("SELECT count(*) n FROM clinical_event").get()?.n).toBe(0);
  expect(db.prepare("SELECT revision FROM draft_envelope").get()?.revision).toBe(0);db.close();});
});
