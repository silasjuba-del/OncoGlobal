import { randomUUID, createHash } from 'node:crypto';
import type { WorkspaceStore, Registro } from '../persistencia/store.js';
import { ingestDocument, draftStudyCandidate, summarizeExtractive } from '../pesquisa/ingestao.js';
import { reviewStudy } from '../pesquisa/revisao.js';
import { evaluateMatch } from '../pesquisa/criterios.js';
import { appendStudyFollowUp } from '../pesquisa/seguimento.js';
import type { StudySource, StudyCandidateDraft, StudyReview, ReviewedCriterion, CriterionExpression, PatientFact, StudyFollowUp, MatchResult } from '../pesquisa/tipos.js';

export interface PatientWorkspace { id: string; nome: string; fase: 'NOVO'|'EM_TRATAMENTO'; facts: PatientFact[]; }
export interface StudyWorkspace { id: string; source: StudySource; attachmentBase64: string|null; candidate: StudyCandidateDraft; summary: string; attachments: {source:StudySource; attachmentBase64:string|null; summary:string}[]; reviews: StudyReview[]; }
export interface NoteWorkspace { id: string; patientId: string; tipo: string; texto: string; fonte: string; autor: string; em: string; }
export interface Workspace {
  patients: PatientWorkspace[]; studies: StudyWorkspace[]; followups: StudyFollowUp[]; notes: NoteWorkspace[];
  enrollments: {studyId:string; patientId:string; armId:string; date:string; source:string; actor:string}[];
  activePatient: string; activeStudy: string|null;
  institution: { nomeInstituicao: string; linha2: string; cidadeUf: string; exemplo: boolean };
  doctor: { nome: string; crm: string; rqes: string[] };
  printer: string;
}
export function initialWorkspace(): Workspace { return {
  patients: [{ id:'paciente-teste-001', nome:'Paciente Teste 001', fase:'NOVO', facts:[] }], studies:[], followups:[], notes:[],
  enrollments:[],activePatient:'paciente-teste-001', activeStudy:null,
  institution:{nomeInstituicao:'Instituição de exemplo',linha2:'Cabeçalho de exemplo: altere nas configurações',cidadeUf:'PENDENTE',exemplo:true},
  doctor:{nome:'PENDENTE',crm:'PENDENTE',rqes:[]},printer:'Escolher no diálogo do sistema',
}; }
export function readWorkspace(store: WorkspaceStore): Registro<Workspace> {
  return store.ler<Workspace>('workspace','principal') ?? store.gravar({collection:'workspace',key:'principal',value:initialWorkspace(),expectedRevision:null});
}
const sha = (s:string|Uint8Array) => createHash('sha256').update(s).digest('hex');
const required=(f:URLSearchParams,k:string)=>{const v=f.get(k)?.trim();if(!v)throw new Error(`CAMPO_OBRIGATORIO:${k}`);return v;};
const confirmed=(f:URLSearchParams)=>{if(f.get('confirm')!=='sim')throw new Error('REVISAO_MEDICA_OBRIGATORIA');};
const dateValid=(d:string)=>/^\d{4}-\d\d-\d\d$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
export function selected(w:Workspace) {return { patient:w.patients.find(p=>p.id===w.activePatient)!,study:w.studies.find(s=>s.id===w.activeStudy)};}
export function matchWorkspace(w:Workspace,asOf:string):MatchResult|null {
  const {patient,study}=selected(w);const review=study?.reviews.at(-1);
  if(!study||!review||!patient)return null;
  return evaluateMatch({candidate:study.candidate,review,patientId:patient.id,facts:patient.facts,asOf});
}
/** Tudo permanece no workspace local, separado dos fatos canônicos e da assinatura clínica. */
export async function changeWorkspace(w:Workspace,f:URLSearchParams,actor:string,now:string):Promise<Workspace> {
  const next=structuredClone(w);const action=required(f,'action');const {patient,study}=selected(next);
  switch(action){
    case 'patient-select': {const id=required(f,'patientId');if(!next.patients.some(p=>p.id===id))throw Error('PACIENTE_AUSENTE');next.activePatient=id;break;}
    case 'patient-add': {confirmed(f);const nome=required(f,'nome');const fase=f.get('fase');if(fase!=='NOVO'&&fase!=='EM_TRATAMENTO')throw Error('FASE_INVALIDA');const id=randomUUID();next.patients.push({id,nome,fase,facts:[]});next.activePatient=id;break;}
    case 'study-select': {const id=required(f,'studyId');if(!next.studies.some(s=>s.id===id))throw Error('ESTUDO_AUSENTE');next.activeStudy=id;break;}
    case 'study-import': {
      const id=randomUUID(),name=required(f,'fileName'),mime=f.get('mime')||'text/plain',raw=f.get('content')??'',binary=f.get('binary')??'';
      if(raw.length>2_000_000||binary.length>8_000_000)throw Error('DOCUMENTO_MUITO_GRANDE');
      const textual=/\.(txt|md|json)$/i.test(name);
      if(!raw.trim()&&!binary)throw Error('DOCUMENTO_VAZIO');
      const source=await ingestDocument({sourceId:id,sourceRef:'documento-local:'+id,originalName:name,mimeType:mime,
        ...(textual?{content:raw}:{attachmentRef:'anexo-local:'+id,attachmentContentHash:sha(Buffer.from(binary,'base64'))})},async bytes=>sha(bytes));
      if(f.get('attachCurrent')==='sim'){if(!study)throw Error('ESTUDO_AUSENTE');study.attachments.push({source,attachmentBase64:textual?null:binary,summary:(await summarizeExtractive(source)).text});break;}
      next.studies.push({id,source,attachmentBase64:textual?null:binary,candidate:await draftStudyCandidate(source,id),summary:(await summarizeExtractive(source)).text,attachments:[],reviews:[]});next.activeStudy=id;break;
    }
    case 'study-review': {
      confirmed(f);if(!study)throw Error('ESTUDO_AUSENTE');
      const criteria=[...study.candidate.inclusionCriteria,...study.candidate.exclusionCriteria];
      const reviewedCriteria:ReviewedCriterion[]=criteria.map(c=>{
        const op=f.get('op:'+c.criterionId)||'';const key=f.get('key:'+c.criterionId)?.trim()||'';const value=f.get('value:'+c.criterionId)||'';let expression:CriterionExpression|null=null;
        if(op&&op!=='NA'&&(!key||!value))throw Error('MAPEAMENTO_INCOMPLETO');
        if(op==='EQUALS')expression={kind:'EQUALS',factKey:key,value};
        else if(['EQ','GT','GTE','LT','LTE'].includes(op)){const n=Number(value);const unit=f.get('unit:'+c.criterionId)?.trim();if(!Number.isFinite(n)||!unit)throw Error('NUMERO_UNIDADE_OBRIGATORIOS');expression={kind:'NUMBER',factKey:key,operator:op as 'EQ'|'GT'|'GTE'|'LT'|'LTE',value:n,unit};}
        else if(op==='ON_OR_AFTER'||op==='ON_OR_BEFORE'){if(!dateValid(value))throw Error('DATA_INVALIDA');expression={kind:'DATE',factKey:key,operator:op,value};}
        else if(op&&op!=='NA')throw Error('OPERADOR_INVALIDO');
        const groupId=f.get('group:'+c.criterionId)?.trim()||null;const groupOp=f.get('groupOp:'+c.criterionId)||'AND';if(!['AND','OR'].includes(groupOp))throw Error('GRUPO_INVALIDO');
        return {criterionId:c.criterionId,polarity:c.polarity,rawText:c.rawText,evidence:c.evidence,groupId,groupOperator:groupId?groupOp as 'AND'|'OR':null,expression,applicability:op==='NA'?'NAO_APLICAVEL':expression?'APLICAVEL':'PENDENTE',notApplicableReason:op==='NA'?required(f,'naReason:'+c.criterionId):null};
      });
      const title=study.candidate.title;if(!title?.evidence[0])throw Error('TITULO_COM_FONTE_PENDENTE');
      const review=reviewStudy(study.candidate,{decisionId:randomUUID(),reviewerId:actor,reviewedAt:now,decision:'CONFIRMAR',version:study.reviews.length+1,studyId:study.id,titleText:title.text,titleEvidenceLocator:title.evidence[0].locator,reviewedCriteria,reviewedArmIds:study.candidate.arms.map(a=>a.armId)});
      study.reviews.push(review);break;
    }
    case 'patient-fact': {
      confirmed(f);if(!patient)throw Error('PACIENTE_AUSENTE');const factKey=required(f,'factKey'),raw=required(f,'factValue'),sourceRef=required(f,'factSource'),date=required(f,'factDate');if(!dateValid(date))throw Error('DATA_INVALIDA');
      const numeric=f.get('factType')==='number';const value=numeric?Number(raw):raw;if(numeric&&!Number.isFinite(value))throw Error('NUMERO_INVALIDO');
      const unit=f.get('factUnit')?.trim();const validTo=f.get('validTo')?.trim();if(validTo&&(!dateValid(validTo)||validTo<date))throw Error('VALIDADE_INVALIDA');
      patient.facts.push({patientId:patient.id,factKey,value,status:'CONFIRMADO',source:{sourceId:randomUUID(),sourceRef:'MANUAL — referência informada: '+sourceRef,locator:'registro manual em '+date,exactText:raw,contentHash:sha(raw)},validFrom:date,...(unit?{unit}:{}),...(validTo?{validTo}:{})});break;
    }
    case 'enroll': {
      confirmed(f);if(!study?.reviews.at(-1)||!patient)throw Error('ESTUDO_REVISADO_OBRIGATORIO');const armId=required(f,'armId'),date=required(f,'assignmentDate'),source=required(f,'assignmentSource');if(!dateValid(date)||!study.candidate.arms.some(a=>a.armId===armId))throw Error('ALOCACAO_INVALIDA');const sameDate=next.enrollments.filter(e=>e.studyId===study.id&&e.patientId===patient.id&&e.date===date);if(sameDate.some(e=>e.armId!==armId))throw Error('ALOCACAO_CONFLITANTE_NA_MESMA_DATA');if(!sameDate.length)next.enrollments.push({studyId:study.id,patientId:patient.id,armId,date,source,actor});break;
    }
    case 'followup': {
      confirmed(f);const review=study?.reviews.at(-1);if(!study||!review||!patient)throw Error('ESTUDO_REVISADO_OBRIGATORIO');
      const kind=required(f,'kind'),date=required(f,'eventDate'),description=required(f,'description'),sourceRef=required(f,'eventSource');if(!dateValid(date))throw Error('DATA_INVALIDA');
      const base={followUpId:randomUUID(),studyId:study.id,studyVersion:review.version,patientId:patient.id,armId:required(f,'armId'),occurredAt:date+'T12:00:00-03:00',source:{sourceId:randomUUID(),sourceRef,locator:date,exactText:description,contentHash:sha(description)}};
      let item:StudyFollowUp;
      if(kind==='TOXICITY')item={...base,kind,toxicity:{term:description,grade:Number(required(f,'grade')),ctcaeVersion:'6',confirmedBy:actor}};
      else if(kind==='IMAGING')item={...base,kind,imaging:{description,modality:required(f,'modality')}};
      else if(kind==='RESPONSE'){const response=required(f,'response');if(!['PROGRESSAO','ESTABILIDADE','RESPOSTA','PENDENTE'].includes(response))throw Error('RESPOSTA_INVALIDA');item={...base,kind,response:{value:response as 'PROGRESSAO'|'ESTABILIDADE'|'RESPOSTA'|'PENDENTE',informedBy:actor}};}
      else if(kind==='CLINICAL_EVENT')item={...base,kind,clinicalEvent:{code:'REGISTRO_MEDICO',description}};
      else throw Error('TIPO_EVENTO_INVALIDO');
      next.followups=appendStudyFollowUp(next.followups,{review,patientArmAssignments:next.enrollments.filter(e=>e.studyId===study.id&&e.patientId===patient.id&&e.date<=date).sort((a,b)=>a.date.localeCompare(b.date)).slice(-1).map(e=>({patientId:e.patientId,armId:e.armId}))},item);break;
    }
    case 'note': {confirmed(f);next.notes.push({id:randomUUID(),patientId:patient.id,tipo:required(f,'noteType'),texto:required(f,'noteText'),fonte:required(f,'noteSource'),autor:actor,em:now});break;}
    case 'settings': {confirmed(f);next.institution={nomeInstituicao:required(f,'institution'),linha2:f.get('line2')||'',cidadeUf:required(f,'city'),exemplo:false};next.doctor={nome:required(f,'doctor'),crm:required(f,'crm'),rqes:(f.get('rqes')||'').split(',').map(s=>s.trim()).filter(Boolean)};next.printer=f.get('printer')?.trim()||'Escolher no diálogo do sistema';break;}
    default: throw Error('ACAO_DESCONHECIDA');
  }
  return next;
}
export function studySummary(s:StudyWorkspace):string {return s.summary;}
