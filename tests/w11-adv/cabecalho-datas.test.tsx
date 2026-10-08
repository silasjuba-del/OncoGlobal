// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  CabecalhoDatasFixas,
  type DatasFixasVisao,
} from "../../src/ui/consulta/CabecalhoDatasFixas.js";

afterEach(() => {
  cleanup();
});

const PROIBIDAS_MAQUINA = /amarelo|liberad[oa]|aprovad[oa]|\bapto\b/i;

const COMPLETO: DatasFixasVisao = {
  dataReferencia: "2026-10-08",
  biopsia: { estado: "PREENCHIDO", data: "2026-01-10", fonte: "b1" },
  c1d1: { estado: "PREENCHIDO", data: "2026-03-01", fonte: "c1" },
  ultimoEstadiamento: { estado: "PREENCHIDO", data: "2026-05-20", fonte: "e1", tipo: "RESTAGING" },
  ultimaExposicao: { estado: "PREENCHIDO", data: "2026-10-01", fonte: "x1" },
};

const VAZIO: DatasFixasVisao = {
  dataReferencia: "2026-10-08",
  biopsia: { estado: "PENDENTE", motivo: "AUSENTE" },
  c1d1: { estado: "PENDENTE", motivo: "AUSENTE" },
  ultimoEstadiamento: { estado: "PENDENTE", motivo: "AUSENTE", tipo: null },
  ultimaExposicao: { estado: "PENDENTE", motivo: "AUSENTE" },
};

function campo(testId: string): HTMLElement {
  const el = document.querySelector(`[data-campo="${testId}"]`);
  if (!el) throw new Error(`campo ausente: ${testId}`);
  return el as HTMLElement;
}

describe("w11-h23 cabecalho das 4 datas fixas", () => {
  it("1. renderiza os quatro rótulos dentro de uma seção nomeada", () => {
    render(<CabecalhoDatasFixas visao={COMPLETO} />);
    const secao = screen.getByRole("region", { name: "Datas fixas do tratamento" });
    expect(within(secao).getByText("Biópsia")).toBeTruthy();
    expect(within(secao).getByText("C1D1")).toBeTruthy();
    expect(within(secao).getByText("Último estadiamento")).toBeTruthy();
    expect(within(secao).getByText("Última exposição")).toBeTruthy();
  });

  it("2. data preenchida mostra data civil brasileira e dias desde a referência", () => {
    render(<CabecalhoDatasFixas visao={COMPLETO} />);
    expect(campo("biopsia").textContent).toContain("10/01/2026");
    expect(campo("biopsia").textContent).toContain("271 dias desde");
    expect(campo("ultima-exposicao").textContent).toContain("01/10/2026");
    expect(campo("ultima-exposicao").textContent).toContain("7 dias desde");
  });

  it("3. tipo do estadiamento aparece junto do rótulo", () => {
    render(<CabecalhoDatasFixas visao={COMPLETO} />);
    expect(campo("ultimo-estadiamento").textContent).toContain("reestadiamento");
  });

  it("4. ausência vira campo vazio com marca pendente, sem data inventada", () => {
    render(<CabecalhoDatasFixas visao={VAZIO} />);
    for (const id of ["biopsia", "c1d1", "ultimo-estadiamento", "ultima-exposicao"]) {
      expect(campo(id).getAttribute("data-estado")).toBe("PENDENTE");
      expect(campo(id).textContent).toContain("pendente");
      expect(campo(id).textContent).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
      expect(campo(id).textContent).not.toContain("dias desde");
    }
  });

  it("5. conflito mostra as duas fontes com suas datas e nunca escolhe uma", () => {
    const visao: DatasFixasVisao = {
      ...COMPLETO,
      c1d1: {
        estado: "PENDENTE",
        motivo: "CONFLITO",
        fontes: [
          { rotulo: "Prescrição A", data: "2026-03-01" },
          { rotulo: "Prescrição B", data: "2026-03-08" },
        ],
      },
    };
    render(<CabecalhoDatasFixas visao={visao} />);
    const lista = screen.getByRole("list", { name: "Fontes em conflito" });
    expect(lista.textContent).toContain("CONFLITO");
    expect(lista.textContent).toContain("Prescrição A: 01/03/2026");
    expect(lista.textContent).toContain("Prescrição B: 08/03/2026");
    expect(campo("c1d1").textContent).not.toContain("dias desde");
  });

  it("6. texto visível nunca usa linguagem de liberação ou cor amarela", () => {
    const { container } = render(<CabecalhoDatasFixas visao={VAZIO} />);
    expect(container.textContent ?? "").not.toMatch(PROIBIDAS_MAQUINA);
    const fonte = readFileSync(
      "src/ui/consulta/CabecalhoDatasFixas.tsx",
      "utf8",
    );
    expect(fonte).not.toMatch(/yellow|amarelo|#ff0|#fc0|#ffd/i);
  });

  it("7. componente não importa o kernel (fronteira de props próprias)", () => {
    const fonte = readFileSync(
      "src/ui/consulta/CabecalhoDatasFixas.tsx",
      "utf8",
    );
    expect(fonte).not.toMatch(/from\s+["'][^"']*kernel/);
    expect(fonte).not.toMatch(/from\s+["'][^"']*contracts/);
  });

  it("8. cores usam tokens do tema OncoChart, não valores fixos", () => {
    const fonte = readFileSync(
      "src/ui/consulta/CabecalhoDatasFixas.tsx",
      "utf8",
    );
    expect(fonte).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(fonte).toContain("var(--danger)");
    expect(fonte).toContain("var(--muted)");
  });

  it("9. data inválida na referência não quebra a renderização", () => {
    render(<CabecalhoDatasFixas visao={{ ...COMPLETO, dataReferencia: "não-é-data" }} />);
    expect(campo("biopsia").textContent).toContain("10/01/2026");
    expect(campo("biopsia").textContent).not.toContain("dias desde");
  });
});
