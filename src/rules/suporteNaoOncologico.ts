// D-W9-28/38/47 · alertas de suporte. O texto sai da biblioteca do ruleset. A função não escreve conduta.
// PROVISORIO-W10: trocar EntradaSuporte por src/contracts/w10/ quando a ficha publicar o canal e a lista de uso contínuo.

import type { ClasseMedicacao } from "../contracts/w10/prescricao.js";

export interface MedicamentoUso {
  nome: string;
  classe: ClasseMedicacao | null;
}

export interface EntradaSuporte {
  medicamentos: readonly (string | MedicamentoUso)[] | null;
  horasDiarreia: number | null;
  vomito: boolean | null;
  dm2: boolean | null;
  tempDecimos: number | null;
}

export interface ClasseSuporte {
  id: string;
  sinonimos: readonly string[];
}

export interface TextosSuporte {
  suspenderAntiHipertensivo: string;
  hidratacao: string;
  hiperglicemia: string;
  febre: string;
}

export interface RulesetSuporte {
  id: string;
  versao: string;
  decisao: string;
  decisaoFebre: string;
  decisaoClasse: string;
  horasDiarreiaExclusivo: number;
  febreDecimosExclusivo: number;
  textos: TextosSuporte;
  classes: readonly ClasseSuporte[];
}

export interface AchadoSuporte {
  codigo: string;
  texto: string;
  regraId: string;
  rulesetVersao: string;
}

export interface ResultadoSuporte {
  estado: "ALERTA" | "PENDENTE" | "SEM_ALERTA";
  bloqueiaSalvar: false;
  alertas: AchadoSuporte[];
  pendencias: AchadoSuporte[];
  tempDecimos: number | null;
  decisao: string;
  rulesetVersao: string;
}

type Bruto = Record<string, unknown>;

const MAPA: Record<string, string> = {
  á: "a", à: "a", ã: "a", â: "a", ä: "a",
  é: "e", ê: "e", è: "e",
  í: "i", ì: "i",
  ó: "o", õ: "o", ô: "o",
  ú: "u", ù: "u",
  ç: "c",
};

function objeto(valor: unknown, caminho: string): Bruto {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) throw new Error(`${caminho} ausente`);
  return valor as Bruto;
}

function texto(valor: unknown, caminho: string): string {
  if (typeof valor !== "string" || valor.trim().length === 0) throw new Error(`${caminho} ausente`);
  return valor.trim();
}

function flag(valor: unknown, caminho: string, esperado: boolean): void {
  if (valor !== esperado) throw new Error(`${caminho} inválido`);
}

function inteiro(valor: unknown, caminho: string): number {
  if (typeof valor !== "number" || !Number.isInteger(valor)) throw new Error(`${caminho} inválido`);
  return valor;
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

function classeDe(nome: string, classe: string | null, rs: RulesetSuporte): string | null {
  for (const item of rs.classes) {
    for (const sinonimo of item.sinonimos) {
      if (contemFrase(nome, sinonimo) || (classe !== null && contemFrase(classe, sinonimo))) return item.id;
    }
  }
  return null;
}

function nomes(entrada: EntradaSuporte): { nome: string; classe: string | null }[] | null {
  if (entrada.medicamentos === null) return null;
  const lista: { nome: string; classe: string | null }[] = [];
  for (const item of entrada.medicamentos) {
    if (typeof item === "string") {
      const nome = item.trim();
      if (nome.length > 0) lista.push({ nome, classe: null });
    } else {
      const nome = item.nome.trim();
      if (nome.length > 0) lista.push({ nome, classe: item.classe });
    }
  }
  return lista;
}

function temClasse(lista: readonly { nome: string; classe: string | null }[], id: string, rs: RulesetSuporte): boolean {
  return lista.some((med) => classeDe(med.nome, med.classe, rs) === id);
}

export function lerSuporte(json: unknown): RulesetSuporte {
  const raiz = objeto(json, "ruleset");
  const header = objeto(raiz.header, "header");
  const bloco = objeto(raiz.suporte, "suporte");
  flag(bloco.bloqueiaSalvar, "bloqueiaSalvar", false);
  flag(bloco.igualAsHorasNaoAlerta, "igualAsHorasNaoAlerta", true);
  flag(bloco.igualAFebreNaoAlerta, "igualAFebreNaoAlerta", true);
  const textosBrutos = objeto(bloco.textos, "textos");
  const classesBrutas = bloco.classes;
  if (!Array.isArray(classesBrutas) || classesBrutas.length === 0) throw new Error("classes ausentes");
  const classes: ClasseSuporte[] = classesBrutas.map((item, i) => {
    const o = objeto(item, `classes[${i}]`);
    const sins = o.sinonimos;
    if (!Array.isArray(sins) || sins.length === 0) throw new Error(`classes[${i}].sinonimos ausente`);
    return { id: texto(o.id, `classes[${i}].id`), sinonimos: sins.map((s, j) => texto(s, `sinonimo[${j}]`)) };
  });
  return {
    id: texto(header.id, "header.id"),
    versao: texto(header.versao, "header.versao"),
    decisao: texto(bloco.decisao, "decisao"),
    decisaoFebre: texto(bloco.decisaoFebre, "decisaoFebre"),
    decisaoClasse: texto(bloco.decisaoClasse, "decisaoClasse"),
    horasDiarreiaExclusivo: inteiro(bloco.horasDiarreiaExclusivo, "horasDiarreiaExclusivo"),
    febreDecimosExclusivo: inteiro(bloco.febreDecimosExclusivo, "febreDecimosExclusivo"),
    textos: {
      suspenderAntiHipertensivo: texto(textosBrutos.suspenderAntiHipertensivo, "textos.suspenderAntiHipertensivo"),
      hidratacao: texto(textosBrutos.hidratacao, "textos.hidratacao"),
      hiperglicemia: texto(textosBrutos.hiperglicemia, "textos.hiperglicemia"),
      febre: texto(textosBrutos.febre, "textos.febre"),
    },
    classes,
  };
}

function achado(codigo: string, corpo: string, decisao: string, rs: RulesetSuporte): AchadoSuporte {
  return { codigo, texto: `${corpo} (${decisao})`, regraId: decisao, rulesetVersao: rs.versao };
}

export function alertarSuporte(entrada: EntradaSuporte, rs: RulesetSuporte): ResultadoSuporte {
  const alertas: AchadoSuporte[] = [];
  const pendencias: AchadoSuporte[] = [];
  const lista = nomes(entrada);
  const horas = entrada.horasDiarreia;
  const diarreia = horas === null ? null : Number.isFinite(horas) && horas > 0;
  const maisDe24 = horas === null || !Number.isFinite(horas) ? null : horas > rs.horasDiarreiaExclusivo;

  if (maisDe24 === true) {
    if (lista === null) {
      pendencias.push(achado(
        "pendente.lista",
        "lista de medicamentos ausente com diarreia acima de 24 h; não vira ausência de anti-hipertensivo",
        rs.decisaoClasse,
        rs,
      ));
    } else if (temClasse(lista, "anti-hipertensivo", rs)) {
      alertas.push(achado("alerta.anti-hipertensivo", rs.textos.suspenderAntiHipertensivo, rs.decisao, rs));
    }
  }

  if (entrada.vomito === true && diarreia === true) {
    alertas.push(achado("alerta.hidratacao", rs.textos.hidratacao, rs.decisao, rs));
  } else if (entrada.vomito === true && diarreia === null) {
    pendencias.push(achado("pendente.diarreia", "vômito com duração da diarreia ausente; não conclui hidratação", rs.decisao, rs));
  } else if (entrada.vomito === null && diarreia === true) {
    pendencias.push(achado("pendente.vomito", "diarreia com vômito ausente; não conclui hidratação", rs.decisao, rs));
  }

  const corticoide = lista === null ? null : temClasse(lista, "corticoide", rs);
  if (corticoide === true && entrada.dm2 === true) {
    alertas.push(achado("alerta.hiperglicemia", rs.textos.hiperglicemia, rs.decisao, rs));
  } else if (corticoide === true && entrada.dm2 === null) {
    pendencias.push(achado("pendente.dm2", "corticoide na lista e DM-2 ausente; não vira ausência de diabetes", rs.decisaoClasse, rs));
  } else if (entrada.dm2 === true && lista === null) {
    pendencias.push(achado("pendente.lista", "DM-2 com lista de medicamentos ausente; não conclui corticoide", rs.decisaoClasse, rs));
  }

  const temp = entrada.tempDecimos;
  if (temp !== null && Number.isFinite(temp) && temp > rs.febreDecimosExclusivo) {
    alertas.push(achado("alerta.febre", rs.textos.febre, rs.decisaoFebre, rs));
  }

  const estado = alertas.length > 0 ? "ALERTA" : pendencias.length > 0 ? "PENDENTE" : "SEM_ALERTA";
  return {
    estado,
    bloqueiaSalvar: false,
    alertas,
    pendencias,
    tempDecimos: temp === null || !Number.isFinite(temp) ? null : temp,
    decisao: rs.decisao,
    rulesetVersao: rs.versao,
  };
}
