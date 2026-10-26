// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorPrescricaoExecutavel } from "../../../src/ui/consulta/EditorPrescricaoExecutavel.js";
import { presente, ausente } from "../../fixtures/triagem.js";
import type {
  BasePrescricaoExecutavelResposta,
  PrescricaoExecutavelPreparada,
} from "../../../src/contracts/api/operacaoPrescricaoExecutavel.js";

afterEach(cleanup);

const contexto = { patientId: "pt-multi", encounterId: "en-multi", tumorLotId: "lot-multi-a" };
  const conteudo: PrescricaoExecutavelPreparada["conteudo"] = {
    schema: "PrescricaoExecutavel@1",
    contexto: { ...contexto, episodioId: "ep-sintetico", cicloId: "ciclo-sintetico" },
    documentId: "rx-sintetica-uh5",
    documentVersion: 1,
    protocoloId: "protocolo-sintetico",
    dataPrevista: "2026-10-20",
    motivo: "Revisão sintética",
    origemProposta: null,
    itens: [
      {
        itemId: "item-sintetico",
        item: {
          drug: "Fármaco sintético",
          classe: "QT",
          sequence: 1,
          standardDose: null,
          doseBasis: "FIXED",
          calculatedDose: null,
          prescribedDose: 100,
          unit: "mg",
          adjustmentPercent: null,
          adjustmentReason: null,
          route: "EV",
          diluent: "SF 0,9%",
          finalVolumeMl: 100,
          infusionTime: "30 min",
          days: ["d1"],
          observacao: null,
          source: "MANUAL",
          overrideMotivo: "Motivo sintético explícito",
        },
      },
    ],
  };
  const base: BasePrescricaoExecutavelResposta = {
    contexto,
    pacienteNome: "Paciente SINTETICO U-H5",
    revisao: "a".repeat(64),
    pendencias: [],
    vigente: conteudo,
    episodio: {
      episodioId: "ep-sintetico",
      tumorLotId: contexto.tumorLotId,
      modalidade: "QT",
      intencao: "PALIATIVA",
      intentModifier: null,
      linha: 1,
      esquemaId: "protocolo-sintetico",
      inicio: ausente<string>(),
      fim: ausente<string>(),
    },
    ciclo: {
      cicloId: "ciclo-sintetico",
      episodioId: "ep-sintetico",
      numero: 1,
      previstoEm: "2026-10-20",
      pesoKg: presente(70),
      origemPeso: "MEDIDO",
      ciclosSemPesoConsecutivos: 0,
      comMedico: true,
      prescricaoRef: { documentId: "rx-sintetica-uh5", documentVersion: 1 },
      itens: [{ item: 1, droga: "Fármaco sintético", doseMg: 100, reducaoPct: null }],
    },
  };

// U-H5 (auditoria): a resposta de um preparo antigo não pode liberar a guarda do preparo em curso.
describe("U-H5 · corrida entre preparo antigo e preparo da base nova", () => {
  it("preparo antigo que termina depois da troca de base não reabre o botão do preparo novo", async () => {
    const pendentes: Array<() => void> = [];
    const aoPreparar = vi.fn(() => new Promise<never>((_, rejeitar) => {
      pendentes.push(() => rejeitar(new Error("SINTETICO: resposta tardia")));
    }));
    const aoAssinar = vi.fn(async () => {});
    const { rerender } = render(<EditorPrescricaoExecutavel base={base} aoPreparar={aoPreparar} aoAssinar={aoAssinar} />);
    fireEvent.change(screen.getByLabelText("Motivo da prescrição"), { target: { value: "Motivo SINTETICO corrida" } });
    fireEvent.click(screen.getByRole("button", { name: "Preparar prévia exata" }));
    expect(aoPreparar).toHaveBeenCalledTimes(1);

    rerender(<EditorPrescricaoExecutavel base={{ ...base, revisao: "d".repeat(64) }} aoPreparar={aoPreparar} aoAssinar={aoAssinar} />);
    fireEvent.click(await screen.findByRole("button", { name: "Preparar prévia exata" }));
    expect(aoPreparar).toHaveBeenCalledTimes(2);

    await act(async () => { pendentes[0]!(); });
    const botao = screen.getByRole("button", { name: "Preparar prévia exata" });
    expect((botao as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(botao);
    expect(aoPreparar).toHaveBeenCalledTimes(2);
  });
});
