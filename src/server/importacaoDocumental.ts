import { createHash } from "node:crypto";
import { z } from "zod";
import { AbrirDocumental, ContextoDocumental, DocumentoDocumentalResposta, DocumentosDocumentaisResposta,
  ImportacaoDocumentalResposta, ImportarDocumental, MAX_DOCUMENTAL_BYTES, PacoteDocumental, ResumoDocumental } from "../contracts/api/importacaoDocumental.js";
import { FactSourceType } from "../contracts/w10/extracao.js";
import { lerDraft, listarDrafts, salvarDraft, transacao } from "../kernel/comandos/portas.js";
import { hashConteudoExibido as hash } from "./sessao.js";
import { processarUploadLocal, type DepsUpload } from "./upload.js";

const Registro = z.object({ kind: z.literal("SINTESE_RASCUNHO"), formato: z.literal("IMPORTACAO_DOCUMENTAL"),
  contexto: ContextoDocumental, tipoFonte: FactSourceType, pacote: PacoteDocumental,
  requestHash: z.string(), sourceId: z.string(), draftId: z.string().nullable(), importadoPor: z.string(), recebidoEm: z.string(),
}).strict();
type Registro = z.infer<typeof Registro>;
class Recusa extends Error { constructor(readonly codigo: string, readonly status = 409) { super(codigo); } }
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const mesmo = (a: unknown, b: unknown) => hash(a) === hash(b);

function conferirBytes(pacote: PacoteDocumental): void {
  let total = 0;
  for (const arquivo of [pacote.original, ...(pacote.derivado ? [pacote.derivado] : [])]) {
    if (arquivo.bytesBase64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(arquivo.bytesBase64)) throw new Recusa("DOCUMENTO_BASE64_INVALIDO", 400);
    const bytes = Buffer.from(arquivo.bytesBase64, "base64");
    if (bytes.toString("base64") !== arquivo.bytesBase64) throw new Recusa("DOCUMENTO_BASE64_INVALIDO", 400);
    total += bytes.length;
    if (!bytes.length || total > MAX_DOCUMENTAL_BYTES) throw new Recusa("DOCUMENTO_LIMITE_8MB", 413);
    if (!bytes.subarray(0, 1024).includes(Buffer.from("%PDF-"))) throw new Recusa("DOCUMENTO_NAO_E_PDF", 400);
    if (sha(bytes) !== arquivo.sha256) throw new Recusa("DOCUMENTO_HASH_DIVERGENTE", 400);
  }
}
function lerRegistro(payload: unknown): Registro {
  const registro = Registro.parse(payload);
  if (hash({ contexto: registro.contexto, tipoFonte: registro.tipoFonte, pacote: registro.pacote }) !== registro.requestHash)
    throw new Recusa("DOCUMENTO_INTEGRIDADE_INVALIDA");
  conferirBytes(registro.pacote);
  return registro;
}
function exigirContexto(deps: DepsUpload, token: string, contexto: ContextoDocumental): void {
  if (!deps.sessoes.obter(token)) throw new Recusa("SESSAO_INVALIDA", 401);
  const selecionado = deps.sessoes.consultaSelecionada(token);
  if (!selecionado || !mesmo(selecionado, contexto)) throw new Recusa("CONTEXTO_CONSULTA_ALTERADO");
}
function chave(contexto: ContextoDocumental, pacoteId: string): string { return `documental:${hash({ contexto, pacoteId })}`; }

function representar(deps: DepsUpload, registro: Registro) {
  const d = registro.draftId ? lerDraft(deps.db, registro.draftId) : null;
  const payload = d?.payload as { original?: { contentHash?: string; status?: string; documento?: { paginas?: { n: number; texto: string }[] } }; contextoUpload?: unknown } | undefined;
  if (registro.draftId && (!d || !mesmo(payload?.contextoUpload, registro.contexto)
    || payload?.original?.contentHash !== registro.pacote.original.sha256 || (d.patientId !== null && d.patientId !== registro.contexto.patientId)))
    throw new Recusa("DOCUMENTO_INTEGRIDADE_INVALIDA");
  const documento = ResumoDocumental.parse({ pacoteId: registro.pacote.pacoteId, draftId: registro.draftId,
    sourceId: registro.sourceId, nome: registro.pacote.original.nome, sha256: registro.pacote.original.sha256,
    recebidoEm: registro.recebidoEm, autorDeclarado: registro.pacote.autor, importadoPor: registro.importadoPor,
    origem: "PDFForge", estado: "RECEBIDO", conversao: payload?.original?.status === "PRONTO" ? "PRONTO" : "PENDENTE",
    vinculoPaciente: d?.patientId ? "REVISTO" : "PENDENTE", requiresMedicalReview: true,
    anotacoes: registro.pacote.anotacoes.length, possuiDerivado: !!registro.pacote.derivado });
  return { documento, textoLocal: (payload?.original?.documento?.paginas ?? []).map(p => ({ pagina: p.n, texto: p.texto })) };
}

/** Importação inerte reutiliza o upload e a revisão canônicos. Não grava ClinicalEvent. */
export async function operarDocumental(deps: DepsUpload, token: string, url: string, raw: unknown): Promise<{ status: number; body: unknown }> {
  const sessao = deps.sessoes.obter(token);
  if (!sessao) return { status: 401, body: { codigo: "SESSAO_INVALIDA" } };
  try {
    if (url === "/consulta/documental/listar") {
      const contexto = ContextoDocumental.parse(raw); exigirContexto(deps, token, contexto);
      const documentos = listarDrafts(deps.db, contexto.patientId).flatMap(d => {
        const p = d.payload as { formato?: unknown; contexto?: unknown };
        if (p?.formato !== "IMPORTACAO_DOCUMENTAL" || !mesmo(p.contexto, contexto)) return [];
        return [representar(deps, lerRegistro(d.payload)).documento];
      }).sort((a, b) => b.recebidoEm.localeCompare(a.recebidoEm) || a.pacoteId.localeCompare(b.pacoteId));
      return { status: 200, body: DocumentosDocumentaisResposta.parse({ contexto, documentos }) };
    }
    if (url === "/consulta/documental/abrir") {
      const pedido = AbrirDocumental.parse(raw); exigirContexto(deps, token, pedido.contexto);
      const d = lerDraft(deps.db, chave(pedido.contexto, pedido.pacoteId));
      if (!d || d.patientId !== pedido.contexto.patientId) throw new Recusa("DOCUMENTO_NAO_ENCONTRADO", 404);
      const registro = lerRegistro(d.payload);
      if (!mesmo(registro.contexto, pedido.contexto)) throw new Recusa("CONTEXTO_CONSULTA_ALTERADO");
      return { status: 200, body: DocumentoDocumentalResposta.parse({ contexto: pedido.contexto, pacote: registro.pacote, ...representar(deps, registro) }) };
    }
    if (url !== "/consulta/documental/importar") return { status: 404, body: { codigo: "ROTA_DOCUMENTAL_INEXISTENTE" } };
    const pedido = ImportarDocumental.parse(raw); exigirContexto(deps, token, pedido.contexto); conferirBytes(pedido.pacote);
    const id = chave(pedido.contexto, pedido.pacote.pacoteId), requestHash = hash(pedido);
    // Receber primeiro conserva a fonte mesmo se a conversão for interrompida. O envelope é INERTE.
    const reserva = transacao(deps.db, () => {
      const anterior = lerDraft(deps.db, id);
      if (anterior) {
        const r = lerRegistro(anterior.payload);
        if (r.requestHash !== requestHash || anterior.patientId !== pedido.contexto.patientId) throw new Recusa("PACOTE_ID_CONFLITANTE");
        return { registro: r, replay: true };
      }
      const recebidoEm = deps.agora(), registro: Registro = { kind: "SINTESE_RASCUNHO", formato: "IMPORTACAO_DOCUMENTAL",
        contexto: pedido.contexto, tipoFonte: pedido.tipoFonte, pacote: pedido.pacote, requestHash,
        sourceId: `pdf-${hash({ contexto: pedido.contexto, pacoteId: pedido.pacote.pacoteId }).slice(0, 40)}`,
        draftId: null, importadoPor: sessao.medicoId, recebidoEm };
      salvarDraft(deps.db, { draftId: id, patientId: pedido.contexto.patientId, sourceId: registro.sourceId,
        rawRef: "referencia-local", payload: registro,
        diagnostics: ["RECEBIDO_NAO_REVISADO", "TEXTO_EXTERNO_NAO_PROMOVIDO"], revision: 0, criadoEm: recebidoEm });
      return { registro, replay: false };
    });
    if (!reserva.registro.draftId) {
      const resultado = await processarUploadLocal(deps, token, sessao, { ...pedido.contexto,
        id: id, sourceId: reserva.registro.sourceId, sourceType: pedido.tipoFonte, tipo: "PDF", bytesBase64: pedido.pacote.original.bytesBase64 });
      if (resultado.status >= 400) return resultado;
      exigirContexto(deps, token, pedido.contexto);
      transacao(deps.db, () => {
        const d = lerDraft(deps.db, id)!; const r = lerRegistro(d.payload);
        if (r.requestHash !== requestHash) throw new Recusa("PACOTE_ID_CONFLITANTE");
        if (!r.draftId) salvarDraft(deps.db, { ...d, revision: d.revision + 1,
          payload: { ...r, draftId: z.string().min(1).parse(resultado.body.draftId) } });
      });
    }
    const final = lerRegistro(lerDraft(deps.db, id)!.payload);
    return { status: reserva.replay ? 200 : 201, body: ImportacaoDocumentalResposta.parse({
      codigo: reserva.replay ? "REPLAY" : "DOCUMENTO_RECEBIDO", contexto: pedido.contexto,
      documento: representar(deps, final).documento, criaEventoClinico: false, assinado: false }) };
  } catch (erro) {
    return { status: erro instanceof Recusa ? erro.status : erro instanceof z.ZodError ? 400 : 503,
      body: { codigo: erro instanceof Recusa ? erro.codigo : erro instanceof z.ZodError ? "PACOTE_DOCUMENTAL_INVALIDO" : "DOCUMENTO_INDISPONIVEL" } };
  }
}
