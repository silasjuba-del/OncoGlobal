import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { lerDraft, salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { listarEventos } from "../../src/kernel/ledger/ledger.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { hashConteudoExibido } from "../../src/server/sessao.js";
import { ambienteHttp } from "../server/http-fixture.js";

const AGORA = "2026-10-05T12:00:00Z";
const PACIENTE = "Paciente Teste 42";
const OUTRO_PACIENTE = "Paciente Teste 43";
const ENCONTRO = "encontro-teste-42";
const FONTE = "laudo-sintetico-42";
const TRANSCRICAO = "01/09/2026 creatinina 1,2 mg/dL";
const SENHA = "senha-sintetica-comprida";

type Ambiente = Awaited<ReturnType<typeof ambienteHttp>>;
type Resposta<T> = { status: number; data: T };
type Codigo = { codigo: string };
type FatoExtraido = {
  id: string;
  domain: string;
  evidence: string;
  requiresConfirmation: boolean;
  sourceId: string;
  rawEvidence: string;
};
type Extracao = { draftId: string; revision: number; linkedPatientId: string | null; facts: FatoExtraido[] };
type Comprovante = { documentId: string; documentVersion: number; conteudoHash: string };
type Conteudo = {
  kind: string;
  status: string;
  contexto: { patientId: string; encounterId: string; tumorLotId: string | null };
  resumo: string;
  selectedFactIds: string[];
  facts: FatoExtraido[];
};
type Preparacao = Codigo & {
  conteudo: Conteudo;
  comprovanteExibicao: Comprovante;
  criaEventoClinico: boolean;
};
type Revisao = Codigo & {
  draftId: string;
  revision: number;
  linkedPatientId: string;
  factIds: string[];
  evolucaoRascunho: string;
};
type Selecao = { draftId: string; expectedRevision: number;
  patientId: string; factIds: string[]; operationId: string };

async function post<T>(ambiente: Ambiente, rota: string, entrada: unknown,
  token = ambiente.token): Promise<Resposta<T>> {
  const resposta = await ambiente.request(rota, "POST", JSON.stringify(entrada), token, "application/json");
  return { status: resposta.status, data: JSON.parse(resposta.body) as T };
}

function semearPaciente(ambiente: Ambiente, numero: "42" | "43") {
  const patientId = `Paciente Teste ${numero}`;
  const encounterId = `encontro-teste-${numero}`;
  const draftId = `seed-revisao-${numero}`;
  salvarDraft(ambiente.db, { draftId, patientId, sourceId: `seed-source-${numero}`,
    rawRef: "fixture-local-sintetica", payload: {}, diagnostics: [], revision: 0, criadoEm: AGORA });
  const resultado = confirmar(ambiente.db, {
    operationId: `seed-operation-revisao-${numero}`, patientId, tumorLotId: null, encounterId,
    reviewDecisionId: `seed-review-revisao-${numero}`,
    sessao: ambiente.sessoes.obter(ambiente.token)!, em: AGORA,
    registros: [{ draftId, expectedRevision: 0, eventId: `seed-event-revisao-${numero}`,
      tipo: "Paciente", payload: { patientId, identificadores: [], nome: patientId,
        nascimento: null, sexoCadastral: "NAO_INFORMADO", divergencia: false },
      fontes: [], revisao: "CONFIRMADO" }],
  });
  expect(resultado.estado).toBe("GRAVADA");
  return { patientId, encounterId };
}

function quantidadeFatos(ambiente: Ambiente): number {
  const row = ambiente.db.prepare("SELECT COUNT(*) AS total FROM clinical_event WHERE tipo = 'FATO'")
    .get() as { total: number };
  return Number(row.total);
}

async function extrairEVincular(ambiente: Ambiente): Promise<{ selecao: Selecao; fato: FatoExtraido }> {
  const consulta = await post<{ patientId: string; encounterId: string }>(
    ambiente, "/consulta/carregar", { patientId: PACIENTE });
  expect(consulta.status).toBe(200);
  expect(consulta.data).toMatchObject({ patientId: PACIENTE, encounterId: ENCONTRO });

  const extracao = await post<Extracao>(ambiente, "/consulta/extrair", {
    recordingId: "gravacao-sintetica-42", sourceId: FONTE,
    sourceType: "medical_note", rawTranscript: TRANSCRICAO,
  });
  expect(extracao.status).toBe(201);
  expect(extracao.data.linkedPatientId).toBeNull();
  expect(extracao.data.revision).toBe(0);
  const fato = extracao.data.facts.find((item) => item.domain === "lab" && item.sourceId === FONTE);
  expect(fato).toBeDefined();
  if (!fato) throw new Error("FATO_SINTETICO_NAO_EXTRAIDO");
  expect(fato).toMatchObject({ evidence: "EXPLICIT", requiresConfirmation: false });
  expect(fato.rawEvidence).toContain("creatinina 1,2 mg/dL");

  const vinculo = await post<Codigo & { revision: number; fatosConfirmados: number;
    criaEventoClinico: boolean }>(ambiente, "/consulta/rascunho/revisar", {
    draftId: extracao.data.draftId, expectedRevision: 0, patientId: PACIENTE,
  });
  expect(vinculo.status).toBe(200);
  expect(vinculo.data).toMatchObject({
    codigo: "VINCULO_REVISTO", revision: 1, fatosConfirmados: 0, criaEventoClinico: false,
  });
  expect(quantidadeFatos(ambiente)).toBe(0);
  return { selecao: { draftId: extracao.data.draftId, expectedRevision: 1, patientId: PACIENTE,
    factIds: [fato.id], operationId: "review-paciente-42-exibicao" }, fato };
}

describe("W10 FUGU-EIXO-02 · revisão de extração por HTTP real", () => {
  it("nega 409 e zero fatos antes de exibir; só confirma o fato após entregar o conteúdo exato e o comprovante da sessão", async () => {
    const ambiente = await ambienteHttp();
    try {
      semearPaciente(ambiente, "42");
      const { selecao, fato } = await extrairEVincular(ambiente);

      const antesDaExibicao = await post<Codigo>(ambiente, "/consulta/rascunho/revisar", {
        ...selecao, comprovanteExibicao: { documentId: "documento-forjado-42",
          documentVersion: 1, conteudoHash: "0".repeat(64) },
      });
      expect(antesDaExibicao).toMatchObject({ status: 409, data: { codigo: "BUNDLE_NAO_EXIBIDO" } });
      expect(quantidadeFatos(ambiente)).toBe(0);
      expect(lerDraft(ambiente.db, selecao.draftId)).toMatchObject({ patientId: PACIENTE, revision: 1 });

      const preparo = await post<Preparacao>(ambiente, "/consulta/rascunho/preparar-revisao", selecao);
      expect(preparo.status).toBe(200);
      expect(preparo.data).toMatchObject({
        codigo: "REVISAO_PREPARADA", criaEventoClinico: false,
        conteudo: { kind: "EVOLUCAO_RASCUNHO", status: "RASCUNHO",
          contexto: { patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: null },
          selectedFactIds: [fato.id], facts: [{ id: fato.id, sourceId: FONTE }] },
        comprovanteExibicao: { documentVersion: 1 },
      });
      expect(preparo.data.conteudo.resumo).toContain(fato.rawEvidence);
      expect(preparo.data.comprovanteExibicao.conteudoHash)
        .toBe(hashConteudoExibido(preparo.data.conteudo));
      const resumoPersistido = lerDraft(ambiente.db, preparo.data.comprovanteExibicao.documentId);
      expect(resumoPersistido).toMatchObject({ patientId: PACIENTE, revision: 0 });
      expect(resumoPersistido?.payload).toEqual(preparo.data.conteudo);
      expect(quantidadeFatos(ambiente)).toBe(0);

      const semComprovante = await post<Codigo>(ambiente, "/consulta/rascunho/revisar", selecao);
      expect(semComprovante).toMatchObject({ status: 409, data: { codigo: "BUNDLE_NAO_EXIBIDO" } });
      expect(quantidadeFatos(ambiente)).toBe(0);

      const confirmarFato = { ...selecao, comprovanteExibicao: preparo.data.comprovanteExibicao };
      const revisado = await post<Revisao>(ambiente, "/consulta/rascunho/revisar", confirmarFato);
      expect(revisado).toMatchObject({ status: 200, data: {
        codigo: "GRAVADA", linkedPatientId: PACIENTE,
        draftId: preparo.data.comprovanteExibicao.documentId,
        factIds: [fato.id], evolucaoRascunho: preparo.data.conteudo.resumo,
      } });
      const eventos = listarEventos(ambiente.db, PACIENTE)
        .filter((evento) => evento.operationId === selecao.operationId);
      expect(eventos).toHaveLength(1);
      expect(eventos[0]).toMatchObject({
        tipo: "FATO", patientId: PACIENTE, encounterId: ENCONTRO, revisao: "CONFIRMADO",
        payload: { data: { factId: fato.id, sourceId: FONTE, rawEvidence: fato.rawEvidence } },
      });
      expect(eventos[0]?.fontes[0]?.contentHash)
        .toBe(createHash("sha256").update(TRANSCRICAO, "utf8").digest("hex"));
      expect(quantidadeFatos(ambiente)).toBe(1);
      expect(lerDraft(ambiente.db, selecao.draftId)?.payload)
        .toMatchObject({ kind: "EXTRACAO_RASCUNHO", input: { rawTranscript: TRANSCRICAO } });
      expect(lerDraft(ambiente.db, preparo.data.comprovanteExibicao.documentId)?.revision).toBe(1);

      const replay = await post<Revisao>(ambiente, "/consulta/rascunho/revisar", confirmarFato);
      expect(replay).toMatchObject({ status: 200, data: { codigo: "REPLAY" } });
      expect(quantidadeFatos(ambiente)).toBe(1);
    } finally { await ambiente.close(); }
  });

  it("hash, documento/versão, outra sessão e troca de consulta não reaproveitam exibição antiga", async () => {
    const ambiente = await ambienteHttp();
    try {
      semearPaciente(ambiente, "42");
      const { selecao } = await extrairEVincular(ambiente);
      const preparo = await post<Preparacao>(ambiente, "/consulta/rascunho/preparar-revisao", selecao);
      expect(preparo.status).toBe(200);
      const comprovante = preparo.data.comprovanteExibicao;
      const outroHash = `${comprovante.conteudoHash[0] === "0" ? "1" : "0"}${comprovante.conteudoHash.slice(1)}`;
      const hashErrado = await post<Codigo>(ambiente, "/consulta/rascunho/revisar", {
        ...selecao, comprovanteExibicao: { ...comprovante, conteudoHash: outroHash },
      });
      expect(hashErrado).toMatchObject({ status: 409, data: { codigo: "CONTEUDO_ALTERADO_APOS_EXIBICAO" } });
      expect(quantidadeFatos(ambiente)).toBe(0);

      const versaoNaoExibida = await post<Codigo>(ambiente, "/consulta/rascunho/revisar", {
        ...selecao, comprovanteExibicao: { ...comprovante, documentVersion: comprovante.documentVersion + 1 },
      });
      expect(versaoNaoExibida).toMatchObject({ status: 409, data: { codigo: "ESCOPO_ASSINATURA_INVALIDO" } });
      expect(quantidadeFatos(ambiente)).toBe(0);
      const documentoNaoExibido = await post<Codigo>(ambiente, "/consulta/rascunho/revisar", {
        ...selecao, comprovanteExibicao: { ...comprovante, documentId: "documento-nao-exibido-42" },
      });
      expect(documentoNaoExibido).toMatchObject({ status: 409, data: { codigo: "ESCOPO_ASSINATURA_INVALIDO" } });
      expect(quantidadeFatos(ambiente)).toBe(0);

      const login = await post<{ token: string }>(ambiente, "/login", { senha: SENHA }, "");
      expect(login.status).toBe(200);
      expect((await post(ambiente, "/consulta/carregar", { patientId: PACIENTE }, login.data.token)).status)
        .toBe(200);
      const outraSessao = await post<Codigo>(ambiente, "/consulta/rascunho/revisar", {
        ...selecao, comprovanteExibicao: comprovante,
      }, login.data.token);
      expect(outraSessao).toMatchObject({ status: 409, data: { codigo: "BUNDLE_NAO_EXIBIDO" } });
      expect(quantidadeFatos(ambiente)).toBe(0);

      semearPaciente(ambiente, "43");
      expect((await post(ambiente, "/consulta/carregar", { patientId: OUTRO_PACIENTE })).status).toBe(200);
      const consultaTrocada = await post<Codigo>(ambiente, "/consulta/rascunho/revisar", {
        ...selecao, comprovanteExibicao: comprovante,
      });
      expect(consultaTrocada).toMatchObject({
        status: 409, data: { codigo: "PACIENTE_FORA_DA_CONSULTA_SELECIONADA" },
      });
      expect(quantidadeFatos(ambiente)).toBe(0);
      expect((await post(ambiente, "/consulta/carregar", { patientId: PACIENTE })).status).toBe(200);
      const exibicaoRevogada = await post<Codigo>(ambiente, "/consulta/rascunho/revisar", {
        ...selecao, comprovanteExibicao: comprovante,
      });
      expect(exibicaoRevogada).toMatchObject({ status: 409, data: { codigo: "BUNDLE_NAO_EXIBIDO" } });
      expect(quantidadeFatos(ambiente)).toBe(0);

      const novoPreparo = await post<Preparacao>(ambiente, "/consulta/rascunho/preparar-revisao", selecao);
      expect(novoPreparo.status).toBe(200);
      const revisado = await post<Revisao>(ambiente, "/consulta/rascunho/revisar", {
        ...selecao, comprovanteExibicao: novoPreparo.data.comprovanteExibicao,
      });
      expect(revisado).toMatchObject({ status: 200, data: { codigo: "GRAVADA" } });
      expect(quantidadeFatos(ambiente)).toBe(1);
      expect(listarEventos(ambiente.db, OUTRO_PACIENTE).some((evento) => evento.tipo === "FATO")).toBe(false);
    } finally { await ambiente.close(); }
  });

  it("rascunho de revisão alterado após exibição não usa o comprovante antigo para criar FATO", async () => {
    const ambiente = await ambienteHttp();
    try {
      semearPaciente(ambiente, "42");
      const { selecao } = await extrairEVincular(ambiente);
      const preparo = await post<Preparacao>(ambiente, "/consulta/rascunho/preparar-revisao", selecao);
      expect(preparo.status).toBe(200);
      const draftExibido = lerDraft(ambiente.db, preparo.data.comprovanteExibicao.documentId);
      expect(draftExibido).not.toBeNull();
      if (!draftExibido) throw new Error("RASCUNHO_REVISAO_NAO_PERSISTIDO");
      // Simula uma edição concorrente local no conteúdo persistido, não uma declaração do cliente HTTP.
      salvarDraft(ambiente.db, { ...draftExibido, revision: draftExibido.revision + 1,
        payload: { ...preparo.data.conteudo,
          resumo: `${preparo.data.conteudo.resumo}\nConteúdo sintético alterado após exibição.` } });
      const resposta = await post<Codigo>(ambiente, "/consulta/rascunho/revisar", {
        ...selecao, comprovanteExibicao: preparo.data.comprovanteExibicao,
      });
      expect(resposta.status).toBe(409);
      expect(quantidadeFatos(ambiente)).toBe(0);
      expect(listarEventos(ambiente.db, PACIENTE).some((evento) =>
        evento.operationId === selecao.operationId)).toBe(false);
    } finally { await ambiente.close(); }
  });
});
