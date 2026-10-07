// D-W9-51 · cadeia de elos no laudo. Negação anula o elo. O médico confirma.
// PROVISORIO-W10: trocar AlertaEmergencia por src/contracts/w10/ quando o laudo RADS tiver contrato.

export interface EloEmergencia {
  id: string;
  sinonimos: readonly string[];
}

export interface EmergenciaRads {
  linha: number;
  categoria: string;
  nome: string;
  modalidade: string;
  minimoElos: number;
  obrigatorios: readonly string[];
  elos: readonly EloEmergencia[];
}

export interface RulesetRads {
  id: string;
  versao: string;
  decisao: string;
  proximidade: number;
  alcanceNegacao: number;
  ordemObrigatoria: boolean;
  negacoes: readonly string[];
  emergencias: readonly EmergenciaRads[];
}

export interface AlertaEmergencia {
  linha: number;
  nome: string;
  categoria: string;
  modalidade: string;
  estado: "ALERTA";
  confirmadoPeloMedico: false;
  bloqueiaSalvar: false;
  trecho: string;
  lateralidade: "direita" | "esquerda" | "bilateral" | null;
  nivel: string | null;
  decisao: string;
  rulesetVersao: string;
  motivo: string;
}

export interface ResultadoRads {
  alertas: AlertaEmergencia[];
  bloqueiaSalvar: false;
  decisao: string;
  rulesetVersao: string;
}

type Bruto = Record<string, unknown>;

const ACENTOS: Record<string, string> = {
  á: "a", à: "a", ã: "a", â: "a", ä: "a",
  é: "e", ê: "e", è: "e",
  í: "i", ì: "i",
  ó: "o", õ: "o", ô: "o",
  ú: "u", ù: "u",
  ç: "c",
};

function dobrar(valor: string): string {
  let saida = "";
  for (const ch of valor.toLowerCase()) saida += ACENTOS[ch] ?? ch;
  return saida;
}

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

function inteiroPositivo(valor: unknown, caminho: string): number {
  if (typeof valor !== "number" || !Number.isInteger(valor) || valor <= 0) {
    throw new Error(`${caminho} não é inteiro positivo`);
  }
  return valor;
}

export function lerRadsEmergencias(json: unknown): RulesetRads {
  const raiz = objeto(json, "ruleset");
  const header = objeto(raiz.header, "header");
  const det = objeto(raiz.detector, "detector");
  flag(det.bloqueiaSalvar, "bloqueiaSalvar", false);
  flag(det.confirmacaoMedicaObrigatoria, "confirmacaoMedicaObrigatoria", true);
  flag(det.ordemObrigatoria, "ordemObrigatoria", true);
  const negacoesBrutas = det.negacoes;
  if (!Array.isArray(negacoesBrutas) || negacoesBrutas.length === 0) throw new Error("negacoes ausentes");
  const negacoes = negacoesBrutas.map((n) => texto(n, "negacao"));
  const lista = raiz.emergencias;
  if (!Array.isArray(lista) || lista.length === 0) throw new Error("emergencias ausentes");
  const emergencias: EmergenciaRads[] = lista.map((item) => {
    const o = objeto(item, "emergencia");
    const elosBrutos = o.elos;
    if (!Array.isArray(elosBrutos) || elosBrutos.length === 0) throw new Error("elos ausentes");
    const elos: EloEmergencia[] = elosBrutos.map((elo) => {
      const e = objeto(elo, "elo");
      const sins = e.sinonimos;
      if (!Array.isArray(sins) || sins.length === 0) throw new Error("sinonimos ausentes");
      return { id: texto(e.id, "elo.id"), sinonimos: sins.map((s) => texto(s, "sinonimo")) };
    });
    const ids = new Set(elos.map((e) => e.id));
    const obrigatoriosBrutos = o.obrigatorios ?? [];
    if (!Array.isArray(obrigatoriosBrutos)) throw new Error("obrigatorios inválidos");
    const obrigatorios = obrigatoriosBrutos.map((id) => texto(id, "obrigatorio"));
    for (const id of obrigatorios) if (!ids.has(id)) throw new Error(`obrigatorio ${id} fora dos elos`);
    const minimo = inteiroPositivo(o.minimoElos, "minimoElos");
    if (minimo > elos.length) throw new Error("minimoElos acima da cadeia");
    return {
      linha: inteiroPositivo(o.linha, "linha"),
      categoria: texto(o.categoria, "categoria"),
      nome: texto(o.nome, "nome"),
      modalidade: texto(o.modalidade, "modalidade"),
      minimoElos: minimo,
      obrigatorios,
      elos,
    };
  });
  return {
    id: texto(header.id, "header.id"),
    versao: texto(header.versao, "header.versao"),
    decisao: texto(det.decisao, "decisao"),
    proximidade: inteiroPositivo(det.proximidade, "proximidade"),
    alcanceNegacao: inteiroPositivo(det.alcanceNegacao, "alcanceNegacao"),
    ordemObrigatoria: det.ordemObrigatoria === true,
    negacoes,
    emergencias,
  };
}

interface Ocorrencia {
  id: string;
  pos: number;
  len: number;
}

function spansNegacao(folded: string, frases: readonly string[], alcance: number): Array<[number, number]> {
  const ordenadas = [...frases].map(dobrar).sort((a, b) => b.length - a.length);
  const spans: Array<[number, number]> = [];
  for (const frase of ordenadas) {
    let from = 0;
    while (from < folded.length) {
      const i = folded.indexOf(frase, from);
      if (i < 0) break;
      const antes = i === 0 ? " " : folded[i - 1] ?? " ";
      if (!/[a-z0-9]/.test(antes)) {
        const ini = i + frase.length;
        let fim = ini;
        const teto = Math.min(folded.length, ini + alcance);
        while (fim < teto) {
          const ch = folded[fim];
          if (ch === "." || ch === "\n" || ch === "!" || ch === "?") break;
          fim++;
        }
        spans.push([ini, fim]);
      }
      from = i + Math.max(1, frase.length);
    }
  }
  return spans;
}

function negado(pos: number, len: number, spans: Array<[number, number]>): boolean {
  const meio = pos + Math.floor(len / 2);
  return spans.some(([a, b]) => meio >= a && meio < b);
}

function ocorrencias(folded: string, elo: EloEmergencia, spans: Array<[number, number]>): Ocorrencia[] {
  const achados: Ocorrencia[] = [];
  const frases = [...elo.sinonimos].sort((a, b) => b.length - a.length);
  for (const sinonimo of frases) {
    const f = dobrar(sinonimo);
    let from = 0;
    while (from < folded.length) {
      const i = folded.indexOf(f, from);
      if (i < 0) break;
      const antes = i === 0 ? " " : folded[i - 1] ?? " ";
      const depois = i + f.length >= folded.length ? " " : folded[i + f.length] ?? " ";
      const livre = !achados.some((o) => i < o.pos + o.len && o.pos < i + f.length);
      if (!/[a-z0-9]/.test(antes) && !/[a-z0-9]/.test(depois) && livre && !negado(i, f.length, spans)) {
        achados.push({ id: elo.id, pos: i, len: f.length });
      }
      from = i + 1;
    }
  }
  return achados.sort((a, b) => a.pos - b.pos);
}

function combina(
  grupos: Ocorrencia[][],
  minimo: number,
  obrigatorios: ReadonlySet<string>,
  proximidade: number,
  ordem: boolean,
): Ocorrencia[] | null {
  const escolhidos: Ocorrencia[] = [];
  const fecha = (): boolean => {
    if (escolhidos.length < minimo) return false;
    for (const id of obrigatorios) if (!escolhidos.some((e) => e.id === id)) return false;
    const ini = Math.min(...escolhidos.map((e) => e.pos));
    const fim = Math.max(...escolhidos.map((e) => e.pos + e.len));
    return fim - ini <= proximidade;
  };
  const dfs = (i: number): boolean => {
    if (i === grupos.length) return fecha();
    const grupo = grupos[i] ?? [];
    for (const oc of grupo) {
      const prev = escolhidos[escolhidos.length - 1];
      if (ordem && prev !== undefined && oc.pos <= prev.pos) continue;
      if (!ordem && escolhidos.some((e) => e.pos === oc.pos)) continue;
      escolhidos.push(oc);
      if (dfs(i + 1)) return true;
      escolhidos.pop();
    }
    if (dfs(i + 1)) return true;
    return false;
  };
  return dfs(0) ? [...escolhidos] : null;
}

function sentenca(original: string, ini: number, fim: number): string {
  let a = ini;
  while (a > 0) {
    const ch = original[a - 1];
    if (ch === "." || ch === "\n" || ch === "!" || ch === "?") break;
    a--;
  }
  let b = fim;
  while (b < original.length) {
    const ch = original[b];
    if (ch === "." || ch === "\n" || ch === "!" || ch === "?") {
      if (ch === ".") b++;
      break;
    }
    b++;
  }
  return original.slice(a, b).trim();
}

function lateralidadeDe(trecho: string): "direita" | "esquerda" | "bilateral" | null {
  const f = dobrar(trecho);
  const bi = /\bbilateral\b/.test(f);
  const dir = /\b(a direita|lado direito|rim direito|direita|direito)\b/.test(f);
  const esq = /\b(a esquerda|lado esquerdo|rim esquerdo|esquerda|esquerdo)\b/.test(f);
  if (bi || (dir && esq)) return "bilateral";
  if (dir) return "direita";
  if (esq) return "esquerda";
  return null;
}

function nivelDe(trecho: string): string | null {
  const f = dobrar(trecho);
  const m = /\b([ctl])\s*(\d{1,2})\b/.exec(f);
  if (m === null) return null;
  const letra = (m[1] ?? "").toUpperCase();
  const n = Number(m[2]);
  const max = letra === "C" ? 7 : letra === "T" ? 12 : letra === "L" ? 5 : 0;
  if (!Number.isInteger(n) || n < 1 || n > max) return null;
  return `${letra}${n}`;
}

export function detectarEmergencias(laudoTexto: string, rs: RulesetRads): ResultadoRads {
  const folded = dobrar(laudoTexto);
  const spans = spansNegacao(folded, rs.negacoes, rs.alcanceNegacao);
  const alertas: AlertaEmergencia[] = [];
  for (const emerg of rs.emergencias) {
    const grupos = emerg.elos.map((elo) => ocorrencias(folded, elo, spans));
    const combo = combina(
      grupos,
      emerg.minimoElos,
      new Set(emerg.obrigatorios),
      rs.proximidade,
      rs.ordemObrigatoria,
    );
    if (combo === null) continue;
    const ini = Math.min(...combo.map((e) => e.pos));
    const fim = Math.max(...combo.map((e) => e.pos + e.len));
    const trecho = sentenca(laudoTexto, ini, fim);
    const lateralidade = lateralidadeDe(trecho);
    const nivel = nivelDe(trecho);
    const onde = [lateralidade, nivel].filter((p) => p !== null).join(", ");
    const lugar = onde.length > 0 ? ` (${onde})` : "";
    alertas.push({
      linha: emerg.linha,
      nome: emerg.nome,
      categoria: emerg.categoria,
      modalidade: emerg.modalidade,
      estado: "ALERTA",
      confirmadoPeloMedico: false,
      bloqueiaSalvar: false,
      trecho,
      lateralidade,
      nivel,
      decisao: rs.decisao,
      rulesetVersao: rs.versao,
      motivo: `${emerg.nome} (linha ${emerg.linha})${lugar}: ${trecho} (${rs.decisao})`,
    });
  }
  alertas.sort((a, b) => a.linha - b.linha);
  return { alertas, bloqueiaSalvar: false, decisao: rs.decisao, rulesetVersao: rs.versao };
}
