import type { AlvoIntervalo, PrazosRuleset, SaidaIntervalo } from "../contracts/regras.js";

function diferencaDiasCivis(de: string, ate: string): number {
  const a = Date.UTC(Number(de.slice(0, 4)), Number(de.slice(5, 7)) - 1, Number(de.slice(8, 10)));
  const b = Date.UTC(Number(ate.slice(0, 4)), Number(ate.slice(5, 7)) - 1, Number(ate.slice(8, 10)));
  return Math.trunc((b - a) / 86_400_000);
}

/** FN-07 · aviso, nunca bloqueio. Igual ao intervalo passa. RT_CONCOMITANTE nunca avisa. */
export function avisoIntervaloPosQt(
  ultimaAdministracaoQt: string | null,
  dataAlvo: string,
  alvo: AlvoIntervalo,
  rs: PrazosRuleset,
): SaidaIntervalo {
  const versao = rs.header.versao;
  if (alvo === "RT_CONCOMITANTE") {
    const dias = ultimaAdministracaoQt === null
      ? null
      : diferencaDiasCivis(ultimaAdministracaoQt, dataAlvo);
    return {
      estado: "VERDE",
      dias,
      motivo: "intervalo não se aplica à radioterapia concomitante",
      rulesetVersao: versao,
    };
  }
  if (ultimaAdministracaoQt === null) {
    return {
      estado: "PENDENTE",
      dias: null,
      motivo: "data da última quimioterapia ausente",
      rulesetVersao: versao,
    };
  }
  const dias = diferencaDiasCivis(ultimaAdministracaoQt, dataAlvo);
  if (dias >= rs.intervaloPosQtDias) {
    return {
      estado: "VERDE",
      dias,
      motivo: "intervalo pós-quimioterapia respeitado",
      rulesetVersao: versao,
    };
  }
  return {
    estado: "VERMELHO",
    dias,
    motivo: "intervalo pós-quimioterapia menor que o previsto (aviso)",
    rulesetVersao: versao,
  };
}
