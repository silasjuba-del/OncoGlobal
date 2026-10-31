import { arredondarDoseMg } from "../../contracts/doseReducao.js";
// W10-INT-PRESC-02 · template conferido → itens com dose calculada (D-W9-45, D-W9-22b).
// IA propõe, CÓDIGO calcula, médico decide. Função pura.
//
// A conta protocolar (mg/m², mg/kg, AUC) arredonda o produto aqui e não chama a redução
// da dose anterior (D-F1-52, src/contracts/doseReducao.ts).
// D-F0C-01: SC real, sem piso/teto; se ausente, calculada por Mosteller com peso real.
// Calvert: dose(mg) = AUC × (ClCr + 25), com ClCr LIMITADO a 125 mL/min (D-W9-60), com aviso visível.
export const CLCR_MAX_CALVERT = 125;

/** D-W9-61 · Superfície corporal por Mosteller: √(altura cm × peso kg / 3600), em m², 2 casas. Ausente/inválido ⇒ null (PENDENTE). */
export function bsaMosteller(pesoKg: number | null, alturaCm: number | null): number | null {
  if (pesoKg === null || alturaCm === null || !Number.isFinite(pesoKg) || !Number.isFinite(alturaCm) || pesoKg <= 0 || alturaCm <= 0) return null;
  const produto = alturaCm * pesoKg;
  if (!Number.isFinite(produto)) return null; // intermediário transbordou: pendência, nunca Infinity (sem piso/teto)
  return Math.round(Math.sqrt(produto / 3600) * 100) / 100;
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
  /** Nome legado da base anterior. No HTTP, K-06 usa quantidade efetivamente administrada,
   * com proveniência no draft; não usa a dose apenas planejada. null quando a base não é comprovada. */
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

/** Meio para cima do produto protocolar (mg/m² × SC, mg/kg, AUC). Não é a redução da dose anterior.
 * O round(×1e6) só remove ruído de ponto flutuante.
 * Finitude (FUGU-R2 F): entrada não finita ⇒ null (o chamador devolve PENDENTE estruturada). Se o ×1e6 transbordaria,
 * o double já é inteiro exato nessa magnitude e o arredondamento é a identidade: devolve o valor finito sem escala, sem teto. */
export function arredondaMeioParaCima(x: number): number | null {
  if (!Number.isFinite(x)) return null;
  const escalonado = x * 1e6;
  if (!Number.isFinite(escalonado)) return x;
  return Math.floor(Math.round(escalonado) / 1e6 + 0.5);
}

const norm = (t: string): string => t.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase();
const valido = (n: number | null): n is number => n !== null && Number.isFinite(n) && n > 0;

function calcular(item: PrescriptionItem, d: DadosCorporais): { dose: number | null; unidade: string; motivo: string | null; aviso?: string | null } {
  const std = item.standardDose;
  if (item.sequenciamentoPendente) return { dose: null, unidade: item.unit, motivo: item.sequenciamentoPendente };
  if (item.resgateMtx) return { dose: null, unidade: item.unit,
    motivo: "Resgate MTX contínuo q6h: exige níveis, horário de início e plano individual de doses/vias; não gerar curso finito automaticamente" };
  switch (item.doseBasis) {
    case "FIXED":
      if (std === null) return { dose: null, unidade: item.unit, motivo: "dose padrão ausente na ficha" };
      if (!Number.isFinite(std)) return { dose: null, unidade: item.unit, motivo: "dose padrão não finita na ficha" };
      return { dose: std, unidade: item.unit, motivo: null };
    case "MG_KG": {
      if (/µg|μg|mcg|ug/i.test(item.unit)) return { dose: null, unidade: item.unit, motivo: "unidade micrograma incompatível com base MG_KG" };
      if (std === null) return { dose: null, unidade: "mg", motivo: "dose padrão ausente na ficha" };
      if (!valido(d.pesoKg)) return { dose: null, unidade: "mg", motivo: "mg/kg sem peso" };
      const doseKg = arredondarDoseMg(std * d.pesoKg);
      return doseKg === null
        ? { dose: null, unidade: "mg", motivo: "cálculo mg/kg não finito (overflow no produto dose × peso)" }
        : { dose: doseKg, unidade: "mg", motivo: null };
    }
    case "MCG_KG": {
      if (!/^(?:µg|μg|mcg|ug)(?:\/kg)?$/i.test(item.unit.trim()))
        return { dose: null, unidade: item.unit, motivo: "unidade incompatível com base MCG_KG; conferir microgramas por kg" };
      if (std === null || !valido(d.pesoKg)) return { dose: null, unidade: "µg", motivo: "µg/kg sem dose padrão ou peso" };
      const doseMcg = arredondaMeioParaCima(std * d.pesoKg);
      return doseMcg === null
        ? { dose: null, unidade: "µg", motivo: "cálculo µg/kg não finito (overflow no produto dose × peso)" }
        : { dose: doseMcg, unidade: "µg", motivo: null };
    }
    case "MG_M2": {
      if (std === null) return { dose: null, unidade: "mg", motivo: "dose padrão ausente na ficha" };
      if (!valido(d.pesoKg) || !valido(d.alturaCm)) return { dose: null, unidade: "mg", motivo: "mg/m² sem peso/altura" };
      const bsaBase = valido(d.bsaM2) ? d.bsaM2 : bsaMosteller(d.pesoKg, d.alturaCm);
      if (bsaBase === null) return { dose: null, unidade: "mg", motivo: "mg/m² sem superfície corporal" };
      const doseM2 = arredondarDoseMg(std * bsaBase);
      return doseM2 === null
        ? { dose: null, unidade: "mg", motivo: "cálculo mg/m² não finito (overflow no produto dose × SC)", aviso: null }
        : { dose: doseM2, unidade: "mg", motivo: null, aviso: null };
    }
    case "AUC":
      if (std === null) return { dose: null, unidade: "mg", motivo: "AUC alvo ausente na ficha" };
      if (d.clcr === null || !Number.isFinite(d.clcr) || d.clcr < 0) return { dose: null, unidade: "mg", motivo: "AUC (Calvert) sem clearance de creatinina" };
      { const clcr = Math.min(CLCR_MAX_CALVERT, d.clcr);
        const aviso = clcr !== d.clcr ? `ClCr ${d.clcr} mL/min limitado a ${CLCR_MAX_CALVERT} no Calvert (D-W9-60)` : null;
        const doseAuc = arredondarDoseMg(std * (clcr + 25));
        return doseAuc === null
          ? { dose: null, unidade: "mg", motivo: "cálculo Calvert não finito (overflow no produto AUC × (ClCr + 25))", aviso }
          : { dose: doseAuc, unidade: "mg", motivo: null, aviso }; }
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
    if (c.dose !== null && orig.doseMaximaMg !== undefined) {
      if (c.unidade !== "mg") { c.dose = null; c.motivo = "teto em mg incompatível com unidade calculada"; }
      else if (c.dose > orig.doseMaximaMg) {
        c.dose = orig.doseMaximaMg;
        c.aviso = `Teto por administração aplicado: ${orig.doseMaximaMg} mg (fonte da ficha)`;
      }
    }
    let infusionTime = orig.infusionTime;
    if (c.dose !== null && orig.taxaMaximaMgMin !== undefined) {
      const tempo = /^(\d+(?:\.\d+)?)\s*(min|h)$/.exec(infusionTime ?? "");
      if (c.unidade !== "mg" || !tempo) { c.dose = null; c.motivo = "taxa máxima exige dose em mg e duração legível"; }
      else {
        const minutos = Number(tempo[1]) * (tempo[2] === "h" ? 60 : 1);
        if (!Number.isFinite(minutos)) {
          c.dose = null;
          c.motivo = "duração de infusão declarada não finita após conversão para minutos; revisar o infusionTime da ficha";
        } else {
          const minimo = Math.ceil(c.dose / orig.taxaMaximaMgMin);
          if (!Number.isFinite(minimo)) {
            c.dose = null;
            c.motivo = `duração de infusão não finita para a taxa máxima de ${orig.taxaMaximaMgMin} mg/min; revisar taxa e dose`;
          } else if (minutos < minimo) { infusionTime = `${minimo} min`; c.aviso = [c.aviso, `Duração ampliada para respeitar ${orig.taxaMaximaMgMin} mg/min`].filter(Boolean).join("; "); }
        }
      }
    }
    const pronto = c.dose !== null;
    const item: PrescriptionItem = {
      ...orig,
      unit: c.unidade,
      infusionTime,
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
