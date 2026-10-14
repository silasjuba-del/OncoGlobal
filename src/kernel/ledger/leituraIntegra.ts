import type { DatabaseSync } from "node:sqlite";
import { ClinicalEvent } from "../../contracts/operacao.js";
import { validarPayloadEvento } from "../../contracts/envelope.js";
import { dadosDoEvento } from "../projections/snapshot.js";
export interface FalhaIntegridade { eventoId:string;patientId:string|null;tipo:string|null;motivo:string;schema?:string }
export function lerLedgerIntegro(db:DatabaseSync,patientId?:string) {
  const pendenciasIntegridade:FalhaIntegridade[]=[];
  const rows=patientId===undefined ? db.prepare("SELECT * FROM clinical_event").all()
    : db.prepare("SELECT * FROM clinical_event WHERE patientId=?").all(patientId);
  const itens=rows.flatMap(row=>{
    const base={eventoId:String(row.eventId),patientId:row.patientId==null?null:String(row.patientId),tipo:row.tipo==null?null:String(row.tipo)};
    try {
      const parsed=ClinicalEvent.safeParse({...row,payload:JSON.parse(String(row.payload)),fontes:JSON.parse(String(row.fontes)),criadoPor:JSON.parse(String(row.criadoPor))});
      if(!parsed.success){pendenciasIntegridade.push({...base,motivo:"CONTRATO_INVALIDO"});return[];}
      const p=validarPayloadEvento(parsed.data.tipo,dadosDoEvento(parsed.data));
      if(!p.ok){pendenciasIntegridade.push({...base,motivo:p.motivo,schema:p.schema});return[];}
      return[parsed.data];
    }catch{pendenciasIntegridade.push({...base,motivo:"JSON_INVALIDO"});return[];}
  }).sort((a,b)=>Date.parse(a.criadoEm)-Date.parse(b.criadoEm)||a.operationId.localeCompare(b.operationId)||a.eventIndex-b.eventIndex);
  return{itens,pendenciasIntegridade};
}
