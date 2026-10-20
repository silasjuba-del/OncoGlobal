// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConsultaIntegrada } from "../../src/ui/api/respostas.js";
import { CockpitJEV } from "../../src/ui/consulta/CockpitJEV.js";

afterEach(cleanup);

function visao(overrides: Partial<ConsultaIntegrada> = {}): ConsultaIntegrada {
  const pacienteId = "paciente-jev-sintetico";
  const encontroId = "encontro-jev-sintetico";
  return {
    hoje: "2026-10-20", patientId: pacienteId, encounterId: encontroId, tumorLotId: "lote-jev-sintetico",
    cabecalho: {
      hoje: "2026-10-20",
      paciente: { patientId: pacienteId, identificadores: [], nome: "Pessoa JEV sintética", nascimento: null,
        sexoCadastral: "NAO_INFORMADO", divergencia: false },
      lotes: [], loteSelecionadoId: "lote-jev-sintetico", episodio: { esquemaId: "PROTOCOLO-SINTETICO" },
      ciclo: { cicloId: "ciclo-sintetico", episodioId: "episodio-sintetico", numero: 4, previstoEm: "2026-10-28",
        prescricaoRef: { documentId: "prescricao-sintetica", documentVersion: 2 },
        itens: [{ item: 1, droga: "fármaco sintético", doseMg: 200, reducaoPct: 20 }] },
      semaforo: "PENDENTE", pendentes: 3, contatosDesdeUltima: [], alergiasPaciente: ["Alergia sintética documentada"],
      comorbidadesPaciente: [],
    },
    alertas: [], delta: { temSnapshotAnterior: true, itens: [{ id: "delta-sintetico", rotulo: "Creatinina", kind: "ALTERADO", estado: "PENDENTE" }] },
    evidencias: [{ rotulo: "PD-L1 TPS", valorTexto: "12%", estado: "VERDE", campo: "PRESENTE", motivo: "Fonte sintética",
      revisao: "CONFIRMADO", fontes: [{ sourceId: "fonte-pdl1", classe: "LAUDO", localizador: "p. 2", dataClinica: "2026-10-18",
        dataCaptura: "2026-10-19T12:00:00Z", versao: "1", contentHash: "a".repeat(64) }], evidenceLayer: "DOCUMENT_TEXT" }],
    fechamento: { blocoAtual: "EVOLUCAO", registros: [], documentos: [], autorExibido: "Médico sintético",
      alvoImpressao: null, alertasVermelhos: [] },
    flash: { exames: [], retornoDias: null, modeloPadraoSalvo: false, laboratorioPreMarcado: false, imagemPreMarcada: false,
      cicloAtual: 3, ciclosPrevistos: 8, ultimoAdministrado: "C3 em 2026-10-14 (COMPLETA)", alergia: "Alergia sintética documentada" },
    ...overrides,
  } as unknown as ConsultaIntegrada;
}

describe("CockpitJEV no app HTTP", () => {
  it("mantém o valor confirmado em alerta visível, sem confundir risco com conflito documental", () => {
    const v = visao();
    v.evidencias = [{ ...v.evidencias[0]!, rotulo: "Função renal",
      valorTexto: "25 mL/min · Cockcroft-Gault", estado: "VERMELHO", campo: "PRESENTE" }];
    render(<CockpitJEV visao={v} conduta={null} saida={null} aoComando={vi.fn()} />);
    const metrica = within(screen.getByRole("region", { name: "Cabeçalho clínico JEV" })).getByText("Função renal").parentElement!;
    expect(metrica.textContent).toContain("25 mL/min");
    expect(metrica.getAttribute("data-state")).toBe("ALERTA");
  });

  it("compõe cabeçalho, três cartões, slots e painel lateral com dados recebidos", () => {
    const aoComando = vi.fn();
    render(<CockpitJEV visao={visao()} conduta={<p>Conduta real via slot</p>} saida={<p>Bundle real via slot</p>}
      mudancasExtra={<p>Revisão de fonte no contexto</p>} evidenciasExtra={<p>OncoAssist documental</p>} aoComando={aoComando} />);

    expect(screen.getByRole("region", { name: /cabeçalho clínico JEV/i })).toBeTruthy();
    expect(screen.getByText("Pessoa JEV sintética")).toBeTruthy();
    expect(screen.getByText("paciente-jev-sintetico")).toBeTruthy();
    expect(screen.getByRole("region", { name: /cabeçalho clínico JEV/i }).textContent).toContain("lote-jev-sintetico");
    expect(screen.getByRole("region", { name: /mudou|pré-consulta/i })).toBeTruthy();
    expect(screen.getByRole("region", { name: /conduta|protocolo/i })).toBeTruthy();
    expect(screen.getByRole("region", { name: /bundle de saída/i })).toBeTruthy();
    expect(screen.getByRole("complementary", { name: /evidências/i })).toBeTruthy();
    expect(screen.getByText("Conduta real via slot")).toBeTruthy();
    expect(screen.getByText("Bundle real via slot")).toBeTruthy();
    expect(screen.getByText("Revisão de fonte no contexto")).toBeTruthy();
    expect(screen.getByText("OncoAssist documental")).toBeTruthy();
    expect(aoComando).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Recolher evidências" }));
    expect(screen.queryByText("OncoAssist documental")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Expandir evidências" }));
    expect(screen.getByText("OncoAssist documental")).toBeTruthy();
  });

  it("separa planejado, prescrito e administrado; nunca estima SC, ECOG ou função renal ausentes", () => {
    render(<CockpitJEV visao={visao()} conduta={null} saida={null} aoComando={vi.fn()} />);
    const regua = screen.getByRole("group", { name: /régua do ciclo/i });
    expect(regua.textContent).toContain("Planejado");
    expect(regua.textContent).toContain("C4");
    expect(regua.textContent).toContain("2026-10-28");
    expect(regua.textContent).toContain("Prescrito");
    expect(regua.textContent).toContain("prescricao-sintetica");
    expect(regua.textContent).toContain("fármaco sintético: 200 mg · redução 20%");
    expect(regua.textContent).toContain("Administrado");
    expect(regua.textContent).toContain("C3 em 2026-10-14");
    const metric = (label: string) => screen.getByText(label).parentElement?.textContent ?? "";
    expect(metric("ECOG")).toContain("PENDENTE");
    expect(metric("SC")).toContain("PENDENTE");
    expect(metric("Função renal")).toContain("PENDENTE");
  });

  it("expõe fonte/hash/data reais e usa pendência explícita quando a visão ou evidência falta", () => {
    const { rerender } = render(<CockpitJEV visao={visao()} conduta={null} saida={null} aoComando={vi.fn()} />);
    const painel = screen.getByRole("complementary", { name: /evidências/i });
    const afirmacoes = painel.querySelector(".jev-evidence__claims") as HTMLDetailsElement;
    fireEvent.click(afirmacoes.querySelector("summary")!);
    const fonte = afirmacoes.querySelector(".jev-source") as HTMLDetailsElement;
    fireEvent.click(fonte.querySelector("summary")!);
    expect(painel.textContent).toContain("fonte-pdl1");
    expect(painel.textContent).toContain("2026-10-18");
    expect(painel.textContent).toContain("a".repeat(64));

    const semRetrato = visao({ evidencias: [] });
    delete semRetrato.retrato;
    rerender(<CockpitJEV visao={semRetrato} conduta={null} saida={null} aoComando={vi.fn()} />);
    const metricAfter = (label: string) => screen.getByText(label).parentElement?.textContent ?? "";
    expect(metricAfter("ECOG")).toContain("PENDENTE");
    expect(metricAfter("SC")).toContain("PENDENTE");
    expect(screen.queryByText("12%" )).toBeNull();
  });
});
