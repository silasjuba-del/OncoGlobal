import { describe, expect, it } from "vitest";
import { montarPreConsulta } from "../../src/modules/consulta/preConsulta.js";
import { entrada, snapshot } from "../modules/fixtures.js";

const montar = (anterior: string, atual: string | null) => montarPreConsulta(entrada(
  snapshot({ snapshotId: "novo", patientId: "Paciente Teste 01", fatos: atual === null ? [] :
    [{ campo: "queixa", valor: atual, revisao: "CONFIRMADO" }] }),
  snapshot({ snapshotId: "antes", patientId: "Paciente Teste 01", fatos:
    [{ campo: "queixa", valor: anterior, revisao: "CONFIRMADO" }] }),
));

describe("F11/F6 · ADV-017 segunda implementação do delta K-17", () => {
  it("ADV-017 · omissão de fato confirmado não declara resolução", () => {
    const delta = montar("nota sintética", null).oQueMudou;
    expect(delta.itens[0]?.kind).toBe("PERSISTE");
    expect(delta.estado).toBe("PENDENTE");
  });
  it("ADV-017 · mesmo fato ainda presente persiste sem direção inventada", () => {
    expect(montar("nota sintética", "nota sintética").oQueMudou.itens[0])
      .toMatchObject({ kind: "PERSISTE", direcao: null });
  });
  it("ADV-017 · fato diferente é mudança sem inferir melhora clínica", () => {
    expect(montar("antes sintético", "agora sintético").oQueMudou.itens[0])
      .toMatchObject({ kind: "MUDOU", direcao: null });
  });
});
