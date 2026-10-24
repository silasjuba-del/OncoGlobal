import { afterEach, describe, expect, it } from "vitest";
import { abrirAmbiente, cadastrarPaciente, carregarConsulta, criarDiretorio, removerDiretorio, extrair, vincular, PACIENTE, ENCONTRO } from "../f0-fecha/fixtures/consulta-completa.js";
import { lerDraft, listarDrafts, salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { ConfiguracaoPrimeiraConsulta, ResultadoSkillClinica } from "../../src/contracts/skillsClinicas.js";

let app: Awaited<ReturnType<typeof abrirAmbiente>> | undefined;
let dir: string | undefined;
const contexto = { patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: null };
afterEach(async () => { await app?.close(); if (dir) removerDiretorio(dir); app = undefined; dir = undefined; });
async function abrir() {
  dir = criarDiretorio(); app = await abrirAmbiente(dir); cadastrarPaciente(app); await carregarConsulta(app);
  const fonte = await extrair(app, { sourceId: "fonte-sintetica", sourceType: "pathology", text: "Histologia: adenocarcinoma sintético.\n21/10/2025 Creatinina 1,2 mg/dL." });
  const link = await vincular(app, fonte, "fonte-sintetica"); expect(link.status, JSON.stringify(link.data)).toBe(200);
  const pedido = { acao: "EXECUTAR", contexto, skillId: "primeira-consulta", versao: "1.0.0", operationId: "primeira-consulta-teste-1",
    fontes: [{ draftId: fonte.draftId, expectedRevision: link.data.revision }], configuracao: {} };
  return { app, fonte, pedido };
}
describe("Skill nativa: kit → resumo → documentos persistentes", () => {
  it("executa, salva conjunto, recupera após reinício e preserva idempotência sem fatos ou assinatura", async () => {
    const a = await abrir(), antes = a.app.eventos().length, draftsAntes = listarDrafts(a.app.db).length;
    const r = await a.app.request("/consulta/skills", a.pedido);
    expect(r.status, JSON.stringify(r.data)).toBe(200);
    const body = ResultadoSkillClinica.parse(r.data);
    if (body.codigo !== "SKILL_PREPARADA") throw Error(JSON.stringify(body));
    expect(body.documentos).toHaveLength(4);
    expect(body.execucao.evidencias.length).toBeGreaterThan(0);
    expect(body.documentos.find(d => d.tipo === "RESUMO_CASO")?.texto).toContain("adenocarcinoma sintético");
    expect(body.documentos.find(d => d.tipo === "RECEITA")?.pendencias).toContain("ITENS DA RECEITA NÃO DEFINIDOS");
    expect(body.documentos.every(d => d.assinatura === null && d.estado === "RASCUNHO")).toBe(true);
    expect(a.app.eventos()).toHaveLength(antes);
    expect(listarDrafts(a.app.db)).toHaveLength(draftsAntes + 5);
    const replay = await a.app.request("/consulta/skills", a.pedido);
    expect(replay.data).toMatchObject({ codigo: "SKILL_REPLAY", execucao: body.execucao, documentos: body.documentos });
    expect(listarDrafts(a.app.db)).toHaveLength(draftsAntes + 5);
    const documento = lerDraft(a.app.db, body.documentos[0]!.documentId)!;
    expect(confirmar(a.app.db, { operationId: "promocao-indevida", ...contexto, sessao: a.app.sessoes.obter(a.app.token)!,
      reviewDecisionId: "revisao", em: "2026-10-09T12:00:00-03:00", registros: [{ draftId: documento.draftId, expectedRevision: 0,
        eventId: "ev-falso", tipo: "FATO", payload: { campo: "diagnostico", valor: "inventado" }, fontes: [], revisao: "CONFIRMADO" }] }).estado).toBe("NEGADA");
    await a.app.close(); app = await abrirAmbiente(dir!); await carregarConsulta(app);
    const historico = await app.request("/consulta/skills", { acao: "HISTORICO", contexto });
    expect(historico.data).toMatchObject({ codigo: "SKILLS_HISTORICO", execucoes: [{ execucaoId: body.execucao.execucaoId }] });
    const recuperada = await app.request("/consulta/skills", { acao: "LER", contexto, execucaoId: body.execucao.execucaoId });
    expect(recuperada.data).toMatchObject({ validade: "ATUAL", documentos: body.documentos });
    expect(app.eventos()).toHaveLength(antes);
  });

  it("configuração com itens explícitos prepara receitas/exames e rejeita reutilização divergente", async () => {
    const a = await abrir();
    const configuracao = ConfiguracaoPrimeiraConsulta.parse({ documentos: ["RESUMO_CASO", "RECEITA", "PEDIDO_EXAMES"], estiloResumo: "CRONOLOGICO",
      receitas: [{ medicamento: "Medicamento sintético", dose: null, via: null, frequencia: null, duracao: null, quantidade: null }],
      exames: [{ exame: "Exame sintético", indicacao: "Indicação escrita pelo médico para teste" }] });
    const r = await a.app.request("/consulta/skills", { ...a.pedido, configuracao });
    expect(r.status, JSON.stringify(r.data)).toBe(200);
    const body = ResultadoSkillClinica.parse(r.data);
    if (body.codigo !== "SKILL_PREPARADA") throw Error();
    expect(body.documentos.find(d => d.tipo === "RECEITA")?.texto).toContain("Medicamento sintético");
    expect(body.documentos.find(d => d.tipo === "RECEITA")?.pendencias).toContain("RECEITA 1: dose");
    expect(body.documentos.find(d => d.tipo === "PEDIDO_EXAMES")?.texto).toContain("Exame sintético");
    expect((await a.app.request("/consulta/skills", a.pedido)).data).toMatchObject({ codigo: "OPERACAO_SKILL_DIVERGENTE" });
  });

  it("fonte alterada invalida recuperação e documentos adulterados não são devolvidos", async () => {
    const a = await abrir();
    const r = ResultadoSkillClinica.parse((await a.app.request("/consulta/skills", a.pedido)).data);
    if (r.codigo !== "SKILL_PREPARADA") throw Error();
    const fonte = lerDraft(a.app.db, a.fonte.draftId)!;
    salvarDraft(a.app.db, { ...fonte, revision: fonte.revision + 1, diagnostics: [...fonte.diagnostics, "ALTERACAO_SINTETICA"] });
    expect((await a.app.request("/consulta/skills", { acao: "LER", contexto, execucaoId: r.execucao.execucaoId })).data).toMatchObject({ validade: "ENTRADA_ALTERADA" });
    const doc = lerDraft(a.app.db, r.documentos[0]!.documentId)!;
    salvarDraft(a.app.db, { ...doc, revision: 1, payload: { ...r.documentos[0], texto: "adulterado" } });
    expect((await a.app.request("/consulta/skills", { acao: "LER", contexto, execucaoId: r.execucao.execucaoId })).data).toMatchObject({ codigo: "DOCUMENTO_SKILL_INTEGRIDADE_INVALIDA" });
  });

  it("não aceita comandos livres, vínculo fabricado ou consulta diferente", async () => {
    const a = await abrir();
    expect((await a.app.request("/consulta/skills", { ...a.pedido, shell: "comando" })).status).toBe(400);
    expect((await a.app.request("/consulta/skills", { ...a.pedido, contexto: { ...contexto, patientId: "outro" } })).status).toBe(409);
    const d = lerDraft(a.app.db, a.fonte.draftId)!;
    const p = d.payload as Record<string, any>;
    salvarDraft(a.app.db, { ...d, revision: d.revision + 1, payload: { ...p, patientLinkReview: { ...p.patientLinkReview, reviewDecisionId: "forjado" } } });
    expect((await a.app.request("/consulta/skills", { ...a.pedido, fontes: [{ draftId: d.draftId, expectedRevision: d.revision + 1 }] })).data)
      .toMatchObject({ codigo: "DECISAO_VINCULO_SKILL_NAO_COMPROVADA" });
    expect(listarDrafts(a.app.db).filter(d => String((d.payload as { kind?: string }).kind).startsWith("SKILL_"))).toHaveLength(0);
  });
});
