// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResultadoCognitivoOncoassist, type PaginaExtracoesCognitivas } from "../../src/contracts/api/oncoassist.js";
import { criarPortaFalsa } from "../../src/ui/api/fake.js";
import { PainelOncoassist } from "../../src/ui/consulta/PainelOncoassist.js";

afterEach(cleanup);
const contexto = { patientId: "paciente-sintetico", encounterId: "consulta-sintetica", tumorLotId: null };
const hash = "a".repeat(64);
type Item = PaginaExtracoesCognitivas["itens"][number];

function item(parcial: Partial<Item> & Pick<Item, "draftId" | "status">): Item {
  return {
    sourceDraftId: "fonte-1", sourceId: "source-1", criadoEm: "2026-10-21T18:00:00.000Z",
    validadeFonte: "ATUAL", validadeContexto: "ATUAL", validadePolitica: "MESMA_VERSAO",
    alegacoes: 1, pendencias: 1, criaEventoClinico: false, ...parcial,
  };
}

function relatorio(draftId: string, validadeFonte: "ATUAL" | "FONTE_ALTERADA" = "FONTE_ALTERADA") {
  return ResultadoCognitivoOncoassist.parse({
    codigo: "PROPOSTA_LLM_CARREGADA", draftId, criaEventoClinico: false,
    proposta: { correlacao: { patientId: contexto.patientId, encounterId: contexto.encounterId, tumorLotId: null } },
    validadeFonte, validadeContexto: "ATUAL", validadePolitica: "MESMA_VERSAO",
    cognitivo: {
      schema: "CognitivoExtracao@1", politicaVersao: "brain-harness-extracao@1", estado: "AVALIADO", criaEventoClinico: false,
      proposta: {
        schema: "BrainOsProposta@1", propostaId: "prop-1", patientId: contexto.patientId, encounterId: contexto.encounterId,
        geradoEm: "2026-10-21T18:00:00.000Z", possuiCredenciais: false, possuiEscritaClinica: false,
        itensPropostos: [{
          itemId: "item-1", campo: "hemoglobina", valorProposto: "7.2", unidade: "g/dL", qualificador: "AFIRMADO",
          criticoNumero: true, validado: false, requerConfirmacaoMedica: true,
          citacoes: [{ sourceId: "source-1", versao: "1", contentHash: hash, trecho: "Hb 7.2 g/dL no laudo sintetico", localizador: "p1" }],
        }],
        inclusoesMesa: [], referenciasExcluidas: [], ambiguidades: [],
        lacunas: [{ campo: "data-coleta", obrigatoriedade: "CRITICA", motivo: "ausente no trecho", valorPreenchido: null }],
      },
      harness: {
        schema: "HarnessRuntimeVeredito@1", propostaId: "prop-1", tratadaComoFonteDeVerdade: false, corrigidoSilenciosamente: false,
        decisaoClinicaTomada: false, cobertura: "PARCIALMENTE_VERIFICADA", fontesNaoVerificaveis: [], acuraciaAudioDeclarada: false,
        status: "REQUER_RESOLUCAO_MEDICA",
        itensVerificados: [],
        manifestacoes: [{ tipo: "CITACAO_NAO_SUSTENTADA", campo: "hemoglobina", sourceId: "source-1", detalhe: "trecho divergente", trechoOriginal: null }],
      },
    },
  });
}

function portaCom(historico: PaginaExtracoesCognitivas, ler = vi.fn(async () => relatorio("extracao-1"))) {
  const base = criarPortaFalsa();
  return {
    porta: {
      ...base,
      oncoassistStatus: async () => ({ status: "DISPONIVEL" as const }),
      oncoassistFontes: async () => ({ fontes: [{ draftId: "fonte-1", rotulo: "Documento sintetico", criadoEm: "2026-10-21" }] }),
      oncoassistClassificar: vi.fn(),
      oncoassistHistorico: async () => ({ propostas: [], extracoesCognitivas: historico }),
      oncoassistResultadoCognitivo: ler,
    },
    confirmar: vi.spyOn(base, "confirmar"),
    ler,
  };
}

describe("OncoAssist cognitivo no painel", () => {
  it("reabre o resumo sem texto clínico e só mostra o valor depois da conferência", async () => {
    const { porta, confirmar, ler } = portaCom({
      itens: [item({ draftId: "extracao-1", status: "REQUER_RESOLUCAO_MEDICA", validadeFonte: "FONTE_ALTERADA", alegacoes: 2, pendencias: 1 })],
      proximoCursor: null,
    });
    render(<PainelOncoassist porta={porta} contexto={contexto} />);
    expect(await screen.findByText(/Exige resolução médica/)).toBeTruthy();
    expect(screen.getByText(/Fonte alterada — somente histórico/)).toBeTruthy();
    expect(screen.getByText(/2 alegações propostas/)).toBeTruthy();
    expect(screen.queryByText(/7\.2/)).toBeNull();
    expect(screen.queryByText(/Hb 7\.2/)).toBeNull();
    expect(ler).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Abrir conferência extracao-1" }));
    expect(await screen.findByText(/hemoglobina: 7.2 g\/dL/)).toBeTruthy();
    expect(screen.getByText(/não validado/)).toBeTruthy();
    expect(screen.getByText(/CITACAO_NAO_SUSTENTADA · hemoglobina/)).toBeTruthy();
    expect(screen.getByText(/data-coleta \(CRITICA\)/)).toBeTruthy();
    expect(screen.getByText(/somente histórica/)).toBeTruthy();
    expect(ler).toHaveBeenCalledWith({ ...contexto, draftId: "extracao-1" }, expect.any(AbortSignal));
    expect(confirmar).not.toHaveBeenCalled();
    expect(porta.oncoassistClassificar).not.toHaveBeenCalled();
  });

  it("falha ao abrir preserva a lista e não promove o rascunho", async () => {
    const { porta, confirmar } = portaCom({
      itens: [item({ draftId: "extracao-bloqueada", status: "BLOQUEADO_FALHA_CRITICA" })],
      proximoCursor: null,
    }, vi.fn(async () => { throw new Error("sintetico"); }));
    render(<PainelOncoassist porta={porta} contexto={contexto} />);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir conferência extracao-bloqueada" }));
    expect(await screen.findByText(/Não foi possível abrir a conferência/)).toBeTruthy();
    expect(screen.getByText(/Bloqueada por falha crítica/)).toBeTruthy();
    expect(screen.queryByLabelText("Conferência da extração cognitiva")).toBeNull();
    expect(confirmar).not.toHaveBeenCalled();
  });

  it("página seguinte acrescenta extração sem duplicar e sem apagar a primeira", async () => {
    let pagina = 0;
    const base = criarPortaFalsa();
    const porta = {
      ...base,
      oncoassistStatus: async () => ({ status: "PENDENTE" as const, motivo: "DESABILITADO" }),
      oncoassistHistorico: async (pedido: { cursorExtracoes?: string }) => {
        pagina += 1;
        if (pedido.cursorExtracoes) {
          return { propostas: [], extracoesCognitivas: { itens: [
            item({ draftId: "extracao-1", status: "NAO_VERIFICADO" }),
            item({ draftId: "extracao-2", status: "NAO_VERIFICADO", criadoEm: "2026-10-20T18:00:00.000Z" }),
          ], proximoCursor: null } };
        }
        return { propostas: [], extracoesCognitivas: { itens: [item({ draftId: "extracao-1", status: "NAO_VERIFICADO" })], proximoCursor: "cursor-2" } };
      },
    };
    render(<PainelOncoassist porta={porta} contexto={contexto} />);
    expect(await screen.findByText(/Não verificada/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Carregar extrações anteriores" }));
    expect(await screen.findByText(/2026-10-20T18:00:00.000Z/)).toBeTruthy();
    expect(screen.getAllByText(/Não verificada/)).toHaveLength(2);
    expect(pagina).toBe(2);
  });

  it("histórico legado sem extração cognitiva não finge conferência", async () => {
    const porta = {
      ...criarPortaFalsa(),
      oncoassistStatus: async () => ({ status: "PENDENTE" as const }),
      oncoassistHistorico: async () => ({ propostas: [] }),
    };
    render(<PainelOncoassist porta={porta} contexto={contexto} />);
    expect(await screen.findByText(/aguardando configuração/)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Extrações cognitivas salvas" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Abrir conferência/ })).toBeNull();
  });
});
