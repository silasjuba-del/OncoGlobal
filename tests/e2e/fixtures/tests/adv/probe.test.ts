import { expect, it } from "vitest";

// Fixture de INFRA-01: pertencente a tests/e2e/**, sem editar tests/adv/** do RED.
// A suite regular nao deve executar este teste. Com --root tests/e2e/fixtures,
// o filtro literal "tests/adv" passa a apontar para esta fixture controlada.
it("INFRA-01: execucao explicita encontra a prova vermelha controlada", () => {
  // Falha deliberada: se entrar na suite regular, verify deve ficar vermelho.
  expect("fixture-controlada").toBe("somente-se-nao-executou");
});
