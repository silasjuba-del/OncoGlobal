import { expect, it } from "vitest";
import { abrirLedger } from "../../../src/kernel/ledger/db.js";
import { listarDrafts } from "../../../src/kernel/comandos/portas.js";
import { prepararFinalizacaoFlash } from "../../../src/server/flash.js";
import { fonteSintetica } from "../../fixtures/triagem.js";
const agora="2026-10-12T08:00:00-03:00";
const contexto={patientId:"p",encounterId:"e",tumorLotId:null};
const plano={acoesMarcadas:[],receitasMarcadas:[],apac:{cid:"",sigtap:"",finalidade:"",competencia:"",estado:"PENDENTE" as const,pendencias:[],emitir:false as const},retorno:{dias:14,examesAntesDoRetorno:[]},solicitacoes:{laboratorio:["Hemograma","Creatinina"],imagem:[]}};
const fonte={fonte:fonteSintetica("decisao-medica-flash"),dataReferencia:"2026-10-12",revisao:"retrato-confirmado-v1"};
it('indicação de imagem ausente permanece pendente, sem copiar resumo clínico',()=>{
 const db=abrirLedger(':memory:');try{
  const r=prepararFinalizacaoFlash(db,agora,{...contexto,plano:{...plano,solicitacoes:{laboratorio:[],imagem:['Exame sintético']}},idempotencyKey:'imagem-indicacao-ausente'},'Resumo não é indicação',null,fonte);
  expect(r.status).toBe(200);
  const doc=r.preparacaoDocumentos?.documentos.find(d=>d.tipoDocumento==='PEDIDO_EXAME');
  expect(doc?.texto).toContain('Indicação: PENDENTE');expect(doc?.texto).not.toContain('Indicação: Resumo não é indicação');
 }finally{db.close();}
});
it("Flash usa gerador S9 com fontes do servidor e retorna tarefa ligada aos documentos reais sem gravá-la",()=>{
 const db=abrirLedger(":memory:");try{
  const r=prepararFinalizacaoFlash(db,agora,{...contexto,plano,idempotencyKey:"s9-flash-integracao"},"Resumo sintético confirmado",null,fonte);
  expect(r.status).toBe(200);
  const drafts=listarDrafts(db,"p");const retorno=drafts.find(d=>(d.payload as Record<string,unknown>).tipoDocumento==="FLASH_RETORNO");
  expect(retorno?.payload).toMatchObject({texto:expect.stringContaining("2026-10-26"),preparacaoS9:{revisao:"retrato-confirmado-v1"}});
  expect(r.preparacaoDocumentos?.tarefas).toHaveLength(1);
  const tarefa=r.preparacaoDocumentos?.tarefas[0];expect(tarefa?.documentoRef.documentId).toBe(retorno?.draftId);
  expect(tarefa?.pedidosRef.every(p=>drafts.some(d=>d.draftId===p.documentId))).toBe(true);
  expect(db.prepare("SELECT count(*) AS n FROM clinical_event").get()?.n).toBe(0);
 }finally{db.close();}
});
it("ID de receita sem corpo resolvido não produz medicamento inventado",()=>{
 const db=abrirLedger(":memory:");try{
  const r=prepararFinalizacaoFlash(db,agora,{...contexto,plano:{...plano,receitasMarcadas:["receita-sem-corpo"]},idempotencyKey:"s9-sem-corpo"},null,null,fonte);
  expect(r.status).toBe(409);expect(listarDrafts(db,"p")).toEqual([]);
 }finally{db.close();}
});
it("receita só usa corpo estruturado resolvido pelo servidor e preserva campos ausentes",()=>{
 const db=abrirLedger(":memory:");try{
  const medicamentos=[{id:"receita_pantoprazol",medicamento:"Pantoprazol",dose:"40 mg",orientacao:"pela manhã",duracao:"30 dias",via:"VO",quantidade:null}];
  const r=prepararFinalizacaoFlash(db,agora,{...contexto,plano:{...plano,receitasMarcadas:["receita_pantoprazol"]},idempotencyKey:"s9-receita-corpo"},null,null,{...fonte,medicamentos});
  expect(r.status).toBe(200);
  const receita=listarDrafts(db,"p").find(d=>(d.payload as Record<string,unknown>).tipoDocumento==="FLASH_RECEITA");
  expect(receita?.payload).toMatchObject({texto:expect.stringContaining("Pantoprazol")});
  expect((receita?.payload as Record<string,unknown>).texto).toContain("Quantidade: PENDENTE");
  expect(r.preparacaoDocumentos?.documentos.some(d=>d.tipoDocumento==="RECEITA"&&d.fontes[0]?.sourceId==="decisao-medica-flash")).toBe(true);
 }finally{db.close();}
});
it("replay de mesma revisão e fonte não duplica drafts ou referências; fonte inválida não grava",()=>{
 const db=abrirLedger(":memory:");try{
  const input={...contexto,plano,idempotencyKey:"s9-replay-fonte"};
  const primeira=prepararFinalizacaoFlash(db,agora,input,null,null,fonte);const ids=listarDrafts(db,"p").map(d=>d.draftId).sort();
  const segunda=prepararFinalizacaoFlash(db,agora,input,null,null,fonte);
  expect(segunda.body).toEqual(primeira.body);expect(segunda.preparacaoDocumentos?.tarefas).toEqual(primeira.preparacaoDocumentos?.tarefas);
  expect(listarDrafts(db,"p").map(d=>d.draftId).sort()).toEqual(ids);
  const invalida=prepararFinalizacaoFlash(db,agora,{...input,idempotencyKey:"outra-chave"},null,null,{...fonte,dataReferencia:"2026-02-30"});
  expect(invalida.status).toBe(409);expect(listarDrafts(db,"p").map(d=>d.draftId).sort()).toEqual(ids);
 }finally{db.close();}
});
