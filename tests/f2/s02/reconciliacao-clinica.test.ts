import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { abrirLedger } from "../../../src/kernel/ledger/db.js";
import type { CadastroVinculo } from "../../../src/modules/canal/vinculo.js";
import type { RulesetAlarmeCanalEntrada } from "../../../src/modules/canal/reconciliacaoClinica.js";
import { enviarParaForaCanal, receberTransporteSintetico } from "../../../src/server/canalEntrada.js";
import { reconciliarMensagemCanalPersistida } from "../../../src/server/canalReconciliacao.js";
import { criarGerenciadorSessao } from "../../../src/server/sessao.js";

const AGORA = "2026-10-15T14:00:00.000Z";
const ENVIADO = "2026-10-15T13:50:00.000Z";
const SENHA = "senha-sintetica-12";

const CADASTROS: readonly CadastroVinculo[] = [
  {
    patientId: "paciente-onco-1",
    identificadores: [{ tipo: "TELEFONE", valor: "+5583999991111" }],
    chaveDemografica: "1965-04-10|F",
    nome: "Helena Sintetica",
  },
  {
    patientId: "paciente-onco-2",
    identificadores: [{ tipo: "TELEFONE", valor: "+5583999992222" }],
    chaveDemografica: "1958-11-20|M",
    nome: "Carlos Sintetico",
  },
  {
    patientId: "paciente-comp-a",
    identificadores: [{ tipo: "TELEFONE", valor: "+5583999999999" }],
    chaveDemografica: null,
    nome: "Paciente Compartilhado A",
  },
  {
    patientId: "paciente-comp-b",
    identificadores: [{ tipo: "TELEFONE", valor: "+5583999999999" }],
    chaveDemografica: null,
    nome: "Paciente Compartilhado B",
  },
];

const RULESET_CONFERIDO: RulesetAlarmeCanalEntrada = {
  rulesetId: "canal-redflags-conferido",
  rulesetVersao: "1.2.0",
  fraseFinal: "Nada substitui a avaliação presencial do seu médico.",
  sinais: [
    {
      id: "redflag-01-febre",
      termo: "Febre",
      termos: ["febre"],
      limiarDecimosExclusivo: 378,
      orientacao: "Ir ao PS.",
      status: "CONFERIDA_MEDICO",
      fonte: "D-W9-28 + D-W9-38",
    },
    {
      id: "redflag-06-sangramento",
      termo: "Sangramento",
      termos: ["sangramento"],
      limiarDecimosExclusivo: null,
      orientacao: "Ir ao PS.",
      status: "CONFERIDA_MEDICO",
      fonte: "D-W9-28",
    },
  ],
};

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
  const pasta = mkdtempSync(join(tmpdir(), "canal-s02-"));
  pastas.push(pasta);
  const caminho = join(pasta, "ledger.sqlite");
  const db = abrirLedger(caminho);
  abertos.push(db);
  return { db, caminho };
}

function sessao(agora = AGORA) {
  const sessoes = criarGerenciadorSessao({
    medicoId: "medico-s02",
    crm: "CRM-PB-SINTETICO",
    senha: SENHA,
    duracaoMs: 60_000,
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

describe("S-F2-02 · Vínculo, classificação e reconciliação clínica", () => {
  it("1 · vincula apenas por identificador exato único; nome igual, telefone compartilhado ou desconhecido ficam em fila de revisão", async () => {
    const { db } = ledger();
    const acesso = sessao();

    // Nome idêntico ("Helena Sintetica"), porém telefone desconhecido -> FILA_REVISAO (patientId: null)
    const ackNomeIgual = receberTransporteSintetico(db, {
      accountId: "wa-1",
      canal: "WHATSAPP_SERVICO",
      providerMessageId: "msg-nome-igual",
      senderRef: "+5583988880000",
      providerSentAt: ENVIADO,
      ingestedAt: AGORA,
      conteudo: textoConteudo("Olá, aqui é Helena Sintetica, gostaria de tirar uma dúvida sobre retorno."),
      cadastros: CADASTROS,
    });
    expect(ackNomeIgual.ok).toBe(true);
    if (!ackNomeIgual.ok) return;

    const recNomeIgual = await reconciliarMensagemCanalPersistida(db, acesso, {
      mensagemId: ackNomeIgual.reciboId,
      cadastros: CADASTROS,
      nomeDeclaradoNoRemetente: "Helena Sintetica",
    });
    expect(recNomeIgual.ok).toBe(true);
    if (!recNomeIgual.ok) return;
    expect(recNomeIgual.reconciliacao.vinculo).toMatchObject({
      estado: "FILA_REVISAO",
      patientId: null,
      candidatosPatientId: [],
    });

    // Telefone compartilhado entre 2 pacientes -> AMBIGUO (patientId: null) com os dois candidatos
    const ackCompartilhado = receberTransporteSintetico(db, {
      accountId: "wa-1",
      canal: "WHATSAPP_SERVICO",
      providerMessageId: "msg-compartilhado",
      senderRef: "+5583999999999",
      providerSentAt: ENVIADO,
      ingestedAt: AGORA,
      conteudo: textoConteudo("Minha mãe está com sangramento hoje."),
      cadastros: CADASTROS,
    });
    expect(ackCompartilhado.ok).toBe(true);
    if (!ackCompartilhado.ok) return;

    const recCompartilhado = await reconciliarMensagemCanalPersistida(db, acesso, {
      mensagemId: ackCompartilhado.reciboId,
      cadastros: CADASTROS,
      rulesetAlarmes: RULESET_CONFERIDO,
    });
    expect(recCompartilhado.ok).toBe(true);
    if (!recCompartilhado.ok) return;
    expect(recCompartilhado.reconciliacao.vinculo).toMatchObject({
      estado: "AMBIGUO",
      patientId: null,
      candidatosPatientId: ["paciente-comp-a", "paciente-comp-b"],
    });
    expect(recCompartilhado.reconciliacao.classificacao.autorRelato).toBe("FAMILIAR");
    // Mesmo sem vínculo confiável, a mensagem não é descartada e o alarme aponta para CONTATO_NAO_VINCULADO
    expect(recCompartilhado.reconciliacao.alarmes.alarmesAtivos).toEqual([
      expect.objectContaining({
        regraId: "redflag-06-sangramento",
        alvo: "CONTATO_NAO_VINCULADO",
      }),
    ]);
  });

  it("2 · regras em RASCUNHO no corpus padrão não ativam alarmes automáticos mesmo com testes verdes", async () => {
    const { db } = ledger();
    const acesso = sessao();
    const ack = receberTransporteSintetico(db, {
      accountId: "wa-1",
      canal: "WHATSAPP_SERVICO",
      providerMessageId: "msg-rascunho-1",
      senderRef: "+5583999991111",
      providerSentAt: ENVIADO,
      ingestedAt: AGORA,
      conteudo: textoConteudo("Estou com febre de 38,5 graus agora."),
      cadastros: CADASTROS,
    });
    expect(ack.ok).toBe(true);
    if (!ack.ok) return;

    // Usa o corpus padrão (onde sinais estão em status: RASCUNHO)
    const recPadrao = await reconciliarMensagemCanalPersistida(db, acesso, {
      mensagemId: ack.reciboId,
      cadastros: CADASTROS,
    });
    expect(recPadrao.ok).toBe(true);
    if (!recPadrao.ok) return;
    expect(recPadrao.reconciliacao.alarmes.estadoRegras).toBe("PENDENTE_CURADORIA_MEDICA");
    expect(recPadrao.reconciliacao.alarmes.alarmesAtivos).toEqual([]);
    expect(recPadrao.reconciliacao.alarmes.candidatosRascunhoNaoAtivados).toContain("redflag-01-febre");
  });

  it("3 · preserva negação, hipótese/dúvida, temporalidade e limiar estrito de febre (> 37,8 °C) com regras conferidas", async () => {
    const { db } = ledger();
    const acesso = sessao();

    const casos = [
      { id: "msg-negada", texto: "Hoje estou sem febre e não tenho sangramento.", esperaAlarme: false },
      { id: "msg-passado", texto: "Ontem tive febre de 38,5 graus.", esperaAlarme: false },
      { id: "msg-duvida", texto: "Se eu tiver febre de 38,5 graus o que devo fazer?", esperaAlarme: false },
      { id: "msg-378", texto: "Estou com febre de 37,8 graus agora.", esperaAlarme: false },
      { id: "msg-379", texto: "Estou com febre de 37,9 graus agora.", esperaAlarme: true },
    ] as const;

    for (const caso of casos) {
      const ack = receberTransporteSintetico(db, {
        accountId: "wa-1",
        canal: "WHATSAPP_SERVICO",
        providerMessageId: caso.id,
        senderRef: "+5583999991111",
        providerSentAt: ENVIADO,
        ingestedAt: AGORA,
        conteudo: textoConteudo(caso.texto),
        cadastros: CADASTROS,
      });
      expect(ack.ok).toBe(true);
      if (!ack.ok) continue;

      const rec = await reconciliarMensagemCanalPersistida(db, acesso, {
        mensagemId: ack.reciboId,
        cadastros: CADASTROS,
        rulesetAlarmes: RULESET_CONFERIDO,
      });
      expect(rec.ok).toBe(true);
      if (!rec.ok) continue;

      if (caso.esperaAlarme) {
        expect(rec.reconciliacao.alarmes.alarmesAtivos).toEqual([
          expect.objectContaining({
            regraId: "redflag-01-febre",
            alvo: "PACIENTE",
            exigeAvaliacaoPresencial: true,
          }),
        ]);
      } else {
        expect(rec.reconciliacao.alarmes.alarmesAtivos).toEqual([]);
      }
    }
  });

  it("4 · LLM recebe apenas texto desidentificado, valida proposta por código, detecta conflitos e mantém relato separado de fato confirmado", async () => {
    const { db } = ledger();
    const acesso = sessao();

    const ack1 = receberTransporteSintetico(db, {
      accountId: "wa-1",
      canal: "WHATSAPP_SERVICO",
      providerMessageId: "msg-llm-1",
      senderRef: "+5583999991111",
      providerSentAt: ENVIADO,
      ingestedAt: AGORA,
      conteudo: textoConteudo("Aqui é Helena Sintetica, telefone +5583999991111: hoje estou sem febre."),
      cadastros: CADASTROS,
    });
    const ack2 = receberTransporteSintetico(db, {
      accountId: "wa-1",
      canal: "WHATSAPP_SERVICO",
      providerMessageId: "msg-llm-2",
      senderRef: "+5583999991111",
      providerSentAt: ENVIADO,
      ingestedAt: "2026-10-15T14:00:10.000Z",
      conteudo: textoConteudo("Aqui é Helena Sintetica: agora estou com febre de 38,6 graus."),
      cadastros: CADASTROS,
    });
    expect(ack1.ok && ack2.ok).toBe(true);
    if (!ack1.ok || !ack2.ok) return;

    const textosVistosPelaLlm: string[] = [];
    const rec1 = await reconciliarMensagemCanalPersistida(db, acesso, {
      mensagemId: ack1.reciboId,
      cadastros: CADASTROS,
      rulesetAlarmes: RULESET_CONFERIDO,
      classificadorLlm: ({ textoDesidentificado }) => {
        textosVistosPelaLlm.push(textoDesidentificado);
        return {
          categoria: "SINTOMA_INTERCORRENCIA",
          autorRelato: "PACIENTE",
          momentoClinicoRelatado: { temporalidade: "ATUAL", trechoTemporal: "hoje" },
          mencoes: [],
        };
      },
    });
    expect(rec1.ok).toBe(true);
    expect(textosVistosPelaLlm[0]).not.toContain("Helena Sintetica");
    expect(textosVistosPelaLlm[0]).not.toContain("+5583999991111");

    // Se a LLM tentar inventar categoria ou injetar diagnostico/patientId/aprovado, o código rejeita e usa classificação determinística
    const rec2 = await reconciliarMensagemCanalPersistida(db, acesso, {
      mensagemId: ack2.reciboId,
      cadastros: CADASTROS,
      rulesetAlarmes: RULESET_CONFERIDO,
      classificadorLlm: ({ textoDesidentificado }) => {
        textosVistosPelaLlm.push(textoDesidentificado);
        return {
          categoria: "CATEGORIA_INVENTADA",
          patientId: "paciente-forjado",
          diagnostico: "neutropenia febril confirmada",
          aprovado: true,
        };
      },
    });
    expect(rec2.ok).toBe(true);
    if (!rec2.ok) return;
    expect(rec2.reconciliacao.classificacao.modoClassificacao).toBe("DETERMINISTICO_LOCAL");
    expect(rec2.reconciliacao.naturezaEvidencia).toBe("RELATO_CANAL_NAO_CONFIRMADO");
    expect(rec2.reconciliacao.revisao).toBe("REVISAR");
    expect(rec2.reconciliacao.diagnostico).toBe(false);
    expect(rec2.reconciliacao.prescricao).toBe(false);
    expect(rec2.reconciliacao.assinatura).toBe(false);

    // Conflito entre msg-llm-1 ("sem febre") e msg-llm-2 ("com febre de 38,6") preservado
    expect(rec2.reconciliacao.conflitosRelato).toEqual([
      expect.objectContaining({
        termo: "febre",
        mensagensEnvolvidasIds: [ack1.reciboId, ack2.reciboId],
      }),
    ]);

    // Nenhum evento clínico confirmado foi criado no ledger
    const nEventos = (db.prepare("SELECT COUNT(*) AS n FROM clinical_event").get() as { n: number }).n;
    expect(Number(nEventos)).toBe(0);
    // Saída externa continua bloqueada em S-F2-02
    expect(enviarParaForaCanal()).toEqual({ ok: false, codigo: "CANAL_EXTERNO_NAO_HABILITADO", enviou: false });
  });
});
