import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { ClinicalEvent } from "../../contracts/operacao.js";
import { dadosDoEvento, eventosVigentes } from "../../kernel/projections/snapshot.js";
import { hashConteudoExibido } from "../../server/sessao.js";
import type { ResolverDocumentoImpressao } from "./imprimir.js";

const escapar = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const objeto = (v: unknown): Record<string, unknown> | null => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;

/** Resolve somente a versão assinada vigente, vinculada ao conteúdo confirmado. */
export function criarResolverDocumentoLedger(db: DatabaseSync): ResolverDocumentoImpressao {
  return { async resolver({id,version}) {
    const eventos = db.prepare("SELECT * FROM clinical_event").all().flatMap(row => {
      try { return [ClinicalEvent.parse({...row,payload:JSON.parse(String(row.payload)),fontes:JSON.parse(String(row.fontes)),criadoPor:JSON.parse(String(row.criadoPor))})]; }
      catch { return []; }
    });
    const validos = eventosVigentes(eventos).filter(e=>e.revisao === "ASSINADO" && e.tipo === "DOCUMENTO").flatMap(e=>{
      const d = dadosDoEvento(e), corpo = objeto(d?.data), assinatura = objeto(d?.signature);
      if (!corpo || !assinatura || typeof corpo.documentId !== "string" || typeof corpo.documentVersion !== "number"
        || assinatura.documentId !== corpo.documentId || assinatura.documentVersion !== corpo.documentVersion
        || assinatura.serverActorId !== e.criadoPor.id || assinatura.documentHash !== hashConteudoExibido(corpo)
        || typeof corpo.texto !== "string") return [];
      return [{e,corpo}];
    });
    const candidatos = validos.filter(v=>v.corpo.documentId === id && v.corpo.documentVersion === version);
    if (candidatos.length !== 1) return null;
    const {e,corpo} = candidatos[0]!;
    if (corpo.tipoDocumento === "FLASH_CONJUNTO_IMPRESSAO") {
      if (!Array.isArray(corpo.documentosIncluidos) || !corpo.documentosIncluidos.length) return null;
      const textos: string[] = [], ids = new Set<string>();
      for (const bruto of corpo.documentosIncluidos) {
        const ref = objeto(bruto);
        if (!ref || typeof ref.documentId !== "string" || ids.has(ref.documentId) || ref.documentId === id) return null;
        ids.add(ref.documentId);
        const encontrados = validos.filter(c=>c.corpo.documentId === ref.documentId && c.corpo.documentVersion === ref.documentVersion
          && c.e.patientId === e.patientId && c.e.encounterId === e.encounterId && c.e.tumorLotId === e.tumorLotId);
        if (encontrados.length !== 1) return null;
        const item = encontrados[0]!.corpo;
        if (item.tipoDocumento === "FLASH_CONJUNTO_IMPRESSAO" || item.titulo !== ref.titulo) return null;
        textos.push(`${String(item.titulo)}\n${String(item.texto)}`);
      }
      if (textos.join("\n\n---\n\n") !== corpo.texto) return null;
    }
    const titulo = typeof corpo.titulo === "string" ? corpo.titulo : "Documento";
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapar(titulo)}</title></head><body><h1>${escapar(titulo)}</h1><p>Prontuário: ${escapar(e.patientId)}</p><pre style="white-space:pre-wrap;font-family:inherit">${escapar(String(corpo.texto))}</pre><p>Responsável: ${escapar(e.criadoPor.id)} · ${escapar(e.criadoEm)}</p></body></html>`;
    return {id,version,patientId:e.patientId,html,assinado:true,hash:createHash("sha256").update(html,"utf8").digest("hex")};
  } };
}
