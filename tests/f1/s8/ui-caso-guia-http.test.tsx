// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ConsultaPersistida } from "../../../src/ui/consulta/ConsultaPersistida.js";
import { criarPortaHttp } from "../../../src/ui/api/http.js";
import { listarDrafts } from "../../../src/kernel/ledger/drafts.js";
import { abrirAmbiente, cadastrarPaciente, criarDiretorio, removerDiretorio, ENCONTRO, PACIENTE, SENHA } from "../../f0-fecha/fixtures/consulta-completa.js";
import { usarEsperaDeJornadaHttpCompleta } from "../../fixtures/espera-jornada-http.js";
usarEsperaDeJornadaHttpCompleta();

let ambiente:Awaited<ReturnType<typeof abrirAmbiente>>|undefined;
afterEach(async()=>{cleanup();vi.unstubAllGlobals();if(ambiente){await ambiente.close();removerDiretorio(ambiente.dir);ambiente=undefined;}});

it.each([{salvar:true,cliques:6},{salvar:false,cliques:4}])("caso-guia sintético: cliques de UI→HTTP→bundle→assinatura→reabertura (salvar rascunho=$salvar)",async(caso)=>{
  ambiente=await abrirAmbiente(criarDiretorio());cadastrarPaciente(ambiente);
  const transporte=globalThis.fetch,baseUrl=ambiente.baseUrl,rotas:string[]=[];
  vi.stubGlobal("fetch",(input:Parameters<typeof fetch>[0],init?:Parameters<typeof fetch>[1])=>{
    const url=typeof input==="string"&&input.startsWith("/")?`${baseUrl}${input}`:input;
    rotas.push(new URL(String(url)).pathname);return transporte(url,init);
  });
  const porta=criarPortaHttp({onSessaoExpirada:()=>{throw Error("SESSAO_EXPIRADA_NO_CASO_GUIA");}});
  expect((await porta.login(SENHA)).ok).toBe(true);
  render(<ConsultaPersistida porta={porta} contexto={{patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null}}/>);
  await screen.findByRole("button",{name:"Consulta Flash"});
  let cliques=0;
  const clicar=(elemento:HTMLElement)=>{cliques++;fireEvent.click(elemento);};
  clicar(screen.getByRole("button",{name:"Consulta Flash"}));
  fireEvent.change(screen.getByLabelText("Prazo do retorno em dias"),{target:{value:"30"}});
  if(caso.salvar){
    clicar(screen.getByRole("button",{name:"SALVAR RASCUNHO"}));
    await waitFor(()=>expect(screen.queryByRole("dialog",{name:"Consulta Flash"})).toBeNull());
    await waitFor(()=>expect(listarDrafts(ambiente!.db).some(d=>d.patientId===PACIENTE&&d.payload&&typeof d.payload==="object"&&"kind" in d.payload&&d.payload.kind==="FLASH_RASCUNHO")).toBe(true));
    expect(ambiente.eventos().filter(e=>e.revisao==="ASSINADO")).toHaveLength(0);
    clicar(screen.getByRole("button",{name:"Consulta Flash"}));
    expect((screen.getByLabelText("Prazo do retorno em dias") as HTMLInputElement).value).toBe("30");
  }
  clicar(screen.getByRole("button",{name:"Revisar documentos para assinatura"}));
  const preview=await screen.findByRole("region",{name:"Conteúdo para assinatura"});
  const textos=[...preview.querySelectorAll("pre")].map(p=>p.textContent);
  expect(textos).toHaveLength(3);expect(textos.every(t=>t&&t.length>10)).toBe(true);
  expect(ambiente.eventos().filter(e=>e.revisao==="ASSINADO")).toHaveLength(0);
  clicar(within(preview).getByRole("button",{name:"Confirmar e assinar conteúdo exibido"}));
  await waitFor(()=>expect(ambiente!.eventos().filter(e=>e.revisao==="ASSINADO")).toHaveLength(3));
  await waitFor(()=>expect(screen.getByRole("region",{name:"Histórico de documentos assinados"}).querySelectorAll("article")).toHaveLength(3));
  const revisaoSigned=ambiente.eventos().filter(e=>e.revisao==="ASSINADO").map(e=>({eventId:e.eventId,payload:e.payload}));
  clicar(screen.getByRole("button",{name:"Reabrir histórico"}));
  await waitFor(()=>expect(screen.getByRole("region",{name:"Histórico de documentos assinados"}).querySelectorAll("article")).toHaveLength(3));
  expect(ambiente.eventos().filter(e=>e.revisao==="ASSINADO").map(e=>({eventId:e.eventId,payload:e.payload}))).toEqual(revisaoSigned);
  for(const texto of textos)expect(screen.getByRole("region",{name:"Histórico de documentos assinados"}).textContent).toContain(texto!);
  expect(rotas).toEqual(expect.arrayContaining(["/consulta/carregar",...(caso.salvar?["/consulta/flash/rascunho"]:[]),"/consulta/flash/preparar","/consulta/bundle","/consulta/confirmar","/acao"]));
  // Desde consulta pronta. Login, escolha da agenda e uma edição de texto ficam fora deste trecho.
  expect(cliques).toBe(caso.cliques);
});
