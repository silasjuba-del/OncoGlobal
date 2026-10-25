// G2 · Caracterização da Matriz de Contexto e Sessão na Fronteira HTTP (Cenários 3, 4 e 6).
// Base: 52b8f7a04c2e467c5c3b3cb93bc38a7673cc4c93 (codex/estabilizacao-g01-reconciliacao).
import { describe, expect, it } from "vitest";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { receberTransporteSintetico } from "../../src/server/canalEntrada.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";
import { triagemBase } from "../fixtures/triagem.js";
import {
  abrirServidorHttpG2,
  criarFonteSinteticaG2,
  G2_CONTEXTO,
  G2_CONTEXTO_SEM_LOTE,
  G2_INSTANTE_BASE,
  G2_INSTANTE_EXPIRADO,
  G2_OUTRO_CONTEXTO,
  G2_SENHA_SINTETICA,
  semearPacienteELoteG2,
  sha256Independente,
} from "../fixtures/g2-integridade.js";

describe("G2 · Cenário 6A: GerenciadorSessao (consultaSelecionada, bundleExibido e ramo tumorLotId undefined)", () => {
  it("caracteriza invalidação de bundle ao trocar contexto e o comportamento de tumorLotId: undefined em bundleExibido", () => {
    let agora = G2_INSTANTE_BASE;
    const sessoes = criarGerenciadorSessao({
      medicoId: "medico-g2-sessao",
      crm: "CRM-G2-SESSAO",
      senha: G2_SENHA_SINTETICA,
      duracaoMs: 60_000,
      agora: () => agora,
    });
    const { token } = sessoes.login(G2_SENHA_SINTETICA)!;
    const doc = { documentId: "doc-g2-1", documentVersion: 1, conteudoHash: "a".repeat(64), draftId: "draft-g2-1" };

    sessoes.selecionarConsulta(token, { ...G2_CONTEXTO });
    sessoes.registrarBundleExibido(token, { ...G2_CONTEXTO }, [doc]);

    // Mesmo contexto exato -> retorna o bundle:
    expect(sessoes.bundleExibido(token, { ...G2_CONTEXTO })).toEqual([doc]);
    // tumorLotId: null quando o bundle foi registrado com lote "lote-g2-01" -> retorna null:
    expect(sessoes.bundleExibido(token, { ...G2_CONTEXTO_SEM_LOTE })).toBeNull();
    // Outro encontro ou outro paciente -> retorna null:
    expect(sessoes.bundleExibido(token, { ...G2_CONTEXTO, encounterId: "outro-encontro" })).toBeNull();
    expect(sessoes.bundleExibido(token, { ...G2_CONTEXTO, patientId: "outro-paciente" })).toBeNull();

    // Invertido em G3b: o lote é obrigatório no tipo da sessão e a ausência não é curinga.
    // Um chamador sem tipos que omita `tumorLotId` deixa de casar com o comprovante (antes: retornava [doc]).
    expect(
      sessoes.bundleExibido(token, {
        patientId: G2_CONTEXTO.patientId,
        encounterId: G2_CONTEXTO.encounterId,
      } as unknown as Parameters<typeof sessoes.bundleExibido>[1]),
    ).toBeNull();

    // Trocar o lote na seleção de consulta apaga o bundle e os alertas exibidos (`sessao.ts:110-112`):
    sessoes.selecionarConsulta(token, { ...G2_CONTEXTO_SEM_LOTE });
    expect(sessoes.bundleExibido(token, { ...G2_CONTEXTO })).toBeNull();
    expect(sessoes.bundleExibido(token, { ...G2_CONTEXTO_SEM_LOTE })).toBeNull();

    // Expirar a sessão invalida `obter`, `consultaSelecionada` e `bundleExibido`:
    agora = G2_INSTANTE_EXPIRADO;
    expect(sessoes.obter(token)).toBeNull();
    expect(sessoes.consultaSelecionada(token)).toBeNull();
  });
});

describe("G2 · Cenário 6B: Matriz de contexto HTTP em selecionarContexto, bundle, confirmar e estadoDoenca", () => {
  it("valida selecionarContexto, exibirBundle e confirmarBloco contra contextos ausentes, nulos, inválidos e divergentes", async () => {
    const srv = await abrirServidorHttpG2();
    try {
      semearPacienteELoteG2(srv.db, srv.sessao, srv.obterAgora(), G2_CONTEXTO);
      semearPacienteELoteG2(srv.db, srv.sessao, srv.obterAgora(), G2_OUTRO_CONTEXTO);

      // 1) `/consulta/contexto/selecionar`:
      // - Campo `tumorLotId` ausente (undefined) -> 400 PAYLOAD_INVALIDO (`Id.nullable()` exige chave presente `string | null`):
      expect(
        await srv.post("/consulta/contexto/selecionar", {
          patientId: G2_CONTEXTO.patientId,
          encounterId: G2_CONTEXTO.encounterId,
        }),
      ).toEqual({ status: 400, data: { codigo: "PAYLOAD_INVALIDO" } });

      // - `tumorLotId` pertencente a outro paciente -> 409 TUMOR_LOT_FORA_DO_PACIENTE:
      expect(
        await srv.post("/consulta/contexto/selecionar", {
          patientId: G2_CONTEXTO.patientId,
          encounterId: G2_CONTEXTO.encounterId,
          tumorLotId: G2_OUTRO_CONTEXTO.tumorLotId,
        }),
      ).toEqual({ status: 409, data: { codigo: "TUMOR_LOT_FORA_DO_PACIENTE" } });

      // - Encontro inexistente no paciente -> 409 ENCONTRO_FORA_DO_ESCOPO:
      expect(
        await srv.post("/consulta/contexto/selecionar", {
          patientId: G2_CONTEXTO.patientId,
          encounterId: "encontro-inexistente",
          tumorLotId: G2_CONTEXTO.tumorLotId,
        }),
      ).toEqual({ status: 409, data: { codigo: "ENCONTRO_FORA_DO_ESCOPO" } });

      // - Contexto válido com `tumorLotId` explícito -> 200 CONTEXTO_SELECIONADO:
      expect(await srv.post("/consulta/contexto/selecionar", G2_CONTEXTO)).toEqual({
        status: 200,
        data: { codigo: "CONTEXTO_SELECIONADO" },
      });

      // 2) `/consulta/bundle` e `/consulta/confirmar`:
      const draftPayload = {
        documentId: "doc-flash-g2",
        documentVersion: 1,
        documentHash: "b".repeat(64),
        titulo: "Evolução sintética G2",
        texto: "Conteúdo sintético para exibição e confirmação.",
        contexto: { ...G2_CONTEXTO },
      };
      salvarDraft(srv.db, {
        draftId: "draft-doc-g2",
        patientId: G2_CONTEXTO.patientId,
        sourceId: "fonte-doc-g2",
        rawRef: "raw-doc-g2",
        payload: draftPayload,
        diagnostics: [],
        revision: 0,
        criadoEm: srv.obterAgora(),
      });

      // - `tumorLotId: null` quando o draft pertence a `lote-g2-01` -> 409 DRAFT_LOTE_DIVERGENTE:
      expect(
        await srv.post("/consulta/bundle", {
          ...G2_CONTEXTO_SEM_LOTE,
          draftIds: ["draft-doc-g2"],
        }),
      ).toEqual({ status: 409, data: { codigo: "DRAFT_LOTE_DIVERGENTE" } });

      // - `encounterId` divergente -> 409 DRAFT_ENCONTRO_DIVERGENTE:
      expect(
        await srv.post("/consulta/bundle", {
          ...G2_CONTEXTO,
          encounterId: "outro-encontro",
          draftIds: ["draft-doc-g2"],
        }),
      ).toEqual({ status: 409, data: { codigo: "DRAFT_ENCONTRO_DIVERGENTE" } });

      // - Exibição válida com `G2_CONTEXTO` -> 200:
      const bundleRes = await srv.post("/consulta/bundle", {
        ...G2_CONTEXTO,
        draftIds: ["draft-doc-g2"],
      });
      expect(bundleRes.status).toBe(200);

      // - Se a consulta selecionada na sessão mudar para `tumorLotId: null`, `/consulta/confirmar` nega:
      //   Como `selecionarConsulta` limpa o bundle exibido na troca de lote, a primeira barreira atingida é `BUNDLE_NAO_EXIBIDO`.
      srv.sessoes.selecionarConsulta(srv.token, { ...G2_CONTEXTO_SEM_LOTE });
      expect(
        await srv.post("/consulta/confirmar", {
          ...G2_CONTEXTO,
          bloco: "TUDO",
          registros: [{ id: "draft-doc-g2", expectedRevision: 0 }],
          documentosExibidos: [{ documentId: "doc-flash-g2", documentVersion: 1 }],
          reconhecerAlertas: [],
          idempotencyKey: "key-confirmar-g2-01",
        }),
      ).toEqual({ status: 409, data: { codigo: "BUNDLE_NAO_EXIBIDO" } });

      // - Re-seleciona `G2_CONTEXTO`, re-exibe bundle e confirma -> 200 GRAVADA e depois 200 REPLAY mesmo com relógio adiantado:
      srv.sessoes.selecionarConsulta(srv.token, { ...G2_CONTEXTO });
      await srv.post("/consulta/bundle", { ...G2_CONTEXTO, draftIds: ["draft-doc-g2"] });
      const pedidoConfirmar = {
        ...G2_CONTEXTO,
        bloco: "TUDO",
        registros: [{ id: "draft-doc-g2", expectedRevision: 0 }],
        documentosExibidos: [{ documentId: "doc-flash-g2", documentVersion: 1 }],
        reconhecerAlertas: [],
        idempotencyKey: "key-confirmar-g2-01",
      };
      expect(await srv.post("/consulta/confirmar", pedidoConfirmar)).toMatchObject({
        status: 200,
        data: { codigo: "GRAVADA" },
      });
      srv.definirAgora("2026-10-10T10:15:00.000Z");
      expect(await srv.post("/consulta/confirmar", pedidoConfirmar)).toMatchObject({
        status: 200,
        data: { codigo: "REPLAY" },
      });
    } finally {
      await srv.fechar();
    }
  });

  it("caracteriza estadoDoenca: exige tumorLotId não nulo (TUMOR_LOT_OBRIGATORIO) e bloqueia quando contexto da sessão diverge", async () => {
    const srv = await abrirServidorHttpG2();
    try {
      semearPacienteELoteG2(srv.db, srv.sessao, srv.obterAgora(), G2_CONTEXTO);

      // 1) Sessão selecionada sem lote (`tumorLotId: null`) -> `/consulta/estado-doenca/preparar` com `tumorLotId: null`
      //    retorna 409 TUMOR_LOT_OBRIGATORIO (`src/server/estadoDoenca.ts:26`):
      srv.sessoes.selecionarConsulta(srv.token, { ...G2_CONTEXTO_SEM_LOTE });
      expect(
        await srv.post("/consulta/estado-doenca/preparar", {
          ...G2_CONTEXTO_SEM_LOTE,
          estado: "REMISSAO",
          data: "2026-10-10",
          fundamento: "Avaliação sintética G2.",
        }),
      ).toEqual({ status: 409, data: { codigo: "TUMOR_LOT_OBRIGATORIO" } });

      // 2) Pedido com `tumorLotId: "lote-g2-01"` enquanto a sessão está em `tumorLotId: null` -> 409 CONTEXTO_CONSULTA_ALTERADO:
      expect(
        await srv.post("/consulta/estado-doenca/preparar", {
          ...G2_CONTEXTO,
          estado: "REMISSAO",
          data: "2026-10-10",
          fundamento: "Avaliação sintética G2.",
        }),
      ).toEqual({ status: 409, data: { codigo: "CONTEXTO_CONSULTA_ALTERADO" } });

      // 3) Com `G2_CONTEXTO` selecionado na sessão e `motorF1` processado, prepara e confirma:
      srv.sessoes.selecionarConsulta(srv.token, { ...G2_CONTEXTO });
      await srv.motorF1.processar();
      const prep = await srv.post<{ draftId: string; conteudoHash: string }>(
        "/consulta/estado-doenca/preparar",
        {
          ...G2_CONTEXTO,
          estado: "REMISSAO",
          data: "2026-10-10",
          fundamento: "Avaliação sintética G2.",
        },
      );
      expect(prep.status).toBe(200);

      // 4) Confirmação e replay idempotente com relógio avançado (via `leitura.itens.find(e => e.operationId === s.operationId)` em `estadoDoenca.ts:58-61`):
      const conf1 = await srv.post("/consulta/estado-doenca/confirmar", {
        ...G2_CONTEXTO,
        draftId: prep.data.draftId,
        conteudoHash: prep.data.conteudoHash,
      });
      expect(conf1).toMatchObject({ status: 200, data: { codigo: "GRAVADA" } });

      srv.definirAgora("2026-10-10T10:20:00.000Z");
      const confReplay = await srv.post("/consulta/estado-doenca/confirmar", {
        ...G2_CONTEXTO,
        draftId: prep.data.draftId,
        conteudoHash: prep.data.conteudoHash,
      });
      expect(confReplay).toMatchObject({ status: 200, data: { codigo: "REPLAY" } });
    } finally {
      await srv.fechar();
    }
  });
});

describe("G2 · Cenário 6C: Operações por encontro/paciente em salaoCanal e salaoContingencia (casos A CONFERIR de E1)", () => {
  it("caracteriza liberarSalao e gerarContingenciaSalao: comparam patientId + encounterId ignorando tumorLotId da sessão", async () => {
    const srv = await abrirServidorHttpG2();
    try {
      semearPacienteELoteG2(srv.db, srv.sessao, srv.obterAgora(), G2_CONTEXTO);

      // Seleciona consulta COM lote (`tumorLotId: "lote-g2-01"`) na sessão:
      srv.sessoes.selecionarConsulta(srv.token, { ...G2_CONTEXTO });

      // 1) `gerarContingenciaSalao` (`src/server/salaoContingencia.ts:19-21`):
      // O contrato `GerarContingenciaSalao` não tem `tumorLotId`; compara apenas `ctx.patientId` e `ctx.encounterId`.
      const pedidoContingencia = {
        patientId: G2_CONTEXTO.patientId,
        encounterId: G2_CONTEXTO.encounterId,
        operationId: "op-contingencia-g2-01",
        destino: "SALAO",
        emergenciaAtiva: false,
        alertasOperacionaisE1: [],
        resumoTriagem: { PAS: "120 mmHg", FC: "78 bpm" },
      };
      const contOk = await srv.post("/consulta/salao/contingencia/gerar", pedidoContingencia);
      expect(contOk.status).toBe(200);

      // Replay idempotente com mesmo payload retorna 200; payload diferente com mesmo operationId retorna 409 FOLHA_ID_CONFLITANTE:
      expect((await srv.post("/consulta/salao/contingencia/gerar", pedidoContingencia)).status).toBe(200);
      expect(
        await srv.post("/consulta/salao/contingencia/gerar", {
          ...pedidoContingencia,
          destino: "FRENTE",
        }),
      ).toEqual({ status: 409, data: { codigo: "FOLHA_ID_CONFLITANTE" } });

      // Se `encounterId` divergir da sessão -> 409 CONTEXTO_CONSULTA_ALTERADO:
      expect(
        await srv.post("/consulta/salao/contingencia/gerar", {
          ...pedidoContingencia,
          encounterId: "outro-encontro",
        }),
      ).toEqual({ status: 409, data: { codigo: "CONTEXTO_CONSULTA_ALTERADO" } });

      // 2) `salvarTriagemSalao` e `liberarSalao` (`src/server/rotas/salaoCanal.ts:69-71, 140-141, 181`):
      // Mesmo com `tumorLotId: "lote-g2-01"` selecionado na sessão, `salvarTriagemSalao` e `liberarSalao`
      // comparam apenas `patientId` e `encounterId` e gravam `tumorLotId: null` no evento `ReviewDecision`.
      const triagemComCorte = triagemBase({
        patientId: G2_CONTEXTO.patientId,
        encounterId: G2_CONTEXTO.encounterId,
        chegadaEm: "2026-10-10T08:00:00-03:00",
        pas: {
          valor: 80,
          estado: "VERDE",
          campo: "PRESENTE",
          motivo: "PAS baixa para acionar corte de salão na fixture G2",
          fontes: [criarFonteSinteticaG2("fonte-triagem-g2")],
          revisao: "CONFIRMADO",
        },
      });
      const salvarTriagemRes = await srv.post<{ rascunho: { revision: number } }>(
        "/consulta/salao/triagem",
        { triagem: triagemComCorte, expectedRevision: null },
      );
      expect(salvarTriagemRes.status).toBe(200);
      srv.sessoes.selecionarConsulta(srv.token,null);srv.sessoes.selecionarConsulta(srv.token,{...G2_CONTEXTO});
      expect(await srv.post('/consulta/salao/liberar',{patientId:G2_CONTEXTO.patientId,encounterId:G2_CONTEXTO.encounterId,
        expectedRevision:salvarTriagemRes.data.rascunho.revision,motivo:'Revisar corte',idempotencyKey:'sem-exibicao-g2'}))
        .toMatchObject({status:409,data:{codigo:'CORTE_NAO_EXIBIDO_NESTA_SESSAO'}});
      expect((await srv.post('/consulta/salao',{})).status).toBe(200);

      const liberarRes = await srv.post("/consulta/salao/liberar", {
        patientId: G2_CONTEXTO.patientId,
        encounterId: G2_CONTEXTO.encounterId,
        expectedRevision: salvarTriagemRes.data.rascunho.revision,
        motivo: "Liberação médica sintética para caracterização G2",
        idempotencyKey: "key-liberar-salao-g2",
      });
      expect(liberarRes).toMatchObject({ status: 200, data: { codigo: "GRAVADA" } });

      // Confirma que o evento `ReviewDecision` gravado por `liberarSalao` tem `tumorLotId: null`:
      const decisaoSalao = srv
        .eventosDoPaciente(G2_CONTEXTO.patientId)
        .find((e) => e.operationId === "salao-release-key-liberar-salao-g2");
      expect(decisaoSalao?.tumorLotId).toBeNull();
      expect(decisaoSalao?.encounterId).toBe(G2_CONTEXTO.encounterId);
    } finally {
      await srv.fechar();
    }
  });

  it("caracteriza vincularCanal operacional: compara apenas patientId na sessão e retorna REPLAY após vínculo ativo (salaoCanal.ts:196-229)", async () => {
    const srv = await abrirServidorHttpG2();
    try {
      semearPacienteELoteG2(srv.db, srv.sessao, srv.obterAgora(), G2_CONTEXTO);
      semearPacienteELoteG2(srv.db, srv.sessao, srv.obterAgora(), G2_OUTRO_CONTEXTO);

      const telefone = "+55-00-0000-0000"; // telefone sintético já declarado na varredura de PHI
      const texto = "Relato sintético para caracterização de vínculo G2.";
      const ing = receberTransporteSintetico(srv.db, {
        accountId: "conta-g2",
        canal: "WHATSAPP_SERVICO",
        providerMessageId: "msg-g2-vinc-01",
        senderRef: telefone,
        providerSentAt: G2_INSTANTE_BASE,
        ingestedAt: G2_INSTANTE_BASE,
        conteudo: {
          tipo: "TEXT",
          texto,
          contentSha256: sha256Independente(texto),
        },
        cadastros: [],
      });
      expect(ing.ok).toBe(true);

      // Sem consulta selecionada ou com outro paciente selecionado -> 409 CONTEXTO_CONSULTA_ALTERADO:
      srv.sessoes.selecionarConsulta(srv.token, { ...G2_OUTRO_CONTEXTO });
      expect(
        await srv.post("/consulta/canal/vincular", {
          contatoId: telefone,
          patientId: G2_CONTEXTO.patientId,
          idempotencyKey: "key-vincular-canal-g2",
        }),
      ).toEqual({ status: 409, data: { codigo: "CONTEXTO_CONSULTA_ALTERADO" } });

      // Seleciona o paciente correto: `vincularCanal` grava evento `Contato` no `encounterId` e `tumorLotId` da sessão:
      srv.sessoes.selecionarConsulta(srv.token, { ...G2_CONTEXTO });
      const vinc1 = await srv.post("/consulta/canal/vincular", {
        contatoId: telefone,
        patientId: G2_CONTEXTO.patientId,
        idempotencyKey: "key-vincular-canal-g2",
      });
      expect(vinc1.status).toBe(200);

      // Chamada subsequente para o mesmo contato/paciente cai em `if (vinculoAtualCanal(...)) return reply(200, "REPLAY", ...)` (`salaoCanal.ts:205-206`):
      const vincReplay = await srv.post("/consulta/canal/vincular", {
        contatoId: telefone,
        patientId: G2_CONTEXTO.patientId,
        idempotencyKey: "key-vincular-canal-g2",
      });
      expect(vincReplay.status).toBe(200);
      expect(srv.eventosDoPaciente(G2_CONTEXTO.patientId).filter((e) => e.tipo === "Contato")).toHaveLength(1);
    } finally {
      await srv.fechar();
    }
  });
});
