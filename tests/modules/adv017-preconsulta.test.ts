// Copiado de RED2725f4c; prova independente K-17/ADV-017.
import { describe, expect, it } from "vitest";
import { montarPreConsulta } from "../../src/modules/consulta/preConsulta.js";
import { entrada, snapshot } from "./fixtures.js";

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
  it("ADV-017 · proposta RAW no lugar do fato não confirma resolução", () => {
    const pack = montarPreConsulta(entrada(
      snapshot({ snapshotId: "novo", patientId: "Paciente Teste 01", fatos:
        [{ campo: "queixa", valor: "proposta sintética", revisao: "RAW" as "CONFIRMADO" }] }),
      snapshot({ snapshotId: "antes", patientId: "Paciente Teste 01", fatos:
        [{ campo: "queixa", valor: "nota confirmada", revisao: "CONFIRMADO" }] }),
    ));
    expect(pack.oQueMudou.estado).toBe("PENDENTE");
    expect(pack.oQueMudou.itens).toEqual([
      { campo: "queixa", kind: "PERSISTE", antes: "nota confirmada", depois: null, direcao: null },
    ]);
  });
  it("ADV-017 · conflito confirmado permanece vermelho quando o campo some", () => {
    const pack = montarPreConsulta(entrada(
      snapshot({ snapshotId: "novo", patientId: "Paciente Teste 01" }),
      snapshot({ snapshotId: "antes", patientId: "Paciente Teste 01", fatos: [
        { campo: "queixa", valor: "primeira nota", revisao: "CONFIRMADO" },
        { campo: "queixa", valor: "nota divergente", revisao: "CONFIRMADO" },
      ] }),
    ));
    expect(pack.oQueMudou.estado).toBe("VERMELHO");
    expect(pack.oQueMudou.camposConflitantes).toEqual(["queixa"]);
    expect(pack.oQueMudou.itens).toEqual([]);
  });
});
