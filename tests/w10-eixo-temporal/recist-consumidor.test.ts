import { describe, expect, it } from "vitest";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { lerRecist } from "../../src/server/leituras.js";
import { secoesDaTimeline } from "../../src/kernel/projections/timelineSecoes.js";
import type { RecistSerieInput, RecistPontoSerie } from "../../src/rules/recist/index.js";
import { evento, persistirFixture } from "./fixtures.js";

const patientId = "paciente-sintetico", tumorLotId = "lote-sintetico", episodioId = "episodio-sintetico";
function ponto(eventId: string, data: string, diametroMm: number): RecistPontoSerie {
  return { eventId, patientId, tumorLotId, episodioId, data,
    metodo: "TC", tecnicaId: "tc-sintetica", espessuraCorteMm: 5, qualidadeMedicao: "ADEQUADA",
    lesoes: [{ codigo: "L1", diametroMm, fonteIds: [`fonte-${eventId}`] }],
    novasLesoes: false, naoAlvos: "AUSENTE_DOCUMENTADO", fonteIds: [`fonte-${eventId}`] };
}

describe("F07 — cálculo RECIST no consumidor real permanece proposto", () => {
  it("SQLite → leitor → avaliação proposta → seção pendente, sem mutação do ledger", () => {
    const db = abrirLedger(":memory:");
    try {
      const pontos = [ponto("baseline", "2026-01-01", 20), ponto("atual", "2026-02-01", 30)];
      for (const p of pontos) persistirFixture(db, evento(p.eventId, { imagem: "sintética" }, {
        fontes: [{ sourceId: `fonte-${p.eventId}`, classe: "DOCUMENT", localizador: null,
          dataClinica: p.data, dataCaptura: "2026-10-07T12:00:00Z", versao: "1", contentHash: `hash-${p.eventId}` }],
      }));
      const serie: RecistSerieInput = { patientId, tumorLotId, episodioId, baselineEventId: "baseline",
        alvos: [{ codigo: "L1", tipo: "NAO_NODAL", eixo: "MAIOR", orgaoId: "orgao-sintetico",
          elegibilidadeBasal: "ELEGIVEL", fonteElegibilidadeIds: ["fonte-baseline"] }], pontos };
      persistirFixture(db, evento("serie", serie, { tipo: "RecistSerie" }));
      const antes = db.prepare("SELECT * FROM clinical_event").all();
      const resposta = lerRecist(db, patientId);
      const calculo = resposta.series[0]?.resultado;
      const atual = calculo?.pontos.find((p) => p.eventId === "atual");
      expect(atual).toMatchObject({ categoriaGlobal: "PD", categoriaGlobalRevisao: "PROPOSTO",
        estadoInterpretacao: "PROPOSTO", avaliacao: { categoria: "PD", revisao: "PROPOSTO" } });
      expect(atual?.calculo).toMatchObject({ nadirEventId: "baseline", revisao: "PROPOSTO", fonteIds: ["fonte-atual"] });
      expect(resposta.series[0]?.categoriaNuncaAssinada).toBe(true);
      const secoes = secoesDaTimeline({ patientId, stageHistory: [], historicalMetastaticDisease: false,
        treatments: [], recist: atual?.avaliacao ? [atual.avaliacao] : [], missingRequiredData: [], unresolvedConflicts: [] });
      expect(secoes.recist.estado).toBe("PENDENTE");
      expect(secoes.recist.itens[0]?.revisao).toBe("PROPOSTO");
      expect(lerRecist(db, "outro-paciente")).toMatchObject({ codigo: "PACIENTE_NAO_ENCONTRADO", series: [] });
      expect(db.prepare("SELECT * FROM clinical_event").all()).toEqual(antes);
    } finally { db.close(); }
  });
});
