// Synthetic events only. This suite also runs on PR34 without the Trials service.
import { expect, it } from "vitest";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { listarEventos } from "../../src/kernel/ledger/ledger.js";
import { projetarRetrato } from "../../src/kernel/projections/retrato/index.js";
import { eventosVigentes } from "../../src/kernel/projections/snapshot.js";
import { evento, persistirFixture } from "../w10-eixo-temporal/fixtures.js";

const contexto = { patientId: "paciente-sintetico", encounterId: "consulta-sintetica", tumorLotId: "lote-sintetico",
  agora: "2026-10-07T13:00:00Z", regras: [], biblioteca: { id: "sintetica", versao: "1", hash: "sintetico" } };
const ids = (eventos: ReturnType<typeof listarEventos>) => projetarRetrato(eventos, contexto).fatos.map(f => f.ref.eventId).sort();

it.each([["FATO", "FATO"], ["FATO", "FATO@1"], ["FATO@1", "FATO"]])(
  "retrata correcao aceita no ledger, mesmo instante e IDs inversos: %s para %s", (tipoAntigo, tipoNovo) => {
    const db = abrirLedger(":memory:");
    try {
      const anterior = evento("z-anterior", { campo: "ecog", valor: 2 }, { tipo: tipoAntigo! });
      const atual = evento("a-atual", { campo: "ecog", valor: 1 }, { tipo: tipoNovo!, supersedesEventId: anterior.eventId });
      persistirFixture(db, anterior); persistirFixture(db, atual);
      const eventos = listarEventos(db, contexto.patientId);
      expect(eventosVigentes(eventos).map(e => e.eventId)).toEqual([atual.eventId]);
      expect(ids(eventos)).toEqual([atual.eventId]);
      expect(ids([...eventos].reverse())).toEqual([atual.eventId]);
      expect(projetarRetrato(eventos, contexto).integridade).toEqual([]);
    } finally { db.close(); }
  },
);

it("ciclo legado conserva os mesmos candidatos no retrato e snapshot", () => {
  const eventos = [evento("a", { campo: "ecog", valor: 1 }, { supersedesEventId: "b" }),
    evento("b", { campo: "ecog", valor: 2 }, { supersedesEventId: "a" }),
    evento("c", { campo: "ecog", valor: 3 })];
  expect(ids(eventos)).toEqual(eventosVigentes(eventos).map(e => e.eventId).sort());
  expect(ids(eventos)).toEqual(["a", "b", "c"]);
  expect(projetarRetrato(eventos, contexto).integridade).toHaveLength(2);
});

it("outra correcao valida nao legitima arestas internas de um ciclo legado", () => {
  const eventos = [evento("a", { campo: "ecog", valor: 1 }, { supersedesEventId: "b" }),
    evento("b", { campo: "ecog", valor: 2 }, { supersedesEventId: "a" }),
    evento("c", { campo: "ecog", valor: 3 }, { supersedesEventId: "a" })];
  expect(ids(eventos)).toEqual(["b", "c"]);
  expect(projetarRetrato(eventos, contexto).integridade.map(i => i.eventoId).sort()).toEqual(["a", "b"]);
});

it.each(["medicamentos", "comorbidades"])("preserva somente a excecao explicita entre lotes: %s", campo => {
  const anterior = evento("a", { campo, valor: ["item-sintetico"] }, { tumorLotId: "lote-antigo" });
  const atual = evento("z", { campo, valor: [] }, { supersedesEventId: anterior.eventId });
  const eventos = [anterior, atual];
  expect(ids(eventos)).toEqual(campo === "medicamentos" ? ["z"] : ["a", "z"]);
  expect(ids(eventos)).toEqual(eventosVigentes(eventos).map(e => e.eventId).sort());
});

it("filtra o horizonte antes de atribuir autoridade a uma correcao futura", () => {
  const anterior = evento("z", { campo: "ecog", valor: 2 });
  const futuro = evento("a", { campo: "ecog", valor: 1 }, {
    criadoEm: "2026-10-08T12:00:00Z", supersedesEventId: anterior.eventId,
  });
  expect(ids([anterior, futuro])).toEqual(["z"]);
});
