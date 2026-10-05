import type { EntradaPreConsulta, SnapshotConfirmado } from "../../src/modules/consulta/preConsulta.js";

export const HOJE = "2026-10-05";

export const PRAZOS_D85 = { avisoNoDia: 85, venceNoDia: 90, fonte: "DECISOES Q20+Q34" };

export function snapshot(
  sobre: Partial<SnapshotConfirmado> & Pick<SnapshotConfirmado, "snapshotId" | "patientId">,
): SnapshotConfirmado {
  return {
    kind: "CONFIRMED",
    tumorLotId: "lot-01",
    encounterId: "enc-01",
    fatos: [],
    pendencias: null,
    tratamento: null,
    cumulativos: null,
    contatos: null,
    apac: null,
    decisoes: null,
    ...sobre,
  };
}

export function entrada(
  atual: SnapshotConfirmado,
  anterior: SnapshotConfirmado | null,
  extra: Partial<Pick<EntradaPreConsulta, "hoje" | "prazosApac" | "direcoes">> = {},
): EntradaPreConsulta {
  return {
    atual,
    anterior,
    hoje: extra.hoje ?? HOJE,
    prazosApac: extra.prazosApac === undefined ? PRAZOS_D85 : extra.prazosApac,
    direcoes: extra.direcoes === undefined ? null : extra.direcoes,
  };
}
