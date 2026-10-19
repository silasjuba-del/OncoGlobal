import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { DesfechoPesoSalao } from "../../src/contracts/f3/salaoOperacional.js";
import { SalaoRuleset } from "../../src/contracts/regras.js";
import { avaliarDesfechoPesoSalao, organizarFilaSalaoF3 } from "../../src/modules/salao/operacaoSalao.js";
import { ordenarFila } from "../../src/rules/fila.js";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { garantirSchemaSalaoF3, registrarDesfechoPesoSalaoF3 } from "../../src/server/salaoF3.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";

const rs = SalaoRuleset.parse(JSON.parse(readFileSync("corpus/rulesets/salao-triagem.v1.json", "utf8")));
const hoje = "2026-10-18";
function peso(kg = 64.9, origem: "MEDIDO" | "INFORMADO_PACIENTE" = "MEDIDO") {
  return { patientId: "paciente-sintetico", encounterId: "encontro-sintetico", hoje, ruleset: rs,
    pesagens: [{ data: "2026-09-01", kg: 70, origem: "MEDIDO" as const }, { data: hoje, kg, origem }] };
}

it.each([
  [65, "MEDIDO", "VERDE", "NAO_INDICADA"],
  [64.9, "MEDIDO", "VERMELHO", "PENDENTE_DECISAO_MEDICA"],
  [64, "INFORMADO_PACIENTE", "PENDENTE", "NAO_AVALIADA"],
] as const)("peso %s %s mantem corte %s e recomendacao %s sem execucao", (kg, origem, estado, recomendacao) => {
  const entrada = peso(kg, origem), anterior = structuredClone(entrada);
  const r = avaliarDesfechoPesoSalao(entrada);
  expect(r).toMatchObject({ estadoPeso: estado, tarefaNutricaoCriada: false, qtAdiada: false,
    recomendacaoNutricao: recomendacao, recomendacaoAdiamentoQt: recomendacao, passaEmConsultaMedica: true,
    rulesetVersao: rs.header.versao });
  expect(entrada).toEqual(anterior);
});

it("contrato rejeita efeitos inventados e recomendacao divergente do corte", () => {
  const r = avaliarDesfechoPesoSalao(peso());
  expect(DesfechoPesoSalao.safeParse({ ...r, tarefaNutricaoCriada: true }).success).toBe(false);
  expect(DesfechoPesoSalao.safeParse({ ...r, qtAdiada: true }).success).toBe(false);
  expect(DesfechoPesoSalao.safeParse({ ...r, recomendacaoNutricao: "NAO_INDICADA" }).success).toBe(false);
});

it("legado vermelho com marcadores true vira recomendacao pendente sem mutar a fonte", () => {
  const { recomendacaoNutricao: _, recomendacaoAdiamentoQt: __, efeitosLegadosNaoVerificados: ___, ...base } = avaliarDesfechoPesoSalao(peso());
  const legado = { ...base, tarefaNutricaoCriada: true, qtAdiada: true };
  const original = structuredClone(legado);
  expect(DesfechoPesoSalao.parse(legado)).toMatchObject({ tarefaNutricaoCriada: false, qtAdiada: false,
    recomendacaoNutricao: "PENDENTE_DECISAO_MEDICA", recomendacaoAdiamentoQt: "PENDENTE_DECISAO_MEDICA" });
  const lido = DesfechoPesoSalao.parse(legado);
  expect(lido.efeitosLegadosNaoVerificados).toEqual({ tarefaNutricaoCriada: true, qtAdiada: true, verificacao: "NAO_VERIFICADO" });
  expect(DesfechoPesoSalao.parse(lido)).toEqual(lido);
  expect(legado).toEqual(original);
});

it("persistencia registra somente desfecho pendente, sem Tarefa ou alteracao de agenda", () => {
  const db = abrirLedger(":memory:");
  try {
    const agora = "2026-10-18T12:00:00.000Z";
    const sessoes = criarGerenciadorSessao({ medicoId: "medico-sintetico", crm: "CRM-SINTETICO", senha: "senha-sintetica-pendencias", duracaoMs: 300000, agora: () => agora });
    const acesso = { sessoes, token: sessoes.login("senha-sintetica-pendencias")!.token, agora };
    const antes = db.prepare("SELECT * FROM clinical_event").all();
    const resultado = registrarDesfechoPesoSalaoF3(db, acesso, peso());
    expect(resultado).toMatchObject({ ok: true, desfecho: { qtAdiada: false, tarefaNutricaoCriada: false,
      recomendacaoAdiamentoQt: "PENDENTE_DECISAO_MEDICA", recomendacaoNutricao: "PENDENTE_DECISAO_MEDICA" } });
    expect(db.prepare("SELECT * FROM clinical_event").all()).toEqual(antes);
    const row = db.prepare("SELECT desfechoJson FROM salao_desfecho_peso").get() as { desfechoJson: string };
    expect(resultado.ok && DesfechoPesoSalao.parse(JSON.parse(row.desfechoJson))).toEqual(resultado.ok && resultado.desfecho);
  } finally { db.close(); }
});

it.each(["CAMA", "CADEIRA", "AMBULATORIAL"] as const)("corte e pendencia levam %s ao medico; ausencia explicita permite destino vigente", recurso => {
  const base = { patientId: "paciente-fila", ecog: 1, recurso, idadeAnos: 65, chegadaEm: "2026-10-18T09:00:00Z" };
  for (const flags of [{ temCorte: true }, { temPendencia: true }, { temCorte: true, temPendencia: true }]) {
    expect(organizarFilaSalaoF3([{ ...base, ...flags }], rs).destinosPorEntrada[0]?.destino).toBe("FILA_MEDICO");
  }
  expect(organizarFilaSalaoF3([{ ...base, temCorte: false, temPendencia: false }], rs).destinosPorEntrada[0]?.destino)
    .toBe(recurso === "AMBULATORIAL" ? "SALAO" : "FRENTE");
});

it("destinos aditivos nao mudam ordenacao, desempate, entrada ou escalonamento E1", () => {
  const entradas = [
    { patientId: "e1-chegou-depois", ecog: 1, recurso: "AMBULATORIAL" as const, idadeAnos: 60, chegadaEm: "2026-10-18T10:00:00Z", emergencia: true, temPendencia: true },
    { patientId: "cama-com-corte", ecog: 2, recurso: "CAMA" as const, idadeAnos: 60, chegadaEm: "2026-10-18T09:00:00Z", temCorte: true },
    { patientId: "ecog4", ecog: 4, recurso: "AMBULATORIAL" as const, idadeAnos: 60, chegadaEm: "2026-10-18T11:00:00Z", temCorte: false, temPendencia: false },
    { patientId: "idoso-sem-corte", ecog: 1, recurso: "AMBULATORIAL" as const, idadeAnos: 81, chegadaEm: "2026-10-18T08:00:00Z", temCorte: false, temPendencia: false },
    { patientId: "idade-ausente", ecog: 1, recurso: "AMBULATORIAL" as const, idadeAnos: null, chegadaEm: "2026-10-18T08:00:00Z" },
  ];
  const copia = structuredClone(entradas), r = organizarFilaSalaoF3(entradas, rs);
  expect(r.filaOrdenada).toEqual(ordenarFila(entradas, rs));
  expect(r.filaOrdenada.map(e => e.patientId)).toEqual(["ecog4", "cama-com-corte", "idoso-sem-corte", "idade-ausente", "e1-chegou-depois"]);
  expect(r.destinosPorEntrada.map(e => e.destino)).toEqual(["FILA_MEDICO", "FILA_MEDICO", "SALAO", "FRENTE", "FILA_MEDICO"]);
  expect(r.escalonamentoE1Ids).toEqual(["e1-chegou-depois"]);
  expect(entradas).toEqual(copia);
});

it.each(["CAMA", "CADEIRA", "AMBULATORIAL"] as const)("flags ausentes ou parcialmente conhecidas bloqueiam frente/salao: %s", recurso => {
  for (const flags of [{}, { temCorte: false }, { temPendencia: false }]) {
    const entrada = { patientId: "paciente-desconhecido", ecog: 1, recurso, idadeAnos: 85,
      chegadaEm: "2026-10-18T09:00:00Z", ...flags };
    expect(organizarFilaSalaoF3([entrada], rs).destinosPorEntrada[0]?.destino).toBe("FILA_MEDICO");
  }
});

it.each([[false, false], [true, false], [false, true], [true, true]])("leitura legada conserva declaracao %s/%s sem promover execucao", (tarefaNutricaoCriada, qtAdiada) => {
  const { recomendacaoNutricao: _, recomendacaoAdiamentoQt: __, efeitosLegadosNaoVerificados: ___, ...base } = avaliarDesfechoPesoSalao(peso());
  const legado = { ...base, tarefaNutricaoCriada, qtAdiada };
  const json = JSON.stringify(legado);
  const db = abrirLedger(":memory:");
  try {
    // A leitura e a normalizacao nao reescrevem o documento historico.
    garantirSchemaSalaoF3(db);
    db.prepare("INSERT INTO salao_desfecho_peso (desfechoId, patientId, encounterId, desfechoJson, registradoEm) VALUES (?, ?, ?, ?, ?)")
      .run("peso-legado", legado.patientId, legado.encounterId, json, "2026-10-18T12:00:00Z");
    const lerJson = () => (db.prepare("SELECT desfechoJson FROM salao_desfecho_peso").get() as { desfechoJson: string }).desfechoJson;
    const lido = DesfechoPesoSalao.parse(JSON.parse(lerJson()));
    expect(lido).toMatchObject({ tarefaNutricaoCriada: false, qtAdiada: false,
      efeitosLegadosNaoVerificados: { tarefaNutricaoCriada, qtAdiada, verificacao: "NAO_VERIFICADO" },
      recomendacaoNutricao: "PENDENTE_DECISAO_MEDICA", recomendacaoAdiamentoQt: "PENDENTE_DECISAO_MEDICA" });
    expect(lerJson()).toBe(json);
  } finally { db.close(); }
});
