// Fixtures sintéticas; nenhuma conexão externa.
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";
import { autorizarLeitura, criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import { consultarCaixaCanal, receberTransporteSintetico, listarPendenciasCanal, retomarPendenciasCanal } from "../../src/server/canalEntrada.js";
import { relatosInfusaoPendentes } from "../../src/server/relatosInfusaoCanal.js";
import { listarEventos } from "../../src/kernel/comandos/portas.js";
import { ambiente, ctx, EM } from "../bateria2/fixtures.js";

const senha="senha-sintetica-auditoria";
it("relógio inválido não desbloqueia login nem autentica sessão; emissão futura também não autentica",()=>{
 let agora=EM;const g=criarGerenciadorSessao({medicoId:"medico-sintetico",crm:"CRM-TESTE",senha,duracaoMs:60000,agora:()=>agora});
 const login=g.login(senha)!;expect(login).not.toBeNull();
 agora="invalido";expect(g.bloqueadoPorTentativas?.()).toBe(true);
 expect(()=>g.login(senha)).not.toThrow();expect(g.login(senha)).toBeNull();expect(g.obter(login.token)).toBeNull();
 agora="2026-10-19T17:59:59Z";expect(g.obter(login.token)).toBeNull();
 agora=EM;expect(g.obter(login.token)?.medicoId).toBe("medico-sintetico");
});
it.each([NaN,Infinity])("duração de sessão não finita é rejeitada: %s",duracaoMs=>{
 expect(()=>criarGerenciadorSessao({medicoId:"m",crm:"CRM",senha,duracaoMs,agora:()=>EM})).toThrow("SESSAO_CONFIG_INVALIDA");
});
it("sessão retornada com expiração adulterada não autentica",()=>{
 const g=criarGerenciadorSessao({medicoId:"m",crm:"CRM",senha,duracaoMs:60000,agora:()=>EM});
 const login=g.login(senha)!;login.sessao.expiraEm="invalido";
 expect(g.obter(login.token)).toBeNull();
});
it("gateway recusa relógio parseável porém fora do contrato ISO",async()=>{
 let efeitos=0;const agora="2026-10-19 18:00:00Z";
 const sessao={medicoId:"m",crm:"CRM",emitidaEm:"2026-10-19T17:00:00Z",expiraEm:"2026-10-19T19:00:00Z"};
 const g=criarGateway({agora:()=>agora,auditar:()=>{},store:memoriaIdempotencia(),executores:{IMPRIMIR:{executar:async()=>{efeitos++;return {ok:true,recibo:"sintetico"};}}}});
 expect((await g.executar({verbo:"IMPRIMIR",objeto:{tipo:"DOCUMENT",id:"sintetico",versao:1},escopo:{patientId:ctx.patientId,encounterId:ctx.encounterId},destino:null,idempotencyKey:"clock-sintetico"},sessao)).decisao).toBe("NEGADA");
 expect(efeitos).toBe(0);expect(autorizarLeitura({},sessao,undefined,agora).motivoCodigo).toBe("SESSAO_EXPIRADA");
});
it("gateway não executa nem autoriza leitura com sessão emitida no futuro",async()=>{
 let efeitos=0;const g=criarGateway({agora:()=>EM,auditar:()=>{},store:memoriaIdempotencia(),
  executores:{IMPRIMIR:{executar:async()=>{efeitos++;return {ok:true,recibo:"recibo-sintetico"};}}}});
 const sessao={medicoId:"medico-sintetico",crm:"CRM",emitidaEm:"2026-10-19T18:01:00Z",expiraEm:"2026-10-19T19:00:00Z"};
 const r=await g.executar({verbo:"IMPRIMIR",objeto:{tipo:"DOCUMENT",id:"sintetico",versao:1},escopo:{patientId:ctx.patientId,encounterId:ctx.encounterId},destino:null,idempotencyKey:"op-sintetica"},sessao);
 expect(r.decisao).toBe("NEGADA");expect(efeitos).toBe(0);
 expect(autorizarLeitura({},sessao,undefined,EM)).toMatchObject({decisao:"NEGADA",motivoCodigo:"SESSAO_INVALIDA"});
});
function receber(a:ReturnType<typeof ambiente>,conhecido=false){
 const texto="Relato sintético de infusão",senderRef="contato-sintetico";
 const ack=receberTransporteSintetico(a.db,{accountId:"conta-sintetica",canal:"WHATSAPP_SERVICO",providerMessageId:"mensagem-sintetica",
  senderRef,providerSentAt:EM,ingestedAt:EM,conteudo:{tipo:"TEXT",texto,contentSha256:createHash("sha256").update(texto).digest("hex")},
  cadastros:conhecido?[{patientId:ctx.patientId,nome:"Paciente Sintético",chaveDemografica:null,identificadores:[{tipo:"TELEFONE",valor:senderRef}]}]:[]});
 expect(ack.ok).toBe(true);return senderRef;
}
it("retomada sem processador mantém pendência; callback explícito é necessário para resolver",()=>{
 const a=ambiente();try{receber(a);
 expect(retomarPendenciasCanal(a.db,{agora:EM})).toMatchObject({ok:true,retomadas:0,pendentesRestantes:1,processadasIds:[]});
 expect(listarPendenciasCanal(a.db)[0]?.estado).toBe("PENDENTE_PROCESSAMENTO");
 const ids:string[]=[];
 expect(retomarPendenciasCanal(a.db,{agora:EM,processador:m=>{ids.push(m.mensagemId);return {reciboTecnico:"PROCESSADA",mensagemId:m.mensagemId};}}))
  .toMatchObject({ok:true,retomadas:1,pendentesRestantes:0});
 expect(ids).toHaveLength(1);expect(listarPendenciasCanal(a.db)[0]?.estado).toBe("PROCESSADA");
 }finally{a.db.close();}
});
it("vínculo antigo do ingresso não atribui relato de infusão sem contato corrente",()=>{
 const a=ambiente();try{const sender=receber(a,true);
 expect(a.db.prepare("SELECT vinculoPatientId FROM canal_mensagem").get()!.vinculoPatientId).toBe(ctx.patientId);
 expect(relatosInfusaoPendentes(a.db,listarEventos(a.db,ctx.patientId),EM)).toEqual([]);
 expect(a.db.prepare("SELECT COUNT(*) AS n FROM canal_mensagem").get()!.n).toBe(1);
 const caixa=consultarCaixaCanal(a.db,a.acesso);expect(caixa.ok).toBe(true);
 if(caixa.ok)expect(caixa.mensagens).toHaveLength(1);
 a.seed("Contato",{contatoId:"contato-atual",canal:"WHATSAPP_SERVICO",endereco:sender,patientId:ctx.patientId,
  relacao:"PACIENTE",vinculadoEm:EM,revogadoEm:null});
 expect(relatosInfusaoPendentes(a.db,listarEventos(a.db,ctx.patientId),EM)).toHaveLength(1);
 }finally{a.db.close();}
});

