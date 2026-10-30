import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { abrirLedger } from "../../../src/kernel/ledger/db.js";
import { confirmar } from "../../../src/kernel/ledger/writeRouter.js";
import { lerDraft, listarDrafts, listarEventos, salvarDraft } from "../../../src/kernel/comandos/portas.js";
import { criarGerenciadorSessao } from "../../../src/server/sessao.js";
import { criarGateway, memoriaIdempotencia } from "../../../src/kernel/gateway/gateway.js";
import { operarConversa } from "../../../src/server/conversaOncoassist.js";
import { endpointConversaLocal } from "../../../src/kernel/llm/conversaLocal.js";
import { HistoricoConversa, RespostaConversa, type EventoConversa } from "../../../src/contracts/api/conversaOncoassist.js";
import { lerStreamConversa } from "../../../src/ui/api/conversaOncoassist.js";
import { criarBiblioteca, sha256Biblioteca } from "../../../src/kernel/corpus/biblioteca.js";
import { hashConteudoExibido } from "../../../src/server/sessao.js";

const agora = "2026-10-26T12:00:00.000Z";
const contexto = { patientId: "PACIENTE-SINTETICO", encounterId: "ENCONTRO-SINTETICO", tumorLotId: null };
const textoFonte = "SINTETICO: nega febre. Achado incerto, A CONFERIR.";
const fechar: (() => Promise<void> | void)[] = [];
afterEach(async () => { for (const fn of fechar.splice(0).reverse()) await fn(); });
function ambiente() {
  const dir = mkdtempSync(join(tmpdir(), "oa-m123-")), caminho = join(dir, "ledger.sqlite");
  let db = abrirLedger(caminho);
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-sintetico", crm: "CRM-SINTETICO", senha: "senha-sintetica-testes", duracaoMs: 3600000, agora: () => agora });
  const { token, sessao } = sessoes.login("senha-sintetica-testes")!;
  sessoes.selecionarConsulta(token, contexto);
  salvarDraft(db, { draftId: "cadastro", patientId: contexto.patientId, sourceId: "cadastro", rawRef: "local", payload: {}, revision: 0, criadoEm: agora, diagnostics: [] });
  confirmar(db, { ...contexto, sessao, operationId: "op-cadastro", reviewDecisionId: "rev-cadastro", em: agora, registros: [{ draftId: "cadastro", expectedRevision: 0,
    eventId: "cadastro-evento", tipo: "Paciente", revisao: "CONFIRMADO", fontes: [], payload: { patientId: contexto.patientId, nome: "Pessoa SINTETICA", identificadores: [], nascimento: null, sexoCadastral: "F", divergencia: false } }] });
  salvarDraft(db, { draftId: "fonte", patientId: contexto.patientId, sourceId: "fonte-sintetica", rawRef: "local:fonte", revision: 0, criadoEm: agora, diagnostics: [],
    payload: { kind: "EXTRACAO_RASCUNHO", input: { sourceId: "fonte-sintetica", rawTranscript: textoFonte + " OUTRO PACIENTE INERTE" },
      patientLinkReview: { ...contexto, segmentId: "segmento" }, state: { segments: [{ id: "segmento", sourceId: "fonte-sintetica", rawTranscript: textoFonte }, { id: "outro", sourceId: "outro", rawTranscript: "OUTRO PACIENTE INERTE" }] } } });
  const gateway = criarGateway({ store: memoriaIdempotencia(), agora: () => agora, auditar: () => {}, executores: {} });
  const deps = { db, sessoes, gateway, agora: () => agora, log: () => {} };
  fechar.push(() => { db.close(); rmSync(dir, { recursive: true, force: true }); });
  return { deps, token, reabrir() { db.close(); db = abrirLedger(caminho); deps.db = db; },
    post: (rota: string, body: unknown, signal?: AbortSignal, aoEvento?: (e: EventoConversa) => void) => operarConversa(deps, token, "/consulta/assistente/" + rota, body, signal, aoEvento) };
}
const pedido = (operationId = "op-sintetica", modo: "BRIEFING" | "MODELO_LOCAL" = "BRIEFING") => ({ ...contexto, operationId, pergunta: "O que consta na fonte?", fontesIds: ["documento:fonte"], modo });
async function modelo(handler: (res: ServerResponse, body: Record<string, unknown>) => void | Promise<void>) {
  let chamadas = 0;
  const server = createServer(async (req, res) => {
    chamadas++; let raw = ""; for await (const chunk of req) raw += String(chunk);
    await handler(res, JSON.parse(raw));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const a = server.address(); if (!a || typeof a === "string") throw Error("ENDERECO");
  fechar.push(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  return { endpoint: `http://127.0.0.1:${a.port}/v1`, chamadas: () => chamadas };
}
async function configurar(a: ReturnType<typeof ambiente>, endpoint: string) {
  return a.post("configurar", { ...contexto, expectedRevision: 0, preferencias: { formato: "TOPICOS", extensao: "BREVE", incluirBiblioteca: false }, modelo: { endpoint, modelo: "modelo-sintetico" } });
}
const emitir = (res: ServerResponse, content: string) => res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
function fim(res: ServerResponse) { res.end("data: [DONE]\n\n"); }
const respostaModelo = () => JSON.stringify({ texto: "O documento registra negação de febre e incerteza. Proposta para revisão.", citacoes: [{ fonteId: "documento:fonte", trecho: textoFonte }] });

describe("conversa OncoAssist contextual e inerte", () => {
  it("briefing usa apenas segmento vinculado, persiste e reabre sem criar evento clínico", async () => {
    const a = ambiente(), antes = listarEventos(a.deps.db, contexto.patientId).length;
    const h = HistoricoConversa.parse((await a.post("historico", contexto)).body);
    expect(h.fontes).toHaveLength(1); expect(h.fontes[0]!.texto).toBe(textoFonte);
    expect(JSON.stringify(h)).not.toContain("OUTRO PACIENTE INERTE");
    const r = RespostaConversa.parse((await a.post("responder", pedido())).body);
    expect(r.turno.texto).toContain("não é resposta de modelo"); expect(r.turno.assinado).toBe(false);
    expect(listarEventos(a.deps.db, contexto.patientId)).toHaveLength(antes);
    a.reabrir();
    const reaberto = HistoricoConversa.parse((await a.post("historico", contexto)).body);
    expect(reaberto.turnos).toEqual([r.turno]);
    expect(RespostaConversa.parse((await a.post("responder", pedido())).body).codigo).toBe("CONVERSA_REPLAY");
    expect((await a.post("responder", { ...pedido(), pergunta: "Outro pedido" })).status).toBe(409);
  });
  it("recusa contexto divergente e modelo não configurado sem persistir turno", async () => {
    const a = ambiente();
    expect((await a.post("responder", { ...pedido(), patientId: "outro" })).status).toBe(409);
    expect((await a.post("responder", pedido("op", "MODELO_LOCAL"))).body).toEqual({ codigo: "MODELO_LOCAL_NAO_CONFIGURADO" });
    expect(HistoricoConversa.parse((await a.post("historico", contexto)).body).turnos).toEqual([]);
  });
  it("configuração é versionada, local e não aceita endpoint externo/credenciais/redirect", async () => {
    const a = ambiente();
    for (const endpoint of ["https://api.example.com/v1", "http://localhost:123/v1", "http://u:p@127.0.0.1:123/v1", "http://127.0.0.1:123/v1?key=x", "http://127.0.0.1:123/v1#x"])
      expect((await configurar(a, endpoint)).status).toBe(400);
    expect(endpointConversaLocal("http://127.0.0.1:123/v1")).toBe("http://127.0.0.1:123/v1/chat/completions");
    expect((await configurar(a, "http://127.0.0.1:123/v1")).status).toBe(200);
    expect((await configurar(a, "http://127.0.0.1:123/v1")).status).toBe(409);
    a.reabrir(); expect(HistoricoConversa.parse((await a.post("historico", contexto)).body).configuracao.revision).toBe(1);
  });
  it.each(["preferencias", "ator", "kind", "hash"] as const)("configuração malformada mais recente (%s) não reativa modelo anterior", async campo => {
    const a = ambiente();
    const m = await modelo(res => { res.writeHead(200, { "Content-Type": "text/event-stream" }); emitir(res, respostaModelo()); fim(res); });
    expect((await configurar(a, m.endpoint)).status).toBe(200);
    expect((await a.post("configurar", { ...contexto, expectedRevision: 1, preferencias: { formato: "TOPICOS", extensao: "BREVE", incluirBiblioteca: false }, modelo: null })).status).toBe(200);
    const d = listarDrafts(a.deps.db).find(d => d.draftId === `oa-config:${hashConteudoExibido("medico-sintetico")}:2`)!;
    const payload = structuredClone(d.payload) as Record<string, unknown>;
    if (campo === "preferencias") (payload.configuracao as Record<string, unknown>).preferencias = null;
    if (campo === "ator") delete payload.atorId;
    if (campo === "kind") payload.kind = "FORMATO_CORROMPIDO";
    if (campo === "hash") delete payload.contentHash;
    a.deps.db.prepare("UPDATE draft_envelope SET payload=? WHERE draftId=?").run(JSON.stringify(payload), d.draftId);
    a.reabrir();
    const h = await a.post("historico", contexto);
    expect(h).toEqual({ status: 409, body: { codigo: "CONFIGURACAO_INTEGRA_NECESSARIA" } });
    expect(await a.post("responder", pedido("nao-reativar", "MODELO_LOCAL"))).toEqual(h);
    expect(m.chamadas()).toBe(0);
  });
  it("configuração malformada de outro ator não é exposta nem adotada", async () => {
    const a = ambiente();
    salvarDraft(a.deps.db, { draftId: `oa-config:${hashConteudoExibido("outro-medico")}:1`, patientId: null, sourceId: "preferencias-assistente-local", rawRef: "configuracao-local", revision: 0, criadoEm: agora, diagnostics: [],
      payload: { kind: "SINTESE_RASCUNHO", formato: "CONFIG_ONCOASSIST", atorId: "outro-medico", configuracao: { dadoPrivado: "SENTINELA_OUTRO_ATOR" } } });
    const h = HistoricoConversa.parse((await a.post("historico", contexto)).body);
    expect(h.configuracao).toEqual({ revision: 0, preferencias: { formato: "TOPICOS", extensao: "BREVE", incluirBiblioteca: false }, modelo: null });
    expect(JSON.stringify(h)).not.toContain("SENTINELA_OUTRO_ATOR");
  });
  it("modelo local transmite delta real, valida citações e replay não chama novamente", async () => {
    const a = ambiente(), eventos: EventoConversa[] = [];
    const m = await modelo((res, body) => {
      expect(body.stream).toBe(true); expect(JSON.stringify(body)).not.toContain("OUTRO PACIENTE INERTE");
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      const texto = respostaModelo(); emitir(res, texto.slice(0, 60)); emitir(res, texto.slice(60)); fim(res);
    });
    await configurar(a, m.endpoint);
    const r = await a.post("responder-stream", pedido("modelo", "MODELO_LOCAL"), undefined, e => eventos.push(e));
    expect(r.status).toBe(200); expect(eventos.some(e => e.tipo === "delta" && e.texto.length > 0)).toBe(true);
    expect(RespostaConversa.parse(r.body).turno.citacoes[0]!.trecho).toBe(textoFonte);
    await a.post("responder", pedido("modelo", "MODELO_LOCAL")); expect(m.chamadas()).toBe(1);
    expect(listarEventos(a.deps.db, contexto.patientId)).toHaveLength(1);
  });
  it.each(["troca", "fonte", "citacao", "cancelar"])("%s durante execução nunca publica proposta válida", async caso => {
    const a = ambiente(), abort = new AbortController();
    const m = await modelo((res) => {
      if (caso === "troca") a.deps.sessoes.selecionarConsulta(a.token, { ...contexto, encounterId: "outro" });
      if (caso === "fonte") {
        const d = lerDraft(a.deps.db, "fonte")!; salvarDraft(a.deps.db, { ...d, revision: d.revision + 1, payload: { ...d.payload as object, alterado: true } });
      }
      if (caso === "cancelar") abort.abort();
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      emitir(res, caso === "citacao" ? respostaModelo().replace(textoFonte, "trecho inventado") : respostaModelo()); fim(res);
    });
    await configurar(a, m.endpoint);
    const r = await a.post("responder", pedido(caso, "MODELO_LOCAL"), abort.signal);
    expect(r.status).toBe(409);
    a.deps.sessoes.selecionarConsulta(a.token, contexto);
    const h = HistoricoConversa.parse((await a.post("historico", contexto)).body);
    expect(h.turnos).toHaveLength(1); expect(h.turnos[0]!.estado).not.toBe("CONCLUIDA"); expect(h.turnos[0]!.texto).toBe("");
    expect(listarEventos(a.deps.db, contexto.patientId)).toHaveLength(1);
  });
  it("redirect do modelo não alcança outro endereço e resposta adulterada no histórico é recusada", async () => {
    const a = ambiente(); let destino = 0;
    const alvo = await modelo(res => { destino++; res.end(); });
    const m = await modelo(res => { res.writeHead(302, { Location: alvo.endpoint }); res.end(); });
    await configurar(a, m.endpoint);
    expect((await a.post("responder", pedido("redirect", "MODELO_LOCAL"))).status).toBe(409); expect(destino).toBe(0);
    const d = listarDrafts(a.deps.db).find(d => (d.payload as { formato?: string }).formato === "CONVERSA_ONCOASSIST")!;
    const p = structuredClone(d.payload) as { turno: { texto: string } }; p.turno.texto = "ADULTERADO";
    a.deps.db.prepare("UPDATE draft_envelope SET payload=? WHERE draftId=?").run(JSON.stringify(p), d.draftId);
    expect((await a.post("historico", contexto)).status).toBe(409);
  });
  it("cliente rejeita stream sem final e não transforma delta parcial em proposta", async () => {
    const events: EventoConversa[] = [];
    const r = new Response(JSON.stringify({ tipo: "delta", texto: "Parcial", parcialNaoValidado: true }) + "\n", { headers: { "content-type": "application/x-ndjson" } });
    await expect(lerStreamConversa(r, e => events.push(e))).rejects.toThrow("CONVERSA_STREAM_INCOMPLETO");
    expect(events).toEqual([{ tipo: "delta", texto: "Parcial", parcialNaoValidado: true }]);
  });
  it("biblioteca entra só consultável, permanece separada e retirada marca histórico obsoleto", async () => {
    const a = ambiente();
    const lib = criarBiblioteca(a.deps.db, { autorizarCuradoria: () => ({ atorId: "medico-sintetico" }), agora: () => agora, emitir: () => {} });
    const item = (id: string) => ({ schema: "ItemBiblioteca@1", id, versao: "1.0.0", pilar: 1, tipo: "REFERENCIA", titulo: `Referência SINTETICA ${id}`,
      texto: "Conhecimento SINTETICO para teste", aplicabilidade: { tumor: [], histologia: [], estadio: [], biomarcador: [], linha: [] },
      proveniencia: { fonte: "https://example.org/sintetico", trecho: "Conhecimento SINTETICO", publicadoEm: "2026-01-01", recuperadoEm: agora, licenca: "SINTETICA" }, dependencias: [] });
    const bytes = { aprovado: JSON.stringify(item("aprovado")), pendente: JSON.stringify(item("pendente")) };
    const pacote = lib.importarPacote({ schema: "PacoteBiblioteca@1", id: "biblioteca-sintetica", versao: "1.0.0", origem: "CURADOR_LOCAL", classificacao: "PUBLIC", criadoEm: agora,
      itens: Object.entries(bytes).map(([id, data]) => ({ id, versao: "1.0.0", arquivo: id + ".json", sha256: sha256Biblioteca(data) })) }, nome => bytes[nome.replace(".json", "") as keyof typeof bytes]);
    lib.revisarItem(pacote, "aprovado", "CONSULTAVEL"); lib.ativar(pacote);
    const antes = a.deps.db.prepare("SELECT conteudo FROM biblioteca_pacote WHERE id=?").get(pacote)?.conteudo;
    await a.post("configurar", { ...contexto, expectedRevision: 0, preferencias: { formato: "TOPICOS", extensao: "BREVE", incluirBiblioteca: true }, modelo: null });
    const h = HistoricoConversa.parse((await a.post("historico", contexto)).body);
    expect(h.fontes.filter(f => f.tipo === "BIBLIOTECA").map(f => f.id)).toEqual(["biblioteca:aprovado"]);
    const p = { ...pedido("bibliografia"), fontesIds: ["biblioteca:aprovado"] };
    expect((await a.post("responder", p)).status).toBe(200);
    expect(lib.estado(pacote, "pendente")).toBe("RASCUNHO");
    expect(a.deps.db.prepare("SELECT conteudo FROM biblioteca_pacote WHERE id=?").get(pacote)?.conteudo).toBe(antes);
    lib.revisarItem(pacote, "aprovado", "OBSOLETO");
    expect(RespostaConversa.parse((await a.post("responder", p)).body).turno.validadeFontes).toBe("ALTERADAS");
    expect(HistoricoConversa.parse((await a.post("historico", contexto)).body).turnos[0]!.validadeFontes).toBe("ALTERADAS");
    expect(listarEventos(a.deps.db, contexto.patientId)).toHaveLength(1);
  });
  it("reserva pendente pode ser encerrada após reabertura sem reexecutar a mesma operação", async () => {
    const a = ambiente(); let chegou!: () => void, liberar!: () => void;
    const chegada = new Promise<void>(resolve => { chegou = resolve; }), liberacao = new Promise<void>(resolve => { liberar = resolve; });
    const m = await modelo(async res => { chegou(); await liberacao; res.writeHead(200, { "Content-Type": "text/event-stream" }); emitir(res, respostaModelo()); fim(res); });
    await configurar(a, m.endpoint);
    const emCurso = a.post("responder", pedido("reserva", "MODELO_LOCAL"));
    await chegada;
    const duplicada = RespostaConversa.parse((await a.post("responder", pedido("reserva", "MODELO_LOCAL"))).body);
    expect(duplicada.codigo).toBe("CONVERSA_EM_CURSO"); expect(m.chamadas()).toBe(1);
    // Captura exatamente o envelope durável existente antes de receber o modelo.
    const pendente = lerDraft(a.deps.db, duplicada.turno.id)!;
    expect(RespostaConversa.parse((await a.post("cancelar", { ...contexto, turnoId: pendente.draftId })).body).turno.estado).toBe("CANCELADA");
    liberar(); expect((await emCurso).status).toBe(409);
    // Simula o snapshot recuperado de uma queda antes de atualizar o envelope final.
    a.deps.db.prepare("UPDATE draft_envelope SET payload=?,revision=? WHERE draftId=?").run(JSON.stringify(pendente.payload), pendente.revision, pendente.draftId);
    a.reabrir();
    expect(HistoricoConversa.parse((await a.post("historico", contexto)).body).turnos[0]!.estado).toBe("EM_CURSO");
    const cancelada = RespostaConversa.parse((await a.post("cancelar", { ...contexto, turnoId: pendente.draftId })).body);
    expect(cancelada.turno.estado).toBe("CANCELADA");
    expect(RespostaConversa.parse((await a.post("responder", pedido("reserva", "MODELO_LOCAL"))).body).turno.estado).toBe("CANCELADA");
    expect(m.chamadas()).toBe(1);
    expect((await a.post("responder", pedido("nova-tentativa"))).status).toBe(200);
    expect(listarEventos(a.deps.db, contexto.patientId)).toHaveLength(1);
  });
});


it("preserva instantes do servidor com offset na conversa e na reabertura", async () => {
  const a = ambiente();
  a.deps.agora = () => "2026-10-26T09:00:00-03:00";
  const r = await a.post("responder", pedido("offset-sintetico"));
  expect(r.status).toBe(200);
  const turno = RespostaConversa.parse(r.body).turno;
  expect(turno.criadoEm).toBe("2026-10-26T09:00:00-03:00");
  expect(turno.concluidoEm).toBe("2026-10-26T09:00:00-03:00");
  a.reabrir();
  const h = HistoricoConversa.parse((await a.post("historico", contexto)).body);
  expect(h.turnos[0]?.id).toBe(turno.id);
  expect(h.turnos[0]?.estado).toBe("CONCLUIDA");
});
