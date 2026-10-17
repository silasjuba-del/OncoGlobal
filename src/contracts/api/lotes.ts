import {z} from 'zod';
import {Id} from '../base.js';
import {TumorLot} from '../clinico.js';
export const LotesPacientePedido=z.object({patientId:Id}).strict();
export const LotesPacienteResposta=z.object({codigo:z.literal('LOTES_CARREGADOS'),patientId:Id,lotes:z.array(TumorLot)}).strict()
 .refine(r=>r.lotes.every(l=>l.patientId===r.patientId),'LOTE_FORA_DO_PACIENTE');
export type LotesPacienteResposta=z.infer<typeof LotesPacienteResposta>;
