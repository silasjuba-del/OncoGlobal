import { describe, expect, it } from "vitest";
import { projetarSnapshot } from "../../src/kernel/projections/snapshot.js";
import { evento } from "./fixtures.js";

const lab = (id: string, valor: number, dataClinica: string | null) => evento(id,
  { campo: "CREATININA", valor, observacaoDatada: true, dataClinica });
const projetar = (eventos: ReturnType<typeof evento>[]) => projetarSnapshot(eventos,
  "paciente-sintetico", "lote-sintetico", "consulta-sintetica", "eixo-temporal-v1");

describe("F04 — data clínica não atesta normalidade ou aptidão", () => {
  it("exibe o mais recente como PENDENTE e conserva série e hash determinístico", () => {
    const antigo = lab("antigo", 2.5, "2026-01-01");
    const recente = lab("recente", 1.1, "2026-10-07");
    const result = projetar([recente, antigo]);
    expect(result.campos.CREATININA).toMatchObject({ valor: 1.1, estado: "PENDENTE",
      observacoes: [{ valor: 2.5, eventId: "antigo" }, { valor: 1.1, eventId: "recente" }] });
    expect(result.contentHash).toBe(projetar([antigo, recente]).contentHash);
  });

  it.each([null, "2026-02-30", "2026-10", "ontem"])("data ausente/inválida %s não gera VERDE", (data) => {
    expect(projetar([lab("sem-data-valida", 1.1, data)]).campos.CREATININA)
      .toMatchObject({ valor: 1.1, estado: "PENDENTE" });
  });

  it("data posterior não apaga conflito confirmado no mesmo dia anterior", () => {
    const result = projetar([lab("a", 1.1, "2026-01-01"), lab("b", 2.5, "2026-01-01"),
      lab("novo", 1.2, "2026-10-07")]);
    expect(result.campos.CREATININA).toMatchObject({ estado: "VERMELHO", valor: null,
      candidatos: [{ eventId: "a", valor: 1.1 }, { eventId: "b", valor: 2.5 }] });
    expect(result.campos.CREATININA?.observacoes).toHaveLength(3);
  });

  it("supersessão explícita resolve divergência sem apagar série nem declarar validade", () => {
    const a = lab("a", 1.1, "2026-01-01");
    const b = lab("b", 2.5, "2026-01-01");
    const correcao = { ...lab("correcao", 1.1, "2026-01-01"), supersedesEventId: b.eventId };
    const result = projetar([a, b, correcao]);
    expect(result.campos.CREATININA).toMatchObject({ valor: 1.1, estado: "PENDENTE" });
    expect(result.campos.CREATININA?.observacoes).toHaveLength(3);
  });

  it("observação datada concordante com campo genérico continua sem regra de validade", () => {
    const generico = evento("generico", { campo: "CREATININA", valor: 1.1 });
    expect(projetar([generico, lab("datado", 1.1, "2026-10-07")]).campos.CREATININA?.estado).toBe("PENDENTE");
  });

  it("data inválida não oculta divergência com observação datada", () => {
    expect(projetar([lab("incerto", 2.5, null), lab("datado", 1.1, "2026-10-07")])
      .campos.CREATININA?.estado).toBe("VERMELHO");
  });

  it.each([null, "2026-10-07"])("LabResult sem marcador continua PENDENTE com data %s", (dataClinica) => {
    const laboratorio = evento("lab-sem-marcador", { campo: "CREATININA", valor: 1.1, dataClinica }, { tipo: "LabResult" });
    expect(projetar([laboratorio]).campos.CREATININA).toMatchObject({ valor: 1.1, estado: "PENDENTE" });
  });

  it("registro genérico concordante não promove LabResult por ordem de replay", () => {
    const generico = evento("generico", { campo: "CREATININA", valor: 1.1 });
    const laboratorio = evento("lab-sem-marcador", { campo: "CREATININA", valor: 1.1 }, { tipo: "LabResult" });
    const primeiro = projetar([generico, laboratorio]);
    const segundo = projetar([laboratorio, generico]);
    expect(primeiro.campos.CREATININA?.estado).toBe("PENDENTE");
    expect(segundo.campos.CREATININA?.estado).toBe("PENDENTE");
    expect(primeiro.contentHash).toBe(segundo.contentHash);
  });
});
