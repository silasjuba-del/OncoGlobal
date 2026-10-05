// S-F0-04 · desidentificador (T-42, N18, N22), reconciliação (T-40, N01), gates (+/−) e gateway (N06, G-19, G-20)
import { describe, expect, it } from "vitest";
import { cnsValido, contemPhiResidual, cpfValido, desidentificar, reidentificar } from "../../src/kernel/llm/desidentificar.js";
import { reconciliar } from "../../src/rules/reconciliar.js";
import * as G from "../../src/kernel/harness/gates.js";
import { criarGateway, memoriaIdempotencia, type RegistroAuditoria } from "../../src/kernel/gateway/gateway.js";

// Identificadores SINTÉTICOS (CPF/CNS gerados para teste, sem pessoa real)
const CPF_OK = "529.982.247-25";
const DIC = { nomes: ["Joana Sintética Teste", "Hospital Exemplo do Bem"], identificadores: ["PRONT-000123"] };

describe("FN-24 desidentificar", () => {
  it("valida DV de CPF e rejeita sequência inválida", () => {
    expect(cpfValido(CPF_OK)).toBe(true);
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cpfValido("529.982.247-24")).toBe(false);
  });
  it("valida CNS por soma ponderada", () => {
    expect(cnsValido("700000000000005")).toBe(true);
    expect(cnsValido("700000000000004")).toBe(false);
  });
  it("tokeniza nome (com/sem acento), CPF, telefone, e-mail, prontuário e DN; reidentifica só localmente", () => {
    const original = `Paciente Joana Sintetica Teste, CPF ${CPF_OK}, tel (83) 99999-1234, joana@exemplo.com, PRONT-000123, DN: 01/02/1960, internada no Hospital Exemplo do Bem.`;
    const r = desidentificar(original, DIC);
    expect(r.texto).not.toMatch(/Joana|529\.982|99999|exemplo\.com|PRONT-000123|1960|Hospital Exemplo/i);
    const tipos = r.achados.map((a) => a.tipo);
    for (const t of ["NOME", "CPF", "TELEFONE", "EMAIL", "IDENTIFICADOR", "DATA_NASC"]) expect(tipos).toContain(t);
    expect(reidentificar(r.texto, r.mapa)).toBe(original);
  });
  it("não tokeniza número clínico comum (dose, contagem)", () => {
    const r = desidentificar("Oxaliplatina 130 mg/m2, neutrófilos 1500/µL, plaquetas 100000.", DIC);
    expect(r.achados).toHaveLength(0);
  });
  it("token desconhecido nunca é reidentificado com outro paciente", () => {
    const a = desidentificar("Joana Sintética Teste", DIC);
    expect(reidentificar("⟨NOME_9⟩ esteve aqui", a.mapa)).toBe("⟨NOME_9⟩ esteve aqui");
  });
  it("contemPhiResidual: true com nome, false após desidentificar", () => {
    expect(contemPhiResidual("conversa com Joana", DIC)).toBe(true);
    expect(contemPhiResidual(desidentificar("conversa com Joana", DIC).texto, DIC)).toBe(false);
  });
});

describe("FN-22 reconciliar (INV-07)", () => {
  const f = (id: string) => ({ sourceId: id, classe: "DOCUMENT" as const, localizador: null, dataClinica: null, dataCaptura: "2026-10-05T10:00:00-03:00", versao: "1", contentHash: id });
  it("concordância de duas fontes", () => expect(reconciliar([{ valor: 80, fonte: f("a") }, { valor: 80, fonte: f("b") }]).classe).toBe("CONCORDANTE"));
  it("conflito preserva candidatos e não elege valor (nunca last-write-wins)", () => {
    const r = reconciliar([{ valor: 80, fonte: f("a") }, { valor: 95, fonte: f("b") }]);
    expect(r.classe).toBe("CONFLITO");
    expect(r.valor).toBeNull();
    expect(r.candidatos).toHaveLength(2);
  });
  it("fonte única, complementar e ausente", () => {
    expect(reconciliar([{ valor: 1, fonte: f("a") }]).classe).toBe("FONTE_UNICA");
    expect(reconciliar([{ valor: 1, fonte: f("a") }, { valor: null, fonte: f("b") }]).classe).toBe("COMPLEMENTAR");
    expect(reconciliar([{ valor: null, fonte: f("a") }]).classe).toBe("AUSENTE");
  });
});

describe("Gates (positivo + negativo)", () => {
  it("G-02 PHI egress", () => {
    expect(G.g02PhiEgress("Joana com febre", DIC).decisao).toBe("BLOQUEIA_SAIDA");
    expect(G.g02PhiEgress("paciente com febre", DIC).decisao).toBe("PASSA");
  });
  it("G-03 assinatura", () => {
    expect(G.g03Assinatura({ tipo: "SESSAO", crm: "CRM-PB 0000" }).decisao).toBe("PASSA");
    expect(G.g03Assinatura({ tipo: "AGENTE", crm: null }).decisao).toBe("BLOQUEIA_AUTORIDADE");
  });
  it("G-05 verde honesto", () => {
    expect(G.g05VerdeHonesto("VERDE", true, 0).decisao).toBe("PASSA");
    expect(G.g05VerdeHonesto("VERDE", true, 1).decisao).toBe("ALERTA");
  });
  it("G-10 dose pura (K-13)", () => {
    expect(G.g10DosePura({ doseFinalMg: 120 }, "LLM").decisao).toBe("BLOQUEIA_AUTORIDADE");
    expect(G.g10DosePura({ mencaoDose: "130 mg/m2", trecho: "p.2" }, "LLM").decisao).toBe("PASSA");
    expect(G.g10DosePura({ doseFinalMg: 120 }, "FUNCAO_PURA").decisao).toBe("PASSA");
  });
  it("G-13 letra", () => {
    expect(G.g13Letra("B").decisao).toBe("BLOQUEIA_ARTEFATO");
    expect(G.g13Letra("ADJUVANTE").decisao).toBe("PASSA");
  });
  it("G-14 interpolação", () => {
    expect(G.g14Interpolacao({ interpolado: true, observado: true }).decisao).toBe("BLOQUEIA_ARTEFATO");
    expect(G.g14Interpolacao({ interpolado: true, observado: false }).decisao).toBe("PASSA");
  });
  it("G-23 comando curto Deepgram (N21)", () => {
    expect(G.g23ComandoDeepgram(3, 10).decisao).toBe("PASSA");
    expect(G.g23ComandoDeepgram(40, 10).decisao).toBe("BLOQUEIA_SAIDA");
  });
  it("G-25 escopo da assinatura (N23)", () => {
    const exib = [{ documentId: "d1", documentVersion: 2 }];
    expect(G.g25EscopoAssinatura(exib, exib).decisao).toBe("PASSA");
    expect(G.g25EscopoAssinatura([{ documentId: "d1", documentVersion: 3 }], exib).decisao).toBe("BLOQUEIA_AUTORIDADE");
  });
  it("G-26 visão sem autoridade (N24)", () => {
    expect(G.g26VisaoSemAutoridade("RECIST", "VISUAL_SUGGESTION").decisao).toBe("BLOQUEIA_AUTORIDADE");
    expect(G.g26VisaoSemAutoridade("RECIST", "MEDICO").decisao).toBe("PASSA");
  });
});

describe("Action Gateway (INV-05, ROE-0, G-20)", () => {
  const sessao = { medicoId: "m1", crm: "CRM-PB 0000", emitidaEm: "2026-10-05T08:00:00-03:00", expiraEm: "2026-10-05T20:00:00-03:00" };
  const intent = { verbo: "IMPRIMIR", objeto: { tipo: "DOCUMENT", id: "d1", versao: 1 }, escopo: { patientId: "p1", encounterId: "e1" }, destino: "impressora-local", idempotencyKey: "op-imprimir-01" };
  const montar = (resp: { ok: true; recibo: string } | { ok: false; incerto: boolean; erro: string } = { ok: true, recibo: "r1" }) => {
    let chamadas = 0;
    const auditoria: RegistroAuditoria[] = [];
    const gw = criarGateway({
      executores: { IMPRIMIR: { executar: async () => { chamadas++; return resp; } } },
      store: memoriaIdempotencia(),
      agora: () => "2026-10-05T10:00:00-03:00",
      auditar: (r) => auditoria.push(r),
    });
    return { gw, auditoria, chamadas: () => chamadas };
  };
  it("executa uma vez; replay da mesma chave não repete efeito", async () => {
    const t = montar();
    expect((await t.gw.executar(intent, sessao)).decisao).toBe("EXECUTADA");
    expect((await t.gw.executar(intent, sessao)).decisao).toBe("REPLAY");
    expect(t.chamadas()).toBe(1);
  });
  it("mesma chave com payload diferente é negada e auditada (N06)", async () => {
    const t = montar();
    await t.gw.executar(intent, sessao);
    const r = await t.gw.executar({ ...intent, destino: "outra" }, sessao);
    expect(r.decisao).toBe("NEGADA");
    expect(t.auditoria.at(-1)?.decisao).toBe("NEGADA");
  });
  it("sem sessão, sessão expirada ou intent incompleto ⇒ NO_ACTION/negado, sem efeito", async () => {
    const t = montar();
    expect((await t.gw.executar(intent, null)).motivoCodigo).toBe("SEM_SESSAO");
    expect((await t.gw.executar(intent, { ...sessao, expiraEm: "2026-10-05T09:00:00-03:00" })).motivoCodigo).toBe("SESSAO_EXPIRADA");
    expect((await t.gw.executar({ verbo: "IMPRIMIR" }, sessao)).motivoCodigo).toBe("NO_ACTION_INTENT_INCOMPLETO");
    expect(t.chamadas()).toBe(0);
  });
  it("resultado incerto vira OUTCOME_UNKNOWN e não é reenviado", async () => {
    const t = montar({ ok: false, incerto: true, erro: "timeout" });
    expect((await t.gw.executar(intent, sessao)).decisao).toBe("OUTCOME_UNKNOWN");
    expect((await t.gw.executar(intent, sessao)).decisao).toBe("OUTCOME_UNKNOWN");
    expect(t.chamadas()).toBe(1);
  });
  it("HARD_FORBIDDEN: destino produção negado", async () => {
    const t = montar();
    expect((await t.gw.executar({ ...intent, destino: "produção", idempotencyKey: "op-x-000001" }, sessao)).motivoCodigo).toMatch(/HARD_FORBIDDEN/);
  });
});
