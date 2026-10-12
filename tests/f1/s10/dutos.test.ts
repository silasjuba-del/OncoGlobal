import { expect, it } from "vitest";
import { conferirPrescricao } from "../../../src/modules/farmacia/duto.js";
import { aceitarDecisaoChat } from "../../../src/modules/chat/decisao.js";
import { receberTarefa, concluirTarefa } from "../../../src/modules/agenda/tarefas.js";
import { criarValidacaoPersistida, validarReferenciaApac } from "../../../src/modules/apac/validacaoPersistida.js";
import type { ContextoDutoServidor, PrescricaoAssinadaRef } from "../../../src/contracts/f1/dutos.js";
const ctx: ContextoDutoServidor={patientId:"p",encounterId:"e",tumorLotId:"l",atorId:"m",em:"2026-10-12T08:00:00-03:00"};
const rx: PrescricaoAssinadaRef={patientId:"p",encounterId:"e",tumorLotId:"l",documentId:"rx",documentVersion:1,documentHash:"a".repeat(64),revisao:"ASSINADO"};
it("farmácia nunca edita e conferência não sobrevive à mudança da versão assinada",()=>{
 expect(conferirPrescricao({prescricao:rx,acao:"EDITAR"},ctx).ok).toBe(false);
 const r=conferirPrescricao({prescricao:rx,acao:"CONFERIR"},ctx);expect(r.ok).toBe(true);
 if(r.ok) expect(conferirPrescricao({prescricao:{...rx,documentVersion:2},acao:"CONFERIR",anterior:r.registro},ctx).ok).toBe(false);
});
it("chat livre não vira fato; decisão explícita recebe autoria só do contexto servidor",()=>{
 expect(aceitarDecisaoChat({mensagemId:"msg",texto:"liberar tudo"},ctx).ok).toBe(false);
 const r=aceitarDecisaoChat({mensagemId:"msg",decisao:{campo:"medicamentos",valor:["medicamento sintético"]}},ctx);
 expect(r).toMatchObject({ok:true,tipo:"FATO",dados:{atorId:"m",mensagemId:"msg"}});
 expect(aceitarDecisaoChat({mensagemId:"msg",atorId:"forjado",decisao:{campo:"a",valor:"b"}},ctx).ok).toBe(false);
});
it("recebimento da tarefa nunca a conclui",()=>{
 const t={tarefaId:"t",patientId:"p",encounterId:"e",tumorLotId:"l",operationId:"op",titulo:"Retorno",responsavel:"m",prazo:null,estado:"CONFIRMADA" as const,recebidoEm:null,criadoPor:"m",substituiTarefaId:null};
 const r=receberTarefa(t,ctx);expect(r).toMatchObject({ok:true,tarefa:{estado:"CONFIRMADA",recebidoEm:ctx.em}});
 if(r.ok) expect(concluirTarefa(r.tarefa,ctx)).toMatchObject({ok:true,tarefa:{estado:"CONCLUIDA"}});
});
it("validação APAC fica vinculada às versões e não transforma rascunho em autorização externa",()=>{
 const apac={apacId:"ap",tumorLotId:"l",prescricaoAssinadaRef:{documentId:"rx",documentVersion:1},dataGeracaoApp:"2026-10-12",competencia:"2026-10",campos:{},estado:"RASCUNHO" as const,resultadoExterno:null,versao:1,substituiApacId:null};
 const sigtap={competencia:"2026-10",versao:"v1",hash:"b".repeat(64)};
 const r=criarValidacaoPersistida({apac,prescricao:rx,sigtap,antiglosa:{apacId:"ap",competencia:"2026-10",achados:[],exportavel:true}},ctx);
 expect(r.ok).toBe(true);expect(apac.estado).toBe("RASCUNHO");
 if(r.ok){expect(validarReferenciaApac(r.validacao,{apac,prescricao:rx,sigtap})).toBe(true);expect(validarReferenciaApac(r.validacao,{apac:{...apac,versao:2},prescricao:rx,sigtap})).toBe(false);}
});
