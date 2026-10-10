// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ConsultaFlash,
  marcadoInicialFlash,
  type ConsultaFlashProps,
  type ItemFlash,

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

// F0-COMPLEMENTO: Flash final é revisão essencial LAB/RAD/QT; receitas e APAC ficam nas telas próprias.
describe("Flash essencial · invariantes adversariais", () => {
  it("mantém diagnóstico, TNM, alergia e ciclo sem trazer a consulta grande", () => {
    render(<ConsultaFlash {...props()} />);
    expect(screen.getByLabelText("Revisão rápida").textContent).toContain("TNM cT2N1M0");
    expect(screen.getByLabelText("Toxicidades e alergia").textContent).toContain("Dipirona");
    expect(screen.getByLabelText("Tratamento vigente").textContent).toContain("C3D1");
    expect(screen.queryByText(/MUC: Losartana/)).toBeNull();
    expect((screen.getByLabelText("Prazo do retorno em dias") as HTMLInputElement).value).toBe("21");
  });
  it("ausência é PENDENTE, nunca ausência presumida de alergia", () => {
    render(<ConsultaFlash {...props({cabecalho:{}})} />);
    expect(screen.getByLabelText("Revisão rápida").textContent).toContain("TNM PENDENTE");
    expect(screen.getByLabelText("Toxicidades e alergia").textContent).toContain("Não informada");
  });
  it("preserva frase do laudo sem classificação de liberação", () => {
    render(<ConsultaFlash {...props()} />);
    expect(screen.getByLabelText("Biópsia e imagem").textContent).toContain("Sem evidência de progressão");
    expect(document.body.textContent ?? "").not.toMatch(PROIBIDAS_MAQUINA);
  });
  it("decisão QT nasce desmarcada mesmo com ação legada preMarcada", () => {
    render(<ConsultaFlash {...props()} />);
    expect(checkbox("Liberar ciclo C3D1").checked).toBe(false);
    expect(marcadoInicialFlash(ACOES[0]!)).toBe(false);
  });
  it("receitas legadas não entram silenciosamente no plano", () => {
    const p=props(); render(<ConsultaFlash {...p} />);
    expect(screen.queryByRole("checkbox",{name:"Ondansetrona"})).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"REVISAR · IMPRIMIR"}));
    expect(p.aoFinalizar).toHaveBeenCalledWith(expect.objectContaining({receitasMarcadas:[],acoesMarcadas:[]}));
  });
  it("APAC é acessada somente por ação própria e nunca emitida pela Flash", () => {
    const abrir=vi.fn(), p=props({aoAbrirApac:abrir}); render(<ConsultaFlash {...p} />);
    expect(screen.queryByLabelText("estado da APAC")).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"Abrir APAC ↗"})); expect(abrir).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button",{name:"REVISAR · IMPRIMIR"}));
    expect(p.aoFinalizar).toHaveBeenCalledWith(expect.objectContaining({apac:expect.objectContaining({emitir:false})}));
  });
  it("revisar entrega somente seleção explícita sem emitir efeitos", () => {
    const p=props(); render(<ConsultaFlash {...p} />); fireEvent.click(checkbox("HMG"));
    fireEvent.click(screen.getByRole("button",{name:"REVISAR · IMPRIMIR"}));
    expect(p.aoSalvarRascunho).not.toHaveBeenCalled();
    expect(p.aoFinalizar).toHaveBeenCalledTimes(1);
    expect(p.aoFinalizar).toHaveBeenCalledWith(expect.objectContaining({solicitacoes:{laboratorio:["HMG"],imagem:[]},decisaoQt:{solicitarCiclo:false,data:null}}));
  });
  it("salvar não prepara assinatura e ocupado impede reenvio", () => {
    const p=props(); const {rerender}=render(<ConsultaFlash {...p} />);
    fireEvent.click(screen.getByRole("button",{name:"SALVAR RASCUNHO"}));
    expect(p.aoSalvarRascunho).toHaveBeenCalledTimes(1); expect(p.aoFinalizar).not.toHaveBeenCalled();
    rerender(<ConsultaFlash {...p} ocupado />);
    fireEvent.click(screen.getByRole("button",{name:"SALVAR RASCUNHO"})); expect(p.aoSalvarRascunho).toHaveBeenCalledTimes(1);
  });
});
