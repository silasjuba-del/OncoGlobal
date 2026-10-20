// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PainelOncoassist } from "../../src/ui/consulta/PainelOncoassist.js";
import { criarPortaHttp } from "../../src/ui/api/http.js";
import type { HistoricoOncoassist, RespostaOncoassist } from "../../src/contracts/api/oncoassist.js";
import { CONTEXTO, SENHA, iniciarProcesso } from "./oa02-reabertura-worker.js";

const ativos: Awaited<ReturnType<typeof iniciarProcesso>>[] = [];
const http = globalThis.fetch;
function adiar() {
  let liberar!: () => void;
  const espera = new Promise<void>(resolve => { liberar = resolve; });
  return { espera, liberar };
}
async function ambiente(opcoes: Parameters<typeof iniciarProcesso>[0] = {}) {
  const app = await iniciarProcesso(opcoes); ativos.push(app); return app;
}
async function conectar(app: Awaited<ReturnType<typeof iniciarProcesso>>) {
  const enviados: Record<string, unknown>[] = [];
  vi.stubGlobal("fetch", (input: string | URL | Request, init?: RequestInit) => {
    if (String(input).endsWith("/classificar-fonte")) enviados.push(JSON.parse(String(init?.body)));
    return http(new URL(String(input), app.base), init);
  });
  const expirada = vi.fn();
  const porta = criarPortaHttp({ onSessaoExpirada: expirada });
  expect((await porta.login(SENHA)).ok).toBe(true);
  await porta.carregarConsulta(CONTEXTO.patientId, undefined, CONTEXTO.encounterId);
  return { porta, enviados, expirada };
}
afterEach(async () => {
  cleanup(); vi.unstubAllGlobals();
  for (const app of ativos.splice(0)) await app.parar();
});

describe("OA02 · PainelOncoassist real → porta HTTP → processo/SQLite → reabertura", () => {
  it("fonte muda entre classificação e histórico: não exibe categoria atual e mantém a mesma proposta invalidada", async () => {
    const app = await ambiente();
    const { porta } = await conectar(app);
    const entrou = adiar(), leitura = adiar();
    const lerHistorico = porta.oncoassistHistorico!;
    const classificar = porta.oncoassistClassificar!;
    let resposta!: RespostaOncoassist;
    let memoria!: HistoricoOncoassist;
    let leituras = 0;
    porta.oncoassistClassificar = async (...args) => { resposta = await classificar(...args); return resposta; };
    porta.oncoassistHistorico = async (...args) => {
      if (++leituras === 2) {
        entrou.liberar();
        await leitura.espera;
        memoria = await lerHistorico(...args);
        return memoria;
      }
      return lerHistorico(...args);
    };
    render(<PainelOncoassist porta={porta} contexto={CONTEXTO} />);
    fireEvent.click(await screen.findByRole("button", { name: "Sugerir classificação" }));
    await act(async () => { await entrou.espera; });
    expect(resposta.status).toBe("PROPOSTA");
    expect(screen.queryByText("Laboratório — sugestão para revisão.")).toBeNull();
    await app.comando("fonte", { modo: "hash" });
    await act(async () => { leitura.liberar(); });
    const historico = await screen.findByRole("region", { name: "Histórico de propostas documentais" });
    expect(screen.queryByText("Laboratório — sugestão para revisão.")).toBeNull();
    expect(historico.textContent).toContain("Revisão 1: Laboratório");
    expect(historico.textContent).toContain("Fonte alterada — somente histórico.");
    expect(memoria.propostas).toHaveLength(1);
    expect(memoria.propostas[0]).toMatchObject({ validade: "FONTE_ALTERADA", resposta,
      auditoria: { propostaId: resposta.auditoria!.propostaId } });
    expect(await app.comando("stats")).toMatchObject({ chamadas: 1, clinicalEvents: app.baseline });
  }, 30_000);

  it.each(["ausente", "outra-proposta", "classificacao-sem-identidade", "historico-sem-identidade", "pendente"] as const)(
    "histórico sem correspondência comprovada (%s) não apresenta categoria atual", async modo => {
      const app = await ambiente();
      const { porta } = await conectar(app);
      const lerHistorico = porta.oncoassistHistorico!;
      const classificar = porta.oncoassistClassificar!;
      if (modo === "classificacao-sem-identidade") porta.oncoassistClassificar = async (...args) => {
        const { auditoria: _auditoria, ...resposta } = await classificar(...args);
        return resposta;
      };
      let leituras = 0;
      let memoria!: HistoricoOncoassist;
      porta.oncoassistHistorico = async (...args) => {
        const original = await lerHistorico(...args);
        if (++leituras !== 2) return original;
        memoria = structuredClone(original);
        if (modo === "ausente") memoria.propostas = [];
        else {
          const registro = memoria.propostas[0]!;
          if (modo === "outra-proposta") {
            registro.auditoria.propostaId = "outra-proposta-valida";
            registro.resposta!.auditoria!.propostaId = "outra-proposta-valida";
          }
          if (modo === "historico-sem-identidade") delete registro.resposta!.auditoria;
          if (modo === "pendente") { registro.estado = "PENDENTE"; registro.resposta = null; }
        }
        return memoria;
      };
      render(<PainelOncoassist porta={porta} contexto={CONTEXTO} />);
      fireEvent.click(await screen.findByRole("button", { name: "Sugerir classificação" }));
      await waitFor(() => {
        expect(leituras).toBe(2);
        expect(screen.getByRole("button", { name: "Sugerir classificação" }).hasAttribute("disabled")).toBe(false);
      });
      expect(screen.queryByText("Laboratório — sugestão para revisão.")).toBeNull();
      if (modo === "ausente") expect(screen.queryByRole("region", { name: "Histórico de propostas documentais" })).toBeNull();
      else {
        const historico = screen.getByRole("region", { name: "Histórico de propostas documentais" });
        expect(within(historico).getAllByRole("listitem")).toHaveLength(memoria.propostas.length);
        expect(historico.textContent).toContain(modo === "pendente" ? "Operação pendente" : "Revisão 1: Laboratório");
      }
      expect(await app.comando("stats")).toMatchObject({ chamadas: 1, clinicalEvents: app.baseline });
    }, 30_000,
  );

  it.each(["cancelar", "patientId", "encounterId", "tumorLotId"] as const)(
    "histórico tardio após %s não repõe resultado nem histórico da operação anterior", async acao => {
      const app = await ambiente();
      const { porta } = await conectar(app);
      const lerHistorico = porta.oncoassistHistorico!;
      const entrou = adiar(), entrega = adiar();
      let leituras = 0;
      porta.oncoassistHistorico = async (...args) => {
        const segundaLeitura = ++leituras === 2;
        const memoria = await lerHistorico(...args);
        if (segundaLeitura) {
          entrou.liberar();
          // A entrega ignora abort propositalmente, simulando um adaptador tardio.
          await entrega.espera;
        }
        return memoria;
      };
      const view = render(<PainelOncoassist porta={porta} contexto={CONTEXTO} />);
      fireEvent.click(await screen.findByRole("button", { name: "Sugerir classificação" }));
      await act(async () => { await entrou.espera; });
      expect(screen.queryByText("Laboratório — sugestão para revisão.")).toBeNull();
      if (acao === "cancelar") fireEvent.click(screen.getByRole("button", { name: "Interromper" }));
      else view.rerender(<PainelOncoassist porta={porta} contexto={{ ...CONTEXTO, [acao]: "contexto-novo" }} />);
      await act(async () => { entrega.liberar(); });
      expect(screen.queryByText("Laboratório — sugestão para revisão.")).toBeNull();
      expect(screen.queryByRole("region", { name: "Histórico de propostas documentais" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Organizando…" })).toBeNull();
      if (acao === "cancelar") expect(screen.getByText(/interrompida/i)).toBeTruthy();
    }, 30_000,
  );

  it("classifica por gesto com operationId, remonta e reinicia mantendo histórico com provedor desligado", async () => {
    const app = await ambiente();
    let cliente = await conectar(app);
    const inicial = render(<PainelOncoassist porta={cliente.porta} contexto={CONTEXTO} />);
    fireEvent.click(await screen.findByRole("button", { name: "Sugerir classificação" }));
    expect(await screen.findByText("Laboratório — sugestão para revisão.")).toBeTruthy();
    await screen.findByRole("region", { name: "Histórico de propostas documentais" });
    expect(cliente.enviados).toEqual([{ ...CONTEXTO, draftId: "fonte-1", operationId: expect.any(String) }]);
    expect(String(cliente.enviados[0]!.operationId)).toMatch(/^[a-f0-9-]{36}$/);
    expect((await app.comando("stats")).chamadas).toBe(1);
    inicial.unmount();
    const reload = render(<PainelOncoassist porta={cliente.porta} contexto={CONTEXTO} />);
    let historico = await screen.findByRole("region", { name: "Histórico de propostas documentais" });
    expect(historico.textContent).toContain("Revisão 1: Laboratório");
    expect(historico.textContent).toContain("Revisão médica obrigatória");
    expect((await app.comando("stats")).chamadas).toBe(1);
    reload.unmount(); await app.parar();
    const novo = await ambiente({ banco: app.banco, habilitado: false });
    cliente = await conectar(novo);
    render(<PainelOncoassist porta={cliente.porta} contexto={CONTEXTO} />);
    historico = await screen.findByRole("region", { name: "Histórico de propostas documentais" });
    expect(historico.textContent).toContain("Revisão 1: Laboratório");
    expect(await screen.findByText(/desligada neste ambiente/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sugerir classificação" })).toBeNull();
    expect(screen.queryByRole("button", { name: /confirmar|assinar/i })).toBeNull();
    expect(cliente.enviados).toHaveLength(0);
    expect(await novo.comando("stats")).toMatchObject({ chamadas: 0, clinicalEvents: app.baseline });
  }, 30_000);

  it("nova classificação deliberada conserva duas revisões com operações distintas", async () => {
    const app = await ambiente();
    const { porta, enviados } = await conectar(app);
    render(<PainelOncoassist porta={porta} contexto={CONTEXTO} />);
    fireEvent.click(await screen.findByRole("button", { name: "Sugerir classificação" }));
    await screen.findByRole("region", { name: "Histórico de propostas documentais" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Sugerir classificação" }).hasAttribute("disabled")).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Sugerir classificação" }));
    await waitFor(() => expect(within(screen.getByRole("region", { name: "Histórico de propostas documentais" })).getAllByRole("listitem")).toHaveLength(2));
    expect(enviados).toHaveLength(2);
    expect(enviados[0]!.operationId).not.toBe(enviados[1]!.operationId);
    expect(await app.comando("stats")).toMatchObject({ chamadas: 2, clinicalEvents: app.baseline });
  }, 30_000);

  it("fonte alterada aparece somente como histórico após reload, sem nova LLM", async () => {
    const app = await ambiente();
    const { porta } = await conectar(app);
    const view = render(<PainelOncoassist porta={porta} contexto={CONTEXTO} />);
    fireEvent.click(await screen.findByRole("button", { name: "Sugerir classificação" }));
    await screen.findByRole("region", { name: "Histórico de propostas documentais" });
    view.unmount();
    await app.comando("fonte", { modo: "hash" });
    render(<PainelOncoassist porta={porta} contexto={CONTEXTO} />);
    const historico = await screen.findByRole("region", { name: "Histórico de propostas documentais" });
    expect(historico.textContent).toContain("Fonte alterada — somente histórico.");
    expect(screen.queryByText("Laboratório — sugestão para revisão.")).toBeNull();
    expect((await app.comando("stats")).chamadas).toBe(1);
  }, 30_000);

  it("cancelamento e resposta tardia não encerram nem substituem a classificação seguinte", async () => {
    const app = await ambiente({ controlado: true });
    const { porta } = await conectar(app);
    render(<PainelOncoassist porta={porta} contexto={CONTEXTO} />);
    fireEvent.click(await screen.findByRole("button", { name: "Sugerir classificação" }));
    await expect.poll(async () => (await app.comando("stats")).chamadas).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Interromper" }));
    expect(await screen.findByText(/interrompida/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sugerir classificação" }));
    await expect.poll(async () => (await app.comando("stats")).chamadas).toBe(2);
    await act(async () => { await app.comando("liberar", { categoria: "RADS" }); });
    expect(screen.getByRole("button", { name: "Organizando…" }).hasAttribute("disabled")).toBe(true);
    expect(screen.queryByText("Imagem — sugestão para revisão.")).toBeNull();
    await act(async () => { await app.comando("liberar", { categoria: "PATH" }); });
    expect(await screen.findByText("Anatomia patológica — sugestão para revisão.")).toBeTruthy();
    expect((await app.comando("stats")).clinicalEvents).toBe(app.baseline);
  }, 30_000);

  it.each(["patientId", "encounterId", "tumorLotId"])(
    "troca de %s elimina histórico e ignora resposta antiga", async campo => {
      const app = await ambiente({ controlado: true });
      const { porta } = await conectar(app);
      const view = render(<PainelOncoassist porta={porta} contexto={CONTEXTO} />);
      fireEvent.click(await screen.findByRole("button", { name: "Sugerir classificação" }));
      await expect.poll(async () => (await app.comando("stats")).chamadas).toBe(1);
      view.rerender(<PainelOncoassist porta={porta} contexto={{ ...CONTEXTO, [campo]: "outro-contexto" }} />);
      await act(async () => { await app.comando("liberar"); });
      await waitFor(() => expect(screen.queryByRole("button", { name: "Organizando…" })).toBeNull());
      expect(screen.queryByText("Laboratório — sugestão para revisão.")).toBeNull();
      expect(screen.queryByRole("region", { name: "Histórico de propostas documentais" })).toBeNull();
      expect((await app.comando("stats")).clinicalEvents).toBe(app.baseline);
    }, 30_000,
  );

  it("sessão expirada durante classificação aciona porta e não mostra proposta", async () => {
    const app = await ambiente({ controlado: true });
    const { porta, expirada } = await conectar(app);
    render(<PainelOncoassist porta={porta} contexto={CONTEXTO} />);
    fireEvent.click(await screen.findByRole("button", { name: "Sugerir classificação" }));
    await expect.poll(async () => (await app.comando("stats")).chamadas).toBe(1);
    await app.comando("expirar");
    await act(async () => { await app.comando("liberar"); });
    await waitFor(() => expect(expirada).toHaveBeenCalled());
    expect(screen.queryByText("Laboratório — sugestão para revisão.")).toBeNull();
    expect(screen.queryByRole("region", { name: "Histórico de propostas documentais" })).toBeNull();
  }, 30_000);
});
