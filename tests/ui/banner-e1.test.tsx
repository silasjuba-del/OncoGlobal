// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Fonte } from "../../src/contracts/base.js";
import type { Alerta } from "../../src/contracts/operacao.js";
import { BannerE1 } from "../../src/ui/consulta/BannerE1.js";

const fonte: Fonte = {
  sourceId: "src-e1",
  classe: "WHATSAPP",
  localizador: null,
  dataClinica: "2026-10-05",
  dataCaptura: "2026-10-05T14:00:00-03:00",
  versao: "1",
  contentHash: "he1",
};

const alerta: Alerta = {
  alertaId: "al-1",
  alvo: { contatoNaoVinculadoId: "contato-x" },
  natureza: "AMEACA_IMEDIATA",
  classeRisco: "ABSOLUTA",
  texto: "sangramento relatado",
  origemRegra: "FN-21",
  evidencias: [fonte],
  presentationOverride: true,
  authorityOverride: false,
  reconhecidoEm: null,
  destino: "CHAT",
};

afterEach(() => {
  cleanup();
});

describe("banner E1", () => {
  it("não fecha; reconhecer deixa o banner e o horário", () => {
    const onReconhecer = vi.fn();
    render(
      <BannerE1
        alertas={[alerta, { ...alerta, alertaId: "al-2", presentationOverride: false, texto: "não é E1" }]}
        agora="2026-10-05T14:30:00-03:00"
        onReconhecer={onReconhecer}
      />,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /fechar|dispensar|ocultar/i })).toBeNull();
    expect(screen.queryByText("não é E1")).toBeNull();
    expect(screen.getByText(/contato não vinculado contato-x/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "reconhecer" }));
    expect(onReconhecer).toHaveBeenCalledWith("al-1", "2026-10-05T14:30:00-03:00");
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Reconhecido em 2026-10-05 14:30")).toBeTruthy();
    expect(screen.getByRole("button", { name: "reconhecer" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /fechar|dispensar|ocultar/i })).toBeNull();
  });
});
