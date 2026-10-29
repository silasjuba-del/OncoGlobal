import { salvarDraft } from "../../src/kernel/comandos/portas.js";
import { executarConfirmacao } from "../../src/kernel/comandos/index.js";
import { afterEach, expect, it } from "vitest";
import { abrirAmbiente, cadastrarPaciente, carregarConsulta, criarDiretorio, removerDiretorio, PACIENTE, ENCONTRO } from "../f0-fecha/fixtures/consulta-completa.js";
let a: Awaited<ReturnType<typeof abrirAmbiente>> | undefined;
afterEach(async () => { if (a) { await a.close(); removerDiretorio(a.dir); a = undefined; } });
const contexto = { patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: null };
const plano = { acoesMarcadas: [], receitasMarcadas: [], apac: { cid: "", sigtap: "", finalidade: "", competencia: "", estado: "PENDENTE", pendencias: [], emitir: false }, retorno: { dias: 14, examesAntesDoRetorno: [] }, solicitacoes: { laboratorio: [], imagem: [] } };
async function abrir() { a = await abrirAmbiente(criarDiretorio()); cadastrarPaciente(a);
 salvarDraft(a.db, { draftId: "agenda-integrada", patientId: PACIENTE, sourceId: "agenda-sintetica", rawRef: "referencia-local", payload: {}, diagnostics: [], revision: 0, criadoEm: "2026-10-09T12:00:00-03:00" });
 executarConfirmacao(a.db, { ...contexto, operationId: "agenda-integrada", reviewDecisionId: "agenda-integrada", sessao: a.sessoes.obter(a.token)!, em: "2026-10-09T12:00:00-03:00", registros: [{ draftId: "agenda-integrada", expectedRevision: 0, eventId: "agenda-integrada", tipo: "AgendaEntry", revisao: "CONFIRMADO", fontes: [], payload: { patientId: PACIENTE, encounterId: ENCONTRO, data: "2026-10-09", horario: "09:00" } }] });
 await carregarConsulta(a); return a; }
async function evolucao(amb: NonNullable<typeof a>, versao: number | null = null) {
 const base = await amb.request("/consulta/atendimento/recuperar", contexto);
 const r = await amb.request("/consulta/atendimento/preparar", { ...contexto, expectedBaseHash: base.data.base.revisao, expectedVersion: versao,
  idempotencyKey: `evolucao-${versao ?? 0}`, entrada: { hoje: "Relato sintético: fadiga, sem febre referida.", decisao: `Decisão médica sintética ${versao ?? 0}.`, saidas: ["EVOLUCAO"] } });
 expect(r.status).toBe(201); expect(r.data.rascunho.documentos[0].estado).toBe("PRONTO_PARA_REVISAO");
 const { id, versao: v, conteudoHash } = r.data.rascunho; return { id, versao: v, conteudoHash };
}
async function preparar(amb: NonNullable<typeof a>, ref: Awaited<ReturnType<typeof evolucao>>) {
 const r = await amb.request("/consulta/flash/preparar", { ...contexto, plano: { ...plano, evolucaoAtendimento: ref }, idempotencyKey: "flash-integrada-preparar" });
 expect(r.status, JSON.stringify(r.data)).toBe(200); return r.data;
}
async function exibir(amb: NonNullable<typeof a>, preparada: any) {
 const b = await amb.request("/consulta/bundle", { ...contexto, draftIds: preparada.registros.map((r: any) => r.id) });
 expect(b.status).toBe(200);
 return { ...contexto, bloco: "TUDO", registros: preparada.registros, documentosExibidos: preparada.documentos.map((d: any) => ({ documentId: d.documentId, documentVersion: d.documentVersion })), reconhecerAlertas: [], idempotencyKey: "flash-integrada-assinar" };
}
it("evolução salva → Flash → assinatura → histórico após reinício preserva texto/autoria e replay", async () => {
 const amb = await abrir(), ref = await evolucao(amb);
 const salvo = await amb.request("/consulta/flash/rascunho", { ...contexto, plano: { ...plano, evolucaoAtendimento: ref }, expectedRevision: null });
 expect(salvo.status).toBe(201);
 expect((await carregarConsulta(amb)).data.flash.rascunho.plano.evolucaoAtendimento).toEqual(ref);
 const preparada = await preparar(amb, ref), input = await exibir(amb, preparada);
 const gravada = await amb.request("/consulta/confirmar", input); expect(gravada.data.codigo, JSON.stringify(gravada.data)).toBe("GRAVADA");
 const antes = amb.eventos(); expect(JSON.stringify(antes)).toContain("Relato sintético: fadiga, sem febre referida.");
 expect(JSON.stringify(antes)).toContain("evolucaoAtendimento");
 expect((await amb.request("/consulta/confirmar", input)).data.codigo).toBe("REPLAY"); expect(amb.eventos()).toEqual(antes);
 const dir = amb.dir; await amb.close(); a = await abrirAmbiente(dir); await carregarConsulta(a);
 const consulta = await carregarConsulta(a);
 expect(consulta.data.historicoDocumentos.some((d: any) => d.titulo === "Evolução da Consulta Flash")).toBe(true);
 expect(a.eventos()).toEqual(antes);
});
it("nova versão da evolução depois da prévia recusa assinatura sem documentos", async () => {
 const amb = await abrir(), ref = await evolucao(amb), preparada = await preparar(amb, ref), input = await exibir(amb, preparada);
 await evolucao(amb, 1);
 expect(await amb.request("/consulta/confirmar", input)).toMatchObject({ status: 409, data: { codigo: "EVOLUCAO_ALTERADA_OU_PENDENTE" } });
 expect(amb.eventos().filter(e => e.tipo === "DOCUMENTO")).toEqual([]);
});
it("referência adulterada ou de contexto diferente não prepara documentos", async () => {
 const amb = await abrir(), ref = await evolucao(amb);
 for (const referencia of [{ ...ref, conteudoHash: "0".repeat(64) }, { ...ref, id: "outro-paciente" }]) {
  expect(await amb.request("/consulta/flash/preparar", { ...contexto, plano: { ...plano, evolucaoAtendimento: referencia }, idempotencyKey: "adulterada-flash" })).toMatchObject({ status: 409, data: { codigo: "EVOLUCAO_ALTERADA_OU_PENDENTE" } });
 }
 expect(amb.eventos().filter(e => e.tipo === "DOCUMENTO")).toEqual([]);
});
