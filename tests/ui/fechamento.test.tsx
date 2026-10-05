// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Fonte } from "../../src/contracts/base.js";
import { ConfirmarBloco, type Alerta } from "../../src/contracts/operacao.js";
import { BarraFechamento } from "../../src/ui/consulta/BarraFechamento.js";
import type { DocumentoBundleVisao } from "../../src/ui/consulta/Bundle.js";

const fonte: Fonte = {
  sourceId: "src-f",
  classe: "MANUAL",
  localizador: null,
  dataClinica: null,
  dataCaptura: "2026-10-05T15:00:00-03:00",
  versao: "1",
  contentHash: "hf",
};

const febre: Alerta = {
  alertaId: "al-febre",
  alvo: { patientId: "pt-01" },
  natureza: "ALERTA_ONCO",
  classeRisco: null,
  texto: "febre desde ontem",
  origemRegra: "FN-21",
  evidencias: [fonte],
  presentationOverride: false,
  authorityOverride: false,
  reconhecidoEm: null,
  destino: "CHAT",
};

const documentos: DocumentoBundleVisao[] = [
  { documentId: "doc-evo", documentVersion: 1, titulo: "evolução", preMarcado: true, visivel: true },
  { documentId: "doc-rx", documentVersion: 2, titulo: "receita", preMarcado: true, visivel: true },
  { documentId: "doc-oculto", documentVersion: 1, titulo: "laudo não exibido", preMarcado: true, visivel: false },
];

afterEach(() => {
  cleanup();
});

function tela(onValidar = vi.fn(), onImprimir = vi.fn()) {
  render(
    <BarraFechamento
      patientId="pt-01"
      tumorLotId="lot-1"
      encounterId="en-1"
      blocoAtual="EVOLUCAO"
      registros={[{ id: "r1", expectedRevision: 3 }]}
      documentos={documentos}
      alertasVermelhosExibidos={[febre]}
      idempotencyKey="rotina-01-tudo"
      autorExibido="Médico Teste · CRM 00000"
      alvoImpressao={{ tipo: "EVOLUCAO", id: "doc-evo", versao: 1 }}
      chaveImpressao="rotina-01-print"
      onValidar={onValidar}
      onImprimir={onImprimir}
    />,
  );
  return { onValidar, onImprimir };
}

describe("fechamento", () => {
  it("percurso de rotina ≤ 5 cliques; validar não imprime; payload estrito", () => {
    const { onValidar, onImprimir } = tela();
    const percursoRotina = ["validar tudo"] as const;
    expect(percursoRotina.length).toBeLessThanOrEqual(5);

    expect(screen.getByRole("button", { name: "validar tudo" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "validar bloco" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByText("Serão marcados como ciente:")).toBeTruthy();
    expect(screen.getByText("febre desde ontem")).toBeTruthy();
    expect(screen.queryByText("laudo não exibido")).toBeNull();
    expect(screen.getByLabelText("autor da assinatura").textContent).toBe("Médico Teste · CRM 00000");

    for (const passo of percursoRotina) {
      fireEvent.click(screen.getByRole("button", { name: passo }));
    }
    expect(onImprimir).not.toHaveBeenCalled();
    expect(onValidar).toHaveBeenCalledTimes(1);
    const payload = onValidar.mock.calls[0]?.[0];
    expect(ConfirmarBloco.safeParse(payload).success).toBe(true);
    expect(Object.keys(payload).sort()).toEqual([
      "bloco",
      "documentosExibidos",
      "encounterId",
      "idempotencyKey",
      "patientId",
      "reconhecerAlertas",
      "registros",
      "tumorLotId",
    ]);
    expect(payload.bloco).toBe("TUDO");
    expect(payload.documentosExibidos).toEqual([
      { documentId: "doc-evo", documentVersion: 1 },
      { documentId: "doc-rx", documentVersion: 2 },
    ]);
    expect(payload.reconhecerAlertas).toEqual(["al-febre"]);
    expect(JSON.stringify(payload)).not.toContain("Médico Teste");
  });

  it("desmarcar e validar bloco continua ≤ 5 e omite o documento", () => {
    const cliques: string[] = [];
    const { onValidar, onImprimir } = tela(
      vi.fn(() => {
        cliques.push("validar bloco");
      }),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /receita/ }));
    cliques.push("desmarcar receita");
    fireEvent.click(screen.getByRole("button", { name: "validar bloco" }));
    expect(cliques).toEqual(["desmarcar receita", "validar bloco"]);
    expect(cliques.length).toBeLessThanOrEqual(5);
    expect(onImprimir).not.toHaveBeenCalled();
    const payload = onValidar.mock.calls[0]?.[0];
    expect(payload.bloco).toBe("EVOLUCAO");
    expect(payload.documentosExibidos).toEqual([{ documentId: "doc-evo", documentVersion: 1 }]);
  });

  it("imprimir é outro botão", () => {
    const { onValidar, onImprimir } = tela();
    fireEvent.click(screen.getByRole("button", { name: "imprimir" }));
    expect(onValidar).not.toHaveBeenCalled();
    expect(onImprimir).toHaveBeenCalledTimes(1);
    expect(onImprimir.mock.calls[0]?.[0].verbo).toBe("IMPRIMIR");
  });
});
