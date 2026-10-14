// FN-16 · semáforo de interações. Achado vermelho não bloqueia salvar (D-W9-22d).
// PROVISORIO-W10: trocar MedicamentoInformado por src/contracts/w10/prescricao.ts PrescriptionItem quando o chamador passar o item inteiro.
// A classe usa o contrato já publicado.

import { casaTermoFarmaco, identidadeFarmaco, referenciaComTrecho, type CatalogoInteracoes } from "../contracts/f0c/interacoes.js";
import type { ClasseMedicacao } from "../contracts/w10/prescricao.js";

export interface MedicamentoInformado {
  nome: string;
  classe: ClasseMedicacao | null;
}

export interface EntradaSemaforo {
  medicamentos: readonly (string | MedicamentoInformado)[] | null;
  checagemCompleta?: boolean;
  /** Avaliação documental explícita do conjunto, nunca cobertura inferida por booleano. */
  cobertura?: { medicamentos: readonly string[]; pares: readonly { drogaA: string; drogaB: string }[]; fonte: string };
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

interface Med { nome: string; classe: string | null }

function textoItem(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function fonteSustenta(item: ItemSemaforo): boolean {
  if (item.ativo !== true) return false;
  return referenciaComTrecho(item.fonte);
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
    if (typeof item !== "object" || item === null || typeof item.nome !== "string") continue;
    const nome = item.nome.trim();
    if (nome.length > 0) meds.push({ nome, classe: item.classe });
  }
  return meds;
}

function parEncontrado(item: ItemSemaforo, meds: readonly Med[], catalogo?: CatalogoInteracoes): boolean {
  const a = textoItem(item.drogaA);
  const b = textoItem(item.drogaBouClasse);
  if (a.length === 0 || b.length === 0) return false;
  for (let i = 0; i < meds.length; i += 1) {
    for (let j = 0; j < meds.length; j += 1) {
      if (i === j) continue;
      const esquerda = meds[i];
      const direita = meds[j];
      if (esquerda === undefined || direita === undefined) continue;
      if (casaTermoFarmaco(a, esquerda.nome, catalogo) && casaTermoFarmaco(b, direita.nome, catalogo)) return true;
    }
  }
  return false;
}

function pendente(motivo: string, versao: string | null): ResultadoSemaforo {
  return { estado: "PENDENTE", bloqueiaSalvar: false, motivo, achados: [], rulesetVersao: versao };
}

export function semaforoInteracoes(input: EntradaSemaforo, rs: RulesetSemaforo, catalogo?: CatalogoInteracoes): ResultadoSemaforo {
  const versao = typeof rs.header?.versao === "string" ? rs.header.versao : null;
  const meds = lerMeds(input.medicamentos);
  if (meds === null || meds.length === 0) {
    return pendente("lista de medicamentos incompleta (D-W9-47)", versao);
  }
  const itens = Array.isArray(rs.interacoes) ? rs.interacoes : [];
  const casados = itens.filter((item) => parEncontrado(item, meds, catalogo));
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
  if (meds.length !== input.medicamentos?.length) return pendente("lista de medicamentos incompleta (D-W9-47)", versao);
  const estruturado = meds.some((m) => m.classe !== null);
  if (estruturado && !meds.some((m) => m.classe === "NAO_ONCOLOGICA")) {
    return pendente("lista sem a classe NÃO ONCOLÓGICAS (D-W9-47)", versao);
  }
  const cobertura = input.cobertura;
  const nomes = [...new Set(meds.map((m) => identidadeFarmaco(m.nome, catalogo)))];
  const cobertos = cobertura?.medicamentos.map((m) => identidadeFarmaco(m, catalogo)) ?? [];
  const paresCobertos = nomes.every((a, i) => nomes.slice(i + 1).every((b) => cobertura?.pares.some((par) => {
    const pa = identidadeFarmaco(par.drogaA, catalogo);
    const pb = identidadeFarmaco(par.drogaB, catalogo);
    return (pa === a && pb === b) || (pa === b && pb === a);
  })));
  if (input.checagemCompleta !== true || !cobertura?.fonte.trim() || cobertura.fonte.includes("[VERIFICAR]") || nomes.some((n) => !n || !cobertos.includes(n)) || !paresCobertos) {
    return pendente("checagem incompleta; medicamentos ou pares sem cobertura documental explícita (D-W9-22d)", versao);
  }
  return {
    estado: "VERDE",
    bloqueiaSalvar: false,
    motivo: "sem interação na avaliação documental explícita dos medicamentos e pares (D-W9-22d)",
    achados: [],
    rulesetVersao: versao,
  };
}
