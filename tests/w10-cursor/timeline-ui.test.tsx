// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { criarChaves } from "../../src/ui/api/chaves.js";
import { criarPortaFalsa, ID } from "../../src/ui/api/fake.js";
import { TelaConsulta } from "../../src/ui/telas/TelaConsulta.js";
import { fonteSintetica } from "../fixtures/triagem.js";
import { projetarHistoricoTratamento } from "../../src/kernel/projections/historicoTratamento.js";

afterEach(() => {
  cleanup();
});

describe("CURSOR-03 Timeline 2D", () => {
  it("mostra lanes, HOJE, ciclo e Ver em 3D; histórico de estádio permanece", async () => {
    const porta=criarPortaFalsa();
    const carregar=porta.carregarConsulta;
    // F0C: o produto usa projeções reais; o teste fornece explicitamente cada fato sintético, com origem.
    porta.carregarConsulta=async (...args)=>{
      const v=await carregar(...args),lote=v.cabecalho.lotes[0]!;
      return {...v,cabecalho:{...v.cabecalho,loteSelecionadoId:lote.tumorLotId,
        lotes:[{...lote,estadiamentos:[{estadiamentoId:"est-teste",sistema:"AJCC",edicao:"8",prefixo:"c",T:"T2",N:"N1",M:"M0",grupo:"IIB",data:"2026-05-12",fontes:[fonteSintetica("est-teste")],usoAtivo:["PROTOCOLO"]}]}]},
        historicoTratamento:{estado:"PARCIAL",codigo:null,linhas:projetarHistoricoTratamento([{tipo:"SISTEMICO",id:"administracao-teste",data:"2026-06-02",ciclo:1,protocolo:"Protocolo documentado",doseRelativaPct:100,previstoEm:"2026-06-02",observacao:"Administração confirmada na fonte sintética"}])}};
    };
    render(<TelaConsulta patientId={ID.verde} porta={porta} chaves={criarChaves()} />);
    const tl = await screen.findByRole("region", { name: "Linha do tempo oncológica" }, { timeout: 20_000 });
    expect(within(tl).getAllByText("Diagnóstico").length).toBeGreaterThan(0);
    expect(within(tl).getAllByText("Imagem").length).toBeGreaterThan(0);
    expect(within(tl).getAllByText("Sistêmico").length).toBeGreaterThan(0);
    expect(within(tl).getAllByText("Cirurgia · RT").length).toBeGreaterThan(0);
    expect(tl.querySelector('[data-lane="Diagnóstico"]')).toBeTruthy();
    expect(within(tl).getByLabelText("HOJE")).toBeTruthy();
    expect(within(tl).getByText("C1")).toBeTruthy();
    expect(within(tl).getByText("Protocolo documentado")).toBeTruthy();
    expect(within(tl).getByText("Administração confirmada na fonte sintética")).toBeTruthy();
    expect(within(tl).queryByText(/Ciclo sintético/)).toBeNull();
    expect(within(tl).getByRole("region", { name: "Histórico de estádio" }).textContent).toContain("cT2N1M0");
    fireEvent.click(within(tl).getByRole("button", { name: "Ver em 3D" }));
    expect(screen.getByRole("dialog", { name: "Jornada oncológica 3D" })).toBeTruthy();
  }, 30_000);
});
