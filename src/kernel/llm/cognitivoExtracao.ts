import { createHash } from "node:crypto";
import { ZodError } from "zod";
import { POLITICA_COGNITIVA_EXTRACAO, RelatorioCognitivoExtracaoSchema, type RelatorioCognitivoExtracao } from "../../contracts/cognitivoExtracao.js";
import type { FonteOriginalPreservada } from "../../contracts/harnessRuntime.js";
import type { ConhecimentoBrain } from "../../contracts/conhecimentoBrain.js";
import { verificarPropostaNoHarnessRuntime } from "../harness/runtime.js";
import { produzirPropostaBrainOs, type CandidatoExtracaoBrainOs, type ReferenciaCandidataBrainOs } from "./brainOs.js";
import type { ResultadoExtracao } from "./openai/index.js";

const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

/** Adaptador local: o resultado do modelo é uma alegação, e a fonte vem do servidor. */
export function avaliarExtracaoCognitiva(input: {
  resultado: Extract<ResultadoExtracao, { status: "PROPOSTA" }>;
  fonte: FonteOriginalPreservada;
  agora: string;
  conhecimento?: ConhecimentoBrain;
  referenciasCandidatas?: readonly ReferenciaCandidataBrainOs[];
  captura?: RelatorioCognitivoExtracao["captura"];
}): RelatorioCognitivoExtracao {
  const base = { schema: "CognitivoExtracao@1", politicaVersao: POLITICA_COGNITIVA_EXTRACAO, criaEventoClinico: false,
    ...(input.conhecimento ? { conhecimento: input.conhecimento } : {}),
    ...(input.captura ? { captura: input.captura } : {}) } as const;
  const naoVerificado = (codigo: Extract<RelatorioCognitivoExtracao, { estado: "NAO_VERIFICADO" }>["codigo"]): RelatorioCognitivoExtracao =>
    ({ ...base, estado: "NAO_VERIFICADO", codigo });
  const { resultado, fonte } = input;
  const candidatos: CandidatoExtracaoBrainOs[] = resultado.candidatos.map(c => ({
    // LAB/IMAGEM são categorias; não agrupá-las como se fossem um único campo clínico.
    campo: `${c.campo}:${sha(c.id).slice(0, 24)}`, valor: c.valor, unidade: c.unidade,
    sourceId: fonte.sourceId, trecho: c.referencia.trecho, localizador: fonte.localizadores?.[c.referencia.pagina - 1]?.localizador ?? null,
  }));
  for (const [indice, bloco] of resultado.resumo.entries()) {
    for (const ref of bloco.referencias) candidatos.push({ campo: `RESUMO:${indice}`, valor: bloco.texto,
      sourceId: fonte.sourceId, trecho: ref.trecho, localizador: fonte.localizadores?.[ref.pagina - 1]?.localizador ?? null });
  }
  if (!candidatos.length) return naoVerificado("SEM_ALEGACOES");
  // Texto redigido/desidentificado não pode servir de original para validar a si próprio.
  if (!fonte.conteudoOriginal || candidatos.some(c => !c.trecho.trim() || !fonte.conteudoOriginal!.includes(c.trecho)))
    return naoVerificado("CITACAO_NAO_LITERAL_NA_FONTE_ORIGINAL");
  try {
    const proposta = produzirPropostaBrainOs({
      propostaId: `brain:${sha(resultado.correlacao.operationId)}`,
      patientId: resultado.correlacao.patientId, encounterId: resultado.correlacao.encounterId, agora: input.agora,
      fontes: [{ sourceId: fonte.sourceId, versao: fonte.versao, conteudo: fonte.conteudoOriginal }], candidatos,
      referenciasCandidatas: input.referenciasCandidatas ?? [],
    });
    const harness = verificarPropostaNoHarnessRuntime({ proposta, fontesOriginais: [fonte] });
    return RelatorioCognitivoExtracaoSchema.parse({ ...base, estado: "AVALIADO", proposta, harness });
  } catch (erro) {
    // A resposta original continua no mesmo rascunho, inclusive quando excede o contrato do Brain.
    if (erro instanceof ZodError) return naoVerificado("CONTRATO_COGNITIVO_INCOMPATIVEL");
    throw erro;
  }
}
