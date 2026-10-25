// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BarraFechamento } from "../../../src/ui/consulta/BarraFechamento.js";
import { AcoesCompostas } from "../../../src/ui/consulta/AcoesCompostas.js";
import { EditorPrescricaoExecutavel } from "../../../src/ui/consulta/EditorPrescricaoExecutavel.js";

afterEach(cleanup);

describe("U-H2 · ARIA: controles com nome acessível, campos com label e erros anunciados com role='alert'", () => {
  it("BarraFechamento anuncia erros de validação e de ausência de alvo de impressão com role='alert'", () => {
    render(
      <BarraFechamento
        patientId="pt-sintetico-uh2"
        tumorLotId="lot-sintetico-uh2"
        encounterId="en-sintetico-uh2"
        blocoAtual="EVOLUCAO"
        registros={[{ id: "reg-uh2", expectedRevision: 0 }]}
        documentos={[
          {
            documentId: "doc-uh2",
            documentVersion: 1,
            titulo: "evolução",
            preMarcado: true,
            visivel: true,
            origem: "MODELO_MEDICO",
          },
        ]}
        alertasVermelhosExibidos={[]}
        idempotencyKey="curta" // < 8 chars -> falha de schema -> comando incompleto
        autorExibido="Médico Sintético"
        alvoImpressao={null}
        chaveImpressao="chave-impressao-uh2"
        onValidar={() => {}}
        onImprimir={() => {}}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "evolução v1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "validar tudo" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "validar bloco" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "imprimir" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "imprimir" }));
    const alertaImpressao = screen.getByRole("alert");
    expect(alertaImpressao.textContent).toBe("nada selecionado para imprimir");

    fireEvent.click(screen.getByRole("button", { name: "validar tudo" }));
    const alertaValidacao = screen.getByRole("alert");
    expect(alertaValidacao.textContent).toBe("comando incompleto");
  });

  it("AcoesCompostas e EditorPrescricaoExecutavel expõem nome acessível em todos os controles interativos e anunciam erros com role='alert'", () => {
    const snap = {
      contexto: { patientId: "pt-uh2", encounterId: "en-uh2", tumorLotId: "lot-uh2" },
      cicloId: "ci-uh2",
      episodioId: "ep-uh2",
      protocoloId: "AC-T",
      previstoEm: "2026-10-20",
      itens: [{ item: 1, droga: "doxorrubicina", doseMg: 60 }],
    };

    const { container } = render(
      <div>
        <AcoesCompostas
          base={{ ...snap, revisao: "rev-uh2", baseHash: "a".repeat(64) }}
          tipoInicial="REDUZIR_DOSE"
          aoPreparar={async () => {
            throw new Error("Erro sintético de preparo");
          }}
          aoUsar={() => {}}
        />
        <EditorPrescricaoExecutavel
          base={{
            contexto: snap.contexto,
            pacienteNome: "Paciente SINTETICO U-H2",
            revisao: "a".repeat(64),
            pendencias: [],
            vigente: null,
            episodio: null,
            ciclo: null,
          }}
          aoPreparar={async () => {
            throw new Error("Não deve chegar");
          }}
          aoAssinar={async () => {}}
        />
      </div>,
    );

    // Todos os inputs, selects, textareas e buttons têm nome acessível ou label associado
    const controles = Array.from(container.querySelectorAll<HTMLElement>("button, input, select, textarea"));
    expect(controles.length).toBeGreaterThan(5);
    for (const el of controles) {
      const ariaLabel = el.getAttribute("aria-label")?.trim();
      const id = el.getAttribute("id");
      const labelFor = id ? container.querySelector(`label[for="${id}"]`)?.textContent?.trim() : null;
      const parentLabel = el.closest("label")?.textContent?.trim();
      const textContent = el.tagName === "BUTTON" ? el.textContent?.trim() : null;
      const nomeAcessivel = ariaLabel || labelFor || parentLabel || textContent;
      expect(Boolean(nomeAcessivel), `Controle sem nome acessível: ${el.outerHTML}`).toBe(true);
    }

    // Dispara tentativa inválida no EditorPrescricaoExecutavel -> erro anunciado em role="alert"
    fireEvent.click(screen.getByRole("button", { name: "Preparar prévia exata" }));
    expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(1);
  });
});
