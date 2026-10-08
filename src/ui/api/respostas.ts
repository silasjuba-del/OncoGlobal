import { z } from "zod";
import { DataCivil, Fonte } from "../../contracts/base.js";
import { Paciente, TumorLot, TreatmentEpisode, Ciclo, Contato } from "../../contracts/clinico.js";
import { Alerta, Apac } from "../../contracts/operacao.js";
import { Semaforo, Destino, DeltaKind, DeltaDirecao, StatusCampo, Revisao, EvidenceLayer } from "../../contracts/estados.js";
import { ContextoTriagem, EntradaFila, SalaoRuleset } from "../../contracts/regras.js";
import type { AgendaVisao, CaixaCanalVisao, ChatSetorVisao, ConsultaVisao, LotesApacVisao, SalaoVisao } from "./porta.js";
import { ESTADOS_FARMACIA } from "../../modules/farmacia/estados.js";

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
export const ConsultaResposta: z.ZodType<ConsultaVisao> = z.object({ hoje: DataCivil,
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
}).passthrough();
export const AgendaResposta: z.ZodType<AgendaVisao> = z.object({ hoje: DataCivil, itens: z.array(z.object({
  horario: Texto, patientId: Texto, nome: Texto, prontuario: Texto, semaforo: Semaforo,
  pendentes: Count, preConsultaPronta: z.boolean(), contatosDesdeUltima: Count, temE1: z.boolean(),
})) });
export const SalaoResposta: z.ZodType<SalaoVisao> = z.object({ hoje: DataCivil, ruleset: SalaoRuleset,
  contexto: ContextoTriagem, fonte: Fonte.nullable(), cartoes: z.array(z.object({ entrada: EntradaFila,
    destino: Destino, emergencia: z.boolean(), temCorte: z.boolean(), nome: Texto })),
  pacientes: z.array(z.object({ patientId: Texto, encounterId: Texto, chegadaEm: Texto, nome: Texto })),
  decisoes: z.array(z.object({ patientId: Texto, motivo: Texto })),
}).passthrough();
export const CanalResposta: z.ZodType<CaixaCanalVisao> = z.object({ mensagens: z.array(z.object({ mensagemId: Texto,
  texto: Texto, em: Texto, redFlag: z.boolean(), contatoId: Texto, patientId: Texto.nullable(), nomePaciente: Texto.nullable(),
  candidatos: z.array(z.object({ patientId: Texto, nome: Texto })),
})) });
export const ApacResposta: z.ZodType<LotesApacVisao> = z.object({ hoje: DataCivil, itens: z.array(z.object({ apac: Apac,
  lote: TumorLot, nomePaciente: Texto, patientId: Texto, encounterId: Texto, ultimoAvisoEm: Texto.nullable(),
  campoOrigem: z.enum(["estadiamentos", "histologia", "topografia", "cid"]).nullable(), motivoNegativa: Texto.nullable(),
})) });
export const ChatResposta: z.ZodType<ChatSetorVisao> = z.object({ setor: z.enum(["TRIAGEM", "FARMACIA", "SECRETARIA", "MEDICO"]),
  patientId: Texto, encounterId: Texto, mensagens: z.array(z.object({ mensagemId: Texto, autor: Texto, texto: Texto })),
  prescricao: z.object({ conteudoPrescricaoId: Texto, estado: z.enum(ESTADOS_FARMACIA),
    texto: Texto, proposta: Texto.nullable(), chip: z.object({ estado: z.enum(["DISPONIVEL", "INDISPONIVEL", "DESCONHECIDO"]),
      origem: Texto.nullable(), data: Texto.nullable(), trava: z.literal(false), sugereTroca: z.literal(false), motivo: Texto }) }).nullable(),
});
export const BundleResposta = z.object({ patientId: Texto, encounterId: Texto,
  documentos: z.array(z.object({ draftId: Texto, documentId: Texto, documentVersion: z.number().int().positive(),
    conteudoHash: Texto.regex(/^[a-f0-9]{64}$/), conteudo: z.unknown() })) });
