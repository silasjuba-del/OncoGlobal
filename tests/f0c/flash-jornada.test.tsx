// @vitest-environment jsdom
// F0-COMPLEMENTO: interação real com React + porta HTTP + servidor local + SQLite; cadastro e agenda sintéticos são semeados.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TelaConsulta } from "../../src/ui/telas/TelaConsulta.js";
import { criarPortaHttp } from "../../src/ui/api/http.js";
import { criarChaves } from "../../src/ui/api/chaves.js";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { confirmar as confirmarNoLedger } from "../../src/kernel/ledger/writeRouter.js";
import { abrirAmbiente, cadastrarPaciente, criarDiretorio, removerDiretorio, PACIENTE, SENHA, AGORA } from "../f0-fecha/fixtures/consulta-completa.js";
let ambiente: Awaited<ReturnType<typeof abrirAmbiente>> | undefined;
let diretorio: string | undefined;
afterEach(async () => {
  cleanup(); vi.unstubAllGlobals();
  if(ambiente) { await ambiente.close(); ambiente=undefined; }
  if(diretorio) { removerDiretorio(diretorio); diretorio=undefined; }
});
it("salva seleção real, reabre após reinício e exibe documentos antes da assinatura", async () => {
  diretorio=criarDiretorio(); ambiente=await abrirAmbiente(diretorio);
  const contexto = cadastrarPaciente(ambiente);
  // A tela resolve o encontro explícito na agenda; usa o mesmo encontro real da fixture.
  const draftId = "agenda-flash-jornada-sintetica";
  salvarDraft(ambiente.db, { draftId, patientId: contexto.patientId, sourceId: draftId, rawRef: "fixture-local-sintetica",
    payload: {}, diagnostics: [], revision: 0, criadoEm: AGORA });
  expect(confirmarNoLedger(ambiente.db, { ...contexto, tumorLotId: null, operationId: "agenda-flash-jornada-operacao",
    reviewDecisionId: "agenda-flash-jornada-revisao", sessao: ambiente.sessoes.obter(ambiente.token)!, em: AGORA,
    registros: [{ draftId, expectedRevision: 0, eventId: "agenda-flash-jornada-evento", tipo: "AgendaEntry",
      payload: { ...contexto, data: AGORA.slice(0, 10), horario: "09:00" }, fontes: [], revisao: "CONFIRMADO" }] }).estado).toBe("GRAVADA");
  const fetchReal=globalThis.fetch.bind(globalThis);
  const chamadas:string[]=[];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const path=String(input); chamadas.push(path);
    return fetchReal(path.startsWith("/") ? `${ambiente!.baseUrl}${path}` : input, init);
  });
  async function montar() {
    const porta=criarPortaHttp({onSessaoExpirada:()=>{throw new Error("SESSAO_EXPIRADA");}});
    expect((await porta.login(SENHA)).ok).toBe(true);
    expect((await porta.agendaDoDia()).itens).toEqual([expect.objectContaining(contexto)]);
    render(<TelaConsulta patientId={PACIENTE} porta={porta} chaves={criarChaves()} />);
    fireEvent.click(await screen.findByRole("button",{name:"Consulta Flash"}));
    await screen.findByLabelText("Solicitações laboratoriais");
  }
  await montar();
  fireEvent.click(screen.getByRole("checkbox",{name:"HMG"}));
  fireEvent.click(screen.getByRole("checkbox",{name:"TC tórax"}));
  fireEvent.change(screen.getByLabelText("Outros LAB"),{target:{value:"INR"}});
  fireEvent.change(screen.getByLabelText("Prazo do retorno em dias"),{target:{value:"21"}});
  fireEvent.click(screen.getByRole("button",{name:"SALVAR RASCUNHO"}));
  await waitFor(()=>expect(screen.queryByRole("dialog",{name:"Consulta Flash"})).toBeNull());
  expect(ambiente.eventos().filter(e=>e.revisao==="ASSINADO")).toHaveLength(0);
  cleanup(); await ambiente.close(); ambiente=await abrirAmbiente(diretorio);
  await montar();
  expect((screen.getByRole("checkbox",{name:"HMG"}) as HTMLInputElement).checked).toBe(true);
  expect((screen.getByRole("checkbox",{name:"TC tórax"}) as HTMLInputElement).checked).toBe(true);
  expect((screen.getByLabelText("Outros LAB") as HTMLInputElement).value).toBe("INR");
  expect((screen.getByLabelText("Prazo do retorno em dias") as HTMLInputElement).value).toBe("21");
  expect((screen.getByRole("checkbox",{name:/Liberar ciclo/}) as HTMLInputElement).checked).toBe(false);
  fireEvent.click(screen.getByRole("button",{name:"REVISAR · IMPRIMIR"}));
  const confirmar=await screen.findByRole("button",{name:"CONFIRMAR E IMPRIMIR"});
  expect(ambiente.eventos().filter(e=>e.revisao==="ASSINADO")).toHaveLength(0);
  expect(chamadas.filter(p=>p==="/consulta/confirmar")).toHaveLength(0);
  // O médico pode ler os itens efetivamente gerados, não somente seus títulos.
  expect(screen.getByLabelText("Revisão dos documentos Flash").textContent).toContain("INR");
  expect(screen.getByLabelText("Revisão dos documentos Flash").textContent).toContain("TC tórax");
  fireEvent.click(confirmar);
  await waitFor(()=>expect(ambiente!.eventos().filter(e=>e.revisao==="ASSINADO").length).toBeGreaterThan(0));
  expect(chamadas.filter(p=>p==="/consulta/confirmar")).toHaveLength(1);
  expect(ambiente.eventos().filter(e=>JSON.stringify(e.payload).includes("FLASH_APAC"))).toHaveLength(0);
}, 30_000);

