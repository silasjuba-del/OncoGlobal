import { Apac } from "../../contracts/operacao.js";
import type { ClinicalEvent } from "../../contracts/operacao.js";
import { dadosDoEvento } from "./snapshot.js";

export function apacTimeline(eventos: readonly ClinicalEvent[]) {
  return eventos.filter((e) => ["APAC", "APAC@1"].includes(e.tipo)).flatMap((e) => {
    const parsed = Apac.safeParse(dadosDoEvento(e));
    return parsed.success ? [{ ...parsed.data, eventId: e.eventId }] : [];
  });
}
