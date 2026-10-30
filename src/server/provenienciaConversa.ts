import { z } from "zod";
import type { DatabaseSync } from "node:sqlite";
import { ContextoConversa, TurnoConversa, provenienciaDoTurno, type ProvenienciaDocumentoConversa } from "../contracts/api/conversaOncoassist.js";
import { lerDraft } from "../kernel/comandos/portas.js";
import { hashConteudoExibido as hash } from "./sessao.js";
const Registro = z.object({ kind: z.literal("SINTESE_RASCUNHO"), formato: z.literal("CONVERSA_ONCOASSIST"),
  contexto: ContextoConversa, requestHash: z.string(), baseHash: z.string(), turno: TurnoConversa, contentHash: z.string() }).strict();
export function conferirProvenienciaConversa(db: DatabaseSync, contexto: ContextoConversa, p: ProvenienciaDocumentoConversa): boolean {
  try {
    const selecionado = { patientId: contexto.patientId, encounterId: contexto.encounterId, tumorLotId: contexto.tumorLotId };
    const d = lerDraft(db, p.turnoId), r = Registro.safeParse(d?.payload);
    if (!d || d.patientId !== contexto.patientId || !r.success || r.data.turno.id !== d.draftId
      || r.data.turno.estado !== "CONCLUIDA" || hash(r.data.contexto) !== hash(selecionado) || hash(p.contexto) !== hash(selecionado)) return false;
    const { contentHash, ...conteudo } = r.data;
    return contentHash === hash(conteudo) && hash(p) === hash(provenienciaDoTurno(selecionado, r.data.turno));
  } catch { return false; }
}
export function textoProvenienciaConversa(p: ProvenienciaDocumentoConversa): string {
  return ["Origem da proposta revisada: conversa OncoAssist (nao confirma fatos automaticamente).",
    `Turno: ${p.turnoId} · ${p.modo}${p.modelo ? ` · modelo ${p.modelo}` : ""}`,
    `Gerado em: ${p.criadoEm} · concluido em: ${p.concluidoEm ?? "nao informado"}`,
    ...p.citacoes.map((c, i) => {
      const f = p.fontes.find(f => f.id === c.fonteId)!;
      return `[${i + 1}] ${f.titulo} · ${f.tipo} · data: ${f.data ?? "nao informada"} · ${f.revisao}\n`
        + `Fonte: ${f.id}; documento: ${f.draftId ?? "nao informado"}; evento: ${f.eventId ?? "nao informado"}; sourceId: ${f.sourceId ?? "nao informado"}; pagina: ${f.pagina ?? "nao informada"}; hash: ${f.hash}`
        + (f.url ? `\nReferencia: ${f.url}` : "") + `\nTrecho citado: ${c.trecho}`;
    }), ...(p.citacoes.length ? [] : ["Sem citacoes vinculadas neste turno."])].join("\n\n");
}
