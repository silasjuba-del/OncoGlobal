// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { criarPortaHttp } from "../../src/ui/api/http.js";
import { criarChaves } from "../../src/ui/api/chaves.js";
import { ApacResposta } from "../../src/ui/api/respostas.js";
import { carregarCorpusServidor } from "../../src/server/corpus.js";
import { TelaApacLote } from "../../src/ui/telas/apac/TelaApacLote.js";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { abrirAmbiente, cadastrarPaciente, criarDiretorio, removerDiretorio,
  AGORA, ENCONTRO, PACIENTE, SENHA } from "./fixtures/consulta-completa.js";

let ambiente: Awaited<ReturnType<typeof abrirAmbiente>> | undefined;
afterEach(async () => {
  cleanup(); vi.unstubAllGlobals();
  if (ambiente) { await ambiente.close(); removerDiretorio(ambiente.dir); ambiente = undefined; }
});

it("mantém achados e fontes da antiglosa HTTP visíveis no rascunho sem emitir APAC", async () => {
  expect(carregarCorpusServidor().caixasTodas.length).toBeGreaterThan(0);
  ambiente = await abrirAmbiente(criarDiretorio()); cadastrarPaciente(ambiente);
  // Estado documental inicial exclusivamente sintético; a leitura é HTTP/SQLite real.
  const ausente = { valor: null, estado: "PENDENTE", campo: "AUSENTE", motivo: "não consta", fontes: [], revisao: "RAW" };
  const lote = "lote-sintetico-apac-92";
  const registros = [
    { tipo: "TumorLot", payload: { tumorLotId: lote, patientId: PACIENTE, cid: ausente,
      topografia: ausente, histologia: ausente, estadiamentos: [], finalidadeApac: ausente, marcos: [] } },
    { tipo: "APAC", payload: { apacId: "apac-sintetica-92", tumorLotId: lote,
      prescricaoAssinadaRef: { documentId: "referencia-sintetica", documentVersion: 1 },
      dataGeracaoApp: "2026-10-09", competencia: "2026-10", campos: {}, estado: "RASCUNHO",
      resultadoExterno: null, versao: 1, substituiApacId: null } },
  ];
  for (const [i, registro] of registros.entries()) {
    const draftId = `apac-fixture-${i}`;
    salvarDraft(ambiente.db, { draftId, patientId: PACIENTE, sourceId: "fixture-apac-sintetica",
      rawRef: "fixture-sintetica", payload: {}, diagnostics: [], revision: 0, criadoEm: AGORA });
    expect(confirmar(ambiente.db, { operationId: `apac-fixture-operacao-${i}`, patientId: PACIENTE,
      tumorLotId: lote, encounterId: ENCONTRO, reviewDecisionId: `apac-fixture-revisao-${i}`,
      sessao: ambiente.sessoes.obter(ambiente.token)!, em: AGORA,
      registros: [{ ...registro, draftId, expectedRevision: 0, eventId: `apac-fixture-evento-${i}`,
        fontes: [], revisao: "CONFIRMADO" }] }).estado).toBe("GRAVADA");
  }
  const transporte = globalThis.fetch;
  const url = ambiente.baseUrl;
  vi.stubGlobal("fetch", (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
    transporte(typeof input === "string" && input.startsWith("/") ? `${url}${input}` : input, init));
  const porta = criarPortaHttp({ onSessaoExpirada: () => {} });
  expect((await porta.login(SENHA)).ok).toBe(true);
  const antes = ambiente.eventos().length;
  const bruto = await ambiente.request("/consulta/apac", {});
  const validacao = ApacResposta.safeParse(bruto.data);
  expect(validacao.success, validacao.success ? "" : JSON.stringify(validacao.error.issues)).toBe(true);
  const resposta = await porta.lotesApac();
  const achados = resposta.itens[0]?.antiglosa?.achados;
  expect(achados?.length).toBeGreaterThan(0);
  render(<TelaApacLote porta={porta} chaves={criarChaves()} />);
  const painel = await screen.findByRole("region", { name: "Antiglosa apac-sintetica-92" });
  for (const achado of achados!) {
    expect(painel.textContent).toContain(achado.motivo);
    expect(painel.textContent).toContain(achado.fonte);
  }
  expect(within(painel).getByText("Tabela SIGTAP da competência PENDENTE.")).toBeTruthy();
  expect(screen.getByText("Estado: RASCUNHO")).toBeTruthy();
  expect(ambiente.eventos()).toHaveLength(antes);
  expect(ambiente.eventos().some((e) => e.revisao === "ASSINADO")).toBe(false);
});
