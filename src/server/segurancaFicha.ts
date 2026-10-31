import { bsaMosteller } from "../rules/prescricao/instanciarProtocolo.js";
import { doseFinalEmMg } from "../rules/prescricao/documentoExecutavel.js";
import type { ClinicalEvent } from "../contracts/operacao.js";
import type { Retrato } from "../contracts/f1/retrato.js";
import type { ProtocolTemplate, PrescriptionItem } from "../contracts/w10/prescricao.js";
import { eventosVigentes, escopoDoEvento, dadosDoEvento, projetarSnapshot } from "../kernel/projections/snapshot.js";
import { labSeries } from "../kernel/projections/series.js";
import { safetyEngine, type Medida } from "../rules/prescricao/safetyEngine.js";
import { avaliarValidadeExame } from "../rules/f0c/clinica.js";
import { observacaoNoHorizonte, diaDaObservacao } from "../modules/consulta/observacoesTemporais.js";
import { montarFichaMinima } from "../modules/consulta/revisaoClinica.js";
import { ultimoLab } from "./f0c/avaliacaoConsulta.js";
import { metadadosDoFatoImpedemUso } from "./f0c/dadosDocumentados.js";
import type { lerConsulta } from "./leituras.js";
type Consulta = Extract<ReturnType<typeof lerConsulta>, { avaliacaoClinica: unknown }>;

/** Requisitos vêm da base de cálculo e da bula da ficha conferida, nunca de cortes novos. */
export function avaliarSegurancaFicha(template: ProtocolTemplate, itens: readonly PrescriptionItem[], consulta: Consulta,
  retrato: Retrato, eventos: readonly ClinicalEvent[], agora: string) {
  const hoje = retrato.dataClinicaEncontro ?? diaDaObservacao(agora)!;
  const atuais = eventosVigentes(eventos.filter(e => e.patientId === retrato.patientId && ["CONFIRMADO", "ASSINADO"].includes(e.revisao)
    && Date.parse(e.criadoEm) <= Date.parse(agora) && (escopoDoEvento(e) === "PACIENTE" || e.tumorLotId === retrato.tumorLotId)
    && !metadadosDoFatoImpedemUso(dadosDoEvento(e))));
  const pontos = labSeries(atuais);
  const hemograma = (nome: string): Medida => {
    const p = ultimoLab(pontos, nome, hoje), unidade = p?.unidade?.normalize("NFKC").toLowerCase();
    const unidadeValida = unidade !== undefined && ["/μl", "/ul", "/mm3", "celulas/mm3", "células/mm3", "cel/μl"].includes(unidade);
    const valido = p && unidadeValida && avaliarValidadeExame("HEMOGRAMA", p.data, agora).estado === "VALIDO";
    return { valor: valido ? p.valor : null, medidoEm: p?.data ?? null };
  };
  const cr = ultimoLab(pontos, "creatinina", hoje);
  const a = consulta.avaliacaoClinica, d = a.dadosCorporais;
  const altura = montarFichaMinima(retrato).find(f => f.id === "alturaCm");
  const snapshot = projetarSnapshot(atuais.filter(e => e.tipo === "FATO"), retrato.patientId, retrato.tumorLotId, retrato.encounterId, "seguranca-ficha@1");
  const feveRaw = snapshot.campos.feve;
  const feve = feveRaw?.estado === "VERDE" && feveRaw.valor && typeof feveRaw.valor === "object"
    ? feveRaw.valor as Record<string, unknown> : null;
  const feveValida = feve && feveRaw?.eventIds.length && feveRaw.eventIds.every(id => atuais.some(e => e.eventId === id && e.fontes.length > 0)) && typeof feve.percentual === "number" && Number.isFinite(feve.percentual)
    && observacaoNoHorizonte(feve.data, hoje, Date.parse(agora));
  const requisitos = template.itens.map(i => ({ drug: i.drug, requiresWeight: ["MG_KG", "MCG_KG", "MG_M2"].includes(i.doseBasis),
    requiresHeight: i.doseBasis === "MG_M2", requiresBSA: i.doseBasis === "MG_M2", renalRequirement: i.doseBasis === "AUC" }));
  const normalizados = itens.map(i => {
    const mg = i.prescribedDose === null ? null : doseFinalEmMg(i.prescribedDose, i.unit);
    return mg === null ? i : { ...i, prescribedDose: mg, calculatedDose: i.calculatedDose === null ? null : doseFinalEmMg(i.calculatedDose, i.unit), unit: "mg" };
  });
  return safetyEngine(normalizados, requisitos, { hoje,
    peso: { valor: d.pesoKg, medidoEm: d.medidoEm }, altura: { valor: d.alturaCm, medidoEm: altura?.data ?? null },
    bsa: { valor: bsaMosteller(d.pesoKg, d.alturaCm), medidoEm: d.medidoEm },
    clcr: { valor: a.renal.estado === "CALCULADO" ? a.renal.clcrMlMin : null, medidoEm: cr?.data ?? null },
    neutrofilos: hemograma("neutrofilos"), plaquetas: hemograma("plaquetas"),
    feve: { valor: feveValida ? feve.percentual as number : null, medidoEm: feveValida ? String(feve.data) : null },
  }, template.limiaresBula);
}
