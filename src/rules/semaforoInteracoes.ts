// FN-16 · semáforo de interações. Achado vermelho não bloqueia salvar (D-W9-22d).
// PROVISORIO-W10: trocar MedicamentoInformado por src/contracts/w10/prescricao.ts PrescriptionItem quando o chamador passar o item inteiro.
// A classe usa o contrato já publicado.

import type { ClasseMedicacao } from "../contracts/w10/prescricao.js";

export interface MedicamentoInformado {
  nome: string;
  classe: ClasseMedicacao | null;
}

export interface EntradaSemaforo {
  medicamentos: readonly (string | MedicamentoInformado)[] | null;
  checagemCompleta?: boolean;
}

export interface ItemSemaforo {
  drogaA?: unknown;
  drogaBouClasse?: unknown;
  ativo?: unknown;
  fonte?: unknown;
  severidade?: unknown;
  gravidadeEditorial?: unknown;
}

export interface RulesetSemaforo {
  header?: { id?: string; versao?: string };
  interacoes?: readonly ItemSemaforo[] | null;
}

export interface AchadoInteracao {
  drogaA: string;
  drogaBouClasse: string;
  texto: string;
}

export interface ResultadoSemaforo {
  estado: "VERMELHO" | "PENDENTE" | "VERDE";
  bloqueiaSalvar: false;
  motivo: string;
  achados: AchadoInteracao[];
  rulesetVersao: string | null;
}

const MAPA: Record<string, string> = {
  á: "a", à: "a", ã: "a", â: "a", ä: "a",
  é: "e", ê: "e", è: "e",
  í: "i", ì: "i",
  ó: "o", õ: "o", ô: "o",
  ú: "u", ù: "u",
  ç: "c",
};

interface Med {
  nome: string;
  classe: string | null;
}

function dobrar(valor: string): string {
  let saida = "";
  for (const ch of valor.toLowerCase()) saida += MAPA[ch] ?? ch;
  return saida;
}

function contemFrase(hay: string, frase: string): boolean {
  const t = dobrar(hay);
  const f = dobrar(frase);
  if (f.length === 0) return false;
  let from = 0;
  while (from < t.length) {
    const i = t.indexOf(f, from);
    if (i < 0) return false;
    const antes = i === 0 ? " " : t[i - 1] ?? " ";
    const depois = i + f.length >= t.length ? " " : t[i + f.length] ?? " ";
    if (!/[a-z0-9]/.test(antes) && !/[a-z0-9]/.test(depois)) return true;
    from = i + 1;
  }
  return false;
}

function casa(regra: string, med: string): boolean {
  const r = dobrar(regra).trim();
  const m = dobrar(med).trim();
  if (r.length === 0 || m.length === 0) return false;
  if (r === m) return true;
  const curto = r.length <= m.length ? r : m;
  const longo = r.length <= m.length ? m : r;
  if (curto.length < 4) return false;
  return contemFrase(longo, curto);
}

function textoItem(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function fonteSustenta(item: ItemSemaforo): boolean {
  if (item.ativo !== true) return false;
  const fonte = item.fonte;
  if (typeof fonte !== "object" || fonte === null) return false;
  const trecho = textoItem((fonte as { trecho?: unknown }).trecho);
  return trecho.length > 0 && trecho !== "[VERIFICAR]";
}

function lerMeds(lista: EntradaSemaforo["medicamentos"]): Med[] | null {
  if (lista === null) return null;
  if (!Array.isArray(lista)) return null;
  const meds: Med[] = [];
  for (const item of lista) {
    if (typeof item === "string") {
      const nome = item.trim();
      if (nome.length > 0) meds.push({ nome, classe: null });
      continue;
    }
    const nome = item.nome.trim();
    if (nome.length > 0) meds.push({ nome, classe: item.classe });
  }
  return meds;
}

function parEncontrado(item: ItemSemaforo, meds: readonly Med[]): boolean {
  const a = textoItem(item.drogaA);
  const b = textoItem(item.drogaBouClasse);
  if (a.length === 0 || b.length === 0) return false;
  for (let i = 0; i < meds.length; i += 1) {
    for (let j = 0; j < meds.length; j += 1) {
      if (i === j) continue;
      const esquerda = meds[i];
      const direita = meds[j];
      if (esquerda === undefined || direita === undefined) continue;
      if (casa(a, esquerda.nome) && casa(b, direita.nome)) return true;
    }
  }
  return false;
}

function pendente(motivo: string, versao: string | null): ResultadoSemaforo {
  return { estado: "PENDENTE", bloqueiaSalvar: false, motivo, achados: [], rulesetVersao: versao };
}

export function semaforoInteracoes(input: EntradaSemaforo, rs: RulesetSemaforo): ResultadoSemaforo {
  const versao = typeof rs.header?.versao === "string" ? rs.header.versao : null;
  const meds = lerMeds(input.medicamentos);
  if (meds === null || meds.length === 0) {
    return pendente("lista de medicamentos incompleta (D-W9-47)", versao);
  }
  const itens = Array.isArray(rs.interacoes) ? rs.interacoes : [];
  const casados = itens.filter((item) => parEncontrado(item, meds));
  const ativos = casados.filter((item) => fonteSustenta(item));
  if (ativos.length > 0) {
    const achados = ativos.map((item) => {
      const drogaA = textoItem(item.drogaA);
      const drogaBouClasse = textoItem(item.drogaBouClasse);
      return {
        drogaA,
        drogaBouClasse,
        texto: `interação ativa: ${drogaA} × ${drogaBouClasse}. Achado, não bloqueio (D-W9-22d)`,
      };
    });
    return {
      estado: "VERMELHO",
      bloqueiaSalvar: false,
      motivo: achados.map((a) => a.texto).join("; "),
      achados,
      rulesetVersao: versao,
    };
  }
  if (casados.length > 0) {
    return pendente("par encontrado sem regra ativa com fonte; checagem incompleta (D-W9-22d)", versao);
  }
  const estruturado = meds.some((m) => m.classe !== null);
  if (estruturado && !meds.some((m) => m.classe === "NAO_ONCOLOGICA")) {
    return pendente("lista sem a classe NÃO ONCOLÓGICAS (D-W9-47)", versao);
  }
  const rulesetAtivo = itens.some((item) => fonteSustenta(item));
  if (!rulesetAtivo || input.checagemCompleta !== true) {
    return pendente("checagem incompleta; ruleset sem interação ativa verificada (D-W9-22d)", versao);
  }
  return {
    estado: "VERDE",
    bloqueiaSalvar: false,
    motivo: "sem interação após checagem completa e ruleset ativo (D-W9-22d)",
    achados: [],
    rulesetVersao: versao,
  };
}
