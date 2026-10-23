import { createHash } from "node:crypto";
import { hashTestCongeladoPinado } from "./pinsTestCongelado.js";
import {
  CLASSES_ERRO_ORDEM,
  intervaloWilson95,
} from "./avaliacaoEstatistica.js";
import {
  RelatorioHarnessAvaliacaoSchema,
  type ClasseErroAvaliacao,
  type MetricaClasseErro,
  type RelatorioHarnessAvaliacao,
  type ViolacaoFatalAvaliacao,
} from "../../contracts/harnessAvaliacao.js";

const sha256 = (texto: string): string => createHash("sha256").update(texto, "utf8").digest("hex");

export interface ItemExtraidoSobAvaliacao {
  campo: string;
  valor: string | number;
  patientIdAtribuido: string;
  qualificador: "AFIRMADO" | "NEGADO" | "INCERTO" | "HISTORICO" | "TERCEIRO";
  criticoNumero: boolean;
  preValidadoSemConfirmacao: boolean;
  citacaoSustentada: boolean;
}

export interface SaidaCasoAvaliacao {
  alertasEmitidos: readonly string[];
  conflitosManifestados: readonly string[];
  omissoesCriticasManifestadas: readonly string[];
  itensExtraidos: readonly ItemExtraidoSobAvaliacao[];
}

export interface CasoSinteticoAvaliacao {
  casoId: string;
  versaoControle: string;
  sinteticoDeclarado: boolean;
  split: "dev" | "test_congelado";
  patientIdEsperado: string;
  controlePositivo?: {
    controleId: string;
    classeAlvo: ClasseErroAvaliacao;
    alertaEsperado: string;
  } | null;
  expectativas?: {
    qualificadoresEsperados?: Readonly<Record<string, "AFIRMADO" | "NEGADO" | "INCERTO" | "HISTORICO" | "TERCEIRO">>;
    conflitosEsperados?: readonly string[];
    omissoesCriticasEsperadas?: readonly string[];
  };
  saidaObservada: SaidaCasoAvaliacao;
}

export interface EntradaHarnessAvaliacao {
  versaoSuite: string;
  versaoControlesPositivos: string;
  finalidadeExecucao: "AVALIACAO" | "CALIBRACAO" | "AJUSTE";
  tipoSujeito: "STUB" | "EXTRATOR";
  declararComoAvaliacaoExtrator?: boolean;
  hashTestCongeladoEsperado?: string;
  casos: readonly CasoSinteticoAvaliacao[];
}

export function calcularHashTestCongelado(casos: readonly CasoSinteticoAvaliacao[]): string {
  const congelados = casos
    .filter((c) => c.split === "test_congelado")
    .map((c) => ({
      casoId: c.casoId,
      versaoControle: c.versaoControle,
      patientIdEsperado: c.patientIdEsperado,
      controlePositivo: c.controlePositivo ?? null,
      expectativas: c.expectativas ?? null,
    }))
    .sort((a, b) => a.casoId.localeCompare(b.casoId));
  return sha256(JSON.stringify(congelados));
}

/**
 * HARNESS DE AVALIAÇÃO:
 * - Usa casos sintéticos e controles positivos versionados.
 * - Separa dev de test congelado; o test não pode ser usado para ajuste ou calibração.
 * - Mede cada controle por classe de erro e reporta denominadores e incerteza.
 * - Um stub testa o HARNESS; não pode ser reportado como avaliação do extrator.
 * - Falha fechada em controle positivo silencioso, vazamento entre pacientes ou valor
 *   numérico crítico pré-validado sem confirmação.
 */
export function executarHarnessAvaliacao(entrada: EntradaHarnessAvaliacao): RelatorioHarnessAvaliacao {
  const violacoesFatais: ViolacaoFatalAvaliacao[] = [];

  // 1. Verificação de stub vs extrator real
  if (entrada.tipoSujeito === "STUB" && entrada.declararComoAvaliacaoExtrator === true) {
    violacoesFatais.push({
      codigo: "STUB_REPORTADO_COMO_AVALIACAO_EXTRATOR",
      casoId: null,
      detalhe: "Um stub testa apenas o HARNESS; é proibido reportá-lo como avaliação de prontidão do extrator.",
    });
  }

  // 2. Separação estrita entre dev e test_congelado
  const casosDev = entrada.casos.filter((c) => c.split === "dev");
  const casosTest = entrada.casos.filter((c) => c.split === "test_congelado");
  const hashTestCongelado = calcularHashTestCongelado(entrada.casos);
  const hashConfiavel = hashTestCongeladoPinado(entrada.versaoSuite, entrada.versaoControlesPositivos);
  const testCongeladoIntegro = casosTest.length === 0
    || (hashConfiavel !== null && entrada.hashTestCongeladoEsperado === hashConfiavel
      && hashTestCongelado === hashConfiavel);

  if (!testCongeladoIntegro) {
    violacoesFatais.push({
      codigo: "TEST_CONGELADO_HASH_DIVERGENTE",
      casoId: null,
      detalhe: "Hash esperado ausente, suíte sem pin confiável ou conjunto test_congelado modificado em relação ao hash versionado.",
    });
  }

  if (entrada.finalidadeExecucao !== "AVALIACAO" && casosTest.length > 0) {
    violacoesFatais.push({
      codigo: "TEST_CONGELADO_USADO_PARA_CALIBRACAO",
      casoId: casosTest[0]!.casoId,
      detalhe: `Proibido usar casos do split 'test_congelado' durante '${entrada.finalidadeExecucao}'.`,
    });
  }

  const contadores = new Map<ClasseErroAvaliacao, { erros: number; total: number }>();
  for (const classe of CLASSES_ERRO_ORDEM) {
    contadores.set(classe, { erros: 0, total: 0 });
  }

  const registrarMedicao = (classe: ClasseErroAvaliacao, ocorreuErro: boolean) => {
    const atual = contadores.get(classe)!;
    atual.total += 1;
    if (ocorreuErro) atual.erros += 1;
  };

  for (const caso of entrada.casos) {
    if (!caso.sinteticoDeclarado || !caso.versaoControle.trim()) {
      violacoesFatais.push({
        codigo: "CASO_NAO_SINTETICO",
        casoId: caso.casoId,
        detalhe: `Caso '${caso.casoId}' não declarou dados sintéticos ou versão de controle.`,
      });
    }

    // Controle positivo versionado: verifica se disparou o alerta esperado
    if (caso.controlePositivo) {
      const disparou = caso.saidaObservada.alertasEmitidos.includes(caso.controlePositivo.alertaEsperado);
      registrarMedicao("CONTROLE_POSITIVO_SILENCIOSO", !disparou);
      if (!disparou) {
        violacoesFatais.push({
          codigo: "CONTROLE_POSITIVO_SILENCIOSO",
          casoId: caso.casoId,
          detalhe: `Controle positivo '${caso.controlePositivo.controleId}' (${caso.versaoControle}) passou em silêncio sem emitir '${caso.controlePositivo.alertaEsperado}'.`,
        });
      }
    }

    // Verificação item a item: vazamento entre pacientes, número crítico pré-validado, citação e qualificador
    for (const item of caso.saidaObservada.itensExtraidos) {
      const vazouPaciente = item.patientIdAtribuido !== caso.patientIdEsperado;
      registrarMedicao("VAZAMENTO_ENTRE_PACIENTES", vazouPaciente);
      if (vazouPaciente) {
        violacoesFatais.push({
          codigo: "VAZAMENTO_ENTRE_PACIENTES",
          casoId: caso.casoId,
          detalhe: `Item '${item.campo}' atribuído a '${item.patientIdAtribuido}' em caso do paciente '${caso.patientIdEsperado}'.`,
        });
      }

      if (item.criticoNumero) {
        const preValidado = item.preValidadoSemConfirmacao === true;
        registrarMedicao("VALOR_NUMERICO_CRITICO_PRE_VALIDADO", preValidado);
        if (preValidado) {
          violacoesFatais.push({
            codigo: "VALOR_NUMERICO_CRITICO_PRE_VALIDADO",
            casoId: caso.casoId,
            detalhe: `Valor numérico crítico em '${item.campo}' (${String(item.valor)}) foi pré-validado sem confirmação médica.`,
          });
        }
      }

      registrarMedicao("CITACAO_NAO_SUSTENTADA", !item.citacaoSustentada);

      const qualEsperado = caso.expectativas?.qualificadoresEsperados?.[item.campo];
      if (qualEsperado !== undefined) {
        registrarMedicao("QUALIFICADOR_INVERTIDO", item.qualificador !== qualEsperado);
      }
    }

    // Conflitos esperados vs manifestados
    for (const campoConflito of caso.expectativas?.conflitosEsperados ?? []) {
      const manifestou = caso.saidaObservada.conflitosManifestados.includes(campoConflito);
      registrarMedicao("CONFLITO_OCULTADO", !manifestou);
    }

    // Omissões críticas esperadas vs manifestadas
    for (const campoOmissao of caso.expectativas?.omissoesCriticasEsperadas ?? []) {
      const manifestou = caso.saidaObservada.omissoesCriticasManifestadas.includes(campoOmissao);
      registrarMedicao("OMISSAO_CRITICA", !manifestou);
    }
  }

  const metricasPorClasse: MetricaClasseErro[] = CLASSES_ERRO_ORDEM.map((classeErro) => {
    const { erros, total } = contadores.get(classeErro)!;
    const taxaErro = total === 0 ? null : Number((erros / total).toFixed(6));
    const ic = intervaloWilson95(erros, total);
    return {
      classeErro,
      numeradorErros: erros,
      denominadorTotal: total,
      taxaErro,
      incertezaIc95: {
        metodo: "WILSON_95",
        inferior: ic.inferior,
        superior: ic.superior,
        semiamplitude: ic.semiamplitude,
      },
    };
  });

  const temErroNaoFatal = metricasPorClasse.some((m) => m.numeradorErros > 0);
  const statusGlobal = violacoesFatais.length > 0
    ? "FALHA_FECHADA" as const
    : temErroNaoFatal
      ? "REPROVADO" as const
      : "APROVADO" as const;

  const relatorioValidoParaExtrator =
    entrada.tipoSujeito === "EXTRATOR" &&
    entrada.finalidadeExecucao === "AVALIACAO" &&
    violacoesFatais.length === 0;

  const rotuloEscopoSujeito = violacoesFatais.length > 0
    ? "INVALIDO_BLOQUEADO" as const
    : entrada.tipoSujeito === "STUB"
      ? "TESTE_DO_HARNESS_POR_STUB" as const
      : "AVALIACAO_DO_EXTRATOR" as const;

  return RelatorioHarnessAvaliacaoSchema.parse({
    schema: "HarnessAvaliacaoRelatorio@1",
    versaoSuite: entrada.versaoSuite,
    versaoControlesPositivos: entrada.versaoControlesPositivos,
    finalidadeExecucao: entrada.finalidadeExecucao,
    tipoSujeito: entrada.tipoSujeito,
    relatorioValidoParaExtrator,
    rotuloEscopoSujeito,
    separacaoSplits: {
      totalDev: casosDev.length,
      totalTestCongelado: casosTest.length,
      hashTestCongelado,
      testCongeladoIntegro,
    },
    statusGlobal,
    metricasPorClasse,
    violacoesFatais,
  });
}
