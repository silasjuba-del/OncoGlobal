import { z } from "zod";
import { Fonte, Id } from "../base.js";
import { ReferenciaFato } from "../f1/achadosSetor.js";
import { ContextoDutosVisao } from "../api/dutos.js";
import { TumorPackExtract } from "./tumorPack.js";
import { RecistAvaliacao } from '../w10/clinico-w10.js';
import { RegistroEstadoDoenca } from './estadoDoenca.js';
import { ResumoPack, LotePackLeitura } from './leituraPack.js';
import {LoteCompleto} from './loteCompleto.js';

export const CampoFichaMinima=z.object({id:Id,rotulo:Id,estado:z.enum(["DOCUMENTADO","CALCULADO","PENDENTE","CONFLITANTE"]),
  valor:z.json().nullable(),data:z.string().nullable(),motivo:Id,fontes:z.array(Fonte),fatos:z.array(ReferenciaFato)}).strict();
export type CampoFichaMinima=z.infer<typeof CampoFichaMinima>;
export const EstadoCampoRevisao = z.enum(["INFORMADO", "AUSENTE_CONFIRMADO", "NAO_INFORMADO"]);
export type EstadoCampoRevisao = z.infer<typeof EstadoCampoRevisao>;

function campoRevisao<T extends z.ZodTypeAny>(valor: T) {
  return z.object({
    estado: EstadoCampoRevisao,
    bloqueiaLiberacao: z.boolean(),
    valor: valor.nullable(),
  }).strict();
}

function campoCalculado(origem: "CALCULADA" | "CALCULADO") {
  return z.object({
    estado: EstadoCampoRevisao,
    bloqueiaLiberacao: z.boolean(),
    valor: z.number().positive().nullable(),
    origem: z.literal(origem),
  }).strict().superRefine((campo, ctx) => {
    if (campo.estado === "INFORMADO" && campo.valor === null)
      ctx.addIssue({ code: "custom", message: "cálculo informado exige valor" });
    if (campo.estado !== "INFORMADO" && campo.valor !== null)
      ctx.addIssue({ code: "custom", message: "cálculo sem estado INFORMADO não carrega valor" });
  });
}

const ItemBiomarcador = z.object({
  nome: z.string().min(1),
  estado: EstadoCampoRevisao,
  bloqueiaLiberacao: z.boolean(),
  resultado: z.string().min(1).nullable(),
  data: z.string().min(1).nullable(),
}).strict().superRefine((item, ctx) => {
  const completo = item.resultado !== null && item.data !== null;
  if (item.estado === "INFORMADO" && !completo) ctx.addIssue({ code: "custom", message: "biomarcador informado incompleto" });
  if (item.estado !== "INFORMADO" && (item.resultado !== null || item.data !== null))
    ctx.addIssue({ code: "custom", message: "biomarcador sem valor não carrega resultado" });
});

const ItemLab = z.object({
  exame: z.string().min(1),
  estado: EstadoCampoRevisao,
  bloqueiaLiberacao: z.boolean(),
  valor: z.string().min(1).nullable(),
  data: z.string().min(1).nullable(),
}).strict().superRefine((item, ctx) => {
  const completo = item.valor !== null && item.data !== null;
  if (item.estado === "INFORMADO" && !completo) ctx.addIssue({ code: "custom", message: "laboratório informado incompleto" });
  if (item.estado !== "INFORMADO" && (item.valor !== null || item.data !== null))
    ctx.addIssue({ code: "custom", message: "laboratório fora da janela não carrega valor" });
});

const ItemMonitor = z.object({
  nome: z.string().min(1),
  estado: EstadoCampoRevisao,
  bloqueiaLiberacao: z.boolean(),
  valor: z.string().min(1).nullable(),
}).strict().superRefine((item, ctx) => {
  if (item.estado === "INFORMADO" && item.valor === null) ctx.addIssue({ code: "custom", message: "monitorização informada exige valor" });
  if (item.estado !== "INFORMADO" && item.valor !== null) ctx.addIssue({ code: "custom", message: "monitorização sem valor informado" });
});

export const TelaRevisaoConsulta = z.object({
  identidade: z.object({
    intencao: campoRevisao(z.enum(["CURATIVA", "NEOADJUVANTE", "ADJUVANTE", "PALIATIVA", "DEFINITIVA", "HIGIENICA", "CITORREDUTORA"])),
    linha: campoRevisao(z.number().int().positive()),
    cirurgia: campoRevisao(z.literal(true)),
    biomarcadores: z.object({
      estado: EstadoCampoRevisao,
      bloqueiaLiberacao: z.boolean(),
      itens: z.array(ItemBiomarcador),
    }).strict(),
    datasSUS: z.object({
      dataDiagnosticoAP: campoRevisao(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
      dataInicioTratamento: campoRevisao(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
      diasDecorridos: z.object({
        estado: EstadoCampoRevisao,
        bloqueiaLiberacao: z.boolean(),
        valor: z.number().int().nonnegative().nullable(),
        origem: z.literal("CALCULADO"),
      }).strict().superRefine((campo, ctx) => {
        if (campo.estado === "INFORMADO" && campo.valor === null) ctx.addIssue({ code: "custom", message: "dias calculados exigem valor" });
        if (campo.estado !== "INFORMADO" && campo.valor !== null) ctx.addIssue({ code: "custom", message: "dias sem cálculo não carregam valor" });
      }),
      validadeAPAC: campoRevisao(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    }).strict(),
  }).strict(),
  aptidaoHoje: z.object({
    ecog: campoRevisao(z.number().int().min(0).max(5)),
    antropometria: z.object({
      peso: campoRevisao(z.number().positive()),
      altura: campoRevisao(z.number().positive()),
      sc: campoCalculado("CALCULADA"),
      clcr: campoCalculado("CALCULADO"),
      variacaoPesoPct: z.object({
        estado: EstadoCampoRevisao,
        bloqueiaLiberacao: z.boolean(),
        valor: z.number().nullable(),
        alertaRecalculo: z.boolean(),
      }).strict().superRefine((campo, ctx) => {
        if (campo.estado === "INFORMADO" && campo.valor === null) ctx.addIssue({ code: "custom", message: "variação informada exige valor" });
        if (campo.estado !== "INFORMADO" && campo.valor !== null) ctx.addIssue({ code: "custom", message: "variação sem valor informado" });
        if (campo.alertaRecalculo !== (campo.valor !== null && Math.abs(campo.valor) >= 10))
          ctx.addIssue({ code: "custom", message: "alerta de recálculo só com variação de 10% ou mais" });
      }),
    }).strict(),
    labPreCiclo: z.object({
      estado: EstadoCampoRevisao,
      bloqueiaLiberacao: z.boolean(),
      janelaDias: z.number().int().positive().nullable(),
      itens: z.array(ItemLab),
    }).strict(),
    toxicidadeAnterior: campoRevisao(z.object({
      grauMaximo: z.number().int().min(0).max(5),
      ajusteDose: z.enum(["nenhum", "reducao", "adiamento"]),
    }).strict()),
    monitorizacaoEsquema: z.object({
      estado: EstadoCampoRevisao,
      bloqueiaLiberacao: z.boolean(),
      itens: z.array(ItemMonitor),
    }).strict(),
    acessoVenoso: campoRevisao(z.enum(["PERIFERICO", "PICC", "CATETER_IMPLANTADO"])),
  }).strict(),
  fechamento: z.object({
    respostaDoenca: campoRevisao(z.object({
      criterio: z.enum(["RECIST", "clinica"]),
      dataReavaliacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).strict()),
    plano: z.object({
      proximoCiclo: campoRevisao(z.string().min(1)),
      dataReestadiamento: campoRevisao(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    }).strict(),
  }).strict(),
}).strict().superRefine((tela, ctx) => {
  const conferir = (no: unknown) => {
    if (!no || typeof no !== "object") return;
    if ("estado" in no && "valor" in no) {
      const campo = no as { estado: string; valor: unknown };
      if (campo.estado === "INFORMADO" && campo.valor === null)
        ctx.addIssue({ code: "custom", message: "INFORMADO exige valor" });
      if (campo.estado !== "INFORMADO" && campo.valor !== null)
        ctx.addIssue({ code: "custom", message: "só INFORMADO carrega valor" });
    }
    for (const item of Object.values(no)) {
      if (Array.isArray(item)) item.forEach(conferir);
      else conferir(item);
    }
  };
  conferir(tela);
});
export type TelaRevisaoConsulta = z.infer<typeof TelaRevisaoConsulta>;

export const RevisaoClinicaResposta=z.object({codigo:z.literal("REVISAO_CLINICA_CARREGADA"),contexto:ContextoDutosVisao,
  revisao:Id,ficha:z.array(CampoFichaMinima),preQt:z.object({estado:z.enum(["PENDENTE","AGUARDA_DECISAO_MEDICA"]),
    autorizaTratamento:z.literal(false),pendencias:z.array(Id)}).strict(),
  packs:z.array(z.object({id:Id,titulo:Id,estado:TumorPackExtract.shape.estado,cids:z.array(Id)}).strict()),
  pack:z.union([TumorPackExtract,ResumoPack]).nullable(),loteCompleto:z.union([LoteCompleto,LotePackLeitura]).nullable().optional(),pendencias:z.array(Id),
  estadosDoenca:z.array(RegistroEstadoDoenca.extend({fato:ReferenciaFato,fontes:z.array(Fonte),conflito:z.boolean()}).strict()),
  respostaTumoral:z.object({criterio:z.literal("RECIST_1_1"),aplicabilidade:z.literal("CONFERIR_CRITERIO_DO_TUMOR"),
    series:z.array(z.object({eventId:Id,episodioId:Id,tumorLotId:Id.nullable(),avaliacoes:z.array(RecistAvaliacao),pendencias:z.array(Id)}).strict()),
    patologica:z.array(z.object({valor:z.json(),data:z.string().nullable(),fato:ReferenciaFato,fontes:z.array(Fonte),
      estado:z.enum(['DOCUMENTADO','NEGADO','INCERTO']),conflito:z.boolean(),
      qualificadores:z.object({negated:z.json().optional(),negado:z.json().optional(),evidence:z.json().optional(),requiresConfirmation:z.json().optional()}).strict(),
    }).strict()),
    pendencias:z.array(Id)}).strict(),
  tela: TelaRevisaoConsulta,
}).strict();
export type RevisaoClinicaResposta=z.infer<typeof RevisaoClinicaResposta>;
