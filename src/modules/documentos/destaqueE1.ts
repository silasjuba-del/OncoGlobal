/** G-06/K-12: regra pura compartilhada pelo harness e pela impressão. */
export function g06E1Destaque(entrada: {
  templateId: string; emergenciaAtiva: boolean; destaqueE1Presente: boolean;
}): { gate: "G-06"; decisao: "PASSA" | "BLOQUEIA_ARTEFATO"; motivo: string } {
  if (entrada.templateId !== "folha-operacional-salao" || entrada.emergenciaAtiva !== true
    || entrada.destaqueE1Presente === true) return { gate: "G-06", decisao: "PASSA", motivo: "ok" };
  return { gate: "G-06", decisao: "BLOQUEIA_ARTEFATO",
    motivo: "emergência ativa sem destaque E1 na folha operacional do salão" };
}
