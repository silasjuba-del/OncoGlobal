import { afterEach,expect,it } from "vitest";
import { abrirAmbienteColon,cadastrarCasoColon,criarDiretorioColon,removerDiretorioColon,PACIENTE_ID,ENCONTRO_ATUAL,TUMOR_LOT_ID } from "../f0-fecha/fixtures/colon-e2e.js";
import { listarEventos } from "../../src/kernel/ledger/ledger.js";
import { lerDraft } from "../../src/kernel/ledger/drafts.js";
let a:Awaited<ReturnType<typeof abrirAmbienteColon>>|undefined;
afterEach(async()=>{if(a){await a.close();removerDiretorioColon(a.dir);a=undefined;}});
const ctx={patientId:PACIENTE_ID,encounterId:ENCONTRO_ATUAL,tumorLotId:TUMOR_LOT_ID};
async function abrir(){a=await abrirAmbienteColon(criarDiretorioColon());cadastrarCasoColon(a);await a.request("/consulta/carregar",ctx);return a;}
const pedido={...ctx,estado:"REMISSAO",data:"2026-10-12",fundamento:"Avaliação médica sintética, somente fixture."};
it("registro exige prévia íntegra e fica datado no histórico; retry não duplica",async()=>{
  const app=await abrir(),antes=listarEventos(app.db,PACIENTE_ID).length;
  const p=await app.request("/consulta/estado-doenca/preparar",pedido);expect(p.status,JSON.stringify(p.data)).toBe(200);
  expect(listarEventos(app.db,PACIENTE_ID)).toHaveLength(antes);
  const confirmar={...ctx,draftId:p.data.draftId,conteudoHash:p.data.conteudoHash};
  expect((await app.request("/consulta/estado-doenca/confirmar",{...confirmar,conteudoHash:"0".repeat(64)})).status).toBe(409);
  const c=await app.request("/consulta/estado-doenca/confirmar",confirmar);expect(c.status,JSON.stringify(c.data)).toBe(200);
  expect(c.data.codigo).toBe("GRAVADA");expect((await app.request("/consulta/estado-doenca/confirmar",confirmar)).data.codigo).toBe("REPLAY");
  expect(listarEventos(app.db,PACIENTE_ID)).toHaveLength(antes+1);
  const r=await app.request("/consulta/revisao-clinica",ctx);expect(r.status,JSON.stringify(r.data)).toBe(200);
  expect(r.data.estadosDoenca).toEqual([expect.objectContaining({estado:"REMISSAO",data:"2026-10-12",conflito:false})]);
  expect(r.data.estadosDoenca[0].fontes[0]).toMatchObject({classe:"MANUAL",dataClinica:"2026-10-12"});
});
it("recusa futuro, outro contexto e alteração do payload não exibida",async()=>{
  const app=await abrir();expect((await app.request("/consulta/estado-doenca/preparar",{...pedido,data:"2026-10-13"})).status).toBe(409);
  expect((await app.request("/consulta/estado-doenca/preparar",{...pedido,encounterId:"outro"})).status).toBe(409);
  const p=await app.request("/consulta/estado-doenca/preparar",pedido);expect(p.status).toBe(200);
  const draft=lerDraft(app.db,p.data.draftId)!,payload=structuredClone(draft.payload) as {pedido:{estado:string}};payload.pedido.estado="RECIDIVA";
  app.db.prepare("UPDATE draft_envelope SET payload=? WHERE draftId=?").run(JSON.stringify(payload),draft.draftId);
  expect((await app.request("/consulta/estado-doenca/confirmar",{...ctx,draftId:draft.draftId,conteudoHash:p.data.conteudoHash})).status).toBe(409);
});
it("sem evidência de exibição da sessão não confirma",async()=>{
  const app=await abrir(),p=await app.request("/consulta/estado-doenca/preparar",pedido);expect(p.status).toBe(200);
  app.sessoes.registrarBundleExibido(app.token,ctx,[]);
  expect((await app.request("/consulta/estado-doenca/confirmar",{...ctx,draftId:p.data.draftId,conteudoHash:p.data.conteudoHash})).data.codigo).toBe("CONTEUDO_NAO_EXIBIDO");
});
