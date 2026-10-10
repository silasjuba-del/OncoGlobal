// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ConsultaFlash,
  marcadoInicialFlash,
  type ConsultaFlashProps,
  type ItemFlash,
  type PlanoFlash,
} from "../../src/ui/consulta/ConsultaFlash.js";

afterEach(() => {
  cleanup();
});

const PROIBIDAS_MAQUINA = /amarelo|liberad[oa]|aprovad[oa]|\bapto\b|\bESTÁVEL\b|\bLIBERA\b/;

const ACOES: ItemFlash[] = [
  { id: "liberar_tratamento", rotulo: "Liberar tratamento", origem: "MODELO_MEDICO", preMarcado: true },
  { id: "receita_suporte", rotulo: "Receita suporte", origem: "MODELO_MEDICO", preMarcado: true },
  { id: "solicitar_hmg", rotulo: "Solicitar HMG", origem: "SUGESTAO", preMarcado: true },
  { id: "tc_tap", rotulo: "TC TAP", origem: "SUGESTAO", preMarcado: false },
];

const RECEITAS: ItemFlash[] = [
  { id: "ondansetrona", rotulo: "Ondansetrona", origem: "MODELO_MEDICO", preMarcado: true },
  { id: "dexametasona", rotulo: "Dexametasona", origem: "SUGESTAO", preMarcado: true },
  { id: "analgesia", rotulo: "Analgesia", origem: "MODELO_MEDICO", preMarcado: false },
];

function props(over: Partial<ConsultaFlashProps> = {}): ConsultaFlashProps {
  return {
    cabecalho: {
      diagnostico: "Carcinoma mamário NST",
      tnm: "cT2N1M0",
      estadio: "IIB",
      biomarcador: "RE90 RP40 HER2-",
      antecedentes: "HAS, DM2",
      medicacoesUso: "Losartana, Metformina",
      alergia: "Dipirona",
      ecog: "1",
      tratamentoAtual: "TC adjuvante",
      linha: "Adjuvante",
      cicloDia: "C3D1",
    },
    exames: [
      { data: "02/10", nome: "HMG", fraseLaudo: "Hb 11,2 · ANC 2.340 · Plaq 188 mil", situacao: "DENTRO_DO_LIMITE" },
      { data: "21/09", nome: "TC TAP", fraseLaudo: "Sem evidência de progressão", situacao: "SEM_REFERENCIA" },
    ],
    acoesHoje: ACOES,
    receitas: RECEITAS,
    apac: {
      cid: "C50.4",
      sigtap: "03.xx.xx.xxx-x",
      finalidade: "ADJUVANTE",
      competencia: "10/26",
      estado: "VALIDA",
      pendencias: [],
    },
    iaFala: ["Neuropatia não graduada: perguntar impacto funcional antes de prosseguir."],
    retorno: { dias: 21, motivo: "Reavaliação", examesAntesDoRetorno: ["HMG"] },
    aoSalvarRascunho: vi.fn(),
    aoFinalizar: vi.fn(),
    ...over,
  };
}

function checkbox(nome: string): HTMLInputElement {
  return screen.getByRole("checkbox", { name: nome }) as HTMLInputElement;
}

describe("w11-h24 consulta flash (one click)", () => {
  it("1. header imutável mostra DX, AP, tratamento e retorno", () => {
    render(<ConsultaFlash {...props()} />);
    expect(screen.getByText(/DX: Carcinoma mamário NST/)).toBeTruthy();
    expect(screen.getByText(/TNM: cT2N1M0/)).toBeTruthy();
    expect(screen.getByText(/Biomarcador: RE90 RP40 HER2-/)).toBeTruthy();
    expect(screen.getByText(/MUC: Losartana, Metformina/)).toBeTruthy();
    expect(screen.getByText(/Alergia: Dipirona/)).toBeTruthy();
    expect(screen.getByText(/Ciclo\/dia: C3D1/)).toBeTruthy();
    expect(screen.getByText(/RETORNO: 21 DIAS/)).toBeTruthy();
  });

  it("2. campo ausente aparece como PENDENTE", () => {
    render(<ConsultaFlash {...props({ cabecalho: {} })} />);
    expect(screen.getByText(/DX: PENDENTE/)).toBeTruthy();
    expect(screen.getByText(/ECOG: PENDENTE/)).toBeTruthy();
  });

  it("3. exame mostra a frase do laudo e 'dentro do limite', nunca LIBERA nem ESTÁVEL", () => {
    render(<ConsultaFlash {...props()} />);
    expect(screen.getByText(/Sem evidência de progressão/)).toBeTruthy();
    expect(screen.getByText(/dentro do limite/)).toBeTruthy();
    const textoTodo = document.body.textContent ?? "";
    expect(textoTodo).not.toMatch(/\bLIBERA\b/);
    expect(textoTodo).not.toMatch(/\bESTÁVEL\b/);
  });

  it("4. 'Liberar tratamento' nasce desmarcada mesmo com preMarcado e origem do médico", () => {
    render(<ConsultaFlash {...props()} />);
    expect(checkbox("Liberar tratamento").checked).toBe(false);
    expect(marcadoInicialFlash(ACOES[0] as ItemFlash)).toBe(false);
  });

  it("5. receitas pré-marcam só quando origem é MODELO_MEDICO", () => {
    render(<ConsultaFlash {...props()} />);
    expect(checkbox("Ondansetrona").checked).toBe(true);
    expect(checkbox("Dexametasona").checked).toBe(false);
    expect(checkbox("Analgesia").checked).toBe(false);
    expect(checkbox("Solicitar HMG").checked).toBe(false);
  });

  it("6. chip APAC mostra os três estados operacionais", () => {
    const { unmount } = render(<ConsultaFlash {...props()} />);
    expect(screen.getByLabelText("estado da APAC").textContent).toBe("APAC ✓ VERDE");
    unmount();

    const pend = render(
      <ConsultaFlash {...props({ apac: { ...props().apac, estado: "PENDENTE", pendencias: ["laudo anexo"] } })} />,
    );
    expect(screen.getByLabelText("estado da APAC").textContent).toBe("APAC ! PENDENTE");
    expect(screen.getByText(/pendências: laudo anexo/)).toBeTruthy();
    pend.unmount();

    render(<ConsultaFlash {...props({ apac: { ...props().apac, estado: "INCOMPATIVEL" } })} />);
    expect(screen.getByLabelText("estado da APAC").textContent).toBe("APAC × VERMELHO");
  });

  it("7. finalizar entrega plano sem emitir APAC e sem executar efeitos", () => {
    const aoFinalizar = vi.fn();
    const aoSalvarRascunho = vi.fn();
    render(<ConsultaFlash {...props({ aoFinalizar, aoSalvarRascunho })} />);
    fireEvent.click(checkbox("Receita suporte"));
    fireEvent.click(screen.getByRole("button", { name: "FINALIZAR · IMPRIMIR · SAIR" }));
    expect(aoSalvarRascunho).not.toHaveBeenCalled();
    expect(aoFinalizar).toHaveBeenCalledTimes(1);
    const plano = aoFinalizar.mock.calls[0]?.[0] as PlanoFlash;
    expect(plano.apac.emitir).toBe(false);
    expect(plano.acoesMarcadas).toEqual([]);
    expect(plano.receitasMarcadas).toEqual(["ondansetrona"]);
    expect(plano.retorno.dias).toBe(21);
  });

  it("8. salvar rascunho entrega plano e não chama finalizar", () => {
    const aoFinalizar = vi.fn();
    const aoSalvarRascunho = vi.fn();
    render(<ConsultaFlash {...props({ aoFinalizar, aoSalvarRascunho })} />);
    fireEvent.click(screen.getByRole("button", { name: "SALVAR RASCUNHO" }));
    expect(aoFinalizar).not.toHaveBeenCalled();
    expect(aoSalvarRascunho).toHaveBeenCalledTimes(1);
  });

  it("9. texto da tela não contém vocabulário de liberação/aprovação", () => {
    render(<ConsultaFlash {...props()} />);
    expect(document.body.textContent ?? "").not.toMatch(PROIBIDAS_MAQUINA);
  });
});
