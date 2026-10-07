// CODEX-07 · correção sistemática: nenhum gate devolve PASSA com entrada ausente/vazia/desconhecida.
import { describe, expect, it } from "vitest";
import {
  g02PhiEgress, g03Assinatura, g05VerdeHonesto, g10DosePura, g13Letra, g14Interpolacao, g25EscopoAssinatura, g26VisaoSemAutoridade,
} from "../../src/kernel/harness/gates.js";

const naoPassa = (v: { decisao: string }) => expect(v.decisao).not.toBe("PASSA");
const dic = { nomes: ["Paciente Teste 01"], identificadores: [] };

describe("CODEX-07 · PASSA silencioso", () => {
  it("G-02: payload ausente/não-string não passa (e não lança)", () => {
    for (const p of [undefined, null, 42, {}]) naoPassa(g02PhiEgress(p as never, dic));
  });
  it("G-03: CRM só com espaços não assina", () => {
    naoPassa(g03Assinatura({ tipo: "SESSAO", crm: "   " }));
    naoPassa(g03Assinatura({ tipo: "SESSAO", crm: null }));
    naoPassa(g03Assinatura(undefined as never));
  });
  it("G-05: VERDE com pendências indefinidas/NaN não passa", () => {
    naoPassa(g05VerdeHonesto("VERDE", true, undefined as never));
    naoPassa(g05VerdeHonesto("VERDE", true, Number.NaN));
    naoPassa(g05VerdeHonesto("VERDE", undefined as never, 0));
  });
  it("G-10: origem desconhecida com dose não passa; saída nula não lança", () => {
    naoPassa(g10DosePura({ doseFinalMg: 10 }, undefined as never));
    naoPassa(g10DosePura({ doseCalculadaMg: 10 }, "OUTRA" as never));
    naoPassa(g10DosePura(null as never, "LLM"));
  });
  it("G-13: intenção vazia/ausente não passa (PENDENTE)", () => {
    for (const i of ["", "  ", undefined, null]) naoPassa(g13Letra(i as never));
  });
  it("G-14: campos não booleanos não passam", () => {
    naoPassa(g14Interpolacao({} as never));
    naoPassa(g14Interpolacao({ interpolado: undefined, observado: true } as never));
  });
  it("G-25: escopo de assinatura ausente não passa; vazio = nada a assinar (tech lead W10)", () => {
    expect(g25EscopoAssinatura([], [{ documentId: "d", documentVersion: 1 }]).decisao).toBe("PASSA");
    naoPassa(g25EscopoAssinatura(undefined as never, []));
    naoPassa(g25EscopoAssinatura([{ documentId: "d", documentVersion: 1 }], undefined as never));
  });
  it("G-26: alvo vazio ou origem desconhecida não passa", () => {
    naoPassa(g26VisaoSemAutoridade("", "VISUAL_SUGGESTION"));
    naoPassa(g26VisaoSemAutoridade("TNM", undefined as never));
    naoPassa(g26VisaoSemAutoridade("TNM", "OUTRA" as never));
  });
  it("regressão: casos legítimos continuam passando", () => {
    expect(g02PhiEgress("texto limpo", dic).decisao).toBe("PASSA");
    expect(g03Assinatura({ tipo: "SESSAO", crm: "CRM-PB 1234" }).decisao).toBe("PASSA");
    expect(g05VerdeHonesto("VERDE", true, 0).decisao).toBe("PASSA");
    expect(g10DosePura({ doseFinalMg: 10 }, "FUNCAO_PURA").decisao).toBe("PASSA");
    expect(g13Letra("ADJUVANTE").decisao).toBe("PASSA");
    expect(g14Interpolacao({ interpolado: true, observado: false }).decisao).toBe("PASSA");
    expect(g25EscopoAssinatura([{ documentId: "d", documentVersion: 1 }], [{ documentId: "d", documentVersion: 1 }]).decisao).toBe("PASSA");
    expect(g26VisaoSemAutoridade("TNM", "MEDICO").decisao).toBe("PASSA");
  });
});
