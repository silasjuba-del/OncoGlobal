// F4 · Módulos puros para APAC linear + retrógrada (S-F4-01/02), Farmácia + Estoque (S-F4-03)
// e Minuta de Laudo de Acesso / Judicialização com grounding verificado (S-F4-04 / AG-18).
import type { ChipEstoque, LeituraEstoque, ValidadeChip } from "../../contracts/api/estoque.js";
import type { PedidoFarmacia, RegistroFarmacia, ResultadoFarmacia } from "../../contracts/api/farmacia.js";
import type { TumorLot } from "../../contracts/clinico.js";
import {
  MinutaLaudoAcessoJudicial,
  type AfirmacaoFundamentadaLaudo,
  type CitacaoEvidenciaLaudo,
  type StatusCoberturaPadrao,
  type StatusRegistroRegulatorio,
} from "../../contracts/f4/acessoEJudicializacao.js";
import { Apac as ApacSchema, type Apac } from "../../contracts/operacao.js";
import {
  apacGerar,
  apacPrazo,
  apacRetrograda,
  validarEmissaoApac,
  type CodigoNegativa,
  type PendenciaRetrograda,
  type PrescricaoAssinada,
} from "../../rules/apac.js";
import { antiglosa } from "./antiglosa.js";
import { montarApacBatch, type CriterioApacBatch, type ItemApacLote } from "./lote.js";
import type { TabelasSigtap } from "./sigtap.js";
import type { CaixaNumerada } from "../../contracts/w10/clinico-w10.js";

/**
 * S-F4-01 · Gera APAC a partir de prescrição ASSINADA, valida campos obrigatórios,
 * prazos D85/D90 e antiglosa com tabela SIGTAP versionada por competência.
 * Aceita `dataGeracaoApp` opcional (quando a APAC foi gerada em data anterior a `hoje`)
 * para avaliar prazos D85/D90 ao longo do ciclo de validade de 90 dias.
 */
export function executarFluxoLinearApacF4(entrada: {
  prescricaoAssinada: PrescricaoAssinada;
  tumorLot: TumorLot;
  dataGeracaoApp?: string;
  hoje: string;
  ultimoAvisoEm: string | null;
  camposObrigatorios: readonly string[];
  sigtap: TabelasSigtap;
  caixas: readonly CaixaNumerada[];
  cnesConfigurado: string;
  apacsDoLote?: readonly Apac[];
}) {
  const dataGeracao = entrada.dataGeracaoApp ?? entrada.hoje;
  const apac = apacGerar(entrada.prescricaoAssinada, entrada.tumorLot, dataGeracao);
  const validacaoEmissao = validarEmissaoApac(apac, entrada.camposObrigatorios);
  const prazo = apacPrazo(apac.dataGeracaoApp, entrada.hoje, entrada.ultimoAvisoEm);
  const vereditoAntiglosa = antiglosa(apac, {
    hoje: entrada.hoje,
    sigtap: entrada.sigtap,
    caixas: entrada.caixas,
    cnesConfigurado: entrada.cnesConfigurado,
    apacsDoLote: entrada.apacsDoLote ?? [apac],
  });
  const tabelaSigtapPresente = Boolean(entrada.sigtap[apac.competencia]);

  return {
    apac,
    validacaoEmissao,
    prazo,
    vereditoAntiglosa,
    tabelaSigtapPresente,
    podeExportarFaturamento:
      validacaoEmissao.podeEmitir && prazo.faturamentoPodeEmitir && vereditoAntiglosa.exportavel && tabelaSigtapPresente,
    consultaClinicaSegueSempre: prazo.consultaSegue,
  };
}

/**
 * S-F4-02 · Processa negativa externa de APAC preservando a APAC NEGADA no histórico
 * e gerando pendência retrógrada tipada no campo clínico de origem do TumorLot (FN-13).
 */
export function processarNegativaRetrogradaApacF4(entrada: {
  apacExistente: Apac;
  codigoNegativa: CodigoNegativa;
  motivoTexto?: string;
  comprovanteRef: string;
  recebidoEm: string;
}): {
  apacNegadaPreservada: Apac;
  pendenciaRetrograda: PendenciaRetrograda;
} {
  const pendenciaRetrograda = apacRetrograda({
    apacId: entrada.apacExistente.apacId,
    codigo: entrada.codigoNegativa,
    comprovanteRef: entrada.comprovanteRef,
  });
  const motivoFormatado = entrada.motivoTexto?.trim()
    ? `${entrada.codigoNegativa}: ${entrada.motivoTexto.trim()}`
    : entrada.codigoNegativa;
  const apacNegadaPreservada = ApacSchema.parse({
    ...entrada.apacExistente,
    estado: "NEGADA",
    resultadoExterno: {
      valor: "NEGADA",
      comprovanteRef: entrada.comprovanteRef,
      motivo: motivoFormatado,
      recebidoEm: entrada.recebidoEm,
    },
  });
  return { apacNegadaPreservada, pendenciaRetrograda };
}

export { montarApacBatch, type CriterioApacBatch, type ItemApacLote };

/**
 * S-F4-04 (AG-18 / Q48) · Constrói minuta estruturada de relatório/laudo de acesso/judicialização:
 * - Valida grounding de cada afirmação contra fatos confirmados e fontes datadas;
 * - Separa indicação clínica, registro regulatório, cobertura padrão e disponibilidade local;
 * - Nunca inclui ALERTA ou CORRECAO_IA e nunca declara direito adquirido ou elegibilidade automática.
 */
export function gerarMinutaLaudoAcessoJudicial(entrada: {
  minutaId: string;
  versao?: number;
  patientId: string;
  encounterId: string;
  tumorLotId: string;
  prescricaoAssinadaRef: { documentId: string; documentVersion: number };
  medicamentoSolicitado: {
    nome: string;
    posologiaPlanejada: string;
    duracaoPrevista: string;
  };
  indicacaoClinicaMedica: string;
  registroRegulatorio: StatusRegistroRegulatorio;
  coberturaPadrao: StatusCoberturaPadrao;
  chipEstoque: ChipEstoque;
  citacoesVerificadas: readonly CitacaoEvidenciaLaudo[];
  afirmacoes: readonly AfirmacaoFundamentadaLaudo[];
  criadoEm: string;
}): { ok: true; minuta: MinutaLaudoAcessoJudicial } | { ok: false; codigo: string; detalhe?: string } {
  const linhasTexto: string[] = [
    `RELATÓRIO MÉDICO DE SOLICITAÇÃO TERAPÊUTICA (MINUTA PARA REVISÃO E ASSINATURA MÉDICA)`,
    `Paciente ID: ${entrada.patientId} · Encontro: ${entrada.encounterId} · Lote Tumoral: ${entrada.tumorLotId}`,
    `Medicamento solicitado: ${entrada.medicamentoSolicitado.nome} (${entrada.medicamentoSolicitado.posologiaPlanejada}) — duração prevista: ${entrada.medicamentoSolicitado.duracaoPrevista}`,
    ``,
    `1. SEPARAÇÃO DOS EIXOS CLÍNICO, REGULATÓRIO, DE COBERTURA E DE DISPONIBILIDADE:`,
    `- Indicação clínica (decisão médica): ${entrada.indicacaoClinicaMedica}`,
    `- Registro regulatório: ${entrada.registroRegulatorio}`,
    `- Cobertura padrão nas listas: ${entrada.coberturaPadrao}`,
    `- Disponibilidade em estoque local: ${entrada.chipEstoque.estado} (origem: ${entrada.chipEstoque.origem ?? "não informada"}; data: ${entrada.chipEstoque.data ?? "não informada"})`,
    ``,
    `2. FUNDAMENTAÇÃO FÁTICA E DOCUMENTAL (GROUNDING):`,
    ...entrada.afirmacoes.map((af) => `- [${af.secao}] ${af.texto} (Fontes: ${af.citacoesIds.join(", ")})`),
    ``,
    `3. REFERÊNCIAS E FONTES VERIFICADAS:`,
    ...entrada.citacoesVerificadas.map(
      (c) => `- [${c.citacaoId}] (${c.tipoFonte}) ${c.tituloOuDescricao} — data: ${c.dataFonte} (consultado em ${c.consultadoEm}): "${c.trechoSustentador}"`,
    ),
    ``,
    `Nota de governança: documento gerado como minuta técnica submetida à revisão, edição e assinatura exclusiva do médico assistente.`,
  ];

  const candidata = {
    schema: "MinutaLaudoAcessoJudicial@1" as const,
    minutaId: entrada.minutaId,
    versao: entrada.versao ?? 1,
    patientId: entrada.patientId,
    encounterId: entrada.encounterId,
    tumorLotId: entrada.tumorLotId,
    prescricaoAssinadaRef: entrada.prescricaoAssinadaRef,
    medicamentoSolicitado: entrada.medicamentoSolicitado,
    separacaoEixosAcesso: {
      indicacaoClinicaMedica: entrada.indicacaoClinicaMedica,
      registroRegulatorio: entrada.registroRegulatorio,
      coberturaPadrao: entrada.coberturaPadrao,
      disponibilidadeLocal: {
        estado: entrada.chipEstoque.estado,
        origem: entrada.chipEstoque.origem,
        dataLeitura: entrada.chipEstoque.data,
      },
      presumeDireitoIndividualAutomatico: false as const,
      presumeElegibilidadeAutomatica: false as const,
    },
    citacoesVerificadas: [...entrada.citacoesVerificadas],
    afirmacoes: [...entrada.afirmacoes],
    textoMinutaConsolidado: linhasTexto.join("\n"),
    contemAlertaOuCorrecaoIa: false as const,
    revisao: "REVISAR" as const,
    assinadoPorMedicoId: null,
    assinadoPorCrm: null,
    assinadoEm: null,
    criadoEm: entrada.criadoEm,
  };

  const parsed = MinutaLaudoAcessoJudicial.safeParse(candidata);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const msg = issue?.message ?? "MINUTA_INVALIDA";
    const codigo = msg.includes("grounding")
      ? "GROUNDING_CITACAO_INEXISTENTE"
      : msg.includes("expressão proibida")
        ? "EXPRESSAO_PROIBIDA_NO_LAUDO"
        : "MINUTA_LAUDO_INVALIDA";
    return { ok: false, codigo, detalhe: msg };
  }

  return { ok: true, minuta: parsed.data };
}
