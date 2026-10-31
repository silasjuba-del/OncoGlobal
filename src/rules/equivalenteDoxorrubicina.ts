/** ESC 2022, tabela 5. Idarrubicina × 5 é razão de eficácia, não de cardiotoxicidade. */
const FATOR: Record<string, number> = {
  doxorrubicina: 1,
  epirrubicina: 0.8,
  daunorrubicina: 0.6,
  idarrubicina: 5,
  mitoxantrona: 10.5,
};

function canon(nome: string): string {
  const base = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (base === "doxorubicina") return "doxorrubicina";
  if (base === "epirubicina") return "epirrubicina";
  if (base === "idarubicina" || base === "idarrubicina") return "idarrubicina";
  if (base === "daunorubicina" || base === "daunorrubicina") return "daunorrubicina";
  if (base === "mitoxantrone" || base === "mitoxantrona") return "mitoxantrona";
  return base;
}

export interface ResultadoEquivalenteDoxorrubicina {
  estado: "AVISO" | "ALARANJADO" | "SEM_AVISO" | "PENDENTE";
  equivalenteMgM2: number | null;
  pendencias: string[];
  motivo: string;
  bloqueiaSalvar: false;
}

/** Soma o equivalente e mantém o teto de cada droga no próprio lugar. Alerta em 250, 400 e 550. */
export function equivalenteDoxorrubicina(
  doses: readonly { droga: string; mgM2: number }[],
  rtMediastino = false,
): ResultadoEquivalenteDoxorrubicina {
  const pendencias: string[] = [];
  let soma = 0;
  let alguma = false;
  let temIda = false;
  for (const dose of doses) {
    if (!Number.isFinite(dose.mgM2) || dose.mgM2 < 0) {
      pendencias.push(`DOSE_INVALIDA:${dose.droga}`);
      continue;
    }
    const fator = FATOR[canon(dose.droga)];
    if (fator === undefined) {
      pendencias.push(`DROGA_SEM_FATOR:${dose.droga}`);
      continue;
    }
    alguma = true;
    if (canon(dose.droga) === "idarrubicina" && dose.mgM2 > 0) temIda = true;
    soma += dose.mgM2 * fator;
  }
  const equivalenteMgM2 = alguma ? Math.round(soma * 10) / 10 : null;
  const ida = temIda ? " Idarrubicina × 5 é razão de eficácia, não de cardiotoxicidade (ESC 2022, tabela 5)." : "";
  const rt = rtMediastino ? " RT mediastinal é agravante." : "";
  if (pendencias.length && equivalenteMgM2 === null) {
    return { estado: "PENDENTE", equivalenteMgM2: null, pendencias, motivo: "equivalente incompleto", bloqueiaSalvar: false };
  }
  if (equivalenteMgM2 === null) {
    return { estado: "PENDENTE", equivalenteMgM2: null, pendencias: ["HISTORICO_AUSENTE"], motivo: "sem dose de antraciclina", bloqueiaSalvar: false };
  }
  let estado: ResultadoEquivalenteDoxorrubicina["estado"] = "SEM_AVISO";
  let faixa = "abaixo de 250 mg/m² de equivalente";
  if (equivalenteMgM2 >= 550) { estado = "AVISO"; faixa = "atingiu 550 mg/m² de equivalente"; }
  else if (equivalenteMgM2 >= 400) { estado = "AVISO"; faixa = "atingiu 400 mg/m² de equivalente"; }
  else if (equivalenteMgM2 >= 250) { estado = "ALARANJADO"; faixa = "alto risco a partir de 250 mg/m² de equivalente"; }
  else if (rtMediastino) { estado = "ALARANJADO"; faixa = "abaixo de 250 mg/m², com RT mediastinal"; }
  if (pendencias.length) estado = estado === "AVISO" ? "AVISO" : "PENDENTE";
  return {
    estado,
    equivalenteMgM2,
    pendencias,
    motivo: `Equivalente de doxorrubicina ${equivalenteMgM2} mg/m²: ${faixa}.${ida}${rt} O teto de cada droga continua valendo.`,
    bloqueiaSalvar: false,
  };
}
