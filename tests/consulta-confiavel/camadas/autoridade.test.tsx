// @vitest-environment jsdom
import { useState, type CSSProperties, type ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDialogoAcessivel } from "../../../src/ui/oncochart/dialogoAcessivel.js";

function Dialogo({ nome, fechar, children, style, raiz = false }: {
  nome: string; fechar: () => void; children?: ReactNode; style?: CSSProperties; raiz?: boolean;
}) {
  const ref = useDialogoAcessivel<HTMLDivElement>(fechar, raiz);
  return <div ref={ref} role="dialog" aria-modal="true" aria-label={nome} tabIndex={-1} style={style}>
    {children ?? <><button>{nome} primeiro</button><button>{nome} último</button></>}
  </div>;
}
afterEach(cleanup);

describe("consulta confiável · autoridade das camadas", () => {
  it("o backdrop ancestral alto prevalece sobre o z-index do diálogo inferior", () => {
    const superior = vi.fn(), inferior = vi.fn();
    render(<><div style={{ position: "fixed", zIndex: 120 }}>
      <Dialogo nome="superior" fechar={superior} />
    </div><Dialogo nome="inferior" style={{ position: "fixed", zIndex: 70 }} fechar={inferior} /></>);
    expect(screen.getByRole("dialog", { name: "superior" }).contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(superior).toHaveBeenCalledOnce();
    expect(inferior).not.toHaveBeenCalled();
  });

  it("um filho com z-index alto não escapa do contexto ancestral inferior", () => {
    const superior = vi.fn(), inferior = vi.fn();
    render(<><Dialogo nome="superior" style={{ position: "fixed", zIndex: 70 }} fechar={superior} />
      <div style={{ position: "relative", zIndex: 10 }}>
        <Dialogo nome="inferior" style={{ position: "fixed", zIndex: 999 }} fechar={inferior} />
      </div></>);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(superior).toHaveBeenCalledOnce();
    expect(inferior).not.toHaveBeenCalled();
  });

  it("foco inicial e circulação ignoram controles invisíveis e desabilitados por ancestral", () => {
    render(<Dialogo nome="filtros" fechar={() => {}}>
      <div hidden><button>oculto</button></div>
      <div style={{ display: "none" }}><button>sem display</button></div>
      <div inert><button>inerte</button></div>
      <fieldset disabled><button>desabilitado</button></fieldset>
      <details><summary>resumo</summary><button>detalhe fechado</button></details>
      <button>último visível</button>
    </Dialogo>);
    expect(document.activeElement).toBe(screen.getByText("resumo"));
    screen.getByText("último visível").focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByText("resumo"));
  });

  it("diálogo sob ancestral oculto não recebe Escape nem captura o foco", () => {
    const visivel = vi.fn(), oculto = vi.fn();
    render(<><Dialogo nome="visível" fechar={visivel} />
      <div hidden><Dialogo nome="oculto" fechar={oculto} /></div></>);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(visivel).toHaveBeenCalledOnce();
    expect(oculto).not.toHaveBeenCalled();
  });

  it("foco externo é devolvido à camada ativa sem fechar o diálogo", () => {
    render(<><button>fora</button><Dialogo nome="ativo" fechar={() => {}} /></>);
    screen.getByText("fora").focus();
    expect(screen.getByRole("dialog", { name: "ativo" }).contains(document.activeElement)).toBe(true);
  });

  it("fechar diálogo aninhado restaura seu abridor e Escape não fecha o pai", () => {
    const fecharPai = vi.fn();
    function Exemplo() {
      const [aberto, setAberto] = useState(false);
      return <Dialogo nome="pai" fechar={fecharPai}>
        <button onClick={() => setAberto(true)}>abrir filho</button>
        {aberto ? <Dialogo nome="filho" fechar={() => setAberto(false)} /> : null}
      </Dialogo>;
    }
    render(<Exemplo />);
    fireEvent.click(screen.getByText("abrir filho"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "filho" })).toBeNull();
    expect(fecharPai).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByText("abrir filho"));
  });

  it("desmontar camada inferior não rouba foco; desmontar a última restaura o abridor", () => {
    const view = render(<button>abridor</button>);
    screen.getByText("abridor").focus();
    view.rerender(<><button>abridor</button><Dialogo nome="inferior" fechar={() => {}} />
      <Dialogo nome="superior" fechar={() => {}} /></>);
    const ultimo = screen.getByText("superior último");
    ultimo.focus();
    view.rerender(<><button>abridor</button>{null}<Dialogo nome="superior" fechar={() => {}} /></>);
    expect(document.activeElement).toBe(ultimo);
    view.rerender(<><button>abridor</button></>);
    expect(document.activeElement).toBe(screen.getByText("abridor"));
  });
});

it("abrir details inclui seu campo na circulação; fechado continua fora", () => {
  render(<Dialogo nome="detalhes" fechar={() => {}}>
    <details><summary>abrir detalhes</summary><textarea aria-label="campo sintético" /></details>
    <button>último</button>
  </Dialogo>);
  const resumo = screen.getByText("abrir detalhes");
  const campo = screen.getByLabelText("campo sintético");
  campo.focus();
  expect(document.activeElement).toBe(resumo);
  fireEvent.click(resumo);
  campo.focus();
  expect(document.activeElement).toBe(campo);
});

it("dois diálogos usam um listener de teclado e callbacks atuais sem reabrir camada ocupada", () => {
  const adicionar = vi.spyOn(document, "addEventListener"), remover = vi.spyOn(document, "removeEventListener");
  const fechar = vi.fn();
  const view = render(<><Dialogo nome="base" fechar={vi.fn()} />
    <Dialogo nome="ocupada" fechar={() => {}} /></>);
  const teclados = () => adicionar.mock.calls.filter(([nome]) => nome === "keydown");
  expect(teclados()).toHaveLength(1);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.getByRole("dialog", { name: "ocupada" })).toBeTruthy();
  view.rerender(<><Dialogo nome="base" fechar={vi.fn()} /><Dialogo nome="ocupada" fechar={fechar} /></>);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(fechar).toHaveBeenCalledOnce();
  expect(teclados()).toHaveLength(1);
  view.unmount();
  expect(remover.mock.calls.filter(([nome]) => nome === "keydown")).toHaveLength(1);
  adicionar.mockRestore(); remover.mockRestore();
});
