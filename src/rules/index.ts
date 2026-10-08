// Stable API: named modules are the single implementation authority.
import type { FuncoesF0 } from "../contracts/regras.js";
import { avaliarTriagem, validadeHemograma, avaliarCorteSalao, avaliarTriagemCiclo, avaliarPortoesW10 } from "./triagem.js";
import { decidirDestino } from "./destino.js";
import { ordenarFila } from "./fila.js";
import { calcularDose } from "./dose.js";
import { avaliarPeso } from "./peso.js";
import { avisoIntervaloPosQt } from "./prazos.js";
import { ehConcomitante } from "./concomitancia.js";
import { cicloVaiAoMedico } from "./cicloComMedico.js";
import { extrairCriteriosCtcae } from "./ctcaeTexto.js";
import { sugerirGrauCtcae } from "./ctcaeClinico.js";
import { lerLimitesRetorno, montarRetornoToxicidade, type EntradaRetornoToxicidade } from "./retornoToxicidade.js";
import { alertarSuporte, lerSuporte } from "./suporteNaoOncologico.js";
import { avaliarAlertaPlaquetas, lerLimiarAlertaPlaquetas } from "./plaquetasAlerta.js";
import { alertarVertigemNova, lerAlertaVertigem } from "./tontura.js";
export { avaliarTriagem, validadeHemograma, avaliarCorteSalao, avaliarTriagemCiclo, avaliarPortoesW10, decidirDestino, ordenarFila, calcularDose, avaliarPeso, avisoIntervaloPosQt, ehConcomitante, cicloVaiAoMedico };
export { portaCiclo, grauCtcae, lerSalaoCtcae, limiaresDaBula } from "./portaCiclo.js";
export { extrairCriteriosCtcae, sugerirGrauCtcae };
export { alertarVertigemNova, lerAlertaVertigem };

/** D-W9-75. Compõe extração e sugestão. O barrel é o único arquivo de regras que pode importar os dois. */
export function avaliarTextoCtcae(texto: string, corpus: unknown) {
  return sugerirGrauCtcae(extrairCriteriosCtcae(texto), corpus);
}

/** W12-GROK-05. Compõe corte, alerta de plaquetas e suporte. O barrel é o único arquivo que importa os três. */
export function avaliarRetornoToxicidade(
  entrada: EntradaRetornoToxicidade,
  suporteJson: unknown,
  labJson: unknown,
  triagemJson: unknown,
  ctcaeJson: unknown,
) {
  const limites = lerLimitesRetorno(triagemJson, labJson, ctcaeJson);
  const suporte = alertarSuporte({
    medicamentos: entrada.medicamentos,
    horasDiarreia: entrada.horasDiarreia,
    vomito: entrada.vomito,
    dm2: entrada.dm2,
    tempDecimos: entrada.tempDecimos,
  }, lerSuporte(suporteJson));
  const [alertaPlq] = avaliarAlertaPlaquetas(
    { valor: entrada.plaquetas, data: entrada.dataPlaquetas },
    lerLimiarAlertaPlaquetas(labJson),
    () => ({
      grau: null,
      estado: "PENDENTE",
      confirmadoPeloMedico: false,
      motivo: "grau de plaquetas não confirmado nesta cadeia",
    }),
  );
  return montarRetornoToxicidade(entrada, limites, suporte, alertaPlq);
}
export { diferencaDiasCivis } from "./datas.js";
export type { SinaisExtraW10, ResultadoPortao } from "./triagem.js";
export const funcoesF0: FuncoesF0 = { avaliarTriagem, decidirDestino, ordenarFila, calcularDose, validadeHemograma, avaliarPeso, avisoIntervaloPosQt, ehConcomitante, cicloVaiAoMedico };
export { semaforoInteracoes } from "./semaforoInteracoes.js";

// Fachada estável do w8 para o Fugu. R-08 só permite este barrel reexportar src/rules/*.
export { escolherDataClinica, idadeNaData } from "./w8/dataClinica.js";
export type { EntradaDataClinica, SaidaDataClinica, SaidaIdadeNaData } from "./w8/dataClinica.js";
export { avaliarHierarquiaFonte } from "./w8/hierarquiaFonte.js";
export type { AchadoFonte, NaturezaFonte, OrigemResultado, SaidaHierarquiaFonte } from "./w8/hierarquiaFonte.js";
export { deduplicarExames as deduplicarExamesW8, gerarChaveDedupe } from "./w8/dedupeExame.js";
export type { EntradaExameDedupe, ExameUnicoAgrupado, SaidaDedupeExame, TipoExameDedupe } from "./w8/dedupeExame.js";
export { classificarIdentificador, cnsValido, cpfValido } from "./w8/identificadores.js";
export type { EntradaClassificarIdentificador, SaidaClassificarIdentificador, TipoIdentificadorPorValor } from "./w8/identificadores.js";
export { avaliarRasuraEConfianca } from "./w8/rasura.js";
export type { ConfigRasura, EntradaCampoExtraido, SaidaAvaliacaoRasura } from "./w8/rasura.js";
export { agregarCaso, calcularGrupoGrauISUP, validarSitioPatologia } from "./w8/patologiaSitio.js";
export type { EntradaSitioPatologia, RulesetPatologiaAgregacao, SaidaAgregacaoCaso, SaidaValidacaoSitio } from "./w8/patologiaSitio.js";
export { gerarResumoImagem } from "./w8/resumoImagem.js";
export type { CampoResumo2, EntradaRADS11, Resumo1Imagem, Resumo2Imagem, SaidaResumoImagem } from "./w8/resumoImagem.js";
export { vincularDocumentoAoPaciente } from "./w8/vinculoDocumento.js";
export type { EntradaVinculoDocumento, PapelPessoaDocumento, SaidaVinculoDocumento, TipoDocumentoVinculo, TipoIdentificadorClinico } from "./w8/vinculoDocumento.js";
export { avaliarInteracaoMedicamentosa } from "./w8/interacoes.js";
export type { RegraInteracaoItem, RulesetInteracoes, SaidaAvaliacaoInteracao } from "./w8/interacoes.js";
