import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { criarGateway, memoriaIdempotencia, type EvidenciaExtracaoLlm, type Verbo } from "../../../src/kernel/gateway/gateway.js";
import { instrucoesExtracaoOpenAi, schemaExtracaoOpenAi } from "../../../src/kernel/llm/openai/index.js";
const agora = "2026-10-12T12:00:00Z";
const sessao = { medicoId: "m", crm: "CRM", emitidaEm: agora, expiraEm: "2026-10-13T12:00:00Z" };
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const intent = { verbo: "LLM_EXTRACAO", objeto: { tipo: "FONTE", id: "upload", versao: 1 }, escopo: { patientId: "p", encounterId: "e" }, destino: null, idempotencyKey: "extracao-000001" };
function prova(): EvidenciaExtracaoLlm {
  const payload = JSON.stringify({ model: "modelo-sintetico", store: false, tools: [], instructions: instrucoesExtracaoOpenAi,
    input: [{ role: "user", content: [{ type: "input_text", text: "Creatinina 1,2" }] }], text: { format: { type: "json_schema", strict: true, name: "f1_extracao", schema: schemaExtracaoOpenAi() } } });
  return { modo: "DESIDENTIFICADO", origem: "UPLOAD_LOCAL_EXPLICITO", destino: "https://api.openai.com/v1/responses", modelo: "modelo-sintetico", store: false,
    revisaoObrigatoria: true, fonte: { id: "upload", versao: 1, hash: hash("fonte") }, payload, dicionarioPaciente: { nomes: ["Paciente Sintetico"], identificadores: [] },
    sanitizationReport: { riscoResidual: "BAIXO", versaoSanitizador: "1", payloadHash: hash(payload), sourceHash: hash("fonte") },
    autorizacao: { patientId: "p", encounterId: "e", sourceId: "upload", sourceVersion: 1, sourceHash: hash("fonte"), payloadHash: hash(payload), vigente: true, escopo: "EXTRACAO_RASCUNHO" } };
}
function gateway(p: EvidenciaExtracaoLlm | null) {
  const executar = vi.fn(async (_i: unknown, _e: unknown, provaLlm?: EvidenciaExtracaoLlm) => {
    expect(provaLlm?.modo).toBe("DESIDENTIFICADO"); expect(Object.isFrozen(provaLlm)).toBe(true);
    return { ok: true as const, recibo: "Paciente Sintetico" };
  });
  return { executar, g: criarGateway({ executores: { ["LLM_EXTRACAO" as Verbo]: { executar } }, store: memoriaIdempotencia(), agora: () => agora, auditar: () => {},
    ...(p ? { validarExtracaoLlm: () => ({ ok: true as const, evidencia: p }) } : {}) }) };
}
describe("S11 prova server-only separada para extração LLM", () => {
  it("executa desidentificado com prova congelada e recibo opaco", async () => {
    const { g, executar } = gateway(prova()); const r = await g.executar(intent, sessao);
    expect(r.decisao).toBe("EXECUTADA"); expect(r.recibo).not.toContain("Paciente Sintetico"); expect(executar).toHaveBeenCalledOnce();
  });
  it("booleano e prova no payload HTTP não criam autoridade", async () => {
    const { g, executar } = gateway(null);
    expect((await g.executar({ ...intent, autorizadoServidor: true, evidencia: prova() }, sessao)).decisao).toBe("NEGADA");
    expect((await g.executar(intent, sessao)).decisao).toBe("NEGADA"); expect(executar).not.toHaveBeenCalled();
  });
  it.each(["paciente", "encontro", "fonte", "versao", "hashFonte", "payload", "dictVazio", "original", "genspark", "store"])("nega %s sem chamar executor", async ataque => {
    const p = prova();
    if (ataque === "paciente") p.autorizacao.patientId = "outro";
    if (ataque === "encontro") p.autorizacao.encounterId = "outro";
    if (ataque === "fonte") p.fonte.id = "outra";
    if (ataque === "versao") p.fonte.versao++;
    if (ataque === "hashFonte") p.fonte.hash = hash("outra");
    if (ataque === "payload") p.payload += " ";
    if (ataque === "dictVazio") p.dicionarioPaciente.nomes = [];
    if (ataque === "original") Object.assign(p, { modo: "DOCUMENTO_ORIGINAL_D_W9_66" });
    if (ataque === "genspark") Object.assign(p, { destino: "https://genspark.ai" });
    if (ataque === "store") Object.assign(p, { store: true });
    const { g, executar } = gateway(p); const r = await g.executar(intent, sessao);
    expect(r.decisao).toBe("NEGADA"); expect(executar).not.toHaveBeenCalled();
    if (ataque === "original") expect(r.motivoCodigo).toBe("D_W9_66_DOCUMENTO_ORIGINAL_INDISPONIVEL");
  });
  it.each(["input_file", "input_image", "previous_response_id", "tool"])("recusa conteúdo extra %s mesmo com hashes recalculados", async ataque => {
    const p = prova(); const body = JSON.parse(p.payload);
    if (ataque === "previous_response_id") body.previous_response_id = "estado-remoto";
    else if (ataque === "tool") body.tools.push({ type: "web_search" });
    else body.input[0].content[0].type = ataque;
    p.payload = JSON.stringify(body); p.autorizacao.payloadHash = p.sanitizationReport.payloadHash = hash(p.payload);
    const { g, executar } = gateway(p); expect((await g.executar(intent, sessao)).decisao).toBe("NEGADA"); expect(executar).not.toHaveBeenCalled();
  });
});
