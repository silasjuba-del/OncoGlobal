// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/ui/App.js";
import { revelarTema } from "../../src/ui/oncochart/revelacao.js";

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete (document as { startViewTransition?: unknown }).startViewTransition;
});

beforeEach(() => {
  localStorage.clear();
});

const lento = { timeout: 20_000 };

describe("casca OncoChart", () => {
  it("monta o canvas, a grade e as telas já ligadas", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "OncoGlobal — WORK" })).toBeTruthy();
    expect(screen.getByText("dados sintéticos")).toBeTruthy();
    expect(document.querySelector("[data-canvas='1680x1000']")).toBeTruthy();
    expect(document.querySelector("[data-grade='58-1fr-396']")).toBeTruthy();
    expect(document.querySelector("[data-coluna='trilho']")).toBeTruthy();
    expect(document.querySelector("[data-coluna='principal']")).toBeTruthy();
    expect(document.querySelector("[data-coluna='lateral']")).toBeTruthy();
    expect(document.querySelector("[data-tema-onco]")?.getAttribute("data-tema-onco")).toBe("noite");

    expect(await screen.findByRole("region", { name: "Agenda do dia" }, lento)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Salão" }));
    expect(await screen.findByRole("region", { name: "Salão" }, lento)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Canal" }));
    expect(await screen.findByRole("region", { name: "Caixa do canal" }, lento)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "APAC" }));
    expect(await screen.findByRole("region", { name: "APAC por lote" }, lento)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Agenda" }));
    expect(await screen.findByRole("region", { name: "Agenda do dia" }, lento)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Prontuário" }));
    expect(screen.getByRole("region", { name: "Consulta" }).textContent).toContain("nenhum paciente aberto");
  }, 60_000);

  it("troca DIA/NOITE sem alterar o texto clínico e grava só a preferência", async () => {
    render(<App />);
    const agenda = await screen.findByRole("region", { name: "Agenda do dia" }, lento);
    const antes = agenda.textContent;
    fireEvent.click(screen.getByRole("button", { name: /Dia \/ noite, agora/ }));
    expect(document.querySelector("[data-tema-onco]")?.getAttribute("data-tema-onco")).toBe("dia");
    expect(localStorage.getItem("onco.theme.v2")).toBe("dia");
    expect(screen.getByRole("region", { name: "Agenda do dia" }).textContent).toBe(antes);
    fireEvent.click(screen.getByRole("button", { name: "Alertas" }));
    const painelAlertas = screen.getByRole("region", { name: "Alertas" });
    const pendente = painelAlertas.querySelector("p.semaforo-pendente");
    expect(pendente?.textContent).toBe("PENDENTE");
    expect(pendente?.className).not.toContain("verde");
    fireEvent.click(screen.getByRole("button", { name: "Usuário" }));
    expect(screen.getByText("Médico Teste")).toBeTruthy();
    expect(screen.getByText(/CRM 00000/)).toBeTruthy();
  }, 30_000);

  it("Ctrl K e a busca abrem a mesma paleta de comandos", async () => {
    render(<App />);
    await screen.findByRole("region", { name: "Agenda do dia" }, lento);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByRole("dialog", { name: "Barra de comando" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.queryByRole("dialog", { name: "Barra de comando" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(screen.getByLabelText("Comando")).toBeTruthy();
  }, 30_000);

  it("declara tokens oklch, motion e a grade no CSS, com Geist local", () => {
    const css = readFileSync(join(process.cwd(), "src/ui/oncochart/tokens.css"), "utf8");
    expect(css).toContain("--ease: cubic-bezier(.2, .8, .2, 1)");
    expect(css).toContain("--spring: cubic-bezier(.34, 1.56, .64, 1)");
    expect(css).toContain("oklch(0.16 0.012 265)");
    expect(css).toContain("oklch(0.985 0.004 240)");
    expect(css).toContain("grid-template-columns: 58px minmax(0, 1fr) 396px");
    expect(css).toContain("width: 1680px");
    expect(css).toContain("height: 1000px");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).toContain("Geist");
    expect(css).not.toMatch(/fonts\.google|fonts\.gstatic|unpkg|cdn\./);
    expect(existsSync(join(process.cwd(), "src/ui/oncochart/fontes/geist-latin-wght-normal.woff2"))).toBe(true);
    expect(existsSync(join(process.cwd(), "src/ui/oncochart/fontes/geist-mono-latin-wght-normal.woff2"))).toBe(true);
    const noite = /\[data-tema-onco="noite"\] \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
    const verde = /--cor-verde:\s*([^;]+);/.exec(noite)?.[1]?.trim();
    const pendente = /--cor-pendente:\s*([^;]+);/.exec(noite)?.[1]?.trim();
    expect(verde).toBeTruthy();
    expect(pendente).toBeTruthy();
    expect(pendente).not.toBe(verde);
  });
});

describe("revelação de tema", () => {
  it("não usa view transition quando o movimento é reduzido", () => {
    const aplicar = vi.fn();
    const start = vi.fn(() => ({ ready: Promise.resolve() }));
    (document as unknown as { startViewTransition: typeof start }).startViewTransition = start;
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    const origem = document.createElement("button");
    document.body.appendChild(origem);
    revelarTema(origem, aplicar);
    expect(start).not.toHaveBeenCalled();
    expect(aplicar).toHaveBeenCalledTimes(1);
    window.matchMedia = original;
  });

  it("pede a revelação circular quando o movimento é pleno", () => {
    const aplicar = vi.fn();
    const start = vi.fn((callback: () => void) => {
      callback();
      return { ready: Promise.resolve() };
    });
    (document as unknown as { startViewTransition: typeof start }).startViewTransition = start;
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    const origem = document.createElement("button");
    document.body.appendChild(origem);
    revelarTema(origem, aplicar);
    expect(start).toHaveBeenCalledTimes(1);
    expect(aplicar).toHaveBeenCalledTimes(1);
    window.matchMedia = original;
  });
});
