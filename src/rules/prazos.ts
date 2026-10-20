import { diferencaDiasCivis } from "./datas.js";
import type { AlvoIntervalo, PrazosRuleset, SaidaIntervalo } from "../contracts/regras.js";


/** FN-07 · aviso, nunca bloqueio. Igual ao intervalo passa. RT_CONCOMITANTE nunca avisa. */
export function avisoIntervaloPosQt(
  ultimaAdministracaoQt: string | null,
  dataAlvo: string,
  alvo: AlvoIntervalo,
  rs: PrazosRuleset,
): SaidaIntervalo {
  const versao = rs.header.versao;
  if(diferencaDiasCivis(dataAlvo,dataAlvo)===null||(ultimaAdministracaoQt!==null && diferencaDiasCivis(ultimaAdministracaoQt,dataAlvo)===null))return {estado:"PENDENTE",dias:null,motivo:"data civil invalida",rulesetVersao:versao};
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
  if (dias === null) return {estado:"PENDENTE",dias:null,motivo:"data civil invalida",rulesetVersao:versao};
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
