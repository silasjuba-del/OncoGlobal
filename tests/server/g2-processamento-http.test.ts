// G2 · Caracterização de Pós-processamento HTTP por Rota e Drenagem no close() (Cenários 7 e 8 · OG-003 / OG-004).
// ESCOPO EXPLÍCITO DO CENÁRIO 7 (CX-006): inspeciona as 110 entradas do catálogo ROTAS_HTTP
// e suas políticas de pós-processamento, mas executa via HTTP uma amostra representativa de endpoints
// (agenda, lotes e estatistica com grava: false; oncoassistStatus e carregarConsulta como leituras com grava: true;
// extrair 201 como escrita real; e extrair 400 / carregarConsulta 401 como falhas 4xx), e NÃO todas as rotas via HTTP.
// Base: 52b8f7a04c2e467c5c3b3cb93bc38a7673cc4c93 (codex/estabilizacao-g01-reconciliacao).
import { describe, expect, it, vi } from "vitest";
import { POLITICA_WEBHOOK_CANAL, ROTAS_HTTP, politicaProcessamento, rotaHttp } from "../../src/server/rotas/catalogo.js";
import * as canalReconciliacao from "../../src/server/canalReconciliacao.js";
import type { AtendimentoV6Resposta } from "../../src/contracts/api/atendimentoV6.js";
import {
  abrirServidorHttpG2,
  G2_CONTEXTO,
  semearPacienteELoteG2,
} from "../fixtures/g2-integridade.js";

describe("G2 · Cenário 7: Disparos de pós-processamento por rota HTTP (OG-003 / OG-004)", () => {
  it("caracteriza o catálogo ROTAS_HTTP (110 rotas) quanto à política de pós-processamento", () => {
    expect(ROTAS_HTTP).toHaveLength(110);

    const semGrava = ROTAS_HTTP.filter((r) => r.processamento === "NENHUM").map((r) => r.nome);
    expect(semGrava).toEqual([
      "/biblioteca/consultar",
      "/biblioteca/estado",
      "lerCaixa",
      "historicoConfig",
      "lerPerfil",
      "baseAcaoComposta",
      "agenda",
      "apac",
      "bundle",
      "canal",
      "chat",
      "selecionarContexto",
      "estatistica",
      "listarRascunhosPubMed",
      "resultadoExtracaoLlm",
      "lotesPaciente",
      "documentoImpressao",
      "recuperarAtendimentoV6",
      "prepararAtendimentoV6",
      "oncoassistStatus",
      "basePrescricaoExecutavel",
      "listarFichasPrescricao",
      "rascunho",
      "recist",
      "salao",
      "historicoContingenciaSalao",
      "timelineMulticamadas",
      "fatosTrials",
      "listarEstudosTrials",
      "login",
      "/consulta/documental/importar",
      "/consulta/documental/listar",
      "/consulta/documental/abrir",
      "/medico/agenda",
      "/medico/preconsulta",
      "/medico/preconsulta/salvar",
      "/medico/nutricao",
      "/medico/nutricao/salvar",
      "/consulta/assistente/historico",
      "/consulta/assistente/configurar",
      "/consulta/assistente/responder",
      "/consulta/assistente/responder-stream",
      "/consulta/assistente/cancelar",
      "/medico/paciente/ler",
    ]);

    // OG-003 / OG-004: invertido em EST-03b para as leituras comprovadamente sem escrita (apac, canal, salão,
    // chat, status do OncoAssist, seleção de contexto e leitura de rascunho), agora NENHUM acima. Estas
    // continuam disparando: carregarConsulta escreve; as demais não foram verificadas como só leitura.
    for (const urlLeituraComGravaTrue of [
      "/medico/paciente/cadastrar",
      "/medico/paciente/alterar",
      "/medico/agenda/agendar",
      "/medico/agenda/alterar",
      "/medico/preconsulta/confirmar",
      "/consulta/carregar",
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

  it("executa amostra representativa via HTTP medindo processarPendenciasClinicasCanal e motorF1.processar em grava:false, leituras grava:true, escrita 201 e falhas 4xx", async () => {
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
      const atendimento=await srv.post<AtendimentoV6Resposta>("/consulta/atendimento/recuperar",G2_CONTEXTO);
      expect(atendimento.status).toBe(200);
      expect((await srv.post("/consulta/atendimento/preparar",{...G2_CONTEXTO,
        expectedBaseHash:atendimento.data.base.revisao,expectedVersion:null,idempotencyKey:"v6-pos-processamento",
        entrada:{hoje:"Atualização sintética",decisao:"",saidas:["RESUMO"]}})).status).toBe(201);
      await new Promise<void>((r) => setImmediate(r));
      expect(spyCanal).toHaveBeenCalledTimes(0);
      expect(spyMotor).toHaveBeenCalledTimes(0);

      // 2) Respostas 4xx em rotas com `grava: true` NÃO disparam o hook pós-resposta (`res.statusCode >= 200 && res.statusCode < 300`):
      expect((await srv.post("/consulta/extrair", {})).status).toBe(400);
      expect((await srv.post("/consulta/carregar", {}, null)).status).toBe(401);
      await new Promise<void>((r) => setImmediate(r));
      expect(spyCanal).toHaveBeenCalledTimes(0);
      expect(spyMotor).toHaveBeenCalledTimes(0);

      // 3) Invertido em EST-03b (OG-003): a leitura sem escrita `/consulta/oncoassist/status` não dispara mais
      //    o processamento global; `/consulta/carregar` escreve e continua disparando.
      expect((await srv.post("/consulta/oncoassist/status", {})).status).toBe(200);
      await new Promise<void>((r) => setImmediate(r));
      expect(spyMotor).toHaveBeenCalledTimes(0);
      expect(spyCanal).toHaveBeenCalledTimes(0);

      expect((await srv.post("/consulta/carregar", G2_CONTEXTO)).status).toBe(200);
      await vi.waitFor(() => expect(spyMotor).toHaveBeenCalledTimes(1));
      expect(spyCanal).toHaveBeenCalledTimes(1);

      // 4) Rota de escrita real (`/consulta/extrair` -> 201) dispara `processarCanal` + `motorF1.processar`:
      const ext = await srv.post("/consulta/extrair", {
        recordingId: "rec-g2-proc",
        sourceId: "fonte-g2-proc",
        sourceType: "medical_note",
        rawTranscript: "10/10/2026 Hemoglobina 11,5 g/dL",
      });
      expect(ext.status).toBe(201);
      await vi.waitFor(() => expect(spyMotor).toHaveBeenCalledTimes(2));
      expect(spyCanal).toHaveBeenCalledTimes(2);
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
