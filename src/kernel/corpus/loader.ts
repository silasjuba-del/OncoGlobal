// G-17 · Carregador de rulesets do corpus com I/O INJETADO (W2 · GLM-01).
// O loader nunca importa node:fs nem guarda cache global: quem chama decide de onde vêm os bytes.
import { z } from "zod";
import { RulesetHeader } from "../../contracts/index.js";

export type HeaderRuleset = z.infer<typeof RulesetHeader>;

export type ResultadoRuleset =
  | { ok: true; header: HeaderRuleset }
  | { ok: false; erros: string[] };

/** Valida o `header` de um ruleset (JSON já parseado) contra RulesetHeader (G-17/K-27). */
export function validarRuleset(json: unknown): ResultadoRuleset {
  if (typeof json !== "object" || json === null || !("header" in json))
    return { ok: false, erros: ["raiz: ruleset sem objeto header"] };
  const parse = RulesetHeader.safeParse((json as { header: unknown }).header);
  if (parse.success) return { ok: true, header: parse.data };
  return { ok: false, erros: parse.error.issues.map((i) => `${caminho(i.path)}: ${i.message}`) };
}

const caminho = (p: readonly (string | number | symbol)[]): string =>
  p.length === 0 ? "header" : "header." + p.map(String).join(".");

export interface RulesetCarregado {
  arquivo: string;
  id: string;
  versao: string;
}

export interface RulesetRejeitado {
  arquivo: string;
  erros: string[];
}

export interface DiretorioCarregado {
  validos: RulesetCarregado[];
  rejeitados: RulesetRejeitado[];
}

/**
 * Percorre um diretório de rulesets usando apenas as funções de I/O injetadas
 * (determinístico: os arquivos são ordenados por nome antes de ler).
 */
export function carregarDiretorio(
  lerArquivo: (caminho: string) => string,
  listar: (dir: string) => string[],
  dir: string,
): DiretorioCarregado {
  const validos: RulesetCarregado[] = [];
  const rejeitados: RulesetRejeitado[] = [];
  const base = dir.replace(/[\\/]+$/, "");
  for (const nome of [...listar(dir)].sort()) {
    if (!nome.endsWith(".json")) continue;
    const arquivo = `${base}/${nome}`;
    let conteudo: string;
    try {
      conteudo = lerArquivo(arquivo);
    } catch (e) {
      rejeitados.push({ arquivo, erros: [`falha ao ler arquivo: ${msg(e)}`] });
      continue;
    }
    let json: unknown;
    try {
      json = JSON.parse(conteudo);
    } catch (e) {
      rejeitados.push({ arquivo, erros: [`JSON inválido: ${msg(e)}`] });
      continue;
    }
    const r = validarRuleset(json);
    if (r.ok) validos.push({ arquivo, id: r.header.id, versao: r.header.versao });
    else rejeitados.push({ arquivo, erros: r.erros });
  }
  return { validos, rejeitados };
}

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
