import { afterEach, expect, it } from "vitest";
import { realpathSync } from "node:fs";
import { basename, dirname } from "node:path";
import { tmpdir } from "node:os";
import { salvarDraft, confirmar } from "../../../src/kernel/ledger/writeRouter.js";
import { lerDraft } from "../../../src/kernel/ledger/drafts.js";
import { abrirAmbiente, cadastrarPaciente, carregarConsulta, criarDiretorio, removerDiretorio,
  PACIENTE, ENCONTRO, AGORA } from "../../f0-fecha/fixtures/consulta-completa.js";

let app: Awaited<ReturnType<typeof abrirAmbiente>> | undefined;
afterEach(async () => {
  if (!app) return;
  await app.close();
  const dir = realpathSync(app.dir);
  if (dirname(dir).toLowerCase() !== realpathSync(tmpdir()).toLowerCase() || !basename(dir).startsWith("f0-e6b-consulta-"))
    throw new Error("FIXTURE_FORA_DO_TEMP");
  removerDiretorio(dir); app = undefined;
});
const contexto = { patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: null };
const plano = { acoesMarcadas: [], receitasMarcadas: [],
  apac: { cid: "", sigtap: "", finalidade: "", competencia: "", estado: "PENDENTE", pendencias: [], emitir: false },
  retorno: { dias: 14, examesAntesDoRetorno: [] } };
async function ambiente() {
  app = await abrirAmbiente(criarDiretorio()); cadastrarPaciente(app); await carregarConsulta(app); return app;
}
function cadastro(a: NonNullable<typeof app>, id: string, supersedesEventId: string | null = null) {
  salvarDraft(a.db, { draftId: id, patientId: PACIENTE, sourceId: id, rawRef: "cadastro-sintetico", payload: {},
    diagnostics: [], revision: 0, criadoEm: AGORA });
  expect(confirmar(a.db, { ...contexto, operationId: `op-${id}`, reviewDecisionId: `review-${id}`,
    sessao: a.sessoes.obter(a.token)!, em: AGORA,
    registros: [{ draftId: id, expectedRevision: 0, eventId: id, tipo: "Paciente", revisao: "CONFIRMADO", fontes: [],
      supersedesEventId, payload: { patientId: PACIENTE, identificadores: [], nome: "Paciente Teste Nome Corrigido",
        nascimento: null, sexoCadastral: "NAO_INFORMADO", divergencia: false } }] }).estado).toBe("GRAVADA");
}

it("dois cadastros vigentes impedem preparar documentos sem eleger um nome", async () => {
  const a = await ambiente(); cadastro(a, "cadastro-concorrente-sintetico");
  const antes = a.eventos();
  const r = await a.request("/consulta/flash/preparar", { ...contexto, plano, idempotencyKey: "identidade-ambigua-preparar" });
  expect(r).toMatchObject({ status: 409, data: { codigo: "IDENTIDADE_PACIENTE_AMBIGUA" } });
  expect(a.eventos()).toEqual(antes);
  expect(a.eventos().some(e => e.revisao === "ASSINADO")).toBe(false);
});

it("supersessão explícita resolve cadastro e congela a identidade única na prévia", async () => {
  const a = await ambiente(); const anterior = a.eventos().find(e => e.tipo === "Paciente")!;
  cadastro(a, "cadastro-corrigido-sintetico", anterior.eventId);
  const r = await a.request("/consulta/flash/preparar", { ...contexto, plano, idempotencyKey: "identidade-unica-preparar" });
  expect(r.status).toBe(200);
  for (const registro of r.data.registros) {
    const d = lerDraft(a.db, registro.id)!;
    expect(d.payload).toMatchObject({ identidadePaciente: { patientId: PACIENTE,
      nome: "Paciente Teste Nome Corrigido", cadastroEventId: "cadastro-corrigido-sintetico" } });
  }
});

it("cadastro concorrente após a prévia invalida a assinatura sem gravar documentos", async () => {
  const a = await ambiente();
  const p = await a.request("/consulta/flash/preparar", { ...contexto, plano, idempotencyKey: "identidade-race-preparar" });
  expect(p.status).toBe(200);
  expect((await a.request("/consulta/bundle", { ...contexto, draftIds: p.data.registros.map((r: { id: string }) => r.id) })).status).toBe(200);
  cadastro(a, "cadastro-posterior-sintetico");
  const r = await a.request("/consulta/confirmar", { ...contexto, bloco: "TUDO", registros: p.data.registros,
    documentosExibidos: p.data.documentos.map((d: { documentId: string; documentVersion: number }) => ({ documentId: d.documentId, documentVersion: d.documentVersion })),
    reconhecerAlertas: [], idempotencyKey: "identidade-race-assinar" });
  expect(r.status).toBe(409);
  expect(a.eventos().some(e => e.revisao === "ASSINADO")).toBe(false);
});
