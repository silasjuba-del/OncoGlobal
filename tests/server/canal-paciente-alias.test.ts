import { lerCanal, lerConsulta, lerPaciente } from "../../src/server/leituras.js";
import { criarServidorLocal } from "../../src/server/http.js";
import { ConsultaResposta } from "../../src/contracts/api/respostas.js";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import { createHash } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import type { CadastroVinculo } from "../../src/modules/canal/vinculo.js";
import { executarConfirmacao } from "../../src/kernel/comandos/index.js";
import { salvarDraft } from "../../src/kernel/comandos/portas.js";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { receberTransporteSintetico } from "../../src/server/canalEntrada.js";
import { cadastrosCanal, lerMensagensOperacionaisCanal, revisaoContextoCanal } from "../../src/server/canalOperacao.js";
import { carregarDicionarioPacienteDoLedger } from "../../src/server/canalResposta.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";

const EM = "2026-10-20T12:00:00.000Z";
const SENHA = "senha-canal-alias-sintetica";
const CONTEXTO_A = { patientId: "paciente-alias-a", encounterId: "consulta-alias-a", tumorLotId: null };
const CONTEXTO_B = { patientId: "paciente-alias-b", encounterId: "consulta-alias-b", tumorLotId: null };
const SENDER = "5500000007711";
const abertos: ReturnType<typeof abrirLedger>[] = [];

afterEach(() => { for (const db of abertos.splice(0)) db.close(); });

function abrir() {
  const db = abrirLedger(":memory:");
  abertos.push(db);
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-canal-alias", crm: "CRM-ALIAS-SINTETICO",
    senha: SENHA, duracaoMs: 60_000, agora: () => EM });
  const token = sessoes.login(SENHA)!.token;
  let n = 0;
  function seed(ctx: typeof CONTEXTO_A | typeof CONTEXTO_B, tipo: string, payload: unknown,
    supersedesEventId: string | null = null) {
    const eventId = `evento-canal-alias-${++n}`;
    const draftId = `draft-${eventId}`;
    salvarDraft(db, { draftId, patientId: ctx.patientId, sourceId: `fonte-${eventId}`,
      rawRef: "referencia-sintetica", payload: { contexto: ctx }, revision: 0, diagnostics: [], criadoEm: EM });
    const result = executarConfirmacao(db, { operationId: `op-${eventId}`, patientId: ctx.patientId,
      encounterId: ctx.encounterId, tumorLotId: ctx.tumorLotId, reviewDecisionId: `review-${eventId}`,
      sessao: sessoes.obter(token)!, em: EM,
      registros: [{ draftId, expectedRevision: 0, eventId, tipo, payload, fontes: [], revisao: "CONFIRMADO",
        supersedesEventId }] });
    if (result.estado !== "GRAVADA") throw new Error(`SEED_NEGADO:${tipo}:${result.estado}`);
    return eventId;
  }
  return { db, sessoes, token, seed };
}

const paciente = (patientId: string, nome: string) => ({ patientId, nome, identificadores: [], nascimento: null,
  sexoCadastral: "NAO_INFORMADO", divergencia: false });
const contato = (patientId: string | null, revogadoEm: string | null = null) => ({ contatoId: "contato-alias-sintetico",
  canal: "WHATSAPP_SERVICO", endereco: SENDER, patientId, relacao: "PACIENTE",
  vinculadoEm: EM, revogadoEm });

it("projeta mensagem realmente vinculada para Paciente@1 e mantém precedência de conflito e revogação", () => {
  const a = abrir();
  const pacienteA = { patientId: CONTEXTO_A.patientId, nome: "Paciente A sintético", chaveDemografica: null,
    identificadores: [{ tipo: "TELEFONE" as const, valor: SENDER }] } satisfies CadastroVinculo;
  const cadastroAId = a.seed(CONTEXTO_A, "Paciente@1", paciente(CONTEXTO_A.patientId, pacienteA.nome));
  const contatoAId = a.seed(CONTEXTO_A, "Contato", contato(CONTEXTO_A.patientId));

  const ingresso = receberTransporteSintetico(a.db, { accountId: "conta-canal-alias-sintetica",
    canal: "WHATSAPP_SERVICO", providerMessageId: "mensagem-alias-sintetica", senderRef: SENDER,
    providerSentAt: EM, ingestedAt: EM,
    conteudo: { tipo: "TEXT", texto: "Relato sintético: não houve febre.",
      contentSha256: createHash("sha256").update("Relato sintético: não houve febre.").digest("hex") },
    // O evento de ingresso registra o vínculo conhecido; a leitura abaixo precisa reconstruí-lo do ledger.
    cadastros: [pacienteA] });
  expect(ingresso.ok).toBe(true);
  if (!ingresso.ok) throw new Error("INGRESSO_NEGADO");

  const acesso = { sessoes: a.sessoes, token: a.token, agora: EM };
  const leituraInicial = lerMensagensOperacionaisCanal(a.db, acesso);
  expect(leituraInicial).toContainEqual(expect.objectContaining({ mensagemId: ingresso.reciboId,
    patientId: CONTEXTO_A.patientId, estadoVinculo: "VINCULADO", texto: "Relato sintético: não houve febre." }));
  expect(revisaoContextoCanal(a.db, CONTEXTO_A)).toEqual(expect.any(String));
  expect(cadastrosCanal(a.db)).toContainEqual(expect.objectContaining({ patientId: CONTEXTO_A.patientId,
    identificadores: [{ tipo: "TELEFONE", valor: SENDER }] }));

  a.seed(CONTEXTO_B, "Paciente", paciente(CONTEXTO_B.patientId, "Paciente B sintético"));
  a.seed(CONTEXTO_B, "ReviewDecision", { kind: "VinculoContato", contatoId: "contato-alias-sintetico",
    sourceEventId: contatoAId, patientId: CONTEXTO_B.patientId, encounterId: CONTEXTO_B.encounterId, tumorLotId: null });
  const aposTransferencia = lerMensagensOperacionaisCanal(a.db, acesso);
  expect(aposTransferencia[0]).toMatchObject({ patientId: null });
  expect(aposTransferencia[0]?.estadoVinculo).not.toBe("VINCULADO");

  a.seed(CONTEXTO_A, "Contato", contato(CONTEXTO_A.patientId, EM), contatoAId);
  const aposRevogacao = lerMensagensOperacionaisCanal(a.db, acesso);
  expect(aposRevogacao[0]).toMatchObject({ patientId: null, estadoVinculo: "REVOGADO" });
  expect(cadastroAId).toBeTruthy();
});

it("não aceita identidade de Paciente@1 divergente do patientId do evento", () => {
  const a = abrir();
  a.seed(CONTEXTO_A, "Paciente@1", paciente(CONTEXTO_B.patientId, "Nome B sintético"));
  expect(cadastrosCanal(a.db)).toEqual([]);
  expect(carregarDicionarioPacienteDoLedger(a.db, CONTEXTO_A.patientId, SENDER)).toBeNull();
  expect(revisaoContextoCanal(a.db, CONTEXTO_A)).toBeNull();
  expect(lerPaciente(a.db, CONTEXTO_A.patientId)).toBeNull();
  expect(lerConsulta(a.db, CONTEXTO_A.patientId, EM, a.sessoes.obter(a.token)!, null,
    { encounterId: CONTEXTO_A.encounterId })).toMatchObject({ codigo: "PACIENTE_NAO_ENCONTRADO" });
});

it("oferece Paciente@1 válido como candidato de vínculo para mensagem legada ainda sem paciente", () => {
  const a = abrir();
  a.seed(CONTEXTO_A, "Paciente@1", paciente(CONTEXTO_A.patientId, "Paciente alias sintetico"));
  a.seed(CONTEXTO_A, "Contato", contato(null));
  a.seed(CONTEXTO_A, "CanalMessage", { mensagemId: "mensagem-legada-alias",
    contatoId: "contato-alias-sintetico", patientId: null, texto: "Relato sintético sem vínculo.",
    em: EM, redFlag: false });
  expect(lerCanal(a.db).mensagens).toContainEqual(expect.objectContaining({
    mensagemId: "mensagem-legada-alias", patientId: null, estadoVinculo: "SEM_VINCULO",
    candidatos: [{ patientId: CONTEXTO_A.patientId, nome: "Paciente alias sintetico" }],
  }));
});

it("Task010: Paciente@1 chega a agenda e consulta HTTP com relato vinculado literal", async () => {
  const a = abrir();
  a.seed(CONTEXTO_A, "Paciente@1", paciente(CONTEXTO_A.patientId, "Paciente alias sintetico"));
  const contatoId = a.seed(CONTEXTO_A, "Contato", contato(CONTEXTO_A.patientId));
  a.seed(CONTEXTO_A, "AgendaEntry", { patientId: CONTEXTO_A.patientId, encounterId: CONTEXTO_A.encounterId,
    data: "2026-10-20", horario: "09:00" });
  const texto = "Relato sintetico literal: nao tive febre.";
  expect(receberTransporteSintetico(a.db, { accountId: "conta-alias-http", canal: "WHATSAPP_SERVICO",
    providerMessageId: "relato-alias-http", senderRef: SENDER, providerSentAt: EM, ingestedAt: EM,
    conteudo: { tipo: "TEXT", texto, contentSha256: createHash("sha256").update(texto).digest("hex") },
    cadastros: cadastrosCanal(a.db) }).ok).toBe(true);
  const gateway = criarGateway({ agora: () => EM, auditar: () => {}, store: memoriaIdempotencia(), executores: {} });
  const server = criarServidorLocal({ db: a.db, sessoes: a.sessoes, gateway, agora: () => EM, log: () => {} });
  try {
    await new Promise<void>(resolve => server.listening ? resolve() : server.once("listening", resolve));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("PORTA_AUSENTE");
    const post = (path: string, body: unknown) => fetch(`http://127.0.0.1:${addr.port}${path}`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${a.token}` }, body: JSON.stringify(body),
    });
    const consulta = await post("/consulta/carregar", CONTEXTO_A);
    expect(consulta.status).toBe(200);
    const data = await consulta.json();
    expect(data.cabecalho.paciente.nome).toBe("Paciente alias sintetico");
    expect(data.contatosCanal.mensagens).toContainEqual(expect.objectContaining({ texto, patientId: CONTEXTO_A.patientId, estadoVinculo: "VINCULADO" }));
    a.seed(CONTEXTO_A, "Contato", contato(CONTEXTO_A.patientId, EM), contatoId);
    const consultaRevogada = await post("/consulta/carregar", CONTEXTO_A);
    expect(consultaRevogada.status).toBe(200);
    const aposRevogacao = await consultaRevogada.json();
    expect(aposRevogacao.contatosCanal.mensagens).toEqual([]);
    expect(aposRevogacao.contatosCanal.pendenciasSemAtribuicao).toBe(1);
    expect(ConsultaResposta.parse(aposRevogacao).contatosCanal?.pendenciasSemAtribuicao).toBe(1);
    expect(JSON.stringify(aposRevogacao.contatosCanal)).not.toContain(texto);
    const agenda = await post("/consulta/agenda", {});
    expect(agenda.status).toBe(200);
    expect((await agenda.json()).itens).toContainEqual(expect.objectContaining({ patientId: CONTEXTO_A.patientId, nome: "Paciente alias sintetico" }));
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
