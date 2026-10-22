import { DutosClinicaVisao } from './dutos.js';
import { z } from "zod";
import { DataCivil, Fonte } from "../base.js";
import { Paciente, TumorLot, TreatmentEpisode, Ciclo, Contato } from "../clinico.js";
import { Alerta, Apac } from "../operacao.js";
import { Semaforo, Destino, DeltaKind, DeltaDirecao, StatusCampo, Revisao, EvidenceLayer } from "../estados.js";
import { ContextoTriagem, EntradaFila, SalaoRuleset } from "../regras.js";
import type { AgendaVisao, CaixaCanalVisao, ChatSetorVisao, ConsultaVisao, LotesApacVisao, SalaoVisao } from "./porta.js";
import { ESTADOS_FARMACIA } from "./farmacia.js";
import { VereditoAntiglosa } from "../w10/clinico-w10.js";
import { Retrato } from "../f1/retrato.js";
import { VisaoIntegrada } from "../f1/visaoIntegrada.js";

export type ConsultaIntegrada = ConsultaVisao & { retrato?: Retrato; visaoIntegrada?: VisaoIntegrada };

const Texto = z.string();
const Count = z.number().int().nonnegative();
export const ConfirmacaoResposta = z.object({ codigo: z.string().min(1), resultRef: z.string().nullable().optional() });
export const AcaoResposta = z.object({ motivoCodigo: z.string().min(1),
  decisao: z.enum(["EXECUTADA", "REPLAY", "NEGADA", "OUTCOME_UNKNOWN", "FALHOU"]) });
const Documento = z.object({ documentId: Texto, documentVersion: z.number().int().positive(),
  titulo: Texto, preMarcado: z.boolean(), visivel: z.boolean() });
const Afirmacao = z.object({ rotulo: Texto, valorTexto: Texto.nullable(), estado: Semaforo,
  campo: StatusCampo, motivo: Texto, revisao: Revisao, fontes: z.array(Fonte), evidenceLayer: EvidenceLayer,
  candidatos: z.array(z.object({ valorTexto: Texto, fontes: z.array(Fonte) })).optional()
}).transform(({ candidatos, ...item }) => ({ ...item, ...(candidatos === undefined ? {} : { candidatos }) }));
export const ConsultaResposta: z.ZodType<ConsultaIntegrada> = z.object({ hoje: DataCivil,
  medicamentosAtuais: z.object({eventId: Texto.nullable(), medicamentos: z.array(Texto), conflito: z.boolean()}).optional(),
  contatosCanal: z.lazy(() => CanalResposta).optional(),
  retrato: Retrato.optional(), visaoIntegrada: VisaoIntegrada.optional(), dutos: DutosClinicaVisao.optional(),
  resumoEvolucao: Texto.nullable().default(null),
  historicoDocumentos: z.array(z.object({ eventId: Texto, documentId: Texto, titulo: Texto,
    documentVersion: z.number().int().positive(), tumorLotId: Texto.nullable(),
    liberacaoPendente:Texto.optional(), texto: Texto, assinadoEm: Texto, autorId: Texto, encounterId: Texto })).default([]),
  patientId: Texto, encounterId: Texto, tumorLotId: Texto.nullable(),
  cabecalho: z.object({ hoje: DataCivil, paciente: Paciente, lotes: z.array(TumorLot), loteSelecionadoId: Texto.nullable(),
    episodio: TreatmentEpisode.nullable(), ciclo: Ciclo.nullable(), semaforo: Semaforo, pendentes: Count,
    contatosDesdeUltima: z.array(Contato), alergiasPaciente: z.array(Texto), comorbidadesPaciente: z.array(Texto) }),
  alertas: z.array(Alerta), delta: z.object({ temSnapshotAnterior: z.boolean(), itens: z.array(z.object({
    id: Texto, rotulo: Texto, kind: DeltaKind, estado: Semaforo, direcao: DeltaDirecao.optional(),
    candidatos: z.array(z.object({ rotulo: Texto, valorTexto: Texto })).optional(),
  }).transform(({ direcao, candidatos, ...item }) => ({ ...item,
    ...(direcao === undefined ? {} : { direcao }), ...(candidatos === undefined ? {} : { candidatos }) }))) }), evidencias: z.array(Afirmacao),
  fechamento: z.object({ blocoAtual: z.enum(["EVOLUCAO", "PRESCRICAO", "EXAMES", "RETORNO", "APAC"]),
    registros: z.array(z.object({ id: Texto, expectedRevision: Count })), documentos: z.array(Documento),
    autorExibido: Texto, alvoImpressao: z.object({ tipo: Texto, id: Texto, versao: z.number().int().positive() }).nullable(),
    alertasVermelhos: z.array(Alerta) }),
}).passthrough().superRefine((resposta, ctx) => {
  if (resposta.contatosCanal?.mensagens.some(m => m.patientId !== resposta.patientId))
    ctx.addIssue({ code: "custom", message: "CONTATOS_CANAL_FORA_CONTEXTO" });
  const r = resposta.retrato, v = resposta.visaoIntegrada;
  const d = resposta.dutos;
  if(d&&(d.contexto.patientId!==resposta.patientId||d.contexto.encounterId!==resposta.encounterId||d.contexto.tumorLotId!==resposta.tumorLotId))ctx.addIssue({code:"custom",message:"DUTOS_FORA_CONTEXTO"});
  if (r && (r.patientId !== resposta.patientId || r.encounterId !== resposta.encounterId || r.tumorLotId !== resposta.tumorLotId))
    ctx.addIssue({code:"custom",message:"RETRATO_FORA_CONTEXTO"});
  if (v && (!r || v.correlacao.patientId !== resposta.patientId || v.correlacao.encounterId !== resposta.encounterId
    || v.correlacao.tumorLotId !== resposta.tumorLotId || v.correlacao.revisaoFatos !== r.revisao
    || JSON.stringify(v.correlacao.regras)!==JSON.stringify(r.regras) || JSON.stringify(v.correlacao.biblioteca)!==JSON.stringify(r.biblioteca)))
    ctx.addIssue({code:"custom",message:"VISAO_INTEGRADA_FORA_CONTEXTO"});
  if (r) {
    const referencias = new Set(r.fatos.map(f=>`${f.ref.eventId}@${f.ref.revisao}`));
    if (r.fatos.some(f=>f.patientId!==r.patientId || (f.escopo==="TUMOR" && f.tumorLotId!==r.tumorLotId))
      || r.resumo.some(frase=>frase.fatos.some(f=>!referencias.has(`${f.eventId}@${f.revisao}`)))
      || v && [...v.achados,...v.lacunas].some(a=>a.fatos.some(f=>!referencias.has(`${f.eventId}@${f.revisao}`))))
      ctx.addIssue({code:"custom",message:"REFERENCIA_FATO_DIVERGENTE"});
  }
}).transform(({retrato,visaoIntegrada,dutos,...resposta}) => ({...resposta,
  ...(dutos === undefined ? {} : {dutos}),
  ...(retrato === undefined ? {} : {retrato}), ...(visaoIntegrada === undefined ? {} : {visaoIntegrada})}));
export const AgendaResposta: z.ZodType<AgendaVisao> = z.object({ hoje: DataCivil, itens: z.array(z.object({
  horario: Texto, patientId: Texto, encounterId: Texto.optional(), nome: Texto, prontuario: Texto, semaforo: Semaforo,
  pendentes: Count, preConsultaPronta: z.boolean(), contatosDesdeUltima: Count, temE1: z.boolean(),
})) });
export const SalaoResposta: z.ZodType<SalaoVisao> = z.object({
  relatosInfusao:z.array(z.object({patientId:Texto,mensagemId:Texto,payloadSha256:Texto,texto:Texto,em:Texto,
      contextosRevisao:z.array(z.object({patientId:Texto,encounterId:Texto,tumorLotId:z.null()})).optional(),
      contextoMensagens:z.array(z.object({mensagemId:Texto,texto:Texto,em:Texto,contatoId:Texto.optional(),canal:Texto.optional()}))})).optional(), hoje: DataCivil, ruleset: SalaoRuleset,
  contexto: ContextoTriagem, fonte: Fonte.nullable(), cartoes: z.array(z.object({ entrada: EntradaFila,
    destino: Destino, emergencia: z.boolean(), temCorte: z.boolean(), nome: Texto })),
  pacientes: z.array(z.object({ patientId: Texto, encounterId: Texto, chegadaEm: Texto, nome: Texto,
    draftId: Texto.nullable().optional(), revision: z.number().int().nonnegative().nullable().optional(),
    estadoRascunho: z.enum(["RASCUNHO", "DECISAO_REGISTRADA"]).nullable().optional() })),
  decisoes: z.array(z.object({ patientId: Texto, motivo: Texto })),
}).passthrough();
export const CanalResposta: z.ZodType<CaixaCanalVisao> = z.object({ mensagens: z.array(z.object({ mensagemId: Texto,
  contextosResposta:z.array(z.object({patientId:Texto,encounterId:Texto,tumorLotId:Texto.nullable()})).optional(),
  texto: Texto, em: Texto, redFlag: z.boolean(), contatoId: Texto, patientId: Texto.nullable(), nomePaciente: Texto.nullable(),
  estadoVinculo: z.enum(["VINCULADO", "SEM_VINCULO", "CONFLITO", "REVOGADO"]).optional(),
  candidatos: z.array(z.object({ patientId: Texto, nome: Texto, encounterId: Texto.optional(), tumorLotId: Texto.nullable().optional() })),
  origemCanal: z.enum(["WHATSAPP_SERVICO", "WHATSAPP_PESSOAL", "EMAIL", "TELEFONE"]).optional(),
  pendenciaProcessamento: z.boolean().optional(),
  reciboTecnico: z.enum(["RECEBIDA", "PROCESSADA", "ENVIADA", "ENTREGUE", "LIDA", "FALHOU"]).optional(),
  estadoConversa: z.enum(["NOVA", "TRIADA", "AGUARDA_MEDICO", "RESPONDIDA", "ENCERRADA"]).optional(),
  midia: z.object({
    providerMediaId: Texto,
    mimeType: Texto.nullable(),
    processamento: z.enum(["NAO_PROCESSADA", "LIDA_LOCALMENTE"]),
  }).nullable().optional(),
  destinatarioExibido: Texto.optional(),
  contextoExibido: z.object({
    patientId: Texto.nullable(),
    encounterId: Texto.nullable(),
    versaoContexto: z.number().int().positive().optional(),
  }).optional(),
})) });
// A projeção do ledger acrescenta sua referência de evento; o contrato clínico continua estrito.
const ApacProjetada = Apac.safeExtend({ eventId: Texto.optional() }).transform(({ eventId: _eventId, ...apac }) => apac);
export const ApacResposta: z.ZodType<LotesApacVisao> = z.object({ hoje: DataCivil, itens: z.array(z.object({ apac: ApacProjetada,
  antiglosa: VereditoAntiglosa.nullable().default(null),
  antiglosaEstado: Texto.default("PENDENTE"),
  lote: TumorLot, nomePaciente: Texto, patientId: Texto, encounterId: Texto, ultimoAvisoEm: Texto.nullable(),
  campoOrigem: z.enum(["estadiamentos", "histologia", "topografia", "cid"]).nullable(), motivoNegativa: Texto.nullable(),
})) });
export const ChatResposta: z.ZodType<ChatSetorVisao> = z.object({ setor: z.enum(["TRIAGEM", "FARMACIA", "SECRETARIA", "MEDICO"]),
  patientId: Texto, encounterId: Texto, mensagens: z.array(z.object({ mensagemId: Texto, autor: Texto, texto: Texto })),
  prescricao: z.object({ conteudoPrescricaoId: Texto, estado: z.enum(ESTADOS_FARMACIA),
    texto: Texto, proposta: Texto.nullable(), chip: z.object({ estado: z.enum(["DISPONIVEL", "INDISPONIVEL", "DESCONHECIDO"]),
      origem: Texto.nullable(), data: Texto.nullable(), trava: z.literal(false), sugereTroca: z.literal(false), motivo: Texto }) }).nullable(),
});
export const FlashRascunhoResposta = z.object({ codigo: z.literal("RASCUNHO_SALVO"), draftId: Texto,
  revision: Count });
export const FlashPreparadaResposta = z.object({ codigo: z.literal("FLASH_PREPARADA"),
  registros: z.array(z.object({ id: Texto, expectedRevision: Count })).min(1),
  documentos: z.array(z.object({ documentId: Texto, documentVersion: z.number().int().positive(), titulo: Texto, tipoDocumento: Texto })).min(1),
  alvoImpressao: z.object({ tipo: Texto, id: Texto, versao: z.number().int().positive() }).nullable() });
export const BundleResposta = z.object({ patientId: Texto, encounterId: Texto,
  documentos: z.array(z.object({ draftId: Texto, documentId: Texto, documentVersion: z.number().int().positive(),
    conteudoHash: Texto.regex(/^[a-f0-9]{64}$/), conteudo: z.unknown() })) });
