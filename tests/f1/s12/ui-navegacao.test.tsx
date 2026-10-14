// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { OncoassistLocal } from "../../../src/ui/OncoassistLocal.js";
import { criarPortaFalsa, ID } from "../../../src/ui/api/fake.js";
import type { ConsultaVisao } from "../../../src/ui/api/porta.js";

afterEach(cleanup);
it("identificação acompanha contexto, âncoras têm destinos e navegação preserva edição não salva", async () => {
  const porta = criarPortaFalsa(), carregar = porta.carregarConsulta.bind(porta);
  porta.login = async () => ({ ok: true, expiraEm: null });
  const fabrica = vi.fn(() => porta);
  render(<OncoassistLocal fabricaPorta={fabrica} />);
  fireEvent.change(screen.getByLabelText("Senha do servidor"), { target: { value: "senha-sintetica-local" } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
  fireEvent.change(await screen.findByLabelText("Paciente da agenda"), { target: { value: "en-verde" } });
  fireEvent.click(await screen.findByRole("button", { name: "Consulta Flash" }));
  const identidade = screen.getByRole("region", { name: "Identificação da consulta" });
  expect(identidade.textContent).toContain(ID.verde); expect(identidade.textContent).toContain("en-verde");
  const prazo = screen.getByLabelText("Prazo do retorno em dias") as HTMLInputElement;
  fireEvent.change(prazo, { target: { value: "57" } });
  const navegacao = screen.getByRole("navigation", { name: "Navegar nesta consulta" });
  for (const link of within(navegacao).getAllByRole("link")) {
    expect(document.getElementById(link.getAttribute("href")!.slice(1))).not.toBeNull();
    fireEvent.click(link);
  }
  expect(screen.getByLabelText("Prazo do retorno em dias")).toBe(prazo); expect(prazo.value).toBe("57");
  expect(screen.getByRole("button", { name: "Abrir APAC ↗" })).toBeTruthy();
  let resolver!: (v: ConsultaVisao) => void;
  porta.carregarConsulta = vi.fn(carregar).mockImplementationOnce(() => new Promise(r => { resolver = r; }));
  fireEvent.change(screen.getByLabelText("Paciente da agenda"), { target: { value: "en-vermelho" } });
  expect(screen.queryByRole("region", { name: "Identificação da consulta" })).toBeNull();
  await act(async () => resolver(await carregar(ID.vermelho, undefined, "en-vermelho")));
  await screen.findByRole("button", { name: "Consulta Flash" });
  expect(screen.getByRole("region", { name: "Identificação da consulta" }).textContent).toContain(ID.vermelho);
  expect(screen.getByRole("region", { name: "Identificação da consulta" }).textContent).not.toContain(ID.verde);
  expect(fabrica).toHaveBeenCalledTimes(1);
});
