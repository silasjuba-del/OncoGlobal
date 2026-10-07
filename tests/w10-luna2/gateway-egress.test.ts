import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  criarGateway, memoriaIdempotencia, type EvidenciaSaidaExterna, type RegistroAuditoria,
} from "../../src/kernel/gateway/gateway.js";
type IntentGateway = Parameters<NonNullable<Parameters<typeof criarGateway>[0]["validarSaida"]>>[0];

const agora = "2026-10-07T12:00:00-03:00";
const sessao = { medicoId: "medico-teste", crm: "CRM-TESTE", emitidaEm: agora, expiraEm: "2026-10-07T20:00:00-03:00" };
const intent = (verbo: "ENVIAR_EMAIL" | "IMPRIMIR" = "ENVIAR_EMAIL", chave = "acao-teste-0001") => ({
  verbo, objeto: { tipo: "DOCUMENTO", id: "documento-teste", versao: 1 },
  escopo: { patientId: "Paciente Teste 07", encounterId: "encontro-teste" },
  destino: null, idempotencyKey: chave,
});
const hash = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const evidencia = (payload = "Relatório clínico sem identificadores", destino = "contato-teste@example.invalid"): EvidenciaSaidaExterna => {
  const payloadHash = hash(payload), destinoHash = hash(destino);
  return {
    payload, destinoCanonico: destino,
    artefato: { id: "documento-teste", versao: 1, hash: "sha256-artefato-teste", tipo: "TEXTO", metadados: {} },
    dicionarioPaciente: { nomes: ["Paciente Teste 07"], identificadores: ["ID-TESTE-07"] },
    sanitizationReport: { riscoResidual: "BAIXO", versaoSanitizador: "teste-1", payloadHash, destinoHash },
    autorizacao: { patientId: "Paciente Teste 07", encounterId: "encontro-teste", artefatoId: "documento-teste",
      versao: 1, artefatoHash: "sha256-artefato-teste", payloadHash, destinoHash, vigente: true },
  };
};

function montar(options: {
  callback?: (intent: IntentGateway) => Promise<{ ok: true; evidencia: EvidenciaSaidaExterna } | { ok: false; codigo?: string }>;
  executor?: (payload?: string) => Promise<{ ok: true; recibo: string } | { ok: false; incerto: boolean; erro: string }>;
} = {}) {
  const auditoria: RegistroAuditoria[] = [];
  let chamadas = 0;
  const gw = criarGateway({
    executores: {
      ENVIAR_EMAIL: { executar: async (_i, e) => { chamadas++; return options.executor
        ? options.executor(e?.payload) : { ok: true, recibo: "recibo-opaco-1" }; } },
      IMPRIMIR: { executar: async () => { chamadas++; return { ok: true, recibo: "recibo-local-1" }; } },
    },
    store: memoriaIdempotencia(), agora: () => agora, auditar: (r) => auditoria.push(r),
    validarSaida: options.callback ?? (() => ({ ok: true, evidencia: evidencia() })),
  });
  return { gw, auditoria, chamadas: () => chamadas };
}

describe("W10-LUNA2 · saída externa governada", () => {
  it.each([
    ["production", "HARD_FORBIDDEN:producao"],
    ["rede_social", "HARD_FORBIDDEN:rede-social-paciente"],
  ])("recusa destino canônico proibido %s mesmo com destino do pedido ausente", async (destino, codigo) => {
    const t = montar({ callback: async () => ({ ok: true, evidencia: evidencia("Conteúdo sintético", destino) }) });
    expect(await t.gw.executar(intent(), sessao)).toMatchObject({ decisao: "NEGADA", motivoCodigo: codigo });
    expect(t.chamadas()).toBe(0);
  });

  it("passa G-02 + G-27 e executa exatamente o payload validado", async () => {
    const payload = "Minuta sintética sem PHI";
    const t = montar({ callback: async () => ({ ok: true, evidencia: evidencia(payload) }) });
    const result = await t.gw.executar(intent(), sessao);
    expect(result.decisao).toBe("EXECUTADA");
    expect(result.recibo).toMatch(/^saida-[0-9a-f-]{36}$/);
    expect(t.chamadas()).toBe(1);
  });

  it("nega sem callback, com PHI no payload, sanitização pendente ou binding alterado", async () => {
    // Força ausência real da porta (o cast só contorna o tipo opcional para adversarial).
    const semPorta = criarGateway({ executores: { ENVIAR_EMAIL: { executar: async () => ({ ok: true, recibo: "x" }) } },
      store: memoriaIdempotencia(), agora: () => agora, auditar: () => {} });
    expect((await semPorta.executar(intent(), sessao)).decisao).toBe("NEGADA");

    const phi = montar({ callback: async () => ({ ok: true, evidencia: evidencia("Paciente Teste 07, conteúdo sintético") }) });
    expect((await phi.gw.executar(intent(), sessao)).motivoCodigo).toBe("GATES_SAIDA_NAO_PASSARAM");

    const risco = evidencia(); risco.sanitizationReport.riscoResidual = "PENDENTE";
    const pendente = montar({ callback: async () => ({ ok: true, evidencia: risco }) });
    expect((await pendente.gw.executar(intent(), sessao)).decisao).toBe("NEGADA");

    const trocado = evidencia(); trocado.autorizacao.versao = 2;
    const mismatch = montar({ callback: async () => ({ ok: true, evidencia: trocado }) });
    expect((await mismatch.gw.executar(intent(), sessao)).decisao).toBe("NEGADA");
    expect([phi, pendente, mismatch].every((x) => x.chamadas() === 0)).toBe(true);
  });

  it("não vaza texto livre de callback, executor, recibo ou tipo do cliente", async () => {
    const callback = montar({ callback: async () => ({ ok: false, codigo: "Paciente Teste 07" }) });
    const denied = await callback.gw.executar({ ...intent(), objeto: { tipo: "Paciente Teste 07", id: "documento-teste", versao: 1 } }, sessao);
    expect(JSON.stringify({ denied, audit: callback.auditoria })).not.toContain("Paciente Teste 07");

    const executor = montar({ executor: async () => ({ ok: false, incerto: false, erro: "Paciente Teste 07" }) });
    const failed = await executor.gw.executar(intent("ENVIAR_EMAIL", "acao-teste-0002"), sessao);
    expect(failed.motivoCodigo).toBe("FALHA_EXECUTOR");
    expect(JSON.stringify({ failed, audit: executor.auditoria })).not.toContain("Paciente Teste 07");

    for (const segredo of ["11987654321", "52998224725", "PacienteTeste07"]) {
      const receipt = montar({ executor: async () => ({ ok: true, recibo: segredo }) });
      const result = await receipt.gw.executar(intent("ENVIAR_EMAIL", `acao-${segredo.length}-0003`), sessao);
      expect(result.decisao).toBe("EXECUTADA");
      expect(result.recibo).not.toContain(segredo);
      expect(JSON.stringify(receipt.auditoria)).not.toContain(segredo);
    }
  });

  it("revalida o contexto antes de replay e preserva uma única execução idempotente", async () => {
    let validacoes = 0, vigente = true;
    const t = montar({ callback: async () => {
      validacoes++;
      return vigente ? { ok: true as const, evidencia: evidencia() } : { ok: false as const, codigo: "ARTEFATO_NAO_ASSINADO" };
    } });
    expect((await t.gw.executar(intent(), sessao)).decisao).toBe("EXECUTADA");
    vigente = false;
    expect((await t.gw.executar(intent(), sessao)).motivoCodigo).toBe("ARTEFATO_NAO_ASSINADO");
    expect(validacoes).toBe(2);
    expect(t.chamadas()).toBe(1);
  });

  it("mantém impressão local compatível sem callback de egress", async () => {
    const caminhoLocal = "C:\\exportacoes\\impressao.pdf";
    const gw = criarGateway({ executores: { IMPRIMIR: { executar: async () => ({ ok: true, recibo: caminhoLocal }) } },
      store: memoriaIdempotencia(), agora: () => agora, auditar: () => {} });
    expect(await gw.executar(intent("IMPRIMIR"), sessao)).toMatchObject({ decisao: "EXECUTADA", recibo: caminhoLocal });
  });

  it("congela a evidência validada e impede o executor de receber mutação posterior do callback", async () => {
    const original = evidencia();
    let payloadExecutado: string | undefined;
    const t = montar({ callback: async () => {
      setTimeout(() => { original.payload = "Paciente Teste 07"; }, 0);
      return { ok: true, evidencia: original };
    }, executor: async (payload) => { payloadExecutado = payload; return { ok: true, recibo: "ignorado" }; } });
    expect((await t.gw.executar(intent(), sessao)).decisao).toBe("EXECUTADA");
    expect(payloadExecutado).toBe("Relatório clínico sem identificadores");
  });

  it("não executa egress quando a auditoria obrigatória falha", async () => {
    let chamadas = 0;
    const gw = criarGateway({ executores: { ENVIAR_EMAIL: { executar: async () => { chamadas++; return { ok: true, recibo: "x" }; } } },
      store: memoriaIdempotencia(), agora: () => agora, auditar: () => { throw new Error("PacienteTeste07"); },
      validarSaida: () => ({ ok: true, evidencia: evidencia() }) });
    const result = await gw.executar(intent(), sessao);
    expect(result).toMatchObject({ decisao: "NEGADA", motivoCodigo: "AUDITORIA_INDISPONIVEL" });
    expect(chamadas).toBe(0);
    expect(JSON.stringify(result)).not.toContain("PacienteTeste07");
  });
});
