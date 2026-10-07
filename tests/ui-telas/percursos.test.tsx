// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionIntent } from "../../src/contracts/operacao.js";
import { ordenarFila } from "../../src/rules/index.js";
import { criarChaves, type ChavesIntencao } from "../../src/ui/api/chaves.js";
import { criarPortaFalsa } from "../../src/ui/api/fake.js";
import type { AgendaVisao, PortaConsulta } from "../../src/ui/api/porta.js";
import { Agenda } from "../../src/ui/telas/Agenda.js";
import { BarraComando } from "../../src/ui/telas/BarraComando.js";
import { TelaConsulta } from "../../src/ui/telas/TelaConsulta.js";
import { TelaApacLote } from "../../src/ui/telas/apac/TelaApacLote.js";
import { CaixaCanal } from "../../src/ui/telas/canal/CaixaCanal.js";
import { TelaSalao } from "../../src/ui/telas/TelaSalao.js";

afterEach(() => {
  cleanup();
});

type Tela = "agenda" | "consulta" | "salao" | "canal" | "apac";

function Shell({
  porta,
  chaves,
  inicial = "agenda",
}: {
  porta: PortaConsulta;
  chaves: ChavesIntencao;
  inicial?: Tela;
}) {
  const [tela, setTela] = useState<Tela>(inicial);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [agenda, setAgenda] = useState<AgendaVisao | null>(null);

  useEffect(() => {
    void porta.agendaDoDia().then(setAgenda);
  }, [porta]);

  function abrir(id: string) {
    setPatientId(id);
    setTela("consulta");
  }

  function clicarNome(nome: string) {
    const botao = [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === nome);
    botao?.click();
  }

  return (
    <div>
      {agenda ? (
        <BarraComando
          pacientes={agenda.itens.map((item) => ({
            patientId: item.patientId,
            nome: item.nome,
            prontuario: item.prontuario,
          }))}
          ordemIds={agenda.itens.map((item) => item.patientId)}
          pacienteAbertoId={patientId}
          onAbrir={abrir}
          onValidarTudo={() => clicarNome("validar tudo")}
          onImprimir={() => clicarNome("imprimir")}
          onNovaTriagem={() => setTela("salao")}
          onSalao={() => setTela("salao")}
          onApac={() => setTela("apac")}
          onCanal={() => setTela("canal")}
        />
      ) : null}
      {tela === "agenda" && agenda ? <Agenda visao={agenda} onAbrir={abrir} /> : null}
      {tela === "consulta" && patientId ? (
        <TelaConsulta patientId={patientId} porta={porta} chaves={chaves} />
      ) : null}
      {tela === "salao" ? <TelaSalao porta={porta} /> : null}
      {tela === "canal" ? <CaixaCanal porta={porta} chaves={chaves} /> : null}
      {tela === "apac" ? <TelaApacLote porta={porta} chaves={chaves} /> : null}
    </div>
  );
}

function nomeAcessivel(el: Element): string {
  const aria = el.getAttribute("aria-label")?.trim();
  if (aria) return aria;
  const rotulo = el.closest("label");
  if (rotulo) {
    const copia = rotulo.cloneNode(true) as HTMLElement;
    copia.querySelectorAll("input, select, textarea, button").forEach((filho) => filho.remove());
    const texto = copia.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (texto) return texto;
  }
  return el.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function exigirNomes(raiz: ParentNode) {
  for (const el of raiz.querySelectorAll("button, input, select, textarea")) {
    expect(nomeAcessivel(el).length).toBeGreaterThan(0);
    expect(el.getAttribute("tabindex")).not.toBe("-1");
  }
}

function clicar(el: HTMLElement, cliques: string[]) {
  cliques.push((el.textContent ?? el.getAttribute("aria-label") ?? "").replace(/\s+/g, " ").trim());
  fireEvent.click(el);
}

describe("percursos", () => {
  it("rotina: agenda e validar em 2 cliques; Enter imprime sem clique extra", async () => {
    const porta = criarPortaFalsa();
    const acao = vi.spyOn(porta, "acao");
    const exibir = vi.spyOn(porta, "exibirBundle");
    const confirmar = vi.spyOn(porta, "confirmar");
    const cliques: string[] = [];
    render(<Shell porta={porta} chaves={criarChaves()} />);
    clicar(await screen.findByRole("button", { name: "abrir Paciente Teste PR-VERDE" }), cliques);
    clicar(await screen.findByRole("button", { name: "validar tudo" }), cliques);
    await waitFor(() => expect(exibir).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(confirmar).toHaveBeenCalledTimes(1));
    expect(acao).not.toHaveBeenCalled();
    expect(await screen.findByText("Enter confirma a impressão")).toBeTruthy();
    expect(cliques).toEqual(["abrir Paciente Teste PR-VERDE", "validar tudo"]);
    fireEvent.keyDown(window, { key: "Enter" });
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    expect(acao.mock.calls[0]?.[0].verbo).toBe("IMPRIMIR");
    expect(ActionIntent.safeParse(acao.mock.calls[0]?.[0]).success).toBe(true);
  });

  it("vermelho mostra ciente antes de validar e fica em até 5 cliques", async () => {
    const porta = criarPortaFalsa();
    const acao = vi.spyOn(porta, "acao");
    const cliques: string[] = [];
    render(<Shell porta={porta} chaves={criarChaves()} />);
    clicar(await screen.findByRole("button", { name: "abrir Paciente Teste PR-VERMELHO" }), cliques);
    expect((await screen.findByText("Serão marcados como ciente:")).textContent).toBeTruthy();
    expect(screen.getByText("hemoglobina abaixo do corte")).toBeTruthy();
    expect(acao).not.toHaveBeenCalled();
    clicar(screen.getByRole("button", { name: "validar tudo" }), cliques);
    expect(cliques.length).toBeLessThanOrEqual(5);
    expect(acao).not.toHaveBeenCalled();
  });

  it("salão: triagem, quadro na ordem da fila e liberar com motivo", async () => {
    const porta = criarPortaFalsa();
    const salao = await porta.filaSalao();
    const cliques: string[] = [];
    const { container } = render(<Shell porta={porta} chaves={criarChaves()} inicial="salao" />);
    await screen.findByLabelText("SALÃO");
    const ids = [...container.querySelectorAll("[aria-label='SALÃO'] [data-patient]")].map((el) => el.getAttribute("data-patient"));
    expect(ids).toEqual(ordenarFila(salao.cartoes.map((c) => c.entrada), salao.ruleset).map((e) => e.patientId));
    expect(screen.getByRole("button", { name: "salvar triagem" })).toBeTruthy();
    clicar(screen.getByRole("button", { name: "liberar mesmo com corte" }), cliques);
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "conduta deste ciclo" } });
    clicar(screen.getByRole("button", { name: "confirmar liberação" }), cliques);
    expect(await screen.findByText("conduta deste ciclo")).toBeTruthy();
    expect(cliques).toEqual(["liberar mesmo com corte", "confirmar liberação"]);
  });

  it("abre, valida e percorre os controles só pelo teclado", async () => {
    const porta = criarPortaFalsa();
    const exibir = vi.spyOn(porta, "exibirBundle");
    const confirmar = vi.spyOn(porta, "confirmar");
    const { container } = render(<Shell porta={porta} chaves={criarChaves()} />);
    await screen.findByRole("button", { name: "abrir Paciente Teste PR-VERDE" });
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const campo = await screen.findByLabelText("Comando");
    fireEvent.change(campo, { target: { value: "abrir PR-VERDE" } });
    fireEvent.keyDown(campo, { key: "Enter" });
    await screen.findByRole("button", { name: "validar tudo" });
    fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(exibir).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(confirmar).toHaveBeenCalledTimes(1));
    exigirNomes(container);
  });
});
