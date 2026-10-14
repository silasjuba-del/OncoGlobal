import { expect, it } from "vitest";
import { ConsultaCarregar } from "../../src/contracts/f1/consultaCarregar.js";
import { instanteDoServico } from "../../src/contracts/f1/relogio.js";
import { projetarSnapshot } from "../../src/kernel/projections/snapshot.js";
import type { ClinicalEvent } from "../../src/contracts/operacao.js";
it("o relógio conserva instante e dia civil local junto à meia-noite", () => {
 expect(instanteDoServico(new Date("2026-10-12T02:30:00Z"))).toBe("2026-10-11T23:30:00.000-03:00");
});