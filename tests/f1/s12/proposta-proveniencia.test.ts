import { expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { bootServidorDemoB2, corpusCompartilhadoDemoB2 } from "./fixtures/servidor-demo-b2.js";
import { salvarDraft, lerDraft } from "../../../src/kernel/ledger/drafts.js";

it("proposta persiste a origem validada e recusa contexto ou template adulterado",async()=>{
  const dir=mkdtempSync(join(tmpdir(),"e2e-b2-f1-origem-"));
  const demo=await bootServidorDemoB2(dir);
  try{
    const login=await fetch(demo.manifesto.baseUrl+'/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({senha:demo.manifesto.senhaDemo})});
    const {token}=await login.json() as {token:string};
    const post=async(rota:string,body:unknown)=>{const r=await fetch(demo.manifesto.baseUrl+rota,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body)});return {status:r.status,body:await r.json() as any};};
    const contexto={patientId:demo.manifesto.b2.patientId,encounterId:demo.manifesto.b2.encounterId,tumorLotId:null};
    expect((await post('/consulta/contexto/selecionar',contexto)).status).toBe(200);
    const template=corpusCompartilhadoDemoB2!.templatesProtocolo.find(t=>/cemiplimabe__/i.test(t.templateId))!;
    demo.promoverTemplate(template.templateId);
    const rasc=await post('/consulta/prescricao/rascunho',{...contexto,templateId:template.templateId});expect(rasc.status).toBe(201);
    await post('/consulta/carregar',contexto);
    const itens=rasc.body.instanciacao.itens.filter((i:any)=>i.estado==='PRONTO').map((i:any)=>({...i.item,source:'MANUAL',overrideMotivo:'Fixture de software: proposta não assinada'}));
    const pedido={...contexto,id:'proposta-com-origem',operationId:'op-com-origem',expectedRevision:null,itens,rascunhoOrigemId:rasc.body.draftId};
    const salvo=await post('/consulta/prescricao/propor',pedido);expect(salvo.status,JSON.stringify(salvo.body)).toBe(201);
    const lido=await post('/consulta/rascunho',{draftId:salvo.body.draftId});
    expect(lido.body.draft.payload).toMatchObject({schema:'PrescricaoProposta@1',templateId:template.templateId,templateVersao:template.versao,templateHash:template.hash,rascunhoOrigemId:rasc.body.draftId,estado:'DRAFT'});
    const original=lerDraft(demo.app.db,rasc.body.draftId)!;
    const antes=demo.app.db.prepare('SELECT count(*) n FROM draft_envelope').get()!.n;
    for(const ataque of ['drug','dose','unit','days','omissao','duplicado','calculatedDose'] as const){
      const adulterados=structuredClone(itens);
      if(ataque==='drug')adulterados[0].drug='Fármaco sintético alheio';
      if(ataque==='dose')adulterados[0].prescribedDose+=1;
      if(ataque==='unit')adulterados[0].unit='unidade-alheia';
      if(ataque==='days')adulterados[0].days=['d99'];
      if(ataque==='calculatedDose')adulterados[0].calculatedDose+=1;
      if(ataque==='omissao')adulterados.push({...adulterados[0],sequence:999});
      if(ataque==='duplicado')adulterados.push(structuredClone(adulterados[0]));
      const negado=await post('/consulta/prescricao/propor',{...pedido,id:`itens-${ataque}`,operationId:`op-itens-${ataque}`,itens:adulterados});
      expect(negado,ataque).toMatchObject({status:409,body:{codigo:'ORIGEM_TEMPLATE_ITENS_DIVERGENTES'}});
    }
    expect(demo.app.db.prepare('SELECT count(*) n FROM draft_envelope').get()!.n).toBe(antes);
    const ajustados=structuredClone(itens);
    ajustados[0].prescribedDose=Math.floor(ajustados[0].calculatedDose*0.8+0.5);
    ajustados[0].adjustmentPercent=-20;ajustados[0].adjustmentReason='Ajuste médico sintético de teste';
    expect((await post('/consulta/prescricao/propor',{...pedido,id:'ajuste-sem-base',operationId:'op-ajuste-sem-base',itens:ajustados})).status).toBe(409);
    const payloadAjuste=structuredClone(original.payload) as any;
    payloadAjuste.instanciacao.itens.find((i:any)=>i.estado==='PRONTO').doseAnteriorPrescrita=itens[0].calculatedDose;
    salvarDraft(demo.app.db,{...original,draftId:'origem-ajuste-explicito',payload:payloadAjuste});
    expect((await post('/consulta/prescricao/propor',{...pedido,id:'ajuste-explicito',operationId:'op-ajuste-explicito',rascunhoOrigemId:'origem-ajuste-explicito',itens:ajustados})).status).toBe(201);
    for(const ataque of ['paciente','hash','contexto'] as const){
      const payload=structuredClone(original.payload) as any;
      if(ataque==='hash')payload.template.hash='0'.repeat(64);
      if(ataque==='contexto')payload.contexto.encounterId='outro-encontro';
      const id=`origem-${ataque}`;
      salvarDraft(demo.app.db,{...original,draftId:id,patientId:ataque==='paciente'?'outro-paciente':original.patientId,payload});
      expect((await post('/consulta/prescricao/propor',{...pedido,id:`proposta-${ataque}`,operationId:`op-${ataque}`,rascunhoOrigemId:id})).status).toBe(409);
    }
    expect((await post('/consulta/prescricao/propor',{...pedido,templateHash:'f'.repeat(64)})).status).toBe(400);
  }finally{await demo.app.close();rmSync(dir,{recursive:true,force:true});}
},30_000);
