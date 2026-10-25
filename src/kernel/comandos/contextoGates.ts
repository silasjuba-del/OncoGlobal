import type {DatabaseSync} from 'node:sqlite';
import {Paciente} from '../../contracts/clinico.js';
import {ClinicalFact} from '../../contracts/w10/extracao.js';
import {lerLedgerIntegro} from '../ledger/leituraIntegra.js';
import {eventosVigentes,dadosDoEvento} from '../projections/snapshot.js';
import {hashCanonico} from '../../modules/tipos.js';
import type {ContextoGates,FatoGate} from '../extracao/gatesClinicos.js';
export function contextoGatesExtracao(db:DatabaseSync,c:{patientId:string;encounterId:string;tumorLotId:string|null},em:string):ContextoGates{
 const eventos=eventosVigentes(lerLedgerIntegro(db,c.patientId).itens.filter(e=>['CONFIRMADO','ASSINADO'].includes(e.revisao)&&Date.parse(e.criadoEm)<=Date.parse(em)));
 const cadastros=eventos.flatMap(e=>{if(!/^Paciente(?:@1)?$/.test(e.tipo))return [];const p=Paciente.safeParse(dadosDoEvento(e));return p.success&&p.data.patientId===c.patientId?[{e,p:p.data}]:[];});
 const sexos=[...new Set(cadastros.map(p=>p.p.sexoCadastral))];
 const referencias=cadastros.map(p=>hashCanonico(p.e)),fatos:FatoGate[]=[];
 for(const e of eventos.filter(e=>/^FATO(?:@1)?$/.test(e.tipo)&&e.encounterId===c.encounterId&&e.tumorLotId===c.tumorLotId)){
  const d=dadosDoEvento(e);if(!d||!['diagnosis','histology','imaging','procedure'].includes(String(d.domain)))continue;
  const f=ClinicalFact.safeParse({id:`ledger:${e.eventId}`,segmentId:`ledger:${e.eventId}`,patientCandidateId:c.patientId,domain:d.domain,value:d.valor,
   sourceId:d.sourceId,sourceType:d.sourceType,evidence:d.evidence,qualificadores:d.qualificadores,rawEvidence:d.rawEvidence,confidence:d.confidence,requiresConfirmation:d.requiresConfirmation});
  if(f.success){fatos.push(f.data);referencias.push(hashCanonico(e));}
 }
 return {sexoCadastral:sexos.length===1?sexos[0]!:null,fatos,referencias:referencias.sort()};
}
