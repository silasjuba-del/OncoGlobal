import { createHash } from "node:crypto";
import { criarExtratorOpenAi, prepararPayloadExtracaoOpenAi, type EntradaExtracao, type ContextoServidorOpenAi, type OpcoesOpenAi, type ResultadoExtracao } from "./index.js";
import type { EvidenciaExtracaoLlm, Executor, ResultadoValidacaoExtracaoLlm } from "../../gateway/gateway.js";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function criarRuntimeExtracaoLlm(opcoes: OpcoesOpenAi = {}) {
  const env = opcoes.env ?? process.env;
  const extrator = criarExtratorOpenAi(opcoes);
  type Preparacao = { evidencia: EvidenciaExtracaoLlm; entrada: EntradaExtracao; contexto: ContextoServidorOpenAi; atual: () => boolean };
  const fontes = new Map<string, Preparacao>(); const resultados = new Map<string, ResultadoExtracao>();
  const preparar = (chave: string, entrada: EntradaExtracao, contexto: ContextoServidorOpenAi, versao: number, atual: () => boolean) => {
    const capacidade = extrator.status(); if (capacidade.status !== "DISPONIVEL") return { status: "PENDENTE" as const, codigo: capacidade.codigo };
    const p = prepararPayloadExtracaoOpenAi(entrada, contexto, env.ONCOASSIST_OPENAI_MODEL ?? "");
    if (p.status !== "PRONTO") return p;
    const existente = fontes.get(chave);
    if (existente && (existente.evidencia.payload !== p.payload || existente.evidencia.fonte.hash !== p.fonteHash
      || JSON.stringify(existente.entrada.correlacao) !== JSON.stringify(entrada.correlacao)))
      return { status: "PENDENTE" as const, codigo: "CHAVE_REUSADA_PAYLOAD_DIFERENTE" };
    const evidencia: EvidenciaExtracaoLlm = { modo: "DESIDENTIFICADO", origem: "UPLOAD_LOCAL_EXPLICITO", destino: "https://api.openai.com/v1/responses",
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
  const executor: Executor = { async executar(intent, _ordinaria, prova) {
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
  return { status: extrator.status, preparar, validarExtracaoLlm, executor,
    resultado: (chave: string) => resultados.get(chave),
    descartar: (chave: string) => { fontes.delete(chave); resultados.delete(chave); } };
}
