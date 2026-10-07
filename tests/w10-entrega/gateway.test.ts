import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  criarGateway, memoriaIdempotencia, type EvidenciaSaidaExterna,
} from "../../src/kernel/gateway/gateway.js";

const agora = "2026-10-07T12:00:00-03:00";
const sessao = { medicoId: "medico-teste", crm: "CRM-TESTE", emitidaEm: agora, expiraEm: "2026-10-07T20:00:00-03:00" };
const payload = "Relatório sintético sem identificadores";
const destino = "contato-teste@example.invalid";
const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

function evidencia(metadados: Record<string, unknown>): EvidenciaSaidaExterna {
  const payloadHash = hash(payload), destinoHash = hash(destino);
  return {
    payload, destinoCanonico: destino,
    artefato: { id: "documento-teste", versao: 1, hash: "sha256-artefato-teste", tipo: "TEXTO", metadados },
    dicionarioPaciente: { nomes: ["Paciente Teste 07"], identificadores: ["ID-TESTE-07"] },
    sanitizationReport: { riscoResidual: "BAIXO", versaoSanitizador: "teste-1", payloadHash, destinoHash },
    autorizacao: { patientId: "Paciente Teste 07", encounterId: "encontro-teste", artefatoId: "documento-teste",
      versao: 1, artefatoHash: "sha256-artefato-teste", payloadHash, destinoHash, vigente: true },
  };
}

describe("W10 entrega · evidência externa serializável", () => {
  it("nega metadados Map antes do executor, pois G-27 não inspeciona suas entradas", async () => {
    const metadados = new Map([ ["autor", "Paciente Teste 07"] ]) as unknown as Record<string, unknown>;
    let chamadas = 0;
    const gw = criarGateway({
      executores: { ENVIAR_EMAIL: { executar: async () => { chamadas++; return { ok: true, recibo: "x" }; } } },
      store: memoriaIdempotencia(), agora: () => agora, auditar: () => {},
      validarSaida: () => ({ ok: true, evidencia: evidencia(metadados) }),
    });
    const intent = {
      verbo: "ENVIAR_EMAIL",
      objeto: { tipo: "DOCUMENTO", id: "documento-teste", versao: 1 },
      escopo: { patientId: "Paciente Teste 07", encounterId: "encontro-teste" },
      destino: null, idempotencyKey: "map-metadata-0001",
    };

    expect(await gw.executar(intent, sessao)).toMatchObject({
      decisao: "NEGADA", motivoCodigo: "CONTEXTO_SAIDA_INDISPONIVEL",
    });
    expect(chamadas).toBe(0);
  });
});
