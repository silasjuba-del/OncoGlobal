import { afterEach, expect, it } from "vitest";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { RetratoTransversal } from "../../src/contracts/w12/anatomoPatologico.js";
import { abrirAmbiente, cadastrarPaciente, criarDiretorio, removerDiretorio,
  AGORA, ENCONTRO, PACIENTE } from "./fixtures/consulta-completa.js";

let ambiente: Awaited<ReturnType<typeof abrirAmbiente>> | undefined;
let sequencia = 0;
afterEach(async () => { if (ambiente) { await ambiente.close(); removerDiretorio(ambiente.dir); ambiente = undefined; } });

function gravar(tipo: string, payload: unknown, lote: string | null,
  opcoes: { patientId?: string; encounterId?: string; revisao?: "CONFIRMADO" | "ASSINADO" } = {}) {
  const a = ambiente!;
  const n = ++sequencia, patientId = opcoes.patientId ?? PACIENTE;
  const draftId = `fixture-integridade-${n}`;
  salvarDraft(a.db, { draftId, patientId, sourceId: "fonte-sintetica-integridade",
    rawRef: "fixture-sintetica", payload: {}, diagnostics: [], revision: 0, criadoEm: AGORA });
  expect(confirmar(a.db, { operationId: `fixture-integridade-op-${String(n).padStart(3, "0")}`,
    patientId, encounterId: opcoes.encounterId ?? ENCONTRO, tumorLotId: lote,
    reviewDecisionId: `fixture-review-${n}`, sessao: a.sessoes.obter(a.token)!, em: AGORA,
    registros: [{ draftId, expectedRevision: 0, eventId: `fixture-event-${n}`, tipo,
      payload, fontes: [], revisao: opcoes.revisao ?? "CONFIRMADO" }] }).estado).toBe("GRAVADA");
}

const ausente = { valor: null, estado: "PENDENTE", campo: "AUSENTE", motivo: "não consta", fontes: [], revisao: "RAW" };
const fato = (id: string, valor: string) => ({ campo: "extracao.histology", domain: "histology", factId: id,
  sourceType: "pathology", sourceId: `ap-sintetico-${id}`, rawEvidence: `Histologia: ${valor}`,
  valor, factDate: "2026-10-09", evidence: "EXPLICIT", confidence: 1, requiresConfirmation: false });

it("projeta AP confirmado apenas do paciente, encontro e lote selecionados, preservando conflito e lacunas", async () => {
  ambiente = await abrirAmbiente(criarDiretorio()); cadastrarPaciente(ambiente); cadastrarPaciente(ambiente, "93");
  const lote = "lote-integridade-92";
  gravar("TumorLot", { tumorLotId: lote, patientId: PACIENTE, cid: ausente, topografia: ausente,
    histologia: ausente, estadiamentos: [], finalidadeApac: ausente, marcos: [] }, lote);
  gravar("FATO", fato("outro-paciente", "Texto de outro paciente"), lote, { patientId: "Paciente Teste 93" });
  gravar("FATO", fato("outro-lote", "Texto de outro lote"), "outro-lote");
  gravar("FATO", fato("antigo", "Texto de outro encontro"), lote, { encounterId: "encontro-anterior" });
  gravar("FATO", fato("correto", "Carcinoma sintético literal"), lote);
  const primeira = await ambiente.request("/consulta/carregar", { patientId: PACIENTE, tumorLotId: lote });
  expect(primeira.status).toBe(200);
  const retrato = RetratoTransversal.parse(primeira.data.retratoTransversal);
  expect(retrato.nucleo.histologia).toMatchObject({ estado: "VALOR", valor: "Carcinoma sintético literal",
    origem: { documentoId: "ap-sintetico-correto", dataDocumento: "2026-10-09" } });
  expect(retrato.extensao).toBeNull();
  expect(retrato.nucleo.estadio.estado).toBe("NAO_INFORMADO");
  expect(JSON.stringify(retrato)).not.toMatch(/Texto de outro/);
  gravar("FATO", fato("discordante", "Outro carcinoma sintético literal"), lote);
  const segunda = await ambiente.request("/consulta/carregar", { patientId: PACIENTE, tumorLotId: lote });
  expect(segunda.data.retratoTransversal.nucleo.histologia).toMatchObject({ estado: "CONFLITO", valor: null,
    candidatos: expect.arrayContaining([expect.objectContaining({ valor: "Carcinoma sintético literal" }),
      expect.objectContaining({ valor: "Outro carcinoma sintético literal" })]) });
});

it("não apresenta como assinado um documento com hash de conteúdo divergente", async () => {
  ambiente = await abrirAmbiente(criarDiretorio()); cadastrarPaciente(ambiente);
  gravar("DOCUMENTO", { data: { documentId: "doc-corrompido-sintetico", documentVersion: 1,
    texto: "Texto sintético adulterado" }, signature: { documentId: "doc-corrompido-sintetico",
    documentVersion: 1, documentHash: "hash-nao-correspondente", serverActorId: "medico-teste-e6b" } },
  null, { revisao: "ASSINADO" });
  const leitura = await ambiente.request("/consulta/carregar", { patientId: PACIENTE });
  expect(leitura.data.historicoDocumentos).toEqual([]);
  expect(leitura.data.pendenciasLeitura).toContain("DOCUMENTO_COM_INTEGRIDADE_PENDENTE");
  expect(ambiente.eventos().some((e) => e.tipo === "DOCUMENTO")).toBe(true);
});
