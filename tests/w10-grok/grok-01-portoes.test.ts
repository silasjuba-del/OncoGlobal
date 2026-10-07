// GROK-01 · corte do salão (D-W9-37/38) × triagem do ciclo (D-W9-22g). Igual ao limite passa.
import { describe, expect, it } from "vitest";
import type { SalaoRuleset } from "../../src/contracts/regras.js";
import {
  avaliarCorteSalao as corteIndex,
  avaliarPortoesW10 as parIndex,
  avaliarTriagem as triagemIndex,
  avaliarTriagemCiclo as cicloIndex,
  type SinaisExtraW10,
} from "../../src/rules/index.js";
import {
  avaliarCorteSalao,
  avaliarPortoesW10,
  avaliarTriagem,
  avaliarTriagemCiclo,
  type ResultadoPortao,
} from "../../src/rules/triagem.js";
import { ausente, ctxBase, presente, triagemBase } from "../fixtures/triagem.js";
import { salaoRuleset } from "../fixtures/rulesets.js";

const EXTRA: SinaisExtraW10 = { pad: 80, crCentesimos: 100 };

type Portoes = {
  portoes: {
    triagemCiclo: Record<string, unknown>;
    corteSalao: Record<string, unknown>;
  };
};

const editar = (fn: (portoes: Portoes["portoes"]) => void): SalaoRuleset => {
  const copia = structuredClone(salaoRuleset) as SalaoRuleset & Portoes;
  fn(copia.portoes);
  return copia;
};

const salao = (
  over: Parameters<typeof triagemBase>[0] = {},
  extra: SinaisExtraW10 = EXTRA,
  rs: SalaoRuleset = salaoRuleset,
) => avaliarCorteSalao(triagemBase(over), extra, rs);

const ciclo = (
  over: Parameters<typeof triagemBase>[0] = {},
  extra: SinaisExtraW10 = EXTRA,
  rs: SalaoRuleset = salaoRuleset,
) => avaliarTriagemCiclo(triagemBase(over), extra, rs);

const passa = (r: ResultadoPortao) => {
  expect(r.motivos).toEqual([]);
  expect(r.pendentes).toEqual([]);
  expect(r.destino).toBe("SALAO");
  expect(r.bloqueiaSalvar).toBe(false);
};

const corta = (r: ResultadoPortao, codigo: string, decisao: string) => {
  expect(r.destino).toBe("FILA_MEDICO");
  expect(r.bloqueiaSalvar).toBe(false);
  const motivo = r.motivos.find((m) => m.codigo === codigo);
  expect(motivo?.texto).toContain(decisao);
  expect(r.motivos.filter((m) => m.codigo === codigo)).toHaveLength(1);
};

describe("GROK-01 corte do salão — fronteira (igual passa)", () => {
  const casos: Array<{
    campo: string;
    igual: number;
    seguro: number;
    alem: number;
    codigo: string;
    decisao: string;
    run: (n: number) => ResultadoPortao;
  }> = [
    { campo: "temp", igual: 378, seguro: 377, alem: 379, codigo: "corteSalao.temp.alta", decisao: "D-W9-38", run: (n) => salao({ tempDecimos: presente(n) }) },
    { campo: "spo2", igual: 88, seguro: 89, alem: 87, codigo: "corteSalao.spo2.baixa", decisao: "D-W9-37", run: (n) => salao({ spo2: presente(n) }) },
    { campo: "pas", igual: 90, seguro: 91, alem: 89, codigo: "corteSalao.pas.baixa", decisao: "D-W9-41", run: (n) => salao({ pas: presente(n) }) },
    { campo: "fc", igual: 50, seguro: 51, alem: 49, codigo: "corteSalao.fc.baixa", decisao: "D-W9-37", run: (n) => salao({ fc: presente(n) }) },
    { campo: "hb", igual: 80, seguro: 81, alem: 79, codigo: "corteSalao.hb.baixa", decisao: "D-W9-37", run: (n) => salao({ hbDgDl: presente(n) }) },
    { campo: "cr", igual: 150, seguro: 149, alem: 151, codigo: "corteSalao.cr.alta", decisao: "D-W9-37", run: (n) => salao({}, { pad: 80, crCentesimos: n }) },
    { campo: "anc", igual: 1500, seguro: 1501, alem: 1499, codigo: "corteSalao.anc.baixa", decisao: "D-W9-22a", run: (n) => salao({ anc: presente(n) }) },
    { campo: "plq", igual: 100000, seguro: 100001, alem: 99999, codigo: "corteSalao.plq.baixa", decisao: "D-W9-22a", run: (n) => salao({ plq: presente(n) }) },
  ];

  it.each(casos)("$campo igual passa, lado seguro passa, lado além corta", ({ igual, seguro, alem, codigo, decisao, run }) => {
    passa(run(igual));
    passa(run(seguro));
    corta(run(alem), codigo, decisao);
  });

  it("ECOG 2 passa; ECOG 3 e 4 vão à fila (D-W9-22d)", () => {
    passa(salao({ ecog: presente(2) }));
    corta(salao({ ecog: presente(3) }), "corteSalao.ecog", "D-W9-22d");
    corta(salao({ ecog: presente(4) }), "corteSalao.ecog", "D-W9-22d");
  });

  it("temp 379 cita 37,9 °C e não bloqueia salvar", () => {
    const r = salao({ tempDecimos: presente(379) });
    expect(r.motivos[0]?.texto).toContain("37,9 °C");
    expect(r.bloqueiaSalvar).toBe(false);
    expect(r.portao).toBe("CORTE_SALAO");
    expect(r.decisao).toBe("D-W9-37");
    expect(r.rulesetVersao).toBe("1.0.0");
  });

  it("creatinina 151 cita 1,51 mg/dL; 0 presente não vira ausente", () => {
    expect(salao({}, { pad: 80, crCentesimos: 151 }).motivos[0]?.texto).toContain("1,51 mg/dL");
    passa(salao({}, { pad: 80, crCentesimos: 0 }));
  });

  it("ausente é PENDENTE, nunca corte nem SALAO", () => {
    const cr = salao({}, { pad: 80, crCentesimos: null });
    expect(cr.destino).toBe("FILA_MEDICO");
    expect(cr.motivos).toEqual([]);
    expect(cr.pendentes.map((m) => m.codigo)).toContain("pendente.corteSalao.cr.alta");
    expect(cr.bloqueiaSalvar).toBe(false);

    const spo2 = salao({ spo2: ausente<number>() });
    expect(spo2.destino).toBe("FILA_MEDICO");
    expect(spo2.motivos).toEqual([]);
    expect(spo2.pendentes.map((m) => m.codigo)).toContain("pendente.corteSalao.spo2.baixa");
  });

  it("dois cortes no mesmo portão permanecem os dois", () => {
    const r = salao({ tempDecimos: presente(379), fc: presente(49) });
    expect(r.motivos.map((m) => m.codigo)).toEqual(["corteSalao.temp.alta", "corteSalao.fc.baixa"]);
    expect(r.destino).toBe("FILA_MEDICO");
  });
});

describe("GROK-01 triagem do ciclo — fronteira (igual passa)", () => {
  const casos: Array<{
    campo: string;
    igual: number;
    seguro: number;
    alem: number;
    codigo: string;
    run: (n: number) => ResultadoPortao;
  }> = [
    { campo: "temp 37,9", igual: 378, seguro: 377, alem: 379, codigo: "triagemCiclo.temp.alta", run: (n) => ciclo({ tempDecimos: presente(n) }) },
    { campo: "PAS 14", igual: 140, seguro: 139, alem: 141, codigo: "triagemCiclo.pas.alta", run: (n) => ciclo({ pas: presente(n) }) },
    { campo: "PAD 9", igual: 90, seguro: 89, alem: 91, codigo: "triagemCiclo.pad.alta", run: (n) => ciclo({}, { pad: n, crCentesimos: 100 }) },
    { campo: "FC 110", igual: 110, seguro: 109, alem: 111, codigo: "triagemCiclo.fc.alta", run: (n) => ciclo({ fc: presente(n) }) },
  ];

  it.each(casos)("$campo igual passa, lado seguro passa, lado além corta", ({ igual, seguro, alem, codigo, run }) => {
    passa(run(igual));
    passa(run(seguro));
    corta(run(alem), codigo, "D-W9-22g");
  });

  it("PAD ausente é PENDENTE", () => {
    const r = ciclo({}, { pad: null, crCentesimos: 100 });
    expect(r.destino).toBe("FILA_MEDICO");
    expect(r.motivos).toEqual([]);
    expect(r.pendentes.map((m) => m.codigo)).toContain("pendente.triagemCiclo.pad.alta");
    expect(r.bloqueiaSalvar).toBe(false);
  });
});

describe("GROK-01 os portões não se fundem", () => {
  it("FC 49 corta o salão e não a triagem do ciclo", () => {
    corta(salao({ fc: presente(49) }), "corteSalao.fc.baixa", "D-W9-37");
    passa(ciclo({ fc: presente(49) }));
  });

  it("FC 111 corta o ciclo e não o salão", () => {
    corta(ciclo({ fc: presente(111) }), "triagemCiclo.fc.alta", "D-W9-22g");
    passa(salao({ fc: presente(111) }));
  });

  it("PAS 141 corta o ciclo; PAS 89 corta o salão; o outro portão passa", () => {
    corta(ciclo({ pas: presente(141) }), "triagemCiclo.pas.alta", "D-W9-22g");
    passa(salao({ pas: presente(141) }));
    corta(salao({ pas: presente(89) }), "corteSalao.pas.baixa", "D-W9-41");
    passa(ciclo({ pas: presente(89) }));
  });

  it("PAD 91 e creatinina 151 ficam no portão que os declara", () => {
    corta(ciclo({}, { pad: 91, crCentesimos: 100 }), "triagemCiclo.pad.alta", "D-W9-22g");
    passa(salao({}, { pad: 91, crCentesimos: 100 }));
    corta(salao({}, { pad: 80, crCentesimos: 151 }), "corteSalao.cr.alta", "D-W9-37");
    passa(ciclo({}, { pad: 80, crCentesimos: 151 }));
  });

  it("mudar o inteiro de um portão não altera o outro", () => {
    const rs = editar((p) => {
      p.triagemCiclo.tempDecimosMax = 400;
      p.corteSalao.fcMin = 40;
    });
    passa(ciclo({ tempDecimos: presente(379) }, EXTRA, rs));
    corta(salao({ tempDecimos: presente(379) }, EXTRA, rs), "corteSalao.temp.alta", "D-W9-38");
    passa(salao({ fc: presente(49) }, EXTRA, rs));
    corta(salao({ fc: presente(39) }, EXTRA, rs), "corteSalao.fc.baixa", "D-W9-37");
  });

  it("avaliarPortoesW10 devolve os dois objetos", () => {
    const par = avaliarPortoesW10(triagemBase({ fc: presente(49) }), EXTRA, salaoRuleset);
    expect(par.triagemCiclo).not.toBe(par.corteSalao);
    expect(par.triagemCiclo.portao).toBe("TRIAGEM_CICLO");
    expect(par.corteSalao.portao).toBe("CORTE_SALAO");
    expect(par.triagemCiclo.motivos).toEqual([]);
    expect(par.corteSalao.destino).toBe("FILA_MEDICO");
    expect(par.corteSalao.bloqueiaSalvar).toBe(false);
  });

  it("ruleset sem o portão nomeado falha fechado", () => {
    const rs = structuredClone(salaoRuleset) as SalaoRuleset & { portoes?: unknown };
    delete rs.portoes;
    expect(() => salao({}, EXTRA, rs)).toThrow(/sem portoes/);
    expect(() => ciclo({}, EXTRA, rs)).toThrow(/sem portoes/);
  });

  it("limiar que não é inteiro falha fechado", () => {
    const rs = editar((p) => {
      p.corteSalao.fcMin = 50.5;
    });
    expect(() => salao({}, EXTRA, rs)).toThrow(/fcMin não é inteiro/);
  });
});

describe("GROK-01 idade e destino continuam os da FN-02", () => {
  it("idade ausente é PENDENTE e não vira 0, mesmo em CAMA", () => {
    for (const r of [salao({ idadeAnos: null }), ciclo({ idadeAnos: null }), salao({ idadeAnos: null, recurso: "CAMA" })]) {
      expect(r.destino).toBe("FILA_MEDICO");
      expect(r.pendentes.map((m) => m.codigo)).toContain("pendente.idadeAnos");
      expect(r.pendentes.find((m) => m.codigo === "pendente.idadeAnos")?.texto).toContain("D-W9-03");
      expect(r.bloqueiaSalvar).toBe(false);
    }
  });

  it("idade 0 não é ausência; 80 fica no salão; 81 e CAMA limpos vão à frente", () => {
    expect(salao({ idadeAnos: 0 }).pendentes).toEqual([]);
    expect(salao({ idadeAnos: 80 }).destino).toBe("SALAO");
    expect(ciclo({ idadeAnos: 81 }).destino).toBe("FRENTE");
    expect(salao({ recurso: "CAMA" }).destino).toBe("FRENTE");
    expect(salao({ recurso: "CAMA", tempDecimos: presente(379) }).destino).toBe("FILA_MEDICO");
  });
});

describe("GROK-01 a FN-01 congelada não absorve o corte novo", () => {
  it("FC 49 segue anotado, sem corte, nos dois módulos", () => {
    for (const avaliar of [avaliarTriagem, triagemIndex]) {
      const r = avaliar(triagemBase({ fc: presente(49) }), ctxBase(), salaoRuleset);
      expect(r.destino).toBe("SALAO");
      expect(r.cortes).toEqual([]);
      expect(r.naoCortes.map((m) => m.codigo)).toContain("naoCorte.fc.baixa");
    }
  });

  it("PAS 161 continua corte da FN-01 e não do portão D-W9-37", () => {
    const legado = avaliarTriagem(triagemBase({ pas: presente(161) }), ctxBase(), salaoRuleset);
    expect(legado.cortes.map((m) => m.codigo)).toContain("corte.pas.alta");
    passa(salao({ pas: presente(161) }));
    corta(ciclo({ pas: presente(161) }), "triagemCiclo.pas.alta", "D-W9-22g");
  });
});

describe("GROK-01 paridade triagem.ts × index.ts", () => {
  const casos: Array<[string, Parameters<typeof triagemBase>[0], SinaisExtraW10]> = [
    ["limpo", {}, EXTRA],
    ["fc 49", { fc: presente(49) }, EXTRA],
    ["temp 379", { tempDecimos: presente(379) }, EXTRA],
    ["cr 151", {}, { pad: 80, crCentesimos: 151 }],
    ["pad 91", {}, { pad: 91, crCentesimos: 100 }],
    ["idade nula", { idadeAnos: null }, EXTRA],
    ["cr ausente", {}, { pad: 80, crCentesimos: null }],
    ["cama", { recurso: "CAMA" }, EXTRA],
  ];

  it.each(casos)("%s", (_nome, over, extra) => {
    const t = triagemBase(over);
    expect(corteIndex(t, extra, salaoRuleset)).toEqual(avaliarCorteSalao(t, extra, salaoRuleset));
    expect(cicloIndex(t, extra, salaoRuleset)).toEqual(avaliarTriagemCiclo(t, extra, salaoRuleset));
    expect(parIndex(t, extra, salaoRuleset)).toEqual(avaliarPortoesW10(t, extra, salaoRuleset));
  });
});
