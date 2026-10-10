// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConsultaFlash, type ConsultaFlashProps, type PlanoFlash } from "../../src/ui/consulta/ConsultaFlash.js";
import { TarefasRetorno } from "../../src/ui/consulta/TarefasRetorno.js";
import { TelaConsulta } from "../../src/ui/telas/TelaConsulta.js";
import { criarChaves } from "../../src/ui/api/chaves.js";
import { criarPortaFalsa, ID } from "../../src/ui/api/fake.js";

afterEach(cleanup);

function props(over: Partial<ConsultaFlashProps> = {}): ConsultaFlashProps {
  const it = (id: string, r: string, p: boolean) => ({ id, rotulo: r, origem: "MODELO_MEDICO" as const, preMarcado: p });
  return {
    cabecalho: {},
    exames: [],
    acoesHoje: [],
    receitas: [],
    apac: { cid: "C61", sigtap: "x", finalidade: "PALIATIVO", competencia: "10/26", estado: "PENDENTE", pendencias: [] },
    iaFala: [],
    retorno: { dias: 30, examesAntesDoRetorno: [] },
    tarefasRetorno: {
      modeloPadraoSalvo: false,
      retorno: it("retorno", "Retorno", false),
      laboratorio: it("lab", "Laboratório", true),
      imagem: it("img", "Imagem", false),
    },
    aoSalvarRascunho: vi.fn(),
    aoFinalizar: vi.fn(),
    ...over,
  };
}

describe("W12-F3 retorno fixo", () => {
  it("retorno sempre incluído, sem checkbox, com prazo", () => {
    render(
      <TarefasRetorno
        prazoDias={14}
        marcadas={{ retorno: false, laboratorio: false, imagem: false }}
        modeloPadraoSalvo
        onAlternar={vi.fn()}
      />,
    );
    expect(screen.queryByRole("checkbox", { name: /^Retorno/ })).toBeNull();
    expect(screen.getByText(/^Retorno \(14 dias\)/)).toBeTruthy();
    expect(screen.getAllByRole("checkbox").length).toBe(2);
  });

  it("prazo ausente aparece como PENDENTE", () => {
    render(
      <TarefasRetorno
        prazoDias={null}
        marcadas={{ retorno: true, laboratorio: false, imagem: false }}
        modeloPadraoSalvo
        onAlternar={vi.fn()}
      />,
    );
    expect(screen.getByText(/Retorno \(prazo PENDENTE\)/)).toBeTruthy();
  });

  it("plano tem retorno true mesmo sem modelo padrão salvo", () => {
    const aoFinalizar = vi.fn();
    render(<ConsultaFlash {...props({ aoFinalizar })} />);
    fireEvent.click(screen.getByRole("button", { name: "REVISAR · IMPRIMIR" }));
    expect((aoFinalizar.mock.calls[0]?.[0] as PlanoFlash).tarefasRetorno).toEqual({
      retorno: true,
      laboratorio: false,
      imagem: false,
    });
  });
});

// F0-COMPLEMENTO: Flash essencial substitui tarefas genéricas por LAB/RAD/QT explícitos.
describe("W12-F3 tela", () => {
  it("com dados fake: cartão transversal na tela; Flash mostra linha pontualizada e tarefas", async () => {
    render(<TelaConsulta patientId={ID.multi} porta={criarPortaFalsa()} chaves={criarChaves()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Consulta Flash" }));
    expect(screen.getByLabelText("Retrato transversal do tumor-índice")).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByLabelText("Biópsia e imagem").textContent).toContain("Biópsia de mama: carcinoma invasivo de tipo não especial"),
    );
    expect(screen.getByLabelText("Solicitações laboratoriais")).toBeTruthy();
    expect((screen.getByLabelText("Prazo do retorno em dias") as HTMLInputElement).value).toBe("30");
    expect(screen.queryByRole("checkbox", { name: /^Retorno/ })).toBeNull();
    expect(screen.getByRole("button", { name: "REVISAR · IMPRIMIR" })).toBeTruthy();
  });

  it("sem retrato: sem cartão", async () => {
    render(<TelaConsulta patientId={ID.verde} porta={criarPortaFalsa()} chaves={criarChaves()} />);
    await screen.findByRole("button", { name: "Consulta Flash" });
    expect(screen.queryByLabelText("Retrato transversal do tumor-índice")).toBeNull();
  });
});

