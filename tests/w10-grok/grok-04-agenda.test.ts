// GROK-04 · agenda de QT: limite de início, grade e geração sem reorganizar (D-W9-39).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  gerarSessoes,
  lerAgendaQt,
  validarAgenda,
  type RulesetAgenda,
  type SessaoAgenda,
} from "../../src/rules/agendaQt.js";

const rs = lerAgendaQt(JSON.parse(readFileSync("corpus/rulesets/agenda-qt.v1.json", "utf8")));

const sessao = (over: Partial<SessaoAgenda> = {}): SessaoAgenda => ({
  sessaoId: "sintetico-1",
  ciclo: 1,
  data: "2026-10-07",
  inicioMinutos: 8 * 60,
  duracaoMinutos: 120,
  poltrona: 1,
  ...over,
});

describe("GROK-04 agenda", () => {
  it("tratamento de 5 h às 12:00 passa; 12:01 alerta e não bloqueia", () => {
    const ok = validarAgenda([sessao({ duracaoMinutos: 300, inicioMinutos: 12 * 60 })], rs);
    expect(ok.motivos.map((m) => m.codigo)).not.toContain("agenda.inicioLongo");
    const corta = validarAgenda([sessao({ duracaoMinutos: 300, inicioMinutos: 12 * 60 + 1 })], rs);
    expect(corta.estado).toBe("ALERTA");
    expect(corta.bloqueiaSalvar).toBe(false);
    expect(corta.motivos[0]?.codigo).toBe("agenda.inicioLongo");
    expect(corta.motivos[0]?.texto).toContain("12:01");
    expect(corta.motivos[0]?.texto).toContain("D-W9-39");
    const curto = validarAgenda([sessao({ duracaoMinutos: 299, inicioMinutos: 15 * 60 })], rs);
    expect(curto.motivos.map((m) => m.codigo)).not.toContain("agenda.inicioLongo");
  });

  it("5 inícios na janela passam; o 6º alerta; o teto vem do ruleset", () => {
    const cinco = [0, 1, 2, 3, 4].map((i) => sessao({
      sessaoId: `s${i}`,
      inicioMinutos: 8 * 60,
      poltrona: i + 1,
    }));
    expect(validarAgenda(cinco, rs).motivos.map((m) => m.codigo)).not.toContain("agenda.inicios.janela");
    const seis = [...cinco, sessao({ sessaoId: "s5", inicioMinutos: 8 * 60 + 10, poltrona: 6 })];
    const r = validarAgenda(seis, rs);
    expect(r.motivos.some((m) => m.codigo === "agenda.inicios.janela")).toBe(true);
    expect(r.bloqueiaSalvar).toBe(false);
    const folgado: RulesetAgenda = { ...rs, maxIniciosPorJanela: 6 };
    expect(validarAgenda(seis, folgado).motivos.map((m) => m.codigo)).not.toContain("agenda.inicios.janela");
    const cedo = [0, 1, 2, 3, 4].map((i) => sessao({ sessaoId: `a${i}`, inicioMinutos: 8 * 60, poltrona: i + 1 }));
    const tarde = [0, 1, 2, 3, 4].map((i) => sessao({ sessaoId: `b${i}`, inicioMinutos: 8 * 60 + 30, poltrona: i + 1 }));
    expect(validarAgenda([...cedo, ...tarde], rs).motivos.map((m) => m.codigo)).not.toContain("agenda.inicios.janela");
  });

  it("poltrona ocupada e grade acima de 13 alertam; encostar no fim passa", () => {
    const choque = validarAgenda([
      sessao({ sessaoId: "a", inicioMinutos: 8 * 60, duracaoMinutos: 120, poltrona: 3 }),
      sessao({ sessaoId: "b", inicioMinutos: 9 * 60, duracaoMinutos: 60, poltrona: 3 }),
    ], rs);
    expect(choque.motivos.some((m) => m.codigo === "agenda.poltrona.ocupada")).toBe(true);
    expect(choque.bloqueiaSalvar).toBe(false);
    const encosta = validarAgenda([
      sessao({ sessaoId: "a", inicioMinutos: 8 * 60, duracaoMinutos: 120, poltrona: 3 }),
      sessao({ sessaoId: "b", inicioMinutos: 10 * 60, duracaoMinutos: 60, poltrona: 3 }),
    ], rs);
    expect(encosta.motivos.map((m) => m.codigo)).not.toContain("agenda.poltrona.ocupada");
    const cheia = Array.from({ length: 14 }, (_, i) => sessao({
      sessaoId: `p${i}`,
      inicioMinutos: 9 * 60 + i,
      poltrona: (i % 13) + 1,
    }));
    const lotada = validarAgenda(cheia, rs);
    expect(lotada.motivos.some((m) => m.codigo === "agenda.grade.lotada")).toBe(true);
    expect(lotada.motivos.some((m) => m.texto.includes("13"))).toBe(true);
    const duas: RulesetAgenda = { ...rs, poltronas: 2, maxIniciosPorJanela: 20 };
    const estoura = validarAgenda([
      sessao({ sessaoId: "a", poltrona: 1 }),
      sessao({ sessaoId: "b", poltrona: 2, inicioMinutos: 8 * 60 + 15 }),
      sessao({ sessaoId: "c", poltrona: 1, inicioMinutos: 8 * 60 + 15 }),
    ], duas);
    expect(estoura.motivos.some((m) => m.codigo === "agenda.grade.lotada" || m.codigo === "agenda.poltrona.ocupada")).toBe(true);
  });

  it("Otimizar dia não reordena e a poltrona ausente fica PENDENTE", () => {
    const recebidas = [
      sessao({ sessaoId: "tarde", inicioMinutos: 15 * 60, duracaoMinutos: 300, poltrona: 2 }),
      sessao({ sessaoId: "manha", inicioMinutos: 8 * 60, duracaoMinutos: 60, poltrona: null }),
    ];
    const r = validarAgenda(recebidas, rs, { otimizarDia: true });
    expect(r.reorganizou).toBe(false);
    expect(r.sessoes.map((s) => s.sessaoId)).toEqual(["tarde", "manha"]);
    expect(r.sessoes[0]?.inicioMinutos).toBe(15 * 60);
    expect(r.motivos.some((m) => m.codigo === "agenda.otimizarDia.proibido")).toBe(true);
    expect(r.motivos.some((m) => m.texto.includes("Otimizar dia"))).toBe(true);
    expect(r.pendentes.some((p) => p.codigo === "pendente.agenda.poltrona")).toBe(true);
    expect(r.bloqueiaSalvar).toBe(false);
    expect(r.estado).toBe("ALERTA");
  });

  it("gera ciclos pela data civil e não antecipa fim de semana", () => {
    const sessoes = gerarSessoes({
      protocoloId: "sintetico-bula",
      primeiroDia: "2026-10-07",
      numeroCiclos: 3,
      intervaloDias: 21,
      inicioMinutos: 8 * 60,
      duracaoMinutos: 180,
    });
    expect(sessoes.map((s) => s.data)).toEqual(["2026-10-07", "2026-10-28", "2026-11-18"]);
    expect(sessoes.every((s) => s.poltrona === null)).toBe(true);
    const seguidas = gerarSessoes({
      protocoloId: "sintetico-bula",
      primeiroDia: "2026-10-10",
      numeroCiclos: 3,
      intervaloDias: 1,
      inicioMinutos: 9 * 60,
      duracaoMinutos: 60,
    });
    expect(seguidas.map((s) => s.data)).toEqual(["2026-10-10", "2026-10-11", "2026-10-12"]);
    const geradas = gerarSessoes({
      protocoloId: "sintetico-bula",
      primeiroDia: "2026-01-31",
      numeroCiclos: 1,
      intervaloDias: 1,
      inicioMinutos: 13 * 60,
      duracaoMinutos: 300,
    });
    const v = validarAgenda(geradas, rs);
    expect(v.sessoes[0]?.data).toBe("2026-01-31");
    expect(v.estado).toBe("ALERTA");
    expect(v.reorganizou).toBe(false);
    expect(v.bloqueiaSalvar).toBe(false);
    expect(v.motivos.map((m) => m.codigo)).toContain("agenda.inicioLongo");
    expect(v.pendentes.map((p) => p.codigo)).toContain("pendente.agenda.poltrona");
  });
});
