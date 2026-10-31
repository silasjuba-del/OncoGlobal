import { diferencaDiasCivis } from "./datas.js";
import type { Pesagem, SaidaPeso, SalaoRuleset } from "../contracts/regras.js";


function acaoPesoVermelho(rs: SalaoRuleset): string[] {
  const extra = rs.pesoVermelho as { acao?: unknown };
  if (Array.isArray(extra.acao) && extra.acao.every((x) => typeof x === "string")) {
    return extra.acao.slice();
  }
  return [];
}

function limiarPercentual(rs: SalaoRuleset, bmi: number | null): number {
  const extra = rs.pesoVermelho as { perdaPctAcimaDe?: unknown; perdaPctSeImcAbaixoDe?: unknown; imcAbaixoDe?: unknown };
  const padrao = typeof extra.perdaPctAcimaDe === "number" ? extra.perdaPctAcimaDe : 5;
  const magro = typeof extra.perdaPctSeImcAbaixoDe === "number" ? extra.perdaPctSeImcAbaixoDe : 2;
  const imcCorte = typeof extra.imcAbaixoDe === "number" ? extra.imcAbaixoDe : 20;
  return bmi !== null && bmi < imcCorte ? magro : padrao;
}

/** FN-06 · janela inclusiva [hoje − janelaDias, hoje]. Alerta em perda ≥ 5% (ou ≥ 2% se IMC < 20). */
export function avaliarPeso(serie: readonly Pesagem[], hoje: string, rs: SalaoRuleset): SaidaPeso {
  const versao = rs.header.versao;
  if (serie.some(p => !Number.isFinite(p.kg) || p.kg <= 0)) return {
    estado:"PENDENTE",perdaKg:null,motivo:"peso inválido; conferir medida",acao:[],rulesetVersao:versao };
  if(diferencaDiasCivis(hoje,hoje)===null||serie.some(p=>diferencaDiasCivis(p.data,hoje)===null))return {estado:"PENDENTE",perdaKg:null,motivo:"data civil invalida",acao:[],rulesetVersao:versao};
  const janela = rs.pesoVermelho.janelaDias;
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
  if (new Set(naJanela.filter(p=>p.data===recente.data).map(p=>p.kg)).size > 1) return {
    estado:"PENDENTE",perdaKg:null,motivo:"pesagens divergentes na mesma data; conferir fontes",acao:[],rulesetVersao:versao };

  const perdaKg = pico.kg - recente.kg;
  if (pico.kg <= 0) return { estado: "PENDENTE", perdaKg: null, motivo: "peso de referência inválido", acao: [], rulesetVersao: versao };
  const altura = [recente, pico].map((p) => p.alturaCm).find((a) => typeof a === "number" && Number.isFinite(a) && a > 0) ?? null;
  const metros = altura === null ? null : altura / 100;
  const bmi = metros !== null && recente.kg > 0 ? recente.kg / (metros * metros) : null;
  const limiarPct = limiarPercentual(rs, bmi);
  const perdaPct = (perdaKg / pico.kg) * 100;
  if (perdaPct + 1e-9 >= limiarPct) {
    const medidas = pico.origem === "MEDIDO" && recente.origem === "MEDIDO";
    if (medidas) {
      const imcTxt = bmi === null ? "IMC não calculado (altura ausente); vale o corte de 5%" : `IMC ${bmi.toFixed(1)}`;
      return {
        estado: "VERMELHO",
        perdaKg,
        motivo: `perda de ${perdaPct.toFixed(1)}% em ${janela} dias (${imcTxt}); corte ${limiarPct}%`,
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
