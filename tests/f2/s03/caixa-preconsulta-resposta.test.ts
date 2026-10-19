import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { FRASE_FINAL_D_W9_75 } from "../../../src/contracts/f2/caixaRespostaCanal.js";
import { abrirLedger } from "../../../src/kernel/ledger/db.js";
import type { CadastroVinculo } from "../../../src/modules/canal/vinculo.js";
import { autorizarSaida } from "../../../src/server/autorizacao.js";
import {
  receberTransporteSintetico,
  registrarConsentimentoCanal,
  revogarConsentimentoCanal,
} from "../../../src/server/canalEntrada.js";
import {
  confirmarRespostaCanalPeloMedico,
  consultarStatusMidiaCanal,
  executarEnvioAutorizadoCanal,
  integrarCanalNaPreConsultaECabecalho,
  invalidarRespostasPorMudancaContextoCanal,
  prepararRascunhoRespostaCanal,
  registrarLeituraLocalMidiaCanal,
} from "../../../src/server/canalResposta.js";
import { criarGerenciadorSessao } from "../../../src/server/sessao.js";

const AGORA = "2026-10-16T10:00:00.000Z";
const SENHA = "senha-sintetica-12";

const CADASTROS: readonly CadastroVinculo[] = [
  {
    patientId: "paciente-s03-1",
    identificadores: [{ tipo: "TELEFONE", valor: ("+55" + "00000003333") }],
    chaveDemografica: null,
    nome: "Paciente Sintetico S03",
  },
];

const pastas: string[] = [];
const abertos: DatabaseSync[] = [];

function textoConteudo(texto: string) {
  return {
    tipo: "TEXT" as const,
    texto,
    contentSha256: createHash("sha256").update(texto).digest("hex"),
  };
}

function ledger(): { db: DatabaseSync; caminho: string } {
  const pasta = mkdtempSync(join(tmpdir(), "canal-s03-"));
  pastas.push(pasta);
  const caminho = join(pasta, "ledger.sqlite");
  const db = abrirLedger(caminho);
  abertos.push(db);
  return { db, caminho };
}

function sessao(agora = AGORA) {
  const sessoes = criarGerenciadorSessao({
    medicoId: "medico-s03",
    crm: "CRM-PB-SINTETICO",
    senha: SENHA,
    duracaoMs: 300_000,
    agora: () => agora,
  });
  const login = sessoes.login(SENHA);
  if (!login) throw new Error("LOGIN_FALHOU");
  return { sessoes, token: login.token, agora };
}

afterEach(() => {
  for (const db of abertos.splice(0)) {
    try { db.close(); } catch { /* ja fechado */ }
  }
  for (const pasta of pastas.splice(0)) {
    rmSync(pasta, { recursive: true, force: true });
  }
});

describe("S-F2-03 · Caixa clínica, pré-consulta, mídia não processada e resposta autorizada", () => {
  it("1 · contato conhecido chega à pré-consulta < 60s com mensagens originais, preserva histórico anterior, recalcula só mudanças e mantém desconhecido na fila", () => {
    const { db } = ledger();

    // Mensagem histórica anterior à última consulta confirmada (2026-10-10)
    const msgAntiga = receberTransporteSintetico(db, {
      accountId: "wa-s03",
      canal: "WHATSAPP_SERVICO",
      providerMessageId: "msg-hist-1",
      senderRef: ("+55" + "00000003333"),
      providerSentAt: "2026-10-05T09:00:00.000Z",
      ingestedAt: "2026-10-05T09:00:01.000Z",
      conteudo: textoConteudo("Mensagem do ciclo passado preservada no histórico."),
      cadastros: CADASTROS,
    });
    // Mensagem nova desde a última consulta (2026-10-15)
    const msgNova = receberTransporteSintetico(db, {
      accountId: "wa-s03",
      canal: "WHATSAPP_SERVICO",
      providerMessageId: "msg-nova-1",
      senderRef: ("+55" + "00000003333"),
      providerSentAt: "2026-10-15T18:00:00.000Z",
      ingestedAt: "2026-10-15T18:00:01.000Z",
      conteudo: textoConteudo("Relato novo após a última consulta: tive náusea leve."),
      cadastros: CADASTROS,
    });
    // Contato desconhecido -> deve ficar na fila de revisão
    const msgDesconhecido = receberTransporteSintetico(db, {
      accountId: "wa-s03",
      canal: "WHATSAPP_SERVICO",
      providerMessageId: "msg-desc-1",
      senderRef: ("+55" + "00000000000"),
      providerSentAt: "2026-10-15T19:00:00.000Z",
      ingestedAt: "2026-10-15T19:00:01.000Z",
      conteudo: textoConteudo("Mensagem de número desconhecido."),
      cadastros: CADASTROS,
    });
    expect(msgAntiga.ok && msgNova.ok && msgDesconhecido.ok).toBe(true);

    const entradaPreConsulta = {
      atual: {
        kind: "CONFIRMED" as const,
        snapshotId: "snap-atual",
        patientId: "paciente-s03-1",
        tumorLotId: "lot-1",
        encounterId: "enc-atual",
        fatos: [],
        pendencias: [],
        tratamento: null,
        cumulativos: [],
        contatos: [],
        apac: null,
        decisoes: [],
      },
      anterior: null,
      hoje: "2026-10-16",
      prazosApac: null,
      direcoes: null,
    };

    const primeiraIntegracao = integrarCanalNaPreConsultaECabecalho(db, {
      entradaPreConsulta,
      ultimaConsultaConfirmadaEm: "2026-10-10T12:00:00.000Z",
    });

    // Chega em menos de 60 segundos (< 60.000 ms)
    expect(primeiraIntegracao.latenciaMs).toBeLessThan(60_000);
    expect(primeiraIntegracao.resumosDoPaciente).toHaveLength(1);
    expect(primeiraIntegracao.filaRevisao).toHaveLength(1);
    expect(primeiraIntegracao.filaRevisao[0]!.contatoId).toBe(("+55" + "00000000000"));

    const resumoPaciente = primeiraIntegracao.resumosDoPaciente[0]!;
    expect(resumoPaciente.quantidadeTotalMensagens).toBe(2); // histórico não foi apagado
    expect(resumoPaciente.quantidadeNovasDesdeUltimaConsulta).toBe(1); // só 1 desde a última consulta
    expect(resumoPaciente.mensagensOriginais).toHaveLength(2);
    expect(primeiraIntegracao.preConsulta.contatosCanal.estado).toBe("VERDE");
    expect(primeiraIntegracao.preConsulta.contatosCanal.itens).toHaveLength(1);

    // Segunda chamada sem mudança reutiliza o cache sem recalcular
    const cache = new Map(
      [...primeiraIntegracao.resumosDoPaciente, ...primeiraIntegracao.filaRevisao].map((r) => [`${r.canal}:${r.contatoId}`, r]),
    );
    const segundaIntegracao = integrarCanalNaPreConsultaECabecalho(db, {
      entradaPreConsulta,
      ultimaConsultaConfirmadaEm: "2026-10-10T12:00:00.000Z",
      cacheAnterior: cache,
    });
    expect(segundaIntegracao.recalculados).toBe(0);
    expect(segundaIntegracao.reutilizadosDoCache).toBe(2);
  });

  it("2 · mídia recebida permanece NAO_PROCESSADA até leitura local comprovada com bytes e SHA-256", () => {
    const { db } = ledger();
    const acesso = sessao();
    const bytesFoto = new TextEncoder().encode("bytes-locais-sinteticos-da-imagem");

    const ackMidia = receberTransporteSintetico(db, {
      accountId: "wa-s03",
      canal: "WHATSAPP_SERVICO",
      providerMessageId: "msg-midia-s03",
      senderRef: ("+55" + "00000003333"),
      providerSentAt: AGORA,
      ingestedAt: AGORA,
      conteudo: {
        tipo: "MEDIA_UNPROCESSED",
        processamento: "NAO_PROCESSADA",
        providerMediaId: "media-s03-1",
        mimeType: "image/jpeg",
        sizeBytes: bytesFoto.byteLength,
        contentSha256: null,
      },
      cadastros: CADASTROS,
    });
    expect(ackMidia.ok).toBe(true);
    if (!ackMidia.ok) return;

    expect(consultarStatusMidiaCanal(db, ackMidia.reciboId)).toEqual({
      processamento: "NAO_PROCESSADA",
      sha256LocalComprovado: null,
    });

    // Tamanho divergente falha a comprovação local
    expect(registrarLeituraLocalMidiaCanal(db, acesso, {
      mensagemId: ackMidia.reciboId,
      bytesLocais: new Uint8Array(5),
      mimeTypeVerificado: "image/jpeg",
    })).toEqual({ ok: false, codigo: "MIDIA_BYTES_INVALIDOS" });

    // Leitura local comprovada atualiza para LIDA_LOCALMENTE com hash SHA-256
    const lida = registrarLeituraLocalMidiaCanal(db, acesso, {
      mensagemId: ackMidia.reciboId,
      bytesLocais: bytesFoto,
      mimeTypeVerificado: "image/jpeg",
    });
    expect(lida).toEqual({
      ok: true,
      mensagemId: ackMidia.reciboId,
      processamento: "LIDA_LOCALMENTE",
      sha256LocalComprovado: createHash("sha256").update(bytesFoto).digest("hex"),
    });
    expect(consultarStatusMidiaCanal(db, ackMidia.reciboId).processamento).toBe("LIDA_LOCALMENTE");
  });

  it("3 · orientação geral por cenário segue D-W9-75 (exige curadoria médica, proíbe dose/posologia/início/diagnóstico e exige frase final)", () => {
    const { db } = ledger();
    const acesso = sessao();
    const ack = receberTransporteSintetico(db, {
      accountId: "wa-s03",
      canal: "WHATSAPP_SERVICO",
      providerMessageId: "msg-d-w9-75",
      senderRef: ("+55" + "00000003333"),
      providerSentAt: AGORA,
      ingestedAt: AGORA,
      conteudo: textoConteudo("Estou com diarreia desde cedo."),
      cadastros: CADASTROS,
    });
    expect(ack.ok).toBe(true);
    if (!ack.ok) return;

    const contexto = {
      patientId: "paciente-s03-1",
      encounterId: "enc-s03-1",
      tumorLotId: "lot-s03-1",
      revisaoContexto: "rev-ctx-1",
    };

    // Cenário em RASCUNHO é recusado
    expect(prepararRascunhoRespostaCanal(db, acesso, {
      respostaId: "resp-rascunho",
      versao: 1,
      mensagemOrigemId: ack.reciboId,
      contexto,
      tipoResposta: "ORIENTACAO_GERAL_CENARIO",
      cenarioId: "redflag-10-diarreia",
      statusCuradoriaCenario: "RASCUNHO",
      texto: `Hidratação e dieta antidiarreica. ${FRASE_FINAL_D_W9_75}`,
    })).toEqual({ ok: false, codigo: "CENARIO_NAO_CURADO_PELO_MEDICO" });

    // Dose de medicamento ("4 mg", "2 cápsulas", "Seu diagnóstico é...", "Inicie o medicamento") é proibida mesmo com status CONFERIDA_MEDICO
    expect(prepararRascunhoRespostaCanal(db, acesso, {
      respostaId: "resp-dose",
      versao: 1,
      mensagemOrigemId: ack.reciboId,
      contexto,
      tipoResposta: "ORIENTACAO_GERAL_CENARIO",
      cenarioId: "redflag-10-diarreia",
      statusCuradoriaCenario: "CONFERIDA_MEDICO",
      texto: `Tome loperamida 4 mg agora. ${FRASE_FINAL_D_W9_75}`,
    })).toEqual({ ok: false, codigo: "DOSE_NUMERICA_PROIBIDA" });

    expect(prepararRascunhoRespostaCanal(db, acesso, {
      respostaId: "resp-capsulas",
      versao: 1,
      mensagemOrigemId: ack.reciboId,
      contexto,
      tipoResposta: "ORIENTACAO_GERAL_CENARIO",
      cenarioId: "redflag-10-diarreia",
      statusCuradoriaCenario: "CONFERIDA_MEDICO",
      texto: `Usar 2 cápsulas após evacuação. ${FRASE_FINAL_D_W9_75}`,
    })).toEqual({ ok: false, codigo: "DOSE_NUMERICA_PROIBIDA" });

    expect(prepararRascunhoRespostaCanal(db, acesso, {
      respostaId: "resp-inicio-med",
      versao: 1,
      mensagemOrigemId: ack.reciboId,
      contexto,
      tipoResposta: "ORIENTACAO_GERAL_CENARIO",
      cenarioId: "redflag-10-diarreia",
      statusCuradoriaCenario: "CONFERIDA_MEDICO",
      texto: `Inicie o medicamento imediatamente. ${FRASE_FINAL_D_W9_75}`,
    })).toEqual({ ok: false, codigo: "INICIO_MEDICAMENTO_PROIBIDO" });

    expect(prepararRascunhoRespostaCanal(db, acesso, {
      respostaId: "resp-diagnostico",
      versao: 1,
      mensagemOrigemId: ack.reciboId,
      contexto,
      tipoResposta: "ORIENTACAO_GERAL_CENARIO",
      cenarioId: "redflag-10-diarreia",
      statusCuradoriaCenario: "CONFERIDA_MEDICO",
      texto: `Seu diagnóstico é progressão tumoral. ${FRASE_FINAL_D_W9_75}`,
    })).toEqual({ ok: false, codigo: "DIAGNOSTICO_DEFINITIVO_PROIBIDO" });

    // Falta da frase final obrigatória é recusada
    expect(prepararRascunhoRespostaCanal(db, acesso, {
      respostaId: "resp-sem-frase",
      versao: 1,
      mensagemOrigemId: ack.reciboId,
      contexto,
      tipoResposta: "ORIENTACAO_GERAL_CENARIO",
      cenarioId: "redflag-10-diarreia",
      statusCuradoriaCenario: "CONFERIDA_MEDICO",
      texto: "Hidratação e dieta antidiarreica. Suspender anti-hipertensivos e diuréticos.",
    })).toEqual({ ok: false, codigo: "FALTA_FRASE_FINAL_D_W9_75" });

    // Orientação geral curada, sem dose/diagnóstico e com frase final é aceita como rascunho para confirmação
    const valido = prepararRascunhoRespostaCanal(db, acesso, {
      respostaId: "resp-cenario-ok",
      versao: 1,
      mensagemOrigemId: ack.reciboId,
      contexto,
      tipoResposta: "ORIENTACAO_GERAL_CENARIO",
      cenarioId: "redflag-10-diarreia",
      statusCuradoriaCenario: "CONFERIDA_MEDICO",
      texto: `Hidratação, dieta antidiarreica, suspender anti-hipertensivos e diuréticos e ir ao PS se houver gravidade. ${FRASE_FINAL_D_W9_75}`,
    });
    expect(valido.ok).toBe(true);
  });

  it("4 · resposta livre exige confirmação médica; revalida consentimento, contexto, destinatário e versão no servidor (inclusive após async e em replay); mantém AGENDAR e saídas não autorizadas bloqueadas", async () => {
    const { db } = ledger();
    const acesso = sessao();
    const ack = receberTransporteSintetico(db, {
      accountId: "wa-s03",
      canal: "WHATSAPP_SERVICO",
      providerMessageId: "msg-resp-1",
      senderRef: ("+55" + "00000003333"),
      providerSentAt: AGORA,
      ingestedAt: AGORA,
      conteudo: textoConteudo("Doutor, posso manter o retorno na quinta-feira?"),
      cadastros: CADASTROS,
    });
    expect(ack.ok).toBe(true);
    if (!ack.ok) return;

    const contexto = {
      patientId: "paciente-s03-1",
      encounterId: "enc-s03-1",
      tumorLotId: "lot-s03-1",
      revisaoContexto: "rev-ctx-1",
    };

    // 1. Saída genérica sem rascunho/aprovação e AGENDAR continuam bloqueadas com CANAL_EXTERNO_NAO_HABILITADO
    expect(autorizarSaida(db, {
      verbo: "ENVIAR_WHATSAPP",
      objeto: { tipo: "MENSAGEM_CANAL", id: "inexistente", versao: 1 },
      escopo: { patientId: "paciente-s03-1", encounterId: "enc-s03-1" },
      destino: ("+55" + "00000003333"),
      idempotencyKey: "key-generica-bloqueada-1",
    })).toEqual({ ok: false, codigo: "CANAL_EXTERNO_NAO_HABILITADO" });

    expect(autorizarSaida(db, {
      verbo: "AGENDAR",
      objeto: { tipo: "AGENDA", id: "ag-1", versao: 1 },
      escopo: { patientId: "paciente-s03-1", encounterId: "enc-s03-1" },
      destino: null,
      idempotencyKey: "key-agendar-bloqueada-1",
    })).toEqual({ ok: false, codigo: "CANAL_EXTERNO_NAO_HABILITADO" });

    // 2. Prepara rascunho de resposta livre exibindo destinatário, conteúdo e contexto
    const preparado = prepararRascunhoRespostaCanal(db, acesso, {
      respostaId: "resp-livre-1",
      versao: 1,
      mensagemOrigemId: ack.reciboId,
      contexto,
      tipoResposta: "RESPOSTA_LIVRE_MEDICA",
      texto: "Retorno confirmado para quinta-feira no ambulatório.",
    });
    expect(preparado.ok).toBe(true);
    if (!preparado.ok) return;

    // 3. Tentar enviar antes da confirmação médica é recusado pelo servidor
    const intentValido = {
      verbo: "ENVIAR_WHATSAPP" as const,
      objeto: { tipo: "MENSAGEM_CANAL", id: "resp-livre-1", versao: 1 },
      escopo: { patientId: "paciente-s03-1", encounterId: "enc-s03-1" },
      destino: ("+55" + "00000003333"),
      idempotencyKey: "key-envio-resp-livre-1",
    };
    expect(autorizarSaida(db, intentValido)).toEqual({
      ok: false,
      codigo: "RESPOSTA_NAO_CONFIRMADA_PELO_MEDICO",
    });

    // 4. Tentar confirmar sem consentimento registrado falha
    expect(confirmarRespostaCanalPeloMedico(db, acesso, {
      respostaId: "resp-livre-1",
      versao: 1,
      comprovanteExibicao: {
        destinatario: preparado.rascunho.destinatario,
        conteudoSha256: preparado.rascunho.conteudoSha256,
        contexto,
      },
    })).toEqual({ ok: false, codigo: "CONSENTIMENTO_REVOGADO_OU_AUSENTE" });

    // 5. Registra consentimento explícito e confirma a resposta pelo médico
    expect(registrarConsentimentoCanal(db, acesso, {
      contatoId: ("+55" + "00000003333"),
      patientId: "paciente-s03-1",
      referenciaTermo: "termo-s03-v1",
      versaoTermo: "1.0.0",
      finalidade: ["COMUNICACAO_CLINICA"],
      origem: "PRESENCIAL_CONSULTORIO",
    }).ok).toBe(true);

    // Conteúdo alterado após exibição é recusado na confirmação
    expect(confirmarRespostaCanalPeloMedico(db, acesso, {
      respostaId: "resp-livre-1",
      versao: 1,
      comprovanteExibicao: {
        destinatario: preparado.rascunho.destinatario,
        conteudoSha256: "f".repeat(64),
        contexto,
      },
    })).toEqual({ ok: false, codigo: "CONTEUDO_ALTERADO_APOS_EXIBICAO" });

    const confirmado = confirmarRespostaCanalPeloMedico(db, acesso, {
      respostaId: "resp-livre-1",
      versao: 1,
      comprovanteExibicao: {
        destinatario: preparado.rascunho.destinatario,
        conteudoSha256: preparado.rascunho.conteudoSha256,
        contexto,
      },
    });
    expect(confirmado.ok).toBe(true);

    // Destinatário divergente é recusado no servidor
    expect(autorizarSaida(db, { ...intentValido, destino: ("+55" + "00000000000") })).toEqual({
      ok: false,
      codigo: "DESTINO_DIVERGENTE_DO_CONTATO",
    });

    // 6. Envio confirmado segue ao destinatário correto pelo gateway com auditoria e sem duplicar no replay
    const enviosRealizados: Array<{ destinatario: string; texto: string }> = [];
    const envio1 = await executarEnvioAutorizadoCanal(db, acesso, {
      intent: intentValido,
      transporteSaida: async (e) => {
        enviosRealizados.push({ destinatario: e.destinatario, texto: e.texto });
        return { ok: true, providerReceiptId: "wamid-out-100" };
      },
    });
    expect(envio1.resultadoGateway).toMatchObject({ decisao: "EXECUTADA", motivoCodigo: "OK" });
    expect(envio1.estadoOperacional).toMatchObject({
      reciboTecnico: "ENVIADA",
      estadoConversa: "RESPONDIDA",
      conversaEncerradaPorAcuso: false,
      atendimentoClinicoComprovadoPorRecibo: false,
      condutaClinicaExecutadaPorEnvio: false,
    });
    expect(enviosRealizados).toEqual([{
      destinatario: ("+55" + "00000003333"),
      texto: "Retorno confirmado para quinta-feira no ambulatório.",
    }]);

    // Replay com a mesma chave não duplica o envio externo
    const replayEnvio = await executarEnvioAutorizadoCanal(db, acesso, {
      intent: intentValido,
      transporteSaida: async (e) => {
        enviosRealizados.push({ destinatario: e.destinatario, texto: e.texto });
        return { ok: true, providerReceiptId: "wamid-out-101" };
      },
    });
    expect(replayEnvio.resultadoGateway.decisao).toBe("REPLAY");
    expect(enviosRealizados).toHaveLength(1);

    // 7. Revogação do consentimento durante operação assíncrona ou antes do replay bloqueia o envio no servidor
    const prep2 = prepararRascunhoRespostaCanal(db, acesso, {
      respostaId: "resp-livre-2",
      versao: 1,
      mensagemOrigemId: ack.reciboId,
      contexto,
      tipoResposta: "RESPOSTA_LIVRE_MEDICA",
      texto: "Segunda mensagem que será bloqueada por revogação assíncrona.",
    });
    expect(prep2.ok).toBe(true);
    if (!prep2.ok) return;
    expect(confirmarRespostaCanalPeloMedico(db, acesso, {
      respostaId: "resp-livre-2",
      versao: 1,
      comprovanteExibicao: {
        destinatario: prep2.rascunho.destinatario,
        conteudoSha256: prep2.rascunho.conteudoSha256,
        contexto,
      },
    }).ok).toBe(true);

    const envioRevogadoAsync = await executarEnvioAutorizadoCanal(db, acesso, {
      intent: {
        verbo: "ENVIAR_WHATSAPP",
        objeto: { tipo: "MENSAGEM_CANAL", id: "resp-livre-2", versao: 1 },
        escopo: { patientId: "paciente-s03-1", encounterId: "enc-s03-1" },
        destino: ("+55" + "00000003333"),
        idempotencyKey: "key-envio-resp-livre-2",
      },
      antesDoEnvioAssincrono: () => {
        revogarConsentimentoCanal(db, acesso, {
          contatoId: ("+55" + "00000003333"),
          patientId: "paciente-s03-1",
          origem: "REVOGACAO_PACIENTE",
        });
      },
      transporteSaida: async () => ({ ok: true, providerReceiptId: "nao-deve-ocorrer" }),
    });
    expect(envioRevogadoAsync.resultadoGateway).toEqual({
      decisao: "NEGADA",
      motivoCodigo: "CONSENTIMENTO_AUSENTE",
    });

    // 8. Mudança de contexto invalida rascunhos abertos e aprovações anteriores incompatíveis (e impede ressurreição)
    const prep3 = prepararRascunhoRespostaCanal(db, acesso, {
      respostaId: "resp-livre-3",
      versao: 1,
      mensagemOrigemId: ack.reciboId,
      contexto,
      tipoResposta: "ACUSO_RECEBIMENTO_TECNICO",
      texto: "Recebemos sua mensagem técnica; aguarde avaliação médica.",
    });
    expect(prep3.ok).toBe(true);
    if (!prep3.ok) return;

    invalidarRespostasPorMudancaContextoCanal(db, "paciente-s03-1", "enc-s03-1");
    expect(autorizarSaida(db, intentValido)).toEqual({
      ok: false,
      codigo: "CONTEXTO_RESPOSTA_INVALIDADO",
    });

    // Tentar confirmar um rascunho preparado antes da invalidação de contexto (ou ressuscitar resp-livre-1) é recusado
    expect(confirmarRespostaCanalPeloMedico(db, acesso, {
      respostaId: "resp-livre-3",
      versao: 1,
      comprovanteExibicao: {
        destinatario: prep3.rascunho.destinatario,
        conteudoSha256: prep3.rascunho.conteudoSha256,
        contexto,
      },
    })).toEqual({ ok: false, codigo: "CONTEXTO_ALTERADO_APOS_EXIBICAO" });

    expect(confirmarRespostaCanalPeloMedico(db, acesso, {
      respostaId: "resp-livre-1",
      versao: 1,
      comprovanteExibicao: {
        destinatario: preparado.rascunho.destinatario,
        conteudoSha256: preparado.rascunho.conteudoSha256,
        contexto,
      },
    })).toEqual({ ok: false, codigo: "CONTEXTO_ALTERADO_APOS_EXIBICAO" });
  });
});
