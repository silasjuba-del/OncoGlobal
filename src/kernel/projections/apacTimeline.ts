import { Apac } from "../../contracts/operacao.js";
import type { ClinicalEvent } from "../../contracts/operacao.js";
import { dadosDoEvento } from "./snapshot.js";

export function apacTimeline(eventos: readonly ClinicalEvent[]) {
  return eventos.filter((e) => e.tipo === "APAC").flatMap((e) => {
    const parsed = Apac.safeParse(dadosDoEvento(e));
    return parsed.success ? [{ ...parsed.data, eventId: e.eventId }] : [];
  });
}
