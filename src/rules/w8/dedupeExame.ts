// AG-04 · Deduplicação de exame (lições D1–D3)
// Regras puras: sem I/O, sem Date.now, sem Math.random.
// Chave por tipo: patologia/IHQ = lab + num + data entrada; imagem = servico + registro + data exame.
// Mesma chave + mesmo conteúdo = duplicata (1 exame).
// Mesma chave + conteúdo diferente = conflito VERMELHO.
// Chaves diferentes + conclusão igual = concordância (2 exames distintos).

import type { Semaforo } from "../../contracts/estados.js";

export type TipoExameDedupe = "PATOLOGIA_IHQ" | "IMAGEM" | "OUTRO";

export interface EntradaExameDedupe {
  id: string;
  tipo: TipoExameDedupe;
  laboratorio?: string | null;
  numeroExame?: string | null;
  dataEntrada?: string | null;
  servico?: string | null;
  registro?: string | null;
  dataExame?: string | null;
  conteudoHash?: string | null;
  conteudoResumo?: string | null;
  conclusao?: string | null;
  pagina?: number;
}

export interface ExameUnicoAgrupado {
  chave: string;
  examePrincipal: EntradaExameDedupe;
  entradasIds: string[];
  paginas: number[];
  estado: Semaforo;
}

export interface SaidaDedupeExame {
  totalPaginasOuEntradas: number;
  totalExamesUnicos: number;
  examesUnicos: ExameUnicoAgrupado[];
  duplicatasDetectadas: {
    chave: string;
    idsDuplicados: string[];
  }[];
  conflitos: {
    chave: string;
    estado: Semaforo;
    motivo: string;
    idsEmConflito: string[];
  }[];
  concordancias: {
    chavesDistintas: [string, string];
    conclusaoComum: string;
  }[];
}

function normalizar(s?: string | null): string {
  if (!s) return "NULO";
  return s.trim().toUpperCase().replace(/\s+/g, "_");
}

/**
 * D2: Gera a chave canônica de deduplicação conforme o tipo do exame.
 * Para patologia/IHQ usa estritamente data de entrada do material (nunca data de extração/impressão).
 * Para imagem usa serviço, registro e data de realização do exame.
 */
export function gerarChaveDedupe(exame: EntradaExameDedupe): string {
  if (exame.tipo === "PATOLOGIA_IHQ") {
    const lab = normalizar(exame.laboratorio);
    const num = normalizar(exame.numeroExame);
    const data = normalizar(exame.dataEntrada);
    return `PATOLOGIA_IHQ:${lab}:${num}:${data}`;
  }

  if (exame.tipo === "IMAGEM") {
    const serv = normalizar(exame.servico);
    const reg = normalizar(exame.registro);
    const data = normalizar(exame.dataExame);
    return `IMAGEM:${serv}:${reg}:${data}`;
  }

  const inst = normalizar(exame.servico ?? exame.laboratorio);
  const id = normalizar(exame.registro ?? exame.numeroExame);
  const data = normalizar(exame.dataExame ?? exame.dataEntrada);
  return `OUTRO:${inst}:${id}:${data}`;
}

/**
 * Realiza a deduplicação de exames e detecção de concordâncias/conflitos.
 */
export function deduplicarExames(entradas: EntradaExameDedupe[]): SaidaDedupeExame {
  const grupos = new Map<string, EntradaExameDedupe[]>();

  for (const item of entradas) {
    const chave = gerarChaveDedupe(item);
    const lista = grupos.get(chave) ?? [];
    lista.push(item);
    grupos.set(chave, lista);
  }

  const examesUnicos: ExameUnicoAgrupado[] = [];
  const duplicatasDetectadas: SaidaDedupeExame["duplicatasDetectadas"] = [];
  const conflitos: SaidaDedupeExame["conflitos"] = [];

  for (const [chave, itens] of grupos.entries()) {
    const principal = itens[0];
    const ids = itens.map((i) => i.id);
    const paginas = itens.map((i) => i.pagina ?? 0).filter((p) => p > 0);

    let temConflitoConteudo = false;
    if (itens.length > 1) {
      const primeiroHash = principal.conteudoHash ?? normalizar(principal.conteudoResumo);
      for (let k = 1; k < itens.length; k++) {
        const hashAtual = itens[k].conteudoHash ?? normalizar(itens[k].conteudoResumo);
        if (primeiroHash !== hashAtual) {
          temConflitoConteudo = true;
          break;
        }
      }
    }

    if (temConflitoConteudo) {
      conflitos.push({
        chave,
        estado: "VERMELHO",
        motivo: "mesma chave de exame com conteúdos discordantes (conflito de versão ou laudo alterado)",
        idsEmConflito: ids,
      });
      examesUnicos.push({
        chave,
        examePrincipal: principal,
        entradasIds: ids,
        paginas,
        estado: "VERMELHO",
      });
    } else {
      if (itens.length > 1) {
        duplicatasDetectadas.push({
          chave,
          idsDuplicados: ids.slice(1),
        });
      }
      examesUnicos.push({
        chave,
        examePrincipal: principal,
        entradasIds: ids,
        paginas,
        estado: "VERDE",
      });
    }
  }

  // D3: Concordância entre exames distintos com mesma conclusão
  const concordancias: SaidaDedupeExame["concordancias"] = [];
  for (let i = 0; i < examesUnicos.length; i++) {
    for (let j = i + 1; j < examesUnicos.length; j++) {
      const a = examesUnicos[i];
      const b = examesUnicos[j];
      const concA = a.examePrincipal.conclusao ? a.examePrincipal.conclusao.trim().toLowerCase() : null;
      const concB = b.examePrincipal.conclusao ? b.examePrincipal.conclusao.trim().toLowerCase() : null;

      if (concA && concB && concA === concB && a.chave !== b.chave) {
        concordancias.push({
          chavesDistintas: [a.chave, b.chave],
          conclusaoComum: a.examePrincipal.conclusao!,
        });
      }
    }
  }

  return {
    totalPaginasOuEntradas: entradas.length,
    totalExamesUnicos: examesUnicos.length,
    examesUnicos,
    duplicatasDetectadas,
    conflitos,
    concordancias,
  };
}
