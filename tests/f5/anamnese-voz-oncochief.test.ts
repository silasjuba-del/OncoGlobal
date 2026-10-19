import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import type { RoteiroAnamneseTumor } from "../../src/contracts/f5/anamneseEOncoChief.js";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import {
  autorizarTeleconsultaComAtoMedicoF5,
  obterPerguntaPassoRoteiro,
  verificarPedidoTerapeuticoNaAnamnese,
} from "../../src/modules/canal/anamneseGuiada.js";
import { registrarConsentimentoCanal } from "../../src/server/canalEntrada.js";
import {
  executarRevisaoCruzadaOncoChiefF5,
  lerResumoAnamneseGuiadaF5,
  processarVozAnamneseComExpurgoAudioF5,
  registrarResumoAnamneseGuiadaF5,
} from "../../src/server/f5AnamneseOncoChief.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";
import { fonteSintetica } from "../fixtures/triagem.js";

const AGORA = "2026-10-18T14:00:00.000Z";
const SENHA = "senha-sintetica-f5-anamnese";
const CONTATO_ID = "+55" + "00000005555";

const ROTEIRO_MAMA_APROVADO: RoteiroAnamneseTumor = {
  roteiroId: "roteiro-mama-pre-ciclo-v1",
  versao: "1.0.0",
  tumorPackId: "pack-mama-v1",
  contextoClinico: "PRE_CICLO_QT",
  statusCuradoria: "CONFERIDA_MEDICO",
  aprovadoPor: "Dr. Silas Negrão",
  aprovadoEm: "2026-10-18",
  fonte: "DECISAO_DR_SILAS_2026-10-18",
  passos: [
    {
      passoId: "passo-1-febre",
      ordem: 1,
      tipo: "PERGUNTA_SINTOMA",
      dominioClinico: "temperatura_febre",
      perguntaCanonica: "Você apresentou febre acima de 37,8 °C desde o último ciclo?",
      obrigatorioParaResumo: true,
    },
    {
      passoId: "passo-2-nausea",
      ordem: 2,
      tipo: "PERGUNTA_SINTOMA",
      dominioClinico: "toxicidade_ gastrointestinal",
      perguntaCanonica: "Teve náuseas, vômitos ou diarreia nos últimos dias?",
      obrigatorioParaResumo: true,
    },
    {
      passoId: "passo-3-hemograma",
      ordem: 3,
      tipo: "SOLICITACAO_DOCUMENTO_EXAME",
      dominioClinico: "exame_laboratorial_pre_ciclo",
      perguntaCanonica: "Por favor, envie o resultado do hemograma colhido nos últimos 7 dias.",
      obrigatorioParaResumo: true,
    },
    {
      passoId: "passo-4-lembrete",
      ordem: 4,
      tipo: "LEMBRETE_RETORNO_PREPARO",
      dominioClinico: "preparo_retorno",
      perguntaCanonica: "Lembre-se de trazer seus exames e a lista de medicamentos de uso contínuo na consulta.",
      obrigatorioParaResumo: false,
    },
  ],
  lembretesOrientacoes: [
    {
      orientacaoId: "ori-hidratacao-1",
      titulo: "Hidratação pré-consulta",
      textoAprovado: "Manter hidratação oral habitual conforme orientação recebida no consultório.",
      statusCuradoria: "CONFERIDA_MEDICO",
      fonte: "D-W5-05",
    },
    {
      orientacaoId: "ori-rascunho-nao-entregar",
      titulo: "Orientação ainda em rascunho",
      textoAprovado: "Texto não curado.",
      statusCuradoria: "RASCUNHO",
      fonte: "RASCUNHO",
    },
  ],
};

const pastas: string[] = [];
const abertos: DatabaseSync[] = [];

function ledger(): { db: DatabaseSync; caminho: string } {
  const pasta = mkdtempSync(join(tmpdir(), "anamnese-f5-"));
  pastas.push(pasta);
  const caminho = join(pasta, "ledger.sqlite");
  const db = abrirLedger(caminho);
  abertos.push(db);
  return { db, caminho };
}

function reabrir(caminho: string): DatabaseSync {
  const db = abrirLedger(caminho);
  abertos.push(db);
  return db;
}

function sessao(agora = AGORA) {
  const sessoes = criarGerenciadorSessao({
    medicoId: "medico-f5",
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

describe("FASE F5 · Anamnese Guiada (AG-19), Voz no Canal e Revisão Cruzada OncoChief (ORK-2)", () => {
  it("1 · roteiro aprovado gera resumo estruturado com fontes, lacunas, incertezas e negações; recusa roteiro em RASCUNHO e nunca declara avaliação médica concluída", () => {
    const { db, caminho } = ledger();
    const acesso = sessao();

    // Registra consentimento explícito do contato
    expect(
      registrarConsentimentoCanal(db, acesso, {
        contatoId: CONTATO_ID,
        patientId: "pt-f5-1",
        referenciaTermo: "termo-anamnese-v1",
        versaoTermo: "1.0.0",
        finalidade: ["COMUNICACAO_CLINICA", "ORIENTACAO_GERAL"],
        origem: "PRESENCIAL_CONSULTORIO",
      }).ok,
    ).toBe(true);

    // Roteiro em RASCUNHO é recusado
    expect(
      registrarResumoAnamneseGuiadaF5(db, acesso, {
        sessaoAnamneseId: "anamnese-rascunho",
        patientId: "pt-f5-1",
        contatoId: CONTATO_ID,
        roteiroCandidato: { ...ROTEIRO_MAMA_APROVADO, statusCuradoria: "RASCUNHO" },
        respostas: [],
      }),
    ).toEqual({ ok: false, codigo: "ROTEIRO_EM_RASCUNHO_NAO_AUTORIZADO" });

    // Respostas parciais (passo 1 negado, passo 2 incerto, passo 3 sem documento anexado) -> preserva negação, incerteza e lacuna documental
    const salvo = registrarResumoAnamneseGuiadaF5(db, acesso, {
      sessaoAnamneseId: "anamnese-mama-1",
      patientId: "pt-f5-1",
      contatoId: CONTATO_ID,
      roteiroCandidato: ROTEIRO_MAMA_APROVADO,
      respostas: [
        {
          passoId: "passo-1-febre",
          mensagemIdOrigem: "msg-f5-1",
          respostaLiteral: "Não tive febre nenhuma vez.",
          polaridade: "NEGADO",
          documentoOuFotoRef: null,
          fonte: fonteSintetica("fonte-msg-f5-1"),
          respondidoEm: AGORA,
        },
        {
          passoId: "passo-2-nausea",
          mensagemIdOrigem: "msg-f5-2",
          respostaLiteral: "Não tenho certeza se o enjoo de ontem foi da comida.",
          polaridade: "INCERTO_DUVIDA",
          documentoOuFotoRef: null,
          fonte: fonteSintetica("fonte-msg-f5-2"),
          respondidoEm: AGORA,
        },
      ],
    });

    expect(salvo.ok).toBe(true);
    if (!salvo.ok) return;
    expect(salvo.resumo.avaliacaoMedicaConcluida).toBe(false);
    expect(salvo.resumo.defineDiagnostico).toBe(false);
    expect(salvo.resumo.defineDoseOuPrescricao).toBe(false);
    expect(salvo.resumo.revisao).toBe("REVISAR");
    expect(salvo.resumo.negacoesPreservadas).toHaveLength(1);
    expect(salvo.resumo.incertezasExplicitas).toHaveLength(1);
    expect(salvo.resumo.documentosSolicitadosPendentes).toEqual(["passo-3-hemograma"]);
    expect(salvo.resumo.lacunasExplicitas.some((l) => l.includes("passo-3-hemograma"))).toBe(true);
    // Só entrega lembretes/orientações CONFERIDA_MEDICO
    expect(salvo.resumo.orientacoesFixasEntreguesIds).toEqual(["ori-hidratacao-1"]);

    // Recuperação após reiniciar SQLite
    db.close();
    const dbReaberto = reabrir(caminho);
    expect(lerResumoAnamneseGuiadaF5(dbReaberto, "anamnese-mama-1")).toEqual(salvo.resumo);
  });

  it("2 · guarda adversarial A13: LLM só reformula perguntas sem prescrever; paciente pedindo dose recebe resposta fixa de segurança e teleconsulta com ato médico permanece bloqueada até CFM/LGPD", () => {
    const passo = ROTEIRO_MAMA_APROVADO.passos[0]!;

    // Reformulação limpa pela LLM é aceita
    const limpa = obterPerguntaPassoRoteiro(passo, "Você chegou a medir temperatura acima de 37,8 °C neste ciclo?");
    expect(limpa.usouReformulacaoLlm).toBe(true);

    // Se a LLM tentar infiltrar dose ou prescrição na pergunta, o código descarta e usa a perguntaCanonica aprovada
    const maliciosa = obterPerguntaPassoRoteiro(passo, "Você teve febre? Tome dipirona 500 mg agora.");
    expect(maliciosa.usouReformulacaoLlm).toBe(false);
    expect(maliciosa.textoPergunta).toBe(passo.perguntaCanonica);

    // A13: paciente pede dose pelo WhatsApp -> resposta fixa + escalonamento ao médico, zero orientação terapêutica
    const pedidoDose = verificarPedidoTerapeuticoNaAnamnese("Doutor, qual a dose de ondansetrona e quantos comprimidos posso tomar?");
    expect(pedidoDose.pediuCondutaOuDose).toBe(true);
    expect(pedidoDose.escalonarAoMedico).toBe(true);
    expect(pedidoDose.respostaFixaSeguranca).toContain("não indica doses, medicamentos ou diagnósticos");
    expect(pedidoDose.respostaFixaSeguranca).toContain("Nada substitui a avaliação presencial do seu médico.");

    // Teleconsulta assíncrona com ato médico exige enquadramento CFM/LGPD + termo + médico na sessão
    expect(
      autorizarTeleconsultaComAtoMedicoF5({
        enquadramentoCfmLgpdAprovado: false,
        termoConsentimentoTelemedicinaRef: "termo-1",
        medicoComCrmNaSessao: true,
      }),
    ).toEqual({ ok: false, codigo: "TELECONSULTA_ATO_MEDICO_NAO_HABILITADO_CFM_LGPD" });
  });

  it("3 · integração de voz exige consentimento, aplica G-23 em comando curto Deepgram e apaga o áudio bruto após transcrição validada (guardando texto + hash)", () => {
    const { db } = ledger();
    const acesso = sessao();

    // Sem consentimento registrado -> bloqueia processamento de voz
    const bufferSemConsent = new Uint8Array([10, 20, 30, 40]);
    expect(
      processarVozAnamneseComExpurgoAudioF5(db, acesso, {
        sessaoAnamneseId: "anamnese-mama-1",
        patientId: "pt-f5-1",
        contatoId: CONTATO_ID,
        tecnologia: "DEEPGRAM_COMANDO_CURTO",
        duracaoSegundos: 5,
        audioBufferTemporario: bufferSemConsent,
        transcricaoValidadaPeloMedico: "Relato curto validado.",
      }),
    ).toEqual({ ok: false, codigo: "CONSENTIMENTO_VOZ_AUSENTE_OU_REVOGADO" });

    registrarConsentimentoCanal(db, acesso, {
      contatoId: CONTATO_ID,
      patientId: "pt-f5-1",
      referenciaTermo: "termo-voz-f5",
      versaoTermo: "1.0.0",
      finalidade: ["COMUNICACAO_CLINICA"],
      origem: "PRESENCIAL_CONSULTORIO",
    });

    // Áudio de 40s em DEEPGRAM_COMANDO_CURTO (limite 15s) é bloqueado pelo gate G-23 (N21)
    expect(
      processarVozAnamneseComExpurgoAudioF5(db, acesso, {
        sessaoAnamneseId: "anamnese-mama-1",
        patientId: "pt-f5-1",
        contatoId: CONTATO_ID,
        tecnologia: "DEEPGRAM_COMANDO_CURTO",
        duracaoSegundos: 40,
        limiteComandoCurtoSegundos: 15,
        audioBufferTemporario: new Uint8Array([1, 2, 3]),
        transcricaoValidadaPeloMedico: "Áudio longo demais para comando curto.",
      }),
    ).toEqual({ ok: false, codigo: "G23_AUDIO_LONGO_BLOQUEADO_PARA_DEEPGRAM" });

    // Comando curto de 4s validado -> grava texto + SHA-256 e zera (apaga) os bytes do áudio bruto (Q16 / A5)
    const audioBytes = new Uint8Array([65, 66, 67, 68, 69]);
    const okVoz = processarVozAnamneseComExpurgoAudioF5(db, acesso, {
      sessaoAnamneseId: "anamnese-mama-1",
      patientId: "pt-f5-1",
      contatoId: CONTATO_ID,
      tecnologia: "DEEPGRAM_COMANDO_CURTO",
      duracaoSegundos: 4,
      limiteComandoCurtoSegundos: 15,
      audioBufferTemporario: audioBytes,
      transcricaoValidadaPeloMedico: "Sem febre e sem dor torácica hoje.",
    });
    expect(okVoz.ok).toBe(true);
    if (!okVoz.ok) return;
    expect(okVoz.registroVoz.audioBrutoApagado).toBe(true);
    expect([...audioBytes]).toEqual([0, 0, 0, 0, 0]);
  });

  it("4 · revisão cruzada OncoChief (ORK-2) opera sob demanda sobre criarOncoboard sem serviço/memória paralela e respeita assimetria A9 (código prevalece sobre LLM)", async () => {
    const dic = { nomes: ["Paciente Sintetico F5"], identificadores: ["PRONT-F5-01"] };
    const fontes = [
      {
        id: "laudo-path-f5",
        versao: "1",
        conteudo: "Paciente Sintetico F5: adenocarcinoma de cólon pT3N1M0 ressecado com margens livres.",
        dicionario: dic,
      },
    ];

    const adapterSimulado = {
      gerar: async (prompt: string) => {
        expect(prompt).not.toContain("Paciente Sintetico F5");
        return {
          resposta: "Síntese documental revisada para discussão multidisciplinar.",
          perguntas: ["Conferir status de MMR/MSI no bloco cirúrgico."],
          lacunas: ["Status de MMR/MSI não consta no trecho fornecido."],
          divergencias: [],
          citacoes: [
            {
              fonteId: "SOURCE_1",
              versao: "VERSION_1",
              trecho: "adenocarcinoma de cólon pT3N1M0 ressecado com margens livres.",
            },
          ],
        };
      },
    };

    // Caso 1: sem reprovação determinística do código -> APROVADO_PARA_REVISAO_MEDICA
    const revOk = await executarRevisaoCruzadaOncoChiefF5({
      patientRef: "pt-f5-1",
      pergunta: "Quais dados faltam para a discussão adjuvante?",
      personas: ["oncologista_clinico", "cirurgiao_oncologico"],
      fontes,
      adapter: adapterSimulado,
      agora: AGORA,
    });
    expect(revOk.vereditoFinalCodigoPrevalece).toBe("APROVADO_PARA_REVISAO_MEDICA");
    expect(revOk.memoriaParalelaCriada).toBe(false);
    expect(revOk.servicoParaleloCriado).toBe(false);
    expect(revOk.pareceresPorPersona).toHaveLength(2);

    // Caso 2 (Assimetria A9): código reprovou gate determinístico -> mesmo com LLM aprovando, veredito final é BLOQUEADO_POR_CODIGO
    const revBloqueadaA9 = await executarRevisaoCruzadaOncoChiefF5({
      patientRef: "pt-f5-1",
      pergunta: "Avaliar estadiamento.",
      personas: ["oncologista_clinico"],
      fontes,
      reprovacoesDeterministicasCodigo: ["G-09: pTNM sem peça de ressecção comprovada"],
      adapter: adapterSimulado,
      agora: AGORA,
    });
    expect(revBloqueadaA9.vereditoFinalCodigoPrevalece).toBe("BLOQUEADO_POR_CODIGO");
  });
});
