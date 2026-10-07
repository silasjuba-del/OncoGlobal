import { describe, expect, it } from "vitest";
import type { Fonte } from "../../src/contracts/base.js";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { confirmar, type Confirmacao } from "../../src/kernel/ledger/writeRouter.js";
import { ambienteHttp } from "../server/http-fixture.js";

const pacienteId = "Paciente Teste 41";
const tumorLotId = "tumor-teste-41";
const episodioId = "episodio-teste-41";
const encounterId = "consulta-teste-41";
const em = "2026-10-05T12:00:00Z";

function fonte(sourceId: string, dataClinica: string): Fonte {
  return {
    sourceId, classe: "DOCUMENT", localizador: null, dataClinica, dataCaptura: em,
    versao: "fixture-http-v1", contentHash: `hash-${sourceId}`,
  };
}

function serieRecist(alvosFonteId: string) {
  return {
    patientId: pacienteId, tumorLotId, episodioId, baselineEventId: "evento-imagem-baseline",
    alvos: [{ codigo: "L1", tipo: "NAO_NODAL", eixo: "MAIOR", orgaoId: "orgao-sintetico-1",
      elegibilidadeBasal: "ELEGIVEL", fonteElegibilidadeIds: [alvosFonteId] }],
    pontos: [
      { eventId: "evento-imagem-baseline", patientId: pacienteId, tumorLotId, episodioId,
        data: "2026-01-01", metodo: "TC", tecnicaId: "tc-fino-sintetico", espessuraCorteMm: 5,
        qualidadeMedicao: "ADEQUADA",
        lesoes: [{ codigo: "L1", diametroMm: 20, fonteIds: ["fonte-medida-baseline"] }],
        novasLesoes: false, naoAlvos: "AUSENTE_DOCUMENTADO", fonteIds: ["fonte-laudo-baseline"] },
      { eventId: "evento-imagem-atual", patientId: pacienteId, tumorLotId, episodioId,
        data: "2026-02-01", metodo: "TC", tecnicaId: "tc-fino-sintetico", espessuraCorteMm: 5,
        qualidadeMedicao: "ADEQUADA",
        lesoes: [{ codigo: "L1", diametroMm: 30, fonteIds: ["fonte-medida-atual"] }],
        novasLesoes: false, naoAlvos: "AUSENTE_DOCUMENTADO", fonteIds: ["fonte-laudo-atual"] },
    ],
  };
}

async function gravarSerieReal(db: Parameters<typeof salvarDraft>[0], sourceTargetId: string,
  incluirFonteDeElegibilidade = true) {
  const fontes = [
    ...(incluirFonteDeElegibilidade ? [fonte(sourceTargetId, "2026-01-01")] : []),
    fonte("fonte-laudo-baseline", "2026-01-01"),
    fonte("fonte-medida-baseline", "2026-01-01"), fonte("fonte-laudo-atual", "2026-02-01"),
    fonte("fonte-medida-atual", "2026-02-01"),
  ];
  const series = serieRecist(sourceTargetId);
  const registros = [
    { draftId: "draft-imagem-baseline", eventId: "evento-imagem-baseline", tipo: "FATO",
      payload: { dadoSintetico: "imagem-base" }, fontes: fontes.slice(0, 3), revisao: "CONFIRMADO" as const },
    { draftId: "draft-imagem-atual", eventId: "evento-imagem-atual", tipo: "FATO",
      payload: { dadoSintetico: "imagem-atual" }, fontes: fontes.slice(3), revisao: "CONFIRMADO" as const },
    { draftId: "draft-serie-recist", eventId: "evento-serie-recist", tipo: "RecistSerie",
      payload: series, fontes, revisao: "CONFIRMADO" as const },
  ];
  for (const registro of registros) {
    salvarDraft(db, { draftId: registro.draftId, patientId: pacienteId,
      sourceId: `source-${registro.eventId}`, rawRef: `opaque-${registro.eventId}`,
      payload: registro.payload, diagnostics: [], revision: 0, criadoEm: em });
  }
  const request: Confirmacao = {
    operationId: "operation-http-recist-synthetic", patientId: pacienteId, tumorLotId, encounterId,
    reviewDecisionId: "review-http-recist-synthetic", sessao: { medicoId: "medico-teste", crm: "CRM-TESTE",
      emitidaEm: em, expiraEm: "2026-10-05T12:01:00Z" }, em,
    registros: registros.map((registro) => ({ ...registro, expectedRevision: 0 })),
  };
  return request;
}

async function postJson(request: Awaited<ReturnType<typeof ambienteHttp>>["request"], path: string,
  token: string, payload: unknown) {
  const response = await request(path, "POST", JSON.stringify(payload), token, "application/json");
  return { status: response.status, body: JSON.parse(response.body) as Record<string, unknown> };
}

describe("W10-LUNA4 · consumidores HTTP RECIST e estatística", () => {
  it("serve RECIST PD proposto do ledger e estatística deduplicada sem identificadores após replay", async () => {
    const env = await ambienteHttp();
    try {
      const write = await gravarSerieReal(env.db, "fonte-selecao-alvo");
      expect(confirmar(env.db, write).estado).toBe("GRAVADA");
      expect(confirmar(env.db, write).estado).toBe("REPLAY");

      const recist = await postJson(env.request, "/consulta/recist", env.token, { patientId: pacienteId });
      expect(recist.status).toBe(200);
      const recistBody = recist.body as { series: Array<{
        estado: string; categoriaNuncaAssinada: boolean;
        resultado: { pontos: Array<{ eventId: string; categoriaGlobal: string;
          categoriaGlobalRevisao: string; avaliacao: { revisao: string } | null }> };
      }> };
      expect(recistBody.series).toHaveLength(1);
      const serie = recistBody.series[0]!;
      const atual = serie.resultado.pontos.find((p: { eventId: string }) => p.eventId === "evento-imagem-atual");
      expect(atual?.categoriaGlobal).toBe("PD");
      expect(atual?.categoriaGlobalRevisao).toBe("PROPOSTO");
      expect(atual?.avaliacao?.revisao).toBe("PROPOSTO");
      expect(serie.categoriaNuncaAssinada).toBe(true);

      const stats = await postJson(env.request, "/consulta/estatistica", env.token, {});
      expect(stats.status).toBe(200);
      const statsBody = stats.body as { totalPacientes: number; eventosPorCategoria: Record<string, number> };
      expect(statsBody.totalPacientes).toBe(1);
      expect(statsBody.eventosPorCategoria.FATO).toBe(2);
      expect(JSON.stringify(stats.body)).not.toContain(pacienteId);
      for (const internal of ["evento-imagem-baseline", "evento-imagem-atual", "evento-serie-recist",
        "fonte-selecao-alvo", "imagem-base", "imagem-atual"])
        expect(JSON.stringify(stats.body)).not.toContain(internal);
    } finally {
      await env.close();
    }
  });

  it("deixa RECIST PENDENTE quando uma fonte declarada não existe no ledger do paciente", async () => {
    const env = await ambienteHttp();
    try {
      const write = await gravarSerieReal(env.db, "fonte-ausente-sintetica", false);
      expect(confirmar(env.db, write).estado).toBe("GRAVADA");
      const result = await postJson(env.request, "/consulta/recist", env.token, { patientId: pacienteId });
      expect(result.status).toBe(200);
      const body = result.body as { series: Array<{ estado: string; codigo: string; resultado: unknown }> };
      expect(body.series[0]?.estado).toBe("PENDENTE");
      expect(body.series[0]?.codigo).toBe("ESCOPO_OU_PROVENIENCIA_INVALIDA");
      expect(body.series[0]?.resultado).toBeNull();
    } finally {
      await env.close();
    }
  });
});
