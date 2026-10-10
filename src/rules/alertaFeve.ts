// D-W9-34b · FEVE abaixo do limite, com antraciclina ou anti-HER2 programado, é alerta.
// PROVISORIO-W10: trocar EcoFeve / FarmacoProgramado por src/contracts/w10/ quando a ficha publicar o eco e a classe.
import { DataCivil } from "../contracts/base.js";

export interface EcoFeve {
  percentual: number | null;
  metodo: string | null;
  data: string | null;
}

export interface FarmacoProgramado {
  nome: string;
  classe: string | null;
}

export interface EntradaAlertaFeve {
  feve: EcoFeve;
  programados: readonly FarmacoProgramado[];
  hoje?: string;
}

export interface ClasseCardiotoxica {
  id: string;
  sinonimos: readonly string[];
}

export interface RulesetAlertaFeve {
  id: string;
  versao: string;
  decisao: string;
  limiteExclusivo: number;
  classes: readonly ClasseCardiotoxica[];
}

export interface MotivoFeve {
  codigo: string;
  texto: string;
  regraId: string;
  rulesetVersao: string;
}

export interface ResultadoAlertaFeve {
  estado: "ALERTA" | "PENDENTE" | "SEM_ALERTA";
  bloqueiaSalvar: false;
  motivos: MotivoFeve[];
  pendentes: MotivoFeve[];
  decisao: string;
  rulesetVersao: string;
  percentual: number | null;
  metodo: string | null;
  data: string | null;
  farmacos: readonly string[];
}

type Bruto = Record<string, unknown>;

function objeto(valor: unknown, caminho: string): Bruto {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
    throw new Error(`${caminho} ausente`);
  }
  return valor as Bruto;
}

function texto(valor: unknown, caminho: string): string {
  if (typeof valor !== "string" || valor.trim().length === 0) {
    throw new Error(`${caminho} ausente`);
  }
  return valor.trim();
}

function flag(valor: unknown, caminho: string, esperado: boolean): void {
  if (valor !== esperado) throw new Error(`${caminho} inválido`);
}

function dobrar(valor: string): string {
  const mapa: Record<string, string> = {
    á: "a", à: "a", ã: "a", â: "a", ä: "a",
    é: "e", ê: "e", è: "e",
    í: "i", ì: "i",
    ó: "o", õ: "o", ô: "o",
    ú: "u", ù: "u",
    ç: "c",
  };
  let saida = "";
  for (const ch of valor.toLowerCase()) saida += mapa[ch] ?? ch;
  return saida;
}

function limpo(valor: string | null): string | null {
  if (valor === null) return null;
  const t = valor.trim();
  return t.length === 0 ? null : t;
}

function contemFrase(hay: string, frase: string): boolean {
  const t = dobrar(hay);
  const f = dobrar(frase);
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

function classeDe(nome: string, classe: string | null, rs: RulesetAlertaFeve): string | null {
  for (const item of rs.classes) {
    for (const sinonimo of item.sinonimos) {
      if (contemFrase(nome, sinonimo) || (classe !== null && contemFrase(classe, sinonimo))) return item.id;
    }
  }
  return null;
}

export function lerAlertaFeve(json: unknown): RulesetAlertaFeve {
  const raiz = objeto(json, "ruleset");
  const header = objeto(raiz.header, "header");
  const bloco = objeto(raiz.alertaFeve, "alertaFeve");
  flag(bloco.igualAoLimitePassa, "igualAoLimitePassa", true);
  flag(bloco.bloqueiaSalvar, "bloqueiaSalvar", false);
  flag(bloco.ausenteNaoViraZero, "ausenteNaoViraZero", true);
  const limite = bloco.limiteExclusivo;
  if (typeof limite !== "number" || !Number.isFinite(limite)) {
    throw new Error("limiteExclusivo inválido");
  }
  const lista = bloco.classes;
  if (!Array.isArray(lista) || lista.length === 0) throw new Error("classes ausentes");
  const classes: ClasseCardiotoxica[] = [];
  for (const item of lista) {
    const o = objeto(item, "classe");
    const sins = o.sinonimos;
    if (!Array.isArray(sins) || sins.length === 0) throw new Error("sinonimos ausentes");
    const sinonimos: string[] = [];
    for (const s of sins) sinonimos.push(texto(s, "sinonimo"));
    classes.push({ id: texto(o.id, "classe.id"), sinonimos });
  }
  return {
    id: texto(header.id, "header.id"),
    versao: texto(header.versao, "header.versao"),
    decisao: texto(bloco.decisao, "decisao"),
    limiteExclusivo: limite,
    classes,
  };
}

function motivo(codigo: string, corpo: string, rs: RulesetAlertaFeve): MotivoFeve {
  return {
    codigo,
    texto: `${corpo} (${rs.decisao})`,
    regraId: rs.decisao,
    rulesetVersao: rs.versao,
  };
}

function percentualUtil(valor: number | null): number | null {
  if (valor === null) return null;
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0 || valor > 100) return null;
  return valor;
}

export function alertarFeve(entrada: EntradaAlertaFeve, rs: RulesetAlertaFeve): ResultadoAlertaFeve {
  const metodo = limpo(entrada.feve.metodo);
  const data = limpo(entrada.feve.data);
  const casados: { nome: string; classe: string }[] = [];
  for (const farmaco of entrada.programados) {
    const classe = classeDe(farmaco.nome, limpo(farmaco.classe), rs);
    if (classe !== null) casados.push({ nome: farmaco.nome.trim(), classe });
  }
  const base = {
    bloqueiaSalvar: false as const,
    decisao: rs.decisao,
    rulesetVersao: rs.versao,
    metodo,
    data,
    farmacos: casados.map((c) => c.nome),
  };
  if (casados.length === 0) {
    return { ...base, estado: "SEM_ALERTA", motivos: [], pendentes: [], percentual: percentualUtil(entrada.feve.percentual) };
  }
  const nomes = casados.map((c) => c.nome).join(", ");
  const classes = [...new Set(casados.map((c) => c.classe))].join(", ");
  const pendentes: MotivoFeve[] = [];
  if (metodo === null) pendentes.push(motivo("pendente.feve.metodo", `método da FEVE ausente com ${nomes} programado`, rs));
  if (data === null) pendentes.push(motivo("pendente.feve.data", `data da FEVE ausente com ${nomes} programado`, rs));
  if (data !== null && (!DataCivil.safeParse(data).success
    || (entrada.hoje !== undefined && (!DataCivil.safeParse(entrada.hoje).success || data > entrada.hoje)))) {
    return {...base,estado:"PENDENTE",percentual:null,motivos:[],pendentes:[...pendentes,
      motivo("pendente.feve.dataInvalida","data da FEVE inválida ou futura; conferir fonte",rs)]};
  }
  const bruto = entrada.feve.percentual;
  if (bruto === null) {
    return {
      ...base,
      estado: "PENDENTE",
      percentual: null,
      motivos: [],
      pendentes: [motivo("pendente.feve.ausente", `FEVE ausente com ${nomes} programado (${classes}); não vira 0`, rs), ...pendentes],
    };
  }
  const percentual = percentualUtil(bruto);
  if (percentual === null) {
    return {
      ...base,
      estado: "PENDENTE",
      percentual: null,
      motivos: [],
      pendentes: [motivo("pendente.feve.valor", `FEVE inválida (${String(bruto)}) com ${nomes} programado (${classes}); conferir valor`, rs), ...pendentes],
    };
  }
  if (percentual < rs.limiteExclusivo) {
    const metodoTxt = metodo ?? "método ausente";
    const dataTxt = data ?? "data ausente";
    return {
      ...base,
      estado: "ALERTA",
      percentual,
      pendentes,
      motivos: [motivo(
        "alerta.feve.baixa",
        `FEVE ${percentual}% (${metodoTxt}, ${dataTxt}) com ${nomes} programado (${classes}); limite ${rs.limiteExclusivo}%`,
        rs,
      )],
    };
  }
  return { ...base, estado: pendentes.length ? "PENDENTE" : "SEM_ALERTA", percentual, motivos: [], pendentes };
}
