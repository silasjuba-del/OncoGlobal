import { diferencaDiasCivis } from "./datas.js";
import type { Pesagem, SaidaPeso, SalaoRuleset } from "../contracts/regras.js";


function acaoPesoVermelho(rs: SalaoRuleset): string[] {
  const extra = rs.pesoVermelho as { acao?: unknown };
  if (Array.isArray(extra.acao) && extra.acao.every((x) => typeof x === "string")) {
    return extra.acao.slice();
  }
  return [];
}

/** FN-06 · janela inclusiva [hoje − janelaDias, hoje]. Perda igual ao limiar passa. */
export function avaliarPeso(serie: readonly Pesagem[], hoje: string, rs: SalaoRuleset): SaidaPeso {
  const versao = rs.header.versao;
  if(diferencaDiasCivis(hoje,hoje)===null||serie.some(p=>diferencaDiasCivis(p.data,hoje)===null))return {estado:"PENDENTE",perdaKg:null,motivo:"data civil invalida",acao:[],rulesetVersao:versao};
  const janela = rs.pesoVermelho.janelaDias;
  const limiar = rs.pesoVermelho.perdaKgAcimaDe;
  const naJanela = serie.filter((p) => {
    const dias = diferencaDiasCivis(p.data, hoje);
    return dias !== null && dias >= 0 && dias <= janela;
  });

  if (naJanela.length < 2) {
    return {
      estado: "PENDENTE",
      perdaKg: null,
      motivo: "pesagens insuficientes na janela",
      acao: [],
      rulesetVersao: versao,
    };
  }

  let recente = naJanela[0]!;
  let pico = naJanela[0]!;
  for (const p of naJanela) {
    if (p.data > recente.data) recente = p;
    else if (p.data === recente.data) recente = p;
    if (p.kg > pico.kg) pico = p;
  }

  const perdaKg = pico.kg - recente.kg;
  if (perdaKg > limiar) {
    const medidas = pico.origem === "MEDIDO" && recente.origem === "MEDIDO";
    if (medidas) {
      return {
        estado: "VERMELHO",
        perdaKg,
        motivo: "perda de peso acima do limite",
        acao: acaoPesoVermelho(rs),
        rulesetVersao: versao,
      };
    }
    return {
      estado: "PENDENTE",
      perdaKg,
      motivo: "diferença incerta, médico confirma",
      acao: [],
      rulesetVersao: versao,
    };
  }

  return {
    estado: "VERDE",
    perdaKg,
    motivo: "perda dentro do limite",
    acao: [],
    rulesetVersao: versao,
  };
}
