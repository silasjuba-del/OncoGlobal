import {expect,it} from "vitest";
import {abrirLedger} from "../../src/kernel/ledger/db.js";
import {salvarDraft} from "../../src/kernel/ledger/drafts.js";
import {confirmar as gravarLegado} from "../../src/kernel/ledger/writeRouter.js";
import {criarWriterClinicoGateway} from "../../src/kernel/gateway/writerClinico.js";
import {hashCanonico} from "../../src/modules/tipos.js";
const em="2026-10-09T12:00:00Z",sessao={medicoId:"medico-sintetico",crm:"CRM-SINTETICO",emitidaEm:em,expiraEm:"2026-10-09T14:00:00Z"};
function fixture(contentHash:string,tipo="FATO",semFonte=false){
 const db=abrirLedger(":memory:"),payload={campo:"observacao",valor:"Declaração sintética",contexto:{encounterId:"e",tumorLotId:null}};
 salvarDraft(db,{draftId:"d",patientId:"p",sourceId:"fonte",rawRef:"referencia-local",payload,diagnostics:[],revision:0,criadoEm:em});
 const writer=criarWriterClinicoGateway({db,agora:()=>em,hashFonteOriginal:()=>contentHash});
 const pedido={operationId:"op",reviewDecisionId:"review",ator:{tipo:"SESSAO" as const,id:sessao.medicoId},sessao,acaoMedicaExplicita:true,
  contexto:{patientId:"p",encounterId:"e",tumorLotId:null},bundleExibidoNoServidor:[{draftId:"d",documentId:"d",documentVersion:1,conteudoHash:hashCanonico(payload)}],
  documentosAssinadosNoPedido:[{documentId:"d",documentVersion:1}],registros:[{draftId:"d",expectedRevision:0,eventId:"ev",tipo,payload,
   fontes:semFonte?[]:[{sourceId:"fonte",classe:"DOCUMENT" as const,localizador:null,dataClinica:null,dataCaptura:em,versao:"1",contentHash}],revisao:"CONFIRMADO" as const}]};
 return {db,writer,pedido};
}
it.each(["12345678","g".repeat(64)])("gateway recusa hash não SHA-256 completo: %s",h=>{
 const a=fixture(h);try{expect(a.writer.persistir(a.pedido)).toMatchObject({decisao:"NEGADA",motivoCodigo:"PROVENIENCIA_OBRIGATORIA_AUSENTE"});
 expect(a.db.prepare("SELECT COUNT(*) AS n FROM clinical_event").get()!.n).toBe(0);}finally{a.db.close();}
});
it("FATO@1 não contorna exigência de proveniência",()=>{
 const a=fixture("a".repeat(64),"FATO@1",true);try{expect(a.writer.persistir(a.pedido)).toMatchObject({decisao:"NEGADA",motivoCodigo:"PROVENIENCIA_OBRIGATORIA_AUSENTE"});
 expect(a.db.prepare("SELECT COUNT(*) AS n FROM clinical_event").get()!.n).toBe(0);}finally{a.db.close();}
});
it("fonte íntegra permite primeira gravação e replay sem duplicar evento",()=>{
 const a=fixture("a".repeat(64));try{expect(a.writer.persistir(a.pedido).decisao).toBe("PERSISTIDA");expect(a.writer.persistir(a.pedido).decisao).toBe("REPLAY");
 expect(a.db.prepare("SELECT COUNT(*) AS n FROM clinical_event").get()!.n).toBe(1);}finally{a.db.close();}
});
it("gateway recupera operação histórica com hash legado sem revalidá-lo como fonte nova",()=>{
 const a=fixture("hash-legado");try{
  const p=a.pedido;expect(gravarLegado(a.db,{...p.contexto,operationId:p.operationId,reviewDecisionId:p.reviewDecisionId,sessao,em,registros:p.registros}).estado).toBe("GRAVADA");
  expect(a.writer.persistir(p).decisao).toBe("REPLAY");
  expect(a.db.prepare("SELECT COUNT(*) AS n FROM clinical_event").get()!.n).toBe(1);
 }finally{a.db.close();}
});
