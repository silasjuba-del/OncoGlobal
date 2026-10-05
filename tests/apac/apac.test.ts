import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import type { TumorLot } from "../../src/contracts/clinico.js";
import { apacGerar, apacPrazo, apacRetrograda, validarEmissaoApac } from "../../src/rules/apac.js";

const hoje = "2026-10-05";
const finalidadePendente: TumorLot["finalidadeApac"] = {
  valor: null, estado: "PENDENTE", campo: "NAO_INFORMADO",
  motivo: "Não decidido", fontes: [], revisao: "RAW",
};
const lot: TumorLot = {
  tumorLotId: "tumor-1", patientId: "Paciente Teste 01",
  cid: finalidadePendente as never, topografia: finalidadePendente,
  histologia: finalidadePendente, finalidadeApac: finalidadePendente,
  estadiamentos: [], marcos: [],
};
const rx = { apacId: "apac-test", documentId: "rx-1", documentVersion: 1,
  revisao: "ASSINADO" as const, competencia: "2026-10",
  campos: { cid: "SINTETICO", intencao: "PALIATIVA", finalidadeApac: "CURATIVA" } };

it("T-27 só prescrição ASSINADA gera rascunho; data app, finalidade pendente sem mapa", () => {
  expect(() => apacGerar({ ...rx, revisao: "CONFIRMADO" as never }, lot, hoje)).toThrow();
  const draft = apacGerar(rx, lot, hoje);
  expect(draft.estado).toBe("RASCUNHO");
  expect(draft.dataGeracaoApp).toBe(hoje);
  expect(draft.campos.finalidadeApac).toMatchObject({ estado: "PENDENTE", valor: null });
  expect(draft.campos).not.toHaveProperty("intencao");
  expect(draft.campos.cid).toBe("SINTETICO");
});
it("Q33 herda somente finalidade de TumorLot confirmada", () => {
  const source = { sourceId: "manual", classe: "MANUAL" as const, localizador: null,
    dataClinica: null, dataCaptura: "2026-10-05T12:00:00.000Z", versao: "1", contentHash: "hash" };
  const valid: TumorLot = { ...lot, finalidadeApac: { valor: "ADJUVANTE",
    estado: "VERDE", campo: "PRESENTE", motivo: "Escolha humana",
    fontes: [source], revisao: "CONFIRMADO" } };
  expect(apacGerar(rx, valid, hoje).campos.finalidadeApac).toEqual(valid.finalidadeApac);
});
it("T-28/29/N03 valida completude só na emissão; NEGADA e comprovante sobrevivem", () => {
  const draft = apacGerar(rx, lot, hoje);
  expect(validarEmissaoApac(draft, ["cid", "finalidadeApac"])).toMatchObject({
    podeEmitir: false, camposFaltantes: ["finalidadeApac"], documento: "BLOQUEADO" });
  const negada = { ...draft, estado: "NEGADA" as const, resultadoExterno: {
    valor: "NEGADA" as const, comprovanteRef: "comprovante-local-opaco",
    motivo: "ESTADIO_AUSENTE", recebidoEm: "2026-10-06T12:00:00.000Z",
  } };
  expect(validarEmissaoApac(negada, ["cid"]).apac).toEqual(negada);
  expect(validarEmissaoApac(negada, ["cid"]).podeEmitir).toBe(false);
  expect(apacRetrograda({ codigo: "ESTADIO_AUSENTE", apacId: negada.apacId,
    comprovanteRef: negada.resultadoExterno.comprovanteRef }))
    .toEqual({ apacId: "apac-test", comprovanteRef: "comprovante-local-opaco",
      campoOrigem: "estadiamentos", estado: "PENDENTE" });
});
it("T-30/N13 D85 perdido avisa D86 uma vez; D90 não emite, consulta segue", () => {
  expect(apacPrazo("2026-01-01", "2026-03-27", null).aviso).toBe(true); // D85
  const dia86 = apacPrazo("2026-01-01", "2026-03-28", null);
  expect(dia86.aviso).toBe(true);
  expect(apacPrazo("2026-01-01", "2026-03-28", "2026-03-27").aviso).toBe(false);
  expect(apacPrazo("2026-01-01", "2026-04-01", null))
    .toMatchObject({ estado: "VENCIDA", faturamentoPodeEmitir: false, consultaSegue: true });
});
it("G-12 nenhuma conversão de intenção em finalidade no código", () => {
  const source = readFileSync(fileURLToPath(new URL("../../src/rules/apac.ts", import.meta.url)), "utf8");
  expect(source).not.toMatch(/function\s+\w*[Cc]onvert\w*[Ii]ntencao/);
  expect(apacGerar({ ...rx, campos: { intencao: "ADJUVANTE" } }, lot, hoje).campos.finalidadeApac)
    .toMatchObject({ estado: "PENDENTE" });
});
