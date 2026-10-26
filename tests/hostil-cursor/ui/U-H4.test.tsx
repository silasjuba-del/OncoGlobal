// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { criarPortaHttp } from "../../../src/ui/api/http.js";
import { criarPortaFalsa, ID } from "../../../src/ui/api/fake.js";
import { ConsultaPersistida } from "../../../src/ui/consulta/ConsultaPersistida.js";
import { AtendimentoV6 } from "../../../src/ui/consulta/AtendimentoV6.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const contextoMulti = { patientId: ID.multi, encounterId: "en-multi", tumorLotId: "lot-multi-a" };

describe("U-H4 · estados de falha da API na consulta (500, 401, timeout, JSON malformado, resposta vazia)", () => {
  it("falha na recarga de ConsultaPersistida anuncia alerta, oferece botão de recarregar e preserva o que o médico digitou na Consulta Flash após recuperação", async () => {
    const basePorta = criarPortaFalsa();
    let falharProximaCarga = false;
    const porta = {
      ...basePorta,
      carregarConsulta: vi.fn(async (patientId: string, tumorLotId?: string | null, encounterId?: string) => {
        if (falharProximaCarga) {
          throw new Error("HTTP_500_SINTETICO");
        }
        return basePorta.carregarConsulta(patientId, tumorLotId, encounterId);
      }),
    };

    render(<ConsultaPersistida porta={porta} contexto={contextoMulti} />);
    await screen.findByRole("button", { name: "Consulta Flash" });

    fireEvent.click(screen.getByRole("button", { name: "Consulta Flash" }));
    const campoOutrosLab = screen.getByLabelText("Outros LAB") as HTMLInputElement;
    const campoMedicamento = screen.getByLabelText("Medicamento da receita") as HTMLInputElement;
    fireEvent.change(campoOutrosLab, { target: { value: "Exame SINTETICO digitado pelo médico" } });
    fireEvent.change(campoMedicamento, { target: { value: "Ondansetrona SINTETICA 8 mg" } });

    // Simula falha 500 ao tentar reabrir histórico
    falharProximaCarga = true;
    fireEvent.click(screen.getByRole("button", { name: "Reabrir histórico" }));

    const alertaErro = await screen.findByRole("alert");
    expect(alertaErro.textContent).toContain("Não foi possível carregar a consulta persistida.");

    // Deve oferecer botão para tentar recarregar sem perder o estado digitado
    falharProximaCarga = false;
    const botaoRecarregar = screen.getByRole("button", { name: "Recarregar consulta" });
    fireEvent.click(botaoRecarregar);

    await screen.findByRole("button", { name: "Consulta Flash" });
    expect((screen.getByLabelText("Outros LAB") as HTMLInputElement).value).toBe(
      "Exame SINTETICO digitado pelo médico",
    );
    expect((screen.getByLabelText("Medicamento da receita") as HTMLInputElement).value).toBe(
      "Ondansetrona SINTETICA 8 mg",
    );
  });

  it("falha ao carregar base da prescrição exibe alerta compreensível e remove estado perpétuo de carregamento", async () => {
    const basePorta = criarPortaFalsa();
    const porta = {
      ...basePorta,
      lerBasePrescricaoExecutavel: vi.fn(async () => {
        throw new Error("HTTP_500_BASE_RX_SINTETICO");
      }),
      prepararPrescricaoExecutavel: vi.fn(),
      confirmarPrescricaoExecutavel: vi.fn(),
    };

    render(<ConsultaPersistida porta={porta} contexto={contextoMulti} />);
    const btnRx = await screen.findByRole("button", { name: "Prescrição estruturada" });
    fireEvent.click(btnRx);

    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toContain("Não foi possível atualizar a base da prescrição.");
    expect(screen.queryByText("Carregando a base da prescrição…")).toBeNull();
  });

  it.each([
    ["500 erro interno", () => new Response(JSON.stringify({ codigo: "ERRO_INTERNO_SINTETICO" }), { status: 500 })],
    ["401 sessão expirada", () => new Response(JSON.stringify({ codigo: "SESSAO_EXPIRADA" }), { status: 401 })],
    ["timeout / abort", () => Promise.reject(new DOMException("The operation was aborted", "AbortError"))],
    ["JSON malformado", () => new Response("{json-malformado-sintetico", { status: 200 })],
    ["resposta vazia", () => new Response("", { status: 200 })],
  ])("criarPortaHttp + AtendimentoV6 sob %s mostra erro compreensível, não quebra e preserva texto digitado pelo médico", async (cenariosRotulo, fabricarFalha) => {
    let sessaoExpiradaChamada = 0;
    let modoFalha = false;

    vi.stubGlobal("fetch", async (input: Parameters<typeof fetch>[0]) => {
      const url = typeof input === "string" ? input : "";
      if (url === "/login") {
        return new Response(JSON.stringify({ token: "tok-sintetico-uh4", expiraEm: "2099-01-01T00:00:00Z" }), { status: 200 });
      }
      if (modoFalha) {
        return fabricarFalha();
      }
      if (url === "/consulta/atendimento/recuperar") {
        return new Response(
          JSON.stringify({
            codigo: "ATENDIMENTO_BASE",
            formato: "ONCOLOGIA_V6",
            contexto: contextoMulti,
            base: {
              revisao: "a".repeat(64),
              pacienteNome: "Paciente SINTETICO U-H4",
              dataReferencia: "2026-10-05",
              recuperadoEm: "2026-10-05T12:00:00Z",
              citacoes: [],
              delta: { encounterAnteriorId: null, novos: [], substituidos: [] },
              integridade: [],
            },
            rascunho: null,
            estadoRascunho: "AUSENTE",
            criaEventoClinico: false,
            assinado: false,
          }),
          { status: 200 },
        );
      }
      if (url === "/consulta/chat") {
        return new Response(
          JSON.stringify({
            setor: "MEDICO",
            patientId: contextoMulti.patientId,
            encounterId: contextoMulti.encounterId,
            tumorLotId: contextoMulti.tumorLotId,
            mensagens: [{ mensagemId: "msg-sint-1", autor: "Médico Sintético", texto: "Nota sintética inicial" }],
            prescricao: null,
          }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 200 });
    });

    const porta = criarPortaHttp({
      onSessaoExpirada: () => {
        sessaoExpiradaChamada += 1;
      },
    });
    await porta.login("senha-sintetica");

    render(<AtendimentoV6 porta={porta} contexto={contextoMulti} />);
    const campoHoje = (await screen.findByLabelText("Hoje — somente o que mudou")) as HTMLTextAreaElement;
    const campoDecisao = screen.getByLabelText("Decisão médica de hoje") as HTMLTextAreaElement;

    const textoHoje = `Evolução SINTETICA preservada (${cenariosRotulo})`;
    const textoDecisao = `Conduta SINTETICA preservada (${cenariosRotulo})`;
    fireEvent.change(campoHoje, { target: { value: textoHoje } });
    fireEvent.change(campoDecisao, { target: { value: textoDecisao } });

    // Abre também revisão do chat e edita o texto da anotação
    const btnRevisarChat = await screen.findByRole("button", { name: "Revisar para evolução" });
    fireEvent.click(btnRevisarChat);
    const campoAnotacao = screen.getByLabelText("Anotação para evolução") as HTMLTextAreaElement;
    const textoAnotacao = `Anotação chat SINTETICA (${cenariosRotulo})`;
    fireEvent.change(campoAnotacao, { target: { value: textoAnotacao } });

    // Ativa a falha HTTP para preparar rascunho e registrar anotação do chat
    modoFalha = true;
    fireEvent.click(screen.getByRole("button", { name: "Preparar rascunhos" }));

    await waitFor(() => {
      expect(screen.getAllByRole("status").some((el) => (el.textContent ?? "").includes("Não foi possível concluir"))).toBe(true);
    });
    expect(campoHoje.value).toBe(textoHoje);
    expect(campoDecisao.value).toBe(textoDecisao);

    fireEvent.click(screen.getByRole("button", { name: "Registrar na evolução" }));
    await waitFor(() => {
      expect(screen.getAllByRole("status").some((el) => (el.textContent ?? "").includes("Registro não confirmado"))).toBe(true);
    });
    expect((screen.getByLabelText("Anotação para evolução") as HTMLTextAreaElement).value).toBe(textoAnotacao);

    if (cenariosRotulo.startsWith("401")) {
      expect(sessaoExpiradaChamada).toBeGreaterThanOrEqual(1);
    }
  });
});
