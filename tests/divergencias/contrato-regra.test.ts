import { describe, expect, it } from "vitest";
import { CorpusDivergencias, Divergencia, criarDivergencia } from "../../src/contracts/divergencia.js";
import { avaliarDivergencias } from "../../src/rules/divergencia.js";
const contexto = { patientId: "SINTETICO-A", encounterId: "ENCONTRO-A", tumorLotId: null };
const ctx = { contexto, cartaoId: "CARTAO-SINTETICO", dadosDecisivosDisponiveis: true, itensComDose: [] as string[] };
export function aberta() { return Divergencia.parse({ id: "DIV-SINTETICA", tema: "Diferença documental sintética", tipo: "EXTERNA",
  polos: ["A", "B"].map(id => ({ id, rotulo: id, fonteId: id, localizador: "seção sintética", afirmacao: `Posição sintética ${id}`, edicao: "NAO_VERIFICADO", natureza: "PARAFRASE" })),
  cartaoIds: [ctx.cartaoId], itensAfetados: ["ITEM-SINTETICO"], estado: "ABERTA", decisao: null, efeitoNoMotor: "EXIBIR_AMBOS" }); }
const decisao = { poloEscolhido: "B", decididoPor: "MEDICO-SINTETICO", crm: "CRM-SINTETICO", data: "2026-11-01T12:00:00-03:00",
  motivo: "Motivo sintético", contexto, assinatura: { documentId: "DOC-SINTETICO", documentVersion: 1, eventId: "EVENTO-SINTETICO", revisao: "ASSINADO" } };
describe("F1 invariantes I1–I6", () => {
  it("I1: aberta sem decisão; decidida exige todos os campos e assinatura", () => {
    expect(Divergencia.safeParse({ ...aberta(), decisao }).success).toBe(false);
    expect(Divergencia.safeParse({ ...aberta(), estado: "DECIDIDA" }).success).toBe(false);
    expect(Divergencia.safeParse({ ...aberta(), estado: "DECIDIDA", decisao: { ...decisao, crm: "" } }).success).toBe(false);
    expect(Divergencia.safeParse({ ...aberta(), estado: "DECIDIDA", decisao: { ...decisao, poloEscolhido: "ausente" } }).success).toBe(false);
  });
  it("I2: criação não aceita uma decisão, mesmo quando o registro é estruturalmente completo", () => {
    expect(criarDivergencia(aberta()).estado).toBe("ABERTA");
    expect(() => criarDivergencia({ ...aberta(), estado: "DECIDIDA", decisao })).toThrow("CRIACAO_SOMENTE_ABERTA");
  });
  it("I3: dois polos, cada um com localizador", () => {
    const a = aberta(); a.polos.pop(); expect(Divergencia.safeParse(a).success).toBe(false);
    const b = aberta(); b.polos[0]!.localizador = ""; expect(Divergencia.safeParse(b).success).toBe(false);
  });
  it("I4: transcrição NCCN declarada ou campo trecho são recusados", () => {
    const a = aberta(); a.polos[0]!.fonteId = "NCCN-BREAST"; a.polos[0]!.natureza = "TRANSCRICAO";
    expect(Divergencia.safeParse(a).success).toBe(false);
    expect(Divergencia.safeParse({ ...aberta(), polos: [{ ...aberta().polos[0], trecho: "literal" }, aberta().polos[1]] }).success).toBe(false);
  });
  it("I5: corpus não aceita IDs duplicados", () => {
    const fontes = ["A", "B"].map(id => ({ id, titulo: id, tipo: "SBOC", arquivo: null, url: null, sha256: null,
      edicao: "sintética", consultadoEm: null, estado: "NAO_VERIFICADO" }));
    const c = { versao: "teste", fontes, divergencias: [aberta()] };
    expect(CorpusDivergencias.safeParse(c).success).toBe(true);
    expect(CorpusDivergencias.safeParse({ ...c, divergencias: [aberta(), aberta()] }).success).toBe(false);
  });
  it("I6: superada exige referência à fonte que a supera", () => {
    expect(Divergencia.safeParse({ ...aberta(), estado: "SUPERADA" }).success).toBe(false);
    expect(Divergencia.safeParse({ ...aberta(), estado: "SUPERADA", superadaPor: { fonteId: "fonte-nova", edicao: "nova", localizador: "seção" } }).success).toBe(true);
  });
});
describe("F1 avaliação por cartão e documento", () => {
  it("aberta expõe ambos, nunca escolhe e não muta a entrada", () => {
    const a = aberta(), antes = JSON.stringify(a), [r] = avaliarDivergencias([a], ctx);
    expect(r).toMatchObject({ resultado: "WARNING", poloAplicado: null, proveniencia: null, bloqueiaMedico: false, bloqueiaSalvar: false });
    expect(r!.polos).toHaveLength(2); expect(JSON.stringify(a)).toBe(antes);
    expect(r!.aviso).not.toMatch(/recomendad|decidid|autorizad|liberad/i);
  });
  it("ausência é não avaliável; efeito indeterminado não vira negativo", () => {
    expect(avaliarDivergencias([aberta()], { ...ctx, dadosDecisivosDisponiveis: null })[0]!.resultado).toBe("NOT_EVALUABLE");
    expect(avaliarDivergencias([{ ...aberta(), efeitoNoMotor: "INDETERMINADO" }], ctx)[0]!.resultado).toBe("INDETERMINADO");
  });
  it("bloqueia somente o artefato com o item atingido; plano e outros itens continuam", () => {
    const d = { ...aberta(), efeitoNoMotor: "BLOQUEIA_DOCUMENTO_COM_DOSE" as const };
    expect(avaliarDivergencias([d], ctx)[0]!.resultado).toBe("WARNING");
    expect(avaliarDivergencias([d], { ...ctx, itensComDose: ["OUTRO"] })[0]!.resultado).toBe("WARNING");
    expect(avaliarDivergencias([d], { ...ctx, itensComDose: ["ITEM-SINTETICO"] })[0]).toMatchObject({ resultado: "BLOCK_ARTEFATO", bloqueiaMedico: false, bloqueiaSalvar: false });
  });
  it("decisão histórica aplica só no contexto original; outro paciente não recebe a decisão", () => {
    const d = Divergencia.parse({ ...aberta(), estado: "DECIDIDA", decisao });
    expect(avaliarDivergencias([d], ctx)[0]!.poloAplicado!.id).toBe("B");
    expect(avaliarDivergencias([d], { ...ctx, contexto: { ...contexto, patientId: "SINTETICO-B" } })[0]).toMatchObject({ resultado: "NOT_EVALUABLE", poloAplicado: null, proveniencia: null });
    expect(avaliarDivergencias([d], { ...ctx, cartaoId: "OUTRO-CARTAO" })).toEqual([]);
  });
});
