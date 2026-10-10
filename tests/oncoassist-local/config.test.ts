import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { configuracaoOncoassistLocal, iniciarOncoassistLocal } from "../../src/app/oncoassistLocal.js";

const env = { ONCOGLOBAL_SENHA: "senha-sintetica-para-teste", ONCOGLOBAL_MEDICO_ID: "medico-teste", ONCOGLOBAL_CRM: "CRM-TESTE" };
const pasta = join(tmpdir(), "oncoassist-config-test");

describe("composição do servidor OncoAssist local", () => {
  it("exige diretório explícito e identidade sem credenciais de fallback", () => {
    expect(() => configuracaoOncoassistLocal([], env)).toThrow("DATA_DIR_ABSOLUTO_OBRIGATORIO");
    expect(() => configuracaoOncoassistLocal(["--data-dir", "relativo"], env)).toThrow("DATA_DIR_ABSOLUTO_OBRIGATORIO");
    expect(() => configuracaoOncoassistLocal(["--data-dir", pasta], {})).toThrow("CREDENCIAIS_LOCAIS_AUSENTES");
    expect(() => configuracaoOncoassistLocal(["--data-dir", pasta], { ...env, ONCOGLOBAL_CRM: " " }))
      .toThrow("CREDENCIAIS_LOCAIS_AUSENTES");
  });
  it.each(["0", "65536", "-1", "1.5", "http://externo", "4181/../../", "Infinity"])("rejeita porta %s", (port) => {
    expect(() => configuracaoOncoassistLocal(["--data-dir", pasta], { ...env, ONCOGLOBAL_API_PORT: port }))
      .toThrow("PORTA_INVALIDA");
  });
  it("aceita configuração local sem exigir uma chave externa", () => {
    const config = configuracaoOncoassistLocal(["--data-dir", pasta], { ...env, ONCOGLOBAL_API_PORT: "4182" });
    expect(config.port).toBe(4182);
    expect(config.medicoId).toBe("medico-teste");
    expect(config.crm).toBe("CRM-TESTE");
    expect(config.dataDir).toBe(pasta);
  });
  it("não aceita senha na linha de comando", () => {
    expect(() => configuracaoOncoassistLocal(["--data-dir", pasta, "--senha", "qualquer-segredo"], env))
      .toThrow("ARGUMENTOS_INVALIDOS");
  });
  it("diretório sem ledger continua vazio, sem criação ou seed silencioso", async () => {
    const dir = mkdtempSync(join(tmpdir(), "oncoassist-vazio-"));
    try {
      await expect(iniciarOncoassistLocal({ ...configuracaoOncoassistLocal(["--data-dir", dir], env) }))
        .rejects.toThrow("LEDGER_LOCAL_AUSENTE");
      expect(readdirSync(dir)).toEqual([]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
