import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { SalaoRuleset } from "../../src/contracts/regras.js";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { avaliarDesfechoPesoSalao } from "../../src/modules/salao/operacaoSalao.js";
import { garantirSchemaSalaoF3, listarRevisoesDesfechoPesoSalaoF3, registrarDesfechoPesoSalaoF3 } from "../../src/server/salaoF3.js";
import { ambiente, EM } from "../bateria2/fixtures.js";

const ruleset = SalaoRuleset.parse(JSON.parse(readFileSync("corpus/rulesets/salao-triagem.v1.json", "utf8")));
const entrada = { patientId: "paciente-peso-sintetico", encounterId: "encontro-peso-sintetico", hoje: "2026-10-19", ruleset,
  pesagens: [{ data: "2026-09-01", kg: 70, origem: "MEDIDO" as const }, { data: "2026-10-19", kg: 64, origem: "MEDIDO" as const }] };

it("correções preservam as pesagens, datas, origens, regra e autoria de cada versão após reabertura", () => {
  const pasta = mkdtempSync(join(tmpdir(), "peso-historico-sintetico-")), caminho = join(pasta, "ledger.sqlite");
  const a = ambiente(caminho);
  try {
    const inicial = registrarDesfechoPesoSalaoF3(a.db, a.acesso, entrada);
    expect(inicial).toMatchObject({ ok: true, versao: 1, replay: false, desfecho: { estadoPeso: "VERMELHO" } });
    const corrigida = { ...entrada, pesagens: [entrada.pesagens[0]!, { data: "2026-10-19", kg: 68, origem: "INFORMADO_PACIENTE" as const }] };
    expect(registrarDesfechoPesoSalaoF3(a.db, { ...a.acesso, agora: "2026-10-19T18:01:00Z" }, corrigida)).toMatchObject({ ok: true, versao: 2, replay: false });
    expect(registrarDesfechoPesoSalaoF3(a.db, { ...a.acesso, agora: "2026-10-19T18:02:00Z" }, corrigida)).toMatchObject({ ok: true, versao: 2, replay: true });
    const historico = listarRevisoesDesfechoPesoSalaoF3(a.db, entrada.patientId, entrada.encounterId);
    expect(historico).toHaveLength(2);
    expect(historico[0]).toMatchObject({ proveniencia: { pesagens: entrada.pesagens, hoje: entrada.hoje, rulesetJson: JSON.stringify(ruleset) },
      registradoEm: EM, autor: { medicoId: "medico-sintetico-a", crm: "CRM-SINTETICO" }, desfecho: { estadoPeso: "VERMELHO" } });
    expect(historico[1]!.proveniencia!.pesagens).toEqual(corrigida.pesagens);
    expect(historico[1]!.entradaSha256).not.toBe(historico[0]!.entradaSha256);
    expect(listarRevisoesDesfechoPesoSalaoF3(a.db, "outro-paciente", entrada.encounterId)).toEqual([]);
    expect(() => a.db.exec("UPDATE salao_desfecho_peso_revisao SET versao=99")).toThrow(/append-only/);
    expect(() => a.db.exec("DELETE FROM salao_desfecho_peso_revisao")).toThrow(/append-only/);
    a.db.close();
    const reaberto = abrirLedger(caminho);
    try { expect(listarRevisoesDesfechoPesoSalaoF3(reaberto, entrada.patientId, entrada.encounterId)).toEqual(historico); }
    finally { reaberto.close(); }
  } finally { try { a.db.close(); } catch { /* já fechado */ } rmSync(pasta, { recursive: true, force: true }); }
});

it("legado conserva JSON original e não inventa pesagens, fontes ou ator", () => {
  const a = ambiente();
  try {
    garantirSchemaSalaoF3(a.db);
    const calculado = avaliarDesfechoPesoSalao(entrada);
    const { recomendacaoNutricao: _n, recomendacaoAdiamentoQt: _q, efeitosLegadosNaoVerificados: _e, ...base } = calculado;
    const legado = JSON.stringify({ ...base, tarefaNutricaoCriada: true, qtAdiada: true });
    a.db.prepare("INSERT INTO salao_desfecho_peso VALUES (?,?,?,?,?)").run("peso-legado-sintetico", entrada.patientId, entrada.encounterId, legado, EM);
    expect(registrarDesfechoPesoSalaoF3(a.db, a.acesso, entrada)).toMatchObject({ ok: true, versao: 2 });
    const h = listarRevisoesDesfechoPesoSalaoF3(a.db, entrada.patientId, entrada.encounterId);
    expect(h[0]).toMatchObject({ origem: "LEGADO_SEM_PROVENIENCIA", entradaSha256: null, proveniencia: null,
      autor: null, legadoOriginalJson: legado, registradoEm: EM });
    expect(h[1]!.proveniencia!.pesagens).toEqual(entrada.pesagens);
  } finally { a.db.close(); }
});

it("falha entre anexar revisão e atualizar projeção reverte ambas sem apagar a evidência anterior", () => {
  const a = ambiente();
  try {
    expect(registrarDesfechoPesoSalaoF3(a.db, a.acesso, entrada).ok).toBe(true);
    const antes = listarRevisoesDesfechoPesoSalaoF3(a.db, entrada.patientId, entrada.encounterId);
    const projecao = a.db.prepare("SELECT desfechoJson,registradoEm FROM salao_desfecho_peso").get();
    a.db.exec("CREATE TRIGGER falha_peso_sintetica BEFORE UPDATE ON salao_desfecho_peso BEGIN SELECT RAISE(ABORT, 'falha_sintetica'); END");
    expect(registrarDesfechoPesoSalaoF3(a.db, a.acesso, { ...entrada, pesagens: [] })).toEqual({ ok: false, codigo: "ARMAZENAMENTO_INDISPONIVEL" });
    expect(listarRevisoesDesfechoPesoSalaoF3(a.db, entrada.patientId, entrada.encounterId)).toEqual(antes);
    expect(a.db.prepare("SELECT desfechoJson,registradoEm FROM salao_desfecho_peso").get()).toEqual(projecao);
  } finally { a.db.close(); }
});
