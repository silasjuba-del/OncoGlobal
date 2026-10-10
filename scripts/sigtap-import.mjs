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

/** Lê os offsets do layout que acompanha a própria competência oficial. Não assume posição fixa. */
function registrosOficiais(arquivos, nome, competencia) {
  const layout = arquivos[nome.replace('.txt', '_layout.txt')];
  const fonte = arquivos[nome];
  if (typeof layout !== 'string' || typeof fonte !== 'string') throw new Error(`FONTE_OFICIAL_AUSENTE:${nome}`);
  const colunas = layout.split(/[\r\n]+/).filter(x => x.trim()).slice(1).map(l => {
    const [campo, tamanho, inicio, fim] = l.split(',');
    const a = Number(inicio), b = Number(fim);
    if (!campo || !Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < a || b-a+1 !== Number(tamanho)) throw new Error('LAYOUT_OFICIAL_INVALIDO');
    return { campo, a: a-1, b };
  });
  if (!colunas.length) throw new Error('LAYOUT_OFICIAL_VAZIO');
  const largura = Math.max(...colunas.map(c => c.b));
  return fonte.split(/[\r\n]+/).filter(x => x.trim()).map(l => {
    if (l.length !== largura) throw new Error(`LARGURA_OFICIAL_DIVERGENTE:${nome}`);
    const r = Object.fromEntries(colunas.map(c => [c.campo, l.slice(c.a,c.b).trimEnd()]));
    if (r.DT_COMPETENCIA !== competencia.replace('-','')) throw new Error(`COMPETENCIA_FONTE_DIVERGENTE:${nome}`);
    return r;
  });
}

/** Arquivos oficiais decodificados Windows-1252, incluindo layouts; somente grupo03.04 formas02–08. */
export function parseSigtapOficial(arquivos, competencia) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) throw new Error('COMPETENCIA_INVALIDA');
  const procedimentos = registrosOficiais(arquivos, 'tb_procedimento.txt', competencia);
  const cids = registrosOficiais(arquivos, 'rl_procedimento_cid.txt', competencia);
  const registros = registrosOficiais(arquivos, 'rl_procedimento_registro.txt', competencia);
  const financiamento = registrosOficiais(arquivos, 'tb_financiamento.txt', competencia);
  const numero = (v, campo) => {
    if (!/^\d+$/.test(v)) throw new Error(`ATRIBUTO_OFICIAL_INVALIDO:${campo}`);
    const n = Number(v); if (!Number.isSafeInteger(n)) throw new Error(`NUMERO_OFICIAL_INVALIDO:${campo}`); return n;
  };
  const selecionados = procedimentos.filter(p => /^03040[2-8]/.test(p.CO_PROCEDIMENTO));
  const codigos = new Set();
  const itens = selecionados.map(p => {
    const codigo = p.CO_PROCEDIMENTO;
    if (!/^\d{10}$/.test(codigo) || codigos.has(codigo) || !p.NO_PROCEDIMENTO) throw new Error('PROCEDIMENTO_OFICIAL_INVALIDO');
    codigos.add(codigo);
    const fin = financiamento.find(f => f.CO_FINANCIAMENTO === p.CO_FINANCIAMENTO);
    if (!fin) throw new Error('FINANCIAMENTO_OFICIAL_AUSENTE');
    return { codigo, nome: p.NO_PROCEDIMENTO, sexo: p.TP_SEXO === 'M' || p.TP_SEXO === 'F' ? p.TP_SEXO : p.TP_SEXO === 'I' ? 'AMBOS' : null,
      idadeMinMeses: null, idadeMaxMeses: null,
      idadeMinimaOriginal: p.VL_IDADE_MINIMA, idadeMaximaOriginal: p.VL_IDADE_MAXIMA,
      cidsCompativeis: [...new Set(cids.filter(c => c.CO_PROCEDIMENTO === codigo && c.ST_PRINCIPAL === 'S').map(c => c.CO_CID))].sort(),
      finalidadeDoGrupo: null, modalidade: 'QT',
      financiamentoCodigo: p.CO_FINANCIAMENTO, financiamentoNome: fin.NO_FINANCIAMENTO,
      valorSaCentavos: numero(p.VL_SA, 'VL_SA'),
      instrumentosRegistro: [...new Set(registros.filter(r => r.CO_PROCEDIMENTO === codigo).map(r => r.CO_REGISTRO))].sort(),
    };
  });
  return { competencia, procedimentos: itens };
}
