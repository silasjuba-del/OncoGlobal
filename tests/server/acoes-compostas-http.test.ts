// proveniência: dados sintéticos - não utilizar em produção
import { afterEach, expect, it } from "vitest";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { abrirAmbiente, cadastrarPaciente, criarDiretorio, removerDiretorio, PACIENTE, ENCONTRO, AGORA } from "../f0-fecha/fixtures/consulta-completa.js";
import { executarConfirmacao } from "../../src/kernel/comandos/index.js";
import { salvarDraft, listarDrafts, lerDraft } from "../../src/kernel/comandos/portas.js";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { criarBackup } from "../../scripts/backup.mjs";
import { restaurarBackup } from "../../scripts/backup-restore.mjs";
import { hashConteudoExibido } from "../../src/server/sessao.js";
import { fonteSintetica, presente, ausente } from "../fixtures/triagem.js";
import type { BaseAcaoComposta } from "../../src/contracts/api/acoesCompostas.js";

const ambientes: Awaited<ReturnType<typeof abrirAmbiente>>[] = [];
const contexto = { patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: "lote-acoes-sintetico" };
afterEach(async () => { for (const a of ambientes.splice(0)) { await a.close(); removerDiretorio(a.dir); } });

async function abrir(comCiclo = true) {
  const a = await abrirAmbiente(criarDiretorio()); ambientes.push(a); cadastrarPaciente(a);
  // O cadastro desta fixture usa marcador opaco sem arquivo; declara-se o armazenamento interno.
  for (const d of listarDrafts(a.db, PACIENTE)) if (d.rawRef === "fixture-local-sintetica")
    salvarDraft(a.db, { ...d, revision: d.revision + 1, rawRef: "referencia-local" });
  a.sessoes.selecionarConsulta(a.token, contexto);
  let n = 0;
  const seed = (tipo: string, payload: unknown, revisao: "CONFIRMADO" | "ASSINADO" = "CONFIRMADO") => {
    const id = `acao-seed-${++n}`;
    salvarDraft(a.db, { draftId: id, patientId: PACIENTE, sourceId: id, rawRef: "referencia-local",
      payload: { contexto }, diagnostics: [], revision: 0, criadoEm: AGORA });
    executarConfirmacao(a.db, { ...contexto, operationId: id, reviewDecisionId: id,
      sessao: a.sessoes.obter(a.token)!, em: AGORA,
      registros: [{ draftId: id, expectedRevision: 0, eventId: id, tipo, payload: typeof payload === "function" ? payload(id) : payload,
        fontes: [fonteSintetica(id)], revisao }] });
    return id;
  };
  if (comCiclo) {
    seed("TumorLot", { patientId: PACIENTE, tumorLotId: contexto.tumorLotId, cid: presente("C50"), topografia: presente("Sintética"),
      histologia: presente("Sintética"), estadiamentos: [], finalidadeApac: presente("PALIATIVA"), marcos: [] });
  }
  return Object.assign(a, { seed });
}

it("base ausente é explícita e não grava fato clínico", async () => {
  const a = await abrir(false), antes = a.eventos().length;
  const r = await a.request("/consulta/acoes-compostas/base", contexto);
  expect(r.status).toBe(200);
  expect(r.data).toMatchObject({ base: null, pendencias: ["CICLO_ATUAL_AUSENTE_OU_AMBIGUO"] });
  expect(a.eventos()).toHaveLength(antes);
});

it("nega contexto trocado e sessão ausente antes de preparar", async () => {
  const a = await abrir(false);
  expect((await a.request("/consulta/acoes-compostas/base", { ...contexto, patientId: "outro" })).status).toBe(409);
  expect((await a.request("/consulta/acoes-compostas/base", contexto, "")).status).toBe(401);
  expect((await a.request("/consulta/timeline-multicamadas", contexto)).status).toBe(200);
  expect((await a.request("/consulta/timeline-multicamadas", { ...contexto, patientId: "outro" })).status).toBe(409);
  expect((await a.request("/consulta/timeline-multicamadas", contexto, "")).status).toBe(401);
});

it("prepara redução com base do servidor, persiste e repete sem promover evento", async () => {
  const a = await abrir();
  a.seed("TreatmentEpisode", { episodioId: "episodio-acoes", tumorLotId: contexto.tumorLotId,
    modalidade: "QT", intencao: "PALIATIVA", intentModifier: null, linha: 1, esquemaId: "protocolo-sintetico",
    inicio: presente("2026-10-09"), fim: ausente<string>() });
  const doc = { documentId: "prescricao-acoes", documentVersion: 1, tipoDocumento: "PRESCRICAO_QT",
    texto: "Documento inteiramente sintético", contexto: { ...contexto, episodioId: "episodio-acoes" } };
  a.seed("DOCUMENTO", (id: string) => ({ data: doc, signature: { documentId: doc.documentId, documentVersion: 1,
    documentHash: hashConteudoExibido(doc), reviewDecisionId: id, serverActorId: a.sessoes.obter(a.token)!.medicoId } }), "ASSINADO");
  a.seed("Ciclo", { cicloId: "ciclo-acoes", episodioId: "episodio-acoes", numero: 2, previstoEm: "2026-10-10",
    pesoKg: presente(70), origemPeso: "MEDIDO", ciclosSemPesoConsecutivos: 0,
    prescricaoRef: { documentId: doc.documentId, documentVersion: 1 },
    itens: [{ item: 1, droga: "Droga Sintética", doseMg: 100, reducaoPct: 0 }], comMedico: true });
  const r = await a.request<{ base: BaseAcaoComposta }>("/consulta/acoes-compostas/base", contexto);
  expect(r.status).toBe(200);
  expect(r.data.base.itens[0]?.doseMg).toBe(100);
  const entrada = { contexto, expectedBaseHash: r.data.base.baseHash, idempotencyKey: "preparo-sintetico",
    pedido: { tipo: "REDUZIR_DOSE", motivo: "Ajuste informado no caso sintético", reducaoPct: 25, itensSelecionados: [1] } };
  const antes = a.eventos().length;
  const primeiro = await a.request("/consulta/acoes-compostas/preparar", entrada);
  expect(primeiro.status).toBe(200);
  expect(primeiro.data.resultado.depois.itens[0].doseMg).toBe(75);
  expect(primeiro.data.criaEventoClinico).toBe(false);
  expect((await a.request("/consulta/acoes-compostas/preparar", entrada)).data).toEqual(primeiro.data);
  expect(listarDrafts(a.db, PACIENTE).filter(d => (d.payload as { kind?: string }).kind === "ACAO_COMPOSTA_RASCUNHO")).toHaveLength(1);
  expect(a.eventos()).toHaveLength(antes);
  expect((await a.request("/consulta/acoes-compostas/preparar",
    { ...entrada, pedido: { ...entrada.pedido, reducaoPct: 20 } })).status).toBe(409);
  expect((await a.request("/consulta/acoes-compostas/preparar",
    { ...entrada, idempotencyKey: "base-antiga", expectedBaseHash: "0".repeat(64) })).status).toBe(409);
  expect((await a.request("/consulta/acoes-compostas/preparar",
    { ...entrada, base: { itens: [{ doseMg: 1000 }] } })).status).toBe(400);
  const exibido = await a.request("/consulta/bundle", { ...contexto, draftIds: [primeiro.data.draftId] });
  expect(exibido.status).toBe(200);
  const assinatura = await a.request("/consulta/confirmar", { ...contexto, bloco: "TUDO",
    registros: [{ id: primeiro.data.draftId, expectedRevision: 0 }],
    documentosExibidos: exibido.data.documentos.map((d: { documentId: string; documentVersion: number }) =>
      ({ documentId: d.documentId, documentVersion: d.documentVersion })),
    reconhecerAlertas: [], idempotencyKey: "forcar-promocao-plano" });
  expect(assinatura.status).toBe(409);
  expect(a.eventos()).toHaveLength(antes);
  const filesRoot = join(a.dir, "files"), destino = join(a.dir, "backup");
  mkdirSync(filesRoot); mkdirSync(destino);
  const arquivo = await criarBackup({ dbPath: join(a.dir, "consulta.sqlite"), filesRoot, destino,
    nome: "acoes-http", senha: "senha-sintetica-backup-acao" });
  const restaurado = restaurarBackup({ arquivo, destino: join(a.dir, "restaurado"),
    senha: "senha-sintetica-backup-acao" });
  const reaberto = abrirLedger(restaurado.database);
  try {
    expect((lerDraft(reaberto, primeiro.data.draftId)?.payload as { resposta: unknown }).resposta).toEqual(primeiro.data);
  } finally { reaberto.close(); }
});
