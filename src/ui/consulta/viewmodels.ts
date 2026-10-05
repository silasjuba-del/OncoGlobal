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
