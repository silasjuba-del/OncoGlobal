import { z } from "zod";
import { Id } from "../base.js";
export const ConsultaCarregar = z.object({patientId: Id, encounterId: Id, tumorLotId: Id.nullable().optional()}).strict();
export type ConsultaCarregar = z.infer<typeof ConsultaCarregar>;
