// F3 · Módulos operacionais puros do Salão (S-F3-01 a S-F3-04).
// Reutiliza FN-01 (avaliarTriagem/avaliarCorteSalao), FN-02 (decidirDestino), FN-03 (ordenarFila),
// FN-04 (calcularDose), FN-06 (avaliarPeso), FN-09 (cicloVaiAoMedico), bsaMosteller e G-06 (g06E1Destaque).
import { randomUUID } from "node:crypto";
import type { OrigemPeso, ResultadoTriagem, TreatmentAdministration, Triagem } from "../../contracts/clinico.js";
import type { ContextoTriagem, DoseRuleset, EntradaFila, Pesagem, SalaoRuleset } from "../../contracts/regras.js";
import {
  AvaliacaoDoseCicloSalao,
  DesfechoPesoSalao,
  EventoInterrupcaoSalao,
  type ResumoCumulativoSalao,
  type TipoEventoInterrupcaoSalao,
} from "../../contracts/f3/salaoOperacional.js";
import {
  avaliarPeso,
  avaliarTriagem,
  calcularDose,
  cicloVaiAoMedico,
  decidirDestino,
  ordenarFila,
} from "../../rules/index.js";
import { bsaMosteller } from "../../rules/prescricao/instanciarProtocolo.js";

type OrigemPesoTipo = "MEDIDO" | "ANTERIOR" | "INFORMADO_PACIENTE";

/**
 * S-F3-01 · Avalia a triagem preservando valores, datas, fontes e dados desconhecidos explícitos
 * (ex.: idadeAnos = null -> PENDENTE, tontura = null -> PENDENTE, hemograma > 7 dias -> PENDENTE).
 */
export function executarTriagemSalaoF3(
  triagem: Triagem,
  contexto: ContextoTriagem,
  ruleset: SalaoRuleset,
): ResultadoTriagem & {
  dadosDesconhecidosExplicitos: string[];
  exigeAvaliacaoMedica: boolean;
} {
  const resultado = avaliarTriagem(triagem, contexto, ruleset);
  const destinoFinal = decidirDestino(
    {
      temCorte: resultado.cortes.length > 0,
      temPendencia: resultado.pendentes.length > 0,
      recurso: triagem.recurso,
      idadeAnos: triagem.idadeAnos,
    },
    ruleset,
  );
  const dadosDesconhecidosExplicitos: string[] = [];
  if (triagem.idadeAnos === null) dadosDesconhecidosExplicitos.push("idadeAnos");
  if (triagem.tontura === null) dadosDesconhecidosExplicitos.push("tontura");
  for (const p of resultado.pendentes) {
    dadosDesconhecidosExplicitos.push(p.codigo);
  }
  const exigeAvaliacaoMedica = destinoFinal === "FILA_MEDICO" || resultado.cortes.length > 0 || resultado.pendentes.length > 0;
  return {
    ...resultado,
    destino: destinoFinal,
    dadosDesconhecidosExplicitos,
    exigeAvaliacaoMedica,
  };
}

/**
 * S-F3-02 · Organiza a fila do salão conforme decisões vigentes:
 * FRENTE só sem corte e sem pendência (cama/cadeira/>80);
 * Com corte/pendência -> FILA_MEDICO ordenada por ECOG4 -> ECOG3 -> cama -> cadeira -> >80 -> chegada;
 * E1 nunca altera a ordem da fila, acionando escalonamento separado (A7).
 */
export function organizarFilaSalaoF3(
  entradas: readonly (EntradaFila & { emergencia?: boolean; temCorte?: boolean; temPendencia?: boolean })[],
  ruleset: SalaoRuleset,
): {
  filaOrdenada: EntradaFila[];
  escalonamentoE1Ids: string[];
} {
  const filaOrdenada = ordenarFila(entradas, ruleset);
  const escalonamentoE1Ids = entradas
    .filter((e) => e.emergencia === true)
    .map((e) => e.patientId);
  return { filaOrdenada, escalonamentoE1Ids };
}

/**
 * S-F3-02 · Registra interrupção operacional no salão (Q28):
 * - Alergia infusional -> para a infusão na hora;
 * - Vômito difícil -> pausa e aguarda estabilização/avaliação médica;
 * - Dor/extravasamento no local da infusão -> avisa enfermagem e médico na hora.
 */
export function criarEventoInterrupcaoSalao(entrada: {
  eventoSalaoId?: string;
  patientId: string;
  encounterId: string;
  cicloId?: string | null;
  tipo: TipoEventoInterrupcaoSalao;
  descricaoClinica: string;
  registradoPor: string;
  registradoEm: string;
}): EventoInterrupcaoSalao {
  const acaoImediata =
    entrada.tipo === "ALERGIA_INFUSIONAL"
      ? "PARAR_INFUSAO_NA_HORA"
      : entrada.tipo === "VOMITO_DIFICIL"
        ? "PAUSAR_E_AGUARDAR_ESTABILIZACAO"
        : "AVISAR_ENFERMAGEM_E_MEDICO_NA_HORA";

  return EventoInterrupcaoSalao.parse({
    eventoSalaoId: entrada.eventoSalaoId ?? `ev-salao-${randomUUID()}`,
    patientId: entrada.patientId,
    encounterId: entrada.encounterId,
    cicloId: entrada.cicloId ?? null,
    tipo: entrada.tipo,
    acaoImediata,
    infusaoSuspensa: true,
    exigeAvaliacaoMedica: true,
    notificarSetorChat: "TRIAGEM",
    descricaoClinica: entrada.descricaoClinica.trim(),
    registradoPor: entrada.registradoPor,
    registradoEm: entrada.registradoEm,
  });
}

/**
 * S-F3-02 · Avalia tendência de peso no salão (FN-06 / Q24–Q25 / A2):
 * - Perda > 5,0 kg em 60 dias (ambas medidas) -> VERMELHO + tarefa nutrição + QT adiada + consulta médica mantida;
 * - Perda exatamente 5,0 kg -> VERDE (passa);
 * - Peso informado × medido divergente -> PENDENTE (diferença incerta, médico confirma; nunca dispara vermelho sozinho).
 */
export function avaliarDesfechoPesoSalao(entrada: {
  patientId: string;
  encounterId: string;
  pesagens: readonly Pesagem[];
  hoje: string;
  ruleset: SalaoRuleset;
}): DesfechoPesoSalao {
  const avaliacao = avaliarPeso(entrada.pesagens, entrada.hoje, entrada.ruleset);
  const vermelho = avaliacao.estado === "VERMELHO";
  return DesfechoPesoSalao.parse({
    patientId: entrada.patientId,
    encounterId: entrada.encounterId,
    estadoPeso: avaliacao.estado,
    perdaKg: avaliacao.perdaKg,
    motivo: avaliacao.motivo,
    tarefaNutricaoCriada: vermelho,
    qtAdiada: vermelho,
    passaEmConsultaMedica: true,
    rulesetVersao: avaliacao.rulesetVersao,
  });
}

/**
 * S-F3-03 · Calcula dose do ciclo e avalia necessidade de consulta médica no ciclo:
 * - BSA por Mosteller √(alturaCm × pesoKg / 3600);
 * - Reduções −20/−30/−40% incidem EXCLUSIVAMENTE sobre a dose efetivamente administrada no ciclo anterior (Q29 / K-06);
 * - Sem peso no ciclo: mantém dose anterior com origem ANTERIOR; 2º ciclo consecutivo sem peso = VERMELHO (Q30);
 * - Ciclo 1 sem peso medido: usa peso informado pelo paciente com origem INFORMADO_PACIENTE (Q31);
 * - AC ciclo 3 salta o médico SOMENTE se não houver corte nem pendência (Q32 / FN-09);
 * - Nunca edita automaticamente a prescrição assinada.
 */
export function avaliarDoseECicloSalao(entrada: {
  patientId: string;
  encounterId: string;
  episodioId: string;
  esquemaId: string;
  numeroCiclo: number;
  pesoMedidoKg: number | null;
  pesoInformadoPacienteKg?: number | null;
  alturaCm: number | null;
  ciclosSemPesoAnteriores: number;
  dosePlanejadaProtocoloMg: number | null;
  dosePrescritaAssinadaMg: number | null;
  doseAdministradaCicloAnteriorMg: number | null;
  reducaoPct: 0 | 20 | 30 | 40;
  resultadoTriagem: ResultadoTriagem;
  doseRuleset: DoseRuleset;
}): AvaliacaoDoseCicloSalao {
  let pesoEfetivo: number | null = entrada.pesoMedidoKg;
  let origemPeso: OrigemPesoTipo | null = entrada.pesoMedidoKg !== null ? "MEDIDO" : null;

  if (pesoEfetivo === null && entrada.numeroCiclo === 1 && entrada.pesoInformadoPacienteKg != null && entrada.pesoInformadoPacienteKg > 0) {
    pesoEfetivo = entrada.pesoInformadoPacienteKg;
    origemPeso = "INFORMADO_PACIENTE";
  } else if (pesoEfetivo === null && entrada.doseAdministradaCicloAnteriorMg !== null) {
    origemPeso = "ANTERIOR";
  }

  const bsa = bsaMosteller(pesoEfetivo, entrada.alturaCm);
  const saidaDose = calcularDose(
    {
      doseAdministradaAnteriorMg: entrada.doseAdministradaCicloAnteriorMg,
      reducaoPct: entrada.reducaoPct,
      pesoKg: pesoEfetivo,
      origemPeso: origemPeso ?? "MEDIDO",
      ciclosSemPesoAnteriores: entrada.ciclosSemPesoAnteriores,
    },
    entrada.doseRuleset,
  );

  const exigeMedico = cicloVaiAoMedico(
    entrada.esquemaId,
    entrada.numeroCiclo,
    entrada.resultadoTriagem,
    entrada.doseRuleset,
  );
  const esquemasAc = Array.isArray(entrada.doseRuleset.AC.esquemas)
    ? (entrada.doseRuleset.AC.esquemas as unknown[]).filter((e): e is string => typeof e === "string")
    : [];
  const ehAc = esquemasAc.some(
    (e) => e.trim().toUpperCase() === entrada.esquemaId.trim().toUpperCase(),
  );
  const podeSaltarMedicoCiclo3Ac = ehAc && entrada.numeroCiclo === 3 && !exigeMedico;

  return AvaliacaoDoseCicloSalao.parse({
    patientId: entrada.patientId,
    encounterId: entrada.encounterId,
    episodioId: entrada.episodioId,
    esquemaId: entrada.esquemaId,
    numeroCiclo: entrada.numeroCiclo,
    pesoKg: pesoEfetivo,
    alturaCm: entrada.alturaCm,
    origemPeso,
    bsaMostellerM2: bsa,
    dosePlanejadaProtocoloMg: entrada.dosePlanejadaProtocoloMg,
    dosePrescritaAssinadaMg: entrada.dosePrescritaAssinadaMg,
    doseAdministradaCicloAnteriorMg: entrada.doseAdministradaCicloAnteriorMg,
    reducaoPct: entrada.reducaoPct,
    doseCalculadaPropostaMg: saidaDose.doseMg,
    estadoDose: saidaDose.estado,
    motivoDose: saidaDose.motivo,
    ciclosSemPesoConsecutivos: saidaDose.ciclosSemPesoConsecutivos,
    exigeConsultaMedicaNoCiclo: exigeMedico,
    podeSaltarMedicoCiclo3Ac,
    prescricaoAssinadaInalterada: true,
    rulesetVersao: saidaDose.rulesetVersao,
  });
}

/**
 * S-F3-03 · Calcula doses cumulativas a partir EXCLUSIVAMENTE das administrações efetivas (`TreatmentAdministration`).
 * Quantidades apenas planejadas ou prescritas nunca entram; `OMITIDA` soma 0; `PARCIAL`/`INTERROMPIDA` soma `quantidadeEfetivaMg`.
 */
export function calcularCumulativosEfetivosSalao(
  administracoes: readonly TreatmentAdministration[],
): ResumoCumulativoSalao[] {
  const porAdmin = new Map<string, { droga: string; quantidades: Set<number> }>();
  for (const adm of administracoes) {
    if (adm.status === "OMITIDA" || adm.quantidadeEfetivaMg === 0) continue;
    const atual = porAdmin.get(adm.adminId) ?? { droga: adm.droga, quantidades: new Set<number>() };
    atual.quantidades.add(adm.quantidadeEfetivaMg);
    porAdmin.set(adm.adminId, atual);
  }

  const porDroga = new Map<string, ResumoCumulativoSalao>();
  for (const [adminId, { droga, quantidades }] of porAdmin.entries()) {
    const item = porDroga.get(droga) ?? {
      droga,
      quantidadeEfetivaTotalMg: 0,
      adminIds: [],
      conflitoAdminIds: [],
      incluiApenasAdministracaoEfetiva: true as const,
    };
    if (quantidades.size > 1) {
      item.conflitoAdminIds.push(adminId);
    } else {
      item.quantidadeEfetivaTotalMg += [...quantidades][0]!;
      item.adminIds.push(adminId);
    }
    porDroga.set(droga, item);
  }

  return [...porDroga.values()].sort((a, b) => a.droga.localeCompare(b.droga));
}
