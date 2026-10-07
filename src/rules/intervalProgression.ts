// D-W9-43 · mesmo sítio + mesmo método + aumento = INTERVAL_PROGRESSION. Nunca gera M1.
// PROVISORIO-W10: trocar ExameSeriado / LacunasNaoSei por src/contracts/w10/ quando a ficha publicar o exame seriado.
// O literal da flag é o ExceptionKind já publicado em src/contracts/w10/extracao.ts.

import type { ExceptionKind } from "../contracts/w10/extracao.js";

export interface ExameSeriado {
  data: string | null;
  metodo: string | null;
  sitio: string | null;
  lateralidade: string | null;
  medidaMm: number | null;
  descricao: string | null;
  exameDirigido: string | null;
}

/** Chaves vêm do ruleset. Valor ausente ou em branco é NÃO SEI, nunca um fato. */
export type LacunasNaoSei = Readonly<Record<string, string | null>>;

export interface GrupoMetodo {
  sinonimos: readonly string[];
}

export interface LateralidadeRegra {
  id: string;
  frases: readonly string[];
}

export interface LacunaRegra {
  chave: string;
  rotulo: string;
}

export interface RulesetIntervalo {
  id: string;
  versao: string;
  decisao: string;
  decisaoLateralidade: string;
  flag: Extract<ExceptionKind, "INTERVAL_PROGRESSION">;
  modeloMotivo: string;
  textoExameDirigido: string;
  textoExameDirigidoAusente: string;
  gruposMetodo: readonly GrupoMetodo[];
  frasesAumento: readonly string[];
  frasesSemAumento: readonly string[];
  negacoes: readonly string[];
  lateralidades: readonly LateralidadeRegra[];
  lacunas: readonly LacunaRegra[];
}

export interface AchadoIntervalo {
  codigo: string;
  texto: string;
  regraId: string;
  rulesetVersao: string;
}

export interface ResultadoIntervalo {
  flag: Extract<ExceptionKind, "INTERVAL_PROGRESSION"> | null;
  estado: "ALERTA" | "PENDENTE" | "SEM_ALERTA";
  bloqueiaSalvar: false;
  geraM1: false;
  sitio: string | null;
  lateralidade: string | null;
  exameDirigido: string | null;
  motivos: AchadoIntervalo[];
  pendencias: AchadoIntervalo[];
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
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
    throw new Error(`${caminho} ausente`);
  }
  return valor as Bruto;
}

function texto(valor: unknown, caminho: string): string {
  if (typeof valor !== "string" || valor.trim().length === 0) throw new Error(`${caminho} ausente`);
  return valor.trim();
}

function flag(valor: unknown, caminho: string, esperado: boolean): void {
  if (valor !== esperado) throw new Error(`${caminho} inválido`);
}

function listaTexto(valor: unknown, caminho: string): string[] {
  if (!Array.isArray(valor) || valor.length === 0) throw new Error(`${caminho} ausente`);
  return valor.map((item, i) => texto(item, `${caminho}[${i}]`));
}

function dobrar(valor: string): string {
  let saida = "";
  for (const ch of valor.toLowerCase()) saida += MAPA[ch] ?? ch;
  return saida;
}

function limpo(valor: string | null): string | null {
  if (valor === null) return null;
  const t = valor.trim();
  return t.length === 0 ? null : t;
}

function indiceFrase(hay: string, frase: string): number {
  const t = dobrar(hay);
  const f = dobrar(frase);
  if (f.length === 0) return -1;
  let from = 0;
  while (from < t.length) {
    const i = t.indexOf(f, from);
    if (i < 0) return -1;
    const antes = i === 0 ? " " : t[i - 1] ?? " ";
    const depois = i + f.length >= t.length ? " " : t[i + f.length] ?? " ";
    if (!/[a-z0-9]/.test(antes) && !/[a-z0-9]/.test(depois)) return i;
    from = i + 1;
  }
  return -1;
}

function contemFrase(hay: string, frase: string): boolean {
  return indiceFrase(hay, frase) >= 0;
}

function palavraAntes(hay: string, indice: number): string {
  const t = dobrar(hay);
  let fim = indice;
  while (fim > 0 && !/[a-z0-9]/.test(t[fim - 1] ?? " ")) fim -= 1;
  let ini = fim;
  while (ini > 0 && /[a-z0-9]/.test(t[ini - 1] ?? " ")) ini -= 1;
  return t.slice(ini, fim);
}

function ocorrenciaNaoNegada(hay: string, frase: string, negacoes: readonly string[]): boolean {
  const t = dobrar(hay);
  const f = dobrar(frase);
  let from = 0;
  while (from < t.length) {
    const i = indiceFrase(t.slice(from), frase);
    if (i < 0) return false;
    const absoluto = from + i;
    const antes = palavraAntes(hay, absoluto);
    const negada = negacoes.some((n) => dobrar(n) === antes);
    if (!negada) return true;
    from = absoluto + Math.max(f.length, 1);
  }
  return false;
}

function tokens(valor: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (const ch of dobrar(valor)) {
    if (/[a-z0-9]/.test(ch)) cur += ch;
    else if (cur.length > 0) {
      out.push(cur);
      cur = "";
    }
  }
  if (cur.length > 0) out.push(cur);
  return out;
}

function semLateralidade(valor: string, rs: RulesetIntervalo): string {
  let t = ` ${dobrar(valor)} `;
  const frases = rs.lateralidades
    .flatMap((l) => l.frases)
    .map((f) => dobrar(f))
    .sort((a, b) => b.length - a.length);
  for (const frase of frases) {
    let from = 0;
    while (from < t.length) {
      const i = t.indexOf(frase, from);
      if (i < 0) break;
      const antes = t[i - 1] ?? " ";
      const depois = t[i + frase.length] ?? " ";
      if (!/[a-z0-9]/.test(antes) && !/[a-z0-9]/.test(depois)) {
        t = `${t.slice(0, i)} ${t.slice(i + frase.length)}`;
        from = i;
      } else from = i + 1;
    }
  }
  return t;
}

function mesmoConjunto(a: readonly string[], b: readonly string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  if (a.join(" ") === b.join(" ")) return true;
  const menor = a.length <= b.length ? a : b;
  const maior = a.length <= b.length ? b : a;
  return menor.every((tok) => maior.includes(tok));
}

function casaMetodo(metodo: string, sinonimo: string): boolean {
  return contemFrase(metodo, sinonimo) || tokens(metodo).join(" ") === tokens(sinonimo).join(" ");
}

function mesmoMetodo(a: string, b: string, rs: RulesetIntervalo): boolean {
  if (tokens(a).join(" ") === tokens(b).join(" ")) return true;
  return rs.gruposMetodo.some((g) => g.sinonimos.some((s) => casaMetodo(a, s)) && g.sinonimos.some((s) => casaMetodo(b, s)));
}

function idLado(texto: string, rs: RulesetIntervalo): { id: string; frase: string } | null {
  let achou: { id: string; frase: string } | null = null;
  for (const lat of rs.lateralidades) {
    for (const frase of lat.frases) {
      if (contemFrase(texto, frase) && (achou === null || dobrar(frase).length > dobrar(achou.frase).length)) {
        achou = { id: lat.id, frase };
      }
    }
  }
  return achou;
}

function ladoDe(exame: ExameSeriado, rs: RulesetIntervalo): { id: string | null; texto: string | null } {
  const campo = limpo(exame.lateralidade);
  if (campo !== null) {
    const id = idLado(campo, rs);
    return { id: id?.id ?? null, texto: campo };
  }
  const blob = `${exame.sitio ?? ""} ${exame.descricao ?? ""}`.trim();
  if (blob.length === 0) return { id: null, texto: null };
  const achou = idLado(blob, rs);
  if (achou === null) return { id: null, texto: null };
  const i = indiceFrase(blob, achou.frase);
  const texto = i < 0 ? achou.frase : blob.slice(i, i + achou.frase.length);
  return { id: achou.id, texto };
}

type TextoAumento = "sim" | "nao" | "conflito" | "ausente";

function textoAumenta(descricao: string | null, rs: RulesetIntervalo): TextoAumento {
  if (descricao === null || descricao.trim().length === 0) return "ausente";
  const estavel = rs.frasesSemAumento.some((f) => contemFrase(descricao, f));
  const aumento = rs.frasesAumento.some((f) => ocorrenciaNaoNegada(descricao, f, rs.negacoes));
  if (estavel && aumento) return "conflito";
  if (aumento) return "sim";
  if (estavel) return "nao";
  return "ausente";
}

type MedidaAumento = "sim" | "nao" | "igual" | "ausente";

function medidaAumenta(anterior: number | null, atual: number | null): MedidaAumento {
  if (anterior === null || atual === null) return "ausente";
  if (typeof anterior !== "number" || typeof atual !== "number") return "ausente";
  if (!Number.isFinite(anterior) || !Number.isFinite(atual)) return "ausente";
  if (atual > anterior) return "sim";
  if (atual === anterior) return "igual";
  return "nao";
}

function achado(codigo: string, corpo: string, rs: RulesetIntervalo): AchadoIntervalo {
  return {
    codigo,
    texto: `${corpo} (${rs.decisao})`,
    regraId: rs.decisao,
    rulesetVersao: rs.versao,
  };
}

export function lerIntervalo(json: unknown): RulesetIntervalo {
  const raiz = objeto(json, "ruleset");
  const header = objeto(raiz.header, "header");
  const bloco = objeto(raiz.intervalProgression, "intervalProgression");
  flag(bloco.bloqueiaSalvar, "bloqueiaSalvar", false);
  flag(bloco.geraM1, "geraM1", false);
  flag(bloco.igualAMedidaNaoAumenta, "igualAMedidaNaoAumenta", true);
  const nomeFlag = texto(bloco.flag, "flag");
  if (nomeFlag !== "INTERVAL_PROGRESSION") throw new Error("flag inválida");
  const gruposBrutos = bloco.gruposMetodo;
  if (!Array.isArray(gruposBrutos) || gruposBrutos.length === 0) throw new Error("gruposMetodo ausentes");
  const gruposMetodo: GrupoMetodo[] = gruposBrutos.map((item, i) => ({
    sinonimos: listaTexto(item, `gruposMetodo[${i}]`),
  }));
  const latBrutas = bloco.lateralidades;
  if (!Array.isArray(latBrutas) || latBrutas.length === 0) throw new Error("lateralidades ausentes");
  const lateralidades: LateralidadeRegra[] = latBrutas.map((item, i) => {
    const o = objeto(item, `lateralidades[${i}]`);
    return { id: texto(o.id, `lateralidades[${i}].id`), frases: listaTexto(o.frases, `lateralidades[${i}].frases`) };
  });
  const lacBrutas = bloco.lacunas;
  if (!Array.isArray(lacBrutas) || lacBrutas.length === 0) throw new Error("lacunas ausentes");
  const lacunas: LacunaRegra[] = lacBrutas.map((item, i) => {
    const o = objeto(item, `lacunas[${i}]`);
    return { chave: texto(o.chave, `lacunas[${i}].chave`), rotulo: texto(o.rotulo, `lacunas[${i}].rotulo`) };
  });
  return {
    id: texto(header.id, "header.id"),
    versao: texto(header.versao, "header.versao"),
    decisao: texto(bloco.decisao, "decisao"),
    decisaoLateralidade: texto(bloco.decisaoLateralidade, "decisaoLateralidade"),
    flag: "INTERVAL_PROGRESSION",
    modeloMotivo: texto(bloco.modeloMotivo, "modeloMotivo"),
    textoExameDirigido: texto(bloco.textoExameDirigido, "textoExameDirigido"),
    textoExameDirigidoAusente: texto(bloco.textoExameDirigidoAusente, "textoExameDirigidoAusente"),
    gruposMetodo,
    frasesAumento: listaTexto(bloco.frasesAumento, "frasesAumento"),
    frasesSemAumento: listaTexto(bloco.frasesSemAumento, "frasesSemAumento"),
    negacoes: listaTexto(bloco.negacoes, "negacoes"),
    lateralidades,
    lacunas,
  };
}

function preencher(modelo: string, sitio: string, lado: string, datas: string): string {
  return modelo.replace("{sitio}", sitio).replace("{lado}", lado).replace("{datas}", datas);
}

export function intervalProgression(
  exameAnterior: ExameSeriado,
  exameAtual: ExameSeriado,
  rs: RulesetIntervalo,
  lacunas: LacunasNaoSei | null = null,
): ResultadoIntervalo {
  const pendencias: AchadoIntervalo[] = [];
  const sitioAnt = limpo(exameAnterior.sitio);
  const sitioAtu = limpo(exameAtual.sitio);
  const metodoAnt = limpo(exameAnterior.metodo);
  const metodoAtu = limpo(exameAtual.metodo);
  const ladoAtu = ladoDe(exameAtual, rs);
  const ladoAnt = ladoDe(exameAnterior, rs);
  const base = {
    bloqueiaSalvar: false as const,
    geraM1: false as const,
    sitio: sitioAtu,
    lateralidade: ladoAtu.texto ?? ladoAnt.texto,
    exameDirigido: null,
    decisao: rs.decisao,
    rulesetVersao: rs.versao,
  };

  if (lacunas !== null) {
    for (const item of rs.lacunas) {
      const valor = limpo(lacunas[item.chave] ?? null);
      if (valor === null) pendencias.push(achado(`naoSei.${item.chave}`, `NÃO SEI: ${item.rotulo}`, rs));
    }
  }

  if (sitioAnt === null || sitioAtu === null) {
    pendencias.push(achado("pendente.exame.sitio", "sítio anatômico ausente; não vira progressão nem M1", rs));
    return { ...base, flag: null, estado: "PENDENTE", motivos: [], pendencias };
  }
  if (metodoAnt === null || metodoAtu === null) {
    pendencias.push(achado("pendente.exame.metodo", "método do exame ausente; não vira progressão nem M1", rs));
    return { ...base, flag: null, estado: "PENDENTE", motivos: [], pendencias };
  }

  const mesmoSitio = mesmoConjunto(tokens(semLateralidade(sitioAnt, rs)), tokens(semLateralidade(sitioAtu, rs)));
  const mesmo = mesmoSitio && mesmoMetodo(metodoAnt, metodoAtu, rs);
  const ladoConflita =
    ladoAnt.id !== null && ladoAtu.id !== null && ladoAnt.id !== ladoAtu.id;
  if (ladoConflita) {
    pendencias.push(achado(
      "pendente.lateralidade",
      `lateralidade divergente (${ladoAnt.texto} × ${ladoAtu.texto}); os dois lados permanecem (${rs.decisaoLateralidade})`,
      rs,
    ));
  }

  const medida = medidaAumenta(exameAnterior.medidaMm, exameAtual.medidaMm);
  const textoCmp = textoAumenta(exameAtual.descricao, rs);
  let aumento = false;
  if (medida === "sim" && (textoCmp === "sim" || textoCmp === "ausente")) aumento = true;
  else if (medida === "ausente" && textoCmp === "sim") aumento = true;
  else if (
    (medida === "sim" && (textoCmp === "nao" || textoCmp === "conflito")) ||
    ((medida === "igual" || medida === "nao") && (textoCmp === "sim" || textoCmp === "conflito")) ||
    (medida === "ausente" && textoCmp === "conflito")
  ) {
    pendencias.push(achado(
      "pendente.aumento.conflito",
      "medida e texto do laudo não contam o mesmo aumento; o conflito permanece e não vira M1",
      rs,
    ));
  }

  if (!mesmo || !aumento || ladoConflita) {
    const estado = pendencias.length > 0 ? "PENDENTE" : "SEM_ALERTA";
    return { ...base, flag: null, estado, motivos: [], pendencias };
  }

  const dataAnt = limpo(exameAnterior.data);
  const dataAtu = limpo(exameAtual.data);
  const datas = dataAnt !== null && dataAtu !== null ? ` (${dataAnt} → ${dataAtu})` : "";
  const lado = base.lateralidade !== null ? ` ${base.lateralidade}` : "";
  const motivos = [achado(
    "INTERVAL_PROGRESSION",
    preencher(rs.modeloMotivo, sitioAtu, lado, datas),
    rs,
  )];
  const dirigido = limpo(exameAtual.exameDirigido);
  if (dirigido === null) {
    pendencias.push(achado("pendente.exame.dirigido", rs.textoExameDirigidoAusente, rs));
  } else {
    pendencias.push(achado("pendente.exame.dirigido", `${rs.textoExameDirigido}: ${dirigido}`, rs));
  }
  return {
    ...base,
    flag: "INTERVAL_PROGRESSION",
    estado: "ALERTA",
    exameDirigido: dirigido,
    motivos,
    pendencias,
  };
}
