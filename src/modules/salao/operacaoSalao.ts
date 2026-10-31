// F3 · Módulos operacionais puros do Salão (S-F3-01 a S-F3-04).
// Reutiliza FN-01 (avaliarTriagem/avaliarCorteSalao), FN-02 (decidirDestino), FN-03 (ordenarFila),
// FN-04 (calcularDose), FN-06 (avaliarPeso), FN-09 (cicloVaiAoMedico), bsaMosteller e G-06 (g06E1Destaque).
import { randomUUID } from "node:crypto";
import type { Destino } from "../../contracts/estados.js";
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
 * FRENTE só com temCorte=false e temPendencia=false explícitos (cama/cadeira/>80);
 * Com corte/pendência -> FILA_MEDICO ordenada por ECOG4 -> ECOG3 -> cama -> cadeira -> >80 -> chegada;
 * E1 nunca altera a ordem da fila, acionando escalonamento separado (A7).
 */
export function organizarFilaSalaoF3(
  entradas: readonly (EntradaFila & { emergencia?: boolean; temCorte?: boolean; temPendencia?: boolean })[],
  ruleset: SalaoRuleset,
): {
  filaOrdenada: EntradaFila[];
  destinosPorEntrada: (EntradaFila & { destino: Destino })[];
  escalonamentoE1Ids: string[];
} {
  const destinosPorEntrada = entradas.map(e => ({
    ...e,
    // Ausência de informação não comprova ausência de corte/pendência.
    destino: decidirDestino({ temCorte: e.temCorte !== false, temPendencia: e.temPendencia !== false,
      recurso: e.recurso, idadeAnos: e.idadeAnos }, ruleset),
  }));
  const filaOrdenada = ordenarFila(entradas, ruleset);
  const escalonamentoE1Ids = entradas
    .filter((e) => e.emergencia === true)
    .map((e) => e.patientId);
  return { filaOrdenada, destinosPorEntrada, escalonamentoE1Ids };
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
 * - Perda ≥5% em 90 dias, ou ≥2% com IMC <20, -> VERMELHO + recomendações pendentes de decisão médica;
 * - Quilos absolutos não decidem mais a cor (decisão 30/10/2026);
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
    tarefaNutricaoCriada: false,
    qtAdiada: false,
    recomendacaoNutricao: vermelho ? "PENDENTE_DECISAO_MEDICA" : avaliacao.estado === "VERDE" ? "NAO_INDICADA" : "NAO_AVALIADA",
    recomendacaoAdiamentoQt: vermelho ? "PENDENTE_DECISAO_MEDICA" : avaliacao.estado === "VERDE" ? "NAO_INDICADA" : "NAO_AVALIADA",
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
  referenciaProtocoloMgM2?: number | null;
  scAnteriorM2?: number | null;
  nivelDose?: 0 | -1 | -2 | null;
  percentualDoNivel?: number | null;
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
      alturaCm: entrada.alturaCm,
      ...(entrada.referenciaProtocoloMgM2 !== undefined ? { referenciaMgM2: entrada.referenciaProtocoloMgM2 } : {}),
      ...(entrada.scAnteriorM2 !== undefined ? { scAnteriorM2: entrada.scAnteriorM2 } : {}),
      ...(entrada.nivelDose !== undefined ? { nivelDose: entrada.nivelDose } : {}),
      ...(entrada.percentualDoNivel !== undefined ? { percentualDoNivel: entrada.percentualDoNivel } : {}),
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
  // Canonicalização recursiva como nos componentes existentes; ordem de chaves não é identidade.
  const canonical = (valor: unknown): string => JSON.stringify(valor, (_chave, item: unknown) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item);
  const porAdmin = new Map<string, {
    administracao: TreatmentAdministration;
    identidade: string;
    drogas: Set<string>;
    conflito: boolean;
  }>();
  for (const adm of administracoes) {
    const identidade = canonical(adm);
    const atual = porAdmin.get(adm.adminId);
    if (atual) {
      atual.drogas.add(adm.droga);
      if (atual.identidade !== identidade) atual.conflito = true;
    } else {
      porAdmin.set(adm.adminId, {
        administracao: adm, identidade, drogas: new Set([adm.droga]), conflito: false,
      });
    }
  }

  const porDroga = new Map<string, ResumoCumulativoSalao>();
  for (const [adminId, { administracao: adm, drogas, conflito }] of porAdmin.entries()) {
    // Omitidas e quantidades zero só são ignoradas depois de comparar todas as identidades.
    if (!conflito && (adm.status === "OMITIDA" || adm.quantidadeEfetivaMg === 0)) continue;
    for (const droga of drogas) {
      const item = porDroga.get(droga) ?? {
        droga,
        quantidadeEfetivaTotalMg: 0,
        adminIds: [],
        conflitoAdminIds: [],
        incluiApenasAdministracaoEfetiva: true as const,
      };
      if (conflito) {
        item.conflitoAdminIds.push(adminId);
      } else {
        item.quantidadeEfetivaTotalMg += adm.quantidadeEfetivaMg;
        item.adminIds.push(adminId);
      }
      porDroga.set(droga, item);
    }
  }

  return [...porDroga.values()].sort((a, b) => a.droga.localeCompare(b.droga));
}
