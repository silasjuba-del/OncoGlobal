// Fixtures exclusivamente sintéticas; nenhuma saída desta suíte é aprovação clínica.
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { criarWriterClinicoGateway } from "../../src/kernel/gateway/writerClinico.js";
import { calcularHashTestCongelado, executarHarnessAvaliacao } from "../../src/kernel/harness/avaliacao.js";
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

it("rejeita Fonte de outro documento mesmo com sintaxe válida e conteúdo exibido intacto", () => {
  const db = abrirLedger(":memory:");
  try {
    const payload = { campo: "creatinina", valor: 1.1 };
    salvarDraft(db, { draftId: "draft-origem-a", patientId: PACIENTE, sourceId: "fonte-a",
      rawRef: "referencia-sintetica", payload, diagnostics: [], revision: 0, criadoEm: AGORA });
    const writer = criarWriterClinicoGateway({ db, agora: () => AGORA,
      hashFonteOriginal: (draft) => draft.sourceId === "fonte-a" ? sha256("Fonte A: creatinina 1,1 mg/dL") : null });
    const r = writer.persistir({
      operationId: "op-origem-b", reviewDecisionId: "rev-origem-b",
      ator: { tipo: "SESSAO", id: "medico-sintetico" },
      sessao: { medicoId: "medico-sintetico", crm: "CRM-SINTETICO", emitidaEm: AGORA,
        expiraEm: "2026-10-07T14:00:00.000Z" },
      acaoMedicaExplicita: true,
      contexto: { patientId: PACIENTE, encounterId: "encontro-pr45", tumorLotId: null },
      bundleExibidoNoServidor: [{ documentId: "draft-origem-a", documentVersion: 1,
        draftId: "draft-origem-a", conteudoHash: hashCanonico(payload) }],
      documentosAssinadosNoPedido: [],
      registros: [{ draftId: "draft-origem-a", expectedRevision: 0, eventId: "ev-origem-b",
        tipo: "FATO", payload, revisao: "CONFIRMADO",
        fontes: [{ sourceId: "fonte-b", classe: "LAB_FEED", localizador: "linha-1",
          dataClinica: "2026-10-07", dataCaptura: AGORA, versao: "v1",
          contentHash: sha256("Fonte B: outro documento") }] }],
    });
    expect(r).toMatchObject({ decisao: "NEGADA", motivoCodigo: "PROVENIENCIA_OBRIGATORIA_AUSENTE" });
    expect(listarEventos(db, PACIENTE)).toEqual([]);
  } finally { db.close(); }
});

it("G-07/G-08 são alertas revisáveis, não veto irreversível após confirmação específica", () => {
  const db = abrirLedger(":memory:");
  try {
    const payload = { patientId: PACIENTE, encounterId: "encontro-pr45", horario: "08:00", data: "2026-10-07" };
    salvarDraft(db, { draftId: "draft-alertas", patientId: PACIENTE, sourceId: "fonte-manual",
      rawRef: "referencia-sintetica", payload, diagnostics: [], revision: 0, criadoEm: AGORA });
    const writer = criarWriterClinicoGateway({ db, agora: () => AGORA });
    const pedido = {
      operationId: "op-alertas", reviewDecisionId: "rev-alertas",
      ator: { tipo: "SESSAO" as const, id: "medico-sintetico" },
      sessao: { medicoId: "medico-sintetico", crm: "CRM-SINTETICO", emitidaEm: AGORA,
        expiraEm: "2026-10-07T14:00:00.000Z" },
      acaoMedicaExplicita: true,
      contexto: { patientId: PACIENTE, encounterId: "encontro-pr45", tumorLotId: null },
      bundleExibidoNoServidor: [{ documentId: "draft-alertas", documentVersion: 1,
        draftId: "draft-alertas", conteudoHash: hashCanonico(payload) }],
      documentosAssinadosNoPedido: [],
      regrasDeterministicas: { lateralidade: { orgao: "mama", path: "DIREITA", rads: "ESQUERDA" },
        anatomiaSexo: { anatomia: "prostata", sexoCadastral: "F" } },
      registros: [{ draftId: "draft-alertas", expectedRevision: 0, eventId: "ev-alertas",
        tipo: "AgendaEntry", payload, fontes: [], revisao: "CONFIRMADO" as const }],
    };
    expect(writer.persistir(pedido).motivoCodigo).toBe("ALERTA_G07_REQUER_REVISAO_MEDICA");
    expect(writer.persistir({ ...pedido, alertasDeterministicosRevisados: ["G-07"] }).motivoCodigo)
      .toBe("ALERTA_G08_REQUER_REVISAO_MEDICA");
    expect(writer.persistir({ ...pedido, alertasDeterministicosRevisados: ["G-07", "G-08"] }).decisao)
      .toBe("PERSISTIDA");
    expect(listarEventos(db, PACIENTE)).toHaveLength(1);
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

it("não valida fonte de A para proposta atribuída ao paciente B", () => {
  const texto = "Paciente: Paciente A Sintético\nAdenocarcinoma confirmado.";
  const proposta = produzirPropostaBrainOs({
    propostaId: "pr45-paciente-b", patientId: "paciente-b-sintetico",
    encounterId: "encontro-b-sintetico", agora: AGORA,
    fontes: [{ sourceId: "documento-a", versao: "v1", conteudo: texto }],
    candidatos: [{ campo: "histologia", valor: "Adenocarcinoma",
      sourceId: "documento-a", trecho: "Adenocarcinoma confirmado." }],
  });
  const veredito = verificarPropostaNoHarnessRuntime({
    proposta,
    fontesOriginais: [{ sourceId: "documento-a", versao: "v1", modalidade: "DOCUMENTO",
      conteudoOriginal: texto, contentHash: sha256(texto),
      identidadeEsperadaPaciente: { patientId: "paciente-a-sintetico",
        nome: "Paciente A Sintético", identificadores: [] } }],
  });
  expect(veredito.status).toBe("BLOQUEADO_FALHA_CRITICA");
  expect(veredito.itensVerificados[0]?.verificacaoDeterministicaIndependenteOk).toBe(false);
  expect(veredito.manifestacoes).toContainEqual(expect.objectContaining({
    tipo: "FALHA_IDENTIDADE", sourceId: "documento-a",
  }));
  expect(veredito.manifestacoes).toContainEqual(expect.objectContaining({
    tipo: "CITACAO_NAO_SUSTENTADA", sourceId: "documento-a",
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

it("hash forjado pelo próprio avaliador não substitui pin da suíte versionada", () => {
  const casos = [{ casoId: "caso-trocado", versaoControle: "ctrl@1.0.0", sinteticoDeclarado: true,
    split: "test_congelado" as const, patientIdEsperado: PACIENTE,
    saidaObservada: { alertasEmitidos: [], conflitosManifestados: [], omissoesCriticasManifestadas: [],
      itensExtraidos: [] } }];
  const relatorio = executarHarnessAvaliacao({
    versaoSuite: "suite-sintetica@1.0.0", versaoControlesPositivos: "ctrl@1.0.0",
    finalidadeExecucao: "AVALIACAO", tipoSujeito: "EXTRATOR", casos,
    hashTestCongeladoEsperado: calcularHashTestCongelado(casos),
  });
  expect(relatorio.separacaoSplits.testCongeladoIntegro).toBe(false);
  expect(relatorio.statusGlobal).toBe("FALHA_FECHADA");
  expect(relatorio.relatorioValidoParaExtrator).toBe(false);
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
