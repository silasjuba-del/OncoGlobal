import { describe, expect, it } from "vitest";
import {
  CapabilityStatus, ClasseRisco, DeltaDirecao, DeltaKind, Destino, EstadoApac, EstadoArtefato,
  EstadoConversa, EstadoFarmacia, EstadoRun, FinalidadeApac, IntencaoCx, IntencaoQtRt,
  NaturezaAlerta, Revisao, Semaforo, StatusCampo,
} from "../../src/contracts/estados.js";

const igualSemOrdem = (real: readonly string[], normativo: readonly string[]): boolean =>
  real.length === normativo.length && normativo.every((valor) => new Set(real).has(valor));

const DIMENSOES = [
  ["D1 Semáforo", Semaforo, ["VERDE", "VERMELHO", "PENDENTE"]],
  ["D2 Revisão", Revisao, ["RAW", "INFERIDO", "REVISAR", "CONFIRMADO", "ASSINADO"]],
  ["D3 Status do campo", StatusCampo, ["PRESENTE", "AUSENTE", "NAO_SE_APLICA", "NAO_INFORMADO", "CONFLITO"]],
  ["D4 Destino", Destino, ["SALAO", "FILA_MEDICO", "FRENTE"]],
  ["D5 APAC", EstadoApac, ["RASCUNHO", "EMITIDA", "AUTORIZADA", "NEGADA", "VENCIDA"]],
  ["D6 Artefato", EstadoArtefato, ["PRONTO", "EM_REVISAO", "BLOQUEADO"]],
  // K-17 da Parte 0.3 prevalece sobre a enumeração herdada de R-09: direção é DeltaDirecao.
  ["D7 Delta", DeltaKind, ["NOVO", "MUDOU", "PERSISTE", "RESOLVEU"]],
  ["D8 Conversa", EstadoConversa, ["NOVA", "TRIADA", "AGUARDA_MEDICO", "RESPONDIDA", "ENCERRADA"]],
  ["D9 Farmácia", EstadoFarmacia, ["ENVIADA", "CONFERIDA", "CORRECAO_PEDIDA", "ACEITA"]],
  ["D10 Capacidade", CapabilityStatus, ["SPECIFIED", "TESTED", "VALIDATED", "OPERATING", "DISABLED"]],
  ["D11 Run", EstadoRun, ["RECEBIDO", "EM_CURSO", "PRONTO", "CONCLUIDO", "FALHOU"]],
] as const;

describe("R-09 · limites de dimensões e classificações", () => {
  it("mantém a tabela normativa completa, teto de cinco e rejeição fora do enum", () => {
    for (const [dimensao, schema, esperado] of DIMENSOES) {
      expect(igualSemOrdem(schema.options, esperado), dimensao).toBe(true);
      expect(schema.options.length, dimensao).toBeLessThanOrEqual(5);
      expect(schema.safeParse("FORA_DO_ENUM").success, dimensao).toBe(false);
      for (const valor of esperado) expect(schema.safeParse(valor).success, `${dimensao}: ${valor}`).toBe(true);
    }
    expect(DeltaDirecao.safeParse("MELHOR").success).toBe(true);
    expect(DeltaDirecao.safeParse("PIOR").success).toBe(true);
    expect(DeltaKind.safeParse("MELHOROU").success).toBe(false);
    expect(DeltaKind.safeParse("PIOROU").success).toBe(false);
  });

  it("mantém as quatro famílias normativas de classificação e seus rótulos", () => {
    const familias = [
      ["Intenção clínica", [IntencaoQtRt, ["DEFINITIVA", "NEOADJUVANTE", "ADJUVANTE", "PALIATIVA"]],
        [IntencaoCx, ["CURATIVA", "PALIATIVA", "HIGIENICA", "CITORREDUTORA"]]],
      ["Classe de risco", [ClasseRisco, ["ABSOLUTA", "RELATIVA", "MODIFICADOR", "MONITORAMENTO"]]],
      ["Natureza do alerta", [NaturezaAlerta, ["AMEACA_IMEDIATA", "REVISAO_URGENTE", "ALERTA_ONCO", "MUDANCA_RESPOSTA"]]],
      // Finalidade APAC é uma família de classificação com cinco rótulos no vocabulário externo.
      ["Finalidade APAC", [FinalidadeApac, ["PREVIA", "ADJUVANTE", "CURATIVA", "CONTROLE_TEMPORARIO", "PALIATIVA"]]],
    ] as const;
    expect(familias).toHaveLength(4);
    for (const [nome, ...schemas] of familias) {
      for (const [schema, esperados] of schemas) {
        expect(igualSemOrdem(schema.options, esperados), nome).toBe(true);
        expect(schema.safeParse("FORA_DA_CLASSIFICACAO").success, nome).toBe(false);
      }
    }
  });
});
