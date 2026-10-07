// W10-INT-PRESC-01 · parser da receita de uma linha (D-W9-24 §2). Função pura, sem LLM.
// O parser só ESTRUTURA o que o médico escreveu; o que não reconhece vai para `pendencias`.
// Nunca inventa fármaco, dose, via ou frequência. Autocontido (src/rules só importa contracts).
import type { QuickLine } from "../../contracts/w10/prescricao.js";

const UNIDADES: Record<string, string> = {
  MCG: "mcg", UG: "mcg", "µG": "mcg", "μG": "mcg", MG: "mg", G: "g", UI: "UI", ML: "mL",
  CP: "CP", COMP: "CP", CPR: "CP", CAP: "CAP", CAPS: "CAP", AMP: "AMP", GTS: "GTS", GOTAS: "GTS",
};
const VIAS = ["VO", "EV", "IM", "SC", "SL", "TOP"] as const;

type Parsed = QuickLine["parsed"];

/** "1,5" → 1.5; "1.000,5" → 1000.5; "1.250" é ambíguo (milhar ou decimal) → null (vai a pendência). */
function numeroPtBr(raw: string): { valor: number | null; ambiguo: boolean } {
  if (/^\d+$/.test(raw)) return { valor: Number(raw), ambiguo: false };
  if (/^\d+,\d+$/.test(raw)) return { valor: Number(raw.replace(",", ".")), ambiguo: false };
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(raw)) return { valor: Number(raw.replace(/\./g, "").replace(",", ".")), ambiguo: false };
  if (/^\d+\.\d+$/.test(raw)) {
    if (/^\d{1,3}(\.\d{3})+$/.test(raw) && !raw.startsWith("0")) return { valor: null, ambiguo: true };
    return { valor: Number(raw), ambiguo: false };
  }
  return { valor: null, ambiguo: false };
}

const PONTA = /^[\s,;:.\-–—]+|[\s,;:.\-–—]+$/g;

export function parserLinha(expression: string): QuickLine {
  const s = expression;
  const u = s.toUpperCase();
  const consumido: boolean[] = new Array<boolean>(s.length).fill(false);
  const pendencias: string[] = [];
  const out: Parsed = {
    drug: null, doseValue: null, doseUnit: null, route: null, frequency: null,
    prn: false, prnIndication: null, maxDaily: null, duration: null,
  };
  if (u.length !== s.length || s.trim() === "") {
    return { expression, parsed: out, pendencias: ["expressão vazia ou não analisável: nada foi interpretado"] };
  }

  const livre = (i: number, f: number): boolean => {
    for (let k = i; k < f; k++) if (consumido[k]) return false;
    return true;
  };
  const marca = (i: number, f: number): void => { for (let k = i; k < f; k++) consumido[k] = true; };
  /** primeiro casamento cujo trecho ainda está livre */
  const acha = (re: RegExp): RegExpExecArray | null => {
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    for (let m = g.exec(u); m; m = g.exec(u)) {
      if (m[0].length === 0) { g.lastIndex++; continue; }
      if (livre(m.index, m.index + m[0].length)) return m;
    }
    return null;
  };
  const spans: Array<[number, number]> = []; // trechos de dose/via/frequência (delimitam o nome)

  // 1) dose máxima diária: "— MÁX 24 MG/DIA"
  {
    const m = acha(/(?:[—–-]\s*)?\bM[ÁA]X(?:IMO|IMA)?\.?\s*(.*)$/);
    if (m) {
      marca(m.index, m.index + m[0].length);
      const v = (m[1] ?? "").trim();
      if (v) out.maxDaily = s.slice(m.index + m[0].length - (m[1] ?? "").length, m.index + m[0].length).trim();
      else pendencias.push("maxDaily: 'MÁX' sem valor");
    }
  }
  // 2) duração: "POR 7 DIAS"
  {
    const m = acha(/\bPOR\s+(\d+)\s*(DIAS?|D|SEMANAS?|SEM|MESES|M[EÊ]S)\b/);
    if (m) {
      marca(m.index, m.index + m[0].length);
      const n = Number(m[1]);
      const k = m[2] ?? "";
      const t = k.startsWith("D") ? (n === 1 ? "DIA" : "DIAS")
        : k.startsWith("S") ? (n === 1 ? "SEMANA" : "SEMANAS") : (n === 1 ? "MÊS" : "MESES");
      out.duration = `${n} ${t}`;
    }
  }
  // 3) frequência
  {
    let freq: string | null = null;
    let m = acha(/\b(\d{1,2})\s*\/\s*(\d{1,2})\s*H(?:ORAS?)?\b/);
    if (m) {
      marca(m.index, m.index + m[0].length);
      if (m[1] === m[2]) freq = `${Number(m[1])}/${Number(m[2])}H`;
      else pendencias.push(`frequency: "${m[0]}" inconsistente (esperado N/NH)`);
    } else if ((m = acha(/\b(?:A\s+CADA|DE)\s+(\d{1,2})\s*(?:EM\s+\d{1,2}\s*)?H(?:ORAS?)?\b/))) {
      marca(m.index, m.index + m[0].length);
      freq = `${Number(m[1])}/${Number(m[1])}H`;
    } else if ((m = acha(/\b(\d{1,2})\s*X\s*(?:\/|AO|POR|NA)?\s*(DIA|SEMANA)\b/))) {
      marca(m.index, m.index + m[0].length);
      freq = `${Number(m[1])}X/${m[2]}`;
    } else if ((m = acha(/\b(?:DOSE\s+[ÚU]NICA|DU)\b/))) {
      marca(m.index, m.index + m[0].length);
      freq = "DOSE ÚNICA";
    }
    if (m) spans.push([m.index, m.index + m[0].length]);
    out.frequency = freq;
  }
  // 4) dose
  {
    const unidades = "MCG|UG|µG|μG|MG|G|UI|ML|COMP|CPR|CP|CAPS|CAP|AMP|GTS|GOTAS";
    const m = acha(new RegExp(`(?<![\\d.,])(\\d+(?:[.,]\\d+)*)\\s*(${unidades})(?![A-ZÁ-Ú0-9/])`));
    if (m) {
      marca(m.index, m.index + m[0].length);
      spans.push([m.index, m.index + m[0].length]);
      const { valor, ambiguo } = numeroPtBr(m[1] ?? "");
      const unidade = UNIDADES[m[2] ?? ""] ?? null;
      if (valor !== null && valor > 0 && unidade) { out.doseValue = valor; out.doseUnit = unidade; }
      else if (ambiguo) pendencias.push(`doseValue: "${m[1]}" ambíguo (milhar ou decimal); confirmar`);
      else pendencias.push(`doseValue: "${m[0]}" não é uma dose positiva reconhecível`);
    }
  }
  // 5) via
  {
    const m = acha(new RegExp(`\\b(${VIAS.join("|")})\\b`));
    if (m) { marca(m.index, m.index + m[0].length); spans.push([m.index, m.index + m[0].length]); out.route = m[1] ?? null; }
  }
  // 6) PRN: "SE NÁUSEA", "SN NÁUSEA", "S/N", "SE NECESSÁRIO ..."
  {
    const m = acha(/(?<![A-ZÁ-Ú0-9])(SE\s+NECESS[ÁA]RIO|ACM|S\/N|SN|SE)(?![A-ZÁ-Ú0-9])/);
    if (m) {
      out.prn = true;
      let fim = m.index + m[0].length;
      const ini = fim;
      while (fim < s.length && !consumido[fim]) fim++;
      const ind = s.slice(ini, fim).trim().replace(PONTA, "").trim();
      marca(m.index, fim);
      if (ind) out.prnIndication = ind;
      else pendencias.push("prnIndication: uso 'se necessário' sem indicação");
    }
  }
  // 7) nome do fármaco = texto livre ANTES do primeiro trecho de dose/via/frequência
  const ponta = spans.length ? Math.min(...spans.map((x) => x[0])) : s.length;
  const nomeBruto = s.slice(0, ponta);
  const nomeLivre = livre(0, ponta);
  const nome = nomeBruto.trim().replace(PONTA, "");
  if (nome && nomeLivre && /[A-ZÁ-Ú]/.test(nome.toUpperCase())) { out.drug = nome; marca(0, ponta); }
  // 8) sobras que ninguém reconheceu
  const sobras: string[] = [];
  for (let i = 0; i < s.length; ) {
    if (consumido[i]) { i++; continue; }
    let j = i;
    while (j < s.length && !consumido[j]) j++;
    const t = s.slice(i, j).trim().replace(PONTA, "");
    if (t) sobras.push(t);
    i = j;
  }
  if (sobras.length) pendencias.push(`texto não reconhecido: ${sobras.map((t) => `"${t}"`).join(", ")}`);

  if (out.drug === null) pendencias.unshift("drug: fármaco não identificado");
  if (out.doseValue === null && !pendencias.some((p) => p.startsWith("doseValue"))) pendencias.push("doseValue: dose não identificada");
  if (out.route === null) pendencias.push("route: via não identificada");
  if (out.frequency === null && !pendencias.some((p) => p.startsWith("frequency"))) pendencias.push("frequency: frequência não identificada");
  return { expression, parsed: out, pendencias };
}
