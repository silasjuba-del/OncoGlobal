import type { DatabaseSync } from "node:sqlite";
import { DocumentoSkill, ExecucaoSkill } from "../contracts/skillsClinicas.js";
import type { ProvenienciaDocumentoSkill } from "../contracts/api/provenienciaSkill.js";
import { lerDraft, listarEventos } from "../kernel/comandos/portas.js";
import { hashCanonico } from "../modules/hash.js";

/** Fonte continua proposta; sua adoção pelo médico cria outro documento, preservando o original. */
export function conferirProvenienciaSkill(db: DatabaseSync, ctx: ProvenienciaDocumentoSkill["contexto"], p: ProvenienciaDocumentoSkill): boolean {
  try {
    ctx = { patientId: ctx.patientId, encounterId: ctx.encounterId, tumorLotId: ctx.tumorLotId };
    const execucao = lerDraft(db, p.execucaoId), documento = lerDraft(db, p.documentId);
    const e = ExecucaoSkill.safeParse(execucao?.payload), d = DocumentoSkill.safeParse(documento?.payload);
    if (!e.success || !d.success || e.data.execucaoId !== p.execucaoId || d.data.documentId !== p.documentId || execucao?.patientId !== ctx.patientId || documento?.patientId !== ctx.patientId
      || hashCanonico(p.contexto) !== hashCanonico(ctx) || hashCanonico(e.data.contexto) !== hashCanonico(ctx) || hashCanonico(d.data.contexto) !== hashCanonico(ctx)
      || d.data.execucaoId !== p.execucaoId || d.data.tipo === "RECEITA" || hashCanonico(d.data) !== p.hash
      || !e.data.documentos.some(r => r.documentId === p.documentId && r.hash === p.hash)) return false;
    return e.data.fontes.every(f => hashCanonico(lerDraft(db, f.draftId)) === f.hash)
      && (!e.data.jornada || e.data.jornada.ledgerHash === hashCanonico(listarEventos(db, ctx.patientId)));
  } catch { return false; }
}
export function textoProvenienciaSkill(p: ProvenienciaDocumentoSkill): string {
  return `Origem da proposta revisada: jornada por skills. Execução ${p.execucaoId}; documento ${p.documentId}; hash ${p.hash}. O original e suas fontes permanecem preservados. A proposta não confirma fatos nem autoriza tratamento.`;
}
