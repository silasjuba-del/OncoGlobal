import { createHash } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { receberTransporteSintetico } from "../../src/server/canalEntrada.js";
import { cadastrosCanal } from "../../src/server/canalOperacao.js";
import { criarServidorLocal } from "../../src/server/http.js";
import { lerConsulta, lerLotes, lerPaciente } from "../../src/server/leituras.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";

const EM = "2026-10-20T12:00:00.000Z";
const SENHA = "senha-sintetica-alias-paciente";
const CONTEXTO_A = { patientId: "paciente-alias-a", encounterId: "encontro-alias-a", tumorLotId: "lote-alias-a" };
const CONTEXTO_B = { patientId: "paciente-alias-b", encounterId: "encontro-alias-b", tumorLotId: null };
const SENDER = "5500000007711";

const dbs: ReturnType<typeof abrirLedger>[] = [];
afterEach(() => {
  for (const db of dbs.splice(0)) db.close();
});

function abrir() {
  const db = abrirLedger(":memory:");
  dbs.push(db);
  const sessoes = criarGerenciadorSessao({
    medicoId: "medico-alias-teste",
    crm: "CRM-TESTE",
    senha: SENHA,
    duracaoMs: 60_000,
    agora: () => EM,
  });
  const token = sessoes.login(SENHA)!.token;
  let seq = 0;
  function seed(
    ctx: { patientId: string; encounterId: string; tumorLotId: string | null },
    tipo: string,
    payload: unknown,
  ) {
    const id = `seed-alias-${++seq}`;
    salvarDraft(db, {
      draftId: id,
      patientId: ctx.patientId,
      sourceId: id,
      rawRef: "referencia-local-sintetica",
      payload: {},
      diagnostics: [],
      revision: 0,
      criadoEm: EM,
    });
    const r = confirmar(db, {
      ...ctx,
      operationId: id,
      reviewDecisionId: `rev-${id}`,
      sessao: sessoes.obter(token)!,
      em: EM,
      registros: [
        {
          draftId: id,
          expectedRevision: 0,
          eventId: id,
          tipo,
          payload,
          fontes: [],
          revisao: "CONFIRMADO",
        },
      ],
    });
    expect(r.estado).toBe("GRAVADA");
  }
  return { db, sessoes, token, seed };
}

function paciente(patientId: string, nome: string) {
  return {
    patientId,
    nome,
    identificadores: [{ tipo: "PRONTUARIO" as const, valor: `PR-${patientId}` }],
    nascimento: null,
    sexoCadastral: "NAO_INFORMADO" as const,
    divergencia: false,
  };
}

const campoAusente = {
  valor: null,
  estado: "PENDENTE" as const,
  campo: "AUSENTE" as const,
  motivo: "não informado",
  fontes: [],
  revisao: "RAW" as const,
};

it("Task010: recusa identidade de Paciente@1 divergente do envelope e carrega Paciente@1 + TumorLot@1 válidos na agenda e consulta HTTP", async () => {
  const a = abrir();
  a.seed(CONTEXTO_B, "Paciente@1", paciente(CONTEXTO_A.patientId, "Identidade Divergente Sintética"));
  expect(lerPaciente(a.db, CONTEXTO_B.patientId)).toBeNull();
  expect(
    lerConsulta(a.db, CONTEXTO_B.patientId, EM, a.sessoes.obter(a.token)!, null, {
      encounterId: CONTEXTO_B.encounterId,
    }),
  ).toMatchObject({ codigo: "PACIENTE_NAO_ENCONTRADO" });

  a.seed(CONTEXTO_A, "Paciente@1", paciente(CONTEXTO_A.patientId, "Paciente alias sintetico"));
  a.seed(CONTEXTO_A, "TumorLot@1", {
    patientId: CONTEXTO_A.patientId,
    tumorLotId: CONTEXTO_A.tumorLotId!,
    cid: campoAusente,
    topografia: campoAusente,
    histologia: campoAusente,
    estadiamentos: [],
    finalidadeApac: campoAusente,
    marcos: [],
  });
  a.seed(CONTEXTO_A, "Contato", {
    contatoId: "contato-alias-1",
    canal: "WHATSAPP_SERVICO" as const,
    endereco: SENDER,
    patientId: CONTEXTO_A.patientId,
    relacao: "PACIENTE" as const,
    vinculadoEm: EM,
    revogadoEm: null,
  });
  a.seed(CONTEXTO_A, "AgendaEntry", {
    patientId: CONTEXTO_A.patientId,
    encounterId: CONTEXTO_A.encounterId,
    data: "2026-10-20",
    horario: "09:00",
  });

  expect(lerLotes(a.db, CONTEXTO_A.patientId)).toHaveLength(1);

  const texto = "Relato sintetico literal: nao tive febre.";
  expect(
    receberTransporteSintetico(a.db, {
      accountId: "conta-alias-http",
      canal: "WHATSAPP_SERVICO",
      providerMessageId: "relato-alias-http",
      senderRef: SENDER,
      providerSentAt: EM,
      ingestedAt: EM,
      conteudo: {
        tipo: "TEXT",
        texto,
        contentSha256: createHash("sha256").update(texto).digest("hex"),
      },
      cadastros: cadastrosCanal(a.db),
    }).ok,
  ).toBe(true);

  const gateway = criarGateway({ agora: () => EM, auditar: () => {}, store: memoriaIdempotencia(), executores: {} });
  const server = criarServidorLocal({ db: a.db, sessoes: a.sessoes, gateway, agora: () => EM, log: () => {} });
  try {
    await new Promise<void>((resolve) => (server.listening ? resolve() : server.once("listening", resolve)));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("PORTA_AUSENTE");
    const post = (path: string, body: unknown) =>
      fetch(`http://127.0.0.1:${addr.port}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${a.token}` },
        body: JSON.stringify(body),
      });
    const consulta = await post("/consulta/carregar", CONTEXTO_A);
    expect(consulta.status).toBe(200);
    const data = (await consulta.json()) as {
      cabecalho: { paciente: { nome: string }; lotes: unknown[] };
      contatosCanal: { mensagens: unknown[] };
    };
    expect(data.cabecalho.paciente.nome).toBe("Paciente alias sintetico");
    expect(data.cabecalho.lotes).toHaveLength(1);
    expect(data.contatosCanal.mensagens).toContainEqual(
      expect.objectContaining({ texto, patientId: CONTEXTO_A.patientId, estadoVinculo: "VINCULADO" }),
    );
    const agenda = await post("/consulta/agenda", {});
    expect(agenda.status).toBe(200);
    expect(((await agenda.json()) as { itens: unknown[] }).itens).toContainEqual(
      expect.objectContaining({ patientId: CONTEXTO_A.patientId, nome: "Paciente alias sintetico" }),
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
