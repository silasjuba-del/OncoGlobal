import { expect, it } from "vitest";
import { avaliarExposicaoCumulativa, type AdministracaoExposicao, type LimiteExposicaoCumulativa } from "../../src/rules/cumulativoAlerta.js";

const admin = (adminId: string, dose: number, unidade: string): AdministracaoExposicao => ({
  adminId, patientId: "paciente-sintetico", episodioId: "ep-sintetico", droga: "doxorrubicina",
  status: "COMPLETA", quantidadeEfetivaMgM2: dose, unidade, fonte: `fonte-${adminId}`,
});
const limite: LimiteExposicaoCumulativa = {
  ativo: true, regraId: "teto-sintetico", versao: "1", droga: "doxorrubicina",
  unidade: "mg/m2", maximo: 550, comparador: "GT", fonte: "teto sintético",
};

it("unidade conhecida diferente do teto fica pendente e não entra como dentro do limite", () => {
  const r = avaliarExposicaoCumulativa({
    patientId: "paciente-sintetico", droga: "doxorrubicina", historicoCompleto: true,
    fonteCompletude: "histórico sintético conferido",
    administracoes: [admin("a1", 200, "mg/m2"), admin("a2", 150, "mg/m2"), admin("a3", 80, "U")],
  }, limite);
  expect(r.estado).toBe("PENDENTE");
  expect(r.pendencias).toContain("UNIDADE_DIVERGENTE:a3");
  expect(r.totalConhecidoMgM2).toBe(350);
  expect(r.totalMgM2).toBeNull();
  expect(r.estado).not.toBe("SEM_AVISO");
});
