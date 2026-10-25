// @vitest-environment jsdom
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AtendimentoV6 } from "../../../src/ui/consulta/AtendimentoV6.js";
import { criarPortaFalsa } from "../../../src/ui/api/fake.js";
import type { PortaConsulta } from "../../../src/ui/api/porta.js";
import type { AtendimentoV6Resposta, BaseAtendimentoV6 } from "../../../src/contracts/api/atendimentoV6.js";

afterEach(cleanup);

function listarTsTsx(dir: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) saida.push(...listarTsTsx(p));
    else if (nome.endsWith(".ts") || nome.endsWith(".tsx")) saida.push(p);
  }
  return saida;
}

const contexto = { patientId: "pt-verde", encounterId: "en-verde", tumorLotId: "lot-verde" };

describe("U-H6 · entrada hostil em campos livres (ChatAnotacao e editor de evolução) e ausência de innerHTML", () => {
  it("nenhum arquivo em src/ui usa dangerouslySetInnerHTML ou innerHTML", () => {
    const raiz = process.cwd();
    const arquivos = listarTsTsx(join(raiz, "src/ui"));
    const violacoes: string[] = [];

    for (const arq of arquivos) {
      const codigo = readFileSync(arq, "utf8");
      if (/dangerouslySetInnerHTML|\.innerHTML\b/.test(codigo)) {
        violacoes.push(relative(raiz, arq).replace(/\\/g, "/"));
      }
    }

    expect(violacoes).toEqual([]);
  });

  it("AtendimentoV6 e ChatAnotacao tratam <img src=x onerror=alert(1)>, 10.000 caracteres, emoji, RTL e quebras de linha como texto inerte", async () => {
    const base: BaseAtendimentoV6 = {
      revisao: "a".repeat(64),
      pacienteNome: "Paciente SINTETICO U-H6",
      dataReferencia: "2026-10-05",
      recuperadoEm: "2026-10-05T12:00:00Z",
      citacoes: [],
      delta: { encounterAnteriorId: null, novos: [], substituidos: [] },
      integridade: [],
    };
    const respostaInicial: AtendimentoV6Resposta = {
      codigo: "ATENDIMENTO_BASE",
      formato: "ONCOLOGIA_V6",
      contexto,
      base,
      rascunho: null,
      estadoRascunho: "AUSENTE",
      criaEventoClinico: false,
      assinado: false,
    };

    const aceitarDecisaoChat = vi.fn<NonNullable<PortaConsulta["aceitarDecisaoChat"]>>(
      async () => ({ codigo: "GRAVADA" as const, eventId: "ev-chat-uh6" }),
    );
    const prepararAtendimentoV6 = vi.fn(async (pedido) => ({
      ...respostaInicial,
      codigo: "ATENDIMENTO_PREPARADO" as const,
      estadoRascunho: "ATUAL" as const,
      rascunho: {
        id: "rasc-uh6",
        versao: 1,
        revisaoBase: base.revisao,
        entrada: pedido.entrada,
        dataClinica: "2026-10-05",
        autor: { medicoId: "med-sint", crm: "CRM-SINT" },
        salvoEm: "2026-10-05T12:10:00Z",
        documentos: [
          {
            tipo: "EVOLUCAO" as const,
            titulo: "Evolução por diferenças",
            texto: pedido.entrada.hoje,
            apresentacao: { textoClinico: pedido.entrada.hoje, detalhes: [] },
            estado: "PRONTO_PARA_REVISAO" as const,
            pendencias: [],
          },
        ],
        conteudoHash: "b".repeat(64),
      },
    }));

    const porta = {
      ...criarPortaFalsa(),
      recuperarAtendimentoV6: vi.fn(async () => respostaInicial),
      prepararAtendimentoV6,
      aceitarDecisaoChat,
    };

    const { container } = render(<AtendimentoV6 porta={porta} contexto={contexto} />);
    const campoHoje = (await screen.findByLabelText("Hoje — somente o que mudou")) as HTMLTextAreaElement;
    const campoDecisao = screen.getByLabelText("Decisão médica de hoje") as HTMLTextAreaElement;

    const payloadXssRtlEmoji =
      '<img src=x onerror=alert(1)>\nLinha 2 🧬🩺⚠️\nLinha 3 RTL \u202Eنص تجريبي SINTETICO\u202C ';
    const payload10k = payloadXssRtlEmoji + "X".repeat(10_000 - payloadXssRtlEmoji.length);
    expect(payload10k.length).toBe(10_000);

    fireEvent.change(campoHoje, { target: { value: payload10k } });
    fireEvent.change(campoDecisao, { target: { value: '<script>alert("xss")</script> conduta SINTETICA' } });

    expect(campoHoje.value).toHaveLength(10_000);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();

    // Testa ChatAnotacao com o mesmo payload hostil de 10.000 caracteres
    const btnRevisarChat = await screen.findByRole("button", { name: "Revisar para evolução" });
    fireEvent.click(btnRevisarChat);
    const campoChat = screen.getByLabelText("Anotação para evolução") as HTMLTextAreaElement;
    fireEvent.change(campoChat, { target: { value: payload10k } });
    expect(campoChat.value).toHaveLength(10_000);

    fireEvent.click(screen.getByRole("button", { name: "Registrar na evolução" }));
    await waitFor(() => expect(aceitarDecisaoChat).toHaveBeenCalledTimes(1));
    expect(aceitarDecisaoChat.mock.calls[0]?.[0]?.decisao?.valor).toBe(payload10k);
    expect(container.querySelector("img")).toBeNull();

    // Prepara rascunhos da evolução e verifica que o pre renderiza como texto puro sem criar <img>
    fireEvent.click(screen.getByRole("button", { name: "Preparar rascunhos" }));
    const regiaoEvolucao = await screen.findByRole("region", { name: "Evolução por diferenças · rascunho" });
    expect(regiaoEvolucao.querySelector("img")).toBeNull();
    expect(regiaoEvolucao.textContent).toContain("<img src=x onerror=alert(1)>");
    expect(regiaoEvolucao.textContent).toContain("🧬🩺⚠️");
  });
});
