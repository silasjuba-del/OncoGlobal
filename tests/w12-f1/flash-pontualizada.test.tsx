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

  it("aparece no topo da Flash e some quando não há dado", () => {
    const { unmount } = render(<ConsultaFlash {...props({ cabecalho: {} })} />);
    expect(screen.getByLabelText("Achados-chave").textContent).toBe(LINHA_COMPLETA);
    unmount();
    render(<ConsultaFlash {...props({ cabecalho: {}, exames: [] })} />);
    expect(screen.queryByLabelText("Achados-chave")).toBeNull();
  });
});

describe("W12-F1 tarefas do retorno", () => {
  it("com modelo salvo: pré-marca só o que o modelo marca; imagem nasce desmarcada", () => {
    render(<ConsultaFlash {...props()} />);
    expect(screen.queryByRole("checkbox", { name: /^Retorno/ })).toBeNull();
    expect(cb(/^Laboratório/).checked).toBe(true);
    expect(cb(/^Imagem/).checked).toBe(false);
    expect(screen.queryByText(/sem modelo padrão salvo/i)).toBeNull();
  });

  it("sem modelo salvo: tudo desmarcado e aviso curto", () => {
    const base = props().tarefasRetorno!;
    render(
      <ConsultaFlash
        {...props({
          tarefasRetorno: { ...base, modeloPadraoSalvo: false, laboratorio: item("lab", "Laboratório", "SUGESTAO", true) },
        })}
      />,
    );
    expect(screen.queryByRole("checkbox", { name: /^Retorno/ })).toBeNull();
    expect(cb(/^Laboratório/).checked).toBe(false);
    expect(cb(/^Imagem/).checked).toBe(false);
    expect(screen.getByText(/sem modelo padrão salvo/i)).toBeTruthy();
  });

  it("mostra o prazo do retorno", () => {
    render(<ConsultaFlash {...props()} />);
    expect(screen.getByText(/^Retorno \(30 dias\)/)).toBeTruthy();
  });

  it("1 clique em Finalizar chama o fechamento com exatamente os itens marcados", () => {
    const aoFinalizar = vi.fn();
    const aoSalvarRascunho = vi.fn();
    render(<ConsultaFlash {...props({ aoFinalizar, aoSalvarRascunho })} />);
    fireEvent.click(cb(/^Imagem/));
    fireEvent.click(screen.getByRole("button", { name: "FINALIZAR · IMPRIMIR · SAIR" }));
    expect(aoSalvarRascunho).not.toHaveBeenCalled();
    expect(aoFinalizar).toHaveBeenCalledTimes(1);
    const plano = aoFinalizar.mock.calls[0]?.[0] as PlanoFlash;
    expect(plano.tarefasRetorno).toEqual({ retorno: true, laboratorio: true, imagem: true });
    expect(plano.apac.emitir).toBe(false);
  });

  it("teclado: checkbox e Finalizar recebem foco", () => {
    render(<ConsultaFlash {...props()} />);
    const lab = cb(/^Laboratório/);
    lab.focus();
    expect(document.activeElement).toBe(lab);
    const btn = screen.getByRole("button", { name: "FINALIZAR · IMPRIMIR · SAIR" });
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });

  it("nenhuma string proibida na tela", () => {
    render(<ConsultaFlash {...props()} />);
    expect(document.body.textContent ?? "").not.toMatch(PROIBIDAS);
  });
});
