import { z } from "zod";
import { ContextoSkill } from "../skillsClinicas.js";
export const ProvenienciaDocumentoSkill = z.object({ contexto: ContextoSkill, execucaoId: z.string().min(1),
  documentId: z.string().min(1), hash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export type ProvenienciaDocumentoSkill = z.infer<typeof ProvenienciaDocumentoSkill>;
