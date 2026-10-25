// Jornada HTTP/SQLite sintética. Sem provider externo ou dados reais.
import { afterEach, expect, it } from "vitest";
import { abrirAmbiente, cadastrarPaciente, carregarConsulta, criarDiretorio, removerDiretorio,
 PACIENTE, ENCONTRO, AGORA } from "../f0-fecha/fixtures/consulta-completa.js";
import { salvarDraft,lerDraft } from "../../src/kernel/comandos/portas.js";
import { executarConfirmacao } from "../../src/kernel/comandos/index.js";
const ctx={patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null};
let a:Awaited<ReturnType<typeof abrirAmbiente>>|undefined;
afterEach(async()=>{if(a){await a.close();removerDiretorio(a.dir);a=undefined;}});
async function abrir(){a=await abrirAmbiente(criarDiretorio());cadastrarPaciente(a);await carregarConsulta(a);return a;}
const entrada={hoje:"Fadiga G2 informada; sem febre referida.",decisao:"Conduta sintética explicitamente informada pelo médico.",saidas:["RESUMO","EVOLUCAO","PRESCRICAO"]};
async function mensagemChat(a:Awaited<ReturnType<typeof abrir>>,encontro=ENCONTRO){
 salvarDraft(a.db,{draftId:"chat-seed",patientId:PACIENTE,sourceId:"chat",rawRef:"chat",payload:{},diagnostics:[],revision:0,criadoEm:AGORA});
 executarConfirmacao(a.db,{...ctx,operationId:"chat-seed",reviewDecisionId:"chat-seed",sessao:a.sessoes.obter(a.token)!,em:AGORA,registros:[{
  draftId:"chat-seed",expectedRevision:0,eventId:"chat-seed",tipo:"ChatMessage",revisao:"CONFIRMADO",fontes:[],payload:{mensagemId:"msg",patientId:PACIENTE,encounterId:encontro,setor:"MEDICO",autor:"medico-sintetico",texto:"Mensagem sintética de origem"}}]});
}
it("chat grava só anotação rastreável e a recupera na evolução, sem alterar campos clínicos",async()=>{
 const a=await abrir();await mensagemChat(a);const antes=a.eventos();
 const base=await a.request("/consulta/atendimento/recuperar",ctx);
 const corpo={...ctx,expectedBaseHash:base.data.base.revisao,expectedVersion:null,idempotencyKey:"antes-chat",entrada};
 expect((await a.request("/consulta/atendimento/preparar",corpo)).status).toBe(201);
 const pedido={contexto:{...ctx,operationId:"aceite-chat"},mensagemId:"msg",decisao:{campo:"observacao",valor:"Não refere febre; conferir relato na próxima avaliação."}};
 for(const campo of ["alergias","medicamentos","tnm","estadoDoenca"]){
  expect((await a.request("/chat/aceitar-decisao",{...pedido,decisao:{campo,valor:"não aplicar"}})).status).toBe(409);
  expect(a.eventos()).toEqual(antes);
 }
 expect((await a.request("/chat/aceitar-decisao",pedido)).status).toBe(200);
 const novos=a.eventos().filter(e=>!antes.some(x=>x.eventId===e.eventId));expect(novos).toHaveLength(1);
 expect(novos[0]!.tipo).toBe("AnotacaoEvolucao");expect(novos[0]!.criadoPor.id).toBe(a.sessoes.obter(a.token)!.medicoId);
 expect((await a.request("/chat/aceitar-decisao",pedido)).data.codigo).toBe("REPLAY");
 expect(a.eventos()).toHaveLength(antes.length+1);
 expect((await a.request("/chat/aceitar-decisao",{...pedido,decisao:{campo:"observacao",valor:"alterado"}})).status).toBe(409);
 const atual=await a.request("/consulta/atendimento/recuperar",ctx);expect(atual.status).toBe(200);
 expect(atual.data.estadoRascunho).toBe("DESATUALIZADO");expect(atual.data.base.revisao).not.toBe(base.data.base.revisao);
 expect(atual.data.base.citacoes).toEqual(base.data.base.citacoes);
 expect(atual.data.base.anotacoesChat).toEqual([expect.objectContaining({texto:pedido.decisao.valor,mensagemId:"msg",eventId:novos[0]!.eventId})]);
 const r=await a.request("/consulta/atendimento/preparar",{...corpo,idempotencyKey:"apos-chat",expectedVersion:1,expectedBaseHash:atual.data.base.revisao});
 expect(r.status).toBe(201);
 for(const d of r.data.rascunho.documentos as {tipo:string;texto:string}[]){
  if(d.tipo==="EVOLUCAO"){expect(d.texto).toContain("ANOTAÇÕES MÉDICAS ACEITAS DO CHAT");expect(d.texto).toContain(pedido.decisao.valor);}
  else expect(d.texto).not.toContain(pedido.decisao.valor);
 }
 a.sessoes.selecionarConsulta(a.token,{...ctx,encounterId:"outro-encontro"});
 const outro=await a.request("/consulta/atendimento/recuperar",{...ctx,encounterId:"outro-encontro"});
 expect(outro.status).toBe(200);expect(JSON.stringify(outro.data)).not.toContain(pedido.decisao.valor);
 a.sessoes.selecionarConsulta(a.token,ctx);
 // Evento sintético com referência inválida, sem desativar a imutabilidade do ledger.
 const adulterado=structuredClone(novos[0]!.payload) as {data:{origemMensagem:{contentHash:string}}};adulterado.data.origemMensagem.contentHash="0".repeat(64);
 salvarDraft(a.db,{draftId:"nota-invalida",patientId:PACIENTE,sourceId:"teste",rawRef:"teste",payload:{},diagnostics:[],revision:0,criadoEm:AGORA});
 executarConfirmacao(a.db,{...ctx,operationId:"nota-invalida",reviewDecisionId:"nota-invalida",sessao:a.sessoes.obter(a.token)!,em:AGORA,
  registros:[{draftId:"nota-invalida",expectedRevision:0,eventId:"nota-invalida",tipo:"AnotacaoEvolucao",payload:adulterado.data,fontes:[],revisao:"CONFIRMADO",supersedesEventId:novos[0]!.eventId}]});
 const pendente=await a.request("/consulta/atendimento/recuperar",ctx);expect(pendente.status).toBe(200);
 expect(pendente.data.base.anotacoesChat).toEqual([]);expect(pendente.data.base.pendenciasAnotacoes).toHaveLength(1);
 const parcial=await a.request("/consulta/atendimento/preparar",{...corpo,idempotencyKey:"nota-invalida",expectedVersion:2,expectedBaseHash:pendente.data.base.revisao});
 expect(parcial.status).toBe(201);
 expect(parcial.data.rascunho.documentos).toEqual(expect.arrayContaining([
  expect.objectContaining({tipo:"RESUMO",estado:"PRONTO_PARA_REVISAO"}),expect.objectContaining({tipo:"EVOLUCAO",estado:"PENDENTE"})]));
 expect(JSON.stringify(parcial.data.rascunho.documentos)).not.toContain(pedido.decisao.valor);
});
it("chat recusa mensagem cujo contexto interno diverge sem gravar anotação",async()=>{
 const a=await abrir();await mensagemChat(a,"encontro-divergente");const antes=a.eventos();
 expect((await a.request("/chat/aceitar-decisao",{contexto:{...ctx,operationId:"chat-invalido"},mensagemId:"msg",decisao:{campo:"observacao",valor:"não gravar"}})).status).toBe(409);
 expect(a.eventos()).toEqual(antes);
});
it("recupera antes de perguntar e gera rascunhos com decisão literal e pendência somente na saída dependente",async()=>{
 const a=await abrir(),antes=a.eventos();
 const base=await a.request("/consulta/atendimento/recuperar",ctx);expect(base.status).toBe(200);
 expect(base.data.rascunho).toBeNull();expect(base.data.base.pacienteNome).toBe(PACIENTE);
 const pedido={...ctx,expectedBaseHash:base.data.base.revisao,expectedVersion:null,idempotencyKey:"v6-sintetico",entrada};
 const r=await a.request("/consulta/atendimento/preparar",pedido);expect(r.status).toBe(201);
 expect(r.data.criaEventoClinico).toBe(false);expect(r.data.rascunho.autor.medicoId).toBe(a.sessoes.obter(a.token)!.medicoId);
 expect(r.data.rascunho.dataClinica).toBe(base.data.base.dataReferencia);
 const docs=r.data.rascunho.documentos as {tipo:string;texto:string;estado:string;pendencias:string[]}[];
 expect(docs.find(d=>d.tipo==="RESUMO")?.estado).toBe("PRONTO_PARA_REVISAO");
 expect(docs.find(d=>d.tipo==="EVOLUCAO")?.texto).toContain(entrada.decisao);
 expect(docs.find(d=>d.tipo==="EVOLUCAO")?.texto).toContain("sem febre referida");
 expect(docs.find(d=>d.tipo==="PRESCRICAO")?.estado).toBe("FLUXO_ESPECIFICO_NECESSARIO");
 expect(docs.find(d=>d.tipo==="RESUMO")?.texto).not.toContain("TRIALS");
 expect(a.eventos()).toEqual(antes);
 expect((await a.request("/consulta/atendimento/preparar",pedido)).data.codigo).toBe("ATENDIMENTO_REPLAY");
 const recuperado=await a.request("/consulta/atendimento/recuperar",ctx);
 expect(recuperado.data.rascunho).toEqual(r.data.rascunho);
 expect((await a.request("/consulta/atendimento/preparar",{...pedido,entrada:{...entrada,decisao:"outra"}})).status).toBe(409);
 expect((await a.request("/consulta/bundle",{...ctx,draftIds:[r.data.rascunho.id]})).status).toBe(409);
});
it("decisão ausente não é inventada e não bloqueia o resumo",async()=>{
 const a=await abrir();const base=await a.request("/consulta/atendimento/recuperar",ctx);expect(base.status).toBe(200);
 const r=await a.request("/consulta/atendimento/preparar",{...ctx,expectedBaseHash:base.data.base.revisao,expectedVersion:null,
  idempotencyKey:"sem-decisao",entrada:{...entrada,decisao:"",saidas:["RESUMO","EVOLUCAO"]}});expect(r.status).toBe(201);
 expect(r.data.rascunho.documentos).toEqual(expect.arrayContaining([
  expect.objectContaining({tipo:"RESUMO",estado:"PRONTO_PARA_REVISAO"}),
  expect.objectContaining({tipo:"EVOLUCAO",estado:"PENDENTE",pendencias:expect.arrayContaining(["Decisão médica de hoje não informada."])})]));
});
it("contexto divergente e versão concorrente recusam sem sobrescrever rascunho",async()=>{
 const a=await abrir();expect((await a.request("/consulta/atendimento/recuperar",{...ctx,patientId:"outro"})).status).toBe(409);
 const base=await a.request("/consulta/atendimento/recuperar",ctx);expect(base.status).toBe(200);
 const pedido={...ctx,expectedBaseHash:base.data.base.revisao,expectedVersion:null,idempotencyKey:"primeira",entrada};
 const r=await a.request("/consulta/atendimento/preparar",pedido);expect(r.status).toBe(201);
 expect((await a.request("/consulta/atendimento/preparar",{...pedido,idempotencyKey:"segunda"})).status).toBe(409);
 expect((await a.request("/consulta/atendimento/recuperar",ctx)).data.rascunho).toEqual(r.data.rascunho);
});
it("preserva fonte/data, ignora resumo secundário não revisado e detecta retrato alterado",async()=>{
 const a=await abrir();const base=await a.request("/consulta/atendimento/recuperar",ctx);
 const pedido={...ctx,expectedBaseHash:base.data.base.revisao,expectedVersion:null,idempotencyKey:"historico-v6",entrada};
 expect((await a.request("/consulta/atendimento/preparar",pedido)).status).toBe(201);
 salvarDraft(a.db,{draftId:"fonte",patientId:PACIENTE,sourceId:"laudo-sintetico",rawRef:"referencia-local",revision:0,criadoEm:AGORA,diagnostics:[],payload:{contexto:ctx}});
 executarConfirmacao(a.db,{...ctx,operationId:"fato-novo",reviewDecisionId:"review-fonte",sessao:a.sessoes.obter(a.token)!,em:AGORA,
  registros:[{draftId:"fonte",expectedRevision:0,eventId:"fato-histologia",tipo:"FATO",revisao:"CONFIRMADO",payload:{campo:"histologia",valor:"Histologia sintética documentada",dataClinica:"2026-08-01"},
   fontes:[{sourceId:"laudo-sintetico",classe:"DOCUMENT",localizador:"página 1",dataClinica:"2026-08-01",dataCaptura:AGORA,versao:"1",contentHash:"a".repeat(64)}]}]});
 salvarDraft(a.db,{draftId:"secundario",patientId:PACIENTE,sourceId:"llm",rawRef:"referencia-local",revision:0,criadoEm:AGORA,diagnostics:[],payload:{kind:"SINTESE_RASCUNHO",texto:"FATO INVENTADO SENTINELA"}});
 const atual=await a.request("/consulta/atendimento/recuperar",ctx);expect(atual.status).toBe(200);
 expect(atual.data.estadoRascunho).toBe("DESATUALIZADO");expect(JSON.stringify(atual.data)).not.toContain("FATO INVENTADO SENTINELA");
 expect(JSON.stringify(atual.data.base.citacoes)).toContain("2026-08-01");expect(JSON.stringify(atual.data.base.citacoes)).toContain("laudo-sintetico");
 expect((await a.request("/consulta/atendimento/preparar",{...pedido,idempotencyKey:"base-antiga",expectedVersion:1})).status).toBe(409);
 const revisado=await a.request("/consulta/atendimento/preparar",{...pedido,idempotencyKey:"base-atual",expectedVersion:1,expectedBaseHash:atual.data.base.revisao});
 expect(revisado.status).toBe(201);expect(revisado.data.rascunho.documentos[0].texto).toContain("página 1");
 expect(revisado.data.rascunho.documentos[0].texto).toContain("versão 1");
});
it("unidade explicitamente registrada permanece no resumo; hash do pedido adulterado invalida leitura",async()=>{
 const a=await abrir();salvarDraft(a.db,{draftId:"lab",patientId:PACIENTE,sourceId:"lab",rawRef:"referencia-local",payload:{},diagnostics:[],revision:0,criadoEm:AGORA});
 executarConfirmacao(a.db,{...ctx,operationId:"lab",reviewDecisionId:"lab",sessao:a.sessoes.obter(a.token)!,em:AGORA,registros:[{
  draftId:"lab",expectedRevision:0,eventId:"lab",tipo:"LabResult",revisao:"CONFIRMADO",fontes:[],payload:{campo:"creatinina",valor:1.2,unidade:"mg/dL",data:"2026-10-01",sourceId:"lab"}}]});
 const base=await a.request("/consulta/atendimento/recuperar",ctx);const r=await a.request("/consulta/atendimento/preparar",{...ctx,
  expectedBaseHash:base.data.base.revisao,expectedVersion:null,idempotencyKey:"unidade",entrada});
 expect(r.status).toBe(201);expect(r.data.rascunho.documentos[0].texto).toContain("mg/dL");
 const draft=lerDraft(a.db,r.data.rascunho.id)!,payload=structuredClone(draft.payload) as {requestHash:string};payload.requestHash="b".repeat(64);
 a.db.prepare("UPDATE draft_envelope SET payload=? WHERE draftId=?").run(JSON.stringify(payload),draft.draftId);
 expect((await a.request("/consulta/atendimento/recuperar",ctx)).status).toBe(409);
});
it("adulterar contexto armazenado não transfere texto de rascunho para outro encontro",async()=>{
 const a=await abrir();const base=await a.request("/consulta/atendimento/recuperar",ctx);
 const r=await a.request("/consulta/atendimento/preparar",{...ctx,expectedBaseHash:base.data.base.revisao,expectedVersion:null,idempotencyKey:"hash-contexto",entrada});
 expect(r.status).toBe(201);const draft=lerDraft(a.db,r.data.rascunho.id)!;
 const payload=structuredClone(draft.payload) as {contexto:typeof ctx};payload.contexto.encounterId="outro-encontro";
 a.db.prepare("UPDATE draft_envelope SET payload=? WHERE draftId=?").run(JSON.stringify(payload),draft.draftId);
 a.sessoes.selecionarConsulta(a.token,{...ctx,encounterId:"outro-encontro"});
 const lido=await a.request("/consulta/atendimento/recuperar",{...ctx,encounterId:"outro-encontro"});
 expect(lido.status).toBe(409);expect(JSON.stringify(lido.data)).not.toContain(entrada.decisao);
});
