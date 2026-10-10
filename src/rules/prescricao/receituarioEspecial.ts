// W11-H12 · receituário especial por medicamento controlado (decisão do Dr. Silas: "TRAMADOL É RECEITA ESPECIAL, SÓ SE TIVER").
import { CONFIGURACAO_SERVICO_PADRAO, type ConfiguracaoServico } from "../../contracts/w11/configuracaoServico.js";

// Funções puras. src/rules só importa src/contracts (R-08): a tabela de controlados é INJETADA (corpus/regulatorio/medicamentos-controlados.v1.json).
// Regras: fármaco que exige receituário especial e serviço sem ele => INDISPONÍVEL (nunca substituído em silêncio);
// serviço com receituário especial => item vai para documento separado RECEITA_ESPECIAL, nunca na receita comum.

export type ConfiguracaoReceituario = ConfiguracaoServico;

export const CONFIGURACAO_RECEITUARIO_PADRAO: ConfiguracaoReceituario = CONFIGURACAO_SERVICO_PADRAO;

export interface EntradaControlado {
  nomes: readonly string[];
  exigeReceituarioEspecial: boolean;
  status: string;
  fonte: string;
}

export interface ItemReceita {
  id: string;
  medicamento: string;
  /** contexto da receita onde o item foi pedido; SINTOMATICOS_QT nunca leva tramadol */
  contexto?: "COMUM" | "SINTOMATICOS_QT";
}

export type ResultadoItem =
  | { estado: "OFERECIDO_RECEITA_COMUM"; item: ItemReceita }
  | { estado: "RECEITA_ESPECIAL"; item: ItemReceita; tipoDocumento: "RECEITA_ESPECIAL"; fonte: string }
  | { estado: "INDISPONIVEL_SEM_RECEITUARIO_ESPECIAL"; item: ItemReceita; motivo: string; fonte: string }
  /** H28 · dado ausente: item sem nome de medicamento é pendência, nunca oferecido na receita comum. */
  | { estado: "PENDENTE_MEDICAMENTO_AUSENTE"; item: ItemReceita; motivo: string };

export interface DocumentoReceitaEspecial {
  tipoDocumento: "RECEITA_ESPECIAL";
  itens: ItemReceita[];
}

export interface MontagemReceitas {
  receitaComum: ItemReceita[];
  documentosEspeciais: DocumentoReceitaEspecial[];
  indisponiveis: Array<{ item: ItemReceita; motivo: string }>;
}

const normalizar = (t: string): string =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

/** nome da tabela deve iniciar o medicamento como palavra inteira (ex.: "TRAMADOL 50 MG"); "TRAMADOLINA" não casa */
function casa(medicamento: string, nome: string): boolean {
  if (nome === "") return false;
  if (medicamento === nome) return true;
  return medicamento.startsWith(nome) && /[^A-Z0-9]/.test(medicamento.charAt(nome.length));
}

function encontrarControlado(medicamento: string, tabela: readonly EntradaControlado[]): EntradaControlado | null {
  const m = normalizar(medicamento);
  if (m === "") return null;
  for (const e of tabela) {
    if (e.nomes.some((n) => casa(m, normalizar(n)))) return e;
  }
  return null;
}

/** Roteia UM item. Nunca troca o fármaco: indisponível fica indisponível, com motivo. */
export function rotearItemReceita(
  item: ItemReceita,
  configuracao: ConfiguracaoReceituario,
  tabela: readonly EntradaControlado[],
): ResultadoItem {
  if (normalizar(item.medicamento) === "") {
    return { estado: "PENDENTE_MEDICAMENTO_AUSENTE", item, motivo: "medicamento sem nome: item pendente, não oferecido" };
  }
  const controlado = encontrarControlado(item.medicamento, tabela);
  if (controlado === null || !controlado.exigeReceituarioEspecial) {
    return { estado: "OFERECIDO_RECEITA_COMUM", item };
  }
  const fonte = controlado.fonte;
  if (item.contexto === "SINTOMATICOS_QT" && normalizar(item.medicamento).includes("TRAMADOL")) {
    return { estado: "INDISPONIVEL_SEM_RECEITUARIO_ESPECIAL", item,
      motivo: "receita de sintomáticos da QT nunca contém tramadol (regra do serviço)", fonte };
  }
  if (!configuracao.servicoTemReceituarioEspecial) {
    return { estado: "INDISPONIVEL_SEM_RECEITUARIO_ESPECIAL", item,
      motivo: `${controlado.nomes[0] ?? item.medicamento} exige receituário especial; o serviço não tem receituário especial (status ${controlado.status})`,
      fonte };
  }
  return { estado: "RECEITA_ESPECIAL", item, tipoDocumento: "RECEITA_ESPECIAL", fonte };
}

/** Separa os itens em receita comum, documento de receita especial e indisponíveis. Ordem dos itens preservada. */
export function montarReceitas(
  itens: readonly ItemReceita[],
  configuracao: ConfiguracaoReceituario,
  tabela: readonly EntradaControlado[],
): MontagemReceitas {
  const receitaComum: ItemReceita[] = [];
  const especiais: ItemReceita[] = [];
  const indisponiveis: Array<{ item: ItemReceita; motivo: string }> = [];
  for (const item of itens) {
    const r = rotearItemReceita(item, configuracao, tabela);
    if (r.estado === "OFERECIDO_RECEITA_COMUM") receitaComum.push(item);
    else if (r.estado === "RECEITA_ESPECIAL") especiais.push(item);
    else indisponiveis.push({ item, motivo: r.motivo });
  }
  const documentosEspeciais: DocumentoReceitaEspecial[] =
    especiais.length > 0 ? [{ tipoDocumento: "RECEITA_ESPECIAL", itens: especiais }] : [];
  return { receitaComum, documentosEspeciais, indisponiveis };
}
