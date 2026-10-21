import { describe, expect, it } from "vitest";
import { projetarEstatistica } from "../../src/kernel/projections/estatistica.js";
import { EstatisticaServicoResposta } from "../../src/contracts/api/estatisticaServico.js";
import { hashConteudoExibido } from "../../src/server/sessao.js";
import { ambienteHttp } from "../server/http-fixture.js";
import { evento, persistirFixture } from "../w10-eixo-temporal/fixtures.js";

// Dados sintéticos: aliases de esquema não alteram fonte, identidade ou histórico.
const periodoClinico = { inicio: "2026-01-31", fim: "2026-01-31" };
function administracao(status: "COMPLETA" | "PARCIAL" = "COMPLETA", inicio = "2026-02-01T02:30:00Z") {
  return { adminId: "admin-sintetica", cicloId: "ciclo-sintetico",
    prescricaoRef: { documentId: "doc-sintetico", documentVersion: 1 }, item: 1,
    droga: "SEGREDO-SINTETICO", quantidadeEfetivaMg: 50, status,
    motivo: status === "PARCIAL" ? "Motivo sintético" : null, inicio, fim: null,
    fonte: { sourceId: "fonte-sintetica", classe: "MANUAL", localizador: null,
      dataClinica: "2026-01-15", dataCaptura: "2026-10-05T10:00:00Z", versao: "1", contentHash: "hash-sintetico" } };
}
function conjunto(versionado: boolean) {
  const sufixo = versionado ? "@1" : "";
  const corpo = { documentId: "doc-sintetico", documentVersion: 1, texto: "SEGREDO-SINTETICO" };
  const comum = { criadoEm: "2026-10-05T10:00:00Z" };
  return [
    evento("fato", { dataClinica: "2026-01-31", valor: "SEGREDO-SINTETICO" }, { ...comum, tipo: `FATO${sufixo}` }),
    evento("documento", { dataClinica: "2026-01-31", data: corpo, signature: {
      documentId: corpo.documentId, documentVersion: 1, documentHash: hashConteudoExibido(corpo),
      reviewDecisionId: "revisao-sintetica", serverActorId: "medico-sintetico",
    } }, { ...comum, tipo: `DOCUMENTO${sufixo}`, revisao: "ASSINADO" }),
    evento("administracao", administracao(), { ...comum, tipo: `TreatmentAdministration${sufixo}` }),
  ];
}

describe("estatística de eventos @1", () => {
  it.each([false, true])("aliases têm os mesmos totais e datas da forma simples, com período=%s", filtrar => {
    const simples = conjunto(false), versionados = conjunto(true), copia = structuredClone(versionados);
    const opcoes = filtrar ? { periodoClinico } : {};
    const resultado = projetarEstatistica(versionados, opcoes);
    expect(resultado).toEqual(projetarEstatistica(simples, opcoes));
    expect(resultado).toMatchObject({ denominadorPacientes: 1, documentosAssinados: 1,
      eventosPorCategoria: { FATO: 1, DOCUMENTO: 1, ADMINISTRACAO: 1, OUTRO: 0 },
      administracoesPorStatus: { COMPLETA: 1 }, exclusoes: { eventosSemDataClinica: 0 } });
    expect(versionados).toEqual(copia);
    for (const proibido of ["SEGREDO-SINTETICO", "paciente-sintetico", "admin-sintetica", "fonte-sintetica"])
      expect(JSON.stringify(resultado)).not.toContain(proibido);
  });

  it("deduplica a mesma administração em nomes mistos sem fundir eventos imutáveis divergentes", () => {
    const simples = evento("admin-simples", administracao(), { tipo: "TreatmentAdministration" });
    const versionado = evento("admin-versionado", administracao(), { tipo: "TreatmentAdministration@1" });
    expect(projetarEstatistica([simples, versionado])).toMatchObject({
      eventosPorCategoria: { ADMINISTRACAO: 2, OUTRO: 0 }, administracoesPorStatus: { COMPLETA: 1 },
      administracoesPendentes: 0, administracoesConflito: 0,
    });
    expect(() => projetarEstatistica([simples, { ...simples, tipo: "TreatmentAdministration@1" }]))
      .toThrow("EVENT_ID_CONFLICT");
  });

  it("não esconde uma administração @1 conflitante fora do período clínico", () => {
    const dentro = evento("admin-dentro", administracao(), { tipo: "TreatmentAdministration" });
    const fora = evento("admin-fora", administracao("PARCIAL", "2026-02-02T12:00:00Z"), { tipo: "TreatmentAdministration@1" });
    expect(projetarEstatistica([dentro, fora], { periodoClinico })).toMatchObject({
      administracoesConflito: 1, administracoesPendentes: 1,
      administracoesPorStatus: { COMPLETA: 0, PARCIAL: 0 }, exclusoes: { eventosForaPeriodo: 1 },
    });
  });

  it("aplica supersessão mista antes de contar a situação vigente", () => {
    const antigo = evento("admin-antiga", administracao(), { tipo: "TreatmentAdministration" });
    const corrigido = evento("admin-corrigida", administracao("PARCIAL"), {
      tipo: "TreatmentAdministration@1", supersedesEventId: antigo.eventId,
    });
    expect(projetarEstatistica([antigo, corrigido], { periodoClinico })).toMatchObject({
      administracoesPorStatus: { COMPLETA: 0, PARCIAL: 1 }, administracoesConflito: 0,
      eventosPorCategoria: { ADMINISTRACAO: 1, OUTRO: 0 }, exclusoes: { eventosSupersedidos: 1 },
    });
  });

  it("@1 inválido continua pendente e @2 desconhecido não ganha interpretação", () => {
    const invalido = evento("admin-invalida", { status: "SEGREDO-SINTETICO" }, { tipo: "TreatmentAdministration@1" });
    const desconhecido = evento("admin-desconhecida", administracao(), { tipo: "TreatmentAdministration@2" });
    const resultado = projetarEstatistica([invalido, desconhecido]);
    expect(resultado).toMatchObject({ administracoesPendentes: 1,
      exclusoes: { administracoesInvalidas: 1 }, eventosPorCategoria: { ADMINISTRACAO: 1, OUTRO: 1 },
      administracoesPorStatus: { COMPLETA: 0 } });
    expect(JSON.stringify(resultado)).not.toContain("SEGREDO-SINTETICO");
  });

  it("HTTP e SQLite retornam contagens corretas de @1 sem reescrever o ledger", async () => {
    const ambiente = await ambienteHttp();
    try {
      for (const e of conjunto(true)) persistirFixture(ambiente.db, e);
      const antes = ambiente.db.prepare("SELECT * FROM clinical_event ORDER BY eventId").all();
      expect((await ambiente.request("/consulta/estatistica", "POST", "{}", undefined, "application/json")).status).toBe(401);
      for (const corpo of [{}, { periodoClinico }]) {
        const r = await ambiente.request("/consulta/estatistica", "POST", JSON.stringify(corpo), ambiente.token, "application/json");
        expect(r.status).toBe(200);
        const dados = EstatisticaServicoResposta.parse(JSON.parse(r.body));
        expect(dados).toMatchObject({ totalPacientes: 1, documentosAssinados: 1,
          eventosPorCategoria: { FATO: 1, DOCUMENTO: 1, ADMINISTRACAO: 1, OUTRO: 0 },
          administracoesPorStatus: { COMPLETA: 1 } });
        expect(r.body).not.toContain("SEGREDO-SINTETICO");
      }
      expect(ambiente.db.prepare("SELECT * FROM clinical_event ORDER BY eventId").all()).toEqual(antes);
      expect(ambiente.efeitos()).toBe(0);
    } finally { await ambiente.close(); }
  });
});
