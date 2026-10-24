// @vitest-environment jsdom
// M10: a tela só libera a assinatura com ciência de todo alerta vermelho exibido (servidor HTTP real, dados sintéticos).
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ConsultaPersistida } from "../../src/ui/consulta/ConsultaPersistida.js";
import { criarPortaHttp } from "../../src/ui/api/http.js";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { abrirAmbiente, cadastrarPaciente, criarDiretorio, removerDiretorio, AGORA, ENCONTRO, PACIENTE, SENHA } from "../f0-fecha/fixtures/consulta-completa.js";

const ambientes: Awaited<ReturnType<typeof abrirAmbiente>>[] = [];
const contexto = { patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: null };
afterEach(async () => {
  cleanup(); vi.unstubAllGlobals();
  for (const ambiente of ambientes.splice(0)) { await ambiente.close(); removerDiretorio(ambiente.dir); }
});

it("M10-UI botão de assinatura fica bloqueado até a ciência do alerta vermelho exibido", async () => {
  const ambiente = await abrirAmbiente(criarDiretorio()); ambientes.push(ambiente);
  cadastrarPaciente(ambiente);
  const sessao = ambiente.sessoes.obter(ambiente.token)!;
  salvarDraft(ambiente.db, { draftId: "alerta-ui", patientId: PACIENTE, sourceId: "fonte-alerta-ui", rawRef: "fixture-sintetica", payload: {}, diagnostics: [], revision: 0, criadoEm: AGORA });
  expect(confirmar(ambiente.db, { operationId: "op-alerta-ui", patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: null, reviewDecisionId: "rev-alerta-ui", sessao, em: AGORA,
    registros: [{ draftId: "alerta-ui", expectedRevision: 0, eventId: "alerta-ui", tipo: "Alerta", fontes: [], revisao: "CONFIRMADO",
      payload: { alertaId: "alerta-ui", alvo: { patientId: PACIENTE }, natureza: "AMEACA_IMEDIATA", classeRisco: null, texto: "Alerta sintetico de tela", origemRegra: "regra-sintetica",
        evidencias: [], presentationOverride: true, authorityOverride: false, reconhecidoEm: null, destino: "CHAT" } }] }).estado).toBe("GRAVADA");

  const transporte = globalThis.fetch;
  vi.stubGlobal("fetch", (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
    transporte(typeof input === "string" && input.startsWith("/") ? `${ambiente.baseUrl}${input}` : input, init));
  const porta = criarPortaHttp({ onSessaoExpirada: () => {} });
  expect((await porta.login(SENHA)).ok).toBe(true);
  render(<ConsultaPersistida porta={porta} contexto={contexto} />);
  await screen.findByRole("button", { name: "Consulta Flash" });

  fireEvent.click(screen.getByRole("button", { name: "Consulta Flash" }));
  fireEvent.change(screen.getByLabelText("Prazo do retorno em dias"), { target: { value: "30" } });
  fireEvent.click(screen.getByRole("button", { name: "Revisar documentos para assinatura" }));
  const exibicao = await screen.findByRole("region", { name: "Conteúdo para assinatura" });
  const assinar = within(exibicao).getByRole("button", { name: "Confirmar e assinar conteúdo exibido" }) as HTMLButtonElement;

  expect(assinar.disabled).toBe(true);
  expect(within(exibicao).getByRole("status").textContent).toMatch(/ciência de todos os alertas vermelhos/);
  fireEvent.click(await screen.findByRole("checkbox", { name: /Estou ciente: Alerta sintetico de tela/ }));
  await waitFor(() => expect(assinar.disabled).toBe(false));

  fireEvent.click(assinar);
  await waitFor(() => expect(ambiente.eventos().filter((e) => e.revisao === "ASSINADO")).toHaveLength(3));
  expect(ambiente.db.prepare("SELECT COUNT(*) AS n FROM alerta_reconhecimento").get()!.n).toBe(1);
});
