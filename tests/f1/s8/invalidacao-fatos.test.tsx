// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OncoassistLocal } from "../../../src/ui/OncoassistLocal.js";
import { RevisaoExtracaoLocal } from "../../../src/ui/consulta/RevisaoExtracaoLocal.js";
import { criarPortaHttp } from "../../../src/ui/api/http.js";
import { criarPortaFalsa } from "../../../src/ui/api/fake.js";
import { salvarDraft } from "../../../src/kernel/ledger/drafts.js";
import { confirmar } from "../../../src/kernel/ledger/writeRouter.js";
import { abrirAmbiente,cadastrarPaciente,criarDiretorio,removerDiretorio,PACIENTE,ENCONTRO,SENHA,AGORA } from "../../f0-fecha/fixtures/consulta-completa.js";
import { usarEsperaDeJornadaHttpCompleta } from "../../fixtures/espera-jornada-http.js";
usarEsperaDeJornadaHttpCompleta();
let ambiente:Awaited<ReturnType<typeof abrirAmbiente>>|undefined;
afterEach(async()=>{cleanup();vi.unstubAllGlobals();if(ambiente){await ambiente.close();removerDiretorio(ambiente.dir);ambiente=undefined;}});
it("confirmação HTTP de laboratório atualiza irmã consulta automaticamente; preparação não invalida",async()=>{
 ambiente=await abrirAmbiente(criarDiretorio());cadastrarPaciente(ambiente);
 salvarDraft(ambiente.db,{draftId:"agenda-p",patientId:PACIENTE,sourceId:"agenda",rawRef:"sintetico",payload:{},diagnostics:[],revision:0,criadoEm:AGORA});
 confirmar(ambiente.db,{operationId:"agenda-p",patientId:PACIENTE,tumorLotId:null,encounterId:ENCONTRO,reviewDecisionId:"review-agenda",sessao:ambiente.sessoes.obter(ambiente.token)!,em:AGORA,registros:[{draftId:"agenda-p",expectedRevision:0,eventId:"agenda-p",tipo:"AgendaEntry",payload:{patientId:PACIENTE,encounterId:ENCONTRO,horario:"08:00",data:"2026-10-09"},fontes:[],revisao:"CONFIRMADO"}]});
 await ambiente.request("/consulta/carregar",{patientId:PACIENTE,encounterId:ENCONTRO});
 const source=await ambiente.request("/consulta/extrair",{sourceId:"fonte-refresh",recordingId:"recording-refresh",sourceType:"medical_note",rawTranscript:"09/10/2026 Creatinina 1,2 mg/dL"});
 expect(source.status).toBe(201);
 const leitura=await ambiente.request<{draft:{draftId:string}}>("/consulta/rascunho",{draftId:source.data.draftId});
 expect(leitura.status).toBe(200);expect(leitura.data.draft.draftId).toBe(source.data.draftId);
 expect((await ambiente.request("/consulta/rascunho/revisar",{draftId:source.data.draftId,expectedRevision:0,patientId:PACIENTE})).status).toBe(200);
 const http=globalThis.fetch,base=ambiente.baseUrl;
 vi.stubGlobal("fetch",(input:Parameters<typeof fetch>[0],init?:Parameters<typeof fetch>[1])=>http(typeof input==="string"&&input.startsWith("/")?`${base}${input}`:input,init));
 let porta!:ReturnType<typeof criarPortaHttp>;let recargas=0;let liberar: (()=>void)|undefined;
 render(<OncoassistLocal perfil="LEGADO" fabricaPorta={opcoes=>{
  porta=criarPortaHttp(opcoes);const original=porta.carregarConsulta.bind(porta);
  porta.carregarConsulta=async(...args)=>{recargas++;if(recargas===4)await new Promise<void>(r=>{liberar=r;});return original(...args);};return porta;
 }} />);
 fireEvent.change(screen.getByLabelText("Senha do servidor"),{target:{value:SENHA}});fireEvent.click(screen.getByRole("button",{name:"Entrar"}));
 fireEvent.change(await screen.findByLabelText("Paciente da agenda"),{target:{value:ENCONTRO}});
 await screen.findByRole("button",{name:"Reabrir histórico"});
 expect(within(screen.getByRole("region",{name:"Consulta persistida"})).getByText(/Evolução PENDENTE/)).toBeTruthy();
 fireEvent.change(await screen.findByLabelText("Fonte para revisão"),{target:{value:source.data.draftId}});
 const checkbox=(await within(await screen.findByRole("group",{name:"Achados para revisão"})).findAllByRole("checkbox"))[0]!;
 fireEvent.click(checkbox);fireEvent.click(screen.getByRole("button",{name:"Preparar revisão"}));
 const confirm=await screen.findByRole("button",{name:"Confirmar revisão exibida"});expect(recargas).toBe(3);
 fireEvent.click(confirm);await screen.findByText(/Revisão registrada/);
 await waitFor(()=>expect(recargas).toBe(4));
 expect(screen.queryByRole("button",{name:"Reabrir histórico"})).toBeNull();
 expect(screen.getByRole("region",{name:"Consulta persistida"}).textContent).toContain("Carregando consulta persistida");
 liberar?.();
 await waitFor(()=>expect(screen.getByRole("region",{name:"Consulta persistida"}).textContent).toContain("Creatinina"));
 expect((screen.getByLabelText("Paciente da agenda") as HTMLSelectElement).value).toBe(ENCONTRO);
 expect(ambiente.eventos().filter(e=>e.tipo==="FATO")).toHaveLength(1);
 expect(ambiente.eventos().every(e=>e.encounterId===ENCONTRO)).toBe(true);
 expect(ambiente.eventos().filter(e=>e.revisao==="ASSINADO")).toEqual([]);
});
it("confirmação tardia de outro contexto não notifica nem altera a revisão atual",async()=>{
 const contextoA={patientId:"p-a",encounterId:"e-a",tumorLotId:null};
 const fato={id:"f-a",segmentId:"seg-a",patientCandidateId:null,domain:"lab" as const,value:{marker:"creatinina",value:1.2,unit:"mg/dL"},sourceType:"medical_note" as const,evidence:"EXPLICIT" as const,sourceId:"fonte-a",rawEvidence:"Creatinina sintética 1,2 mg/dL",confidence:1,requiresConfirmation:false};
 let concluir!:(r:{codigo:"GRAVADA"})=>void;
 const callback=vi.fn();
 const porta={...criarPortaFalsa(),oncoassistFontes:async()=>({fontes:[{draftId:"d-a",rotulo:"Fonte sintética A",criadoEm:AGORA}]}),
  carregarFonteRevisao:async()=>({draft:{draftId:"d-a",patientId:"p-a",revision:1,payload:{kind:"EXTRACAO_RASCUNHO" as const,input:{sourceId:"fonte-a",rawTranscript:"Fonte sintética A"},state:{facts:[fato]},patientLinkReview:contextoA}}}),
  prepararRevisaoExtracao:async()=>({codigo:"REVISAO_PREPARADA" as const,criaEventoClinico:false as const,conteudo:{kind:"EVOLUCAO_RASCUNHO" as const,status:"RASCUNHO" as const,resumo:"Revisão sintética A",contexto:contextoA,selectedFactIds:["f-a"],facts:[fato]},comprovanteExibicao:{documentId:"proof-a",documentVersion:1,conteudoHash:"a".repeat(64)}}),
  confirmarRevisaoExtracao:()=>new Promise<{codigo:"GRAVADA"}>(resolve=>{concluir=resolve;})};
 const tela=render(<RevisaoExtracaoLocal porta={porta} contexto={contextoA} aoFatosConfirmados={callback}/>);
 fireEvent.change(await screen.findByLabelText("Fonte para revisão"),{target:{value:"d-a"}});
 fireEvent.click((await within(await screen.findByRole("group",{name:"Achados para revisão"})).findAllByRole("checkbox"))[0]!);fireEvent.click(screen.getByRole("button",{name:"Preparar revisão"}));
 fireEvent.click(await screen.findByRole("button",{name:"Confirmar revisão exibida"}));
 tela.rerender(<RevisaoExtracaoLocal porta={porta} contexto={{patientId:"p-b",encounterId:"e-b",tumorLotId:null}} aoFatosConfirmados={callback}/>);
 concluir({codigo:"GRAVADA"});
 await waitFor(()=>expect(screen.queryByText(/Revisão registrada/)).toBeNull());
 expect(callback).not.toHaveBeenCalled();expect(screen.queryByText("Revisão sintética A")).toBeNull();
});
