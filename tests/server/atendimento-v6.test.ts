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
