// GLM-09 · Importador SIGTAP (esqueleto, sem dados reais).
// parseSigtapCsv é PURA (testável); a CLI lê um arquivo fornecido pelo usuário e grava corpus/sigtap/<competencia>.json.
// O formato real do arquivo oficial é [VERIFICAR]: por isso o mapeamento de colunas entra como parâmetro.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * Divide uma linha CSV respeitando campos entre aspas duplas (aspas internas escapadas como "").
 * Separador padrão ";" (padrão brasileiro); configurável no mapeamento.
 */
function dividirLinha(linha, separador) {
  const campos = [];
  let atual = "";
  let entreAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (entreAspas) {
      if (c === '"') {
        if (linha[i + 1] === '"') { atual += '"'; i++; }
        else entreAspas = false;
      } else atual += c;
    } else if (c === '"') entreAspas = true;
    else if (c === separador) { campos.push(atual.trim()); atual = ""; }
    else atual += c;
  }
  campos.push(atual.trim());
  return campos;
}

/**
 * @param {string} texto conteúdo do arquivo (CSV)
 * @param {string} competencia "YYYY-MM" (mesmo formato do contrato Apac.competencia)
 * @param {{separador?: string, primeiraLinhaCabecalho?: boolean, colunas: Record<string, number>}} mapeamento
 *   índices de coluna por campo; "codigo" e "nome" são obrigatórios no resultado.
 * @returns {{competencia: string, procedimentos: Array<Record<string, string>>}}
 */
export function parseSigtapCsv(texto, competencia, mapeamento) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia))
    throw new Error(`competencia inválida: "${competencia}" (esperado YYYY-MM)`);
  if (typeof mapeamento !== "object" || mapeamento === null || typeof mapeamento.colunas?.codigo !== "number" || typeof mapeamento.colunas?.nome !== "number")
    throw new Error("mapeamento.colunas precisa dos índices numéricos de 'codigo' e 'nome'");
  const separador = mapeamento.separador ?? ";";
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const corpo = mapeamento.primeiraLinhaCabecalho ? linhas.slice(1) : linhas;
  const procedimentos = corpo.map((linha, i) => {
    const campos = dividirLinha(linha, separador);
    const item = {};
    for (const [campo, indice] of Object.entries(mapeamento.colunas)) {
      const valor = campos[indice];
      if (valor === undefined)
        throw new Error(`linha ${i + 1}: coluna ${indice} (${campo}) inexistente — revise o mapeamento [VERIFICAR formato oficial]`);
      item[campo] = valor;
    }
    if (!item.codigo) throw new Error(`linha ${i + 1}: codigo vazio`);
    if (!item.nome) throw new Error(`linha ${i + 1}: nome vazio`);
    return item;
  });
  return { competencia, procedimentos };
}

// ── CLI (não é testada pela função pura; só roda com arquivo fornecido pelo usuário) ──
const [arquivoCsv, competenciaArg, mapeamentoArg] = process.argv.slice(2);
if (fileURLToPath(import.meta.url) === process.argv[1] || process.argv[1]?.endsWith("sigtap-import.mjs")) {
  if (!arquivoCsv || !competenciaArg) {
    console.error("uso: node scripts/sigtap-import.mjs <arquivo.csv> <competencia YYYY-MM> [mapeamento.json]");
    console.error('mapeamento default: { "separador": ";", "colunas": { "codigo": 0, "nome": 1 } }');
    process.exit(2);
  }
  const mapeamento = mapeamentoArg
    ? JSON.parse(readFileSync(mapeamentoArg, "utf8"))
    : { separador: ";", colunas: { codigo: 0, nome: 1 } };
  const resultado = parseSigtapCsv(readFileSync(arquivoCsv, "utf8"), competenciaArg, mapeamento);
  const destino = join(ROOT, "corpus", "sigtap", `${competenciaArg}.json`);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, JSON.stringify({
    competencia: resultado.competencia,
    procedimentos: resultado.procedimentos,
    meta: { importadoDe: arquivoCsv, mapeamento, formatoOficial: "[VERIFICAR]" },
  }, null, 2) + "\n");
  console.log(`${resultado.procedimentos.length} procedimentos -> ${destino}`);
}
