import { expect, it, vi } from "vitest";

vi.mock("node:crypto", async importOriginal => ({
  ...await importOriginal<typeof import("node:crypto")>(),
  randomUUID: () => "aaaaaaaa-aaaa-4aaa-8aaa-" + "119999" + "999999",
}));

import { criarAvisoMedicoSemPhiF6 } from "../../src/modules/setores/rbacSetorialF6.js";
import { contemPhiResidual } from "../../src/kernel/llm/desidentificar.js";

it("UUID com sequencia numerica nao transforma um aviso opaco em telefone", () => {
  const aviso = criarAvisoMedicoSemPhiF6({
    setorOrigem: "TRIAGEM", urgencia: "EMERGENCIA_E1", codigoEventoOpaco: "EMERGENCIA_E1_NO_SALAO",
    identificadorInternoParaHashOpaco: "pt-f6-01:enc-f6-01", criadoEm: "2026-10-19T18:00:00Z",
  });
  expect(contemPhiResidual(JSON.stringify(aviso), { nomes: [], identificadores: [] })).toBe(false);
  expect(aviso.avisoId).toMatch(/^aviso-[a-p-]+$/);
  expect(contemPhiResidual("Contato " + "(11) " + "99999-9999", { nomes: [], identificadores: [] })).toBe(true);
});
