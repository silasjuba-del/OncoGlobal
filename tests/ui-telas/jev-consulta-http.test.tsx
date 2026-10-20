// @vitest-environment jsdom
// proveniência: dados sintéticos - não utilizar em produção
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ConsultaPersistida } from "../../src/ui/consulta/ConsultaPersistida.js";
import { criarPortaHttp } from "../../src/ui/api/http.js";
import { abrirAmbiente, cadastrarPaciente, criarDiretorio, removerDiretorio, PACIENTE, ENCONTRO, SENHA } from "../f0-fecha/fixtures/consulta-completa.js";

const ambientes: Awaited<ReturnType<typeof abrirAmbiente>>[] = [];
afterEach(async () => { cleanup(); vi.unstubAllGlobals(); for (const a of ambientes.splice(0)) { await a.close(); removerDiretorio(a.dir); } });

it("consulta HTTP exibe JEV e comando de ajuste com base ausente sem gravar decisão", async () => {
  const a = await abrirAmbiente(criarDiretorio()); ambientes.push(a); cadastrarPaciente(a);
  const transporte = globalThis.fetch;
  vi.stubGlobal("fetch", (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
    transporte(typeof input === "string" && input.startsWith("/") ? `${a.baseUrl}${input}` : input, init));
  const porta = criarPortaHttp({ onSessaoExpirada() {} });
  await porta.login(SENHA);
  render(<ConsultaPersistida porta={porta} contexto={{ patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: null }} />);
  await screen.findByRole("region", { name: "Cockpit JEV" });
  expect(screen.getByRole("region", { name: "Mudanças e pré-consulta" })).toBeTruthy();
  expect(screen.getByRole("region", { name: "Conduta e protocolo" })).toBeTruthy();
  expect(screen.getByRole("region", { name: "Bundle de saída" })).toBeTruthy();
  const antes = a.eventos().length;
  fireEvent.keyDown(window, { key: "k", ctrlKey: true });
  const busca = screen.getByRole("combobox", { name: "Buscar comando" });
  fireEvent.change(busca, { target: { value: "reduzir" } });
  fireEvent.keyDown(busca, { key: "Enter" });
  await screen.findByRole("region", { name: "Ações compostas" });
  expect((screen.getByRole("button", { name: "Preparar prévia" }) as HTMLButtonElement).disabled).toBe(true);
  expect(a.eventos()).toHaveLength(antes);
});
