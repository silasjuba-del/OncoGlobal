// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { classeSemaforo } from "../../src/ui/tema/temas.js";
import { ThemeProvider } from "../../src/ui/tema/ThemeProvider.js";

function SuperficieEstavel() {
  return (
    <section aria-label="consulta">
      <p aria-label="paciente ativo">Paciente Teste 01</p>
      <p aria-label="escopo de validar tudo">validar tudo — documentos exibidos e versões do bundle</p>
      <p aria-label="autor da assinatura">Médico Teste · CRM 00000</p>
      <div role="alert" aria-label="banner E1">E1 visível</div>
    </section>
  );
}

function semantica(root: HTMLElement): string {
  const linhas: string[] = [];
  const walk = (el: Element) => {
    const attrs = [...el.attributes]
      .filter((a) => a.name === "role" || a.name.startsWith("aria-"))
      .map((a) => `${a.name}=${a.value}`)
      .sort();
    const textos = [...el.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => (n.textContent ?? "").trim())
      .filter((t) => t.length > 0);
    if (textos.length > 0 || attrs.length > 0) {
      linhas.push(`${el.tagName}|${textos.join(" ")}|${attrs.join(" ")}`);
    }
    for (const filho of el.children) walk(filho);
  };
  walk(root);
  return linhas.join("\n");
}

describe("tema G-28 / N26", () => {
  it("gelo e contraste têm o mesmo snapshot semântico", () => {
    const view = render(
      <ThemeProvider tema="gelo">
        <SuperficieEstavel />
      </ThemeProvider>,
    );
    const gelo = semantica(view.container);
    expect(view.container.querySelector("[data-tema]")?.getAttribute("data-tema")).toBe("gelo");

    view.rerender(
      <ThemeProvider tema="contraste">
        <SuperficieEstavel />
      </ThemeProvider>,
    );
    const contraste = semantica(view.container);
    expect(view.container.querySelector("[data-tema]")?.getAttribute("data-tema")).toBe("contraste");
    expect(contraste).toBe(gelo);
    expect(gelo).toContain("Paciente Teste 01");
    expect(gelo).toContain("validar tudo — documentos exibidos e versões do bundle");
    expect(gelo).toContain("Médico Teste · CRM 00000");
    expect(gelo).toContain("role=alert");
    expect(gelo).toContain("E1 visível");
  });

  it("PENDENTE não usa a classe nem a variável de verde", () => {
    expect(classeSemaforo("PENDENTE")).toBe("semaforo semaforo-pendente");
    expect(classeSemaforo("PENDENTE")).not.toContain("verde");
    const css = readFileSync(join(process.cwd(), "src/ui/tema/tokens.css"), "utf8");
    for (const bloco of css.split("[data-tema=")) {
      const verde = /--cor-verde:\s*([^;]+);/.exec(bloco)?.[1]?.trim();
      const pendente = /--cor-pendente:\s*([^;]+);/.exec(bloco)?.[1]?.trim();
      if (verde && pendente) expect(pendente).not.toBe(verde);
    }
  });
});
