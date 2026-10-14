import { createHash, randomUUID } from "node:crypto";
import { criarExtratorOpenAi, prepararPayloadExtracaoOpenAi, type EntradaExtracao, type ContextoServidorOpenAi, type OpcoesOpenAi, type ResultadoExtracao } from "./index.js";
import type { EvidenciaExtracaoLlm, EvidenciaDocumentoOriginalLlm, Executor, ResultadoValidacaoExtracaoLlm, ResultadoValidacaoDocumentoOriginal } from "../../gateway/gateway.js";
import { criarTranscritorDocumentoOriginal, payloadDocumentoOriginal, validarPdfOriginal, type ResultadoDocumentoOriginal } from "./documentoOriginal.js";
import type { Sessao } from "../../../contracts/base.js";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function criarRuntimeExtracaoLlm(opcoes: OpcoesOpenAi & { agora?: () => string } = {}) {
  const env = opcoes.env ?? process.env;
  const extrator = criarExtratorOpenAi(opcoes);
  const transcritor = criarTranscritorDocumentoOriginal(opcoes);
  const agora = opcoes.agora ?? (() => new Date().toISOString());
  const originais = new Map<string, { evidencia: EvidenciaDocumentoOriginalLlm; atual: () => boolean; usada: boolean }>();
  const resultadosOriginais = new Map<string, ResultadoDocumentoOriginal>();
  type Preparacao = { evidencia: EvidenciaExtracaoLlm; entrada: EntradaExtracao; contexto: ContextoServidorOpenAi; atual: () => boolean };
  const fontes = new Map<string, Preparacao>(); const resultados = new Map<string, ResultadoExtracao>();
  const preparar = (chave: string, entrada: EntradaExtracao, contexto: ContextoServidorOpenAi, versao: number, atual: () => boolean,
    origem: EvidenciaExtracaoLlm["origem"] = "UPLOAD_LOCAL_EXPLICITO") => {
    const capacidade = extrator.status(); if (capacidade.status !== "DISPONIVEL") return { status: "PENDENTE" as const, codigo: capacidade.codigo };
    const p = prepararPayloadExtracaoOpenAi(entrada, contexto, env.ONCOASSIST_OPENAI_MODEL ?? "");
    if (p.status !== "PRONTO") return p;
    const existente = fontes.get(chave);
    if (existente && (existente.evidencia.payload !== p.payload || existente.evidencia.fonte.hash !== p.fonteHash
      || JSON.stringify(existente.entrada.correlacao) !== JSON.stringify(entrada.correlacao)))
      return { status: "PENDENTE" as const, codigo: "CHAVE_REUSADA_PAYLOAD_DIFERENTE" };
    const evidencia: EvidenciaExtracaoLlm = { modo: "DESIDENTIFICADO", origem, destino: "https://api.openai.com/v1/responses",
      modelo: env.ONCOASSIST_OPENAI_MODEL!, store: false, revisaoObrigatoria: true,
      fonte: { id: entrada.fonte.id, versao, hash: p.fonteHash }, payload: p.payload, dicionarioPaciente: structuredClone(contexto.dicionario),
      sanitizationReport: { riscoResidual: "BAIXO", versaoSanitizador: "1.0.0", payloadHash: hash(p.payload), sourceHash: p.fonteHash },
      autorizacao: { patientId: entrada.correlacao.patientId, encounterId: entrada.correlacao.encounterId, sourceId: entrada.fonte.id,
        sourceVersion: versao, sourceHash: p.fonteHash, payloadHash: hash(p.payload), vigente: true, escopo: "EXTRACAO_RASCUNHO" } };
    fontes.set(chave, { evidencia, entrada: structuredClone(entrada), contexto: structuredClone(contexto), atual });
    return { status: "PRONTO" as const, evidencia };
  };
  const validarExtracaoLlm = (intent: Parameters<Executor["executar"]>[0]): ResultadoValidacaoExtracaoLlm => {
    const p = fontes.get(intent.idempotencyKey);
    return p && p.atual() ? { ok: true, evidencia: p.evidencia } : { ok: false };
  };
  const prepararDocumentoOriginal = async (chave: string, entrada: { fonteId: string; base64: string; correlacao: EntradaExtracao["correlacao"] },
    versao: number, sessao: Sessao, atual: () => boolean) => {
    const capacidade = transcritor.status(); if (capacidade.status !== "DISPONIVEL") return { status: "PENDENTE" as const, codigo: capacidade.codigo };
    if (!atual()) return { status: "PENDENTE" as const, codigo: "FONTE_OU_CONTEXTO_DESATUALIZADO" };
    const pdf = await validarPdfOriginal(entrada.base64);
    if (!pdf || !atual()) return { status: "PENDENTE" as const, codigo: !pdf ? "PDF_ORIGINAL_INVALIDO" : "FONTE_OU_CONTEXTO_DESATUALIZADO" };
    const inicio = Date.parse(agora()), expira = Math.min(inicio + 60_000, Date.parse(sessao.expiraEm));
    if (!Number.isFinite(inicio) || !Number.isFinite(expira) || expira <= inicio) return { status: "PENDENTE" as const, codigo: "LEASE_EXPIRADA" };
    const payload = payloadDocumentoOriginal(env.ONCOASSIST_OPENAI_MODEL!, entrada.base64);
    if (originais.has(chave)) return { status: "PENDENTE" as const, codigo: "LEASE_JA_REGISTRADA" };
    const evidencia: EvidenciaDocumentoOriginalLlm = { decisaoId: "D-W9-66", modo: "DOCUMENTO_ORIGINAL", origem: "UPLOAD_LOCAL_EXPLICITO", provider: "OPENAI",
      destino: "https://api.openai.com/v1/responses", modelo: env.ONCOASSIST_OPENAI_MODEL!, store: false, revisaoObrigatoria: true, phi: "EXCECAO_EXPRESSA", payload,
      fonte: { id: entrada.fonteId, versao, hash: pdf.hash, mime: "application/pdf", paginas: pdf.paginas },
      lease: { id: randomUUID(), emitidaEm: new Date(inicio).toISOString(), expiraEm: new Date(expira).toISOString(), usada: false, medicoId: sessao.medicoId },
      autorizacao: { patientId: entrada.correlacao.patientId, encounterId: entrada.correlacao.encounterId, tumorLotId: entrada.correlacao.tumorLotId,
        sourceId: entrada.fonteId, sourceVersion: versao, sourceHash: pdf.hash, payloadHash: hash(payload), vigente: true, escopo: "D_W9_66_TRANSCRICAO_NAO_VERIFICADA" } };
    originais.set(chave, { evidencia, atual, usada: false }); return { status: "PRONTO" as const, evidencia };
  };
  const validarDocumentoOriginalLlm = (intent: Parameters<Executor["executar"]>[0], sessao: Sessao): ResultadoValidacaoDocumentoOriginal => {
    const p = originais.get(intent.idempotencyKey);
    return p && !p.usada && p.atual() && p.evidencia.lease.medicoId === sessao.medicoId
      && Date.parse(p.evidencia.lease.expiraEm) > Date.parse(agora()) && transcritor.status().status === "DISPONIVEL"
      ? { ok: true, evidencia: p.evidencia } : { ok: false };
  };
  const executor: Executor = { async executar(intent, _ordinaria, prova, original) {
    if (original) {
      const p = originais.get(intent.idempotencyKey);
      if (!p || p.usada || original.payload !== p.evidencia.payload || original.lease.id !== p.evidencia.lease.id
        || !p.atual() || Date.parse(original.lease.expiraEm) <= Date.parse(agora())) return { ok: false, incerto: false, erro: "LEASE_INVALIDA" };
      p.usada = true;
      const r = await transcritor.transcrever(original.payload, original.fonte.hash, original.fonte.paginas);
      if (!p.atual()) { resultadosOriginais.set(intent.idempotencyKey, { status: "PENDENTE", codigo: "FONTE_OU_CONTEXTO_DESATUALIZADO" });
        return { ok: false, incerto: false, erro: "FONTE_OU_CONTEXTO_DESATUALIZADO" }; }
      resultadosOriginais.set(intent.idempotencyKey, r);
      return r.status === "DERIVADO_LLM_NAO_VERIFICADO" ? { ok: true, recibo: "DERIVADO_NAO_VERIFICADO" } : { ok: false, incerto: false, erro: r.codigo };
    }
    const p = fontes.get(intent.idempotencyKey);
    if (!p || !prova || prova.payload !== p.evidencia.payload || prova.fonte.hash !== p.evidencia.fonte.hash || !p.atual())
      return { ok: false, incerto: false, erro: "FONTE_DESATUALIZADA" };
    const resultado = await extrator.extrair(p.entrada, { ...p.contexto, payloadAutorizado: prova.payload });
    if (!p.atual()) { resultados.set(intent.idempotencyKey, { status: "PENDENTE", codigo: "FONTE_OU_CONTEXTO_DESATUALIZADO" });
      return { ok: false, incerto: false, erro: "FONTE_OU_CONTEXTO_DESATUALIZADO" }; }
    resultados.set(intent.idempotencyKey, resultado);
    return resultado.status === "PROPOSTA" ? { ok: true, recibo: "PROPOSTA_LLM" }
      : { ok: false, incerto: false, erro: resultado.codigo };
  } };
  return { status: extrator.status, statusDocumentoOriginal: transcritor.status, preparar, validarExtracaoLlm,
    prepararDocumentoOriginal, validarDocumentoOriginalLlm, executor,
    resultadoDocumentoOriginal: (chave: string) => resultadosOriginais.get(chave),
    resultado: (chave: string) => resultados.get(chave),
    descartar: (chave: string) => { fontes.delete(chave); resultados.delete(chave); originais.delete(chave); resultadosOriginais.delete(chave); } };
}
