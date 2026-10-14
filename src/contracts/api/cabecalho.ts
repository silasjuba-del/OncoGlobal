import type { Ciclo, Contato, Paciente, TreatmentEpisode, TumorLot } from '../clinico.js';
import type { Semaforo } from '../estados.js';

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

export interface AchadosChaveEntrada {
  diagnostico?: string | undefined;
  exames: readonly { nome: string; fraseLaudo?: string | undefined }[];
}
