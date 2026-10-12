// F1-S9 · preparação pura. O servidor resolve as fontes, persiste drafts e exige exibição/assinatura.
// Não interpreta texto livre, não registra tarefas e não cria encontros ou efeitos externos.
import { z } from "zod";
import { DataCivil, Fonte } from "../../contracts/base.js";
import { calcularRetorno } from "../../rules/retorno.js";
import { hashCanonico } from "../hash.js";
import { renderizarDocumento, type FatoConfirmado } from "./render.js";

const Texto = z.string().trim().min(1);
const ChaveCampo = Texto.regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,100}$/)
  .refine(v => !["constructor", "prototype", "__proto__"].includes(v));
const Contexto = z.object({ patientId: Texto, encounterId: Texto, tumorLotId: Texto.nullable() }).strict();
const TipoMaterial = z.enum(["EVOLUCAO", "RESUMO_14", "LAUDO", "ORIENTACOES", "ENCAMINHAMENTO"]);
const Campo = z.object({ id: ChaveCampo, rotulo: Texto, obrigatorio: z.boolean() }).strict();
const Medicamento = z.object({
  id: ChaveCampo, medicamento: Texto, dose: Texto.nullable(), orientacao: Texto.nullable(),
  duracao: Texto.nullable(), via: Texto.nullable(), quantidade: Texto.nullable(),
}).strict();
const Pedido = z.object({ id: ChaveCampo, exame: Texto, indicacao: Texto.nullable() }).strict();
const Decisao = z.object({
  decisaoId: Texto, contexto: Contexto, revisao: z.literal("CONFIRMADO"), origem: z.literal("DECISAO_MEDICA"),
  fontes: z.array(Fonte).min(1), medicamentos: z.array(Medicamento), pedidos: z.array(Pedido),
  retorno: z.object({ dias: z.number().int().min(0).nullable(), motivo: Texto.nullable(), tarefaId: Texto }).strict().nullable(),
}).strict().superRefine((d, ctx) => {
  for (const grupo of [d.medicamentos, d.pedidos]) {
    if (new Set(grupo.map(i => i.id)).size !== grupo.length)
      ctx.addIssue({ code: "custom", message: "ITEM_DUPLICADO" });
  }
});

const Material = z.object({
  tipo: TipoMaterial, contexto: Contexto,
  // Base resolvida pelo servidor a partir de fonte aprovada. Não admite prosa fixa clínica.
  template: z.object({ templateId: Texto, versao: Texto, fonte: Fonte, campos: z.array(Campo).min(1) }).strict(),
  fatos: z.array(z.object({
    campo: ChaveCampo, valor: Texto, revisao: z.enum(["CONFIRMADO", "ASSINADO"]),
    origem: z.enum(["FATO_CONFIRMADO", "DECISAO_MEDICA"]), fontes: z.array(Fonte).min(1),
  }).strict()),
}).strict().superRefine((m, ctx) => {
  const campos = new Set(m.template.campos.map(c => c.id));
  if (campos.size !== m.template.campos.length || m.fatos.some(f => !campos.has(f.campo)))
    ctx.addIssue({ code: "custom", message: "CAMPOS_MATERIAL_INVALIDOS" });
});

/** Porta interna de preparação, não autenticação: origem/revisão nunca vêm diretamente do HTTP. */
export const EntradaDocumentosConsultaSchema = z.object({
  contexto: Contexto, operationId: Texto, revisao: Texto,
  dataReferencia: DataCivil, fuso: z.literal("America/Fortaleza"),
  decisao: Decisao.nullable(), materiais: z.array(Material),
}).strict();
export type EntradaDocumentosConsulta = z.infer<typeof EntradaDocumentosConsultaSchema>;
export type MaterialDocumento = z.infer<typeof Material>;
export type TipoDocumentoConsulta = "RECEITA" | "PEDIDO_EXAME" | "RETORNO" | MaterialDocumento["tipo"];
type ContextoDocumento = z.infer<typeof Contexto>;

export interface DocumentoConsulta {
  documentId: string;
  documentVersion: 1;
  documentHash: string;
  tipoDocumento: TipoDocumentoConsulta;
  titulo: string;
  texto: string;
  contexto: ContextoDocumento;
  estado: "RASCUNHO";
  origem: "DOCUMENTOS_CONSULTA";
  dataReferencia: string;
  fuso: "America/Fortaleza";
  revisaoFatos: string;
  decisaoRef: string | null;
  templateRef: { templateId: string; versao: string };
  fontes: Fonte[];
  camposPendentes: string[];
}

export interface PendenciaDocumento {
  tipoDocumento: TipoDocumentoConsulta;
  codigo: "SEM_DECISAO_MEDICA" | "SEM_MATERIAL_BASE" | "BASE_INCOMPLETA_OU_CONFLITANTE" | "CAMPOS_PENDENTES" | "REVISAR";
  campos: string[];
}

/** Referência para o dono da agenda/tarefas. Não significa tarefa gravada ou agendamento. */
export interface ReferenciaTarefaRetorno {
  tarefaId: string;
  contexto: ContextoDocumento;
  documentoRef: { documentId: string; documentVersion: 1 };
  pedidosRef: { documentId: string; documentVersion: 1 }[];
  dataAlvo: string;
  motivo: string | null;
}

export interface DocumentosConsultaPreparados {
  correlacao: { contexto: ContextoDocumento; operationId: string; revisao: string };
  documentos: DocumentoConsulta[];
  tarefas: ReferenciaTarefaRetorno[];
  pendencias: PendenciaDocumento[];
}

const TITULOS: Record<TipoDocumentoConsulta, string> = {
  RECEITA: "Receita", PEDIDO_EXAME: "Pedido de exame", RETORNO: "Retorno", EVOLUCAO: "Evolução",
  RESUMO_14: "Resumo-14", LAUDO: "Laudo", ORIENTACOES: "Orientações", ENCAMINHAMENTO: "Encaminhamento",
};
const mesmoContexto = (a: ContextoDocumento, b: ContextoDocumento) =>
  a.patientId === b.patientId && a.encounterId === b.encounterId && a.tumorLotId === b.tumorLotId;

/** Gera apenas conteúdo de revisão. Reimpressão resolve a versão assinada já persistida pelo gateway. */
export function prepararDocumentosConsulta(bruta: EntradaDocumentosConsulta): DocumentosConsultaPreparados {
  // Zod valida runtime JS e desacopla o resultado de mutações posteriores na entrada.
  const entrada = EntradaDocumentosConsultaSchema.parse(bruta);
  if ((entrada.decisao && !mesmoContexto(entrada.contexto, entrada.decisao.contexto))
    || entrada.materiais.some(m => !mesmoContexto(entrada.contexto, m.contexto)))
    throw new Error("CONTEXTO_DIVERGENTE");
  const documentos: DocumentoConsulta[] = [], tarefas: ReferenciaTarefaRetorno[] = [], pendencias: PendenciaDocumento[] = [];

  function montar(tipo: TipoDocumentoConsulta, templateId: string, versao: string,
    campos: z.infer<typeof Campo>[], fatos: FatoConfirmado[], fontes: Fonte[], decisaoRef: string | null,
    exigirBaseCompleta = false): DocumentoConsulta | null {
    const render = renderizarDocumento({
      template: { templateId, versao, campos: campos.map(c => c.id), proibidoConter: ["ALERTA", "CORRECAO_IA"] }, fatos,
    });
    if (exigirBaseCompleta && (render.conflitos.length > 0
      || campos.some(c => c.obrigatorio && render.camposVazios.includes(c.id))
      || Object.values(render.campos).every(v => !v.trim()))) {
      pendencias.push({ tipoDocumento: tipo, codigo: "BASE_INCOMPLETA_OU_CONFLITANTE", campos: render.camposVazios });
      return null;
    }
    const texto = [
      `Prontuário: ${entrada.contexto.patientId}`, `Encontro: ${entrada.contexto.encounterId}`,
      ...(entrada.contexto.tumorLotId ? [`Lote tumoral: ${entrada.contexto.tumorLotId}`] : []),
      `Data: ${entrada.dataReferencia}`,
      ...campos.map(c => `${c.rotulo}: ${render.campos[c.id] || "PENDENTE"}`),
    ].join("\n");
    const conteudo = {
      tipoDocumento: tipo, titulo: TITULOS[tipo], texto, contexto: entrada.contexto,
      estado: "RASCUNHO" as const, origem: "DOCUMENTOS_CONSULTA" as const,
      dataReferencia: entrada.dataReferencia, fuso: entrada.fuso, revisaoFatos: entrada.revisao,
      decisaoRef, templateRef: { templateId, versao }, fontes, camposPendentes: render.camposVazios,
    };
    const documentHash = hashCanonico(conteudo);
    const documento: DocumentoConsulta = { documentId: `s9-${documentHash}`, documentVersion: 1, documentHash, ...conteudo };
    if (!documentos.some(d => d.documentId === documento.documentId)) documentos.push(documento);
    if (render.camposVazios.length) pendencias.push({ tipoDocumento: tipo, codigo: "CAMPOS_PENDENTES", campos: render.camposVazios });
    return documento;
  }

  const decisao = entrada.decisao;
  function montarDecisao(tipo: TipoDocumentoConsulta, linhas: [string, string, string | null][]) {
    return montar(tipo, tipo.toLowerCase(), "1", linhas.map(([id, rotulo]) => ({ id, rotulo, obrigatorio: false })),
      linhas.flatMap(([campo, , valor]) => valor === null ? [] : [{ campo, valor, revisao: "CONFIRMADO", origem: "DECISAO_MEDICA" }]),
      decisao!.fontes, decisao!.decisaoId)!;
  }
  if (!decisao) {
    for (const tipoDocumento of ["RECEITA", "PEDIDO_EXAME", "RETORNO"] as const)
      pendencias.push({ tipoDocumento, codigo: "SEM_DECISAO_MEDICA", campos: [] });
  } else {
    if (decisao.medicamentos.length) {
      const linhas: [string, string, string | null][] = decisao.medicamentos.flatMap((m, i) => [
        [`${m.id}.medicamento`, `Medicamento ${i + 1}`, m.medicamento], [`${m.id}.dose`, "Dose", m.dose],
        [`${m.id}.orientacao`, "Posologia", m.orientacao], [`${m.id}.duracao`, "Duração", m.duracao],
        [`${m.id}.via`, "Via", m.via], [`${m.id}.quantidade`, "Quantidade", m.quantidade],
      ] as [string, string, string | null][]);
      montarDecisao("RECEITA", linhas);
    }
    for (const p of decisao.pedidos)
      montarDecisao("PEDIDO_EXAME", [["exame", "Exame", p.exame], ["indicacao", "Indicação", p.indicacao]]);
    if (decisao.retorno) {
      const retorno = decisao.retorno;
      const calculado = calcularRetorno({ tipo: "PROGRAMADO", prazo: retorno.dias === null ? null : { quantidade: retorno.dias, unidade: "DIAS" },
        motivo: retorno.motivo, examesAntes: [], dataReferencia: entrada.dataReferencia });
      if (calculado.dataAlvo !== null) DataCivil.parse(calculado.dataAlvo);
      const documento = montarDecisao("RETORNO", [["prazo", "Retorno", retorno.dias === null ? null : `em ${retorno.dias} dias`],
        ["data", "Data prevista", calculado.dataAlvo], ["motivo", "Motivo", retorno.motivo]]);
      // A11(a): sem data, nenhuma referência de tarefa pode ser executada pelo consumidor.
      if (calculado.dataAlvo === null)
        pendencias.push({ tipoDocumento: "RETORNO", codigo: "REVISAR", campos: ["data"] });
      else {
        const pedidosRef = documentos.filter(d => d.tipoDocumento === "PEDIDO_EXAME")
          .map(d => ({ documentId: d.documentId, documentVersion: d.documentVersion }));
        if (pedidosRef.length) tarefas.push({ tarefaId: retorno.tarefaId, contexto: { ...entrada.contexto },
          documentoRef: { documentId: documento.documentId, documentVersion: 1 }, pedidosRef,
          dataAlvo: calculado.dataAlvo, motivo: retorno.motivo });
      }
    }
  }

  for (const tipo of TipoMaterial.options) {
    const bases = entrada.materiais.filter(m => m.tipo === tipo);
    if (!bases.length) pendencias.push({ tipoDocumento: tipo, codigo: "SEM_MATERIAL_BASE", campos: [] });
    for (const base of bases) {
      if (base.template.campos.some(c => /\[VERIFICAR\]/i.test(c.rotulo))
        || (tipo === "RESUMO_14" && base.template.campos.length !== 14)) {
        pendencias.push({ tipoDocumento: tipo, codigo: "SEM_MATERIAL_BASE", campos: [] });
        continue;
      }
      montar(tipo, base.template.templateId, base.template.versao, base.template.campos, base.fatos,
        [base.template.fonte, ...base.fatos.flatMap(f => f.fontes)], null, true);
    }
  }
  return { correlacao: { contexto: { ...entrada.contexto }, operationId: entrada.operationId, revisao: entrada.revisao }, documentos, tarefas, pendencias };
}
