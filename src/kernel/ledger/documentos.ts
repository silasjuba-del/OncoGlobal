import { lerLedgerIntegro } from "./leituraIntegra.js";
import { documentoReceitaDosePendente } from '../../contracts/f1/receitaDose.js';
import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { Paciente } from "../../contracts/clinico.js";
import { ClinicalEvent } from "../../contracts/operacao.js";
import { dadosDoEvento, eventosVigentes } from "../projections/snapshot.js";
import { hashCanonico as hashConteudoExibido } from "../../rules/conteudoCanonico.js";
import type { ResolverDocumentoImpressao } from "../gateway/executores/imprimir.js";

const escapar = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const objeto = (v: unknown): Record<string, unknown> | null => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;

/** Resolve somente a versão assinada vigente, vinculada ao conteúdo confirmado. */
export function criarResolverDocumentoLedger(db: DatabaseSync): ResolverDocumentoImpressao {
  return { async resolver({id,version}) {
    const pacientes=db.prepare(`SELECT DISTINCT patientId FROM clinical_event WHERE tipo IN ('DOCUMENTO','DOCUMENTO@1')
      AND CASE WHEN json_valid(payload) THEN json_extract(payload,'$.data.data.documentId') END = ?`).all(id);
    const eventos=pacientes.flatMap(row=>typeof row.patientId==="string"?lerLedgerIntegro(db,row.patientId).itens:[]);
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
    if(documentoReceitaDosePendente(corpo))return null;
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
        if(documentoReceitaDosePendente(item))return null;
        if (item.tipoDocumento === "FLASH_CONJUNTO_IMPRESSAO" || item.titulo !== ref.titulo) return null;
        textos.push(`${String(item.titulo)}\n${String(item.texto)}`);
      }
      if (textos.join("\n\n---\n\n") !== corpo.texto) return null;
    }
    // Identidade é resolvida no horizonte da assinatura; cadastro posterior não reescreve documento.
    const cadastros=eventos.filter(c=>c.patientId===e.patientId&&(c.tipo==="Paciente"||c.tipo==="Paciente@1")
      &&["CONFIRMADO","ASSINADO"].includes(c.revisao)&&Date.parse(c.criadoEm)<=Date.parse(e.criadoEm)).flatMap(c=>{
      const p=Paciente.safeParse(dadosDoEvento(c));return p.success&&p.data.patientId===e.patientId&&p.data.nome.trim().length>0?[{evento:c,paciente:p.data}]:[];
    });
    let nomePaciente:string|null=null;
    if(corpo.identidadePaciente!==undefined) {
      const identidade=objeto(corpo.identidadePaciente);
      if(!identidade||identidade.patientId!==e.patientId||typeof identidade.nome!=="string"||!identidade.nome.trim()
        ||typeof identidade.cadastroEventId!=="string")return null;
      const cadastro=cadastros.find(c=>c.evento.eventId===identidade.cadastroEventId);
      if(!cadastro||cadastro.paciente.nome!==identidade.nome)return null;
      nomePaciente=identidade.nome;
    }
    let responsavel=e.criadoPor.id;
    if(corpo.identidadeResponsavel!==undefined) {
      const identidade=objeto(corpo.identidadeResponsavel);
      if(!identidade||identidade.medicoId!==e.criadoPor.id
        ||(identidade.nome!==undefined&&(typeof identidade.nome!=="string"||!identidade.nome.trim()))
        ||(identidade.crm!==undefined&&(typeof identidade.crm!=="string"||!identidade.crm.trim())))return null;
      responsavel=[typeof identidade.nome==="string"?identidade.nome:e.criadoPor.id,
        ...(typeof identidade.crm==="string"?[identidade.crm]:[])].join(" · ");
    }
    const titulo = typeof corpo.titulo === "string" ? corpo.titulo : "Documento";
    // Sem identidade no conteúdo assinado, mantém os bytes do render legado.
    // Cadastro encontrado depois não acrescenta cabeçalho a uma versão congelada.
    const cabecalhoPaciente = nomePaciente === null ? "" : `<p>Paciente: ${escapar(nomePaciente)}</p>`;
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapar(titulo)}</title></head><body><h1>${escapar(titulo)}</h1>${cabecalhoPaciente}<p>Prontuário: ${escapar(e.patientId)}</p><pre style="white-space:pre-wrap;font-family:inherit">${escapar(String(corpo.texto))}</pre><p>Responsável: ${escapar(responsavel)} · ${escapar(e.criadoEm)}</p></body></html>`;
    return {id,version,patientId:e.patientId,html,assinado:true,hash:createHash("sha256").update(html,"utf8").digest("hex")};
  } };
}
