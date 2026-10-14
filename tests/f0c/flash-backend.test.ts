import { afterEach, expect, it } from "vitest";
import { PlanoFlashEntrada, prepararFinalizacaoFlash } from "../../src/server/flash.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { listarDrafts, salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { abrirAmbiente, cadastrarPaciente, carregarConsulta, criarDiretorio, removerDiretorio,
  PACIENTE, ENCONTRO, AGORA } from "../f0-fecha/fixtures/consulta-completa.js";

let ambiente: Awaited<ReturnType<typeof abrirAmbiente>> | undefined;
const diretorios: string[] = [];
afterEach(async () => {
  if (ambiente) { await ambiente.close(); ambiente = undefined; }
  for (const dir of diretorios.splice(0)) removerDiretorio(dir);
});
async function abrir() {
  const dir = criarDiretorio(); diretorios.push(dir);
  ambiente = await abrirAmbiente(dir); cadastrarPaciente(ambiente);
  const ausente = { valor: null, estado: "PENDENTE", campo: "AUSENTE", motivo: "não consta", fontes: [], revisao: "RAW" };
  const registros = [
    ["TumorLot", { tumorLotId: "lote-flash", patientId: PACIENTE, cid: ausente, topografia: ausente,
      histologia: ausente, estadiamentos: [], finalidadeApac: ausente, marcos: [] }],
    ["TreatmentEpisode", { episodioId: "episodio-flash", tumorLotId: "lote-flash", modalidade: "QT",
      intencao: "ADJUVANTE", intentModifier: null, linha: 1, esquemaId: "CAPOX", inicio: ausente, fim: ausente }],
    ["Ciclo", { cicloId: "ciclo-flash", episodioId: "episodio-flash", numero: 3, previstoEm: "2026-10-10",
      pesoKg: ausente, origemPeso: null, ciclosSemPesoConsecutivos: 0, prescricaoRef: null, itens: [], comMedico: true }],
  ] as const;
  for (const [tipo, payload] of registros) {
    const draftId = `seed-${tipo}`;
    salvarDraft(ambiente.db, { draftId, patientId: PACIENTE, sourceId: draftId, rawRef: "sintetico",
      payload: {}, diagnostics: [], revision: 0, criadoEm: AGORA });
    expect(confirmar(ambiente.db, { operationId: `operacao-${tipo}`, patientId: PACIENTE, encounterId: ENCONTRO,
      tumorLotId: "lote-flash", reviewDecisionId: `revisao-${tipo}`, sessao: ambiente.sessoes.obter(ambiente.token)!, em: AGORA,
      registros: [{ draftId, expectedRevision: 0, eventId: `evento-${tipo}`, tipo, payload, fontes: [], revisao: "CONFIRMADO" }],
    }).estado).toBe("GRAVADA");
  }
  await carregarConsulta(ambiente);
  return ambiente;
}
const contexto = { patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: "lote-flash" };
const plano = () => ({ acoesMarcadas: [], receitasMarcadas: [],
  apac: { cid: "C18", sigtap: "", finalidade: "", competencia: "", estado: "PENDENTE", pendencias: ["SIGTAP"], emitir: false },
  retorno: { dias: 21, examesAntesDoRetorno: [] },
  solicitacoes: { laboratorio: ["HMG", "U", "Cr", "TGO", "TGP", "CEA"], imagem: ["TC tórax", "RM hepática"] },
  decisaoQt: { solicitarCiclo: true, data: "2026-10-10" as string | null },
});

it("prepara itens exatos e decisão de QT sem APAC, assinatura ou administração; replay não duplica", async () => {
  const a = await abrir();
  const pedido = { ...contexto, plano: plano(), idempotencyKey: "essencial-primeiro" };
  const primeira = await a.request("/consulta/flash/preparar", pedido);
  expect(primeira.status).toBe(200);
  expect(primeira.data.apacRascunho).toBe(false);
  const drafts = listarDrafts(a.db, PACIENTE).filter((d) => d.sourceId === "consulta-flash");
  const docs = drafts.map((d) => d.payload as Record<string, any>);
  expect(docs).toHaveLength(6);
  const conjunto = docs.find(d => d.tipoDocumento === "FLASH_CONJUNTO_IMPRESSAO")!;
  expect(conjunto.documentosIncluidos).toHaveLength(5);
  expect(conjunto.texto).toContain("Pedido de laboratório");
  expect(conjunto.texto).toContain("Pedido de imagem");
  expect(conjunto.texto).not.toContain("Conjunto da Consulta Flash");
  expect(primeira.data.alvoImpressao).toMatchObject({ tipo: "DOCUMENTO", id: conjunto.documentId });
  expect(docs.find((d) => d.tipoDocumento === "FLASH_PEDIDO_LABORATORIO")).toMatchObject({ itens: pedido.plano.solicitacoes.laboratorio });
  expect(docs.find((d) => d.tipoDocumento === "FLASH_PEDIDO_IMAGEM")).toMatchObject({ itens: pedido.plano.solicitacoes.imagem });
  expect(docs.find((d) => d.tipoDocumento === "FLASH_DECISAO_QT")).toMatchObject({ decisaoQt: pedido.plano.decisaoQt, administracaoRegistrada: false });
  expect(docs.find((d) => d.tipoDocumento === "FLASH_DECISAO_QT")?.texto).toContain("Protocolo: CAPOX. Ciclo: 3");
  expect(docs.some((d) => String(d.texto).includes("Itens: PENDENTE"))).toBe(false);
  expect(a.eventos().some((e) => e.tipo === "DOCUMENTO" || e.revisao === "ASSINADO")).toBe(false);
  const repetida = await a.request("/consulta/flash/preparar", { ...pedido, idempotencyKey: "essencial-resposta-perdida" });
  expect(repetida.data.documentos).toEqual(primeira.data.documentos);
  expect(listarDrafts(a.db, PACIENTE).filter((d) => d.sourceId === "consulta-flash")).toHaveLength(6);
});

it("não inventa protocolo ou ciclo quando contexto de QT não está identificado", async () => {
  const a = await abrir();
  const resultado = prepararFinalizacaoFlash(a.db, AGORA, { ...contexto,
    plano: PlanoFlashEntrada.parse(plano()), idempotencyKey: "essencial-contexto-ausente" });
  expect(resultado).toMatchObject({ status: 409, body: { codigo: "QT_SEM_CONTEXTO" } });
  expect(listarDrafts(a.db, PACIENTE).filter((d) => d.sourceId === "consulta-flash")).toHaveLength(0);
});

it("retoma seleções, outros, QT e retorno após fechar banco e abrir nova sessão", async () => {
  let a = await abrir();
  const p = plano();
  expect((await a.request("/consulta/flash/rascunho", { ...contexto, plano: p, expectedRevision: null })).status).toBe(201);
  const dir = a.dir; ambiente = undefined; await a.close();
  a = ambiente = await abrirAmbiente(dir);
  const visao = await carregarConsulta(a);
  expect(visao.data.flash.rascunho).toMatchObject({ revision: 0, plano: p });
  expect(a.eventos().some((e) => e.revisao === "ASSINADO")).toBe(false);
});

it("não cria QT quando desmarcado nem pedidos vazios mesmo com flags legadas marcadas", async () => {
  const a = await abrir();
  const p = { ...plano(), solicitacoes: { laboratorio: [], imagem: [] },
    decisaoQt: { solicitarCiclo: false, data: null }, tarefasRetorno: { retorno: true, laboratorio: true, imagem: true } };
  const r = await a.request("/consulta/flash/preparar", { ...contexto, plano: p, idempotencyKey: "essencial-vazio" });
  expect(r.status).toBe(200);
  expect(r.data.documentos.map((d: { tipoDocumento: string }) => d.tipoDocumento)).toEqual(["FLASH_EVOLUCAO", "FLASH_RETORNO", "FLASH_CONJUNTO_IMPRESSAO"]);
});

it("salva decisão incompleta como rascunho mas não prepara QT sem data; data impossível e item vazio são recusados", async () => {
  const a = await abrir();
  const p = plano(); p.decisaoQt.data = null;
  expect((await a.request("/consulta/flash/rascunho", { ...contexto, plano: p, expectedRevision: null })).status).toBe(201);
  expect(await a.request("/consulta/flash/preparar", { ...contexto, plano: p, idempotencyKey: "essencial-sem-data" }))
    .toMatchObject({ status: 409, data: { codigo: "DATA_CICLO_PENDENTE" } });
  p.decisaoQt.data = "2026-02-30";
  expect((await a.request("/consulta/flash/preparar", { ...contexto, plano: p, idempotencyKey: "essencial-data-invalida" })).status).toBe(400);
  p.decisaoQt.data = "2026-10-10"; p.solicitacoes.laboratorio = ["   "];
  expect((await a.request("/consulta/flash/preparar", { ...contexto, plano: p, idempotencyKey: "essencial-item-vazio" })).status).toBe(400);
  expect(listarDrafts(a.db, PACIENTE).filter((d) => (d.payload as Record<string, unknown>).documentId)).toHaveLength(0);
});

it("falha durante criação da decisão QT desfaz pedidos e reserva de idempotência", async () => {
  const a = await abrir();
  a.db.exec(`CREATE TEMP TRIGGER falha_qt BEFORE INSERT ON draft_envelope
    WHEN NEW.draftId LIKE 'flash-qt-%' BEGIN SELECT RAISE(ABORT, 'FALHA_SINTETICA'); END`);
  const pedido = { ...contexto, plano: plano(), idempotencyKey: "essencial-atomico" };
  const resposta = await fetch(`${a.baseUrl}/consulta/flash/preparar`, { method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${a.token}` }, body: JSON.stringify(pedido) });
  expect(resposta.status).toBe(500); await resposta.text();
  expect(listarDrafts(a.db, PACIENTE).filter((d) => d.sourceId === "consulta-flash")).toHaveLength(0);
  expect(a.db.prepare("SELECT COUNT(*) AS n FROM action_idempotency WHERE chave LIKE 'flash-preparar:%'").get()?.n).toBe(0);
  a.db.exec("DROP TRIGGER falha_qt");
  expect((await a.request("/consulta/flash/preparar", pedido)).status).toBe(200);
});

it("exige exibição antes de assinar e preserva decisão de QT sem evento de administração", async () => {
  const a = await abrir();
  const prep = await a.request("/consulta/flash/preparar", { ...contexto, plano: plano(), idempotencyKey: "essencial-exibicao" });
  expect(prep.status).toBe(200);
  const confirmacao = { ...contexto, bloco: "TUDO", registros: prep.data.registros,
    documentosExibidos: prep.data.documentos.map((d: { documentId: string; documentVersion: number }) => ({
      documentId: d.documentId, documentVersion: d.documentVersion })),
    reconhecerAlertas: [], idempotencyKey: "essencial-assinatura" };
  expect(await a.request("/consulta/confirmar", confirmacao)).toMatchObject({ status: 409, data: { codigo: "BUNDLE_NAO_EXIBIDO" } });
  expect(a.eventos().some((e) => e.revisao === "ASSINADO")).toBe(false);
  expect((await a.request("/consulta/bundle", { ...contexto,
    draftIds: prep.data.registros.map((r: { id: string }) => r.id) })).status).toBe(200);
  expect((await a.request("/consulta/confirmar", { ...confirmacao, idempotencyKey: "essencial-assinatura-exibida" })).status).toBe(200);
  const novos = a.eventos().filter((e) => e.revisao === "ASSINADO");
  expect(novos).toHaveLength(6);
  expect(novos.every((e) => e.tipo === "DOCUMENTO" && e.revisao === "ASSINADO")).toBe(true);
});
