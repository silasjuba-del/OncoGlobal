// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EstatisticaServicoResposta, type VisaoEstatisticaServico } from "../../src/contracts/api/estatisticaServico.js";
import { PainelEstatistica } from "../../src/ui/estatistica/PainelEstatistica.js";

afterEach(cleanup);

function visao(overrides: Partial<VisaoEstatisticaServico> = {}): VisaoEstatisticaServico {
  return {
    versao: "W10-REAUDITORIA-03",
    escopo: "LEDGER_COMPLETO",
    periodoClinico: null,
    denominadorPacientes: 0,
    exclusoes: {
      eventosNaoConfirmados: 0,
      eventosSupersedidos: 0,
      linhasDuplicadas: 0,
      administracoesInvalidas: 0,
      administracoesConflito: 0,
      eventosSemDataClinica: 0,
      eventosDataClinicaInvalida: 0,
      eventosForaPeriodo: 0,
    },
    totalPacientes: 0,
    eventosPorCategoria: { FATO: 0, DOCUMENTO: 0, ADMINISTRACAO: 0, OUTRO: 0 },
    pacientesPorCategoria: { FATO: 0, DOCUMENTO: 0, ADMINISTRACAO: 0, OUTRO: 0 },
    documentosAssinados: 0,
    pacientesComDocumentoAssinado: 0,
    administracoesPorStatus: { COMPLETA: 0, PARCIAL: 0, OMITIDA: 0, INTERROMPIDA: 0 },
    pacientesPorStatusDeAdministracao: { COMPLETA: 0, PARCIAL: 0, OMITIDA: 0, INTERROMPIDA: 0 },
    administracoesPendentes: 0,
    administracoesConflito: 0,
    ...overrides,
  };
}

describe("PainelEstatistica", () => {
  it("valida o formato real da projeção e admite carteira vazia sem inventar denominador", () => {
    const dados = visao();
    expect(EstatisticaServicoResposta.parse(dados)).toEqual(dados);
    expect(EstatisticaServicoResposta.safeParse({ ...dados, totalPacientes: undefined }).success).toBe(false);
    expect(EstatisticaServicoResposta.safeParse({ ...dados, totalPacientes: 1 }).success).toBe(false);
    render(<PainelEstatistica dados={dados} aoPeriodo={vi.fn()} />);
    expect(screen.getByText("0 pacientes")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Cobertura documental" }).textContent).toContain("Não calculável — sem pacientes no denominador");
    expect(screen.getByText(/Carteira completa/)).toBeTruthy();
  });

  it("mostra categorias, administração, cobertura documental e exclusões com zero preservado", () => {
    const dados = visao({
      denominadorPacientes: 3,
      totalPacientes: 3,
      eventosPorCategoria: { FATO: 4, DOCUMENTO: 2, ADMINISTRACAO: 0, OUTRO: 1 },
      pacientesPorCategoria: { FATO: 2, DOCUMENTO: 1, ADMINISTRACAO: 0, OUTRO: 1 },
      documentosAssinados: 2,
      pacientesComDocumentoAssinado: 1,
      administracoesPorStatus: { COMPLETA: 0, PARCIAL: 1, OMITIDA: 0, INTERROMPIDA: 0 },
      administracoesPendentes: 1,
      administracoesConflito: 1,
      exclusoes: { eventosNaoConfirmados: 2, eventosSupersedidos: 1, linhasDuplicadas: 3,
        administracoesInvalidas: 1, administracoesConflito: 1, eventosSemDataClinica: 2,
        eventosDataClinicaInvalida: 1, eventosForaPeriodo: 4 },
    });
    render(<PainelEstatistica dados={dados} aoPeriodo={vi.fn()} />);
    expect(screen.getByRole("table", { name: "Eventos e pacientes por categoria" })).toBeTruthy();
    expect(screen.getByRole("table", { name: "Administrações por estado" })).toBeTruthy();
    expect(screen.getByRole("table", { name: "Exclusões da projeção" }).textContent).toContain("Eventos fora do período");
    expect(screen.getByRole("region", { name: "Cobertura documental" }).textContent).toContain("1 de 3 pacientes (33,3%)");
    expect(screen.getByRole("img", { name: "Eventos por categoria" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Administrações por estado" })).toBeTruthy();
    expect(screen.getAllByRole("cell", { name: "0" }).length).toBeGreaterThan(0);
  });

  it("rejeita período invertido sem disparar busca e emite o intervalo válido pelo callback", () => {
    const aoPeriodo = vi.fn();
    render(<PainelEstatistica dados={visao()} aoPeriodo={aoPeriodo} />);
    fireEvent.change(screen.getByLabelText("Início do período clínico"), { target: { value: "2026-10-20" } });
    fireEvent.change(screen.getByLabelText("Fim do período clínico"), { target: { value: "2026-10-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar período" }));
    expect(screen.getByRole("alert").textContent).toContain("depois do fim");
    expect(aoPeriodo).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Fim do período clínico"), { target: { value: "2026-10-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar período" }));
    expect(aoPeriodo).toHaveBeenLastCalledWith({ inicio: "2026-10-20", fim: "2026-10-31" });
  });

  it("expõe tabelas e filtros nomeados e desabilita controles enquanto ocupado", () => {
    render(<PainelEstatistica dados={visao()} ocupado aoPeriodo={vi.fn()} />);
    expect(screen.getByRole("region", { name: "Estatística derivada do ledger" })).toBeTruthy();
    expect(screen.getByLabelText("Início do período clínico").matches(":disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Aplicar período" }).matches(":disabled")).toBe(true);
  });

  it("sincroniza os controles quando a resposta externa retorna à carteira completa", () => {
    const aoPeriodo = vi.fn();
    const filtrada = visao({ escopo: "PERIODO_CLINICO", periodoClinico: { inicio: "2026-10-01", fim: "2026-10-31" } });
    const { rerender } = render(<PainelEstatistica dados={filtrada} aoPeriodo={aoPeriodo} />);
    fireEvent.change(screen.getByLabelText("Início do período clínico"), { target: { value: "2026-11-01" } });
    fireEvent.change(screen.getByLabelText("Fim do período clínico"), { target: { value: "2026-11-30" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar período" }));
    rerender(<PainelEstatistica dados={visao()} aoPeriodo={aoPeriodo} />);
    expect(screen.getByLabelText("Início do período clínico").getAttribute("value")).toBe("");
    expect(screen.getByLabelText("Fim do período clínico").getAttribute("value")).toBe("");
  });
});
