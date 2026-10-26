// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AtendimentoV6 } from "../../../src/ui/consulta/AtendimentoV6.js";
import { RevisaoClinica } from "../../../src/ui/consulta/RevisaoClinica.js";
import { comporDocumentosAtendimentoV6 } from "../../../src/modules/documentos/atendimentoV6.js";
import { criarPortaFalsa } from "../../../src/ui/api/fake.js";
import type { AtendimentoV6Resposta, BaseAtendimentoV6 } from "../../../src/contracts/api/atendimentoV6.js";
import type { RevisaoClinicaResposta } from "../../../src/contracts/fase2/revisaoClinica.js";

afterEach(cleanup);

const contexto = { patientId: "pt-multi", encounterId: "en-multi", tumorLotId: "lot-multi-a" };

describe("U-H8 · proveniência recolhida (PR #72): fonte, trecho e data alcançáveis e negação/incerteza/A CONFERIR visíveis sem expandir", () => {
  it("AtendimentoV6 (PR #72): mantém negação, incerteza e A CONFERIR visíveis sem expandir e preserva fonte/trecho/data alcançáveis por teclado e leitor de tela em <details>/<summary>", async () => {
    const textoNota = "Paciente SINTETICO: Nega dispneia; nódulo pulmonar de etiologia incerta — A CONFERIR.";
    const base: BaseAtendimentoV6 = {
      revisao: "a".repeat(64),
      pacienteNome: "Paciente SINTETICO U-H8",
      dataReferencia: "2026-10-05",
      recuperadoEm: "2026-10-05T12:00:00Z",
      anotacoesChat: [
        {
          texto: textoNota,
          autor: "medico-sintetico-uh8",
          em: "2026-10-05T11:30:00Z",
          mensagemId: "msg-uh8-1",
          eventId: "ev-nota-uh8-1",
          mensagemEventId: "ev-msg-uh8-1",
          hashMensagem: "b".repeat(64),
        },
      ],
      citacoes: [
        {
          texto: "Nega metástase óssea; achado hepático incerto — A CONFERIR.",
          referencias: [
            {
              ref: { eventId: "ev-fato-uh8-1", revisao: "1" },
              tempoClinico: "2026-10-01",
              tempoRegistro: "2026-10-01T10:00:00Z",
              unidade: null,
              fontes: [
                {
                  sourceId: "laudo-tc-sintetico-uh8",
                  classe: "DOCUMENT",
                  localizador: "p. 2 · trecho literal sintético",
                  dataClinica: "2026-10-01",
                  dataCaptura: "2026-10-01T10:00:00Z",
                  versao: "1",
                  contentHash: "c".repeat(64),
                },
              ],
            },
          ],
        },
      ],
      delta: { encounterAnteriorId: "en-anterior-uh8", novos: [{ eventId: "ev-fato-uh8-1", revisao: "1" }], substituidos: [] },
      integridade: [],
    };

    const entrada = {
      hoje: "Nega febre hoje; hipótese de neuropatia incerta — A CONFERIR.",
      decisao: "Manter vigilância clínica — A CONFERIR exames.",
      saidas: ["RESUMO", "EVOLUCAO"] as ("RESUMO" | "EVOLUCAO")[],
    };
    const documentos = comporDocumentosAtendimentoV6(base, entrada);

    const resposta: AtendimentoV6Resposta = {
      codigo: "ATENDIMENTO_PREPARADO",
      formato: "ONCOLOGIA_V6",
      contexto,
      base,
      rascunho: {
        id: "rascunho-uh8-1",
        versao: 1,
        revisaoBase: base.revisao,
        entrada,
        dataClinica: "2026-10-05",
        autor: { medicoId: "medico-sintetico-uh8", crm: "CRM-SINT-00" },
        salvoEm: "2026-10-05T12:05:00Z",
        documentos,
        conteudoHash: "d".repeat(64),
      },
      estadoRascunho: "ATUAL",
      criaEventoClinico: false,
      assinado: false,
    };

    const porta = {
      ...criarPortaFalsa(),
      recuperarAtendimentoV6: vi.fn(async () => resposta),
    };

    render(<AtendimentoV6 porta={porta} contexto={contexto} />);
    const regiaoEvolucao = await screen.findByRole("region", { name: "Evolução por diferenças · rascunho" });

    // 1. Sem expandir <details>, o texto clínico mostra negação, incerteza e A CONFERIR
    const textoClinicoPre = regiaoEvolucao.querySelector(".atendimento-v6__texto-clinico")!;
    expect(textoClinicoPre).toBeTruthy();
    expect(textoClinicoPre.textContent).toContain("Nega febre hoje");
    expect(textoClinicoPre.textContent).toContain("incerta");
    expect(textoClinicoPre.textContent).toContain("A CONFERIR");
    expect(textoClinicoPre.textContent).toContain(textoNota);

    // 2. <details> da evolução começa recolhido, tem <summary> focável por teclado e contém fonte/data/IDs
    const detailsEvolucao = regiaoEvolucao.querySelector("details")!;
    const summaryEvolucao = detailsEvolucao.querySelector("summary")!;
    expect(detailsEvolucao.open).toBe(false);
    expect(summaryEvolucao.textContent).toBe("Detalhes");
    summaryEvolucao.focus();
    expect(document.activeElement).toBe(summaryEvolucao);

    fireEvent.click(summaryEvolucao);
    expect(detailsEvolucao.open).toBe(true);
    expect(detailsEvolucao.textContent).toContain("ev-fato-uh8-1");
    expect(detailsEvolucao.textContent).toContain("2026-10-01");
    expect(detailsEvolucao.textContent).toContain("medico-sintetico-uh8");

    // 3. Bloco "AGORA · fontes e datas recuperadas" também é alcançável por <summary> e expõe fonte, trecho e data
    const summaryAgora = screen.getByText("AGORA · fontes e datas recuperadas");
    summaryAgora.focus();
    expect(document.activeElement).toBe(summaryAgora);
    const detailsAgora = summaryAgora.closest("details")!;
    expect(detailsAgora.textContent).toContain("laudo-tc-sintetico-uh8");
    expect(detailsAgora.textContent).toContain("p. 2 · trecho literal sintético");
    expect(detailsAgora.textContent).toContain("2026-10-01");
  });

  it("RevisaoClinica: exibe estado CONFLITANTE, A CONFERIR, negação e incerteza visíveis sem expandir e permite abrir proveniência completa por teclado", async () => {
    const dadosRevisao: RevisaoClinicaResposta = {
      codigo: "REVISAO_CLINICA_CARREGADA",
      contexto,
      revisao: "e".repeat(64),
      packs: [{ id: "pack-mama-sint", titulo: "Mama Sintético", estado: "ATIVO", cids: ["C50"] }],
      pack: null,
      ficha: [
        {
          id: "campo-her2",
          rotulo: "HER2",
          valor: "2+ equívoco (nega amplificação prévia; resultado incerto — A CONFERIR)",
          estado: "CONFLITANTE",
          motivo: "Trecho literal: IHQ HER2 2+ em revisão — p. 3",
          data: "2026-09-25",
          fatos: [{ eventId: "ev-her2-1", revisao: "1" }],
          fontes: [
            {
              sourceId: "laudo-ihq-sintetico-uh8",
              classe: "DOCUMENT",
              localizador: "p. 3 · bloco A2",
              dataClinica: "2026-09-25",
              dataCaptura: "2026-09-26T10:00:00Z",
              versao: "1",
              contentHash: "1".repeat(64),
            },
          ],
        },
      ],
      preQt: { estado: "PENDENTE", autorizaTratamento: false, pendencias: ["Conferir FEVE"] },
      respostaTumoral: {
        criterio: "RECIST_1_1",
        aplicabilidade: "CONFERIR_CRITERIO_DO_TUMOR",
        series: [],
        patologica: [
          {
            fato: { eventId: "ev-pcr-1", revisao: "1" },
            valor: "ausência de neoplasia residual incerta",
            data: "2026-09-28",
            estado: "INCERTO",
            conflito: true,
            qualificadores: { negated: true },
            fontes: [
              {
                sourceId: "ap-cirurgico-sintetico",
                classe: "DOCUMENT",
                localizador: "p. 1",
                dataClinica: "2026-09-28",
                dataCaptura: "2026-09-28T12:00:00Z",
                versao: "1",
                contentHash: "2".repeat(64),
              },
            ],
          },
        ],
        pendencias: [],
      },
      estadosDoenca: [],
      pendencias: [],
    };

    const porta = {
      ...criarPortaFalsa(),
      revisaoClinica: vi.fn(async () => dadosRevisao),
    };

    render(<RevisaoClinica porta={porta} contexto={contexto} versaoClinica={0} />);
    const tabela = await screen.findByRole("table", { name: "Dados mínimos da consulta" });

    // Visível na linha da tabela sem expandir <details>: valor com negação/incerteza/A CONFERIR e pílula CONFLITANTE
    expect(within(tabela).getByText(/nega amplificação prévia; resultado incerto — A CONFERIR/)).toBeTruthy();
    expect(within(tabela).getByText("CONFLITANTE")).toBeTruthy();

    // Seção de resposta patológica abre por padrão quando há dados e exibe pCR incerta — A CONFERIR e negação explícita
    expect(screen.getByText(/pCR incerta — A CONFERIR/)).toBeTruthy();
    expect(screen.getByText(/negação explícita na fonte/)).toBeTruthy();

    // <summary>Conferir fonte</summary> alcançável por foco e expõe fonte, trecho e data
    const summaryFonte = within(tabela).getByText("Conferir fonte");
    summaryFonte.focus();
    expect(document.activeElement).toBe(summaryFonte);
    const detailsFonte = summaryFonte.closest("details")!;
    expect(detailsFonte.textContent).toContain("laudo-ihq-sintetico-uh8");
    expect(detailsFonte.textContent).toContain("p. 3 · bloco A2");
    expect(detailsFonte.textContent).toContain("2026-09-25");
  });
});
