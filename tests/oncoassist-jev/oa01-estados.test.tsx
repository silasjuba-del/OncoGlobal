// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { criarPortaFalsa } from "../../src/ui/api/fake.js";
import { PainelOncoassist } from "../../src/ui/consulta/PainelOncoassist.js";

afterEach(cleanup);
const contexto = { patientId: "paciente-sintetico", encounterId: "consulta-sintetica", tumorLotId: null };

function portaDisponivel(overrides: Partial<ReturnType<typeof criarPortaFalsa>> & Record<string, unknown> = {}) {
  const base = criarPortaFalsa();
  return {
    ...base,
    oncoassistStatus: async () => ({ status: "DISPONIVEL" as const }),
    oncoassistFontes: async () => ({
      fontes: [{ draftId: "draft-local", rotulo: "Documento da consulta", criadoEm: "2026-10-07" }],
      fontesSemVinculo: [],
    }),
    oncoassistClassificar: vi.fn(),
    ...overrides,
  };
}

describe("OA-01 — estados verdadeiros no PainelOncoassist", () => {
  it("capacidade pendente por chave ausente não oferece classificação", async () => {
    const porta = portaDisponivel({
      oncoassistStatus: async () => ({ status: "PENDENTE" as const, motivo: "CHAVE_AUSENTE" as const }),
    });
    render(<PainelOncoassist porta={porta} contexto={contexto} />);
    expect(await screen.findByText(/credencial local/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sugerir classificação" })).toBeNull();
  });

  it("somente trechos sem vínculo informa pendência de vínculo, sem categoria", async () => {
    const porta = portaDisponivel({
      oncoassistFontes: async () => ({
        fontes: [],
        fontesSemVinculo: [{ draftId: "d1", sourceId: "s1", segmentId: "seg", exceptionId: "exc",
          rotulo: "Trecho", criadoEm: "2026-10-07", revision: 0, textoOriginal: "texto" }],
      }),
    });
    render(<PainelOncoassist porta={porta} contexto={contexto} />);
    expect(await screen.findByText(/aguardando vínculo/)).toBeTruthy();
    expect(screen.queryByText(/Laboratório/)).toBeNull();
  });

  it("timeout e resposta inválida preservam documento sem mostrar categoria", async () => {
    for (const [codigo, trecho] of [
      ["TIMEOUT", "expirou"],
      ["RESPOSTA_INVALIDA", "rejeitada"],
      ["SEM_MARCADORES", "marcadores documentais"],
    ] as const) {
      cleanup();
      const classificar = vi.fn(async () => ({ status: codigo === "SEM_MARCADORES" ? "PENDENTE" as const : "ERRO" as const, codigo }));
      const porta = portaDisponivel({ oncoassistClassificar: classificar });
      render(<PainelOncoassist porta={porta} contexto={contexto} />);
      fireEvent.click(await screen.findByRole("button", { name: "Sugerir classificação" }));
      expect(await screen.findByText(new RegExp(trecho, "i"))).toBeTruthy();
      expect(screen.queryByText(/sugestão para revisão/)).toBeNull();
    }
  });

  it("interromper cancela sem alterar paciente/encontro enviados", async () => {
    type PropostaClassificacao = {
      status: "PROPOSTA";
      revisaoObrigatoria: true;
      fonte: { id: string; sha256: string };
      categoria: "LAB";
    };
    let resolver!: (value: PropostaClassificacao) => void;
    const classificar = vi.fn((_pedido, signal?: AbortSignal) => new Promise<PropostaClassificacao>((resolve, reject) => {
      signal?.addEventListener("abort", () => reject(new DOMException("abort", "AbortError")), { once: true });
      resolver = resolve;
    }));
    const porta = portaDisponivel({ oncoassistClassificar: classificar });
    const view = render(<PainelOncoassist porta={porta} contexto={contexto} />);
    fireEvent.click(await screen.findByRole("button", { name: "Sugerir classificação" }));
    fireEvent.click(await screen.findByRole("button", { name: "Interromper" }));
    expect(await screen.findByText(/interrompida/i)).toBeTruthy();
    expect(classificar).toHaveBeenCalledWith({ ...contexto, draftId: "draft-local" }, expect.any(AbortSignal));
    resolver({ status: "PROPOSTA", revisaoObrigatoria: true, fonte: { id: "x", sha256: "y" }, categoria: "LAB" });
    view.rerender(<PainelOncoassist porta={porta} contexto={contexto} />);
    expect(screen.queryByText(/Laboratório — sugestão/)).toBeNull();
  });

  it.each(["resolve", "reject"] as const)(
    "nova classificação após interromper ignora conclusão tardia da anterior (%s)",
    async (modo) => {
      type PropostaClassificacao = {
        status: "PROPOSTA";
        revisaoObrigatoria: true;
        fonte: { id: string; sha256: string };
        categoria: "LAB";
      };
      let concluirA!: (value: PropostaClassificacao) => void;
      let rejeitarA!: (reason?: unknown) => void;
      let concluirB!: (value: PropostaClassificacao) => void;
      let chamadas = 0;
      const classificar = vi.fn((_pedido, _signal?: AbortSignal) => {
        const indice = ++chamadas;
        return new Promise<PropostaClassificacao>((resolve, reject) => {
          if (indice === 1) {
            concluirA = resolve;
            rejeitarA = reject;
          } else {
            concluirB = resolve;
          }
        });
      });
      const porta = portaDisponivel({ oncoassistClassificar: classificar });
      render(<PainelOncoassist porta={porta} contexto={contexto} />);
      fireEvent.click(await screen.findByRole("button", { name: "Sugerir classificação" }));
      fireEvent.click(await screen.findByRole("button", { name: "Interromper" }));
      fireEvent.click(await screen.findByRole("button", { name: "Sugerir classificação" }));
      expect(await screen.findByRole("button", { name: "Organizando…" })).toBeTruthy();
      await act(async () => { if (modo === "resolve") {
        concluirA({
          status: "PROPOSTA",
          revisaoObrigatoria: true,
          fonte: { id: "antiga", sha256: "a" },
          categoria: "LAB",
        });
      } else {
        rejeitarA(new Error("falha tardia sintética"));
      } });
      const botaoPrimario = screen.getByRole("button", { name: "Organizando…" });
      expect(botaoPrimario.hasAttribute("disabled")).toBe(true);
      expect(screen.getByLabelText("Documento para o OncoAssist").hasAttribute("disabled")).toBe(true);
      expect(screen.queryByText(/Laboratório — sugestão/)).toBeNull();
      expect(screen.queryByText(/interrompida/i)).toBeNull();
      concluirB({
        status: "PROPOSTA",
        revisaoObrigatoria: true,
        fonte: { id: "nova", sha256: "b" },
        categoria: "LAB",
      });
      expect(await screen.findByText(/Laboratório — sugestão/)).toBeTruthy();
      expect(screen.queryByText(/antiga/i)).toBeNull();
    },
  );

  it("troca de paciente descarta resposta tardia", async () => {
    let concluir!: (r: { status: "PENDENTE"; codigo: "TIMEOUT" }) => void;
    const porta = portaDisponivel({
      oncoassistClassificar: () => new Promise((resolve) => { concluir = resolve; }),
    });
    const view = render(<PainelOncoassist porta={porta} contexto={contexto} />);
    fireEvent.click(await screen.findByRole("button", { name: "Sugerir classificação" }));
    view.rerender(<PainelOncoassist porta={porta} contexto={{ ...contexto, patientId: "outro-paciente" }} />);
    concluir({ status: "PENDENTE", codigo: "TIMEOUT" });
    await screen.findByRole("button", { name: "Sugerir classificação" });
    expect(screen.queryByText(/expirou/i)).toBeNull();
  });
});
