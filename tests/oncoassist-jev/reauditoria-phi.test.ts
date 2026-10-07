import { expect, it, vi } from "vitest";
import { criarOncoassistJev } from "../../src/app/oncoassist.js";
it("não envia nomes inéditos de familiar/médico nem qualquer texto livre ao provedor", async () => {
  const avaliar = vi.fn().mockResolvedValue(null);
  const service = criarOncoassistJev({ env: { ONCOASSIST_JEV_ENABLED: "true", TYPESAFE_API_KEY: "teste" }, transporte: { avaliar } });
  const contexto = { dicionario: { nomes: ["Paciente Teste 01"], identificadores: [] } };
  const base = "Hemograma. Creatinina. Paciente Teste 01.";
  await service.avaliar({ fonte: { id: "fonte", texto: base } }, contexto);
  await service.avaliar({ fonte: { id: "fonte", texto: `${base} Familiar: Zorélia Vintalux. Médico: Dr. Xandor Velquim. Rua Nebulosa 421. marcador_unico_987.` } }, contexto);
  expect(avaliar).toHaveBeenCalledTimes(2);
  expect(avaliar.mock.calls[1]![0]).toEqual(avaliar.mock.calls[0]![0]);
  expect(avaliar.mock.calls[1]![0]).toContain("Hemograma");
});

it("fonte sem marcador documental permanece pendente sem chamar provedor", async () => {
  const avaliar = vi.fn();
  const service = criarOncoassistJev({ env: { ONCOASSIST_JEV_ENABLED: "true", TYPESAFE_API_KEY: "teste" }, transporte: { avaliar } });
  expect(await service.avaliar({ fonte: { id: "fonte", texto: "Zorélia Vintalux, Rua Nebulosa 421" } },
    { dicionario: { nomes: ["Paciente Teste 01"], identificadores: [] } })).toMatchObject({ status: "PENDENTE" });
  expect(avaliar).not.toHaveBeenCalled();
});
