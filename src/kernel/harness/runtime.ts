import { createHash } from "node:crypto";
import {
  VereditoHarnessRuntimeSchema,
  type FonteOriginalPreservada,
  type ItemVerificadoHarness,
  type ManifestacaoHarnessRuntime,
  type VereditoHarnessRuntime,
} from "../../contracts/harnessRuntime.js";
import { confrontarNomeIdentificador } from "../../rules/w8/vinculoDocumento.js";

const sha256 = (texto: string): string => createHash("sha256").update(texto, "utf8").digest("hex");

export interface CitacaoPropostaSobTeste {
  sourceId: string;
  versao: string;
  contentHash: string;
  trecho: string;
  localizador?: string | null;
}

export interface ItemPropostaSobTeste {
  itemId: string;
  campo: string;
  valorProposto: string | number;
  unidade?: string | null;
  qualificador: "AFIRMADO" | "NEGADO" | "INCERTO" | "HISTORICO" | "TERCEIRO";
  criticoNumero?: boolean;
  validado?: boolean;
  requerConfirmacaoMedica?: boolean;
  citacoes: readonly CitacaoPropostaSobTeste[];
}

export interface PropostaSobTeste {
  propostaId: string;
  patientId?: string | null;
  encounterId?: string | null;
  itensPropostos: readonly ItemPropostaSobTeste[];
  ambiguidades?: readonly {
    campo: string;
    motivo: string;
    candidatos: readonly { valor: string | number; citacao: CitacaoPropostaSobTeste }[];
    valorEscolhido?: unknown;
  }[];
  lacunas?: readonly {
    campo: string;
    obrigatoriedade: "CRITICA" | "RELEVANTE";
    motivo: string;
  }[];
}

export interface EntradaHarnessRuntime {
  proposta: PropostaSobTeste;
  fontesOriginais: readonly FonteOriginalPreservada[];
  camposCriticosObrigatorios?: readonly string[];
}

const temNegacao = (texto: string): boolean => /\b(?:nega|negou|sem\s+evidencia|ausencia\s+de|negativo\s+para|nao\s+(?:apresenta|ha|tem|refere)|sem\s+sinais\s+de)\b/iu
  .test(texto.normalize("NFD").replace(/\p{Diacritic}/gu, ""));

function qualificadorDeterministicoDoTrecho(
  trecho: string,
): "AFIRMADO" | "NEGADO" | "INCERTO" | "HISTORICO" | "TERCEIRO" {
  if (/\b(?:mae|mãe|pai|irm[aã]o?|tia|av[oó]|familiar)\b/iu.test(trecho)) return "TERCEIRO";
  if (temNegacao(trecho)) {
    return "NEGADO";
  }
  if (/\b(?:hip[oó]tese|suspeita|poss[ií]vel|duvidoso|interrogad[oa]|a\s+esclarecer|prov[aá]vel)\b/iu.test(trecho)) {
    return "INCERTO";
  }
  if (/\b(?:hist[oó]rico\s+pr[eé]vio|previamente|em\s+201\d|passado)\b/iu.test(trecho)) {
    return "HISTORICO";
  }
  return "AFIRMADO";
}

/** A citação pode cortar uma negação; conferir todas as ocorrências no contexto preservado. */
function qualificadoresNaFonte(texto: string, trecho: string): Set<ReturnType<typeof qualificadorDeterministicoDoTrecho>> {
  const resultado = new Set<ReturnType<typeof qualificadorDeterministicoDoTrecho>>();
  const limite = (i: number) => /[\n\r;!?]/.test(texto[i] ?? "")
    || texto[i] === "." && !( /\d/.test(texto[i - 1] ?? "") && /\d/.test(texto[i + 1] ?? ""));
  for (let pos = texto.indexOf(trecho); pos !== -1; pos = texto.indexOf(trecho, pos + 1)) {
    let inicio = pos, fim = pos + trecho.length;
    while (inicio > 0 && !limite(inicio - 1)) inicio--;
    // Se o próprio trecho já termina uma sentença, não anexar a próxima.
    if (!limite(fim - 1)) while (fim < texto.length && !limite(fim)) fim++;
    const contexto = texto.slice(inicio, fim);
    resultado.add(qualificadorDeterministicoDoTrecho(contexto));
    const bordasOmitidas = texto.slice(inicio, pos) + texto.slice(pos + trecho.length, fim);
    if (/(?<!\d),(?!\d)|\b(?:mas|porem|porém|contudo)\b/iu.test(bordasOmitidas)) {
      // Não há prova de que a polaridade atravessa uma fronteira de oração/lista.
      resultado.add(qualificadorDeterministicoDoTrecho(trecho));
    }
    // O enum singular não representa simultaneamente sujeito terceiro e polaridade.
    // Expor a incompatibilidade em vez de atestar que uma dimensão preserva a outra.
    if (temNegacao(contexto)) resultado.add("NEGADO");
  }
  return resultado;
}

function verificarValorContraTrechoOriginal(valorProposto: string | number, unidade: string | null | undefined, trecho: string): boolean {
  const valorLimpo = String(valorProposto).trim();
  if (!valorLimpo) return false;
  const numerico = typeof valorProposto === "number" || /^[+-]?\d+(?:[.,]\d+)?$/.test(valorLimpo);
  const unidadeLimpa = unidade?.trim().toLocaleLowerCase("pt-BR");
  if (numerico) {
    const numero = Number(valorLimpo.replace(",", "."));
    // Consumir o token completo evita que 1.000.000 ou 1e3 sustentem o valor 1.
    // Não inferir conversão de unidade, expoente ou separador de milhar.
    return [...trecho.matchAll(/(?<![\p{L}\p{N}])[-+]?\d+(?:[.,]\d+)*(?:[eE][-+]?\d+)?/gu)].some(m => {
      if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(m[0])) return false;
      if (/^[+-]?[1-9]\d{0,2}\.\d{3}$/.test(m[0])) return false;
      if (!Number.isFinite(numero) || Number(m[0].replace(",", ".")) !== numero) return false;
      const depois = trecho.slice(m.index! + m[0].length);
      const unidadeLocal = /^\s*([\p{L}µμ°%/][\p{L}\p{N}µμ°%/^³²·]*)/u.exec(depois)?.[1];
      if (!unidadeLimpa) return !unidadeLocal || !/^(?:mg|g|kg|mcg|µg|μg|ng|ml|dl|l|mm|cm|m|ui|u|mmol|mol|meq|%|°c)(?:$|\/)/iu.test(unidadeLocal);
      return unidadeLocal?.toLocaleLowerCase("pt-BR") === unidadeLimpa;
    });
  }
  if (!trecho.toLocaleLowerCase("pt-BR").includes(valorLimpo.toLocaleLowerCase("pt-BR"))) return false;
  if (unidadeLimpa) {
    const tokens = trecho.match(/[\p{L}µμ°%/][\p{L}\p{N}µμ°%/^³²·]*/gu) ?? [];
    if (!tokens.some(t => t.toLocaleLowerCase("pt-BR") === unidadeLimpa)) return false;
  }
  return true;
}

function extrairIdentidadeDocumental(texto: string): {
  nomeDocumento: string | null;
  identificador: { tipo: "CPF" | "CNS"; valor: string } | null;
  trecho: string | null;
} {
  const nomeMatch = texto.match(/^\s*(?:nome\s+do\s+paciente|paciente|nome)\s*[:\-]\s*([^\r\n]{2,120})/im);
  const idMatch = texto.match(/(?:\bCPF\b\s*[:\-]?\s*([\d.\-/ ]{11,18})|\bCNS\b\s*[:\-]?\s*([\d.\-/ ]{15,24}))/i);
  const rawId = idMatch?.[1] ?? idMatch?.[2] ?? null;
  const identificador = rawId ? { tipo: idMatch?.[1] ? "CPF" as const : "CNS" as const, valor: rawId.trim() } : null;
  const trecho = nomeMatch?.[0]?.trim() ?? (idMatch?.[0]?.trim() ?? null);
  return { nomeDocumento: nomeMatch?.[1]?.trim() ?? null, identificador, trecho };
}

/**
 * HARNESS DE RUNTIME:
 * - Recebe a proposta como objeto sob teste; nunca a trata como fonte de verdade.
 * - Reconfere citações e qualificadores contra a fonte original preservada.
 * - Executa verificações determinísticas independentes da normalização do BRAIN.
 * - Para áudio, não declara acurácia sem conferência do trecho original; números críticos
 *   ficam não validados e destacados para escuta/revisão humana.
 * - Se a fonte não permitir verificação independente, registra cobertura não verificada.
 * - Manifesta conflito, ambiguidade, omissão crítica ou falha de identidade; não corrige
 *   silenciosamente nem toma decisão clínica.
 */
export function verificarPropostaNoHarnessRuntime(entrada: EntradaHarnessRuntime): VereditoHarnessRuntime {
  const { proposta, fontesOriginais, camposCriticosObrigatorios = [] } = entrada;
  const mapaFontes = new Map<string, FonteOriginalPreservada>();
  const fontesNaoVerificaveis: { sourceId: string; motivo: string }[] = [];
  const manifestacoes: ManifestacaoHarnessRuntime[] = [];

  for (const fonte of fontesOriginais) {
    if (mapaFontes.has(fonte.sourceId)) {
      fontesNaoVerificaveis.push({ sourceId: fonte.sourceId, motivo: "Identificador de fonte duplicado; nenhuma versão foi escolhida silenciosamente." });
      manifestacoes.push({ tipo: "CITACAO_NAO_SUSTENTADA", campo: "sourceId", sourceId: fonte.sourceId,
        detalhe: "Identificador de fonte duplicado impede resolução inequívoca das citações.", trechoOriginal: null });
      continue;
    }
    mapaFontes.set(fonte.sourceId, fonte);
    if (fonte.identidadeEsperadaPaciente && proposta.patientId !== fonte.identidadeEsperadaPaciente.patientId) {
      fontesNaoVerificaveis.push({
        sourceId: fonte.sourceId,
        motivo: "Identidade da proposta não coincide com o paciente vinculado à fonte.",
      });
      manifestacoes.push({
        tipo: "FALHA_IDENTIDADE",
        campo: "patientIdentity",
        sourceId: fonte.sourceId,
        detalhe: "Paciente da proposta diverge do cadastro vinculado à fonte original.",
        trechoOriginal: null,
      });
      continue;
    }
    if (!fonte.conteudoOriginal || !fonte.conteudoOriginal.trim() || !fonte.contentHash) {
      fontesNaoVerificaveis.push({
        sourceId: fonte.sourceId,
        motivo: "Fonte original sem texto/bytes íntegros ou sem hash para verificação independente.",
      });
      continue;
    }
    if (sha256(fonte.conteudoOriginal) !== fonte.contentHash) {
      fontesNaoVerificaveis.push({
        sourceId: fonte.sourceId,
        motivo: "Hash da fonte original preservada diverge do conteúdo em verificação.",
      });
      continue;
    }
    if (fonte.identidadeEsperadaPaciente) {
      if (proposta.patientId !== fonte.identidadeEsperadaPaciente.patientId) {
        manifestacoes.push({ tipo: "FALHA_IDENTIDADE", campo: "patientId", sourceId: fonte.sourceId,
          detalhe: "Paciente da proposta não corresponde ao paciente esperado da fonte preservada.", trechoOriginal: null });
      }
      const evidencia = extrairIdentidadeDocumental(fonte.conteudoOriginal);
      if (!evidencia.identificador) {
        manifestacoes.push({ tipo: "AMBIGUIDADE", campo: "patientIdentity", sourceId: fonte.sourceId,
          detalhe: "Fonte sem identificador documental; nome isolado não comprova vínculo com o paciente da proposta.", trechoOriginal: evidencia.trecho });
      }
      if (evidencia.nomeDocumento || evidencia.identificador) {
        const confronto = confrontarNomeIdentificador({
          nomeDocumento: evidencia.nomeDocumento,
          identificador: evidencia.identificador,
          cadastroNome: fonte.identidadeEsperadaPaciente.nome,
          cadastroIdentificadores: fonte.identidadeEsperadaPaciente.identificadores,
        });
        if (!confronto.liga) {
          manifestacoes.push({
            tipo: "FALHA_IDENTIDADE",
            campo: "patientIdentity",
            sourceId: fonte.sourceId,
            detalhe: `Identidade na fonte (${confronto.motivo}) diverge do paciente esperado (${fonte.identidadeEsperadaPaciente.patientId}).`,
            trechoOriginal: evidencia.trecho,
          });
        }
      }
    }
  }

  const idsNaoVerificaveis = new Set(fontesNaoVerificaveis.map((f) => f.sourceId));
  const itensVerificados: ItemVerificadoHarness[] = [];
  const valoresPorCampo = new Map<string, { valor: string; sourceId: string; trecho: string }[]>();

  for (const item of proposta.itensPropostos) {
    const criticoNumero = item.criticoNumero === true || typeof item.valorProposto === "number" || /\d/.test(String(item.valorProposto));
    const usaAudio = item.citacoes.some((c) => mapaFontes.get(c.sourceId)?.modalidade === "AUDIO");

    if (item.validado === true || item.requerConfirmacaoMedica === false) {
      manifestacoes.push({
        tipo: "VALOR_CRITICO_PRE_VALIDADO",
        campo: item.campo,
        sourceId: item.citacoes[0]?.sourceId ?? null,
        detalhe: `Proposta tentou entregar '${item.campo}' pré-validado sem confirmação médica autorizada.`,
        trechoOriginal: item.citacoes[0]?.trecho ?? null,
      });
    }

    let citacaoSustentada = item.citacoes.length > 0;
    let qualificadorDet: "AFIRMADO" | "NEGADO" | "INCERTO" | "HISTORICO" | "TERCEIRO" | null = null;
    const qualificadoresEncontrados = new Set<ReturnType<typeof qualificadorDeterministicoDoTrecho>>();
    let verificacaoIndependenteOk = true;

    if (item.citacoes.length === 0) {
      manifestacoes.push({
        tipo: "CITACAO_NAO_SUSTENTADA",
        campo: item.campo,
        sourceId: null,
        detalhe: "Item proposto sem citação para verificação independente.",
        trechoOriginal: null,
      });
    }

    for (const citacao of item.citacoes) {
      const fonte = mapaFontes.get(citacao.sourceId);
      if (!fonte || idsNaoVerificaveis.has(citacao.sourceId) || !fonte.conteudoOriginal) {
        citacaoSustentada = false;
        verificacaoIndependenteOk = false;
        manifestacoes.push({
          tipo: "CITACAO_NAO_SUSTENTADA",
          campo: item.campo,
          sourceId: citacao.sourceId,
          detalhe: `A fonte citada para '${item.campo}' não está disponível para verificação independente.`,
          trechoOriginal: citacao.trecho,
        });
        if (fonte && !idsNaoVerificaveis.has(citacao.sourceId)) {
          fontesNaoVerificaveis.push({
            sourceId: citacao.sourceId,
            motivo: "Fonte referenciada na citação não permite verificação independente.",
          });
          idsNaoVerificaveis.add(citacao.sourceId);
        }
        continue;
      }
      if (!citacao.trecho.trim() || fonte.versao !== citacao.versao || fonte.contentHash !== citacao.contentHash || !fonte.conteudoOriginal.includes(citacao.trecho)) {
        citacaoSustentada = false;
        verificacaoIndependenteOk = false;
        manifestacoes.push({
          tipo: "CITACAO_NAO_SUSTENTADA",
          campo: item.campo,
          sourceId: citacao.sourceId,
          detalhe: `Trecho citado para '${item.campo}' não consta literalmente ou tem hash/versão divergente na fonte original.`,
          trechoOriginal: citacao.trecho,
        });
        continue;
      }

      if (citacao.localizador) {
        const localizados = fonte.localizadores?.filter(l => l.localizador === citacao.localizador) ?? [];
        if (localizados.length !== 1 || !fonte.conteudoOriginal.includes(localizados[0]!.trecho)
          || !localizados[0]!.trecho.includes(citacao.trecho)) {
          citacaoSustentada = false;
          verificacaoIndependenteOk = false;
          manifestacoes.push({ tipo: "CITACAO_NAO_SUSTENTADA", campo: item.campo, sourceId: citacao.sourceId,
            detalhe: "Localizador citado não foi comprovado no mapa da fonte original preservada.", trechoOriginal: citacao.trecho });
          continue;
        }
      }

      const qualificadores = qualificadoresNaFonte(fonte.conteudoOriginal, citacao.trecho);
      for (const q of qualificadores) qualificadoresEncontrados.add(q);
      const qTrecho = qualificadores.size === 1 ? [...qualificadores][0]! : null;
      if (qTrecho === null || qTrecho !== item.qualificador) {
        verificacaoIndependenteOk = false;
        manifestacoes.push({
          tipo: "QUALIFICADOR_DIVERGENTE",
          campo: item.campo,
          sourceId: citacao.sourceId,
          detalhe: `Qualificador proposto (${item.qualificador}) diverge do contexto original (${[...qualificadores].join(" / ")}); nenhuma ocorrência foi escolhida silenciosamente.`,
          trechoOriginal: citacao.trecho,
        });
      }

      if (!verificarValorContraTrechoOriginal(item.valorProposto, item.unidade, citacao.trecho)) {
        verificacaoIndependenteOk = false;
        manifestacoes.push({
          tipo: "NORMALIZACAO_DIVERGENTE",
          campo: item.campo,
          sourceId: citacao.sourceId,
          detalhe: `Valor ou unidade normalizados pelo BRAIN (${String(item.valorProposto)}${item.unidade ? ` ${item.unidade}` : ""}) não foram confirmados deterministicamente no trecho original.`,
          trechoOriginal: citacao.trecho,
        });
      }

      const listaCampo = valoresPorCampo.get(item.campo) ?? [];
      listaCampo.push({
        valor: `${String(item.valorProposto).trim().toLocaleLowerCase("pt-BR")}|${item.unidade ?? ""}|${qTrecho}`,
        sourceId: citacao.sourceId,
        trecho: citacao.trecho,
      });
      valoresPorCampo.set(item.campo, listaCampo);
    }

    qualificadorDet = qualificadoresEncontrados.size === 1 ? [...qualificadoresEncontrados][0]! : null;
    const qualificadorConfere = qualificadorDet !== null && qualificadorDet === item.qualificador;
    itensVerificados.push({
      itemId: item.itemId,
      campo: item.campo,
      valorSubmetido: item.valorProposto,
      citacaoSustentadaNaFonte: citacaoSustentada,
      qualificadorSubmetido: item.qualificador,
      qualificadorDeterministico: qualificadorDet,
      qualificadorConfere,
      verificacaoDeterministicaIndependenteOk: citacaoSustentada && qualificadorConfere && verificacaoIndependenteOk,
      criticoNumero,
      modalidadeAudio: usaAudio,
      validado: false,
      destacadoParaEscutaRevisaoHumana: usaAudio && criticoNumero ? true : criticoNumero,
    });
  }

  // Conflitos entre itens propostos para o mesmo campo
  for (const [campo, ocorrencias] of valoresPorCampo.entries()) {
    const distintos = new Set(ocorrencias.map((o) => o.valor));
    if (distintos.size > 1) {
      manifestacoes.push({
        tipo: "CONFLITO",
        campo,
        sourceId: ocorrencias[0]?.sourceId ?? null,
        detalhe: `Conflito detectado entre múltiplas proposições para '${campo}'; nenhuma correção silenciosa aplicada.`,
        trechoOriginal: ocorrencias.map((o) => o.trecho).join(" | "),
      });
    }
  }

  // Ambiguidades declaradas na proposta permanecem manifestadas para o médico
  for (const amb of proposta.ambiguidades ?? []) {
    if (amb.valorEscolhido !== undefined && amb.valorEscolhido !== null) {
      manifestacoes.push({
        tipo: "CONFLITO",
        campo: amb.campo,
        sourceId: amb.candidatos[0]?.citacao.sourceId ?? null,
        detalhe: `Ambiguidade em '${amb.campo}' trouxe valor pré-escolhido; bloqueado contra escolha silenciosa.`,
        trechoOriginal: amb.candidatos[0]?.citacao.trecho ?? null,
      });
    }
    manifestacoes.push({
      tipo: "AMBIGUIDADE",
      campo: amb.campo,
      sourceId: amb.candidatos[0]?.citacao.sourceId ?? null,
      detalhe: amb.motivo,
      trechoOriginal: amb.candidatos.map((c) => c.citacao.trecho).join(" | "),
    });
  }

  // Omissões críticas (declaradas em lacunas ou detectadas deterministicamente contra camposCriticosObrigatorios)
  const camposCobertos = new Set([
    ...itensVerificados.filter((i) => i.verificacaoDeterministicaIndependenteOk).map((i) => i.campo),
  ]);
  const lacunasCriticas = new Set<string>();
  for (const lacuna of proposta.lacunas ?? []) {
    if (lacuna.obrigatoriedade === "CRITICA") {
      lacunasCriticas.add(lacuna.campo);
      manifestacoes.push({
        tipo: "OMISSAO_CRITICA",
        campo: lacuna.campo,
        sourceId: null,
        detalhe: lacuna.motivo,
        trechoOriginal: null,
      });
    }
  }
  for (const campoCritico of camposCriticosObrigatorios) {
    if (!camposCobertos.has(campoCritico) && !lacunasCriticas.has(campoCritico)) {
      manifestacoes.push({
        tipo: "OMISSAO_CRITICA",
        campo: campoCritico,
        sourceId: null,
        detalhe: `Campo crítico '${campoCritico}' ausente ou sem verificação determinística independente.`,
        trechoOriginal: null,
      });
    }
  }

  // Para áudio: nunca declara acurácia sem conferência humana do trecho original
  const fontesAudio = fontesOriginais.filter((f) => f.modalidade === "AUDIO");
  const acuraciaAudioDeclarada = fontesAudio.length > 0
    && fontesAudio.every((f) => f.trechoAudioConferidoHumano === true && !idsNaoVerificaveis.has(f.sourceId));

  const fontesVerificaveis = [...mapaFontes.keys()].filter(id => !idsNaoVerificaveis.has(id)).length;
  const cobertura = fontesVerificaveis === 0
    ? "COBERTURA_NAO_VERIFICADA" as const
    : fontesNaoVerificaveis.length > 0
      ? "PARCIALMENTE_VERIFICADA" as const
      : "VERIFICADA" as const;

  const temFalhaCritica = manifestacoes.some((m) =>
    m.tipo === "FALHA_IDENTIDADE" ||
    m.tipo === "CITACAO_NAO_SUSTENTADA" ||
    m.tipo === "QUALIFICADOR_DIVERGENTE" ||
    m.tipo === "NORMALIZACAO_DIVERGENTE" ||
    m.tipo === "VALOR_CRITICO_PRE_VALIDADO",
  );

  const status = temFalhaCritica || cobertura === "COBERTURA_NAO_VERIFICADA"
    ? "BLOQUEADO_FALHA_CRITICA" as const
    : manifestacoes.length > 0 || cobertura === "PARCIALMENTE_VERIFICADA"
      ? "REQUER_RESOLUCAO_MEDICA" as const
      : "APTO_PARA_REVISAO_HUMANA" as const;

  return VereditoHarnessRuntimeSchema.parse({
    schema: "HarnessRuntimeVeredito@1",
    propostaId: proposta.propostaId,
    tratadaComoFonteDeVerdade: false,
    corrigidoSilenciosamente: false,
    decisaoClinicaTomada: false,
    cobertura,
    fontesNaoVerificaveis,
    acuraciaAudioDeclarada,
    status,
    itensVerificados,
    manifestacoes,
  });
}
