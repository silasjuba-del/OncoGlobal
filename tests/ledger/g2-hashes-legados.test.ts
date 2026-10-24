// G2 · Caracterização de Hashes Legados e Regimes de Hash entre Camadas (Cenário 5 · OG-002 / D-02 / R-02).
// Base: 52b8f7a04c2e467c5c3b3cb93bc38a7673cc4c93 (codex/estabilizacao-g01-reconciliacao).
import { describe, expect, it } from "vitest";
import { hashPayload, listarEventos, resultadoExistente } from "../../src/kernel/ledger/ledger.js";
import { lerLedgerIntegro } from "../../src/kernel/ledger/leituraIntegra.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { hashCanonico as hashCanonicoRetrato } from "../../src/kernel/projections/retrato/index.js";
import { hashCanonico as hashCanonicoRegras } from "../../src/rules/conteudoCanonico.js";
import { hashConteudoExibido } from "../../src/server/sessao.js";
import {
  criarBancoMemoriaG2,
  inserirOperacaoLegadaDiretoNoSqlite,
  montarConfirmacaoDoVetorLegado,
  sha256Independente,
  VETOR_OPERACAO_LEGADA_G2,
} from "../fixtures/g2-integridade.js";

describe("G2 · Cenário 5: Operação persistida com hash legado independente da função sob teste", () => {
  it("valida que os digests do vetor legado batem com SHA-256 independente sobre bytes UTF-8 literais", () => {
    const v = VETOR_OPERACAO_LEGADA_G2;
    // Prova de não-tautologia (CX-005): o digest esperado é uma constante hexadecimal fixa de 64 chars,
    // conferida contra o SHA-256 dos bytes literais sem chamar hashPayload nem hashCanonico.
    expect(v.payloadHashLiteralEsperado).toBe(
      "42a1bb87e2375d3d3b7be7fd1bc882f5dc72f9a3be8ea5d1044e10ecd83413ae",
    );
    expect(sha256Independente(v.eventosJsonLiteral)).toBe(v.payloadHashLiteralEsperado);
    expect(v.payloadHashLiteralEsperado).not.toBe(v.arrayCanonicoSha256Esperado);
  });

  it("reconhece operação legada persistida no SQLite em replay, leitura íntegra e detecção de conflito", () => {
    const db = criarBancoMemoriaG2();
    try {
      inserirOperacaoLegadaDiretoNoSqlite(db);
      const v = VETOR_OPERACAO_LEGADA_G2;

      // 1) Leitura íntegra (`lerLedgerIntegro` / `listarEventos`) reconstrói o evento legado sem pendências:
      const integridade = lerLedgerIntegro(db, v.patientId);
      expect(integridade.pendenciasIntegridade).toEqual([]);
      expect(integridade.itens).toHaveLength(1);
      expect(integridade.itens[0]?.eventId).toBe(v.eventId);

      // 2) `resultadoExistente` reconhece a operação legada pelo digest literal gravado no banco:
      expect(
        resultadoExistente(db, {
          operationId: v.operationId,
          payloadHash: v.payloadHashLiteralEsperado,
          resultRef: v.eventId,
          criadoEm: v.criadoEm,
        }),
      ).toEqual({
        estado: "REPLAY",
        resultRef: v.eventId,
      });

      // 3) `confirmar` com a mesma estrutura e ordem de chaves do registro legado retorna REPLAY:
      const reqIdentica = montarConfirmacaoDoVetorLegado();
      expect(confirmar(db, reqIdentica)).toEqual({
        estado: "REPLAY",
        resultRef: v.eventId,
      });
      expect(listarEventos(db, v.patientId)).toHaveLength(1);

      // 4) Caracterização OG-002 / R-02:
      // Se o mesmo payload de dados `{ zCampoOrdemLegada: 2, aCampoOrdemLegada: 1, campo: "creatinina", valor: 1.2 }`
      // for reenviado com as chaves reordenadas (`aCampoOrdemLegada` antes de `zCampoOrdemLegada`),
      // `hashCanonicoRegras` produz o MESMO hash canônico, mas `writeRouter.confirmar` hoje usa `hashPayload` (`JSON.stringify`)
      // e por isso rejeita a operação legada com `OPERATION_HASH_CONFLICT`!
      const payloadChavesReordenadas = {
        aCampoOrdemLegada: 1,
        campo: "creatinina",
        valor: 1.2,
        zCampoOrdemLegada: 2,
      };
      expect(hashCanonicoRegras(payloadChavesReordenadas)).toBe(hashCanonicoRegras(v.payloadData));

      const reqReordenada = montarConfirmacaoDoVetorLegado({ payloadData: payloadChavesReordenadas });
      expect(confirmar(db, reqReordenada)).toEqual({
        estado: "NEGADA",
        resultRef: null,
        motivo: "OPERATION_HASH_CONFLICT",
      });
      expect(listarEventos(db, v.patientId)).toHaveLength(1);
    } finally {
      db.close();
    }
  });
});

describe("G2 · Caracterização dos 3 regimes de hash existentes (OG-002 / D-02 / OG-010)", () => {
  it("compara hashPayload (ledger), hashCanonico (rules/sessao) e hashCanonico (projections/retrato)", () => {
    const v = VETOR_OPERACAO_LEGADA_G2;
    const eventoLegadoParseado = JSON.parse(v.eventosJsonLiteral) as unknown[];

    // 1) `hashPayload` (`src/kernel/ledger/ledger.ts:10`) usa `JSON.stringify` cru (dependente da ordem das chaves):
    expect(hashPayload(eventoLegadoParseado)).toBe(v.payloadHashLiteralEsperado);

    // 2) `hashCanonicoRegras` (`src/rules/conteudoCanonico.ts`) e `hashConteudoExibido` (`src/server/sessao.ts`)
    // ordenam as chaves de todos os objetos recursivamente:
    expect(hashCanonicoRegras(eventoLegadoParseado)).toBe(v.arrayCanonicoSha256Esperado);
    expect(hashConteudoExibido(eventoLegadoParseado)).toBe(v.arrayCanonicoSha256Esperado);
    expect(hashCanonicoRegras(eventoLegadoParseado[0])).toBe(v.eventoCanonicoSha256Esperado);

    // 3) `hashCanonicoRetrato` (`src/kernel/projections/retrato/index.ts:22`) coincide com `hashCanonicoRegras`
    // para JSON puro (objetos planos, arrays, strings, números finitos, booleanos e null):
    expect(hashCanonicoRetrato(eventoLegadoParseado)).toBe(v.arrayCanonicoSha256Esperado);
    expect(hashCanonicoRetrato(eventoLegadoParseado[0])).toBe(v.eventoCanonicoSha256Esperado);

    // 4) Divergências de borda entre `hashCanonicoRegras` e `hashCanonicoRetrato`:
    // - `undefined` explícito em objeto: `conteudoCanonico.ts` serializa como `"null"`, enquanto `retrato/index.ts` lança `CONTEUDO_NAO_CANONICO`.
    expect(hashCanonicoRegras({ chave: undefined })).toBe(hashCanonicoRegras({ chave: null }));
    expect(() => hashCanonicoRetrato({ chave: undefined })).toThrow("CONTEUDO_NAO_CANONICO");

    // - `Date`: `conteudoCanonico.ts` serializa `Date` válido como ISO UTC (e lança `DATA_CANONICA_INVALIDA` para Date inválida),
    //   enquanto `retrato/index.ts` rejeita `Date` porque `Object.getPrototypeOf(valor) !== Object.prototype`.
    const instanteDate = new Date("2026-10-10T10:00:00.000Z");
    expect(hashCanonicoRegras(instanteDate)).toBe(hashCanonicoRegras("2026-10-10T10:00:00.000Z"));
    expect(() => hashCanonicoRetrato(instanteDate)).toThrow("CONTEUDO_NAO_CANONICO");

    // - `BigInt`: `conteudoCanonico.ts` serializa `10n` como `"10"`, enquanto `retrato/index.ts` lança `CONTEUDO_NAO_CANONICO`.
    expect(hashCanonicoRegras(10n)).toBe(hashCanonicoRegras("10"));
    expect(() => hashCanonicoRetrato(10n)).toThrow("CONTEUDO_NAO_CANONICO");
  });
});
