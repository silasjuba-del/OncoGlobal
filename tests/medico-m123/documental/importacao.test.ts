import { afterEach, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { ContextoDocumental, DocumentoDocumentalResposta, DocumentosDocumentaisResposta, ImportacaoDocumentalResposta,
  PacoteDocumental, type ImportarDocumental } from "../../../src/contracts/api/importacaoDocumental.js";
import { operarDocumental } from "../../../src/server/importacaoDocumental.js";
import { processarUploadLocal, type DepsUpload } from "../../../src/server/upload.js";
import { criarApiDocumental } from "../../../src/ui/api/documental.js";
import { lerDraft, listarDrafts } from "../../../src/kernel/ledger/drafts.js";
import { rascunhoInerte } from "../../../src/contracts/rascunhos.js";
import { abrirAmbiente, cadastrarPaciente, criarDiretorio, removerDiretorio, AGORA, PACIENTE, ENCONTRO } from "../../f0-fecha/fixtures/consulta-completa.js";
import { pdfDigital } from "../../f0-fecha/fixtures/colon-e2e.js";

const contexto = ContextoDocumental.parse({ patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: null });
let ambiente: Awaited<ReturnType<typeof abrirAmbiente>> | undefined;
afterEach(async () => { if (ambiente) { await ambiente.close(); removerDiretorio(ambiente.dir); ambiente = undefined; } });
async function abrir() {
  ambiente = await abrirAmbiente(criarDiretorio()); cadastrarPaciente(ambiente);
  ambiente.sessoes.selecionarConsulta(ambiente.token, contexto);
  return ambiente;
}
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
function pacote(): PacoteDocumental {
  const bytes = pdfDigital(["Documento SINTETICO", "Nega febre. Achado incerto, A CONFERIR."]);
  return { schema: "oncoglobal.import.v1", pacoteId: "pacote-sintetico-1", origem: { aplicativo: "PDFForge", versao: "0.1.0" },
    autor: "Autor SINTETICO", criadoEm: AGORA,
    original: { nome: "documento-sintetico.pdf", mediaType: "application/pdf", bytesBase64: bytes.toString("base64"), sha256: sha(bytes) },
    paginasExtraidas: [{ pagina: 1, texto: "Texto externo adulterado: não substituir a extração do original." }],
    anotacoes: [{ id: "nota-1", pagina: 1, texto: "Proposta SINTETICA sem confirmação", autorTipo: "IA", autor: "Modelo SINTETICO", criadoEm: AGORA }] };
}
const pedido = (p = pacote()): ImportarDocumental => ({ contexto, tipoFonte: "medical_note", pacote: p });
const deps = (a: Awaited<ReturnType<typeof abrirAmbiente>>): DepsUpload => ({ db: a.db, sessoes: a.sessoes, agora: () => AGORA });

it("PDF original é convertido localmente, pacote e anotação ficam inertes e reabrem no mesmo SQLite", async () => {
  const a = await abrir(), entrada = pedido(), antes = a.eventos().length;
  const r = await operarDocumental(deps(a), a.token, "/consulta/documental/importar", entrada);
  expect(r.status).toBe(201);
  const recebido = ImportacaoDocumentalResposta.parse(r.body);
  expect(recebido).toMatchObject({ assinado: false, criaEventoClinico: false, documento: { estado: "RECEBIDO", vinculoPaciente: "PENDENTE", conversao: "PRONTO" } });
  const fonte = lerDraft(a.db, recebido.documento.draftId!)!;
  expect(fonte.patientId).toBeNull();
  expect(fonte.payload).toMatchObject({ input: { rawTranscript: expect.stringContaining("Nega febre") } });
  expect(JSON.stringify(fonte.payload)).not.toContain("Texto externo adulterado");
  expect(a.eventos()).toHaveLength(antes);
  const registro = listarDrafts(a.db, PACIENTE).find(d => (d.payload as { formato?: string }).formato === "IMPORTACAO_DOCUMENTAL")!;
  expect(rascunhoInerte(registro.payload)).toBe(true);
  const aberto = DocumentoDocumentalResposta.parse((await operarDocumental(deps(a), a.token, "/consulta/documental/abrir", { contexto, pacoteId: entrada.pacote.pacoteId })).body);
  expect(aberto.pacote).toEqual(entrada.pacote);
  expect(aberto.textoLocal[0]?.texto).toContain("A CONFERIR");
  const dir = a.dir; await a.close(); ambiente = undefined;
  ambiente = await abrirAmbiente(dir); ambiente.sessoes.selecionarConsulta(ambiente.token, contexto);
  const reaberto = DocumentoDocumentalResposta.parse((await operarDocumental(deps(ambiente), ambiente.token, "/consulta/documental/abrir", { contexto, pacoteId: entrada.pacote.pacoteId })).body);
  expect(reaberto).toEqual(aberto);
});

it("replay não duplica e mesmo pacoteId com anotação alterada é conflito", async () => {
  const a = await abrir(), entrada = pedido();
  await operarDocumental(deps(a), a.token, "/consulta/documental/importar", entrada);
  const total = listarDrafts(a.db).length;
  const replay = await operarDocumental(deps(a), a.token, "/consulta/documental/importar", entrada);
  expect(replay.status).toBe(200); expect(ImportacaoDocumentalResposta.parse(replay.body).codigo).toBe("REPLAY");
  expect(listarDrafts(a.db)).toHaveLength(total);
  entrada.pacote.anotacoes[0]!.texto = "ALTERADO";
  expect(await operarDocumental(deps(a), a.token, "/consulta/documental/importar", entrada)).toMatchObject({ status: 409, body: { codigo: "PACOTE_ID_CONFLITANTE" } });
  expect(listarDrafts(a.db)).toHaveLength(total);
});

it("hash divergente, identidade clínica no pacote e derivado de outra origem são recusados antes de persistir", async () => {
  const a = await abrir(), entrada = pedido(), total = listarDrafts(a.db).length;
  entrada.pacote.original.sha256 = "0".repeat(64);
  expect(await operarDocumental(deps(a), a.token, "/consulta/documental/importar", entrada)).toMatchObject({ status: 400, body: { codigo: "DOCUMENTO_HASH_DIVERGENTE" } });
  expect((await operarDocumental(deps(a), a.token, "/consulta/documental/importar", { ...pedido(), pacote: { ...pacote(), patientId: "intruso" } })).status).toBe(400);
  const original = pacote();
  expect((await operarDocumental(deps(a), a.token, "/consulta/documental/importar", pedido({ ...original, derivado: { ...original.original,
    descricao: "SINTETICO", originalSha256: "f".repeat(64) } }))).status).toBe(400);
  expect(listarDrafts(a.db)).toHaveLength(total);
});

it("sessão e encontro selecionado protegem importação, listagem e abertura", async () => {
  const a = await abrir(), entrada = pedido();
  expect((await operarDocumental(deps(a), "invalido", "/consulta/documental/importar", entrada)).status).toBe(401);
  await operarDocumental(deps(a), a.token, "/consulta/documental/importar", entrada);
  a.sessoes.selecionarConsulta(a.token, { ...contexto, encounterId: "outro-sintetico" });
  for (const [url, raw] of [["listar", contexto], ["abrir", { contexto, pacoteId: entrada.pacote.pacoteId }], ["importar", entrada]] as const)
    expect((await operarDocumental(deps(a), a.token, `/consulta/documental/${url}`, raw)).status).toBe(409);
  const outro = { ...contexto, encounterId: "outro-sintetico" };
  const lista = await operarDocumental(deps(a), a.token, "/consulta/documental/listar", outro);
  expect(DocumentosDocumentaisResposta.parse(lista.body).documentos).toEqual([]);
});

it("resposta tardia da conversão não publica upload no contexto abandonado", async () => {
  const a = await abrir(); let liberar!: () => void;
  const espera = new Promise<void>(resolve => { liberar = resolve; });
  const d: DepsUpload = { ...deps(a), converterUpload: async e => { await espera; return { status: "PRONTO", documento: { ...e, hash: "sintetico", paginas: [{ n: 1, texto: "SINTETICO" }] } }; } };
  const pendente = operarDocumental(d, a.token, "/consulta/documental/importar", pedido());
  a.sessoes.selecionarConsulta(a.token, { ...contexto, encounterId: "outro" }); liberar();
  expect(await pendente).toMatchObject({ status: 409, body: { codigo: "CONTEXTO_UPLOAD_DIVERGENTE" } });
  expect(listarDrafts(a.db).filter(x => (x.payload as { kind?: string }).kind === "EXTRACAO_RASCUNHO")).toEqual([]);
  a.sessoes.selecionarConsulta(a.token, contexto);
  const recebidos = DocumentosDocumentaisResposta.parse((await operarDocumental(deps(a), a.token, "/consulta/documental/listar", contexto)).body);
  expect(recebidos.documentos[0]).toMatchObject({ draftId: null, estado: "RECEBIDO", conversao: "PENDENTE" });
  expect((await operarDocumental(deps(a), a.token, "/consulta/documental/importar", pedido())).status).toBe(200);
});

it("duas importações concorrentes não produzem envelope de conflito ou duplicação", async () => {
  const a = await abrir(); let liberar!: () => void;
  const espera = new Promise<void>(resolve => { liberar = resolve; });
  const d: DepsUpload = { ...deps(a), converterUpload: async e => { await espera; return { status: "PENDENTE", motivo: "SINTETICO", documento: { ...e, hash: "sintetico", paginas: [] } }; } };
  const entrada = pedido(), primeira = operarDocumental(d, a.token, "/consulta/documental/importar", entrada), segunda = operarDocumental(d, a.token, "/consulta/documental/importar", entrada);
  liberar(); const resultados = await Promise.all([primeira, segunda]);
  expect(resultados.map(x => x.status).sort()).toEqual([200, 201]);
  expect(listarDrafts(a.db).filter(x => (x.payload as { kind?: string }).kind === "EXTRACAO_RASCUNHO")).toHaveLength(1);
  expect(listarDrafts(a.db).some(x => x.diagnostics.includes("EXPECTED_REVISION_CONFLICT"))).toBe(false);
});

it("upload também revalida sessão depois da conversão", async () => {
  const a = await abrir(), sessao = a.sessoes.obter(a.token)!, entrada = pacote();
  const d: DepsUpload = { ...deps(a), converterUpload: async e => {
    a.sessoes.obter = () => null;
    return { status: "PENDENTE", motivo: "SINTETICO", documento: { ...e, hash: "sintetico", paginas: [] } };
  } };
  const r = await processarUploadLocal(d, a.token, sessao, { ...contexto, id: "tardio", sourceId: "fonte", sourceType: "medical_note", tipo: "PDF", bytesBase64: entrada.original.bytesBase64 });
  expect(r.status).toBe(401);
  expect(listarDrafts(a.db).some(x => x.sourceId === "fonte")).toBe(false);
});

it("cliente rejeita resposta documental de outro encontro", async () => {
  const api = criarApiDocumental(async () => ({ status: 200, json: { contexto: { ...contexto, encounterId: "outro" }, documentos: [] } }));
  await expect(api.listar(contexto)).rejects.toThrow("CONTEXTO_DOCUMENTAL_DIVERGENTE");
});
