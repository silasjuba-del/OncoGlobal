import type { FatoRetrato, Retrato } from "../../src/contracts/f1/retrato.js";
export const contexto={patientId:"paciente-sintetico-fase2",encounterId:"encontro-sintetico-fase2",tumorLotId:"lote-sintetico-fase2"};
export const fonte={sourceId:"fonte-sintetica",classe:"MANUAL" as const,localizador:"fixture",dataClinica:"2026-10-16",
  dataCaptura:"2026-10-16T12:00:00Z",versao:"1",contentHash:"hash-sintetico"};
export function fato(campo:string,valor:unknown,extra:Partial<FatoRetrato>={}):FatoRetrato{return{
  ref:{eventId:`evento-${campo}`,revisao:"1"},tipo:"FATO",campo,...contexto,escopo:"PACIENTE",tempoClinico:"2026-10-16",
  tempoRegistro:"2026-10-16T12:00:00Z",fontes:[fonte],dados:{campo,valor},...extra};}
export function retrato(fatos:FatoRetrato[]=[]):Retrato{return{schema:"Retrato@1",...contexto,revisao:"revisao-sintetica",versaoProjecao:"fixture",
  geradoEm:"2026-10-16T12:00:00Z",regras:[],biblioteca:{id:"biblioteca-sintetica",versao:"1",hash:"hash-sintetico"},
  fatos,integridade:[],delta:{encounterAnteriorId:null,novos:[],substituidos:[]},resumo:[]};}
export const packOriginal={header:{id:"pack-sintetico",versao:"2",aprovadoEm:"2026-10-16",fonte:{referencia:"Fonte sintética",trecho:"Somente fixture"}},
  status:"RASCUNHO",consultavel:true,identidade:{tumor:"Tumor sintético",cid10:["C50"]},diagnostico:{imagem:[
    {catalogoId:"EXAME_SINTETICO",rotulo:"Exame sintético",indicacao:"universal",quando:"Cenário sintético",fonte:{referencia:"Fonte sintética",trecho:"Critério sintético",pagina:1}},
    {catalogoId:"CONDICIONAL_SINTETICO",indicacao:"condicional",quando:"Condição a conferir",fonte:{referencia:"Fonte sintética",trecho:"Só se aplicável"}}]},
  tratamento:{protocolos:[{nome:"PROTOCOLO_SINTETICO_SEM_REFERENCIA",texto:"Conteúdo documental preservado para revisão"}],seguimento:[{texto:"Intervalo não informado; não inventar"}]}};
