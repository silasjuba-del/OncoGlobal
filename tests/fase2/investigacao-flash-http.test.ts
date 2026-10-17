import { expect,it } from "vitest";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";
import { criarServidorLocal } from "../../src/server/http.js";
import { criarGateway,memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import { salvarDraft,confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { listarDrafts } from "../../src/kernel/ledger/drafts.js";
import { adaptarPackDocumental } from "../../src/kernel/corpus/tumorPacks.js";
import { contexto,fonte,packOriginal } from "./fixtures.js";
import type { PlanoFlash } from "../../src/contracts/api/flash.js";
it("pack conferido só em memória → lacuna → minuta com fonte; referência alterada não prepara pedido",async()=>{
  const db=abrirLedger(":memory:"),agora=()=>"2026-10-16T12:00:00Z";
  const sessoes=criarGerenciadorSessao({medicoId:"medico-sintetico",crm:"CRM-SINTETICO",senha:"senha-sintetica-fase2",duracaoMs:60000,agora});
  const token=sessoes.login("senha-sintetica-fase2")!.token;
  const candidato=adaptarPackDocumental(packOriginal,"original-sintetico.json","a".repeat(64));
  // Promoção exclusiva da fixture em memória; nenhum corpus clínico é alterado.
  const pack={...candidato,estado:"ATIVO" as const,revisaoClinica:{medicoId:"medico-sintetico",em:agora(),hashOriginal:candidato.original.hash,hashExtracao:candidato.referencia.hash}};
  const gateway=criarGateway({agora,auditar:()=>{},store:memoriaIdempotencia(),executores:{}});
  const server=criarServidorLocal({db,sessoes,gateway,agora,log:()=>{},catalogoTumorPacks:{packs:[pack],rejeitados:[]}});
  await new Promise<void>(resolve=>server.once("listening",()=>resolve()));const addr=server.address();if(!addr||typeof addr==="string")throw Error("PORTA");
  const post=async(path:string,body:unknown)=>{const r=await fetch(`http://127.0.0.1:${addr.port}${path}`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(body)});return{status:r.status,data:await r.json() as Record<string,any>};};
  function seed(id:string,tipo:string,payload:unknown){salvarDraft(db,{draftId:id,patientId:contexto.patientId,sourceId:fonte.sourceId,rawRef:"fixture-sintetica",payload:{},diagnostics:[],revision:0,criadoEm:agora()});
    const r=confirmar(db,{...contexto,operationId:id,reviewDecisionId:id,sessao:sessoes.obter(token)!,em:agora(),registros:[{draftId:id,expectedRevision:0,eventId:id,tipo,payload,fontes:[fonte],revisao:"CONFIRMADO"}]});expect(r.estado).toBe("GRAVADA");}
  try{
    seed("paciente","Paciente",{patientId:contexto.patientId,nome:"Paciente Sintético Fase2",identificadores:[],nascimento:null,sexoCadastral:"NAO_INFORMADO",divergencia:false});
    const dado=(valor:string)=>({valor,estado:"VERDE",campo:"PRESENTE",motivo:"fixture",fontes:[fonte],revisao:"CONFIRMADO"});
    seed("lote","TumorLot",{tumorLotId:contexto.tumorLotId,patientId:contexto.patientId,cid:dado("C50"),topografia:dado("topografia sintética"),histologia:dado("histologia sintética"),estadiamentos:[],finalidadeApac:{...dado("Adjuvante"),valor:null,estado:"PENDENTE",campo:"NAO_INFORMADO"},marcos:[]});
    seed("histologia","FATO",{campo:"histologia",valor:"histologia sintética",dataClinica:"2026-10-16"});
    const aberto=await post("/consulta/carregar",contexto);expect(aberto.status,JSON.stringify(aberto.data)).toBe(200);
    const investigacao=await post("/consulta/investigacao",contexto);expect(investigacao.status,JSON.stringify(investigacao.data)).toBe(200);
    expect(investigacao.data.resultado?.propostas).toHaveLength(1);
    const proposta=investigacao.data.resultado.propostas[0];expect(proposta.categoria).toBe("IMAGEM");
    const plano:PlanoFlash={acoesMarcadas:[],receitasMarcadas:[],apac:{cid:"C50",sigtap:"",finalidade:"",competencia:"",estado:"PENDENTE",pendencias:[],emitir:false},
      retorno:{dias:null,examesAntesDoRetorno:[]},solicitacoes:{laboratorio:[],imagem:[proposta.exameCodigo]},
      propostasInvestigacao:[{exameCodigo:proposta.exameCodigo,contexto:proposta.contexto,referencia:pack.referencia,revisaoFatos:investigacao.data.revisao}]};
    const adulterado={...plano,propostasInvestigacao:plano.propostasInvestigacao!.map(p=>({...p,referencia:{...p.referencia,hash:"alterado"}}))};
    expect((await post("/consulta/flash/preparar",{...contexto,plano:adulterado,idempotencyKey:"forjado-sintetico"})).data.codigo).toBe("INVESTIGACAO_ALTERADA_REPREPARAR");
    const pronto=await post("/consulta/flash/preparar",{...contexto,plano,idempotencyKey:"pedido-sintetico"});
    expect(pronto.status,JSON.stringify(pronto.data)).toBeLessThan(300);
    const textos=listarDrafts(db,contexto.patientId).map(d=>JSON.stringify(d.payload)).join("\n");
    expect(textos).toContain("Fonte sintética");expect(textos).toContain(pack.referencia.hash);
  }finally{await new Promise<void>(r=>server.close(()=>r()));db.close();}
});
