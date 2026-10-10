// W10-INT-PRESC-03..05 · fachada de prescrição segura (RT-08a–e, RT-11b). Funções puras.
// src/rules só importa src/contracts (R-08): este arquivo é AUTOSSUFICIENTE; a regra de arredondamento/BSA/Calvert
// é cópia de instanciarProtocolo.ts e tests/rules-prescricao/index.test.ts prova a equivalência.
import { ProtocolTemplate } from "../../contracts/w10/prescricao.js";

/* ───────────── RT-08a/b · biblioteca de fichas versionadas, só CONFERIDA_MEDICO ───────────── */

export type CodigoErroFicha =
  | "FICHA_VERSAO_INEXISTENTE"
  | "FICHA_NAO_CONFERIDA"
  | "FICHA_AMBIGUA"
  | "FICHA_INVALIDA";

/** Erro TIPADO (D-W9-22b): nunca ficha vazia, nunca mistura de versões. A mensagem começa pelo código. */
export class FichaErro extends Error {
  constructor(readonly codigo: CodigoErroFicha, texto: string) {
    super(`${codigo}: ${texto}`);
    this.name = "FichaErro";
  }
}

export interface IdentidadeFicha { nome: string; tumor: string; cenario: string; versao: string }

const chave = (t: string): string =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const rotulo = (i: IdentidadeFicha): string => `${i.nome} · ${i.tumor} · ${i.cenario} · v${i.versao}`;

/** Biblioteca imutável: UMA ficha por identidade completa (nome+tumor+cenário+versão). Corpus entra por parâmetro. */
export interface BibliotecaFichas {
  readonly fichas: readonly ProtocolTemplate[];
  /** Carrega a ficha INTEIRA; lança FichaErro. Só devolve CONFERIDA_MEDICO. */
  carregar(nome: string, tumor: string, cenario: string, versao: string): ProtocolTemplate;
}

export function criarBiblioteca(brutas: readonly unknown[]): BibliotecaFichas {
  const fichas = brutas.map((b, i) => {
    const r = ProtocolTemplate.safeParse(b);
    if (!r.success) throw new FichaErro("FICHA_INVALIDA", `ficha #${i} recusada pelo schema: ${r.error.issues[0]?.message ?? "inválida"}`);
    return r.data;
  });
  const ids = new Set<string>();
  for (const f of fichas) {
    if (ids.has(f.templateId)) throw new FichaErro("FICHA_AMBIGUA", `templateId duplicado na biblioteca: ${f.templateId}`);
    ids.add(f.templateId);
  }
  return {
    fichas,
    carregar(nome, tumor, cenario, versao) {
      const alvo: IdentidadeFicha = { nome, tumor, cenario, versao };
      const mesmaIdentidade = fichas.filter((f) =>
        chave(f.nome) === chave(nome) && chave(f.tumor) === chave(tumor) && chave(f.cenario) === chave(cenario));
      const exatas = mesmaIdentidade.filter((f) => f.versao === versao);
      if (exatas.length === 0) {
        const outras = mesmaIdentidade.map((f) => f.versao).join(", ");
        throw new FichaErro("FICHA_VERSAO_INEXISTENTE",
          `não há ficha ${rotulo(alvo)}${outras ? `; versões existentes: ${outras}` : " (identidade desconhecida)"}`);
      }
      if (exatas.length > 1)
        throw new FichaErro("FICHA_AMBIGUA", `mais de uma ficha para ${rotulo(alvo)}: ${exatas.map((f) => f.templateId).join(", ")}`);
      const ficha = exatas[0]!;
      const u = fichaUsavel(ficha);
      if (!u.usavel) throw new FichaErro("FICHA_NAO_CONFERIDA", u.motivo ?? "ficha não usável");
      return ficha;
    },
  };
}

let bibliotecaPadrao: BibliotecaFichas = criarBiblioteca([]);
/** Raiz de composição registra o corpus (corpus/fichas/**). Sem registro, toda busca falha FICHA_VERSAO_INEXISTENTE. */
export function registrarBiblioteca(brutas: readonly unknown[]): BibliotecaFichas {
  bibliotecaPadrao = criarBiblioteca(brutas);
  return bibliotecaPadrao;
}

/** Enforcement de "só CONFERIDA_MEDICO é usável" (comentário do schema). */
export function fichaUsavel(t: Pick<ProtocolTemplate, "templateId" | "status">): { usavel: boolean; motivo: string | null } {
  return t.status === "CONFERIDA_MEDICO"
    ? { usavel: true, motivo: null }
    : { usavel: false, motivo: `ficha ${t.templateId} está ${t.status}; só CONFERIDA_MEDICO é usável` };
}

/** Carrega UMA ficha inteira por nome+tumor+cenário+versão (async: a biblioteca real pode vir de I/O no chamador). */
export async function carregarFicha(
  nome: string, tumor: string, cenario: string, versao: string, biblioteca: BibliotecaFichas = bibliotecaPadrao,
): Promise<ProtocolTemplate> {
  return biblioteca.carregar(nome, tumor, cenario, versao);
}

/* ───────────── RT-08c · dose por base (código, nunca LLM; CANONICA §6) ───────────── */

const CLCR_MAX = 125;
const meioParaCima = (x: number): number => Math.floor(Math.round(x * 1e6) / 1e6 + 0.5);
const pos = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

export type EntradaDose =
  | { basis: "FIXED"; dose: number | null }
  | { basis: "MG_KG"; mgKg: number | null; pesoKg: number | null }
  | { basis: "MG_M2"; mgM2: number | null; pesoKg: number | null; alturaCm: number | null; bsaM2?: number | null }
  | { basis: "AUC"; auc: number | null; clearance: number | null }
  | { basis: "OTHER" };

export interface SaidaDose {
  estado: "PRONTO" | "PENDENTE";
  doseMg: number | null;
  /** nome(s) do(s) campo(s) faltante(s), separados por vírgula; null se PRONTO */
  pendente: string | null;
  aviso: string | null;
}

const pend = (campos: string[]): SaidaDose => ({ estado: "PENDENTE", doseMg: null, pendente: campos.join(", "), aviso: null });

export function calcularDosePorBase(e: EntradaDose): SaidaDose {
  switch (e.basis) {
    case "FIXED":
      return pos(e.dose) ? { estado: "PRONTO", doseMg: e.dose, pendente: null, aviso: null } : pend(["dose"]);
    case "MG_KG": {
      const f = [!pos(e.mgKg) && "mgKg", !pos(e.pesoKg) && "pesoKg"].filter((x): x is string => x !== false);
      return f.length ? pend(f) : { estado: "PRONTO", doseMg: meioParaCima(e.mgKg! * e.pesoKg!), pendente: null, aviso: null };
    }
    case "MG_M2": {
      const f = [!pos(e.mgM2) && "mgM2", !pos(e.pesoKg) && "pesoKg", !pos(e.alturaCm) && "alturaCm"].filter((x): x is string => x !== false);
      if (f.length) return pend(f);
      const base = pos(e.bsaM2) ? e.bsaM2 : Math.round(Math.sqrt((e.alturaCm! * e.pesoKg!) / 3600) * 100) / 100;
      // D-F0C-01: SC real, sem piso/teto automático.
      return { estado: "PRONTO", doseMg: meioParaCima(e.mgM2! * base), pendente: null, aviso: null };
    }
    case "AUC": {
      if (!pos(e.auc)) return pend(["auc"]);
      if (e.clearance === null || !Number.isFinite(e.clearance) || e.clearance < 0) return pend(["clearance"]);
      const clcr = Math.min(CLCR_MAX, e.clearance);
      return { estado: "PRONTO", doseMg: meioParaCima(e.auc * (clcr + 25)), pendente: null,
        aviso: clcr !== e.clearance ? `ClCr ${e.clearance} mL/min limitado a ${CLCR_MAX} no Calvert (D-W9-60)` : null };
    }
    default:
      return pend(["formula"]);
  }
}
/** Alias aceito pelo red team. */
export const calcularDoseBasis = calcularDosePorBase;

/* ───────────── RT-08e · fonte e idade do dado reutilizado (D-W9-24) ───────────── */

/** D-W9-63 · peso para cálculo de dose vale por 30 dias; depois disso o dado é antigo (pedir peso atual). */
export const PESO_VALIDADE_DIAS = 30;

export interface DadoReutilizado { valor: number | null; unidade?: string; fonte: string | null; medidoEm: string | null }
export interface IdadeDado {
  fonte: string | null;
  medidoEm: string | null;
  /** dias inteiros entre medidoEm e agora; null se a data é ausente/ilegível */
  idadeDias: number | null;
  /** true se idade > limiteDias; null se não há limite informado ou idade desconhecida (nunca presume "fresco") */
  desatualizado: boolean | null;
  texto: string;
}

export function idadeDoDado(d: DadoReutilizado, agora: string, limiteDias?: number): IdadeDado {
  const t0 = d.medidoEm ? Date.parse(d.medidoEm) : NaN;
  const t1 = Date.parse(agora);
  const idadeDias = Number.isFinite(t0) && Number.isFinite(t1) && t1 >= t0 ? Math.floor((t1 - t0) / 86_400_000) : null;
  const desatualizado = idadeDias !== null && limiteDias !== undefined ? idadeDias > limiteDias : null;
  const valor = d.valor === null ? "valor ausente" : `${d.valor}${d.unidade ? ` ${d.unidade}` : ""}`;
  const idade = idadeDias === null ? "idade desconhecida" : `há ${idadeDias} dia(s)`;
  return { fonte: d.fonte, medidoEm: d.medidoEm, idadeDias, desatualizado,
    texto: `${valor} · fonte ${d.fonte ?? "desconhecida"} · ${idade}` };
}
export const idadePeso = idadeDoDado;

/* ───────────── RT-08d · infusão do 5-FU e antiemese do serviço ───────────── */

export type VereditoInfusao = "PASS" | "WARNING" | "BLOCK_ARTEFATO" | "NOT_EVALUABLE";
export interface SaidaInfusao { veredito: VereditoInfusao; motivo: string; fonte: string }

const ehFU = (d: string): boolean => /fluorouracil|fluoruracil|\b5 ?fu\b/u.test(chave(d));

function horas(t: string | null): number | null {
  if (!t) return null;
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(h|hora|horas|min|minutos|d|dias?)\s*$/iu.exec(t);
  if (!m) return null;
  const n = Number(m[1]!.replace(",", "."));
  const u = m[2]!.toLowerCase();
  return u.startsWith("min") ? n / 60 : u.startsWith("d") ? n * 24 : n;
}

/** D-W9-23a/D-W9-50: 5-FU de FOLFOX/FOLFIRI = infusão contínua de 46 h com bomba; "8 h sem bomba" e bolus 400 mg/m² não entram. */
export function validarInfusao(e: { drug: string; infusionTime: string | null; bomba?: boolean | null; bolus?: boolean }): SaidaInfusao {
  const fonte = "D-W9-23a / D-W9-50";
  if (!ehFU(e.drug)) return { veredito: "PASS", motivo: "regra de infusão contínua se aplica só a 5-FU", fonte };
  if (e.bolus === true)
    return { veredito: "BLOCK_ARTEFATO", motivo: "bolus de 5-FU não entra (D-W9-50); FOLFOX/FOLFIRI só com infusão contínua de 46 h", fonte };
  const h = horas(e.infusionTime);
  if (h === null)
    return { veredito: "NOT_EVALUABLE", motivo: "tempo de infusão do 5-FU ausente/ilegível: esperado 46 h", fonte };
  if (e.bomba === false)
    return { veredito: "BLOCK_ARTEFATO", motivo: `5-FU em ${e.infusionTime} sem bomba não vira ficha; infusão contínua de 46 h com bomba (D-W9-23a)`, fonte };
  if (h !== 46)
    return { veredito: "WARNING", motivo: `5-FU em ${e.infusionTime}: o padrão de FOLFOX/FOLFIRI é 46 h; conferir o esquema`, fonte };
  if (e.bomba === undefined || e.bomba === null)
    return { veredito: "WARNING", motivo: "5-FU 46 h sem confirmação de bomba: informar bomba", fonte };
  return { veredito: "PASS", motivo: "5-FU em infusão contínua de 46 h com bomba", fonte };
}
export const validarTempoInfusao = validarInfusao;

const NK1 = ["aprepitanto", "fosaprepitanto", "netupitanto", "rolapitanto", "casopitanto"];
const TAXANOS = ["paclitaxel", "docetaxel", "nab paclitaxel", "cabazitaxel"];
const tem = (itens: readonly string[], nome: string): boolean => itens.some((i) => chave(i).includes(nome));

export interface SaidaAntiemese {
  /** true se NK1 presente (padrão local é SEM NK1: D-W9-23c/D-W9-34c) */
  alerta: boolean;
  nk1: string[];
  /** itens do padrão local ausentes (informativo; nunca bloqueia o médico) */
  ausentesPadrao: string[];
  motivos: string[];
}

/** Padrão local: ondansetrona + dexametasona + prometazina VO; cimetidina em taxano; olanzapina opcional; sem NK1. */
export function validarAntiemese(e: { itens: readonly string[]; taxano?: boolean }): SaidaAntiemese {
  const nk1 = NK1.filter((n) => tem(e.itens, n));
  const taxano = e.taxano ?? TAXANOS.some((t) => tem(e.itens, t));
  const ausentes = ["ondansetrona", "dexametasona", "prometazina", ...(taxano ? ["cimetidina"] : [])].filter((n) => !tem(e.itens, n));
  const motivos = [
    ...nk1.map((n) => `${n}: padrão do serviço é SEM NK1 (D-W9-23c/34c)`),
    ...ausentes.map((n) => `${n} ausente do padrão local (conferir)`),
  ];
  return { alerta: nk1.length > 0, nk1, ausentesPadrao: ausentes, motivos };
}

/* ───────────── RT-11b · dose de braço de estudo nunca vira ficha (D-W9-22i) ───────────── */

export type OrigemDose = "FICHA_CONFERIDA" | "BRACO_ESTUDO" | "AULA_NAO_VERIFICADA" | "PLANILHA_NAO_REVISADA" | "MANUAL" | "DESCONHECIDA";

export interface CandidatoDose {
  origem?: OrigemDose;
  /** esquema/nome citado (TPF, ddMVAC, IFL…) */
  esquema?: string;
  /** nó do grafo de onde veio a dose (tipo trial/regime ⇒ referência, nunca ficha) */
  noTipo?: string;
  doseLiteral?: string;
  /** revisão explícita do Dr. Silas libera a dose para virar ficha */
  revisao?: { revisadoPor: string; em: string } | null;
}

/** Esquemas da D-W9-22i que não entram sem revisão (normalizados). */
const ESQUEMAS_DOSE_ESTUDO = ["tpf", "ddmvac", "dd mvac", "ifl", "mayo"];

export function ehDoseDeEstudo(c: CandidatoDose): boolean {
  if (c.origem === "BRACO_ESTUDO" || c.origem === "AULA_NAO_VERIFICADA" || c.origem === "PLANILHA_NAO_REVISADA") return true;
  if (c.noTipo === "trial" || c.noTipo === "regime") return true;
  if (c.doseLiteral !== undefined && c.origem !== "FICHA_CONFERIDA" && c.origem !== "MANUAL") return true;
  if (c.esquema !== undefined) {
    const k = ` ${chave(c.esquema)} `;
    if (ESQUEMAS_DOSE_ESTUDO.some((e) => k.includes(` ${e} `))) return true;
  }
  return false;
}

export type SaidaDoseEstudo =
  | { recusado: false }
  | { recusado: true; codigo: "DOSE_ESTUDO_SEM_REVISAO"; motivo: string };

export function recusarDoseEstudo(c: CandidatoDose): SaidaDoseEstudo {
  if (!ehDoseDeEstudo(c)) return { recusado: false };
  if (c.revisao && c.revisao.revisadoPor.trim() !== "" && c.revisao.em.trim() !== "") return { recusado: false };
  return {
    recusado: true,
    codigo: "DOSE_ESTUDO_SEM_REVISAO",
    motivo: "dose de braço de estudo/aula não vira ficha sem revisão do Dr. Silas (D-W9-22i); fica como referência",
  };
}
