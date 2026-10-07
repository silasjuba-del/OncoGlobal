import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { AlteracaoCaixa } from "../../src/contracts/w10/clinico-w10.js";
import { createSettingsService, type SettingsService } from "../../src/config/settings.js";
import { NOW, PROFILE_BOXES, SESSION, novoDiretorio, perfilVazio, removerDiretorio } from "./helpers.js";

const dirs: string[] = [];
const services = new Set<SettingsService>();
afterEach(() => {
  for (const settings of services) settings.close();
  services.clear();
  for (const dir of dirs.splice(0)) removerDiretorio(dir);
});
function root(): string { const path = novoDiretorio(); dirs.push(path); return path; }
function service(path: string, catalog = PROFILE_BOXES) {
  const inner = createSettingsService({ rootDir: path, caixas: catalog, now: NOW });
  let closed = false;
  const tracked: SettingsService = { ...inner, close() { if (!closed) { closed = true; inner.close(); } } };
  services.add(tracked);
  return tracked;
}

describe("W10 F09 · perfil e conexões locais", () => {
  it("separa médico/instituição, mantém ausências nulas e mostra CNES de exemplo sem confirmá-lo", () => {
    const path = root(); const settings = service(path);
    const initial = settings.readProfile(SESSION);
    expect(initial.revision).toBe(0);
    expect(initial.perfil.medico).toEqual({ nome: null, crm: null, rqe: null, telefone: null, cns: null });
    expect(initial.perfil.instituicao).toEqual({ hospital: null, cnes: null });
    expect(initial.perfil.conexoes.sites.habilitada).toBe(false);
    expect(initial.perfil.conexoes.telefone.habilitada).toBe(false);
    expect(initial.perfil.conexoes.impressoraRede.habilitada).toBe(false);
    expect(initial.perfil.conexoes.skills.habilitada).toBe(false);
    expect(initial.perfil.conexoes.plugins.habilitada).toBe(false);
    expect(initial.perfil.conexoes.mcp.habilitada).toBe(false);
    expect(initial.exemplos.cnes).toEqual({ valor: "2605473", confirmado: false, editavel: true });
    expect(initial.perfil.instituicao.cnes).toBeNull();
    settings.close();
  });

  it("salva, fecha e reabre dados separados, preserva zeros e nunca ativa conexões", () => {
    const path = root(); const settings = service(path);
    const perfil = perfilVazio();
    perfil.medico.nome = "Médico de teste"; perfil.medico.crm = "CRM-PB 001"; perfil.medico.rqe = "0007";
    perfil.medico.telefone = "083000000000"; perfil.medico.cns = "000000000000001";
    perfil.instituicao.hospital = "Hospital exemplo editável"; perfil.instituicao.cnes = "002605473";
    perfil.preferencias.tema = "PERSONALIZAR"; perfil.preferencias.layoutPersonalizado = "compacto";
    perfil.preferencias.impressora = "Impressora local selecionada";
    perfil.preferencias.sincronizarTelefone = true;
    perfil.conexoes.sites.endereco = "https://exemplo.invalid";
    perfil.conexoes.sites.habilitada = true;
    perfil.conexoes.telefone.habilitada = true;
    perfil.conexoes.impressoraRede.endereco = "Impressora da rede"; perfil.conexoes.impressoraRede.habilitada = true;
    perfil.conexoes.skills.selecionadas = ["skill-configurada"]; perfil.conexoes.skills.habilitada = true;
    perfil.conexoes.plugins.selecionados = ["plugin-configurado"]; perfil.conexoes.plugins.habilitada = true;
    perfil.conexoes.mcp.selecionados = ["mcp-configurado"]; perfil.conexoes.mcp.habilitada = true;
    const saved = settings.saveProfile({ operationId: "profile-save-0001", expectedRevision: 0, perfil }, SESSION);
    expect(saved.estado).toBe("GRAVADA");
    expect(saved.revision).toBe(1);
    expect(saved.alteracoes.some((event) => event.numero === 9)).toBe(true); // layoutPersonalizado has its own numbered change.
    expect(saved.alteracoes.every((event) => event.por === SESSION.medicoId)).toBe(true);
    settings.close();

    const reopened = service(path); const actual = reopened.readProfile(SESSION);
    expect(actual.revision).toBe(1);
    expect(actual.perfil.medico.cns).toBe("000000000000001");
    expect(actual.perfil.medico.rqe).toBe("0007");
    expect(actual.perfil.instituicao.cnes).toBe("002605473");
    expect(actual.perfil.instituicao.hospital).toBe("Hospital exemplo editável");
    expect(actual.perfil.medico.nome).toBe("Médico de teste");
    expect(actual.perfil.conexoes.sites.habilitada).toBe(false);
    expect(actual.perfil.conexoes.telefone.habilitada).toBe(false);
    expect(actual.perfil.conexoes.impressoraRede.habilitada).toBe(false);
    expect(actual.perfil.conexoes.skills.habilitada).toBe(false);
    expect(actual.perfil.conexoes.plugins.habilitada).toBe(false);
    expect(actual.perfil.conexoes.mcp.habilitada).toBe(false);
    expect(actual.perfil.preferencias.sincronizarTelefone).toBe(true); // saved preference does not activate the connector.
    reopened.close();
  });

  it("migra dado antigo/malformado com toda conexão desligada e campos ausentes em null", () => {
    const path = root(); const first = service(path); first.close();
    const db = new DatabaseSync(join(path, "config-w10.sqlite"));
    try {
      db.prepare("INSERT INTO settings_snapshot(singleton,revision,payload) VALUES(1,1,?)").run(JSON.stringify({
        perfil: { medico: { crm: "CRM legado" }, instituicao: { cnes: "0000123" },
          preferencias: { tema: "NAO_SUPORTADO", sincronizarTelefone: true },
          conexoes: { sites: { endereco: "https://exemplo.invalid", habilitada: true },
            telefone: { habilitada: true }, mcp: { habilitada: true } } }, caixas: {},
      }));
    } finally { db.close(); }
    const reopened = service(path); const migrated = reopened.readProfile(SESSION).perfil;
    expect(migrated.medico.crm).toBe("CRM legado");
    expect(migrated.medico.nome).toBeNull();
    expect(migrated.instituicao.cnes).toBe("0000123");
    expect(migrated.preferencias.tema).toBe("DIA");
    expect(migrated.preferencias.sincronizarTelefone).toBe(true);
    expect(migrated.conexoes.sites.habilitada).toBe(false);
    expect(migrated.conexoes.telefone.habilitada).toBe(false);
    expect(migrated.conexoes.mcp.habilitada).toBe(false);
    reopened.close();
  });

  it("valida tema/layout e sites sem habilitar uma conexão", () => {
    const settings = service(root());
    const perfil = perfilVazio(); perfil.preferencias.tema = "PERSONALIZAR";
    expect(() => settings.saveProfile({ operationId: "profile-invalid-01", expectedRevision: 0, perfil }, SESSION)).toThrow();
    const unsupported = perfilVazio(); unsupported.conexoes.sites.endereco = "javascript:alert(1)";
    expect(() => settings.saveProfile({ operationId: "profile-invalid-02", expectedRevision: 0, perfil: unsupported }, SESSION)).toThrow();
    settings.close();
  });
});
