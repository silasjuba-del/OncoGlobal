import type { z } from 'zod';
import type { Fonte } from '../base.js';
import { EvidenceLayer, type Semaforo, type Revisao, type StatusCampo } from '../estados.js';
type CamadaEvidencia = z.infer<typeof EvidenceLayer>;

export interface CandidatoVisao {
  valorTexto: string;
  fontes: readonly Fonte[];
}

export interface AfirmacaoVisao {
  rotulo: string;
  valorTexto: string | null;
  estado: Semaforo;
  campo: StatusCampo;
  motivo: string;
  revisao: Revisao;
  fontes: readonly Fonte[];
  evidenceLayer: CamadaEvidencia;
  candidatos?: readonly CandidatoVisao[];
}
