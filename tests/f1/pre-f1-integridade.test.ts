import { afterEach, describe, expect, it, vi } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { lerEventosComIntegridade } from "../../src/server/leituras.js";
import { abrirAmbiente, cadastrarPaciente, criarDiretorio, removerDiretorio,
  AGORA, PACIENTE, OUTRO_PACIENTE } from "../f0-fecha/fixtures/consulta-completa.js";

const databases: DatabaseSync[] = [];
let ambiente: Awaited<ReturnType<typeof abrirAmbiente>> | undefined;
afterEach(async () => {
  vi.restoreAllMocks();
  for (const db of databases.splice(0)) db.close();
  if (ambiente) {
    await ambiente.close(); removerDiretorio(ambiente.dir); ambiente = undefined;
  }
});

function banco() {
  const db = abrirLedger(":memory:"); databases.push(db); return db;
}

// Escrita direta só na fixture: simula corrupção persistida, fora do WriteRouter.
function inserir(db: DatabaseSync, id: string, overrides: {
  patientId?: string; payload?: string; fontes?: string; criadoPor?: string; criadoEm?: string;
} = {}) {
  db.prepare("INSERT INTO operation (operationId, payloadHash, resultRef, criadoEm) VALUES (?, ?, ?, ?)")
    .run(`op-${id}`, "hash-sintetico", null, AGORA);
  db.prepare(`INSERT INTO clinical_event (eventId, operationId, eventIndex, patientId, tumorLotId,
    encounterId, tipo, payload, fontes, revisao, criadoEm, criadoPor, supersedesEventId)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, `op-${id}`, 0, overrides.patientId ?? PACIENTE, null, "encontro-sintetico", "FATO",
      overrides.payload ?? "{}", overrides.fontes ?? "[]", "CONFIRMADO", overrides.criadoEm ?? AGORA,
      overrides.criadoPor ?? JSON.stringify({ tipo: "SISTEMA", id: "sistema-sintetico" }), null);
}

describe("pré-F1 · integridade do ledger na leitura", () => {
  it.each(["payload", "fontes", "criadoPor"] as const)("JSON inválido em %s vira pendência sem conteúdo clínico", (campo) => {
    const db = banco();
    inserir(db, "evento-corrompido", { [campo]: "{ conteúdo sintético corrompido" });
    const { itens, pendenciasIntegridade } = lerEventosComIntegridade(db);
    expect(itens).toEqual([]);
    expect(pendenciasIntegridade).toEqual([
      { eventoId: "evento-corrompido", patientId: PACIENTE, tipo: "FATO", motivo: "JSON_INVALIDO" },
    ]);
    expect(JSON.stringify(pendenciasIntegridade)).not.toContain("conteúdo sintético");
    expect(db.prepare("SELECT count(*) AS n FROM clinical_event").get()?.n).toBe(1);
  });

  it("JSON válido fora do contrato vira CONTRATO_INVALIDO", () => {
    const db = banco();
    inserir(db, "evento-invalido", { fontes: '"nao-e-lista"', criadoEm: "data-invalida" });
    expect(lerEventosComIntegridade(db)).toEqual({ itens: [], pendenciasIntegridade: [
      { eventoId: "evento-invalido", patientId: PACIENTE, tipo: "FATO", motivo: "CONTRATO_INVALIDO" },
    ] });
  });

  it("preserva eventos válidos e sua ordem cronológica entre registros corrompidos", () => {
    const db = banco();
    inserir(db, "mais-recente", { criadoEm: "2026-10-12T12:00:00Z" });
    inserir(db, "corrompido", { payload: "{" });
    inserir(db, "mais-antigo", { criadoEm: "2026-10-10T12:00:00Z" });
    const leitura = lerEventosComIntegridade(db);
    expect(leitura.itens.map((e) => e.eventId)).toEqual(["mais-antigo", "mais-recente"]);
    expect(leitura.pendenciasIntegridade).toHaveLength(1);
  });

  it("consulta HTTP expõe a pendência só para seu paciente e lê o ledger uma vez", async () => {
    ambiente = await abrirAmbiente(criarDiretorio());
    cadastrarPaciente(ambiente); cadastrarPaciente(ambiente, "93");
    const carregar = (patientId: string) => ambiente!.request("/consulta/carregar", { patientId });
    const antes = await carregar(PACIENTE);
    inserir(ambiente.db, "corrupcao-do-paciente", { payload: "{ conteúdo sintético corrompido" });
    const prepare = vi.spyOn(ambiente.db, "prepare");
    const depois = await carregar(PACIENTE);
    const leituras = prepare.mock.calls.filter(([sql]) => /SELECT \* FROM clinical_event/i.test(sql));
    expect(leituras).toHaveLength(1);
    expect(depois.status).toBe(200);
    expect(depois.data.pendenciasIntegridade).toEqual([
      { eventoId: "corrupcao-do-paciente", patientId: PACIENTE, tipo: "FATO", motivo: "JSON_INVALIDO" },
    ]);
    expect(depois.data.pendenciasLeitura).toContain("EVENTO_COM_INTEGRIDADE_PENDENTE");
    expect(depois.data.cabecalho.pendentes).toBe(antes.data.cabecalho.pendentes + 1);
    expect(depois.data.cabecalho.paciente).toEqual(antes.data.cabecalho.paciente);
    expect(JSON.stringify(depois.data)).not.toContain("conteúdo sintético corrompido");
    const outro = await carregar(OUTRO_PACIENTE);
    expect(outro.status).toBe(200);
    expect(outro.data.pendenciasIntegridade).toEqual([]);
    expect(outro.data.pendenciasLeitura).not.toContain("EVENTO_COM_INTEGRIDADE_PENDENTE");
  });
});
