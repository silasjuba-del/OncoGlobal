// W10-INT-PRESC-02 · template conferido → itens com dose calculada (D-W9-45, D-W9-22b, FN-04).
// IA propõe, CÓDIGO calcula, médico decide. Função pura.
//
// Reaproveitamento de FN-04: src/rules só pode importar src/contracts e não pode importar irmãos,
// então a regra de arredondamento é COPIADA aqui (meio para cima em inteiros, uma única vez) e o teste
// tests/rules-prescricao/instanciarProtocolo.test.ts prova equivalência com calcularDose (src/rules/dose.ts).
// BSA: se `dados.bsaM2` vier null, é calculada por Mosteller (D-W9-61); em qualquer caso é LIMITADA a [1,40; 2,20] m² (D-W9-60), com aviso visível.
// Calvert: dose(mg) = AUC × (ClCr + 25), com ClCr LIMITADO a 125 mL/min (D-W9-60), com aviso visível.
export const BSA_MIN_M2 = 1.4;
export const BSA_MAX_M2 = 2.2;
export const CLCR_MAX_CALVERT = 125;

/** D-W9-61 · Superfície corporal por Mosteller: √(altura cm × peso kg / 3600), em m², 2 casas. Ausente/inválido ⇒ null (PENDENTE). */
export function bsaMosteller(pesoKg: number | null, alturaCm: number | null): number | null {
  if (pesoKg === null || alturaCm === null || !Number.isFinite(pesoKg) || !Number.isFinite(alturaCm) || pesoKg <= 0 || alturaCm <= 0) return null;
  return Math.round(Math.sqrt((alturaCm * pesoKg) / 3600) * 100) / 100;
}
import type { PrescriptionItem, ProtocolTemplate } from "../../contracts/w10/prescricao.js";

export interface DadosCorporais {
  pesoKg: number | null;
  alturaCm: number | null;
  bsaM2: number | null;
  /** depuração de creatinina, mL/min */
  clcr: number | null;
  /** quando os dados foram medidos (fonte/idade ficam visíveis à UI; a validade é do SafetyEngine) */
  medidoEm: string | null;
}

export type EstadoItem = "PRONTO" | "PENDENTE";

export interface ItemInstanciado {
  item: PrescriptionItem;
  estado: EstadoItem;
  /** por que está PENDENTE (null se PRONTO) */
  motivo: string | null;
  /** limite aplicado ao cálculo (BSA/ClCr), visível ao médico; null se nenhum */
  aviso: string | null;
  /** unidade da dose padrão no template (ex.: "mg/m²"); item.unit passa a ser a unidade calculada ("mg") */
  unidadePadrao: string;
  /** prescribedDose do mesmo item no ciclo anterior (base para os botões −20/−30/−40); null se não houve */
  doseAnteriorPrescrita: number | null;
  medidoEm: string | null;
}

export type RecusaInstanciacao = {
  codigo: "TEMPLATE_NAO_CONFERIDO";
  texto: string;
  templateId: string;
  status: ProtocolTemplate["status"];
};

export type ResultadoInstanciacao =
  | { ok: true; templateId: string; templateVersao: string; itens: ItemInstanciado[]; pendentes: number }
  | { ok: false; recusa: RecusaInstanciacao };

/** Cópia mínima da regra de arredondamento de FN-04 (meio para cima, inteiro). O round(×1e6) só remove ruído de ponto flutuante. */
export function arredondaMeioParaCima(x: number): number {
  return Math.floor(Math.round(x * 1e6) / 1e6 + 0.5);
}

const norm = (t: string): string => t.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase();
const valido = (n: number | null): n is number => n !== null && Number.isFinite(n) && n > 0;

function calcular(item: PrescriptionItem, d: DadosCorporais): { dose: number | null; unidade: string; motivo: string | null; aviso?: string | null } {
  const std = item.standardDose;
  switch (item.doseBasis) {
    case "FIXED":
      return std === null ? { dose: null, unidade: item.unit, motivo: "dose padrão ausente na ficha" } : { dose: std, unidade: item.unit, motivo: null };
    case "MG_KG":
      if (std === null) return { dose: null, unidade: "mg", motivo: "dose padrão ausente na ficha" };
      if (!valido(d.pesoKg)) return { dose: null, unidade: "mg", motivo: "mg/kg sem peso" };
      return { dose: arredondaMeioParaCima(std * d.pesoKg), unidade: "mg", motivo: null };
    case "MG_M2":
      if (std === null) return { dose: null, unidade: "mg", motivo: "dose padrão ausente na ficha" };
      if (!valido(d.pesoKg) || !valido(d.alturaCm)) return { dose: null, unidade: "mg", motivo: "mg/m² sem peso/altura" };
      const bsaBase = valido(d.bsaM2) ? d.bsaM2 : bsaMosteller(d.pesoKg, d.alturaCm);
      if (bsaBase === null) return { dose: null, unidade: "mg", motivo: "mg/m² sem superfície corporal" };
      { const bsa = Math.min(BSA_MAX_M2, Math.max(BSA_MIN_M2, bsaBase));
        const aviso = bsa !== bsaBase ? `BSA ${bsaBase} m² limitada a ${bsa} m² (D-W9-60)` : null;
        return { dose: arredondaMeioParaCima(std * bsa), unidade: "mg", motivo: null, aviso }; }
    case "AUC":
      if (std === null) return { dose: null, unidade: "mg", motivo: "AUC alvo ausente na ficha" };
      if (d.clcr === null || !Number.isFinite(d.clcr) || d.clcr < 0) return { dose: null, unidade: "mg", motivo: "AUC (Calvert) sem clearance de creatinina" };
      { const clcr = Math.min(CLCR_MAX_CALVERT, d.clcr);
        const aviso = clcr !== d.clcr ? `ClCr ${d.clcr} mL/min limitado a ${CLCR_MAX_CALVERT} no Calvert (D-W9-60)` : null;
        return { dose: arredondaMeioParaCima(std * (clcr + 25)), unidade: "mg", motivo: null, aviso }; }
    default:
      return { dose: null, unidade: item.unit, motivo: "base de cálculo OTHER: sem fórmula; conferência manual" };
  }
}

export function instanciarProtocolo(
  template: ProtocolTemplate,
  dados: DadosCorporais,
  cicloAnterior?: readonly PrescriptionItem[],
): ResultadoInstanciacao {
  if (template.status !== "CONFERIDA_MEDICO") {
    return {
      ok: false,
      recusa: {
        codigo: "TEMPLATE_NAO_CONFERIDO",
        texto: `ficha ${template.templateId} está ${template.status}; só CONFERIDA_MEDICO é usável`,
        templateId: template.templateId,
        status: template.status,
      },
    };
  }
  // ocorrência k do mesmo fármaco (ex.: SF aparece várias vezes) casa com a k-ésima do ciclo anterior
  const ant = new Map<string, PrescriptionItem>();
  const cont = new Map<string, number>();
  for (const a of cicloAnterior ?? []) {
    const n = cont.get(norm(a.drug)) ?? 0;
    cont.set(norm(a.drug), n + 1);
    ant.set(`${norm(a.drug)}#${n}`, a);
  }
  const vistos = new Map<string, number>();
  const itens: ItemInstanciado[] = template.itens.map((orig) => {
    const k = vistos.get(norm(orig.drug)) ?? 0;
    vistos.set(norm(orig.drug), k + 1);
    const c = calcular(orig, dados);
    const pronto = c.dose !== null;
    const item: PrescriptionItem = {
      ...orig,
      unit: c.unidade,
      calculatedDose: c.dose,
      prescribedDose: c.dose, // padrão do protocolo; o médico ajusta (−20/−30/−40) ou altera com motivo
      adjustmentPercent: null,
      adjustmentReason: null,
    };
    return {
      item,
      estado: pronto ? "PRONTO" : "PENDENTE",
      motivo: c.motivo,
      aviso: c.aviso ?? null,
      unidadePadrao: orig.unit,
      doseAnteriorPrescrita: ant.get(`${norm(orig.drug)}#${k}`)?.prescribedDose ?? null,
      medidoEm: dados.medidoEm,
    };
  });
  return {
    ok: true,
    templateId: template.templateId,
    templateVersao: template.versao,
    itens,
    pendentes: itens.filter((i) => i.estado === "PENDENTE").length,
  };
}
