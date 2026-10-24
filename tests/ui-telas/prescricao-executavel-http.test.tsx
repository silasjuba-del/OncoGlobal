// @vitest-environment jsdom
// Dados integralmente sintéticos; interface, transporte HTTP e SQLite reais.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { OncoassistLocal } from "../../src/ui/OncoassistLocal.js";
import { executarConfirmacao } from "../../src/kernel/comandos/index.js";
import { salvarDraft } from "../../src/kernel/comandos/portas.js";
import { dadosDoEvento } from "../../src/kernel/projections/snapshot.js";
import { abrirAmbiente, cadastrarPaciente, criarDiretorio, removerDiretorio,
  PACIENTE, ENCONTRO, SENHA, AGORA } from "../f0-fecha/fixtures/consulta-completa.js";
import { fonteSintetica, presente } from "../fixtures/triagem.js";
import { usarEsperaDeJornadaHttpCompleta } from "../fixtures/espera-jornada-http.js";
usarEsperaDeJornadaHttpCompleta();

const ambientes: Awaited<ReturnType<typeof abrirAmbiente>>[] = [];
afterEach(async () => {
  cleanup(); vi.unstubAllGlobals();
  for (const a of ambientes.splice(0)) { await a.close(); removerDiretorio(a.dir); }
});
const alterar = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

it("prescreve dose fracionada pelo consultório real, protege a revisão e atualiza estatística após assinar", async () => {
  const a = await abrirAmbiente(criarDiretorio()); ambientes.push(a); cadastrarPaciente(a);
  const tumorLotId = "lote-editor-http-sintetico";
  let n = 0;
  const seed = (tipo: string, payload: unknown, lote: string | null) => {
    const id = `editor-http-${++n}`;
    salvarDraft(a.db, { draftId: id, patientId: PACIENTE, sourceId: id, rawRef: "referencia-local",
      payload: {}, diagnostics: [], revision: 0, criadoEm: AGORA });
    executarConfirmacao(a.db, { operationId: id, patientId: PACIENTE, encounterId: ENCONTRO,
      tumorLotId: lote, reviewDecisionId: id, sessao: a.sessoes.obter(a.token)!, em: AGORA,
      registros: [{ draftId: id, expectedRevision: 0, eventId: id, tipo, payload,
        fontes: [fonteSintetica(id)], revisao: "CONFIRMADO" }] });
  };
  seed("AgendaEntry", { patientId: PACIENTE, encounterId: ENCONTRO, horario: "10:00", data: AGORA.slice(0, 10) }, null);
  seed("Alerta", {alertaId:"rx-ui-vermelho",alvo:{patientId:PACIENTE},natureza:"AMEACA_IMEDIATA",classeRisco:null,
    texto:"Alerta sintético para ciência da prescrição",origemRegra:"regra-sintetica",evidencias:[],
    presentationOverride:true,authorityOverride:false,reconhecidoEm:null,destino:"CHAT"}, null);
  seed("TumorLot", { patientId: PACIENTE, tumorLotId, cid: presente("C50"),
    topografia: presente("Topografia sintética"), histologia: presente("Histologia sintética"),
    estadiamentos: [], finalidadeApac: presente("PALIATIVA"), marcos: [] }, tumorLotId);
  const transporte = globalThis.fetch;
  vi.stubGlobal("fetch", (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
    transporte(typeof input === "string" && input.startsWith("/") ? `${a.baseUrl}${input}` : input, init));
  render(<OncoassistLocal />);
  alterar("Senha do servidor", SENHA);
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
  await screen.findByLabelText("Paciente da agenda");
  alterar("Paciente da agenda", ENCONTRO);
  await screen.findByLabelText("Lote tumoral");
  await waitFor(() => expect((screen.getByLabelText("Lote tumoral") as HTMLSelectElement).disabled).toBe(false));
  alterar("Lote tumoral", tumorLotId);
  await waitFor(() => {
    expect((screen.getByLabelText("Lote tumoral") as HTMLSelectElement).disabled).toBe(false);
    expect(screen.getByRole("region", { name: "Identificação da consulta" }).textContent).toContain(tumorLotId);
  });
  fireEvent.click(await screen.findByRole("button", { name: "Prescrição estruturada" }));
  await screen.findByRole("region", { name: "Editor de prescrição executável" });
  await waitFor(() => expect((screen.getByLabelText("Protocolo ou esquema") as HTMLInputElement).disabled).toBe(false));
  // fieldset disabled is inherited rather than reflected on input.disabled.
  await waitFor(() => expect((screen.getByRole("button", { name: "Preparar prévia exata" }) as HTMLButtonElement).disabled).toBe(false));
  alterar("Protocolo ou esquema", "Esquema manual sintético");
  expect((screen.getByLabelText("Protocolo ou esquema") as HTMLInputElement).value).toBe("Esquema manual sintético");
  alterar("Linha terapêutica", "1");
  alterar("Intenção terapêutica", "PALIATIVA");
  alterar("Número do ciclo", "1");
  alterar("Data prevista", "2026-10-20");
  alterar("Motivo da prescrição", "Prescrição sintética explicitamente revista");
  fireEvent.click(screen.getByRole("button", { name: "Adicionar item manual" }));
  for (const [label, value] of [
    ["Medicamento · item 1", "Fármaco sintético"], ["Classe · item 1", "QT"],
    ["Base da dose · item 1", "FIXED"], ["Dose final · item 1", "1,5"], ["Unidade · item 1", "mg"],
    ["Via · item 1", "EV"], ["Diluente · item 1", "Diluente sintético"], ["Volume final (mL) · item 1", "100"],
    ["Tempo de infusão · item 1", "30 min"], ["Dias de administração · item 1", "d1"],
    ["Motivo do override · item 1", "Escolha manual sintética"],
  ]) alterar(label!, value!);
  const antes = a.eventos().length;
  fireEvent.click(screen.getByRole("button", { name: "Preparar prévia exata" }));
  await waitFor(() => {
    const diagnostico = screen.queryAllByRole("alert").concat(screen.queryAllByRole("status"))
      .map(e => e.textContent).join("\n");
    expect(screen.queryByRole("region", { name: "Prévia da prescrição" }), diagnostico).not.toBeNull();
  }, { timeout: 5000 });
  const previa = screen.getByRole("region", { name: "Prévia da prescrição" });
  expect(previa.textContent).toContain("1,5 mg");
  expect(a.eventos()).toHaveLength(antes);
  expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "APAC" }));
  expect(await screen.findByRole("dialog", { name: "Prescrição em edição" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
  expect(screen.getByRole("region", { name: "Prévia da prescrição" }).textContent).toContain("1,5 mg");
  const assinar=screen.getByRole("button", { name: "Confirmar e assinar prescrição" }) as HTMLButtonElement;
  expect(assinar.disabled).toBe(true);
  fireEvent.click(screen.getByRole("checkbox", { name: /Estou ciente: Alerta sintético para ciência da prescrição/ }));
  await waitFor(()=>expect(assinar.disabled).toBe(false));
  fireEvent.click(assinar);
  await waitFor(() => expect(a.eventos().filter(e => e.tipo === "DOCUMENTO")).toHaveLength(1));
  expect(a.db.prepare("SELECT COUNT(*) AS n FROM alerta_reconhecimento").get()!.n).toBe(1);
  const ciclo = a.eventos().find(e => e.tipo === "Ciclo")!;
  expect(dadosDoEvento(ciclo)?.itens).toMatchObject([{ doseMg: 1.5 }]);
  expect(a.eventos().filter(e => e.tipo === "TreatmentAdministration")).toHaveLength(0);
  expect(a.eventos().filter(e => dadosDoEvento(e)?.campo === "farmacia.conferencia")).toHaveLength(0);
  await waitFor(() => expect((screen.getByRole("button", { name: "Preparar prévia exata" }) as HTMLButtonElement).disabled).toBe(false),
    { timeout: 5000 });
  expect(screen.getByText("Prescrição assinada e ciclo planejado gravados. Nenhuma administração registrada.")).toBeTruthy();
  await waitFor(() => expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(true));
  fireEvent.click(screen.getByRole("button", { name: "Estatísticas" }));
  await screen.findByRole("region", { name: "Estatísticas do serviço local" });
  await waitFor(() => expect(screen.getByRole("region", { name: "Estatísticas do serviço local" }).textContent)
    .toContain("1 de 1 pacientes (100,0%); 1 documentos."));
});
