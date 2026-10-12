import { expect, it } from "vitest";
import { conferirPrescricao } from "../../../src/modules/farmacia/duto.js";
import { registrarAdministracao } from "../../../src/modules/salao/administracao.js";
import { criarValidacaoPersistida, validarReferenciaApac, hashApac } from "../../../src/modules/apac/validacaoPersistida.js";
import { fonteSintetica } from "../../fixtures/triagem.js";
const ctx={patientId:"p",encounterId:"e",tumorLotId:"l",atorId:"m",em:"2026-10-12T08:00:00-03:00"};
const prescricao={patientId:"p",encounterId:"e",tumorLotId:"l",documentId:"rx",documentVersion:1,documentHash:"a".repeat(64),revisao:"ASSINADO" as const};
const apac={apacId:"ap",tumorLotId:"l",prescricaoAssinadaRef:{documentId:"rx",documentVersion:1},dataGeracaoApp:"2026-10-12",competencia:"2026-10",campos:{},estado:"RASCUNHO" as const,resultadoExterno:null,versao:1,substituiApacId:null};
const sigtap={competencia:"2026-10",versao:"v1",hash:"b".repeat(64)};
const antiglosa={apacId:"ap",competencia:"2026-10",achados:[],exportavel:true};
it.each(["patientId","encounterId","tumorLotId"] as const)("farmácia recusa escopo divergente %s",campo=>{
 expect(conferirPrescricao({prescricao:{...prescricao,[campo]:"outro"},acao:"CONFERIR"},ctx).ok).toBe(false);
});
it("pedido de correção exige motivo e mantém versão e hash",()=>{
 expect(conferirPrescricao({prescricao,acao:"PEDIR_CORRECAO"},ctx).ok).toBe(false);
 const r=conferirPrescricao({prescricao,acao:"PEDIR_CORRECAO",motivo:"Conferir documento"},ctx);
 expect(r).toMatchObject({ok:true,registro:{estado:"CORRECAO_PEDIDA",prescricao}});
});
const administracao={adminId:"a",cicloId:"c",prescricaoRef:{documentId:"rx",documentVersion:1},item:1,droga:"Droga Sintética",quantidadeEfetivaMg:50,status:"PARCIAL" as const,motivo:"interrupção documentada",inicio:"2026-10-12T07:00:00-03:00",fim:"2026-10-12T07:30:00-03:00",fonte:fonteSintetica("administracao")};
it("administração efetiva preserva quantidade informada e motivo; não importa dose prescrita",()=>{
 const r=registrarAdministracao({prescricao,administracao},ctx);
 expect(r).toMatchObject({ok:true,dados:{quantidadeEfetivaMg:50,status:"PARCIAL",motivo:"interrupção documentada"}});
});
it.each([
 {...administracao,status:"OMITIDA",quantidadeEfetivaMg:50},
 {...administracao,quantidadeEfetivaMg:-1},
 {...administracao,motivo:null},
 {...administracao,inicio:null},
 {...administracao,fim:"2026-10-12T06:00:00-03:00"},
 {...administracao,prescricaoRef:{documentId:"rx",documentVersion:2}},
 {...administracao,inicio:"2026-10-13T07:00:00-03:00"}
])("administração inválida ou futura não vira evento",a=>{
 expect(registrarAdministracao({prescricao,administracao:a},ctx).ok).toBe(false);
});
it("APAC com bloqueio ou outra competência nunca ganha validação persistível",()=>{
 expect(criarValidacaoPersistida({apac,prescricao,sigtap,antiglosa:{...antiglosa,exportavel:false}},ctx).ok).toBe(false);
 expect(criarValidacaoPersistida({apac,prescricao,sigtap:{...sigtap,competencia:"2026-09"},antiglosa},ctx).ok).toBe(false);
});
it("validação perde validade com campo, hash de prescrição ou versão SIGTAP alterados",()=>{
 const r=criarValidacaoPersistida({apac,prescricao,sigtap,antiglosa},ctx);expect(r.ok).toBe(true);
 if(!r.ok)return;
 expect(validarReferenciaApac(r.validacao,{apac:{...apac,campos:{cid:"C00"}},prescricao,sigtap})).toBe(false);
 expect(validarReferenciaApac(r.validacao,{apac,prescricao:{...prescricao,documentHash:"c".repeat(64)},sigtap})).toBe(false);
 expect(validarReferenciaApac(r.validacao,{apac,prescricao,sigtap:{...sigtap,versao:"v2"}})).toBe(false);
});
it("hash de conteúdo APAC independe da ordem das chaves",()=>{
 expect(hashApac({...apac,campos:{a:1,b:2}})).toBe(hashApac({...apac,campos:{b:2,a:1}}));
});
