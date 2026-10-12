import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { criarGateway, memoriaIdempotencia, autorizarLeitura, type EvidenciaSaidaExterna } from "../../../src/kernel/gateway/gateway.js";
import { sanitizarArtefato } from "../../../src/kernel/llm/sanitizador.js";
const agora = "2026-10-12T12:00:00Z";
const sessao = { medicoId: "m", crm: "CRM", emitidaEm: agora, expiraEm: "2026-10-13T12:00:00Z" };
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const intent = { verbo: "ENVIAR_EMAIL", objeto: { tipo: "DOCUMENTO", id: "doc", versao: 1 },
  escopo: { patientId: "p", encounterId: "e" }, destino: null, idempotencyKey: "egress-000001" };
function evidencia(): EvidenciaSaidaExterna {
  const payload = "Documento sanitizado sintético"; const destino = "destino-sintetico";
  return { payload, destinoCanonico: destino, artefato: { id: "doc", versao: 1, hash: "sourcehash", tipo: "TEXTO", metadados: {} },
    dicionarioPaciente: { nomes: ["Nome Sintetico"], identificadores: [] },
    sanitizationReport: { riscoResidual: "BAIXO", versaoSanitizador: "1", payloadHash: hash(payload), destinoHash: hash(destino) },
    autorizacao: { patientId: "p", encounterId: "e", artefatoId: "doc", versao: 1, artefatoHash: "sourcehash",
      payloadHash: hash(payload), destinoHash: hash(destino), vigente: true } };
}
describe("S11 egress com prova positiva de limpeza", () => {
  it("PDF sem detector não recebe risco baixo apesar da remoção dos metadados", () => {
    const bytes = new Uint8Array(Buffer.from("%PDF-1.4\n<< /Author (Nome Sintetico) >>\nstream\nNome Sintetico na página\nendstream\n%%EOF"));
    const r = sanitizarArtefato({ artefatoId: "pdf", tipo: "PDF", bytes });
    expect(r.report.riscoResidual).toBe("ALTO");
    expect(Buffer.from(r.bytes!).toString()).toContain("Nome Sintetico na página");
    expect(r.bytes!.length).toBe(bytes.length);
  });
  it("detector falhando mantém ALTO em PDF e texto", () => {
    const detectorPhi = () => { throw Error("falha"); };
    expect(sanitizarArtefato({ artefatoId: "t", tipo: "TEXTO", texto: "x", detectorPhi }).report.riscoResidual).toBe("ALTO");
    expect(sanitizarArtefato({ artefatoId: "p", tipo: "PDF", bytes: new Uint8Array(Buffer.from("%PDF-1.4\n%%EOF")), detectorPhi }).report.riscoResidual).toBe("ALTO");
  });
  it.each(["dicionarioVazio", "nomesVazios", "fonteMudou", "payloadMudou", "destinoMudou", "riscoIncerto"])("nega %s sem chamar executor", async ataque => {
    const e = evidencia();
    if (ataque === "dicionarioVazio") e.dicionarioPaciente = { nomes: [], identificadores: [] };
    if (ataque === "nomesVazios") e.dicionarioPaciente = { nomes: [" "], identificadores: [] };
    if (ataque === "fonteMudou") e.artefato.hash = "nova-fonte";
    if (ataque === "payloadMudou") e.payload += "alterado";
    if (ataque === "destinoMudou") e.destinoCanonico += "/alterado";
    if (ataque === "riscoIncerto") e.sanitizationReport.riscoResidual = "INCERTO";
    const executar = vi.fn(async () => ({ ok: true as const, recibo: "r" }));
    const g = criarGateway({ executores: { ENVIAR_EMAIL: { executar } }, store: memoriaIdempotencia(), agora: () => agora,
      auditar: () => {}, validarSaida: () => ({ ok: true, evidencia: e }) });
    expect((await g.executar(intent, sessao)).decisao).toBe("NEGADA"); expect(executar).not.toHaveBeenCalled();
  });
  it("impressão local continua operacional sem egress ou dicionário", async () => {
    const executar = vi.fn(async () => ({ ok: true as const, recibo: "r" }));
    const g = criarGateway({ executores: { IMPRIMIR: { executar } }, store: memoriaIdempotencia(), agora: () => agora, auditar: () => {} });
    expect((await g.executar({ ...intent, verbo: "IMPRIMIR" }, sessao)).decisao).toBe("EXECUTADA"); expect(executar).toHaveBeenCalledOnce();
  });
  it("leitura externa não aceita dicionário vazio como atestado", () => {
    const r = autorizarLeitura({ fonteId: "pubmed", consulta: "oncologia", dicionarioPaciente: { nomes: [], identificadores: [] } }, sessao,
      { conexoesExternasHabilitadas: true, fontesPermitidas: ["pubmed"] }, agora);
    expect(r.decisao).toBe("NEGADA"); expect(r.motivoCodigo).toBe("G02_DICIONARIO_AUSENTE");
  });
});
