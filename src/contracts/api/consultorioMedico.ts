import { z } from "zod";
import { DataCivil, Id, Instante } from "../base.js";
import { Paciente } from "../clinico.js";

const Chave = z.string().trim().min(1).max(160);
const Texto = z.string().max(12000);
export const LIMITE_CAMPO_PRECONSULTA = 1500;
const CampoPreConsulta = z.string().max(LIMITE_CAMPO_PRECONSULTA);
export const ContextoConsultorio = z.object({ patientId: Id, encounterId: Id, tumorLotId: Id.nullable() }).strict();
export type ContextoConsultorio = z.infer<typeof ContextoConsultorio>;
export const HorarioConsultorio = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const IntervaloAgendaMedica = z.object({ inicio: DataCivil, fim: DataCivil }).strict()
  .refine(p => p.inicio <= p.fim && Date.parse(p.fim) - Date.parse(p.inicio) <= 366 * 86400000, "INTERVALO_INVALIDO");
export const DadosCadastroMedico = Paciente.omit({ patientId: true, divergencia: true }).extend({ nome: z.string().trim().min(1).max(300),
  identificadores: z.array(z.object({ tipo: z.enum(["PRONTUARIO", "CPF", "CNS"]), valor: z.string().trim().min(1).max(120) }).strict()).max(20),
});
export const CadastroPacienteMedico = z.object({ operationId: Chave,
  paciente: DadosCadastroMedico, data: DataCivil, horario: HorarioConsultorio,
}).strict();
export const AlterarPacienteMedico = z.object({ contexto: ContextoConsultorio, operationId: Chave,
  expectedEventId: Id, dados: DadosCadastroMedico, motivo: z.string().trim().min(1).max(1000),
}).strict();
export const CadastroPacienteMedicoResposta = z.object({ codigo: z.enum(["CADASTRO_MEDICO", "GRAVADA", "REPLAY"]),
  contexto: ContextoConsultorio, paciente: Paciente, eventId: Id,
  historico: z.array(z.object({ eventId: Id, anteriorEventId: Id.nullable(), paciente: Paciente,
    autor: Id, registradoEm: Instante, motivo: z.string().nullable() }).strict()),
}).strict();
export const AgendarConsultaMedica = z.object({ operationId: Chave, patientId: Id, data: DataCivil,
  horario: HorarioConsultorio, tarefaRetornoId: Id.optional(),
}).strict();
export const AlterarAgendaMedica = z.object({ operationId: Chave, patientId: Id, encounterId: Id,
  expectedEventId: Id, acao: z.enum(["REMARCAR", "CANCELAR"]), motivo: z.string().trim().min(1).max(1000),
  data: DataCivil.optional(), horario: HorarioConsultorio.optional(),
}).strict().refine(p => p.acao !== "REMARCAR" || !!p.data && !!p.horario, "DATA_HORARIO_OBRIGATORIOS");
export const ItemAgendaMedica = z.object({ patientId: Id, encounterId: Id, nome: z.string(), data: DataCivil,
  horario: HorarioConsultorio, eventId: Id, cancelado: z.boolean(), motivo: z.string().nullable(),
  preConsulta: z.enum(["AUSENTE", "RASCUNHO", "REGISTRADA"]),
}).strict();
export const AgendaMedicaResposta = z.object({ codigo: z.literal("AGENDA_MEDICA"),
  itens: z.array(ItemAgendaMedica), pacientes: z.array(Paciente),
  retornos: z.array(z.object({ tarefaId: Id, patientId: Id, encounterId: Id, titulo: z.string(), dataAlvo: DataCivil.nullable() }).strict()),
}).strict();
export type AgendaMedicaResposta = z.infer<typeof AgendaMedicaResposta>;
export const OperacaoAgendaResposta = z.object({ codigo: z.enum(["GRAVADA", "REPLAY"]),
  contexto: ContextoConsultorio, eventId: Id,
}).strict();

export const EntradaPreConsultaMedica = z.object({ queixa: CampoPreConsulta, historia: CampoPreConsulta, antecedentes: CampoPreConsulta,
  medicamentos: CampoPreConsulta, alergias: CampoPreConsulta, contextoPessoal: CampoPreConsulta, observacoes: CampoPreConsulta,
  pesoKg: z.number().finite().positive().max(500).nullable(), alturaCm: z.number().finite().positive().max(300).nullable(),
  origemPeso: z.enum(["MEDIDO", "INFORMADO_PACIENTE", "NAO_INFORMADO"]),
}).strict().refine(e => (e.pesoKg === null) === (e.origemPeso === "NAO_INFORMADO"), "ORIGEM_PESO_DIVERGENTE");
export type EntradaPreConsultaMedica = z.infer<typeof EntradaPreConsultaMedica>;
export const SalvarPreConsultaMedica = z.object({ contexto: ContextoConsultorio, operationId: Chave,
  expectedVersion: z.number().int().nonnegative(), entrada: EntradaPreConsultaMedica,
}).strict();
export const ConfirmarPreConsultaMedica = z.object({ contexto: ContextoConsultorio, draftId: Id,
  expectedVersion: z.number().int().positive(), conteudoHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export const RascunhoPreConsultaMedica = z.object({ draftId: Id, versao: z.number().int().positive(),
  entrada: EntradaPreConsultaMedica, texto: Texto, conteudoHash: z.string().regex(/^[a-f0-9]{64}$/),
  autor: Id, salvoEm: Instante, confirmado: z.boolean(),
}).strict();
export const PreConsultaMedicaResposta = z.object({ codigo: z.literal("PRECONSULTA_MEDICA"), contexto: ContextoConsultorio,
  rascunho: RascunhoPreConsultaMedica.nullable(), assinado: z.literal(false),
}).strict();
export const ConfirmacaoPreConsultaResposta = z.object({ codigo: z.enum(["GRAVADA", "REPLAY"]),
  eventId: Id, assinado: z.literal(false),
}).strict();
export const SalvarNutricaoMedica = z.object({ contexto: ContextoConsultorio, operationId: Chave,
  expectedVersion: z.number().int().nonnegative(), texto: Texto,
}).strict();
export const NutricaoMedicaResposta = z.object({ codigo: z.literal("NUTRICAO_MEDICA"), contexto: ContextoConsultorio,
  rascunho: z.object({ draftId: Id, versao: z.number().int().positive(), texto: Texto,
    autor: Id, salvoEm: Instante }).strict().nullable(), assinado: z.literal(false),
}).strict();

export interface ApiConsultorioMedico {
  agenda(pedido: z.infer<typeof IntervaloAgendaMedica>, signal?: AbortSignal): Promise<AgendaMedicaResposta>;
  cadastrar(pedido: z.infer<typeof CadastroPacienteMedico>): Promise<z.infer<typeof OperacaoAgendaResposta>>;
  paciente(contexto: ContextoConsultorio, signal?: AbortSignal): Promise<z.infer<typeof CadastroPacienteMedicoResposta>>;
  alterarPaciente(pedido: z.infer<typeof AlterarPacienteMedico>): Promise<z.infer<typeof CadastroPacienteMedicoResposta>>;
  agendar(pedido: z.infer<typeof AgendarConsultaMedica>): Promise<z.infer<typeof OperacaoAgendaResposta>>;
  alterarAgenda(pedido: z.infer<typeof AlterarAgendaMedica>): Promise<z.infer<typeof OperacaoAgendaResposta>>;
  preConsulta(contexto: ContextoConsultorio, signal?: AbortSignal): Promise<z.infer<typeof PreConsultaMedicaResposta>>;
  salvarPreConsulta(pedido: z.infer<typeof SalvarPreConsultaMedica>): Promise<z.infer<typeof PreConsultaMedicaResposta>>;
  confirmarPreConsulta(pedido: z.infer<typeof ConfirmarPreConsultaMedica>): Promise<z.infer<typeof ConfirmacaoPreConsultaResposta>>;
  nutricao(contexto: ContextoConsultorio, signal?: AbortSignal): Promise<z.infer<typeof NutricaoMedicaResposta>>;
  salvarNutricao(pedido: z.infer<typeof SalvarNutricaoMedica>): Promise<z.infer<typeof NutricaoMedicaResposta>>;
}

export const SaidasConsultorioMedico = {
  "/medico/agenda": AgendaMedicaResposta,
  "/medico/paciente/cadastrar": OperacaoAgendaResposta,
  "/medico/paciente/ler": CadastroPacienteMedicoResposta,
  "/medico/paciente/alterar": CadastroPacienteMedicoResposta,
  "/medico/agenda/agendar": OperacaoAgendaResposta,
  "/medico/agenda/alterar": OperacaoAgendaResposta,
  "/medico/preconsulta": PreConsultaMedicaResposta,
  "/medico/preconsulta/salvar": PreConsultaMedicaResposta,
  "/medico/preconsulta/confirmar": ConfirmacaoPreConsultaResposta,
  "/medico/nutricao": NutricaoMedicaResposta,
  "/medico/nutricao/salvar": NutricaoMedicaResposta,
} as const;
