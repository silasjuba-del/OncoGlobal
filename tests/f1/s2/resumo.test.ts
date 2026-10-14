import {expect,it} from "vitest";
import type {ClinicalEvent} from "../../../src/contracts/operacao.js";
import {projetarRetrato,type ContextoRetrato} from "../../../src/kernel/projections/retrato/index.js";
const contexto:ContextoRetrato={patientId:"p",encounterId:"e",tumorLotId:"t",agora:"2026-10-12T12:00:00-03:00",regras:[],biblioteca:{id:"b",versao:"1",hash:"h"}};
const fonte={sourceId:"fonte-sintetica",classe:"DOCUMENT" as const,localizador:"pagina 1",dataClinica:"2026-10-10",dataCaptura:"2026-10-10T12:00:00-03:00",versao:"1",contentHash:"h"};
const dado=(valor:unknown,revisao="CONFIRMADO",campo="PRESENTE",fontes:unknown[]=[fonte])=>({valor,revisao,campo,fontes,estado:campo==="CONFLITO"?"VERMELHO":"VERDE",motivo:"documentado"});
function evento(id:string,tipo:string,data:Record<string,unknown>):ClinicalEvent{return {eventId:id,operationId:`op-${id}`,eventIndex:0,patientId:"p",encounterId:"e",tumorLotId:"t",tipo,payload:{reviewDecisionId:"r",data},fontes:[fonte],revisao:"CONFIRMADO",criadoEm:"2026-10-10T12:00:00-03:00",criadoPor:{tipo:"SESSAO",id:"m"},supersedesEventId:null};}
it("contêiner confirmado não promove subcampos RAW, AUSENTE, nulos ou sem fonte",()=>{
  for(const histologia of [dado("carcinoma RAW","RAW"),dado(null,"RAW","AUSENTE",[]),dado("sem fonte","CONFIRMADO","PRESENTE",[]),dado("fonte inválida","CONFIRMADO","PRESENTE",[{}]),dado("sem revisão","REVISAR"),dado(null)]){
    const e=evento("t","TumorLot",{histologia,cid:dado(null,"RAW","AUSENTE",[]),topografia:dado(null,"RAW","NAO_INFORMADO",[]),estadiamentos:[]});
    const r=projetarRetrato([e],contexto);expect(r.resumo).toEqual([]);expect(r.fatos[0]?.dados.histologia).toEqual(histologia);
  }
});
it("Dado presente com revisão própria e fonte vira texto clínico simples referenciado",()=>{
  const r=projetarRetrato([evento("t","TumorLot",{histologia:dado("carcinoma ductal invasivo"),topografia:dado("mama esquerda","ASSINADO"),cid:dado("C50.9")})],contexto);
  expect(r.resumo.map(s=>s.texto)).toEqual(["CID: C50.9.","Topografia: mama esquerda.","Histologia: carcinoma ductal invasivo."]);
  expect(r.resumo.every(s=>s.fatos[0]?.eventId==="t")).toBe(true);expect(JSON.stringify(r.resumo)).not.toContain("TumorLot");
  expect(r.resumo.some(s=>/[{}]/.test(s.texto))).toBe(false);
});
it("conflito cria somente lacuna referenciada e conserva candidatos no fato original",()=>{
  const histologia={...dado(null,"CONFIRMADO","CONFLITO"),candidatos:[{valor:"carcinoma A",fontes:[fonte]},{valor:"carcinoma B",fontes:[{...fonte,sourceId:"outra-fonte"}]}]};
  const r=projetarRetrato([evento("t","TumorLot",{histologia})],contexto);
  expect(r.resumo[0]?.texto).toBe("Histologia: conflito documentado; revisão pendente, sem valor selecionado.");
  expect(r.resumo[0]?.fatos).toEqual([r.fatos[0]?.ref]);expect(r.fatos[0]?.dados.histologia).toEqual(histologia);
  expect(r.resumo[0]?.texto).not.toContain("carcinoma A");expect(r.resumo[0]?.texto).not.toContain("carcinoma B");
});
it("valor estruturado de laboratório e suspeita/negação ficam legíveis sem promover diagnóstico",()=>{
  const r=projetarRetrato([evento("lab","FATO",{campo:"extracao.lab:HB",valor:{marker:"HB",value:10,unit:"g/dL"}}),
    evento("suspeita","FATO",{campo:"diagnostico",valor:{literal:"metástase não confirmada",suspeita:true,negado:false},status:"INCERTO"})],contexto);
  expect(r.resumo.map(s=>s.texto)).toContain("Laboratório: HB: 10 g/dL.");
  const suspeita=r.resumo.find(s=>s.fatos[0]?.eventId==="suspeita")!;expect(suspeita.texto).toContain("metástase não confirmada");expect(suspeita.texto).toContain("suspeita: sim");expect(suspeita.texto).toContain("negado: não");expect(suspeita.texto).toContain("INCERTO");
});
it("metadados operacionais não compõem resumo e documento assinado mantém seus bytes",()=>{
  const documento=evento("doc","DOCUMENTO",{texto:"Texto original assinado",signature:{serverActorId:"m"}});documento.revisao="ASSINADO";const original=JSON.stringify(documento);
  const r=projetarRetrato([documento,evento("far","FATO",{campo:"farmacia.conferencia",valor:{status:"CONFERIDA"}}),evento("apac","FATO",{campo:"apac.validacaoEmissao",valor:{status:"VALIDADA"}}),
    evento("operacional","FATO",{campo:"opaque",valor:{operationId:"op",eventIds:["e"]}})],contexto);
  expect(r.resumo).toEqual([]);expect(JSON.stringify(documento)).toBe(original);expect(r.fatos.find(f=>f.ref.eventId==="doc")?.dados.texto).toBe("Texto original assinado");
});
