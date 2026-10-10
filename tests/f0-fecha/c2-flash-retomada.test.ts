import { afterEach, expect, it } from "vitest";
import { listarDrafts } from "../../src/kernel/ledger/drafts.js";
import { abrirAmbiente, cadastrarPaciente, carregarConsulta, criarDiretorio, removerDiretorio,
  finalizarFlash, PACIENTE, ENCONTRO } from "./fixtures/consulta-completa.js";

let ambiente: Awaited<ReturnType<typeof abrirAmbiente>> | undefined;
const diretorios: string[] = [];
afterEach(async () => {
  if (ambiente) { await ambiente.close(); ambiente = undefined; }
  for (const dir of diretorios.splice(0)) removerDiretorio(dir);
});
async function abrir() {
  const dir = criarDiretorio(); diretorios.push(dir);
  ambiente = await abrirAmbiente(dir); cadastrarPaciente(ambiente); await carregarConsulta(ambiente);
  return ambiente;
}
async function reiniciar() {
  const anterior = ambiente!; ambiente = undefined; await anterior.close();
  ambiente = await abrirAmbiente(anterior.dir); await carregarConsulta(ambiente);
  return ambiente;
}
const pedido = (key: string, dias = 30) => ({ patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: null,
  idempotencyKey: key, plano: { acoesMarcadas: [], receitasMarcadas: [],
    apac: { cid: "", sigtap: "", finalidade: "", competencia: "", estado: "PENDENTE", pendencias: [], emitir: false },
    retorno: { dias, examesAntesDoRetorno: [] }, tarefasRetorno: { retorno: true, laboratorio: false, imagem: false } } });

it("retoma após reiniciar SQLite e sessão com nova chave sem duplicar preparação ou assinatura", async () => {
  let a = await abrir();
  const primeira = await finalizarFlash(a, "retomada-primeira");
  expect(primeira.preparada.status).toBe(200);
  // A primeira resposta foi perdida pelo cliente; a tela e a sessão deixam de existir.
  a = await reiniciar();
  const segunda = await finalizarFlash(a, "retomada-novo-cliente");
  expect(segunda.preparada.status).toBe(200);
  expect(segunda.preparada.data.documentos).toEqual(primeira.preparada.data.documentos);
  const exibido = await a.request("/consulta/bundle", { ...segunda.context,
    draftIds: segunda.preparada.data.registros.map((r) => r.id) });
  expect(exibido.status).toBe(200);
  const assinada = await a.request("/consulta/confirmar", { ...segunda.context, bloco: "TUDO",
    registros: segunda.preparada.data.registros,
    documentosExibidos: segunda.preparada.data.documentos.map(({ documentId, documentVersion }) => ({ documentId, documentVersion })),
    reconhecerAlertas: [], idempotencyKey: "assinatura-resposta-perdida" });
  expect(assinada.status).toBe(200);
  // Agora perde-se a resposta da assinatura; remount usa outra chave, mas o ledger já gravou.
  a = await reiniciar();
  const terceira = await finalizarFlash(a, "retomada-apos-assinatura");
  expect(terceira.preparada).toMatchObject({ status: 409, data: { codigo: "FLASH_JA_FINALIZADA" } });
  expect(a.eventos().filter((e) => e.revisao === "ASSINADO")).toHaveLength(2);
  expect(listarDrafts(a.db, PACIENTE).filter((d) => (d.payload as Record<string, unknown>).documentId)).toHaveLength(2);
  const reaberta = await carregarConsulta(a);
  expect(reaberta.data.historicoDocumentos).toHaveLength(2);
});

it("recusa a mesma chave com conteúdo diferente e permite plano novo com chave própria", async () => {
  const a = await abrir();
  const original = await a.request("/consulta/flash/preparar", pedido("plano-original"));
  expect(original.status).toBe(200);
  expect(await a.request("/consulta/flash/preparar", pedido("plano-original", 31)))
    .toMatchObject({ status: 409, data: { codigo: "IDEMPOTENCIA_CONFLITO" } });
  const outro = await a.request("/consulta/flash/preparar", pedido("plano-alterado", 31));
  expect(outro.status).toBe(200);
  expect(outro.data.documentos).not.toEqual(original.data.documentos);
});

it("reverte toda a preparação e a reserva se uma gravação intermediária falhar", async () => {
  const a = await abrir();
  a.db.exec(`CREATE TEMP TRIGGER falha_demo_preparacao BEFORE INSERT ON draft_envelope
    WHEN NEW.draftId LIKE 'flash-retorno-%' BEGIN SELECT RAISE(ABORT, 'FALHA_SINTETICA'); END`);
  const resposta = await fetch(`${a.baseUrl}/consulta/flash/preparar`, { method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${a.token}` },
    body: JSON.stringify(pedido("operacao-com-falha")) });
  expect(resposta.status).toBe(500); await resposta.text();
  expect(listarDrafts(a.db, PACIENTE).filter((d) => d.sourceId === "consulta-flash")).toEqual([]);
  expect(a.db.prepare("SELECT COUNT(*) AS n FROM action_idempotency WHERE chave LIKE 'flash-preparar:%'").get()?.n).toBe(0);
  a.db.exec("DROP TRIGGER falha_demo_preparacao");
  expect((await a.request("/consulta/flash/preparar", pedido("operacao-com-falha"))).status).toBe(200);
});
