import { z } from "zod";
import { Fonte, Id } from "../base.js";
import { ReferenciaFato } from "../f1/achadosSetor.js";
import { ContextoDutosVisao } from "../api/dutos.js";
import { TumorPackExtract } from "./tumorPack.js";
import { RecistAvaliacao } from '../w10/clinico-w10.js';
import { RegistroEstadoDoenca } from './estadoDoenca.js';

export const CampoFichaMinima=z.object({id:Id,rotulo:Id,estado:z.enum(["DOCUMENTADO","CALCULADO","PENDENTE","CONFLITANTE"]),
  valor:z.json().nullable(),data:z.string().nullable(),motivo:Id,fontes:z.array(Fonte),fatos:z.array(ReferenciaFato)}).strict();
export type CampoFichaMinima=z.infer<typeof CampoFichaMinima>;
export const RevisaoClinicaResposta=z.object({codigo:z.literal("REVISAO_CLINICA_CARREGADA"),contexto:ContextoDutosVisao,
  revisao:Id,ficha:z.array(CampoFichaMinima),preQt:z.object({estado:z.enum(["PENDENTE","AGUARDA_DECISAO_MEDICA"]),
    autorizaTratamento:z.literal(false),pendencias:z.array(Id)}).strict(),
  packs:z.array(z.object({id:Id,titulo:Id,estado:TumorPackExtract.shape.estado,cids:z.array(Id)}).strict()),
  pack:TumorPackExtract.nullable(),pendencias:z.array(Id),
  estadosDoenca:z.array(RegistroEstadoDoenca.extend({fato:ReferenciaFato,fontes:z.array(Fonte),conflito:z.boolean()}).strict()),
  respostaTumoral:z.object({criterio:z.literal("RECIST_1_1"),aplicabilidade:z.literal("CONFERIR_CRITERIO_DO_TUMOR"),
    series:z.array(z.object({eventId:Id,episodioId:Id,tumorLotId:Id.nullable(),avaliacoes:z.array(RecistAvaliacao),pendencias:z.array(Id)}).strict()),
    patologica:z.array(z.object({valor:z.json(),data:z.string().nullable(),fato:ReferenciaFato,fontes:z.array(Fonte),
      estado:z.enum(['DOCUMENTADO','NEGADO','INCERTO']),conflito:z.boolean(),
      qualificadores:z.object({negated:z.json().optional(),negado:z.json().optional(),evidence:z.json().optional(),requiresConfirmation:z.json().optional()}).strict(),
    }).strict()),
    pendencias:z.array(Id)}).strict(),
}).strict();
export type RevisaoClinicaResposta=z.infer<typeof RevisaoClinicaResposta>;
