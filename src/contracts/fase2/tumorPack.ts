import { z } from "zod";
import { Id, Instante } from "../base.js";
import { VersaoReferencia } from "../f1/correlacao.js";
import { PackInvestigacaoSchema } from "../api/investigacao.js";

/** Contrato documental separado. Não substitui estados de fatos, assinatura ou biblioteca. */
export const BLOCOS_TUMOR_PACK = ["identidade", "diagnostico", "estadiamento", "biomarcadores", "c1_lacunas",
  "pre_qt", "tratamento", "toxicidades", "resposta", "seguimento", "documentos", "fontes"] as const;
export const BlocoTumorPack = z.object({ estado:z.enum(["DOCUMENTADO","A_CONFERIR","AUSENTE"]),
  itens:z.array(z.object({localizador:Id,conteudo:z.json()}).strict()) }).strict();
const blocos = Object.fromEntries(BLOCOS_TUMOR_PACK.map(nome=>[nome,BlocoTumorPack])) as Record<typeof BLOCOS_TUMOR_PACK[number],typeof BlocoTumorPack>;
export const TumorPackExtract = z.object({schema:z.literal("tumor-pack-extract.v2"),referencia:VersaoReferencia,
  titulo:Id,cids:z.array(Id),estado:z.enum(["RASCUNHO","CONSULTAVEL","ATIVO"]),
  original:z.object({arquivo:Id,hash:z.string().regex(/^[a-f0-9]{64}$/),estado:Id}).strict(),
  revisaoClinica:z.object({medicoId:Id,em:Instante,hashOriginal:z.string().regex(/^[a-f0-9]{64}$/),hashExtracao:z.string().regex(/^[a-f0-9]{64}$/)}).strict().nullable(),
  blocos:z.object(blocos).strict(),requisitos:z.array(PackInvestigacaoSchema.shape.requisitos.element),
  pendencias:z.array(Id),
}).strict().superRefine((p,c)=>{
  if(p.estado==="ATIVO"&&(!p.revisaoClinica||p.revisaoClinica.hashOriginal!==p.original.hash||p.revisaoClinica.hashExtracao!==p.referencia.hash||!p.requisitos.length))
    c.addIssue({code:"custom",message:"ATIVACAO_EXIGE_REVISAO_DO_ORIGINAL"});
  if(p.estado==="ATIVO"&&["OBSOLETO","INATIVO","ALERTA"].includes(p.original.estado))c.addIssue({code:"custom",message:"ORIGINAL_NAO_ATIVAVEL"});
  if(new Set(p.requisitos.map(r=>r.id)).size!==p.requisitos.length)c.addIssue({code:"custom",message:"REQUISITOS_DUPLICADOS"});
});
export type TumorPackExtract = z.infer<typeof TumorPackExtract>;
