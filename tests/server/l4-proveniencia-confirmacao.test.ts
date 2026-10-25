// Dados sintéticos; HTTP e SQLite reais.
import { afterEach,expect,it } from "vitest";
import { createHash } from "node:crypto";
import { Fonte } from "../../src/contracts/base.js";
import { ConfirmarBloco } from "../../src/contracts/operacao.js";
import { confirmar as gravarLegado } from "../../src/kernel/ledger/writeRouter.js";
import { lerDraft,salvarDraft } from "../../src/kernel/comandos/portas.js";
import { executarConfirmacao } from "../../src/kernel/comandos/index.js";
import { abrirAmbiente,cadastrarPaciente,carregarConsulta,criarDiretorio,removerDiretorio,finalizarFlash,
 PACIENTE,ENCONTRO,AGORA } from "../f0-fecha/fixtures/consulta-completa.js";
let a:Awaited<ReturnType<typeof abrirAmbiente>>|undefined;
afterEach(async()=>{if(a){await a.close();removerDiretorio(a.dir);a=undefined;}});
const ctx={patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null};
async function abrir(){a=await abrirAmbiente(criarDiretorio());cadastrarPaciente(a);await carregarConsulta(a);return a;}
it("confirmação Flash conserva as fontes já exibidas no envelope e replay não duplica",async()=>{
 const a=await abrir(),{preparada}=await finalizarFlash(a,"l4-fontes-flash");expect(preparada.status).toBe(200);
 const fontes=new Map(preparada.data.registros.map(r=>{const d=lerDraft(a.db,r.id)!;return [r.id,Fonte.array().min(1).parse((d.payload as {fontes:unknown}).fontes)] as const;}));
 await a.request("/consulta/bundle",ctx);
 const pedido={...ctx,bloco:"TUDO",registros:preparada.data.registros,documentosExibidos:preparada.data.documentos.map(({documentId,documentVersion})=>({documentId,documentVersion})),reconhecerAlertas:[],idempotencyKey:"l4-assinar-fontes"};
 const r=await a.request("/consulta/confirmar",pedido);expect(r.status).toBe(200);
 for(const e of a.eventos().filter(e=>e.operationId===pedido.idempotencyKey&&e.tipo==="DOCUMENTO")){
  const dados=e.payload as {data:{data:{documentId:string}}};expect(e.fontes).toEqual(fontes.get(dados.data.data.documentId));
 }
 const antes=a.eventos();expect((await a.request("/consulta/confirmar",pedido)).data.codigo).toBe("REPLAY");expect(a.eventos()).toEqual(antes);
});
it.each(["hash-curto","fonte-invalida"])("fonte declarada inválida não é descartada silenciosamente: %s",async ataque=>{
 const a=await abrir();const fonte={sourceId:"fonte",classe:"DOCUMENT",localizador:"página 1",dataClinica:null,dataCaptura:AGORA,versao:"1",contentHash:ataque==="hash-curto"?"hash-curto":"a".repeat(64)};
 const payload={contexto:ctx,campo:"observacao",valor:"Texto sintético",fontes:ataque==="fonte-invalida"?[{sourceId:"incompleta"}]:[fonte]};
 salvarDraft(a.db,{draftId:"fato",patientId:PACIENTE,sourceId:"fonte",rawRef:"referencia-local",payload,diagnostics:[],revision:0,criadoEm:AGORA});
 const bundle=await a.request("/consulta/bundle",{...ctx,draftIds:["fato"]});expect(bundle.status).toBe(200);
 const antes=a.eventos();const r=await a.request("/consulta/confirmar",{...ctx,bloco:"TUDO",registros:[{id:"fato",expectedRevision:0}],
  documentosExibidos:[{documentId:"fato",documentVersion:1}],reconhecerAlertas:[],idempotencyKey:"fonte-invalida-op"});
 expect(r.status).toBe(409);expect(a.eventos()).toEqual(antes);expect(lerDraft(a.db,"fato")!.revision).toBe(0);
 expect(a.db.prepare("SELECT 1 FROM operation WHERE operationId=?").get("fonte-invalida-op")).toBeUndefined();
});
it("porta comum recusa descarte ou substituição das fontes declaradas no draft",async()=>{
 const a=await abrir(),fonte:Fonte={sourceId:"fonte",classe:"DOCUMENT",localizador:"página 1",dataClinica:null,dataCaptura:AGORA,versao:"1",contentHash:"a".repeat(64)};
 const payload={contexto:ctx,campo:"observacao",valor:"Declaração sintética",fontes:[fonte]};
 salvarDraft(a.db,{draftId:"comum",patientId:PACIENTE,sourceId:"fonte",rawRef:"referencia-local",payload,diagnostics:[],revision:0,criadoEm:AGORA});
 const req={...ctx,operationId:"comum-op",reviewDecisionId:"comum-review",sessao:a.sessoes.obter(a.token)!,em:AGORA,
  registros:[{draftId:"comum",expectedRevision:0,eventId:"comum-event",tipo:"FATO",payload,fontes:[] as Fonte[],revisao:"CONFIRMADO" as const}]};
 expect(()=>executarConfirmacao(a.db,req)).toThrow("PROVENIENCIA_DIVERGENTE");
 expect(()=>executarConfirmacao(a.db,{...req,registros:[{...req.registros[0]!,fontes:[{...fonte,contentHash:"b".repeat(64)}]}]})).toThrow("PROVENIENCIA_DIVERGENTE");
 expect(a.eventos().some(e=>e.operationId===req.operationId)).toBe(false);
});
it.each(["vazias","hash-legado"])("replay preserva fontes históricas %s sem migração retroativa",async modo=>{
 const a=await abrir(),sessao=a.sessoes.obter(a.token)!;
 const fonte:Fonte={sourceId:"fonte",classe:"MANUAL",localizador:null,dataClinica:null,dataCaptura:AGORA,versao:"1",contentHash:"a".repeat(64)};
 const payload={contexto:ctx,campo:"observacao",valor:"Registro histórico sintético",fontes:[fonte]};
 salvarDraft(a.db,{draftId:"legado",patientId:PACIENTE,sourceId:"fonte",rawRef:"referencia-local",payload,diagnostics:[],revision:0,criadoEm:AGORA});
 const pedido=ConfirmarBloco.parse({...ctx,bloco:"TUDO",registros:[{id:"legado",expectedRevision:0}],documentosExibidos:[{documentId:"legado",documentVersion:1}],reconhecerAlertas:[],idempotencyKey:"op-legada"});
 await a.request("/consulta/bundle",{...ctx,draftIds:["legado"]});
 const sha=(s:string)=>createHash("sha256").update(s).digest("hex");
 const fontes=modo==="vazias"?[]:[{...fonte,contentHash:"hash-legado"}];
 expect(gravarLegado(a.db,{...ctx,operationId:pedido.idempotencyKey,reviewDecisionId:sha(JSON.stringify({input:pedido,medicoId:sessao.medicoId})),sessao,em:AGORA,
  registros:[{draftId:"legado",expectedRevision:0,eventId:sha("op-legada:legado:0"),tipo:"FATO",payload,fontes,revisao:"CONFIRMADO"}]}).estado).toBe("GRAVADA");
 const antes=a.eventos();const r=await a.request("/consulta/confirmar",pedido);
 expect(r.status).toBe(200);expect(r.data.codigo).toBe("REPLAY");expect(a.eventos()).toEqual(antes);
 expect((await a.request("/consulta/confirmar",{...pedido,reconhecerAlertas:["id-alterado"]})).status).toBe(409);
 expect(a.eventos()).toEqual(antes);
});
