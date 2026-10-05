// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Fonte } from "../../src/contracts/base.js";
import type { Ciclo, Contato, Paciente, TreatmentEpisode, TumorLot } from "../../src/contracts/clinico.js";
import { CabecalhoPaciente } from "../../src/ui/consulta/CabecalhoPaciente.js";
import type { CabecalhoVisao } from "../../src/ui/consulta/viewmodels.js";

const fonte: Fonte = {
  sourceId: "src-1",
  classe: "MANUAL",
  localizador: null,
  dataClinica: "2026-01-01",
  dataCaptura: "2026-10-05T10:00:00-03:00",
  versao: "1",
  contentHash: "h1",
};

function presente(valor: string) {
  return {
    valor,
    estado: "VERDE" as const,
    campo: "PRESENTE" as const,
    motivo: "sintético",
    fontes: [fonte],
    revisao: "CONFIRMADO" as const,
  };
}

function ausente() {
  return {
    valor: null,
    estado: "PENDENTE" as const,
    campo: "AUSENTE" as const,
    motivo: "ausente",
    fontes: [] as Fonte[],
    revisao: "RAW" as const,
  };
}

function lote(id: string, topografia: string): TumorLot {
  return {
    tumorLotId: id,
    patientId: "pt-01",
    cid: presente("C50"),
    topografia: presente(topografia),
    histologia: ausente(),
    estadiamentos: [],
    finalidadeApac: ausente(),
    marcos: [],
  };
}

const paciente: Paciente = {
  patientId: "pt-01",
  identificadores: [{ tipo: "CNS", valor: "700000000000001" }],
  nome: "Paciente Teste 01",
  nascimento: "1960-04-02",
  sexoCadastral: "F",
  divergencia: false,
};

const episodio: TreatmentEpisode = {
  episodioId: "ep-1",
  tumorLotId: "lot-mama",
  modalidade: "QT",
  intencao: "PALIATIVA",
  intentModifier: null,
  linha: 2,
  esquemaId: "esquema-teste",
  inicio: ausente(),
  fim: ausente(),
};

const ciclo: Ciclo = {
  cicloId: "ci-1",
  episodioId: "ep-1",
  numero: 3,
  previstoEm: "2026-10-05",
  pesoKg: ausente(),
  origemPeso: null,
  ciclosSemPesoConsecutivos: 0,
  prescricaoRef: null,
  itens: [],
  comMedico: true,
};

const contato: Contato = {
  contatoId: "ct-1",
  canal: "WHATSAPP_SERVICO",
  endereco: "5500000000001",
  patientId: "pt-01",
  relacao: "FAMILIAR",
  vinculadoEm: "2026-10-01T10:00:00-03:00",
  revogadoEm: null,
};

function visao(parcial: Partial<CabecalhoVisao> = {}): CabecalhoVisao {
  return {
    hoje: "2026-10-05",
    paciente,
    lotes: [lote("lot-mama", "mama"), lote("lot-pulmao", "pulmão")],
    loteSelecionadoId: "lot-mama",
    episodio,
    ciclo,
    semaforo: "PENDENTE",
    pendentes: 4,
    contatosDesdeUltima: [contato],
    alergiasPaciente: ["dipirona"],
    comorbidadesPaciente: ["hipertensão"],
    ...parcial,
  };
}

afterEach(() => {
  cleanup();
});

describe("cabeçalho do paciente", () => {
  it("PENDENTE não aparece como verde e a cor vem com a palavra", () => {
    const { container } = render(
      <CabecalhoPaciente visao={visao()} onSelecionarLote={() => undefined} />,
    );
    const marca = container.querySelector("[data-semaforo='PENDENTE']");
    expect(marca).toBeTruthy();
    expect(marca?.textContent).toContain("PENDENTE");
    expect(marca?.textContent).not.toContain("VERDE");
    expect(marca?.className).not.toMatch(/verde/);
    expect(marca?.className).toContain("semaforo-pendente");
    expect(screen.getByText("◐ 4 pendentes")).toBeTruthy();
  });

  it("VERDE não é rotulado como liberado", () => {
    render(
      <CabecalhoPaciente visao={visao({ semaforo: "VERDE", pendentes: 0 })} onSelecionarLote={() => undefined} />,
    );
    expect(screen.getByText(/VERDE — nenhum alerta com os dados disponíveis/)).toBeTruthy();
    expect(screen.queryByText(/liberado/i)).toBeNull();
  });

  it("troca de lote não troca o paciente nem esconde alergias", () => {
    const onSelecionarLote = vi.fn();
    const { rerender } = render(
      <CabecalhoPaciente visao={visao()} onSelecionarLote={onSelecionarLote} />,
    );
    expect(screen.getByText("Tumor: mama")).toBeTruthy();
    expect(screen.getByText("Alergias: dipirona")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Tumor / lote"), { target: { value: "lot-pulmao" } });
    expect(onSelecionarLote).toHaveBeenCalledWith("lot-pulmao");
    expect(screen.getByText("Paciente Teste 01")).toBeTruthy();
    expect(screen.getByText("Alergias: dipirona")).toBeTruthy();
    expect(screen.getByText("Comorbidades: hipertensão")).toBeTruthy();

    rerender(
      <CabecalhoPaciente
        visao={visao({ loteSelecionadoId: "lot-pulmao" })}
        onSelecionarLote={onSelecionarLote}
      />,
    );
    expect(screen.getByText("Tumor: pulmão")).toBeTruthy();
    expect(screen.getByText("Paciente Teste 01")).toBeTruthy();
    expect(screen.getByText("Alergias: dipirona")).toBeTruthy();
    expect(screen.getByText("Linha: 2")).toBeTruthy();
    expect(screen.getByText("Ciclo: 3")).toBeTruthy();
    expect(screen.getByText(/FAMILIAR · WHATSAPP_SERVICO/)).toBeTruthy();
  });
});
