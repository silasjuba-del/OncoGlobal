// Fixtures exclusivamente sintéticas; nenhuma saída desta suíte é aprovação clínica.
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { criarWriterClinicoGateway } from "../../src/kernel/gateway/writerClinico.js";
import { executarHarnessAvaliacao } from "../../src/kernel/harness/avaliacao.js";
import { verificarPropostaNoHarnessRuntime } from "../../src/kernel/harness/runtime.js";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { listarEventos } from "../../src/kernel/ledger/ledger.js";
import { produzirPropostaBrainOs } from "../../src/kernel/llm/brainOs.js";
import { hashCanonico } from "../../src/modules/tipos.js";

const AGORA = "2026-10-07T12:00:00.000Z";
const PACIENTE = "paciente-sintetico-pr45";
const sha256 = (texto: string) => createHash("sha256").update(texto, "utf8").digest("hex");

it("nega gravação de payload diverso do draft cujo hash foi exibido", () => {
  const db = abrirLedger(":memory:");
  try {
    const exibido = { campo: "creatinina", valor: 1.1 };
    salvarDraft(db, { draftId: "draft-pr45", patientId: PACIENTE, sourceId: "fonte-sintetica",
      rawRef: "referencia-sintetica", payload: exibido, diagnostics: [], revision: 0, criadoEm: AGORA });
    const writer = criarWriterClinicoGateway({ db, agora: () => AGORA });
    const r = writer.persistir({
      operationId: "op-pr45-adulterado", reviewDecisionId: "rev-pr45-adulterado",
      ator: { tipo: "SESSAO", id: "medico-sintetico" },
      sessao: { medicoId: "medico-sintetico", crm: "CRM-SINTETICO",
        emitidaEm: AGORA, expiraEm: "2026-10-07T14:00:00.000Z" },
      acaoMedicaExplicita: true,
      contexto: { patientId: PACIENTE, encounterId: "encontro-pr45", tumorLotId: null },
      bundleExibidoNoServidor: [{ documentId: "draft-pr45", documentVersion: 1,
        draftId: "draft-pr45", conteudoHash: hashCanonico(exibido) }],
      documentosAssinadosNoPedido: [{ documentId: "draft-pr45", documentVersion: 1 }],
      registros: [{
        draftId: "draft-pr45", expectedRevision: 0, eventId: "ev-pr45-adulterado", tipo: "FATO",
        payload: { campo: "creatinina", valor: 9.9 }, revisao: "CONFIRMADO",
        fontes: [{ sourceId: "fonte-sintetica", classe: "LAB_FEED",
          localizador: "linha-1", dataClinica: "2026-10-07", dataCaptura: AGORA,
          versao: "v1", contentHash: sha256("Creatinina 1,1 mg/dL") }],
      }],
    });
    expect(r).toMatchObject({ decisao: "NEGADA", motivoCodigo: "CONTEUDO_ALTERADO_APOS_EXIBICAO" });
    expect(listarEventos(db, PACIENTE)).toEqual([]);
  } finally { db.close(); }
});

it("bloqueia proposta com fonte válida e citação adicional desconhecida", () => {
  const texto = "Laudo sintético: adenocarcinoma.";
  const proposta = produzirPropostaBrainOs({
    propostaId: "pr45-fonte-ausente", patientId: PACIENTE, encounterId: "encontro-pr45",
    agora: AGORA, fontes: [{ sourceId: "fonte-valida", versao: "v1", conteudo: texto }],
    candidatos: [{ campo: "histologia", valor: "adenocarcinoma", sourceId: "fonte-valida",
      trecho: "adenocarcinoma." }],
  });
  const item = proposta.itensPropostos[0]!;
  const veredito = verificarPropostaNoHarnessRuntime({
    proposta: { ...proposta, itensPropostos: [{ ...item,
      citacoes: [...item.citacoes, { ...item.citacoes[0]!, sourceId: "fonte-inexistente" }] }] },
    fontesOriginais: [{ sourceId: "fonte-valida", versao: "v1", modalidade: "DOCUMENTO",
      conteudoOriginal: texto, contentHash: sha256(texto) }],
  });
  expect(veredito.cobertura).toBe("VERIFICADA");
  expect(veredito.status).toBe("BLOQUEADO_FALHA_CRITICA");
  expect(veredito.manifestacoes).toContainEqual(expect.objectContaining({
    tipo: "CITACAO_NAO_SUSTENTADA", sourceId: "fonte-inexistente",
  }));
});

it("sem hash esperado, avaliação de test_congelado falha fechada", () => {
  const relatorio = executarHarnessAvaliacao({
    versaoSuite: "suite-pr45@1", versaoControlesPositivos: "ctrl-pr45@1",
    finalidadeExecucao: "AVALIACAO", tipoSujeito: "EXTRATOR",
    casos: [{ casoId: "caso-pr45", versaoControle: "ctrl-pr45@1",
      sinteticoDeclarado: true, split: "test_congelado", patientIdEsperado: PACIENTE,
      saidaObservada: { alertasEmitidos: [], conflitosManifestados: [],
        omissoesCriticasManifestadas: [], itensExtraidos: [] } }],
  });
  expect(relatorio.separacaoSplits.testCongeladoIntegro).toBe(false);
  expect(relatorio.relatorioValidoParaExtrator).toBe(false);
  expect(relatorio.statusGlobal).toBe("FALHA_FECHADA");
  expect(relatorio.violacoesFatais).toContainEqual(expect.objectContaining({
    codigo: "TEST_CONGELADO_HASH_DIVERGENTE",
  }));
});

it("cita o trecho que contém o termo clínico mesmo após 240 caracteres", () => {
  const termo = "adenocarcinoma";
  const conteudo = `${"Texto sintético preliminar. ".repeat(15)}${termo} comprovado no laudo.`;
  const proposta = produzirPropostaBrainOs({
    propostaId: "pr45-trecho-referencia", agora: AGORA,
    fontes: [{ sourceId: "fonte-pr45", versao: "v1", conteudo }],
    referenciasCandidatas: [{ referenciaId: "ref-pr45", versao: "v1",
      status: "CONSULTAVEL", escopoCompativel: true, provenienciaCompleta: true,
      termosChave: [termo], motivoInclusaoSeAplicavel: "Revisão contextual sintética." }],
  });
  expect(proposta.inclusoesMesa[0]?.trechoCitado).toContain(termo);
  expect(proposta.inclusoesMesa[0]?.trechoCitado.length).toBeLessThanOrEqual(240);
});
