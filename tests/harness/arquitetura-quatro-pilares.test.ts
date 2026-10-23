import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { criarWriterClinicoGateway } from "../../src/kernel/gateway/gateway.js";
import { calcularHashTestCongelado, executarHarnessAvaliacao, type CasoSinteticoAvaliacao } from "../../src/kernel/harness/avaliacao.js";
import { verificarPropostaNoHarnessRuntime } from "../../src/kernel/harness/runtime.js";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { produzirPropostaBrainOs } from "../../src/kernel/llm/brainOs.js";
import { hashCanonico } from "../../src/modules/tipos.js";

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const AGORA = "2026-10-07T12:00:00.000Z";
const PACIENTE = "Paciente Teste 01";

describe("BRAIN_OS · Propostas com citações/proveniência, sem credenciais nem escrita, com mesa e ambiguidades explícitas", () => {
  it("recusa imediatamente entradas contendo credenciais ou portas de escrita", () => {
    expect(() => produzirPropostaBrainOs({
      propostaId: "prop-cred",
      agora: AGORA,
      apiKey: "segredo-nao-permitido",
      fontes: [{ sourceId: "f1", versao: "v1", conteudo: "Texto sintético" }],
    })).toThrow("BRAIN_OS_CREDENCIAIS_PROIBIDAS");

    expect(() => produzirPropostaBrainOs({
      propostaId: "prop-write",
      agora: AGORA,
      salvar: () => {},
      fontes: [{ sourceId: "f1", versao: "v1", conteudo: "Texto sintético" }],
    })).toThrow("BRAIN_OS_ESCRITA_PROIBIDA");
  });

  it("registra motivo de inclusão na mesa, referências excluídas, ambiguidades e lacunas sem escolha silenciosa", () => {
    const fonte1 = "Laudo anatomopatológico sintético: Adenocarcinoma invasivo de cólon. HER2 escore 2+.";
    const fonte2 = "Revisão de lâmina sintética: HER2 escore 3+. Nega invasão perineural.";

    const proposta = produzirPropostaBrainOs({
      propostaId: "prop-brain-01",
      patientId: PACIENTE,
      encounterId: "enc-01",
      agora: AGORA,
      fontes: [
        { sourceId: "patologia-1", versao: "v1", conteudo: fonte1, localizadorPadrao: "p.1" },
        { sourceId: "patologia-2", versao: "v1", conteudo: fonte2, localizadorPadrao: "p.1" },
      ],
      referenciasCandidatas: [
        {
          referenciaId: "ref-colon-her2",
          versao: "2.0",
          status: "CONSULTAVEL",
          escopoCompativel: true,
          provenienciaCompleta: true,
          termosChave: ["adenocarcinoma", "her2"],
          motivoInclusaoSeAplicavel: "Diretriz de biomarcadores em adenocarcinoma de cólon aplicável ao caso.",
        },
        {
          referenciaId: "ref-colon-her2",
          versao: "1.0",
          status: "CONSULTAVEL",
          escopoCompativel: true,
          provenienciaCompleta: true,
          termosChave: ["adenocarcinoma"],
          motivoInclusaoSeAplicavel: "Versão anterior.",
        },
        {
          referenciaId: "ref-rascunho",
          versao: "1.0",
          status: "RASCUNHO",
          escopoCompativel: true,
          provenienciaCompleta: true,
          termosChave: ["adenocarcinoma"],
          motivoInclusaoSeAplicavel: "Não deve entrar.",
        },
        {
          referenciaId: "ref-sem-pub",
          versao: "1.0",
          status: "CONSULTAVEL",
          escopoCompativel: true,
          provenienciaCompleta: false,
          termosChave: ["adenocarcinoma"],
          motivoInclusaoSeAplicavel: "Sem publicação.",
        },
      ],
      candidatos: [
        {
          campo: "histologia",
          valor: "Adenocarcinoma invasivo",
          sourceId: "patologia-1",
          trecho: "Adenocarcinoma invasivo de cólon.",
        },
        {
          campo: "invasao_perineural",
          valor: "invasão perineural",
          sourceId: "patologia-2",
          trecho: "Nega invasão perineural.",
        },
        {
          campo: "her2",
          valor: "2+",
          sourceId: "patologia-1",
          trecho: "HER2 escore 2+.",
        },
        {
          campo: "her2",
          valor: "3+",
          sourceId: "patologia-2",
          trecho: "HER2 escore 3+.",
        },
      ],
      camposObrigatorios: [
        { campo: "histologia", obrigatoriedade: "CRITICA", motivo: "Histologia primária obrigatória." },
        { campo: "instabilidade_microssatelite", obrigatoriedade: "CRITICA", motivo: "Status MMR/MSI ausente nas fontes." },
      ],
    });

    expect(proposta.possuiCredenciais).toBe(false);
    expect(proposta.possuiEscritaClinica).toBe(false);
    expect(proposta.inclusoesMesa).toEqual([{
      referenciaId: "ref-colon-her2",
      versao: "2.0",
      motivoInclusao: "Diretriz de biomarcadores em adenocarcinoma de cólon aplicável ao caso.",
      trechoCitado: fonte1,
    }]);
    expect(proposta.referenciasExcluidas.map((r) => [r.referenciaId, r.versao, r.motivoCodigo])).toEqual([
      ["ref-colon-her2", "1.0", "DUPLICADA_POR_VERSAO_SUPERIOR"],
      ["ref-rascunho", "1.0", "STATUS_NAO_CONSULTAVEL"],
      ["ref-sem-pub", "1.0", "PROVENIENCIA_INCOMPLETA"],
    ]);
    expect(proposta.ambiguidades).toHaveLength(1);
    expect(proposta.ambiguidades[0]).toMatchObject({
      campo: "her2",
      valorEscolhido: null,
      escolhaSilenciosa: false,
    });
    expect(proposta.ambiguidades[0]!.candidatos).toHaveLength(2);
    expect(proposta.lacunas).toEqual([{
      campo: "instabilidade_microssatelite",
      obrigatoriedade: "CRITICA",
      motivo: "Status MMR/MSI ausente nas fontes.",
      valorPreenchido: null,
    }]);
    const itemNegado = proposta.itensPropostos.find((i) => i.campo === "invasao_perineural");
    expect(itemNegado?.qualificador).toBe("NEGADO");
    expect(itemNegado?.validado).toBe(false);
  });
});

describe("HARNESS DE RUNTIME · Verificação determinística independente, áudio não validado e cobertura não verificada", () => {
  it("para áudio: não declara acurácia sem conferência humana e mantém números críticos não validados e destacados", () => {
    const audioTexto = "Ditado sintético: lesão-alvo hepática medindo 3,4 cm; administrar carboplatina 450 mg.";
    const hashAudio = sha256(audioTexto);

    const proposta = produzirPropostaBrainOs({
      propostaId: "prop-audio-01",
      patientId: PACIENTE,
      encounterId: "enc-01",
      agora: AGORA,
      fontes: [{ sourceId: "audio-1", versao: "v1", conteudo: audioTexto }],
      candidatos: [
        {
          campo: "medida_lesao",
          valor: 3.4,
          unidade: "cm",
          criticoNumero: true,
          sourceId: "audio-1",
          trecho: "lesão-alvo hepática medindo 3,4 cm",
        },
        {
          campo: "dose_carboplatina",
          valor: 450,
          unidade: "mg",
          criticoNumero: true,
          sourceId: "audio-1",
          trecho: "administrar carboplatina 450 mg.",
        },
      ],
    });

    const veredito = verificarPropostaNoHarnessRuntime({
      proposta,
      fontesOriginais: [{
        sourceId: "audio-1",
        versao: "v1",
        modalidade: "AUDIO",
        conteudoOriginal: audioTexto,
        contentHash: hashAudio,
        trechoAudioConferidoHumano: false,
      }],
    });

    expect(veredito.tratadaComoFonteDeVerdade).toBe(false);
    expect(veredito.corrigidoSilenciosamente).toBe(false);
    expect(veredito.decisaoClinicaTomada).toBe(false);
    expect(veredito.acuraciaAudioDeclarada).toBe(false);
    expect(veredito.itensVerificados).toHaveLength(2);
    for (const item of veredito.itensVerificados) {
      expect(item.modalidadeAudio).toBe(true);
      expect(item.criticoNumero).toBe(true);
      expect(item.validado).toBe(false);
      expect(item.destacadoParaEscutaRevisaoHumana).toBe(true);
    }
  });

  it("detecta inversão de qualificador, normalização divergente, falha de identidade e cobertura não verificada", () => {
    const docTexto = "Paciente: Outro Paciente Sintetico\nCPF: 000.000.000-00\nNega dispneia. Creatinina 1,2 mg/dL.";
    const hashDoc = sha256(docTexto);

    const veredito = verificarPropostaNoHarnessRuntime({
      proposta: {
        propostaId: "prop-adversarial-01",
        patientId: PACIENTE,
        itensPropostos: [
          {
            itemId: "i-dispneia",
            campo: "dispneia",
            valorProposto: "dispneia",
            qualificador: "AFIRMADO", // invertido! Na fonte consta "Nega dispneia."
            citacoes: [{ sourceId: "doc-1", versao: "v1", contentHash: hashDoc, trecho: "Nega dispneia." }],
          },
          {
            itemId: "i-creat",
            campo: "creatinina",
            valorProposto: 2.5, // normalização adulterada! Na fonte consta 1,2
            unidade: "mg/dL",
            qualificador: "AFIRMADO",
            criticoNumero: true,
            validado: true, // pré-validado ilegalmente!
            citacoes: [{ sourceId: "doc-1", versao: "v1", contentHash: hashDoc, trecho: "Creatinina 1,2 mg/dL." }],
          },
        ],
      },
      fontesOriginais: [
        {
          sourceId: "doc-1",
          versao: "v1",
          modalidade: "DOCUMENTO",
          conteudoOriginal: docTexto,
          contentHash: hashDoc,
          identidadeEsperadaPaciente: {
            patientId: PACIENTE,
            nome: PACIENTE,
            // O conflito é de nome; nenhum identificador com aparência de CPF real entra na fixture.
            identificadores: [],
          },
        },
        {
          sourceId: "doc-sem-bytes",
          versao: "v1",
          modalidade: "DOCUMENTO",
          conteudoOriginal: null,
          contentHash: null,
        },
      ],
      camposCriticosObrigatorios: ["estadiamento_tnm"],
    });

    expect(veredito.cobertura).toBe("PARCIALMENTE_VERIFICADA");
    expect(veredito.fontesNaoVerificaveis).toEqual([{
      sourceId: "doc-sem-bytes",
      motivo: "Fonte original sem texto/bytes íntegros ou sem hash para verificação independente.",
    }]);
    expect(veredito.status).toBe("BLOQUEADO_FALHA_CRITICA");
    const tiposManifestados = veredito.manifestacoes.map((m) => m.tipo);
    expect(tiposManifestados).toContain("FALHA_IDENTIDADE");
    expect(tiposManifestados).toContain("QUALIFICADOR_DIVERGENTE");
    expect(tiposManifestados).toContain("NORMALIZACAO_DIVERGENTE");
    expect(tiposManifestados).toContain("VALOR_CRITICO_PRE_VALIDADO");
    expect(tiposManifestados).toContain("OMISSAO_CRITICA");
  });
});

describe("GATEWAY · Único writer clínico com validação de identidade, permissões, schema, proveniência e regras determinísticas", () => {
  it("bloqueia escrita por BRAIN_OS/AGENTE, exige proveniência e regras determinísticas, e persiste após autorização médica", () => {
    const db = abrirLedger(":memory:");
    try {
      const writer = criarWriterClinicoGateway({ db, agora: () => AGORA,
        hashFonteOriginal: (draft) => draft.sourceId === "fonte-lab-01"
          ? sha256("Creatinina 1,1 mg/dL") : null });
      expect(writer.funilEscrita).toBe("ledger.writeRouter.confirmar");

      const payloadFato = { campo: "creatinina", valor: 1.1, unidade: "mg/dL" };
      salvarDraft(db, {
        draftId: "draft-fato-01",
        patientId: PACIENTE,
        sourceId: "fonte-lab-01",
        rawRef: "referencia-local",
        payload: payloadFato,
        diagnostics: [],
        revision: 0,
        criadoEm: AGORA,
      });
      const hashExibido = hashCanonico(payloadFato);
      const sessaoMedica = {
        medicoId: "medico-01",
        crm: "CRM-TESTE",
        emitidaEm: AGORA,
        expiraEm: "2026-10-07T14:00:00.000Z",
      };
      const fonteValida = [{
        sourceId: "fonte-lab-01",
        classe: "LAB_FEED" as const,
        localizador: "linha 1",
        dataClinica: "2026-10-07",
        dataCaptura: AGORA,
        versao: "v1",
        contentHash: sha256("Creatinina 1,1 mg/dL"),
      }];

      // 1. BRAIN_OS nunca pode escrever
      const negadoBrain = writer.persistir({
        operationId: "op-gw-brain",
        reviewDecisionId: "rev-gw-brain",
        ator: { tipo: "BRAIN_OS", id: "brain-1" },
        sessao: sessaoMedica,
        acaoMedicaExplicita: true,
        contexto: { patientId: PACIENTE, encounterId: "enc-01", tumorLotId: null },
        bundleExibidoNoServidor: [{ documentId: "draft-fato-01", documentVersion: 1, conteudoHash: hashExibido, draftId: "draft-fato-01" }],
        documentosAssinadosNoPedido: [{ documentId: "draft-fato-01", documentVersion: 1 }],
        registros: [{
          draftId: "draft-fato-01",
          expectedRevision: 0,
          eventId: "ev-gw-brain",
          tipo: "FATO",
          payload: payloadFato,
          fontes: fonteValida,
          revisao: "CONFIRMADO",
        }],
      });
      expect(negadoBrain).toEqual({
        decisao: "NEGADA",
        motivoCodigo: "ESCRITA_CLINICA_EXIGE_AUTORIZACAO_MEDICA",
        resultRef: null,
      });

      // 2. Sem proveniência em fato clínico -> bloqueado
      const negadoSemProv = writer.persistir({
        operationId: "op-gw-sem-prov",
        reviewDecisionId: "rev-gw-sem-prov",
        ator: { tipo: "SESSAO", id: "medico-01" },
        sessao: sessaoMedica,
        acaoMedicaExplicita: true,
        contexto: { patientId: PACIENTE, encounterId: "enc-01", tumorLotId: null },
        bundleExibidoNoServidor: [{ documentId: "draft-fato-01", documentVersion: 1, conteudoHash: hashExibido, draftId: "draft-fato-01" }],
        documentosAssinadosNoPedido: [{ documentId: "draft-fato-01", documentVersion: 1 }],
        registros: [{
          draftId: "draft-fato-01",
          expectedRevision: 0,
          eventId: "ev-gw-sem-prov",
          tipo: "FATO",
          payload: payloadFato,
          fontes: [],
          revisao: "CONFIRMADO",
        }],
      });
      expect(negadoSemProv.motivoCodigo).toBe("PROVENIENCIA_OBRIGATORIA_AUSENTE");

      // 3. Regra determinística G-09 reprovada (pT em biópsia incisional) -> bloqueado
      const negadoG09 = writer.persistir({
        operationId: "op-gw-g09",
        reviewDecisionId: "rev-gw-g09",
        ator: { tipo: "SESSAO", id: "medico-01" },
        sessao: sessaoMedica,
        acaoMedicaExplicita: true,
        contexto: { patientId: PACIENTE, encounterId: "enc-01", tumorLotId: null },
        bundleExibidoNoServidor: [{ documentId: "draft-fato-01", documentVersion: 1, conteudoHash: hashExibido, draftId: "draft-fato-01" }],
        documentosAssinadosNoPedido: [{ documentId: "draft-fato-01", documentVersion: 1 }],
        regrasDeterministicas: {
          ptBiopsia: { prefixo: "p", specimen: "BIOPSIA", tnmExplicito: true },
        },
        registros: [{
          draftId: "draft-fato-01",
          expectedRevision: 0,
          eventId: "ev-gw-g09",
          tipo: "FATO",
          payload: payloadFato,
          fontes: fonteValida,
          revisao: "CONFIRMADO",
        }],
      });
      expect(negadoG09.motivoCodigo).toBe("REGRA_DETERMINISTICA_G09_REPROVADA");

      // 4. Escrita autorizada pelo médico com sessão, proveniência, hash exibido e regras determinísticas válidas
      const ok = writer.persistir({
        operationId: "op-gw-ok-01",
        reviewDecisionId: "rev-gw-ok-01",
        ator: { tipo: "SESSAO", id: "medico-01" },
        sessao: sessaoMedica,
        acaoMedicaExplicita: true,
        contexto: { patientId: PACIENTE, encounterId: "enc-01", tumorLotId: null },
        bundleExibidoNoServidor: [{ documentId: "draft-fato-01", documentVersion: 1, conteudoHash: hashExibido, draftId: "draft-fato-01" }],
        documentosAssinadosNoPedido: [{ documentId: "draft-fato-01", documentVersion: 1 }],
        regrasDeterministicas: {
          lateralidade: {
            orgao: "mama",
            path: "DIREITA",
            rads: "DIREITA",
            procedimento: "DIREITA",
            diagnostico: "DIREITA",
          },
        },
        registros: [{
          draftId: "draft-fato-01",
          expectedRevision: 0,
          eventId: "ev-gw-ok-01",
          tipo: "FATO",
          payload: payloadFato,
          fontes: fonteValida,
          revisao: "CONFIRMADO",
        }],
      });
      expect(ok).toEqual({
        decisao: "PERSISTIDA",
        motivoCodigo: "ESCRITA_CLINICA_PERSISTIDA",
        resultRef: "ev-gw-ok-01",
      });
      expect(writer.historicoEventos(PACIENTE)).toHaveLength(1);
      expect(writer.trilhaAuditoria().length).toBeGreaterThanOrEqual(4);
    } finally {
      db.close();
    }
  });
});

describe("HARNESS DE AVALIAÇÃO · Splits dev vs test congelado, denominadores/incerteza Wilson 95%, stub vs extrator e fail-closed", () => {
  const casosBase: CasoSinteticoAvaliacao[] = [
    {
      casoId: "caso-dev-01",
      versaoControle: "ctrl@1.0.0",
      sinteticoDeclarado: true,
      split: "dev",
      patientIdEsperado: PACIENTE,
      controlePositivo: {
        controleId: "cp-alergia-platina",
        classeAlvo: "CONTROLE_POSITIVO_SILENCIOSO",
        alertaEsperado: "ALERTA_CONTRAINDICACAO_PLATINA",
      },
      expectativas: {
        qualificadoresEsperados: { dispneia: "NEGADO" },
        conflitosEsperados: ["her2"],
        omissoesCriticasEsperadas: ["estadiamento_tnm"],
      },
      saidaObservada: {
        alertasEmitidos: ["ALERTA_CONTRAINDICACAO_PLATINA"],
        conflitosManifestados: ["her2"],
        omissoesCriticasManifestadas: ["estadiamento_tnm"],
        itensExtraidos: [{
          campo: "dispneia",
          valor: "dispneia",
          patientIdAtribuido: PACIENTE,
          qualificador: "NEGADO",
          criticoNumero: false,
          preValidadoSemConfirmacao: false,
          citacaoSustentada: true,
        }],
      },
    },
    {
      casoId: "caso-test-01",
      versaoControle: "ctrl@1.0.0",
      sinteticoDeclarado: true,
      split: "test_congelado",
      patientIdEsperado: PACIENTE,
      controlePositivo: {
        controleId: "cp-dose-critica",
        classeAlvo: "VALOR_NUMERICO_CRITICO_PRE_VALIDADO",
        alertaEsperado: "REQUER_CONFIRMACAO_HUMANA_DOSE",
      },
      saidaObservada: {
        alertasEmitidos: ["REQUER_CONFIRMACAO_HUMANA_DOSE"],
        conflitosManifestados: [],
        omissoesCriticasManifestadas: [],
        itensExtraidos: [{
          campo: "dose_cisplatina",
          valor: 75,
          patientIdAtribuido: PACIENTE,
          qualificador: "AFIRMADO",
          criticoNumero: true,
          preValidadoSemConfirmacao: false,
          citacaoSustentada: true,
        }],
      },
    },
  ];

  it("reporta denominadores e intervalo de confiança Wilson 95% por classe de erro e distingue stub de extrator", () => {
    const hashCongelado = calcularHashTestCongelado(casosBase);

    const relStub = executarHarnessAvaliacao({
      versaoSuite: "suite-sintetica@1.0.0",
      versaoControlesPositivos: "ctrl@1.0.0",
      finalidadeExecucao: "AVALIACAO",
      tipoSujeito: "STUB",
      hashTestCongeladoEsperado: hashCongelado,
      casos: casosBase,
    });
    expect(relStub.statusGlobal).toBe("APROVADO");
    expect(relStub.relatorioValidoParaExtrator).toBe(false);
    expect(relStub.rotuloEscopoSujeito).toBe("TESTE_DO_HARNESS_POR_STUB");

    const relExtrator = executarHarnessAvaliacao({
      versaoSuite: "suite-sintetica@1.0.0",
      versaoControlesPositivos: "ctrl@1.0.0",
      finalidadeExecucao: "AVALIACAO",
      tipoSujeito: "EXTRATOR",
      hashTestCongeladoEsperado: hashCongelado,
      casos: casosBase,
    });
    expect(relExtrator.statusGlobal).toBe("FALHA_FECHADA");
    expect(relExtrator.relatorioValidoParaExtrator).toBe(false);
    expect(relExtrator.rotuloEscopoSujeito).toBe("INVALIDO_BLOQUEADO");
    expect(relExtrator.violacoesFatais).toContainEqual(expect.objectContaining({
      codigo: "EXTRATOR_NAO_VERIFICADO",
    }));
    const metricaCp = relExtrator.metricasPorClasse.find((m) => m.classeErro === "CONTROLE_POSITIVO_SILENCIOSO")!;
    expect(metricaCp.numeradorErros).toBe(0);
    expect(metricaCp.denominadorTotal).toBe(2);
    expect(metricaCp.taxaErro).toBe(0);
    expect(metricaCp.incertezaIc95.metodo).toBe("WILSON_95");
    expect(metricaCp.incertezaIc95.superior).toBeGreaterThan(0);
  });

  it("falha fechada em stub reportado como extrator, uso de test_congelado para calibração, controle positivo silencioso, vazamento entre pacientes e número crítico pré-validado", () => {
    // 1. Stub tentado como avaliação de extrator
    const stubIlegal = executarHarnessAvaliacao({
      versaoSuite: "suite-sintetica@1.0.0",
      versaoControlesPositivos: "ctrl@1.0.0",
      finalidadeExecucao: "AVALIACAO",
      tipoSujeito: "STUB",
      declararComoAvaliacaoExtrator: true,
      casos: casosBase,
    });
    expect(stubIlegal.statusGlobal).toBe("FALHA_FECHADA");
    expect(stubIlegal.violacoesFatais.map((v) => v.codigo)).toContain("STUB_REPORTADO_COMO_AVALIACAO_EXTRATOR");

    // 2. Uso de test_congelado para CALIBRACAO
    const calibracaoIlegal = executarHarnessAvaliacao({
      versaoSuite: "suite-sintetica@1.0.0",
      versaoControlesPositivos: "ctrl@1.0.0",
      finalidadeExecucao: "CALIBRACAO",
      tipoSujeito: "EXTRATOR",
      casos: casosBase,
    });
    expect(calibracaoIlegal.statusGlobal).toBe("FALHA_FECHADA");
    expect(calibracaoIlegal.violacoesFatais.map((v) => v.codigo)).toContain("TEST_CONGELADO_USADO_PARA_CALIBRACAO");

    // 3. Controle positivo silencioso + vazamento entre pacientes + número crítico pré-validado
    const falhasCriticas = executarHarnessAvaliacao({
      versaoSuite: "suite-sintetica@1.0.0",
      versaoControlesPositivos: "ctrl@1.0.0",
      finalidadeExecucao: "AVALIACAO",
      tipoSujeito: "EXTRATOR",
      casos: [{
        casoId: "caso-falha-tripla",
        versaoControle: "ctrl@1.0.0",
        sinteticoDeclarado: true,
        split: "dev",
        patientIdEsperado: PACIENTE,
        controlePositivo: {
          controleId: "cp-emergencia-rads",
          classeAlvo: "CONTROLE_POSITIVO_SILENCIOSO",
          alertaEsperado: "ALERTA_COMPRESSAO_MEDULAR",
        },
        saidaObservada: {
          alertasEmitidos: [], // silencioso!
          conflitosManifestados: [],
          omissoesCriticasManifestadas: [],
          itensExtraidos: [{
            campo: "dose_doxorrubicina",
            valor: 60,
            patientIdAtribuido: "Outro Paciente Sintetico", // vazamento entre pacientes!
            qualificador: "AFIRMADO",
            criticoNumero: true,
            preValidadoSemConfirmacao: true, // pré-validado sem confirmação!
            citacaoSustentada: true,
          }],
        },
      }],
    });
    expect(falhasCriticas.statusGlobal).toBe("FALHA_FECHADA");
    expect(falhasCriticas.relatorioValidoParaExtrator).toBe(false);
    const codigos = falhasCriticas.violacoesFatais.map((v) => v.codigo);
    expect(codigos).toContain("CONTROLE_POSITIVO_SILENCIOSO");
    expect(codigos).toContain("VAZAMENTO_ENTRE_PACIENTES");
    expect(codigos).toContain("VALOR_NUMERICO_CRITICO_PRE_VALIDADO");
  });
});
