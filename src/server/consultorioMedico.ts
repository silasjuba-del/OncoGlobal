import { z } from "zod";
import { Paciente } from "../contracts/clinico.js";
import { Fonte, Instante, Sessao } from "../contracts/base.js";
import { Tarefa } from "../contracts/f1/tarefa.js";
import {
  AgendarConsultaMedica, AgendaMedicaResposta, AlterarAgendaMedica, CadastroPacienteMedico,
  AlterarPacienteMedico, CadastroPacienteMedicoResposta,
  ConfirmarPreConsultaMedica, ContextoConsultorio, EntradaPreConsultaMedica, IntervaloAgendaMedica,
  NutricaoMedicaResposta, PreConsultaMedicaResposta, SalvarNutricaoMedica, SalvarPreConsultaMedica,
  SaidasConsultorioMedico, type EntradaPreConsultaMedica as Entrada,
} from "../contracts/api/consultorioMedico.js";
import { executarConfirmacao } from "../kernel/comandos/index.js";
import { lerDraft, listarDrafts, salvarDraft, transacao } from "../kernel/comandos/portas.js";
import { dadosDoEvento, eventosVigentes } from "../kernel/projections/snapshot.js";
import { lerEventosComIntegridade, lerPaciente } from "./leituras.js";
import { hashConteudoExibido as hash } from "./sessao.js";
import type { ClinicalEvent } from "../contracts/operacao.js";
import type { ServidorDeps } from "./rotas.js";

class Recusa extends Error { constructor(readonly codigo: string, readonly status = 409) { super(codigo); } }
function retornosAgendados(vigentes: readonly ClinicalEvent[], todos: readonly ClinicalEvent[]) {
  return new Set(vigentes.filter(e => e.tipo === "ReviewDecision").flatMap(e => {
    const d = dadosDoEvento(e);
    if (d?.acao !== "AGENDAR_RETORNO" || !d.tarefaRetornoId) return [];
    return vigentes.some(a => a.tipo === "AgendaEntry" && a.patientId === e.patientId
      && a.encounterId === d.encounterId && agendaCancelada(a, todos) === null) ? [d.tarefaRetornoId] : [];
  }));
}
const AgendaEvento = z.object({ patientId: z.string(), encounterId: z.string(), data: z.iso.date(), horario: z.string() }).strict();
const Cancelamento = z.object({ campo: z.literal("agenda"), acao: z.literal("CANCELAR"), agendaEventId: z.string(),
  patientId: z.string(), encounterId: z.string(), motivo: z.string(), atorId: z.string(), em: Instante }).strict();
const CorrecaoCadastro = z.object({ campo: z.literal("cadastroPaciente"), acao: z.literal("CORRIGIR_CADASTRO"),
  anteriorEventId: z.string(), novoEventId: z.string(), patientId: z.string(), motivo: z.string(), atorId: z.string(), em: Instante }).strict();
const Registro = z.object({ kind: z.literal("SINTESE_RASCUNHO"), formato: z.enum(["PRECONSULTA_MEDICA", "NUTRICAO_MEDICA"]),
  contexto: ContextoConsultorio, draftId: z.string(), requestHash: z.string(), versao: z.number().int().positive(),
  entrada: EntradaPreConsultaMedica.optional(), texto: z.string().max(12000), autor: z.string(), salvoEm: Instante,
  conteudoHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
type Registro = z.infer<typeof Registro>;
type Contexto = z.infer<typeof ContextoConsultorio>;

/** O cancelamento conserva o evento agendado e registra a decisão médica separadamente. */
export function agendaCancelada(evento: ClinicalEvent, todos: readonly ClinicalEvent[]): string | null {
  for (const e of todos) {
    if (e.tipo !== "ReviewDecision" || e.revisao !== "CONFIRMADO" || e.criadoPor.tipo !== "SESSAO"
      || e.patientId !== evento.patientId || e.encounterId !== evento.encounterId) continue;
    const p = Cancelamento.safeParse(dadosDoEvento(e));
    if (p.success && p.data.agendaEventId === evento.eventId && p.data.patientId === evento.patientId
      && p.data.encounterId === evento.encounterId && p.data.atorId === e.criadoPor.id && p.data.em === e.criadoEm) return p.data.motivo;
  }
  return null;
}

function validarRegistro(d: ReturnType<typeof lerDraft>): Registro {
  if (!d) throw new Recusa("RASCUNHO_NAO_ENCONTRADO");
  const r = Registro.parse(d.payload), { conteudoHash, ...conteudo } = r;
  if (r.draftId !== d.draftId || d.patientId !== r.contexto.patientId || hash(conteudo) !== conteudoHash
    || r.formato === "PRECONSULTA_MEDICA" && !r.entrada) throw new Recusa("RASCUNHO_INTEGRIDADE_INVALIDA");
  return r;
}
function ultimoRegistro(deps: ServidorDeps, contexto: Contexto, formato: Registro["formato"]): Registro | null {
  const lista = listarDrafts(deps.db, contexto.patientId).filter(d => {
    const p = d.payload;
    return !!p && typeof p === "object" && "formato" in p && p.formato === formato;
  }).map(validarRegistro).filter(r => hash(r.contexto) === hash(contexto)).sort((a, b) => b.versao - a.versao);
  if (new Set(lista.map(r => r.versao)).size !== lista.length) throw new Recusa("RASCUNHO_VERSAO_AMBIGUA");
  return lista[0] ?? null;
}
function contextoSelecionado(deps: ServidorDeps, token: string, contexto: Contexto): void {
  if (hash(deps.sessoes.consultaSelecionada(token)) !== hash(contexto)) throw new Recusa("CONTEXTO_CONSULTA_ALTERADO");
  if (!lerPaciente(deps.db, contexto.patientId)) throw new Recusa("PACIENTE_NAO_ENCONTRADO", 404);
  const registros = lerEventosComIntegridade(deps.db, contexto.patientId).itens;
  if (!registros.some(e => e.encounterId === contexto.encounterId)) throw new Recusa("ENCONTRO_NAO_ENCONTRADO", 404);
}
const fonteManual = (id: string, payload: unknown, em: string): Fonte => ({ sourceId: id, classe: "MANUAL",
  localizador: "Entrada explícita do médico no consultório", dataClinica: null, dataCaptura: em, versao: "1", contentHash: hash(payload) });

function cadastroVigente(deps: ServidorDeps, contexto: Contexto) {
  const todos = lerEventosComIntegridade(deps.db, contexto.patientId).itens;
  const candidatos = eventosVigentes(todos).filter(e => /^Paciente(?:@1)?$/.test(e.tipo));
  if (candidatos.length !== 1) throw new Recusa("CADASTRO_VIGENTE_AMBIGUO");
  const evento = candidatos[0]!, paciente = Paciente.parse(dadosDoEvento(evento));
  if (paciente.patientId !== contexto.patientId) throw new Recusa("CADASTRO_IDENTIDADE_DIVERGENTE");
  return { evento, paciente, todos };
}
function respostaCadastro(deps: ServidorDeps, contexto: Contexto, codigo: "CADASTRO_MEDICO" | "GRAVADA" | "REPLAY") {
  const { evento, paciente, todos } = cadastroVigente(deps, contexto);
  const historico = todos.filter(e => /^Paciente(?:@1)?$/.test(e.tipo)).map(e => {
    const origem = todos.filter(d => d.tipo === "ReviewDecision" && d.revisao === "CONFIRMADO").flatMap(d => {
      const p = CorrecaoCadastro.safeParse(dadosDoEvento(d));
      return p.success && p.data.patientId === contexto.patientId && p.data.novoEventId === e.eventId
        && p.data.anteriorEventId === e.supersedesEventId && p.data.atorId === d.criadoPor.id && d.operationId === e.operationId ? [p.data] : [];
    });
    return { eventId: e.eventId, anteriorEventId: e.supersedesEventId, paciente: Paciente.parse(dadosDoEvento(e)),
      autor: e.criadoPor.id, registradoEm: e.criadoEm, motivo: origem.length === 1 ? origem[0]!.motivo : null };
  });
  return CadastroPacienteMedicoResposta.parse({ codigo, contexto, paciente, eventId: evento.eventId, historico });
}
function conferirIdentificadores(vigentes: readonly ClinicalEvent[], identificadores: z.infer<typeof Paciente>["identificadores"], proprioId?: string) {
  const normalizar = (valor: string) => valor.replace(/\W/g, "").toUpperCase();
  const chaves = identificadores.map(i => `${i.tipo}:${normalizar(i.valor)}`);
  if (new Set(chaves).size !== chaves.length || identificadores.some(i => !normalizar(i.valor))) throw new Recusa("IDENTIFICADOR_DUPLICADO_OU_INVALIDO", 400);
  for (const e of vigentes.filter(e => /^Paciente(?:@1)?$/.test(e.tipo) && e.patientId !== proprioId)) {
    const p = Paciente.safeParse(dadosDoEvento(e));
    if (p.success && p.data.identificadores.some(i => chaves.includes(`${i.tipo}:${normalizar(i.valor)}`))) throw new Recusa("IDENTIFICADOR_JA_CADASTRADO");
  }
}

function gravar(deps: ServidorDeps, sessao: z.infer<typeof Sessao>, contexto: Contexto, operationId: string,
  registros: { tipo: string; payload: unknown; supersedesEventId?: string }[], em: string) {
  const preparados = registros.map((r, i) => {
    const id = `medico:${hash([operationId, i])}`, fonte = fonteManual(id, r.payload, em);
    const draft = lerDraft(deps.db, id) ?? salvarDraft(deps.db, { draftId: id, patientId: contexto.patientId,
      sourceId: id, rawRef: "referencia-local", payload: { contexto, valor: r.payload, fontes: [fonte] }, diagnostics: [], revision: 0, criadoEm: em });
    return { draftId: draft.draftId, expectedRevision: draft.revision, eventId: `evento:${id}`,
      tipo: r.tipo, payload: r.payload, fontes: [fonte], revisao: "CONFIRMADO" as const,
      ...(r.supersedesEventId ? { supersedesEventId: r.supersedesEventId } : {}) };
  });
  const resultado = executarConfirmacao(deps.db, { ...contexto, operationId, reviewDecisionId: `revisao:${hash(operationId)}`,
    sessao, autorizadoEm: deps.agora(), em, registros: preparados });
  if (resultado.estado === "NEGADA") throw new Recusa(resultado.motivo ?? "OPERACAO_NEGADA");
  return preparados.map(r => r.eventId);
}

function textoPreConsulta(e: Entrada): string {
  const linhas = [["Queixa", e.queixa], ["História relatada", e.historia], ["Antecedentes relatados", e.antecedentes],
    ["Medicamentos relatados", e.medicamentos], ["Alergias relatadas", e.alergias], ["Contexto pessoal", e.contextoPessoal], ["Observações médicas", e.observacoes]];
  return ["Pré-consulta — relato coletado pelo médico; não constitui diagnóstico automático.",
    ...linhas.map(([rotulo, texto]) => `${rotulo}: ${texto?.trim() || "Não informado"}`),
    `Peso: ${e.pesoKg === null ? "Não informado" : `${e.pesoKg} kg (${e.origemPeso})`}`,
    `Altura: ${e.alturaCm === null ? "Não informada" : `${e.alturaCm} cm`}`].join("\n");
}

function respostaRascunho(deps: ServidorDeps, contexto: Contexto, formato: Registro["formato"], r: Registro | null) {
  if (formato === "NUTRICAO_MEDICA") return NutricaoMedicaResposta.parse({ codigo: "NUTRICAO_MEDICA", contexto,
    rascunho: r ? { draftId: r.draftId, versao: r.versao, texto: r.texto, autor: r.autor, salvoEm: r.salvoEm } : null, assinado: false });
  const confirmado = r ? lerEventosComIntegridade(deps.db, contexto.patientId).itens.some(e =>
    e.tipo === "AnotacaoEvolucao" && dadosDoEvento(e)?.mensagemId === `preconsulta:${r.draftId}`) : false;
  return PreConsultaMedicaResposta.parse({ codigo: "PRECONSULTA_MEDICA", contexto,
    rascunho: r ? { draftId: r.draftId, versao: r.versao, entrada: r.entrada, texto: r.texto,
      conteudoHash: r.conteudoHash, autor: r.autor, salvoEm: r.salvoEm, confirmado } : null, assinado: false });
}

/** Rotas de consultório: a sessão vem exclusivamente do servidor. Sem escrita direta de clinical_event. */
export function operarConsultorio(deps: ServidorDeps, token: string, rota: string, raw: unknown): { status: number; body: unknown } | null {
  if (!Object.hasOwn(SaidasConsultorioMedico, rota)) return null;
  const sessao = deps.sessoes.obter(token);
  if (!sessao) return { status: 401, body: { codigo: "SESSAO_INVALIDA" } };
  try {
    return transacao(deps.db, () => {
      const em = deps.agora();
      if (rota === "/medico/paciente/ler" || rota === "/medico/paciente/alterar") {
        const pedido = rota.endsWith("/alterar") ? AlterarPacienteMedico.parse(raw) : null;
        const contexto = pedido?.contexto ?? ContextoConsultorio.parse(raw);
        contextoSelecionado(deps, token, contexto);
        if (!pedido) return { status: 200, body: respostaCadastro(deps, contexto, "CADASTRO_MEDICO") };
        const operationId = `cadastro-corrigir:${hash(pedido.operationId)}`, reciboId = `recibo:${operationId}`, requestHash = hash({ rota, pedido, ator: sessao.medicoId });
        const recibo = lerDraft(deps.db, reciboId), { evento, paciente } = cadastroVigente(deps, contexto);
        if (recibo) {
          const r = z.object({ kind: z.literal("SINTESE_RASCUNHO"), formato: z.literal("RECIBO_CORRECAO_CADASTRO"),
            requestHash: z.string(), eventId: z.string(), conteudoHash: z.string() }).strict().parse(recibo.payload);
          if (r.requestHash !== requestHash) throw new Recusa("IDEMPOTENCIA_CONFLITO");
          const persistido = lerEventosComIntegridade(deps.db, contexto.patientId).itens.find(e => e.eventId === r.eventId);
          if (recibo.patientId !== contexto.patientId || r.conteudoHash !== hash({ requestHash, eventId: r.eventId })
            || !persistido || persistido.operationId !== operationId || !/^Paciente(?:@1)?$/.test(persistido.tipo)) throw new Recusa("RECIBO_INTEGRIDADE_INVALIDA");
          return { status: 200, body: respostaCadastro(deps, contexto, "REPLAY") };
        }
        if (evento.eventId !== pedido.expectedEventId) throw new Recusa("CADASTRO_REVISAO_CONFLITANTE");
        conferirIdentificadores(eventosVigentes(lerEventosComIntegridade(deps.db).itens), pedido.dados.identificadores, contexto.patientId);
        const eventId = `evento:medico:${hash([operationId, 0])}`;
        // Cadastro é do paciente. Conserva o lote do evento original, mesmo quando a consulta seleciona outro lote.
        gravar(deps, sessao, { ...contexto, tumorLotId: evento.tumorLotId }, operationId, [
          { tipo: "Paciente", payload: { ...pedido.dados, patientId: contexto.patientId, divergencia: paciente.divergencia }, supersedesEventId: evento.eventId },
          { tipo: "ReviewDecision", payload: CorrecaoCadastro.parse({ campo: "cadastroPaciente", acao: "CORRIGIR_CADASTRO",
            anteriorEventId: evento.eventId, novoEventId: eventId, patientId: contexto.patientId, motivo: pedido.motivo, atorId: sessao.medicoId, em }) },
        ], em);
        salvarDraft(deps.db, { draftId: reciboId, patientId: contexto.patientId, sourceId: reciboId, rawRef: "referencia-local",
          payload: { kind: "SINTESE_RASCUNHO", formato: "RECIBO_CORRECAO_CADASTRO", requestHash, eventId,
            conteudoHash: hash({ requestHash, eventId }) }, diagnostics: [], revision: 0, criadoEm: em });
        return { status: 201, body: respostaCadastro(deps, contexto, "GRAVADA") };
      }
      if (rota === "/medico/agenda") {
        const intervalo = IntervaloAgendaMedica.parse(raw), todos = lerEventosComIntegridade(deps.db).itens, vigentes = eventosVigentes(todos);
        const pacientes = vigentes.filter(e => /^Paciente(?:@1)?$/.test(e.tipo)).flatMap(e => {
          const p = Paciente.safeParse(dadosDoEvento(e)); return p.success && p.data.patientId === e.patientId ? [p.data] : [];
        });
        const itens = vigentes.filter(e => e.tipo === "AgendaEntry").flatMap(e => {
          const a = AgendaEvento.safeParse(dadosDoEvento(e));
          if (!a.success || a.data.patientId !== e.patientId || a.data.encounterId !== e.encounterId
            || a.data.data < intervalo.inicio || a.data.data > intervalo.fim) return [];
          const ps = pacientes.filter(p => p.patientId === e.patientId); if (ps.length !== 1) return [];
          const c = { patientId: e.patientId, encounterId: e.encounterId, tumorLotId: null }, r = ultimoRegistro(deps, c, "PRECONSULTA_MEDICA");
          const nota = r && todos.some(n => n.tipo === "AnotacaoEvolucao" && dadosDoEvento(n)?.mensagemId === `preconsulta:${r.draftId}`);
          const motivo = agendaCancelada(e, todos);
          return [{ ...a.data, nome: ps[0]!.nome, eventId: e.eventId, cancelado: motivo !== null, motivo,
            preConsulta: !r ? "AUSENTE" : nota ? "REGISTRADA" : "RASCUNHO" }];
        }).sort((a, b) => `${a.data} ${a.horario}`.localeCompare(`${b.data} ${b.horario}`));
        const agendados = retornosAgendados(vigentes, todos);
        const retornos = vigentes.filter(e => e.tipo === "Tarefa").flatMap(e => {
          const t = Tarefa.safeParse(dadosDoEvento(e));
          return t.success && t.data.retornoRef && ["CONFIRMADA", "RASCUNHO"].includes(t.data.estado) && !agendados.has(t.data.tarefaId)
            ? [{ tarefaId: t.data.tarefaId, patientId: t.data.patientId, encounterId: t.data.encounterId, titulo: t.data.titulo, dataAlvo: t.data.dataAlvo }] : [];
        });
        return { status: 200, body: AgendaMedicaResposta.parse({ codigo: "AGENDA_MEDICA", itens, pacientes, retornos }) };
      }
      if (["/medico/paciente/cadastrar", "/medico/agenda/agendar", "/medico/agenda/alterar"].includes(rota)) {
        const pedido = rota.endsWith("cadastrar") ? CadastroPacienteMedico.parse(raw) : rota.endsWith("agendar") ? AgendarConsultaMedica.parse(raw) : AlterarAgendaMedica.parse(raw);
        const operationId = `consultorio:${hash(pedido.operationId)}`, reciboId = `recibo:${operationId}`, requestHash = hash({ rota, pedido, ator: sessao.medicoId });
        const anterior = lerDraft(deps.db, reciboId);
        if (anterior) {
          const p = z.object({ kind: z.literal("SINTESE_RASCUNHO"), formato: z.literal("RECIBO_CONSULTORIO"), requestHash: z.string(), resposta: z.object({ contexto: ContextoConsultorio, eventId: z.string() }), conteudoHash: z.string() }).strict().parse(anterior.payload);
          if (p.requestHash !== requestHash) throw new Recusa("IDEMPOTENCIA_CONFLITO");
          if (p.conteudoHash !== hash({ requestHash: p.requestHash, resposta: p.resposta }) || anterior.patientId !== p.resposta.contexto.patientId) throw new Recusa("RECIBO_INTEGRIDADE_INVALIDA");
          const evento = lerEventosComIntegridade(deps.db, p.resposta.contexto.patientId).itens.find(e => e.eventId === p.resposta.eventId);
          if (!evento || evento.operationId !== operationId || evento.encounterId !== p.resposta.contexto.encounterId) throw new Recusa("RECIBO_INTEGRIDADE_INVALIDA");
          return { status: 200, body: { codigo: "REPLAY", ...p.resposta } };
        }
        const todos = lerEventosComIntegridade(deps.db).itens, vigentes = eventosVigentes(todos);
        let contexto: Contexto, registros: { tipo: string; payload: unknown; supersedesEventId?: string }[];
        if ("paciente" in pedido) {
          conferirIdentificadores(vigentes, pedido.paciente.identificadores);
          contexto = { patientId: `paciente:${hash(operationId)}`, encounterId: `encontro:${hash(operationId)}`, tumorLotId: null };
          registros = [{ tipo: "Paciente", payload: { ...pedido.paciente, patientId: contexto.patientId, divergencia: false } },
            { tipo: "AgendaEntry", payload: { patientId: contexto.patientId, encounterId: contexto.encounterId, data: pedido.data, horario: pedido.horario } }];
        } else if ("acao" in pedido) {
          const evento = vigentes.find(e => e.eventId === pedido.expectedEventId && e.tipo === "AgendaEntry" && e.patientId === pedido.patientId && e.encounterId === pedido.encounterId);
          if (!evento || agendaCancelada(evento, todos)) throw new Recusa("AGENDA_REVISAO_CONFLITANTE");
          contexto = { patientId: pedido.patientId, encounterId: pedido.encounterId, tumorLotId: null };
          registros = pedido.acao === "CANCELAR" ? [{ tipo: "ReviewDecision", payload: Cancelamento.parse({ campo: "agenda", acao: "CANCELAR",
            agendaEventId: evento.eventId, patientId: contexto.patientId, encounterId: contexto.encounterId, motivo: pedido.motivo, atorId: sessao.medicoId, em }) }]
            : [{ tipo: "AgendaEntry", payload: { patientId: pedido.patientId, encounterId: pedido.encounterId, data: pedido.data, horario: pedido.horario }, supersedesEventId: evento.eventId },
              { tipo: "ReviewDecision", payload: { campo: "agenda", acao: "REMARCAR", agendaAnteriorEventId: evento.eventId,
                novoAgendaEventId: `evento:medico:${hash([operationId, 0])}`, motivo: pedido.motivo, data: pedido.data, horario: pedido.horario,
                patientId: pedido.patientId, encounterId: pedido.encounterId, atorId: sessao.medicoId, em } }];
        } else {
          if (!lerPaciente(deps.db, pedido.patientId)) throw new Recusa("PACIENTE_NAO_ENCONTRADO", 404);
          contexto = { patientId: pedido.patientId, encounterId: `encontro:${hash(operationId)}`, tumorLotId: null };
          registros = [{ tipo: "AgendaEntry", payload: { patientId: contexto.patientId, encounterId: contexto.encounterId, data: pedido.data, horario: pedido.horario } }];
          if (pedido.tarefaRetornoId) {
            const candidatas = vigentes.filter(e => e.tipo === "Tarefa" && e.patientId === pedido.patientId && dadosDoEvento(e)?.tarefaId === pedido.tarefaRetornoId);
            if (candidatas.length !== 1 || !Tarefa.parse(dadosDoEvento(candidatas[0]!)).retornoRef
              || !["CONFIRMADA", "RASCUNHO"].includes(Tarefa.parse(dadosDoEvento(candidatas[0]!)).estado)
              || retornosAgendados(vigentes, todos).has(pedido.tarefaRetornoId)) throw new Recusa("RETORNO_JA_AGENDADO_OU_INVALIDO");
            registros.push({ tipo: "ReviewDecision", payload: { campo: "agenda", acao: "AGENDAR_RETORNO", tarefaRetornoId: pedido.tarefaRetornoId,
              encounterId: contexto.encounterId, patientId: contexto.patientId, atorId: sessao.medicoId, em } });
          }
        }
        const ids = gravar(deps, sessao, contexto, operationId, registros, em), eventId = ids["paciente" in pedido ? 1 : 0]!;
        const resposta = { contexto, eventId };
        salvarDraft(deps.db, { draftId: reciboId, patientId: contexto.patientId, sourceId: reciboId, rawRef: "referencia-local",
          payload: { kind: "SINTESE_RASCUNHO", formato: "RECIBO_CONSULTORIO", requestHash, resposta, conteudoHash: hash({ requestHash, resposta }) }, diagnostics: [], revision: 0, criadoEm: em });
        return { status: 201, body: { codigo: "GRAVADA", ...resposta } };
      }
      const confirmar = rota === "/medico/preconsulta/confirmar", salvar = rota.endsWith("/salvar"), formato = rota.includes("/nutricao") ? "NUTRICAO_MEDICA" : "PRECONSULTA_MEDICA";
      const p = confirmar ? ConfirmarPreConsultaMedica.parse(raw) : salvar ? (formato === "NUTRICAO_MEDICA" ? SalvarNutricaoMedica.parse(raw) : SalvarPreConsultaMedica.parse(raw)) : { contexto: ContextoConsultorio.parse(raw) };
      contextoSelecionado(deps, token, p.contexto);
      const atual = ultimoRegistro(deps, p.contexto, formato);
      if (confirmar) {
        const pedido = ConfirmarPreConsultaMedica.parse(raw);
        if (!atual || atual.draftId !== pedido.draftId || atual.versao !== pedido.expectedVersion || atual.conteudoHash !== pedido.conteudoHash) throw new Recusa("PRECONSULTA_DESATUALIZADA");
        const mensagemId = `preconsulta:${atual.draftId}`, op = `preconsulta-confirmar:${hash(atual.draftId)}`;
        const existentes = lerEventosComIntegridade(deps.db, p.contexto.patientId).itens.filter(e => e.tipo === "AnotacaoEvolucao" && dadosDoEvento(e)?.mensagemId === mensagemId);
        if (existentes.length > 1) throw new Recusa("PRECONSULTA_CONFIRMACAO_AMBIGUA");
        if (existentes[0]) return { status: 200, body: { codigo: "REPLAY", eventId: existentes[0].eventId, assinado: false } };
        const [msgId] = gravar(deps, sessao, p.contexto, `${op}:mensagem`, [{ tipo: "ChatMessage", payload: { mensagemId,
          patientId: p.contexto.patientId, encounterId: p.contexto.encounterId, setor: "MEDICO", autor: sessao.medicoId, texto: atual.texto } }], em);
        const msg = lerEventosComIntegridade(deps.db, p.contexto.patientId).itens.find(e => e.eventId === msgId);
        if (!msg) throw new Recusa("PRECONSULTA_ORIGEM_INDISPONIVEL");
        const [eventId] = gravar(deps, sessao, p.contexto, `${op}:anotacao`, [{ tipo: "AnotacaoEvolucao", payload: {
          texto: atual.texto, mensagemId, atorId: sessao.medicoId, aceitaEm: em, contexto: p.contexto,
          origemMensagem: { eventId: msg.eventId, contentHash: hash(msg) },
        } }], em);
        return { status: 201, body: { codigo: "GRAVADA", eventId, assinado: false } };
      }
      if (!salvar) return { status: 200, body: respostaRascunho(deps, p.contexto, formato, atual) };
      const pedido = formato === "NUTRICAO_MEDICA" ? SalvarNutricaoMedica.parse(raw) : SalvarPreConsultaMedica.parse(raw);
      const id = `rascunho-medico:${hash(pedido.operationId)}`, requestHash = hash({ rota, pedido, ator: sessao.medicoId }), anterior = lerDraft(deps.db, id);
      if (anterior) {
        const registro = validarRegistro(anterior);
        if (registro.requestHash !== requestHash || hash(registro.contexto) !== hash(p.contexto)) throw new Recusa("IDEMPOTENCIA_CONFLITO");
        return { status: 200, body: respostaRascunho(deps, p.contexto, formato, registro) };
      }
      if (pedido.expectedVersion !== (atual?.versao ?? 0)) throw new Recusa("RASCUNHO_REVISAO_CONFLITANTE");
      const conteudo = { kind: "SINTESE_RASCUNHO" as const, formato, contexto: p.contexto, draftId: id, requestHash,
        versao: (atual?.versao ?? 0) + 1, ...("entrada" in pedido ? { entrada: pedido.entrada } : {}),
        texto: "entrada" in pedido ? textoPreConsulta(pedido.entrada) : pedido.texto, autor: sessao.medicoId, salvoEm: em };
      const registro = Registro.parse({ ...conteudo, conteudoHash: hash(conteudo) });
      salvarDraft(deps.db, { draftId: id, patientId: p.contexto.patientId, sourceId: id, rawRef: "referencia-local",
        payload: registro, diagnostics: ["REVISAO_MEDICA_OBRIGATORIA", "NAO_ASSINADO"], revision: 0, criadoEm: em });
      return { status: 201, body: respostaRascunho(deps, p.contexto, formato, registro) };
    });
  } catch (e) {
    return { status: e instanceof Recusa ? e.status : e instanceof z.ZodError ? 400 : 503,
      body: { codigo: e instanceof Recusa ? e.codigo : e instanceof z.ZodError ? "PAYLOAD_INVALIDO" : "CONSULTORIO_INDISPONIVEL" } };
  }
}
