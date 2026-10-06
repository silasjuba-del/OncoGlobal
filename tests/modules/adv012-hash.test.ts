import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashCanonico } from "../../src/modules/tipos.js";

const sha256 = (texto: string) => createHash("sha256").update(texto, "utf8").digest("hex");

describe("ADV-012 · hash canônico SHA-256 dos módulos", () => {
  it("ADV-012 · objeto com chaves fora de ordem gera SHA-256 do JSON canônico", () => {
    const a = { b: 1, a: { d: true, c: "ação sintética" }, arr: [2, "y", null] };
    const b = { arr: [2, "y", null], a: { c: "ação sintética", d: true }, b: 1 };
    const esperado = sha256('{"a":{"c":"ação sintética","d":true},"arr":[2,"y",null],"b":1}');
    expect(hashCanonico(a)).toBe(esperado);
    expect(hashCanonico(b)).toBe(esperado);
    expect(hashCanonico(a)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ADV-012 · conteúdo diferente muda o hash; array preserva ordem", () => {
    expect(hashCanonico({ texto: "sintético 1" })).not.toBe(hashCanonico({ texto: "sintético 2" }));
    expect(hashCanonico([1, 2])).toBe(sha256("[1,2]"));
    expect(hashCanonico([2, 1])).toBe(sha256("[2,1]"));
  });

  it("contrato atual preservado para valores não JSON-estritos", () => {
    expect(hashCanonico({ ausente: undefined })).toBe(sha256('{"ausente":null}'));
    expect(hashCanonico([undefined])).toBe(sha256("[null]"));
    expect(hashCanonico(10n)).toBe(sha256('"10"'));
    expect(hashCanonico(Number.NaN)).toBe(sha256("null"));
    expect(hashCanonico(Number.POSITIVE_INFINITY)).toBe(sha256("null"));
    expect(hashCanonico({ "10": "dez", "2": "dois" })).toBe(sha256('{"10":"dez","2":"dois"}'));
  });
});
