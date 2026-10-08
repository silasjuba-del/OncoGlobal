import type { Ciclo, Contato, Paciente, TreatmentEpisode, TumorLot } from "../../contracts/clinico.js";
import type { Semaforo } from "../../contracts/estados.js";

/**
 * Visão do cabeçalho. Compõe os contratos; não cria um segundo modelo clínico.
 * "hoje" é injetado — a tela não lê o relógio.
 */
export interface CabecalhoVisao {
  hoje: string;
  paciente: Paciente;
  lotes: readonly TumorLot[];
  loteSelecionadoId: string | null;
  episodio: TreatmentEpisode | null;
  ciclo: Ciclo | null;
  semaforo: Semaforo;
  pendentes: number;
  contatosDesdeUltima: readonly Contato[];
  alergiasPaciente: readonly string[];
  comorbidadesPaciente: readonly string[];
}

/** Entrada mínima da linha pontualizada da Consulta Flash (D-W9-77b). */
export interface AchadosChaveEntrada {
  diagnostico?: string | undefined;
  exames: readonly { nome: string; fraseLaudo?: string | undefined }[];
}

function textoPresente(v: string | undefined): string | null {
  const t = v?.trim();
  return t && t.length > 0 ? t : null;
}

/**
 * Linha pontualizada: "Biópsia: adenocarcinoma · TC tórax: nódulo 43 mm".
 * Determinística, sem LLM. Dado ausente é omitido (nunca inventa nem escreve PENDENTE).
 * Exame mostra a frase do laudo tal como veio; sem frase, o exame é omitido.
 */
export function montarLinhaPontualizada(entrada: AchadosChaveEntrada): string {
  const itens: string[] = [];
  const dx = textoPresente(entrada.diagnostico);
  if (dx) itens.push(`Diagnóstico: ${dx}`);
  for (const e of entrada.exames) {
    const nome = textoPresente(e.nome);
    const frase = textoPresente(e.fraseLaudo);
    if (nome && frase) itens.push(`${nome}: ${frase}`);
  }
  return itens.join(" · ");
}
