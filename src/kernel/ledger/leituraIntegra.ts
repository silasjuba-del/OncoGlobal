import type { DatabaseSync } from "node:sqlite";
import { ClinicalEvent } from "../../contracts/operacao.js";
import { validarPayloadEvento } from "../../contracts/envelope.js";
import { dadosDoEvento } from "../projections/snapshot.js";
export interface FalhaIntegridade { eventoId:string;patientId:string|null;tipo:string|null;motivo:"JSON_INVALIDO"|"CONTRATO_INVALIDO"|"PAYLOAD_FORA_DO_CONTRATO";schema?:string }
export type EscopoLeituraLedger = string | { patientId?:string; contatosGlobais:true; pacientesGlobais?:boolean };
export function lerLedgerIntegro(db:DatabaseSync,escopo?:EscopoLeituraLedger) {
  const pendenciasIntegridade:FalhaIntegridade[]=[];
  const patientId=typeof escopo === "string" ? escopo : escopo?.patientId;
  // Contatos e decisoes de vinculo exigem visao global para conservar transferencias e conflitos.
  const globalContato=`tipo IN ('Contato','Contato@1') OR (tipo IN ('ReviewDecision','ReviewDecision@1') AND CASE WHEN json_valid(payload) THEN json_extract(payload,'$.data.kind') END = 'VinculoContato')`;
  const globalCadastro=typeof escopo === "object" && escopo.pacientesGlobais
    ? ` OR tipo IN ('Paciente','Paciente@1')` : "";
  const rows=escopo===undefined ? db.prepare("SELECT * FROM clinical_event").all()
    : typeof escopo === "object" ? patientId===undefined ? db.prepare(`SELECT * FROM clinical_event WHERE ${globalContato}${globalCadastro}`).all()
      : db.prepare(`SELECT * FROM clinical_event WHERE patientId=? OR ${globalContato}${globalCadastro}`).all(patientId)
    : db.prepare("SELECT * FROM clinical_event WHERE patientId=?").all(patientId!);
  const itens=rows.flatMap(row=>{
    const base={eventoId:String(row.eventId),patientId:row.patientId==null?null:String(row.patientId),tipo:row.tipo==null?null:String(row.tipo)};
    try {
      const parsed=ClinicalEvent.safeParse({...row,payload:JSON.parse(String(row.payload)),fontes:JSON.parse(String(row.fontes)),criadoPor:JSON.parse(String(row.criadoPor))});
      if(!parsed.success){pendenciasIntegridade.push({...base,motivo:"CONTRATO_INVALIDO"});return[];}
      const p=validarPayloadEvento(parsed.data.tipo,dadosDoEvento(parsed.data));
      if(!p.ok){pendenciasIntegridade.push({...base,motivo:"PAYLOAD_FORA_DO_CONTRATO",schema:p.schema});return[];}
      return[parsed.data];
    }catch{pendenciasIntegridade.push({...base,motivo:"JSON_INVALIDO"});return[];}
  }).sort((a,b)=>Date.parse(a.criadoEm)-Date.parse(b.criadoEm)||a.operationId.localeCompare(b.operationId)||a.eventIndex-b.eventIndex);
  return{itens,pendenciasIntegridade};
}
