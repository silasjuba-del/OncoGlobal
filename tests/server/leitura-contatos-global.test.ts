import {criarResolverDocumentoLedger} from "../../src/kernel/ledger/documentos.js";
import {hashConteudoExibido} from "../../src/server/sessao.js";
import {afterEach,expect,it} from "vitest";
import {abrirAmbiente,cadastrarPaciente,criarDiretorio,removerDiretorio,PACIENTE,ENCONTRO,AGORA} from "../f0-fecha/fixtures/consulta-completa.js";
import {salvarDraft} from "../../src/kernel/ledger/drafts.js";
import {confirmar} from "../../src/kernel/ledger/writeRouter.js";
import {lerLedgerIntegro} from "../../src/kernel/ledger/leituraIntegra.js";
import {lerConsulta} from "../../src/server/leituras.js";
import {projetarVinculosContato} from "../../src/kernel/projections/vinculosContato.js";
import {projetarRetrato} from "../../src/kernel/projections/retrato/index.js";
import {dadosDoEvento} from "../../src/kernel/projections/snapshot.js";
import {Contato} from "../../src/contracts/clinico.js";
let a:Awaited<ReturnType<typeof abrirAmbiente>>;
afterEach(async()=>{if(a){await a.close();removerDiretorio(a.dir);a=undefined!;}});
it("decisao de contato A para B continua conflito global; retrato do paciente e identico",async()=>{
 a=await abrirAmbiente(criarDiretorio());cadastrarPaciente(a);cadastrarPaciente(a,"93");
 function gravar(id:string,patientId:string,tipo:string,payload:unknown){salvarDraft(a.db,{draftId:id,patientId,sourceId:"fonte",rawRef:"sintetico",payload:{},diagnostics:[],revision:0,criadoEm:AGORA});expect(confirmar(a.db,{operationId:id,patientId,encounterId:ENCONTRO,tumorLotId:null,reviewDecisionId:id,sessao:a.sessoes.obter(a.token)!,em:AGORA,registros:[{draftId:id,expectedRevision:0,eventId:id,tipo,payload,fontes:[],revisao:"CONFIRMADO"}]}).estado).toBe("GRAVADA");}
 gravar("contato-a",PACIENTE,"Contato",{contatoId:"contato-compartilhado",canal:"EMAIL",endereco:"sintetico@example.invalid",patientId:PACIENTE,relacao:"PACIENTE",vinculadoEm:AGORA,revogadoEm:null});
 gravar("transferencia-b","Paciente Teste 93","ReviewDecision",{kind:"VinculoContato",contatoId:"contato-compartilhado",sourceEventId:"contato-a",patientId:"Paciente Teste 93",encounterId:ENCONTRO,tumorLotId:null});
 gravar("fato-b","Paciente Teste 93","FATO",{campo:"observacao",valor:"nao pertence a A"});
 const global=lerLedgerIntegro(a.db).itens;
 const estreita=lerLedgerIntegro(a.db,{patientId:PACIENTE,contatosGlobais:true}).itens;
 expect(estreita.some(e=>e.eventId==="transferencia-b")).toBe(true);expect(estreita.some(e=>e.eventId==="fato-b")).toBe(false);
 const contatos=global.filter(e=>e.tipo==="Contato").map(event=>({event,value:Contato.parse(dadosDoEvento(event))}));
 expect(projetarVinculosContato(contatos,global)[0]).toMatchObject({estadoVinculo:"CONFLITO",patientIdResolvido:null});
 expect(projetarVinculosContato(contatos,estreita)).toEqual(projetarVinculosContato(contatos,global));
 const consulta=lerConsulta(a.db,PACIENTE,AGORA,a.sessoes.obter(a.token)!,null,{encounterId:ENCONTRO});
 expect("cabecalho" in consulta && consulta.cabecalho.contatosDesdeUltima).toEqual([]);
 const ctx={patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null,agora:AGORA,regras:[],biblioteca:{id:"sintetica",versao:"1",hash:"sintetico"}};
 expect(projetarRetrato(lerLedgerIntegro(a.db,PACIENTE).itens,ctx)).toEqual(projetarRetrato(global,ctx));
});

it("impressao e consulta rejeitam o mesmo documento fora do contrato",async()=>{
 a=await abrirAmbiente(criarDiretorio());cadastrarPaciente(a);
 for(const version of [0,1]){
  const id=`doc-${version}`,doc={documentId:id,documentVersion:version,texto:"Documento sintetico"};
  salvarDraft(a.db,{draftId:id,patientId:PACIENTE,sourceId:"fonte",rawRef:"local",payload:{},diagnostics:[],revision:0,criadoEm:AGORA});
  confirmar(a.db,{patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null,operationId:id,reviewDecisionId:id,sessao:a.sessoes.obter(a.token)!,em:AGORA,registros:[{draftId:id,expectedRevision:0,eventId:id,tipo:"DOCUMENTO",payload:{data:doc,signature:{documentId:id,documentVersion:version,documentHash:hashConteudoExibido(doc),reviewDecisionId:id,serverActorId:a.sessoes.obter(a.token)!.medicoId}},fontes:[],revisao:"ASSINADO"}]});
 }
 const leitura=lerLedgerIntegro(a.db,PACIENTE);expect(leitura.pendenciasIntegridade).toContainEqual(expect.objectContaining({eventoId:"doc-0",motivo:"PAYLOAD_FORA_DO_CONTRATO"}));
 const resolver=criarResolverDocumentoLedger(a.db);
 expect(await resolver.resolver({id:"doc-0",version:0})).toBeNull();
 expect(await resolver.resolver({id:"doc-1",version:1})).toMatchObject({id:"doc-1",version:1,patientId:PACIENTE,assinado:true});
});
