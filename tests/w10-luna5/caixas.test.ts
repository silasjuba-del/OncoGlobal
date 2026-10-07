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

describe("W10 F10 · caixa numerada e envelope operacional", () => {
  it("grava alteração tipada e versionada com antes/depois/autoria, e reabre o histórico", () => {
    const path = root(); const settings = service(path);
    const first = settings.changeBox({ numero: 7, valorNovo: "002605473", expectedRevision: 0, operationId: "box-change-0001", motivo: "cabeçalho local" }, SESSION);
    expect(first).toMatchObject({ estado: "GRAVADA", revision: 1 });
    const event = first.alteracoes[0]!;
    expect(AlteracaoCaixa.parse(event)).toEqual({ numero: 7, valorAnterior: null, valorNovo: "002605473",
      por: SESSION.medicoId, em: NOW(), motivo: "cabeçalho local" });
    expect(Object.keys(event).sort()).toEqual(["em", "motivo", "numero", "por", "valorAnterior", "valorNovo"]);
    expect(settings.changeBox({ numero: 7, valorNovo: "002605473", expectedRevision: 0, operationId: "box-change-0001", motivo: "cabeçalho local" }, SESSION).estado).toBe("REPLAY");
    expect(settings.changeBox({ numero: 7, valorNovo: "999999999", expectedRevision: 0, operationId: "box-change-0001", motivo: "cabeçalho local" }, SESSION)).toMatchObject({ estado: "NEGADA", motivo: "IDEMPOTENCY_CONFLICT" });
    expect(settings.readBox(7, SESSION)).toEqual({ revision: 1, value: "002605473" });
    settings.close();
    const reopened = service(path);
    const history = reopened.readHistory(SESSION);
    expect(history).toHaveLength(1);
    expect(history[0]!).toEqual({ tipo: "PROVISORIO-W10", operationId: "box-change-0001", revision: 1, alteracoes: first.alteracoes, proveniencia: null });
    reopened.close();
  });

  it("recusa caixa desconhecida, SISTEMA, tipo inválido, catálogo duplicado e sessão expirada", () => {
    expect(() => service(root(), [...PROFILE_BOXES, PROFILE_BOXES[0]!])).toThrow("CATALOGO_CAIXAS_DUPLICADO");
    const duplicateKey = PROFILE_BOXES.map((box, index) => index === 1 ? { ...box, chave: PROFILE_BOXES[0]!.chave } : box);
    expect(() => service(root(), duplicateKey)).toThrow("CATALOGO_CAIXAS_DUPLICADO");
    const settings = service(root());
    expect(() => settings.changeBox({ numero: 404, valorNovo: "x", expectedRevision: 0, operationId: "unknown-box-001" }, SESSION)).toThrow("CAIXA_DESCONHECIDA");
    expect(() => settings.changeBox({ numero: 99, valorNovo: 3, expectedRevision: 0, operationId: "system-box-0001" }, SESSION)).toThrow("CAIXA_SISTEMA_NAO_EDITAVEL");
    expect(() => settings.changeBox({ numero: 7, valorNovo: 2605473, expectedRevision: 0, operationId: "bad-type-00001" }, SESSION)).toThrow("TIPO_CAIXA_INVALIDO");
    expect(() => settings.readProfile({ ...SESSION, expiraEm: "2026-10-07T12:59:00.000Z" })).toThrow("SESSAO_INVALIDA");
    settings.close();
  });

  it("não permite que saveProfile contorne editabilidade ou tipo do catálogo", () => {
    const systemBox = PROFILE_BOXES.map((box) => box.numero === 1 ? { ...box, editavelPor: "SISTEMA" as const } : box);
    const wrongType = PROFILE_BOXES.map((box) => box.numero === 1 ? { ...box, tipo: "NUMERO" as const } : box);
    const profile = perfilVazio(); profile.medico.nome = "Médico de teste";
    const systemSettings = service(root(), systemBox);
    expect(() => systemSettings.saveProfile({ operationId: "profile-system-001", expectedRevision: 0, perfil: profile }, SESSION)).toThrow("CAIXA_CONFIG_INVALIDA");
    systemSettings.close();
    const typeSettings = service(root(), wrongType);
    expect(() => typeSettings.saveProfile({ operationId: "profile-type-0001", expectedRevision: 0, perfil: profile }, SESSION)).toThrow("CAIXA_CONFIG_INVALIDA");
    typeSettings.close();
  });

  it("preserva a primeira gravação diante de revisão velha e não atribui replay a outro médico", () => {
    const settings = service(root());
    const first = settings.changeBox({ numero: 7, valorNovo: "0001", expectedRevision: 0, operationId: "box-expected-0001" }, SESSION);
    expect(first.estado).toBe("GRAVADA");
    const stale = settings.changeBox({ numero: 7, valorNovo: "0002", expectedRevision: 0, operationId: "box-stale-00001" }, SESSION);
    expect(stale).toMatchObject({ estado: "CONFLITO", revision: 1, alteracoes: [] });
    const otherActor = { ...SESSION, medicoId: "medico-sintetico-02" };
    expect(settings.changeBox({ numero: 7, valorNovo: "0001", expectedRevision: 0, operationId: "box-expected-0001" }, otherActor))
      .toMatchObject({ estado: "NEGADA", motivo: "IDEMPOTENCY_CONFLICT" });
    expect(settings.readBox(7, SESSION).value).toBe("0001");
    settings.close();
  });

  it("faz snapshot, evento e idempotência na mesma transação e permite retry após rollback", () => {
    const path = root(); const settings = service(path);
    const db = new DatabaseSync(join(path, "config-w10.sqlite"));
    try {
      db.exec("CREATE TRIGGER test_fail_event BEFORE INSERT ON settings_event BEGIN SELECT RAISE(ABORT, 'injected failure'); END");
      expect(() => settings.changeBox({ numero: 7, valorNovo: "0009", expectedRevision: 0, operationId: "box-rollback-001" }, SESSION)).toThrow();
      expect(settings.readBox(7, SESSION)).toEqual({ revision: 0, value: null });
      db.exec("DROP TRIGGER test_fail_event");
      expect(settings.changeBox({ numero: 7, valorNovo: "0009", expectedRevision: 0, operationId: "box-rollback-001" }, SESSION).estado).toBe("GRAVADA");
      expect(settings.readHistory(SESSION)).toHaveLength(1);
    } finally { db.close(); settings.close(); }
  });

  it("só marca DECISAO_MEDICA numa regra explicitamente autorizada e exige autorização médica", () => {
    const settings = service(root());
    expect(() => settings.changeBox({ numero: 90, valorNovo: { regra: "valor sintético" }, expectedRevision: 0, operationId: "rule-without-auth-01" }, SESSION))
      .toThrow("AUTORIZACAO_MEDICA_EXPLICITA_OBRIGATORIA");
    const changed = settings.changeBox({ numero: 90, valorNovo: { regra: "valor sintético" }, expectedRevision: 0,
      operationId: "rule-authorized-001", autorizacaoMedica: true, motivo: "confirmado pelo médico" }, SESSION);
    expect(changed.proveniencia).toBe("DECISAO_MEDICA");
    expect(settings.readHistory(SESSION)[0]!.proveniencia).toBe("DECISAO_MEDICA");
    settings.close();
  });

  it("usa o perfil como valor anterior canônico para tema/sincronização e mantém a preferência sem ativar a conexão", () => {
    const settings = service(root());
    expect(settings.readBox(8, SESSION)).toEqual({ revision: 0, value: "DIA" });
    expect(settings.readBox(11, SESSION)).toEqual({ revision: 0, value: false });
    const theme = settings.changeBox({ numero: 8, valorNovo: "NOITE", expectedRevision: 0, operationId: "theme-noite-0001" }, SESSION);
    expect(theme.alteracoes[0]).toMatchObject({ valorAnterior: "DIA", valorNovo: "NOITE" });
    const sync = settings.changeBox({ numero: 11, valorNovo: true, expectedRevision: 1, operationId: "sync-pref-00001" }, SESSION);
    expect(sync.alteracoes[0]).toMatchObject({ valorAnterior: false, valorNovo: true });
    expect(settings.readProfile(SESSION).perfil.preferencias.tema).toBe("NOITE");
    expect(settings.readProfile(SESSION).perfil.preferencias.sincronizarTelefone).toBe(true);
    expect(settings.readProfile(SESSION).perfil.conexoes.telefone.habilitada).toBe(false);
    settings.close();
  });

  it("rejeita uma transição de tema inválida sem revisão/evento e valida o perfil completo antes de gravar", () => {
    const settings = service(root());
    expect(() => settings.changeBox({ numero: 8, valorNovo: "PERSONALIZAR", expectedRevision: 0, operationId: "theme-invalid-01" }, SESSION))
      .toThrow("CONFIGURACAO_INCONSISTENTE");
    expect(settings.readBox(8, SESSION)).toEqual({ revision: 0, value: "DIA" });
    expect(settings.readHistory(SESSION)).toHaveLength(0);

    const layout = settings.changeBox({ numero: 9, valorNovo: "escuro-composto", expectedRevision: 0, operationId: "layout-first-0001" }, SESSION);
    expect(layout.estado).toBe("GRAVADA");
    const theme = settings.changeBox({ numero: 8, valorNovo: "PERSONALIZAR", expectedRevision: 1, operationId: "theme-custom-001" }, SESSION);
    expect(theme.alteracoes[0]).toMatchObject({ valorAnterior: "DIA", valorNovo: "PERSONALIZAR" });
    expect(settings.readProfile(SESSION).perfil.preferencias).toMatchObject({ tema: "PERSONALIZAR", layoutPersonalizado: "escuro-composto" });
    expect(settings.readHistory(SESSION)).toHaveLength(2);
    settings.close();
  });

  it("normaliza texto vazio como null em evento, snapshot, perfil e readBox; preserva edição de listas", () => {
    const settings = service(root());
    settings.changeBox({ numero: 7, valorNovo: "0001234", expectedRevision: 0, operationId: "cnes-set-000001" }, SESSION);
    const cleared = settings.changeBox({ numero: 7, valorNovo: "   ", expectedRevision: 1, operationId: "cnes-clear-00001" }, SESSION);
    expect(cleared.alteracoes[0]).toMatchObject({ valorAnterior: "0001234", valorNovo: null });
    expect(settings.readBox(7, SESSION)).toEqual({ revision: 2, value: null });
    expect(settings.readProfile(SESSION).perfil.instituicao.cnes).toBeNull();
    const list = settings.changeBox({ numero: 14, valorNovo: [" skill-a ", "", "skill-b"], expectedRevision: 2, operationId: "skills-edit-0001" }, SESSION);
    expect(list.alteracoes[0]).toMatchObject({ valorAnterior: [], valorNovo: ["skill-a", "skill-b"] });
    expect(settings.readBox(14, SESSION).value).toEqual(["skill-a", "skill-b"]);
    expect(settings.readProfile(SESSION).perfil.conexoes.skills.selecionadas).toEqual(["skill-a", "skill-b"]);
    expect(settings.readProfile(SESSION).perfil.conexoes.skills.habilitada).toBe(false);
    settings.close();
  });

  it("não grava caixa APAC no escopo global sem contexto do paciente", () => {
    const settings = service(root());
    expect(() => settings.changeBox({ numero: 120, valorNovo: "0001234", expectedRevision: 0, operationId: "apac-global-001" }, SESSION))
      .toThrow("CONTEXTO_PACIENTE_OBRIGATORIO");
    expect(settings.readHistory(SESSION)).toHaveLength(0);
    settings.close();
  });

  it("recusa null em preferência booleana obrigatória sem divergência entre evento e leitura", () => {
    const settings = service(root());
    const enabledPreference = settings.changeBox({ numero: 11, valorNovo: true, expectedRevision: 0, operationId: "sync-pref-true-01" }, SESSION);
    expect(enabledPreference.alteracoes[0]).toMatchObject({ valorAnterior: false, valorNovo: true });
    expect(settings.readBox(11, SESSION)).toEqual({ revision: 1, value: true });
    expect(() => settings.changeBox({ numero: 11, valorNovo: null, expectedRevision: 1, operationId: "sync-pref-null-01" }, SESSION))
      .toThrow("TIPO_CAIXA_INVALIDO");
    expect(settings.readBox(11, SESSION)).toEqual({ revision: 1, value: true });
    expect(settings.readHistory(SESSION)).toHaveLength(1);
    settings.close();
  });

  it("nega CRM em branco e sessão emitida no futuro sem atribuir DECISAO_MEDICA", () => {
    const settings = service(root());
    const rule = { numero: 90, valorNovo: { regra: "valor sintético" }, expectedRevision: 0,
      operationId: "rule-invalid-session-01", autorizacaoMedica: true };
    expect(() => settings.changeBox(rule, { ...SESSION, crm: "   " })).toThrow("SESSAO_INVALIDA");
    expect(() => settings.changeBox({ ...rule, operationId: "rule-future-session-01" }, {
      ...SESSION, emitidaEm: "2026-10-07T14:00:00.000Z",
    })).toThrow("SESSAO_INVALIDA");
    expect(settings.readProfile(SESSION).revision).toBe(0);
    expect(settings.readHistory(SESSION)).toHaveLength(0);
    expect(settings.readBox(90, SESSION).value).toBeNull();
    settings.close();
  });

  it("reproduz replay idempotente antes da validação contra perfil atual mais novo", () => {
    const settings = service(root());
    const clear = { numero: 9, valorNovo: null, expectedRevision: 0, operationId: "clear-layout-001" };
    expect(settings.changeBox(clear, SESSION).estado).toBe("GRAVADA");
    expect(settings.changeBox({ numero: 9, valorNovo: "compacto", expectedRevision: 1, operationId: "set-layout-compact-01" }, SESSION).estado).toBe("GRAVADA");
    expect(settings.changeBox({ numero: 8, valorNovo: "PERSONALIZAR", expectedRevision: 2, operationId: "set-theme-custom-01" }, SESSION).estado).toBe("GRAVADA");

    expect(settings.changeBox(clear, SESSION).estado).toBe("REPLAY");
    expect(settings.readProfile(SESSION)).toMatchObject({ revision: 3, perfil: { preferencias: { tema: "PERSONALIZAR", layoutPersonalizado: "compacto" } } });
    expect(settings.readHistory(SESSION)).toHaveLength(3);
    settings.close();
  });
});
