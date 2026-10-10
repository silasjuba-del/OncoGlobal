import { describe, expect, it, vi } from "vitest";
import {
  confirmacaoPreparouImpressao,
  validarComExibicao,
} from "../../src/ui/consulta/validarComExibicao.js";
import type { ConfirmarBloco } from "../../src/contracts/operacao.js";

const bloco = {
  patientId: "Paciente Teste 01",
  tumorLotId: "tumor-teste",
  encounterId: "encontro-teste",
  bloco: "TUDO",
  registros: [{ id: "draft-1", expectedRevision: 0 }],
  documentosExibidos: [{ documentId: "doc-1", documentVersion: 1 }],
  reconhecerAlertas: [],
  idempotencyKey: "chave-teste",
} as ConfirmarBloco;

describe("validarComExibicao", () => {
  it("exibe o bundle e só então confirma — um clique, dois passos do servidor", async () => {
    const ordem: string[] = [];
    const porta = {
      exibirBundle: vi.fn(async () => {
        ordem.push("exibir");
        return {
          patientId: bloco.patientId,
          encounterId: bloco.encounterId,
          documentos: [],
        };
      }),
      confirmar: vi.fn(async () => {
        ordem.push("confirmar");
        return { codigo: "CONFIRMADO", resultRef: "ref" };
      }),
    };

    const resultado = await validarComExibicao(
      porta,
      {
        patientId: bloco.patientId,
        encounterId: bloco.encounterId,
        tumorLotId: bloco.tumorLotId,
      },
      bloco,
    );

    expect(ordem).toEqual(["exibir", "confirmar"]);
    expect(resultado.codigo).toBe("CONFIRMADO");
    expect(porta.exibirBundle).toHaveBeenCalledTimes(1);
    expect(porta.confirmar).toHaveBeenCalledWith(bloco);
  });

  it("não confirma se a exibição falhar", async () => {
    const porta = {
      exibirBundle: vi.fn(async () => {
        throw new Error("BUNDLE_FALHOU");
      }),
      confirmar: vi.fn(async () => ({ codigo: "CONFIRMADO", resultRef: null })),
    };
    await expect(
      validarComExibicao(
        porta,
        {
          patientId: bloco.patientId,
          encounterId: bloco.encounterId,
          tumorLotId: null,
        },
        bloco,
      ),
    ).rejects.toThrow("BUNDLE_FALHOU");
    expect(porta.confirmar).not.toHaveBeenCalled();
  });

  it("só arma impressão depois de confirmação gravada", () => {
    expect(confirmacaoPreparouImpressao("CONFIRMADO")).toBe(true);
    expect(confirmacaoPreparouImpressao("GRAVADA")).toBe(true);
    expect(confirmacaoPreparouImpressao("NEGADA")).toBe(false);
    expect(confirmacaoPreparouImpressao("BUNDLE_NAO_EXIBIDO")).toBe(false);
  });
});
