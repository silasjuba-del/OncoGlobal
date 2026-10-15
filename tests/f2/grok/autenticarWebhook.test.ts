import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { LIMITE_BYTES_CORPO_WEBHOOK, autenticarWebhookHmac } from "../../../src/modules/canal/autenticarWebhook.js";
import { autenticarEntradaWebhook } from "../../../src/server/canalEntrada.js";

const EM = "2026-10-15T12:00:00.000Z";
const SEGREDO = "segredo-de-teste";
const CHAVE = "chave-servico-1";

function assinar(bytes: Uint8Array, segredo: string = SEGREDO): string {
  return `sha256=${createHmac("sha256", segredo).update(bytes).digest("hex")}`;
}

function utf8(texto: string): Uint8Array {
  return new TextEncoder().encode(texto);
}

function pedido(bytes: Uint8Array, assinatura: string | null, extra: Partial<{ segredo: string; keyId: string; verificadoEm: string }> = {}) {
  return {
    bytes, assinatura, segredo: extra.segredo ?? SEGREDO, keyId: extra.keyId ?? CHAVE,
    verificadoEm: extra.verificadoEm ?? EM,
  };
}

describe("F2 · HMAC do webhook sobre os bytes crus", () => {
  it("aceita a assinatura dos bytes originais e devolve a prova sem persistir", () => {
    const bytes = utf8("{\"texto\":\"Relato sintetico.\"}");
    const resultado = autenticarWebhookHmac(pedido(bytes, assinar(bytes)));
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.persistida).toBe(false);
    expect(resultado.prova).toEqual({
      metodo: "WEBHOOK_HMAC_SHA256", verificada: true, keyId: CHAVE,
      payloadSha256: createHash("sha256").update(bytes).digest("hex"), verificadoEm: EM,
    });
    expect(resultado.bytes).toEqual(bytes);
    expect(resultado.bytes).not.toBe(bytes);
    expect(JSON.stringify(resultado)).not.toContain(SEGREDO);
  });

  it("recusa o mesmo objeto reescrito com outros bytes", () => {
    const original = utf8("{\"texto\":\"Relato sintetico.\"}");
    const reescrito = utf8("{\"texto\": \"Relato sintetico.\"}");
    expect(autenticarWebhookHmac(pedido(reescrito, assinar(original))).ok).toBe(false);
    expect(autenticarWebhookHmac(pedido(reescrito, assinar(original)))).toEqual({ ok: false, codigo: "ASSINATURA_INVALIDA" });
  });

  it("recusa assinatura ausente, vazia, sha1 e digest trocado sem ler o JSON", () => {
    const malformado = utf8("{");
    expect(autenticarWebhookHmac(pedido(malformado, null))).toEqual({ ok: false, codigo: "ASSINATURA_AUSENTE" });
    expect(autenticarWebhookHmac(pedido(malformado, "   "))).toEqual({ ok: false, codigo: "ASSINATURA_AUSENTE" });
    expect(autenticarWebhookHmac(pedido(malformado, "sha1=" + "ab".repeat(20)))).toEqual({ ok: false, codigo: "ASSINATURA_INVALIDA" });
    expect(autenticarWebhookHmac(pedido(malformado, assinar(utf8("{\"texto\":\"outro\"}"))))).toEqual({ ok: false, codigo: "ASSINATURA_INVALIDA" });
    expect(autenticarWebhookHmac(pedido(malformado, "sha256=gg" + "ab".repeat(31)))).toEqual({ ok: false, codigo: "ASSINATURA_INVALIDA" });
  });

  it("compara o digest em bytes e aceita hex maiúsculo de 32 bytes", () => {
    const bytes = utf8("{\"texto\":\"ok\"}");
    const maiuscula = assinar(bytes).replace(/sha256=([0-9a-f]+)/, (_, hex: string) => `sha256=${hex.toUpperCase()}`);
    expect(autenticarWebhookHmac(pedido(bytes, maiuscula)).ok).toBe(true);
  });

  it("recusa corpo acima do limite antes de tratar a assinatura como válida", () => {
    const bytes = new Uint8Array(LIMITE_BYTES_CORPO_WEBHOOK + 1);
    const resultado = autenticarWebhookHmac(pedido(bytes, assinar(bytes)));
    expect(resultado).toEqual({
      ok: false, codigo: "TAMANHO_EXCEDIDO", limiteBytes: LIMITE_BYTES_CORPO_WEBHOOK, bytesRecebidos: bytes.byteLength,
    });
  });

  it("recusa JSON inválido, UTF-8 inválido e valor que não é objeto depois do HMAC", () => {
    const quebrado = utf8("{");
    expect(autenticarWebhookHmac(pedido(quebrado, assinar(quebrado)))).toEqual({ ok: false, codigo: "PAYLOAD_MALFORMADO" });
    const binario = Uint8Array.of(0xff, 0xfe);
    expect(autenticarWebhookHmac(pedido(binario, assinar(binario)))).toEqual({ ok: false, codigo: "PAYLOAD_MALFORMADO" });
    const lista = utf8("[{\"texto\":\"ok\"}]");
    expect(autenticarWebhookHmac(pedido(lista, assinar(lista)))).toEqual({ ok: false, codigo: "PAYLOAD_MALFORMADO" });
  });

  it("não promove conta, paciente, aprovação nem classificação alegados pelo remetente", () => {
    for (const corpo of [
      "{\"texto\":\"febre\",\"accountId\":\"conta-forjada\"}",
      "{\"texto\":\"febre\",\"patientId\":\"paciente-1\"}",
      "{\"texto\":\"febre\",\"redFlag\":true}",
      "{\"anexo\":{\"aprovado\":true}}",
      "{\"texto\":\"o relato cita patientId no meio da frase\"}",
    ]) {
      const bytes = utf8(corpo);
      const resultado = autenticarWebhookHmac(pedido(bytes, assinar(bytes)));
      if (corpo.includes("relato cita")) {
        expect(resultado.ok).toBe(true);
      } else {
        expect(resultado.ok).toBe(false);
        if (!resultado.ok) expect(resultado.codigo).toBe("ALEGACAO_REMETENTE");
        expect(JSON.stringify(resultado)).not.toContain("conta-forjada");
        expect(JSON.stringify(resultado)).not.toContain("paciente-1");
      }
    }
  });

  it("rejeita segredo vazio e keyId ou relógio que não vieram da configuração", () => {
    const bytes = utf8("{\"texto\":\"ok\"}");
    expect(autenticarWebhookHmac(pedido(bytes, assinar(bytes, ""), { segredo: "" }))).toEqual({ ok: false, codigo: "SEGREDO_AUSENTE" });
    expect(autenticarWebhookHmac(pedido(bytes, assinar(bytes), { keyId: "  " }))).toEqual({ ok: false, codigo: "CONFIGURACAO_INVALIDA" });
    expect(autenticarWebhookHmac(pedido(bytes, assinar(bytes), { verificadoEm: "ontem" }))).toEqual({ ok: false, codigo: "CONFIGURACAO_INVALIDA" });
  });

  it("na borda HTTP, um único cabeçalho passa e cabeçalhos repetidos não autenticam", () => {
    const bytes = utf8("{\"texto\":\"ok\"}");
    const assinatura = assinar(bytes);
    const base = { bytes, segredo: SEGREDO, keyId: CHAVE, verificadoEm: EM };
    expect(autenticarEntradaWebhook({ ...base, assinatura: [assinatura] }).ok).toBe(true);
    expect(autenticarEntradaWebhook({ ...base, assinatura: undefined })).toEqual({ ok: false, codigo: "ASSINATURA_AUSENTE" });
    expect(autenticarEntradaWebhook({ ...base, assinatura: [assinatura, assinatura] })).toEqual({ ok: false, codigo: "ASSINATURA_INVALIDA" });
  });
});
