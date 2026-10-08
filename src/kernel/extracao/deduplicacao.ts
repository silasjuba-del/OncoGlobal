// F02 · Dedupe documental no pipeline: repetição de entrada não é um novo exame.
// Todas as fontes e todos os fatos continuam presentes. Nenhum vínculo de paciente
// ou decisão clínica é criado pela comparação de textos/identificadores.
import { gerarChaveDedupe, type EntradaExameDedupe } from "../../rules/w8/dedupeExame.js";
import type { ClinicalFact, FactSourceType } from "./tipos.js";
import { normalizarDataCivil } from "./normalizacao.js";

export type IdentidadeExame = Readonly<Pick<EntradaExameDedupe,
  "tipo" | "laboratorio" | "numeroExame" | "dataEntrada" | "servico" | "registro" | "dataExame"> & {
  /** Versão explícita da origem: versões diferentes não são colapsadas. */
  versao?: string;
}>;

export interface FonteParaDedupe {
  readonly recordingId: string;
  readonly sourceId: string;
  readonly sourceType: FactSourceType;
  readonly page?: number;
  readonly rawTranscript: string;
  /** Identidade do exame fornecida pelo importador; nunca inferida da conclusão. */
  readonly examIdentity?: IdentidadeExame;
  /** Contexto declarado da fonte; data clínica ≠ data de importação/impressão. */
  readonly contexto?: Readonly<{ encounterId: string; dataClinica: string }>;
}

export interface ReferenciaFonteDedupe {
  readonly recordingId: string;
  readonly sourceId: string;
  readonly page?: number;
  readonly versao: string | null;
  readonly contexto?: Readonly<{ encounterId: string; dataClinica: string }>;
}

export interface RepeticaoDocumental {
  /** D-W8-01: motor de dedupe ainda é proposta, nunca descarte/merge automático. */
  readonly estado: "PENDENTE_REVISAO";
  readonly chaveExame: string;
  readonly fontes: readonly ReferenciaFonteDedupe[];
  /** Fatos preservados em `ExtractionState.facts`; apenas os IDs se repetem logicamente. */
  readonly fatoPrincipalIds: readonly string[];
  readonly fatoRepetidoIds: readonly string[];
}

export interface VersoesDiscordantes {
  readonly chaveExame: string;
  readonly fontes: readonly ReferenciaFonteDedupe[];
  readonly factIds: readonly string[];
}

export interface ResultadoDeduplicacao {
  readonly repeticoes: readonly RepeticaoDocumental[];
  readonly versoesDiscordantes: readonly VersoesDiscordantes[];
  readonly fatoRepetidoIds: readonly string[];
}

function chaveExame(fonte: FonteParaDedupe): string {
  const exame = fonte.examIdentity;
  const presente = (valor: string | null | undefined): valor is string =>
    typeof valor === "string" && valor.trim().length > 0;
  if (exame?.tipo === "PATOLOGIA_IHQ" && fonte.sourceType === "pathology"
    && presente(exame.laboratorio) && presente(exame.numeroExame)) {
    const data = normalizarDataCivil(exame.dataEntrada);
    if (data) {
      return gerarChaveDedupe({ id: fonte.recordingId, tipo: exame.tipo,
        laboratorio: exame.laboratorio, numeroExame: exame.numeroExame, dataEntrada: data });
    }
  }
  if (exame?.tipo === "IMAGEM" && fonte.sourceType === "imaging_report"
    && presente(exame.servico) && presente(exame.registro)) {
    const data = normalizarDataCivil(exame.dataExame);
    if (data) {
      return gerarChaveDedupe({ id: fonte.recordingId, tipo: exame.tipo,
        servico: exame.servico, registro: exame.registro, dataExame: data });
    }
  }
  // Identidade incompleta NÃO vira chave "NULO:NULO:NULO" do motor legado.
  // Mesmo sourceId + página só é comparável no mesmo encontro/data clínica.
  const contexto = fonte.contexto;
  const data = contexto ? normalizarDataCivil(contexto.dataClinica) : null;
  if (contexto && (!contexto.encounterId.trim() || !data)) {
    return `SEM_CHAVE:${fonte.recordingId}`;
  }
  return `MESMA_FONTE:${JSON.stringify([
    fonte.sourceType, fonte.sourceId, fonte.page ?? null,
    contexto?.encounterId.trim() ?? null, data,
  ])}`;
}

function referencia(fonte: FonteParaDedupe): ReferenciaFonteDedupe {
  return {
    recordingId: fonte.recordingId, sourceId: fonte.sourceId,
    ...(fonte.page === undefined ? {} : { page: fonte.page }),
    versao: fonte.examIdentity?.versao?.trim() || null,
    ...(fonte.contexto === undefined ? {} : { contexto: fonte.contexto }),
  };
}

function assinaturaDoFato(fato: ClinicalFact): string {
  // IDs, timestamp de captura, fonte e página não são valores clínicos.
  // RawEvidence e data clínica são: não igualar uma conclusão discordante ou
  // de outra data. A versão documental é comparada separadamente.
  return JSON.stringify({
    domain: fato.domain, value: fato.value, raw: fato.raw ?? null,
    rawEvidence: fato.rawEvidence, date: fato.date ?? null, evidence: fato.evidence,
    confidence: fato.confidence, requiresConfirmation: fato.requiresConfirmation,
    regra: fato.regra ?? null,
  });
}

function conteudoSemCabecalhoDeImpressao(texto: string): string {
  // Somente uma linha que contém EXCLUSIVAMENTE carimbo de impressão pode
  // variar. Texto clínico ainda não reconhecido pelo extrator é comparado
  // literalmente: achados discordantes jamais viram "mesmo laudo".
  const carimbo = /^\s*(?:reimpresso|impresso)\s+em\s+\d{1,2}\/\d{1,2}\/\d{2,4}(?:\s+\d{1,2}:\d{2})?(?:\s*\(extra[cç][aã]o\s+\d{1,2}\/\d{1,2}\/\d{2,4}\))?\s*$/iu;
  return texto.replace(/\r\n/g, "\n").split("\n")
    .filter((linha) => !carimbo.test(linha)).join("\n").trim();
}

/** Propõe repetição com chave completa + conteúdo igual; nunca apaga fatos/versões. */
export function deduplicarFatos(
  fatos: readonly ClinicalFact[],
  fontes: readonly FonteParaDedupe[],
): ResultadoDeduplicacao {
  const porChave = new Map<string, { fonte: FonteParaDedupe; fatos: ClinicalFact[] }[]>();
  for (const fonte of fontes) {
    const relacionados = fatos.filter((f) =>
      f.segmentId.startsWith(`${fonte.recordingId}:`) && f.sourceId === fonte.sourceId);
    const chave = chaveExame(fonte);
    const grupo = porChave.get(chave) ?? [];
    grupo.push({ fonte, fatos: relacionados });
    porChave.set(chave, grupo);
  }

  const repeticoes: RepeticaoDocumental[] = [];
  const versoesDiscordantes: VersoesDiscordantes[] = [];
  const fatoRepetidoIds: string[] = [];
  for (const [chave, documentos] of porChave) {
    if (documentos.length < 2) continue;
    const assinaturas = new Map<string, typeof documentos>();
    for (const documento of documentos) {
      const sinais = documento.fatos.map(assinaturaDoFato).sort();
      const conteudo = JSON.stringify([sinais, conteudoSemCabecalhoDeImpressao(documento.fonte.rawTranscript)]);
      const versao = documento.fonte.examIdentity?.versao?.trim() || null;
      const assinatura = JSON.stringify([versao, conteudo]);
      const grupo = assinaturas.get(assinatura) ?? [];
      grupo.push(documento);
      assinaturas.set(assinatura, grupo);
    }
    for (const grupo of assinaturas.values()) {
      if (grupo.length < 2) continue;
      const primeiro = grupo[0]!.fatos;
      const repetidos = grupo.slice(1).flatMap(({ fatos: duplicados }) => duplicados.map((f) => f.id));
      repeticoes.push({
        estado: "PENDENTE_REVISAO",
        chaveExame: chave,
        fontes: grupo.map(({ fonte }) => referencia(fonte)),
        fatoPrincipalIds: primeiro.map((f) => f.id),
        fatoRepetidoIds: repetidos,
      });
      fatoRepetidoIds.push(...repetidos);
    }
    if (assinaturas.size > 1) {
      versoesDiscordantes.push({
        chaveExame: chave, fontes: documentos.map(({ fonte }) => referencia(fonte)),
        factIds: documentos.flatMap(({ fatos: doDocumento }) => doDocumento.map((f) => f.id)),
      });
    }
  }
  return { repeticoes, versoesDiscordantes, fatoRepetidoIds };
}
