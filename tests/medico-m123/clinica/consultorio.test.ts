import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { abrirLedger } from "../../../src/kernel/ledger/db.js";
import { lerEventosComIntegridade } from "../../../src/server/leituras.js";
import type { DatabaseSync } from "node:sqlite";
const listarEventos = (db: DatabaseSync) => lerEventosComIntegridade(db).itens;
import { criarGerenciadorSessao } from "../../../src/server/sessao.js";
import { operarConsultorio } from "../../../src/server/consultorioMedico.js";
import { AgendaMedicaResposta, CadastroPacienteMedicoResposta, NutricaoMedicaResposta, OperacaoAgendaResposta, PreConsultaMedicaResposta,
  type EntradaPreConsultaMedica } from "../../../src/contracts/api/consultorioMedico.js";
import { dadosDoEvento } from "../../../src/kernel/projections/snapshot.js";
import { executarConfirmacao } from "../../../src/kernel/comandos/index.js";
import { salvarDraft } from "../../../src/kernel/comandos/portas.js";
import { hashCanonico } from "../../../src/rules/conteudoCanonico.js";
import type { ServidorDeps } from "../../../src/server/rotas.js";

const limpar: (() => void)[] = [];
afterEach(() => { limpar.splice(0).reverse().forEach(fn => fn()); });
function ambiente() {
  const dir = mkdtempSync(join(tmpdir(), "consultorio-SINTETICO-")), caminho = join(dir, "ledger.sqlite");
  let db = abrirLedger(caminho), agora = "2026-10-26T12:00:00.000Z";
  const sessoes = criarGerenciadorSessao({ medicoId: "MEDICO-SINTETICO", crm: "CRM-SINTETICO", senha: "senha-sintetica-teste", duracaoMs: 86400000, agora: () => agora });
  const token = sessoes.login("senha-sintetica-teste")!.token;
  const deps = { db, sessoes, agora: () => agora, log: () => {} } as unknown as ServidorDeps;
  limpar.push(() => { db.close(); rmSync(dir, { recursive: true, force: true }); });
  const call = (rota: string, raw: unknown, auth = token) => operarConsultorio(deps, auth, rota, raw)!;
  const cadastro = (operationId = "cadastro-sintetico", identificador = "SINT-001") => call("/medico/paciente/cadastrar", { operationId,
    paciente: { nome: "Paciente SINTETICO", nascimento: null, sexoCadastral: "NAO_INFORMADO", identificadores: identificador ? [{ tipo: "PRONTUARIO", valor: identificador }] : [] },
    data: "2026-10-26", horario: "10:30" });
  return { call, cadastro, deps, token, sessoes, get db() { return db; }, tempo: (em: string) => { agora = em; },
    reiniciar: () => { db.close(); db = abrirLedger(caminho); deps.db = db; },
    agenda: () => AgendaMedicaResposta.parse(call("/medico/agenda", { inicio: "2026-10-01", fim: "2026-12-31" }).body),
  };
}
const entrada = (): EntradaPreConsultaMedica => ({ queixa: "SINTETICO: nega febre; achado incerto A CONFERIR", historia: "", antecedentes: "", medicamentos: "",
  alergias: "Não sabe informar", contextoPessoal: "", observacoes: "Relato coletado para revisão", pesoKg: null, alturaCm: null, origemPeso: "NAO_INFORMADO" });

it("cadastro e primeiro encontro são atômicos, idempotentes e têm autoria da sessão", () => {
  const a = ambiente(), primeira = a.cadastro();
  expect(primeira.status).toBe(201);
  const resposta = OperacaoAgendaResposta.parse(primeira.body), eventos = listarEventos(a.db);
  expect(eventos.map(e => e.tipo)).toEqual(["Paciente", "AgendaEntry"]);
  expect(new Set(eventos.map(e => e.operationId)).size).toBe(1);
  expect(eventos.every(e => e.criadoPor.id === "MEDICO-SINTETICO" && e.fontes[0]?.classe === "MANUAL")).toBe(true);
  a.tempo("2026-10-26T13:00:00.000Z");
  expect(a.cadastro().body).toEqual({ ...resposta, codigo: "REPLAY" });
  expect(listarEventos(a.db)).toEqual(eventos);
  expect(a.cadastro("outro-cadastro").status).toBe(409);
  expect(listarEventos(a.db)).toHaveLength(2);
  expect(a.cadastro("homonimo", "SINT-002").status).toBe(201);
  expect(a.agenda().pacientes).toHaveLength(2);
});

it("rejeita sessão inválida, datas inválidas e reuso de chave para outro conteúdo sem órfãos", () => {
  const a = ambiente();
  expect(a.call("/medico/paciente/cadastrar", {}, "invalido").status).toBe(401);
  expect(a.call("/medico/agenda", { inicio: "2026-10-26", fim: "2026-10-01" }).status).toBe(400);
  const primeira = OperacaoAgendaResposta.parse(a.cadastro().body);
  expect(a.call("/medico/agenda/agendar", { operationId: "cadastro-sintetico", patientId: primeira.contexto.patientId, data: "2026-11-01", horario: "09:00" }).status).toBe(409);
  expect(a.call("/medico/agenda/agendar", { operationId: "data-invalida", patientId: primeira.contexto.patientId, data: "2026-02-30", horario: "25:00" }).status).toBe(400);
  expect(listarEventos(a.db)).toHaveLength(2);
});

it("remarca com revisão esperada, cancela sem apagar histórico e reabre o mesmo SQLite", () => {
  const a = ambiente(), original = OperacaoAgendaResposta.parse(a.cadastro().body), contexto = original.contexto;
  const pedido = { ...contexto, tumorLotId: undefined, operationId: "remarcar", expectedEventId: original.eventId, acao: "REMARCAR", motivo: "Pedido SINTETICO", data: "2026-11-02", horario: "14:10" };
  const { tumorLotId: _lote, ...alteracao } = pedido;
  const remarcada = a.call("/medico/agenda/alterar", alteracao);
  expect(remarcada.status).toBe(201);
  expect(a.agenda().itens).toHaveLength(1);
  expect(a.agenda().itens[0]).toMatchObject({ data: "2026-11-02", horario: "14:10", cancelado: false });
  expect(a.call("/medico/agenda/alterar", { ...alteracao, operationId: "concorrente" }).status).toBe(409);
  const eventId = OperacaoAgendaResposta.parse(remarcada.body).eventId;
  expect(a.call("/medico/agenda/alterar", { patientId: contexto.patientId, encounterId: contexto.encounterId, expectedEventId: eventId,
    operationId: "cancelar", acao: "CANCELAR", motivo: "Cancelamento SINTETICO" }).status).toBe(201);
  const antes = listarEventos(a.db); a.reiniciar();
  expect(a.agenda().itens[0]).toMatchObject({ cancelado: true, motivo: "Cancelamento SINTETICO" });
  expect(listarEventos(a.db)).toEqual(antes);
  expect(a.call("/medico/agenda/alterar", alteracao).status).toBe(200);
  expect(a.agenda().itens[0]?.cancelado).toBe(true);
});

it("pré-consulta preserva relato e ausências; só confirmação explícita registra anotação, nunca assinatura", () => {
  const a = ambiente(), { contexto } = OperacaoAgendaResposta.parse(a.cadastro().body);
  const pedido = { contexto, operationId: "pre-1", expectedVersion: 0, entrada: entrada() };
  expect(a.call("/medico/preconsulta/salvar", pedido).status).toBe(409);
  a.sessoes.selecionarConsulta(a.token, contexto);
  const salvo = PreConsultaMedicaResposta.parse(a.call("/medico/preconsulta/salvar", pedido).body);
  expect(salvo.rascunho?.texto).toContain("nega febre; achado incerto A CONFERIR");
  expect(salvo.rascunho?.texto).toContain("História relatada: Não informado");
  expect(listarEventos(a.db)).toHaveLength(2);
  expect(a.call("/medico/preconsulta/salvar", pedido).status).toBe(200);
  expect(a.call("/medico/preconsulta/salvar", { ...pedido, operationId: "concorrente" }).status).toBe(409);
  const confirmar = { contexto, draftId: salvo.rascunho!.draftId, expectedVersion: 1, conteudoHash: salvo.rascunho!.conteudoHash };
  expect(a.call("/medico/preconsulta/confirmar", { ...confirmar, conteudoHash: "a".repeat(64) }).status).toBe(409);
  expect(a.call("/medico/preconsulta/confirmar", confirmar).status).toBe(201);
  const eventos = listarEventos(a.db), nota = eventos.find(e => e.tipo === "AnotacaoEvolucao")!, mensagem = eventos.find(e => e.tipo === "ChatMessage")!;
  expect(dadosDoEvento(nota)?.origemMensagem).toEqual({ eventId: mensagem.eventId, contentHash: hashCanonico(mensagem) });
  expect(eventos.every(e => e.revisao !== "ASSINADO" && e.tipo !== "DOCUMENTO")).toBe(true);
  expect(a.call("/medico/preconsulta/confirmar", confirmar).body).toMatchObject({ codigo: "REPLAY", eventId: nota.eventId });
  expect(listarEventos(a.db)).toHaveLength(4);
  a.reiniciar();
  expect(PreConsultaMedicaResposta.parse(a.call("/medico/preconsulta", contexto).body).rascunho).toMatchObject({ confirmado: true, versao: 1 });
});

it("pré-consulta versionada rejeita confirmação obsoleta e resposta de contexto diferente", () => {
  const a = ambiente(), { contexto } = OperacaoAgendaResposta.parse(a.cadastro().body);
  a.sessoes.selecionarConsulta(a.token, contexto);
  const um = PreConsultaMedicaResposta.parse(a.call("/medico/preconsulta/salvar", { contexto, operationId: "pre-1", expectedVersion: 0, entrada: entrada() }).body).rascunho!;
  expect(a.call("/medico/preconsulta/salvar", { contexto, operationId: "pre-2", expectedVersion: 1, entrada: { ...entrada(), observacoes: "Correção SINTETICA" } }).status).toBe(201);
  expect(a.call("/medico/preconsulta/confirmar", { contexto, draftId: um.draftId, expectedVersion: 1, conteudoHash: um.conteudoHash }).status).toBe(409);
  a.sessoes.selecionarConsulta(a.token, null);
  expect(a.call("/medico/preconsulta", contexto).status).toBe(409);
  expect(listarEventos(a.db)).toHaveLength(2);
});

it("orientação dietética é rascunho médico recuperável, sem conteúdo predefinido nem efeito clínico", () => {
  const a = ambiente(), { contexto } = OperacaoAgendaResposta.parse(a.cadastro().body);
  a.sessoes.selecionarConsulta(a.token, contexto);
  expect(NutricaoMedicaResposta.parse(a.call("/medico/nutricao", contexto).body).rascunho).toBeNull();
  const pedido = { contexto, operationId: "nutricao-1", expectedVersion: 0, texto: "Orientação SINTETICA redigida pelo médico." };
  expect(a.call("/medico/nutricao/salvar", pedido).status).toBe(201);
  expect(a.call("/medico/nutricao/salvar", pedido).status).toBe(200);
  a.reiniciar();
  expect(NutricaoMedicaResposta.parse(a.call("/medico/nutricao", contexto).body).rascunho?.texto).toBe(pedido.texto);
  expect(listarEventos(a.db)).toHaveLength(2);
  expect(a.call("/medico/nutricao/salvar", { ...pedido, assinado: true }).status).toBe(400);
});

it("agendamento de retorno exige ação explícita, usa a tarefa e não a agenda duas vezes", () => {
  const a = ambiente(), { contexto } = OperacaoAgendaResposta.parse(a.cadastro().body), em = a.deps.agora();
  const tarefaId = "retorno-SINTETICO", draft = salvarDraft(a.db, { draftId: tarefaId, patientId: contexto.patientId,
    sourceId: tarefaId, rawRef: tarefaId, payload: {}, diagnostics: [], revision: 0, criadoEm: em });
  const r = executarConfirmacao(a.db, { ...contexto, operationId: tarefaId, reviewDecisionId: `revisao-${tarefaId}`,
    sessao: a.sessoes.obter(a.token)!, em, registros: [{ draftId: draft.draftId, expectedRevision: 0, eventId: tarefaId,
      tipo: "Tarefa", payload: { tarefaId, ...contexto, operationId: tarefaId, titulo: "Retorno SINTETICO", responsavel: "MEDICO-SINTETICO", prazo: null,
        estado: "CONFIRMADA", recebidoEm: null, criadoPor: "MEDICO-SINTETICO", substituiTarefaId: null, dataAlvo: "2026-11-10",
        pedidoRefs: [], retornoRef: { documentId: "documento-retorno-SINTETICO", documentVersion: 1 }, geradaPorEventoId: null, rulesetVersao: null },
      fontes: [], revisao: "CONFIRMADO" }] });
  expect(r.estado).toBe("GRAVADA");
  expect(a.agenda().retornos).toHaveLength(1);
  expect(a.agenda().itens).toHaveLength(1);
  const pedido = { operationId: "agendar-retorno", patientId: contexto.patientId, tarefaRetornoId: tarefaId, data: "2026-11-12", horario: "15:00" };
  expect(a.call("/medico/agenda/agendar", pedido).status).toBe(201);
  expect(a.agenda().retornos).toHaveLength(0);
  expect(a.agenda().itens).toHaveLength(2);
  expect(a.call("/medico/agenda/agendar", pedido).status).toBe(200);
  expect(a.call("/medico/agenda/agendar", { ...pedido, operationId: "outro-retorno" }).status).toBe(409);
  const agendado = OperacaoAgendaResposta.parse(a.call("/medico/agenda/agendar", pedido).body);
  expect(a.call("/medico/agenda/alterar", { patientId: agendado.contexto.patientId, encounterId: agendado.contexto.encounterId,
    operationId: "cancelar-retorno", expectedEventId: agendado.eventId, acao: "CANCELAR", motivo: "Pedido sintetico" }).status).toBe(201);
  expect(a.agenda().retornos).toHaveLength(1);
  expect(a.call("/medico/agenda/agendar", { ...pedido, operationId: "retorno-reagendado" }).status).toBe(201);
  expect(a.agenda().retornos).toHaveLength(0);
  expect(a.agenda().itens).toHaveLength(3);
});

it("recibo adulterado não confirma replay de outra identidade", () => {
  const a = ambiente(); a.cadastro();
  const reciboId = `recibo:consultorio:${hashCanonico("cadastro-sintetico")}`;
  const row = a.db.prepare("SELECT payload FROM draft_envelope WHERE draftId=?").get(reciboId)!;
  const payload = JSON.parse(String(row.payload)); payload.resposta.contexto.patientId = "OUTRO-SINTETICO";
  a.db.prepare("UPDATE draft_envelope SET payload=? WHERE draftId=?").run(JSON.stringify(payload), reciboId);
  expect(a.cadastro().body).toEqual({ codigo: "RECIBO_INTEGRIDADE_INVALIDA" });
  expect(listarEventos(a.db)).toHaveLength(2);
});

it("todos os campos no limite cabem no agregado e reabrem sem truncamento", () => {
  const a = ambiente(), { contexto } = OperacaoAgendaResposta.parse(a.cadastro().body);
  a.sessoes.selecionarConsulta(a.token, contexto);
  const completo = { ...entrada(), ...Object.fromEntries(["queixa","historia","antecedentes","medicamentos","alergias","contextoPessoal","observacoes"].map(k=>[k,"S".repeat(1500)])) };
  const pedido = { contexto, operationId:"pre-limite", expectedVersion:0, entrada:completo };
  const r = a.call("/medico/preconsulta/salvar", pedido);
  expect(r.status).toBe(201);
  const salvo = PreConsultaMedicaResposta.parse(r.body).rascunho!;
  expect(salvo.texto.length).toBeLessThanOrEqual(12000);
  expect(salvo.entrada).toEqual(completo);
  a.reiniciar();
  expect(PreConsultaMedicaResposta.parse(a.call("/medico/preconsulta", contexto).body).rascunho?.entrada).toEqual(completo);
  expect(a.call("/medico/preconsulta/salvar", { ...pedido,operationId:"pre-excessivo",expectedVersion:1,entrada:{...completo,historia:"S".repeat(1501)} }).status).toBe(400);
});

it("corrige cadastro com identidade estável, histórico e replay sem reescrever documento assinado", () => {
  const a = ambiente(), { contexto } = OperacaoAgendaResposta.parse(a.cadastro().body), em = a.deps.agora();
  a.sessoes.selecionarConsulta(a.token, contexto);
  const cadastro = CadastroPacienteMedicoResposta.parse(a.call("/medico/paciente/ler", contexto).body);
  const conteudo = { documentId: "documento-SINTETICO", documentVersion: 1, texto: "Documento SINTETICO: Paciente SINTETICO", patientId: contexto.patientId };
  const assinatura = { documentId: conteudo.documentId, documentVersion: 1, documentHash: hashCanonico(conteudo),
    reviewDecisionId: "review-documento-SINTETICO", serverActorId: "MEDICO-SINTETICO" };
  const draft = salvarDraft(a.db, { draftId: "draft-doc-SINTETICO", patientId: contexto.patientId, sourceId: "fonte-doc-SINTETICO",
    rawRef: "local-SINTETICO", payload: {}, diagnostics: [], revision: 0, criadoEm: em });
  expect(executarConfirmacao(a.db, { ...contexto, operationId: "documento-SINTETICO", reviewDecisionId: assinatura.reviewDecisionId,
    sessao: a.sessoes.obter(a.token)!, em, registros: [{ draftId: draft.draftId, expectedRevision: 0, eventId: "evento-documento-SINTETICO",
      tipo: "DOCUMENTO", payload: { data: conteudo, signature: assinatura }, fontes: [], revisao: "ASSINADO" }] }).estado).toBe("GRAVADA");
  const antes = listarEventos(a.db);
  const { patientId: _id, divergencia: _divergencia, ...dados } = cadastro.paciente;
  const pedido = { contexto, operationId: "corrigir-cadastro-SINTETICO", expectedEventId: cadastro.eventId,
    dados: { ...dados, nome: "Paciente SINTETICO Corrigido", nascimento: "1971-02-03" }, motivo: "Correção documental SINTETICA conferida pelo médico" };
  const r = a.call("/medico/paciente/alterar", pedido);
  expect(r.status).toBe(201);
  const alterado = CadastroPacienteMedicoResposta.parse(r.body);
  expect(alterado.paciente.patientId).toBe(contexto.patientId);
  expect(alterado.paciente.nome).toBe(pedido.dados.nome);
  expect(alterado.historico).toHaveLength(2);
  expect(alterado.historico.find(h => h.eventId === alterado.eventId)).toMatchObject({ anteriorEventId: cadastro.eventId,
    motivo: pedido.motivo, autor: "MEDICO-SINTETICO" });
  expect(listarEventos(a.db).filter(e => antes.some(old => old.eventId === e.eventId))).toEqual(antes);
  expect(a.call("/medico/paciente/alterar", pedido).body).toMatchObject({ codigo: "REPLAY", eventId: alterado.eventId });
  expect(a.agenda().pacientes).toHaveLength(1);
  expect(a.agenda().itens[0]?.nome).toBe(pedido.dados.nome);
  a.reiniciar();
  expect(CadastroPacienteMedicoResposta.parse(a.call("/medico/paciente/ler", contexto).body).historico).toEqual(alterado.historico);
  expect(listarEventos(a.db).find(e => e.eventId === "evento-documento-SINTETICO")).toEqual(antes.find(e => e.eventId === "evento-documento-SINTETICO"));
});

it("correção cadastral recusa revisão antiga, identificador de outro paciente e mudança de identidade", () => {
  const a = ambiente(), { contexto } = OperacaoAgendaResposta.parse(a.cadastro().body);
  a.cadastro("cadastro-B", "SINT-002"); a.sessoes.selecionarConsulta(a.token, contexto);
  const cadastro = CadastroPacienteMedicoResposta.parse(a.call("/medico/paciente/ler", contexto).body);
  const { patientId: _id, divergencia: _divergencia, ...dados } = cadastro.paciente;
  const pedido = { contexto, operationId: "correcao-1", expectedEventId: cadastro.eventId, dados: { ...dados, nome: "Nome SINTETICO Corrigido" }, motivo: "Correção SINTETICA" };
  expect(a.call("/medico/paciente/alterar", { ...pedido, dados: { ...dados, patientId: "INJETADO" } }).status).toBe(400);
  expect(a.call("/medico/paciente/alterar", { ...pedido, dados: { ...dados, identificadores: [{ tipo: "PRONTUARIO", valor: "SINT-002" }] } }).body)
    .toEqual({ codigo: "IDENTIFICADOR_JA_CADASTRADO" });
  expect(a.call("/medico/paciente/alterar", { ...pedido, dados: { ...dados, identificadores: [dados.identificadores[0], dados.identificadores[0]] } }).status).toBe(400);
  expect(a.call("/medico/paciente/alterar", pedido).status).toBe(201);
  expect(a.call("/medico/paciente/alterar", { ...pedido, operationId: "correcao-concorrente" }).body).toEqual({ codigo: "CADASTRO_REVISAO_CONFLITANTE" });
  expect(a.call("/medico/paciente/alterar", { ...pedido, dados: { ...pedido.dados, nome: "Outro conteúdo" } }).body).toEqual({ codigo: "IDEMPOTENCIA_CONFLITO" });
  a.sessoes.selecionarConsulta(a.token, null);
  expect(a.call("/medico/paciente/ler", contexto).status).toBe(409);
  expect(a.call("/medico/paciente/alterar", pedido, "token-invalido").status).toBe(401);
});
