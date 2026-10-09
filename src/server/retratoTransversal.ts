import { DataCivil, Id } from "../contracts/base.js";
import {
  ExtensaoTumor,
  NucleoAP,
  type ExtensaoTumor as ExtensaoTumorTipo,
  type NucleoAP as NucleoAPTipo,
  type OrigemCampoAP as OrigemCampoAPTipo,
  type RetratoTransversal,
} from "../contracts/w12/anatomoPatologico.js";
import { ClinicalFact, type ClinicalFact as ClinicalFactTipo } from "../contracts/w10/extracao.js";

/** Contrato temporário alinhado à mudança integrada: extensao pode ficar null sem apagar o núcleo comum. */
export type RetratoTransversalProjetado = Omit<RetratoTransversal, "extensao"> & { extensao: ExtensaoTumorTipo | null };

export interface EntradaRetratoTransversal {
  patientId: string;
  /** TumorLot confirmado pelo chamador; null significa que não há âncora para o retrato. */
  tumorLotId: string | null;
  /**
   * Fatos já revisados e previamente escopados pelo chamador ao patientId + tumorLotId.
   * ClinicalFact não carrega essa associação; esta função não tenta criá-la nem conferi-la.
   */
  fatos: readonly ClinicalFactTipo[];
  /** Extensão pré-fornecida; só é copiada se passar pelo schema discriminado do tumor. */
  extensao?: unknown;
}

type CampoTextoAP = NucleoAPTipo["histologia"];
type FactComTexto = { fato: ClinicalFactTipo; valor: string };

const PENDENTE = { estado: "NAO_INFORMADO", valor: null, origem: null } as const;

function ordenarFatos(a: ClinicalFactTipo, b: ClinicalFactTipo): number {
  const chaveA = [a.sourceId, a.date ?? "", a.rawEvidence, a.id].join("\u0000");
  const chaveB = [b.sourceId, b.date ?? "", b.rawEvidence, b.id].join("\u0000");
  return chaveA < chaveB ? -1 : chaveA > chaveB ? 1 : 0;
}

function origemDoLaudo(fato: ClinicalFactTipo): OrigemCampoAPTipo {
  const data = fato.date === undefined ? null : DataCivil.safeParse(fato.date);
  return {
    tipo: "LAUDO",
    documentoId: fato.sourceId,
    dataDocumento: data && data.success ? data.data : null,
    trecho: fato.rawEvidence,
  };
}

function fatosTextuais(
  fatos: readonly ClinicalFactTipo[],
  dominio: "histology" | "stage",
): FactComTexto[] {
  return fatos.flatMap((raw) => {
    const validado = ClinicalFact.safeParse(raw);
    if (!validado.success) return [];
    const fato = validado.data;
    if (fato.domain !== dominio || fato.sourceType !== "pathology" || fato.evidence !== "EXPLICIT"
      || fato.requiresConfirmation || fato.patientCandidateId !== null) return [];
    if (fato.value && typeof fato.value === "object" && !Array.isArray(fato.value)
      && "negated" in fato.value && fato.value.negated === true) return [];
    if (typeof fato.value !== "string" || fato.value.trim().length === 0) return [];
    return [{ fato, valor: fato.value }];
  }).sort((a, b) => ordenarFatos(a.fato, b.fato));
}

function projetarCampoTexto(fatos: readonly FactComTexto[]): CampoTextoAP {
  if (fatos.length === 0) return NucleoAP.shape.histologia.parse(PENDENTE);
  const candidatos = fatos.map(({ fato, valor }) => ({ valor, origem: origemDoLaudo(fato) }));
  const valores = new Set(fatos.map(({ valor }) => valor));
  if (valores.size > 1) {
    return NucleoAP.shape.histologia.parse({ estado: "CONFLITO", valor: null, origem: null, candidatos });
  }
  const primeiro = candidatos[0]!;
  // origem só comporta uma fonte no campo VALOR; candidatos retém também todas as fontes iguais.
  return NucleoAP.shape.histologia.parse({ estado: "VALOR", valor: primeiro.valor, origem: primeiro.origem, candidatos });
}

function campoEstagio(fato: ClinicalFactTipo): "cTNM" | "pTNM" | "ypTNM" | null {
  if (typeof fato.value !== "string") return null;
  if (/^ypT/iu.test(fato.value)) return "ypTNM";
  if (/^pT/iu.test(fato.value)) return "pTNM";
  if (/^cT/iu.test(fato.value)) return "cTNM";
  return null;
}

function nucleoPendente(): NucleoAPTipo {
  const campos = Object.fromEntries(Object.keys(NucleoAP.shape).map((campo) => [campo, PENDENTE]));
  return NucleoAP.parse(campos);
}

/**
 * Projeta apenas afirmações literais de laudo AP em núcleo transversal.
 * Associação paciente/lote e decisão de revisão pertencem ao chamador; sem lote confirmado retorna null.
 */
export function projetarRetratoTransversal(entrada: EntradaRetratoTransversal): RetratoTransversalProjetado | null {
  const paciente = Id.safeParse(entrada.patientId);
  const lote = entrada.tumorLotId === null ? null : Id.safeParse(entrada.tumorLotId);
  if (!paciente.success || !lote?.success) return null;

  const fatos = entrada.fatos;
  const histologia = projetarCampoTexto(fatosTextuais(fatos, "histology"));
  const porCampoEstagio = new Map<"cTNM" | "pTNM" | "ypTNM", FactComTexto[]>();
  for (const item of fatosTextuais(fatos, "stage")) {
    const campo = campoEstagio(item.fato);
    if (!campo) continue;
    porCampoEstagio.set(campo, [...(porCampoEstagio.get(campo) ?? []), item]);
  }
  const base = nucleoPendente();
  const nucleo = NucleoAP.parse({
    ...base,
    histologia,
    cTNM: projetarCampoTexto(porCampoEstagio.get("cTNM") ?? []),
    pTNM: projetarCampoTexto(porCampoEstagio.get("pTNM") ?? []),
    ypTNM: projetarCampoTexto(porCampoEstagio.get("ypTNM") ?? []),
  });
  const extensaoValidada = ExtensaoTumor.safeParse(entrada.extensao);
  return {
    pacienteRef: paciente.data,
    tumorIndice: true,
    nucleo,
    extensao: extensaoValidada.success ? extensaoValidada.data as ExtensaoTumorTipo : null,
  };
}
