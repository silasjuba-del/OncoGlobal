import type { StudySource } from "./tipos.js";

export const studyExtractionPrompt = `Converta a documentação fornecida em um CANDIDATO local de estudo clínico, sem concluir elegibilidade.
Extraia apenas: identificador/registro, título, descrição, braços, critérios de inclusão, critérios de exclusão e desfechos.
Para cada campo, anexe fonte, localizador e trecho literal exato. Preserve negações, qualificadores, datas, unidades, grupos AND/OR e incertezas.
Não infira critérios, não converta prosa livre em expressão lógica, não complete ausências, não corrija conflitos e não estime dados.
PDF, imagem e DOCX são anexos binários: não alegue OCR ou leitura se o texto não foi fornecido.
Saída é rascunho sem autoridade; revisão médica explícita, versionada e vinculada ao hash da fonte é obrigatória.
Nunca use dados identificáveis de pacientes, rede, ferramentas externas, ou declare alguém elegível. O único resultado futuro permitido é POSSIBLE_MATCH, PENDENTE ou SEM_MATCH.`;

export interface StudyExtractor {
  extract(input: { prompt: string; source: StudySource }): Promise<unknown>;
}
export type ExtractorDraftResult = { status: "DISABLED"; reason: "NO_ADAPTER" | "LOCAL_DEIDENTIFICATION_GATE_UNAVAILABLE" };

/**
 * O arquivo-fonte pode conter PHI. Até existir o gate local de desidentificação validado, esta porta não
 * invoca adaptadores injetados e não passa conteúdo, nome, referência ou localizador a qualquer modelo.
 */
export async function extractStudyDraft(source: StudySource, candidateId: string, adapter?: StudyExtractor): Promise<ExtractorDraftResult> {
  void source; void candidateId;
  return { status: "DISABLED", reason: adapter ? "LOCAL_DEIDENTIFICATION_GATE_UNAVAILABLE" : "NO_ADAPTER" };
}
