// G2 · Caracterização de Pós-processamento HTTP por Rota e Drenagem no close() (Cenários 7 e 8 · OG-003 / OG-004).
// ESCOPO EXPLÍCITO DO CENÁRIO 7 (CX-006): inspeciona estaticamente todas as 89 entradas do catálogo ROTAS_HTTP
// (21 com grava: false e 68 com grava: true), mas executa via HTTP uma amostra representativa de endpoints
// (agenda, lotes e estatistica com grava: false; oncoassistStatus e carregarConsulta como leituras com grava: true;
// extrair 201 como escrita real; e extrair 400 / carregarConsulta 401 como falhas 4xx), e NÃO todas as 89 rotas via HTTP.
// Base: 52b8f7a04c2e467c5c3b3cb93bc38a7673cc4c93 (codex/estabilizacao-g01-reconciliacao).
import { describe, expect, it, vi } from "vitest";
import { POLITICA_WEBHOOK_CANAL, ROTAS_HTTP, politicaProcessamento, rotaHttp } from "../../src/server/rotas/catalogo.js";
import * as canalReconciliacao from "../../src/server/canalReconciliacao.js";
import {
  abrirServidorHttpG2,
  G2_CONTEXTO,
  semearPacienteELoteG2,
} from "../fixtures/g2-integridade.js";

describe("G2 · Cenário 7: Disparos de pós-processamento por rota HTTP (OG-003 / OG-004)", () => {
  it("caracteriza o catálogo ROTAS_HTTP (89 rotas) quanto ao metadado grava: true vs grava: false", () => {
    expect(ROTAS_HTTP).toHaveLength(89);

    const semGrava = ROTAS_HTTP.filter((r) => r.processamento === "NENHUM").map((r) => r.nome);
    expect(semGrava).toEqual([
      "/biblioteca/consultar",
      "/biblioteca/estado",
      "lerCaixa",
      "historicoConfig",
      "lerPerfil",
      "baseAcaoComposta",
      "agenda",
      "bundle",
      "estatistica",
      "listarRascunhosPubMed",
      "resultadoExtracaoLlm",
      "lotesPaciente",
      "documentoImpressao",
      "basePrescricaoExecutavel",
      "listarFichasPrescricao",
      "recist",
      "historicoContingenciaSalao",
      "timelineMulticamadas",
      "fatosTrials",
      "listarEstudosTrials",
      "login",
    ]);

    // Defeito conhecido OG-003 / OG-004 caracterizado antes de G5:
    // Rotas predominantemente de leitura/consulta estão marcadas `grava: true` no catálogo
    // e por isso disparam `processarPendenciasClinicasCanal` + `motorF1.processar()` após cada POST 2xx:
    for (const urlLeituraComGravaTrue of [
      "/consulta/carregar",
      "/consulta/apac",
      "/consulta/canal",
      "/consulta/salao",
      "/consulta/chat",
      "/consulta/oncoassist/status",
      "/consulta/oncoassist/fontes",
      "/consulta/investigacao",
      "/consulta/revisao-clinica",
      "/consulta/receita/propor-dose",
    ]) {
      expect(rotaHttp(urlLeituraComGravaTrue)?.processamento, urlLeituraComGravaTrue).toBe("PENDENCIAS_E_MOTOR");
    }

    // Inverso também caracterizado (OG-004): `/consulta/bundle` muta estado de sessão (`registrarBundleExibido`),
    // mas declara `grava: false` para não disparar o hook global de pós-processamento.
    expect(rotaHttp("/consulta/bundle")?.processamento).toBe("NENHUM");

    // EST-03: a política do webhook (fora do catálogo) é explícita, não um default implícito.
    expect(politicaProcessamento("/canal/webhook/chave-sintetica")).toBe(POLITICA_WEBHOOK_CANAL);
    expect(politicaProcessamento("/canal/webhook/chave-sintetica?evento=1")).toBe("PENDENCIAS_E_MOTOR");
    expect(politicaProcessamento("/rota/inexistente")).toBe("NENHUM");
    for (const rota of ROTAS_HTTP) expect(politicaProcessamento(rota.url), rota.url).toBe(rota.processamento);
  });

  it("executa amostra representativa via HTTP (não todas as 89 rotas) medindo processarPendenciasClinicasCanal e motorF1.processar em grava:false, leituras grava:true, escrita 201 e falhas 4xx", async () => {
    const spyCanal = vi.spyOn(canalReconciliacao, "processarPendenciasClinicasCanal");
    const srv = await abrirServidorHttpG2();
    const spyMotor = vi.spyOn(srv.motorF1, "processar");

    try {
      semearPacienteELoteG2(srv.db, srv.sessao, srv.obterAgora(), G2_CONTEXTO);
      srv.sessoes.selecionarConsulta(srv.token, { ...G2_CONTEXTO });

      // Limpa contadores após o boot inicial do servidor:
      await new Promise<void>((r) => setImmediate(r));
      spyCanal.mockClear();
      spyMotor.mockClear();

      // 1) Rotas com `grava: false` (ex.: `/consulta/agenda`, `/consulta/lotes`, `/consulta/estatistica`)
      //    retornam 200 e NÃO disparam `processarPendenciasClinicasCanal` nem `motorF1.processar()`:
      expect((await srv.post("/consulta/agenda", {})).status).toBe(200);
      expect((await srv.post("/consulta/lotes", { patientId: G2_CONTEXTO.patientId })).status).toBe(200);
      expect((await srv.post("/consulta/estatistica", {})).status).toBe(200);
      await new Promise<void>((r) => setImmediate(r));
      expect(spyCanal).toHaveBeenCalledTimes(0);
      expect(spyMotor).toHaveBeenCalledTimes(0);

      // 2) Respostas 4xx em rotas com `grava: true` NÃO disparam o hook pós-resposta (`res.statusCode >= 200 && res.statusCode < 300`):
      expect((await srv.post("/consulta/extrair", {})).status).toBe(400);
      expect((await srv.post("/consulta/carregar", {}, null)).status).toBe(401);
      await new Promise<void>((r) => setImmediate(r));
      expect(spyCanal).toHaveBeenCalledTimes(0);
      expect(spyMotor).toHaveBeenCalledTimes(0);

      // 3) Comportamento atual (OG-003): leituras com `grava: true` (`/consulta/oncoassist/status` e `/consulta/carregar`)
      //    disparam o hook pós-resposta em `http.ts:59` quando retornam 200:
      expect((await srv.post("/consulta/oncoassist/status", {})).status).toBe(200);
      await vi.waitFor(() => expect(spyMotor).toHaveBeenCalledTimes(1));
      expect(spyCanal).toHaveBeenCalledTimes(1);

      expect((await srv.post("/consulta/carregar", G2_CONTEXTO)).status).toBe(200);
      await vi.waitFor(() => expect(spyMotor).toHaveBeenCalledTimes(2));
      expect(spyCanal).toHaveBeenCalledTimes(2);

      // 4) Rota de escrita real (`/consulta/extrair` -> 201) dispara `processarCanal` + `motorF1.processar`:
      const ext = await srv.post("/consulta/extrair", {
        recordingId: "rec-g2-proc",
        sourceId: "fonte-g2-proc",
        sourceType: "medical_note",
        rawTranscript: "10/10/2026 Hemoglobina 11,5 g/dL",
      });
      expect(ext.status).toBe(201);
      await vi.waitFor(() => expect(spyMotor).toHaveBeenCalledTimes(3));
      expect(spyCanal).toHaveBeenCalledTimes(3);
    } finally {
      spyMotor.mockRestore();
      spyCanal.mockRestore();
      await srv.fechar();
    }
  });
});

describe("G2 · Cenário 8: Drenagem determinística de trabalhos pendentes no server.close()", () => {
  it("aguarda a conclusão de processarPendenciasClinicasCanal e motorF1.processar em voo antes de resolver server.close() e fechar o SQLite", async () => {
    const srv = await abrirServidorHttpG2();
    let liberarMotor!: () => void;
    const barreiraMotor = new Promise<void>((resolve) => {
      liberarMotor = resolve;
    });

    let motorIniciado = false;
    let motorConcluidoComBancoAberto = false;
    const originalProcessar = srv.motorF1.processar.bind(srv.motorF1);
    const spyMotor = vi.spyOn(srv.motorF1, "processar").mockImplementation(async () => {
      motorIniciado = true;
      await barreiraMotor;
      // Verifica que o SQLite ainda está aberto e íntegro quando o trabalho pós-resposta retoma:
      const ok = srv.db.prepare("SELECT 1 AS ok FROM sqlite_master LIMIT 1").get() as { ok: number } | undefined;
      await originalProcessar();
      motorConcluidoComBancoAberto = ok?.ok === 1 && srv.db.isOpen;
    });

    try {
      const res = await srv.post("/consulta/extrair", {
        recordingId: "rec-g2-drain",
        sourceId: "fonte-g2-drain",
        sourceType: "medical_note",
        rawTranscript: "Nota sintética para drenagem no encerramento.",
      });
      expect(res.status).toBe(201);
      await vi.waitFor(() => expect(motorIniciado).toBe(true));

      // Inicia o encerramento enquanto o pós-processamento ainda está bloqueado em `barreiraMotor`:
      let closeResolvido = false;
      const promessaClose = new Promise<void>((resolve) => {
        srv.server.close(() => {
          closeResolvido = true;
          resolve();
        });
      });

      // Enquanto `barreiraMotor` não libera, `server.close` NÃO pode resolver:
      await new Promise<void>((r) => setTimeout(r, 25));
      expect(closeResolvido).toBe(false);

      // Novas requisições durante o encerramento recebem 503 SERVIDOR_ENCERRANDO (`http.ts:53-57`):
      const duranteEncerramento = await srv.post("/consulta/agenda", {});
      expect(duranteEncerramento).toEqual({
        status: 503,
        data: { codigo: "SERVIDOR_ENCERRANDO" },
      });

      // Libera o trabalho em voo e confirma que `server.close` aguarda o término antes de fechar o SQLite:
      liberarMotor();
      await promessaClose;
      expect(closeResolvido).toBe(true);
      expect(motorConcluidoComBancoAberto).toBe(true);
    } finally {
      liberarMotor();
      spyMotor.mockRestore();
      await srv.fechar();
    }
  });
});
