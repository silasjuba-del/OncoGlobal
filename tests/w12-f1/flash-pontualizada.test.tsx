// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ConsultaFlash,
  type ConsultaFlashProps,
  type ItemFlash,
  type PlanoFlash,
} from "../../src/ui/consulta/ConsultaFlash.js";
import { montarLinhaPontualizada } from "../../src/ui/consulta/viewmodels.js";

afterEach(() => {
  cleanup();
});

const PROIBIDAS = /amarelo|liberad[oa]|aprovad[oa]|\bapto\b/i;

const EXAMES = [
  { data: "01/10", nome: "Biópsia", fraseLaudo: "adenocarcinoma", situacao: "SEM_REFERENCIA" as const },
  { data: "02/10", nome: "TC tórax", fraseLaudo: "nódulo 43 mm", situacao: "SEM_REFERENCIA" as const },
  { data: "03/10", nome: "Cintilografia", fraseLaudo: "captação T7", situacao: "SEM_REFERENCIA" as const },
];

const item = (id: string, rotulo: string, origem: ItemFlash["origem"], preMarcado: boolean): ItemFlash => ({
  id,
  rotulo,
  origem,
  preMarcado,
});

function props(over: Partial<ConsultaFlashProps> = {}): ConsultaFlashProps {
  return {
    cabecalho: { diagnostico: "Paciente Teste 01 - carcinoma de pulmão" },
    exames: EXAMES,
    acoesHoje: [],
    receitas: [],
    apac: { cid: "C34.9", sigtap: "x", finalidade: "PALIATIVO", competencia: "10/26", estado: "PENDENTE", pendencias: [] },
    iaFala: [],
    retorno: { dias: 30, examesAntesDoRetorno: [] },
    linhaPontualizada: true,
    tarefasRetorno: {
      modeloPadraoSalvo: true,
      retorno: item("retorno", "Retorno", "MODELO_MEDICO", true),
      laboratorio: item("lab", "Laboratório", "MODELO_MEDICO", true),
      imagem: item("img", "Imagem", "MODELO_MEDICO", false),
    },
    aoSalvarRascunho: vi.fn(),
    aoFinalizar: vi.fn(),
    ...over,
  };
}

const cb = (nome: RegExp) => screen.getByRole("checkbox", { name: nome }) as HTMLInputElement;
const LINHA_COMPLETA = "Biópsia: adenocarcinoma · TC tórax: nódulo 43 mm · Cintilografia: captação T7";

describe("W12-F1 linha pontualizada", () => {
  it("completa, separada por separador de ponto médio, com a frase do laudo", () => {
    expect(montarLinhaPontualizada({ exames: EXAMES })).toBe(LINHA_COMPLETA);
  });

  it("dado ausente é omitido, sem PENDENTE", () => {
    const linha = montarLinhaPontualizada({
      diagnostico: "  ",
      exames: [EXAMES[0]!, { nome: "TC tórax", fraseLaudo: undefined }, { nome: "RM", fraseLaudo: "" }, EXAMES[2]!],
    });
    expect(linha).toBe("Biópsia: adenocarcinoma · Cintilografia: captação T7");
    expect(linha).not.toMatch(/PENDENTE/);
    expect(montarLinhaPontualizada({ exames: [] })).toBe("");
  });

  it("é determinística e inclui diagnóstico quando presente", () => {
    const e = { diagnostico: "Adenocarcinoma de pulmão", exames: EXAMES };
    expect(montarLinhaPontualizada(e)).toBe(montarLinhaPontualizada(e));
    expect(montarLinhaPontualizada(e).startsWith("Diagnóstico: Adenocarcinoma de pulmão · Biópsia:")).toBe(true);
  });

  // F0-COMPLEMENTO: biópsia e imagem agora compartilham uma linha, com data e trecho.
  it("exibe data e frase em uma linha e explicita ausência", () => {
    const {unmount}=render(<ConsultaFlash {...props({cabecalho:{}})} />);
    expect(screen.getByLabelText("Biópsia e imagem").textContent).toBe("01/10 · Biópsia: adenocarcinoma | 02/10 · TC tórax: nódulo 43 mm | 03/10 · Cintilografia: captação T7");
    unmount(); render(<ConsultaFlash {...props({exames:[]})} />);
    expect(screen.getByLabelText("Biópsia e imagem").textContent).toContain("PENDENTE");
  });
});
describe("F0-COMPLEMENTO seleção explícita de solicitações", () => {
 it("modelo legado booleano não inventa quais exames solicitar", () => {
  render(<ConsultaFlash {...props()} />);
  for(const check of screen.getAllByRole("checkbox")) expect((check as HTMLInputElement).checked).toBe(false);
  expect(screen.queryByRole("checkbox",{name:/^Retorno/})).toBeNull();
 });
 it("prazo permanece editável e seleção agrupada entrega itens reais", () => {
  const p=props(); render(<ConsultaFlash {...p} />);
  expect((screen.getByLabelText("Prazo do retorno em dias") as HTMLInputElement).value).toBe("30");
  fireEvent.click(screen.getByRole("button",{name:"Selecionar todos LAB"}));
  fireEvent.click(cb(/^TC tórax$/));
  fireEvent.click(screen.getByRole("button",{name:"REVISAR · IMPRIMIR"}));
  expect(p.aoSalvarRascunho).not.toHaveBeenCalled();
  const plano=(p.aoFinalizar as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as PlanoFlash;
  expect(plano.tarefasRetorno).toEqual({retorno:true,laboratorio:true,imagem:true});
  expect(plano.solicitacoes?.imagem).toEqual(["TC tórax"]); expect(plano.apac.emitir).toBe(false);
 });
 it("teclado alcança checkbox e botão de revisão", () => {
  render(<ConsultaFlash {...props()} />); const lab=cb(/^HMG$/); lab.focus(); expect(document.activeElement).toBe(lab);
  const btn=screen.getByRole("button",{name:"REVISAR · IMPRIMIR"}); btn.focus(); expect(document.activeElement).toBe(btn);
 });
 it("sem estado de aprovação da máquina", () => {
  render(<ConsultaFlash {...props()} />); expect(document.body.textContent ?? "").not.toMatch(PROIBIDAS);
 });
});
