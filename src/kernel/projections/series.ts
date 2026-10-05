import { TreatmentAdministration } from "../../contracts/clinico.js";
import type { ClinicalEvent } from "../../contracts/operacao.js";
import { dadosDoEvento, eventosVigentes } from "./snapshot.js";

export interface PontoLab { campo: string; valor: number; unidade: string; data: string; sourceId: string; eventId: string; tumorLotId: string | null }
export interface PontoPeso { kg: number; origem: "MEDIDO" | "INFORMADO_PACIENTE" | "ANTERIOR"; data: string; sourceId: string; eventId: string; tumorLotId: string | null }

export function labSeries(eventos: readonly ClinicalEvent[]): PontoLab[] {
  return eventosVigentes(eventos).filter((e) => e.tipo === "LabResult").flatMap((e) => {
    const d = dadosDoEvento(e);
    if (!d || typeof d.campo !== "string" || typeof d.valor !== "number"
      || typeof d.unidade !== "string" || typeof d.data !== "string" || typeof d.sourceId !== "string") return [];
    return [{ campo: d.campo, valor: d.valor, unidade: d.unidade, data: d.data,
      sourceId: d.sourceId, eventId: e.eventId, tumorLotId: e.tumorLotId }];
  });
}

export function weightSeries(eventos: readonly ClinicalEvent[]): PontoPeso[] {
  return eventosVigentes(eventos).filter((e) => e.tipo === "Weight").flatMap((e) => {
    const d = dadosDoEvento(e);
    if (!d || typeof d.kg !== "number" || !Number.isFinite(d.kg)
      || !["MEDIDO", "INFORMADO_PACIENTE", "ANTERIOR"].includes(String(d.origem))
      || typeof d.data !== "string" || typeof d.sourceId !== "string") return [];
    return [{ kg: d.kg, origem: d.origem as PontoPeso["origem"], data: d.data,
      sourceId: d.sourceId, eventId: e.eventId, tumorLotId: e.tumorLotId }];
  });
}

export function administrations(eventos: readonly ClinicalEvent[]) {
  return eventosVigentes(eventos).filter((e) => e.tipo === "TreatmentAdministration").flatMap((e) => {
    const d = dadosDoEvento(e);
    const parsed = TreatmentAdministration.safeParse(d);
    return parsed.success ? [{ ...parsed.data, eventId: e.eventId, tumorLotId: e.tumorLotId }] : [];
  });
}
