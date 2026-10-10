// W11-H21 · mapeador puro CadastroModelo08 -> CadastroCheckin. Transporta só o que o modelo 08 tem.
// Não há rota nem fonte nova: campos que o modelo não traz ficam ausentes (PENDENTE no leitor da APAC).
import type { CadastroCheckin } from "../contracts/w11/cadastroCheckin.js";
import { UFS_BRASIL } from "./campos.js";

/** Forma estrutural do cartão Modelo 08 (src/ui/oncochart/chart-visao.ts), sem importar a UI. */
export interface CadastroModelo08Entrada {
  nascimento: string | null;
  mae: string | null;
  responsavel: string | null;
  cns: string | null;
  cidadeUf: string | null;
  endereco: string | null;
}

/** Valores de placeholder do modelo que significam "sem informação": não viram dado. */
const SEM_INFORMACAO: ReadonlySet<string> = new Set(["SEM INFORMACAO", "SEM INFORMAÇÃO"]);

const semPlaceholder = (v: string | null): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" || SEM_INFORMACAO.has(t.toUpperCase()) ? null : t;
};

/** "Cidade/UF" ou "Cidade - UF" com UF de 2 letras válida. Qualquer outro formato = null (ambos PENDENTE). */
export function separarCidadeUf(v: string | null): { municipio: string; uf: string } | null {
  if (typeof v !== "string") return null;
  const m = /^(.+?)(?:\/| - )([A-Za-z]{2})$/.exec(v.trim());
  if (m === null) return null;
  const municipio = m[1]!.trim();
  const uf = m[2]!.toUpperCase();
  if (municipio === "" || !UFS_BRASIL.has(uf)) return null;
  return { municipio, uf };
}

export function mapearCadastroModelo08(modelo: CadastroModelo08Entrada): CadastroCheckin {
  const cidade = separarCidadeUf(modelo.cidadeUf);
  const responsavel = semPlaceholder(modelo.responsavel);
  return {
    cns: semPlaceholder(modelo.cns),
    nascimento: semPlaceholder(modelo.nascimento),
    mae: semPlaceholder(modelo.mae),
    endereco: semPlaceholder(modelo.endereco),
    municipio: cidade?.municipio ?? null,
    uf: cidade?.uf ?? null,
    responsavel: responsavel === null ? null : { nome: responsavel, telefone: null },
  };
}
