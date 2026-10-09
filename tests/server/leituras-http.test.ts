import { afterEach, expect, it } from "vitest";
import type { Server } from "node:http";
import type { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import { criarServidorLocal } from "../../src/server/http.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";
import { fonteSintetica, triagemBase } from "../fixtures/triagem.js";

const dirs: string[] = [];
const servers: Server[] = [];
const databases: DatabaseSync[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).filter((server) => server.listening)
    .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  for (const db of databases.splice(0)) { try { db.close(); } catch { /* already closed */ } }
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

it("serve seis leituras HTTP do ledger com escopo por paciente/encontro e pendências explícitas", async () => {
  const root = mkdtempSync(join(tmpdir(), "w10-leituras-")); dirs.push(root);
  const db = abrirLedger(join(root, "ledger.sqlite"));
  databases.push(db);
  const agora = () => "2026-10-07T12:00:00-03:00";
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-teste", crm: "CRM-TESTE",
    senha: "senha-sintetica-comprida", duracaoMs: 60_000, agora });
  const server = criarServidorLocal({ db, sessoes, configRootDir: join(root, "config"),
    gateway: criarGateway({ agora, auditar: () => {}, store: memoriaIdempotencia(), executores: {} }),
    agora, log: () => {} });
  servers.push(server);
  await new Promise<void>((resolve) => server.listening ? resolve() : server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("porta ausente");
  const token = sessoes.login("senha-sintetica-comprida")!.token;
  let seq = 0;
  const persistir = (patientId: string, encounterId: string, tipo: string, payload: unknown,
    tumorLotId: string | null = null, fontes = [fonteSintetica(`leitura-${seq + 1}`)], em = agora()) => {
    seq += 1;
    const draftId = `draft-leitura-${seq}`, operationId = `op-leitura-${String(seq).padStart(3, "0")}`;
    salvarDraft(db, { draftId, patientId, sourceId: `source-${seq}`, rawRef: "fixture-local",
      payload: {}, diagnostics: [], revision: 0, criadoEm: em });
    const result = confirmar(db, { operationId, patientId, tumorLotId, encounterId,
      reviewDecisionId: `review-leitura-${seq}`, sessao: sessoes.obter(token)!, em,
      registros: [{ draftId, expectedRevision: 0, eventId: `event-leitura-${seq}`, tipo,
        payload, fontes, revisao: "CONFIRMADO" }] });
    expect(result.estado).toBe("GRAVADA");
  };
  const post = async (path: string, body: unknown) => {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, { method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() as Record<string, any> };
  };
  const patientA = { patientId: "Paciente Teste 41", identificadores: [], nome: "Paciente Teste 41",
    nascimento: null, sexoCadastral: "NAO_INFORMADO" as const, divergencia: false };
  const patientB = { patientId: "Paciente Teste 42", identificadores: [], nome: "Paciente Teste 42",
    nascimento: null, sexoCadastral: "NAO_INFORMADO" as const, divergencia: false };
  const patientC = { patientId: "Paciente Teste 43", identificadores: [], nome: "Paciente Teste 43 antigo",
    nascimento: null, sexoCadastral: "NAO_INFORMADO" as const, divergencia: false };
  const absent = () => ({ valor: null, estado: "PENDENTE", campo: "AUSENTE", motivo: "não consta",
    fontes: [], revisao: "RAW" });
  const present = (valor: unknown) => ({ valor, estado: "VERDE", campo: "PRESENTE",
    motivo: "fonte confirmada", fontes: [fonteSintetica("lote-fonte")], revisao: "CONFIRMADO" });
  persistir(patientA.patientId, "encontro-41", "Paciente", patientA, null, []);
  persistir(patientB.patientId, "encontro-42", "Paciente", patientB, null, []);
  persistir(patientC.patientId, "encontro-43-antigo", "Paciente", patientC, null, [], "2026-10-07T12:00:00+03:00");
  persistir(patientC.patientId, "encontro-43-atual", "Paciente", { ...patientC, nome: "Paciente Teste 43 atual" },
    null, [], "2026-10-07T10:00:00Z");
  const loteB = { tumorLotId: "lote-42", patientId: patientB.patientId, cid: absent(), topografia: absent(),
    histologia: absent(), estadiamentos: [], finalidadeApac: absent(), marcos: [] };
  persistir(patientB.patientId, "encontro-42", "TumorLot", loteB, loteB.tumorLotId, []);
  const episodioB = { episodioId: "episodio-42", tumorLotId: loteB.tumorLotId, modalidade: "QT" as const,
    intencao: "PALIATIVA" as const, intentModifier: null, linha: 1, esquemaId: "esquema-42",
    inicio: present("2026-10-01"), fim: absent() };
  persistir(patientB.patientId, "encontro-42", "TreatmentEpisode", episodioB, loteB.tumorLotId, []);
  const apacB = { apacId: "apac-42", tumorLotId: loteB.tumorLotId,
    prescricaoAssinadaRef: { documentId: "documento-42", documentVersion: 1 },
    dataGeracaoApp: "2026-10-01", competencia: "2026-10", campos: {}, estado: "RASCUNHO",
    resultadoExterno: null, versao: 1, substituiApacId: null };
  persistir(patientB.patientId, "encontro-42", "APAC", apacB, loteB.tumorLotId, []);
  persistir(patientA.patientId, "encontro-41", "AgendaEntry", {
    patientId: patientA.patientId, encounterId: "encontro-41", horario: "09:00", data: "2026-10-07",
  }, null, []);
  const contato = { contatoId: "contato-41", canal: "WHATSAPP_SERVICO", endereco: "5511999990001",
    patientId: patientA.patientId, relacao: "PACIENTE", vinculadoEm: agora(), revogadoEm: null };
  persistir(patientA.patientId, "encontro-41", "Contato", contato, null, []);
  persistir(patientA.patientId, "encontro-41", "CanalMessage", {
    mensagemId: "mensagem-41", contatoId: contato.contatoId, patientId: patientA.patientId,
    texto: "mensagem sintética", em: agora(), redFlag: false,
  });
  persistir(patientB.patientId, "encontro-42", "CanalMessage", {
    mensagemId: "mensagem-mismatch", contatoId: contato.contatoId, patientId: patientA.patientId,
    texto: "não pode cruzar o envelope", em: agora(), redFlag: false,
  }, loteB.tumorLotId, [fonteSintetica("canal-mismatch")]);
  const contatoB = { ...contato, contatoId: "contato-revogado-42", patientId: patientB.patientId,
    endereco: "5511999990042" };
  persistir(patientB.patientId, "encontro-42", "Contato", contatoB, loteB.tumorLotId, []);
  persistir(patientB.patientId, "encontro-42", "Contato", { ...contatoB, revogadoEm: agora() }, loteB.tumorLotId, []);
  persistir(patientB.patientId, "encontro-42", "CanalMessage", { mensagemId: "mensagem-revogada",
    contatoId: contatoB.contatoId, patientId: patientB.patientId, texto: "revogada", em: agora(), redFlag: false },
  loteB.tumorLotId, [fonteSintetica("canal-revogado")]);
  const triagem = triagemBase({ patientId: patientA.patientId, encounterId: "encontro-41",
    chegadaEm: "2026-10-07T08:00:00-03:00" });
  persistir(patientA.patientId, "encontro-41", "Triagem", triagem, null, [fonteSintetica("triagem-41")]);
  persistir(patientA.patientId, "encontro-41", "Triagem", { ...triagem,
    chegadaEm: "2026-10-05T08:00:00-03:00" }, null, [fonteSintetica("triagem-antiga-41")]);
  const triagemB = triagemBase({ patientId: patientB.patientId, encounterId: "encontro-42",
    chegadaEm: "2026-10-07T08:30:00-03:00" });
  persistir(patientB.patientId, "encontro-42", "Triagem", triagemB, null, [fonteSintetica("triagem-42-a")]);
  persistir(patientB.patientId, "encontro-42", "Triagem", triagemB, null, [fonteSintetica("triagem-42-b")]);
  persistir(patientA.patientId, "encontro-41", "ChatMessage", { mensagemId: "chat-41",
    patientId: patientA.patientId, encounterId: "encontro-41", setor: "MEDICO", autor: "médico", texto: "nota sintética" });

  const consultaA = await post("/consulta/carregar", { patientId: patientA.patientId });
  expect(consultaA.status).toBe(200);
  expect(consultaA.data.cabecalho.paciente.patientId).toBe(patientA.patientId);
  expect(consultaA.data.cabecalho.lotes).toEqual([]);
  expect(consultaA.data.cabecalho.episodio).toBeNull();
  expect(JSON.stringify(consultaA.data)).not.toContain(patientB.patientId);
  const chatA = await post("/consulta/chat", { setor: "MEDICO" });
  expect(chatA.data.patientId).toBe(patientA.patientId);
  expect(chatA.data.mensagens).toMatchObject([{ mensagemId: "chat-41", texto: "nota sintética" }]);
  const failedSelection = await post("/consulta/carregar", { patientId: "Paciente Teste 99" });
  expect(failedSelection.status).toBe(404);
  const chatAfterFailedSelection = await post("/consulta/chat", { setor: "MEDICO" });
  expect(chatAfterFailedSelection.status).toBe(409);
  await post("/consulta/carregar", { patientId: patientA.patientId });

  const prescription = await post("/consulta/prescricao/rascunho", { patientId: patientA.patientId,
    encounterId: "encontro-41", tumorLotId: null, expression: "ONDANSETRONA 8 MG VO 8/8H SE NÁUSEA" });
  expect(prescription.status).toBe(201);
  expect(prescription.data.seguranca.resultado).toBe("NOT_EVALUABLE");
  expect(prescription.data.seguranca.resultado).not.toBe("PASS");
  const prescriptionId = prescription.data.draftId as string;
  const transferPrescription = await post("/consulta/rascunho/revisar", { draftId: prescriptionId,
    expectedRevision: 0, patientId: patientB.patientId });
  expect(transferPrescription.status).toBe(409);
  await post("/consulta/carregar", { patientId: patientB.patientId });
  const staleTabPrescription = await post("/consulta/prescricao/rascunho", { patientId: patientA.patientId,
    encounterId: "encontro-41", tumorLotId: null, expression: "ONDANSETRONA 8 MG VO 8/8H SE NÁUSEA" });
  expect(staleTabPrescription.status).toBe(409);

  salvarDraft(db, { draftId: "documento-41", patientId: patientA.patientId, sourceId: "source-documento-41",
    rawRef: "documento-local", payload: { documentId: "documento-41", documentVersion: 1,
      documentHash: "hash-documento-41", encounterId: "encontro-41", tumorLotId: null },
    diagnostics: [], revision: 0, criadoEm: agora() });
  salvarDraft(db, { draftId: "documento-outro-encontro", patientId: patientA.patientId, sourceId: "source-documento-outro",
    rawRef: "documento-local", payload: { documentId: "documento-outro", documentVersion: 1,
      documentHash: "hash-documento-outro", encounterId: "encontro-futuro", tumorLotId: null },
    diagnostics: [], revision: 0, criadoEm: agora() });
  const transferDocument = await post("/consulta/rascunho/revisar", { draftId: "documento-41",
    expectedRevision: 0, patientId: patientB.patientId });
  expect(transferDocument.status).toBe(409);
  const bundle = await post("/consulta/bundle", { patientId: patientA.patientId,
    encounterId: "encontro-41", tumorLotId: null });
  expect(bundle.status).toBe(200);
  expect(bundle.data.documentos).toMatchObject([{ documentId: "documento-41", documentVersion: 1 }]);
  expect(bundle.data.documentos).toHaveLength(1);
  const signDraft = await post("/consulta/confirmar", { patientId: patientA.patientId, tumorLotId: null,
    encounterId: "encontro-41", bloco: "TUDO", registros: [
      { id: "documento-41", expectedRevision: 0 }, { id: prescriptionId, expectedRevision: 0 },
    ], documentosExibidos: [{ documentId: "documento-41", documentVersion: 1 }], reconhecerAlertas: [],
    idempotencyKey: "confirmar-paciente-41" });
  expect(signDraft.status).toBe(409);
  expect(signDraft.data.codigo).toBe("DRAFT_AINDA_RASCUNHO");

  const agenda = await post("/consulta/agenda", {});
  expect(agenda.status).toBe(200);
  expect(agenda.data.itens).toMatchObject([{ patientId: patientA.patientId, horario: "09:00" }]);

  const salao = await post("/consulta/salao", {});
  expect(salao.status).toBe(200);
  expect(salao.data.ruleset.header.id).toBe("salao-triagem");
  expect(salao.data.cartoes).toHaveLength(1);
  expect(salao.data.cartoes[0].entrada.patientId).toBe(patientA.patientId);
  expect(salao.data.pacientes.some((p: { chegadaEm: string }) => p.chegadaEm.startsWith("2026-10-05"))).toBe(false);

  const canal = await post("/consulta/canal", {});
  expect(canal.status).toBe(200);
  expect(canal.data.mensagens).toHaveLength(3);
  expect(canal.data.mensagens).toEqual(expect.arrayContaining([
    expect.objectContaining({ mensagemId: "mensagem-41", patientId: patientA.patientId, estadoVinculo: "VINCULADO" }),
    expect.objectContaining({ mensagemId: "mensagem-mismatch", patientId: null, nomePaciente: null, estadoVinculo: "CONFLITO" }),
    expect.objectContaining({ mensagemId: "mensagem-revogada", patientId: null, nomePaciente: null, estadoVinculo: "REVOGADO" }),
  ]));

  const apacs = await post("/consulta/apac", {});
  expect(apacs.status).toBe(200);
  expect(apacs.data.itens).toMatchObject([{ patientId: patientB.patientId, apac: { apacId: "apac-42" }, antiglosa: { exportavel: false } }]);
  const consultaB = await post("/consulta/carregar", { patientId: patientB.patientId });
  expect(consultaB.status).toBe(200);
  expect(consultaB.data.cabecalho.episodio.episodioId).toBe("episodio-42");
  expect(consultaB.data.estado).toBe("PARCIAL"); // incomplete CID/source never blocks the consultation.

  const chat = await post("/consulta/chat", { setor: "MEDICO" });
  expect(chat.status).toBe(200);
  expect(chat.data.mensagens).toEqual([]); // active session context is now patient B.
  const chatB = await post("/consulta/chat", { setor: "SECRETARIA" });
  expect(chatB.data.patientId).toBe(patientB.patientId);

  const missing = await post("/consulta/carregar", { patientId: "Paciente Teste 99" });
  expect(missing.status).toBe(404);
  const offsetOrder = await post("/consulta/carregar", { patientId: patientC.patientId });
  expect(offsetOrder.data.encounterId).toBe("encontro-43-atual");
  expect(offsetOrder.data.cabecalho.paciente.nome).toBe("Paciente Teste 43 atual");
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
