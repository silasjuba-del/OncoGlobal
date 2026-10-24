import {confirmacaoCancelada,cancelarConfirmacao} from "../kernel/comandos/portas.js";
import { z } from "zod";
import type { DatabaseSync } from "node:sqlite";
import { Sessao, type Fonte } from "../contracts/base.js";
import { Paciente, TumorLot } from "../contracts/clinico.js";
import { Apac } from "../contracts/operacao.js";
import { ContextoAcaoComposta } from "../contracts/api/acoesCompostas.js";
import { BaseApacRascunhoRespostaSchema, PrepararApacRascunhoPedidoSchema,
  ApacRascunhoPreparadoSchema, ConfirmarApacRascunhoPedidoSchema,
  type EdicaoApacRascunho, type ApacRascunhoPreparado } from "../contracts/api/apacRascunho.js";
import { executarConfirmacao } from "../kernel/comandos/index.js";
import { depoisDoCommit, lerDraft, listarEventos, salvarDraft, transacao, hashPayload, resultadoExistente } from "../kernel/comandos/portas.js";
import { lerLedgerIntegro } from "../kernel/ledger/leituraIntegra.js";
import { dadosDoEvento, eventosVigentes } from "../kernel/projections/snapshot.js";
import { projetarRetrato, hashCanonico } from "../kernel/projections/retrato/index.js";
import type { SettingsService } from "../kernel/config/settings.js";
import { apacGerar, validarEmissaoApac } from "../rules/apac.js";
import { dataCivilDoServico } from "../rules/tempoServico.js";
import { antiglosa, CAMPOS_OBRIGATORIOS_PADRAO } from "../modules/apac/antiglosa.js";
import { lerCampo } from "../modules/apac/campos.js";
import { projetarBasePrescricaoExecutavel } from "./prescricaoExecutavel.js";
import { lerApacsVigentes, type FalhaFonteApac } from "./apacsVigentes.js";
import { hashConteudoExibido as hash, type GerenciadorSessao } from "./sessao.js";
import type { carregarCorpusServidor } from "./corpus.js";

interface Deps {
  db: DatabaseSync; sessoes: GerenciadorSessao; agora: () => string;
  settings?: SettingsService | null; corpus?: ReturnType<typeof carregarCorpusServidor> | null;
}
type Contexto = ContextoAcaoComposta;
type Resposta = { status: number; body: unknown };
const negar = (codigo: string, status = 409): Resposta => ({ status, body: { codigo } });
const nullable = (s: string | null | undefined) => s?.trim() || null;
const seguro = (d: TumorLot["cid"]) => d.campo === "PRESENTE" && d.estado === "VERDE"
  && ["CONFIRMADO", "ASSINADO"].includes(d.revisao) && d.fontes.length > 0;
const textoDado = (d: TumorLot["cid"]) => seguro(d) ? nullable(d.valor) : null;
const rotulos: Record<string, string> = { pacienteNome: "Paciente", pacienteCns: "CNS do paciente",
  pacienteNascimento: "Nascimento", pacienteSexo: "Sexo cadastral", nomeMae: "Nome da mãe",
  procedimentoPrincipal: "Procedimento principal", quantidadePrincipal: "Quantidade",
  justificativa: "Justificativa médica", descricaoDiagnostico: "Descrição do diagnóstico",
  nomeEstabelecimento: "Estabelecimento", cnesSolicitante: "CNES", solicitanteNome: "Médico solicitante",
  solicitanteCns: "CNS do solicitante", cidPrincipal: "CID principal", localizacaoTumorPrimario: "Topografia",
  diagnosticoCitoHistopatologico: "Diagnóstico cito/histopatológico", qtEsquema: "Esquema prescrito",
  dataSolicitacao: "Data da solicitação", finalidadeApac: "Finalidade APAC", estadioUicc: "Estádio UICC",
  estadioOutroSistema: "Estádio em outro sistema" };
const Registro = z.object({
  kind: z.literal("APAC_PREPARACAO_RASCUNHO"), contexto: ContextoAcaoComposta,
  atorId: z.string(), requestHash: z.string(), edicao: PrepararApacRascunhoPedidoSchema.shape.edicao,
  resposta: ApacRascunhoPreparadoSchema, anteriorEventId: z.string().nullable(),
}).strict();
type Registro = z.infer<typeof Registro>;
function hashRegistro(r: Registro): string {
  const { conteudoHash: _hash, ...resposta } = r.resposta;
  return hash({ ...r, resposta });
}

/** Administrative source view. Treatment administration does not erase its signed prescription. */
function baseApac(deps: Deps, contexto: Contexto, sessao: Sessao, em: string) {
  const civil = dataCivilDoServico(em);
  if (civil.estado !== "OK") throw new Error("RELOGIO_INVALIDO");
  const leitura = lerLedgerIntegro(deps.db, contexto.patientId);
  // O tipo SQL também pode estar corrompido: não prova que uma linha inválida é irrelevante.
  // A leitura já está restrita ao paciente; falhas de outras pessoas não entram neste bloqueio.
  const falhasFonte = leitura.pendenciasIntegridade;
  const eventos = leitura.itens.filter(e =>
    ["CONFIRMADO", "ASSINADO"].includes(e.revisao) && Date.parse(e.criadoEm) <= Date.parse(em));
  const atuais = eventosVigentes(eventos);
  const rx = projetarBasePrescricaoExecutavel(eventos, contexto, em);
  const retrato = projetarRetrato(eventos, { ...contexto, agora: em, regras: [],
    biblioteca: { id: "apac-fontes", versao: "1", hash: hashCanonico([]) } });
  const lotes = retrato.fatos.filter(f => ["TumorLot", "TumorLot@1"].includes(f.tipo))
    .flatMap(f => { const p = TumorLot.safeParse(f.dados); return p.success && p.data.patientId === contexto.patientId
      && p.data.tumorLotId === contexto.tumorLotId && !retrato.integridade.some(i => i.eventoId === f.ref.eventId)
      ? [p.data] : []; });
  const pacientes = atuais.filter(e => ["Paciente", "Paciente@1"].includes(e.tipo)).flatMap(e => {
    const p = Paciente.safeParse(dadosDoEvento(e)); return p.success && p.data.patientId === contexto.patientId ? [p.data] : [];
  });
  const lote = lotes.length === 1 ? lotes[0]! : null, paciente = pacientes.length === 1 ? pacientes[0]! : null;
  const bloqueios = rx.pendencias.filter(p => p !== "CICLO_COM_ADMINISTRACAO_REGISTRADA");
  if (falhasFonte.length) bloqueios.push("INTEGRIDADE_FONTE_APAC_PENDENTE");
  if (!lote) bloqueios.push("LOTE_CLINICO_AUSENTE_OU_AMBIGUO");
  if (!paciente || paciente.divergencia) bloqueios.push("IDENTIDADE_PACIENTE_PENDENTE");
  if (!rx.vigente) bloqueios.push("PRESCRICAO_ESTRUTURADA_ASSINADA_AUSENTE");
  const perfil = deps.settings?.readProfile(sessao).perfil;
  const config = { nome: perfil?.medico.nome ?? null, cns: perfil?.medico.cns ?? null,
    hospital: perfil?.instituicao.hospital ?? null, cnes: perfil?.instituicao.cnes ?? null };
  const cns = [...new Set(paciente?.identificadores.filter(i => i.tipo === "CNS").map(i => i.valor) ?? [])];
  const sugestao: EdicaoApacRascunho = { competencia: civil.dataCivil.slice(0, 7), campos: {
    procedimentoPrincipal: null, quantidadePrincipal: null, justificativa: null,
    descricaoDiagnostico: lote ? textoDado(lote.histologia) : null,
    pacienteCns: cns.length === 1 ? cns[0]! : null, pacienteNascimento: paciente?.nascimento ?? null,
    pacienteSexo: paciente?.sexoCadastral === "M" || paciente?.sexoCadastral === "F" ? paciente.sexoCadastral : null,
    nomeMae: null, nomeEstabelecimento: config.hospital, cnesSolicitante: config.cnes,
    solicitanteNome: config.nome, solicitanteCns: config.cns,
  } };
  const falhasApac: FalhaFonteApac[] = [];
  const apacs = lerApacsVigentes(deps.db, em, eventos, f=>falhasApac.push(f)).flatMap(({ eventId, ...apac }) => {
    const evento = eventos.find(e => e.eventId === eventId);
    return evento && evento.tumorLotId === contexto.tumorLotId ? [{ evento, apac }] : [];
  });
  if(falhasApac.some(f=>f.tumorLotId===contexto.tumorLotId))bloqueios.push("INTEGRIDADE_FONTE_APAC_PENDENTE");
  const camposClinicos = [
    { chave: "pacienteNome", rotulo: "Paciente", valor: paciente?.nome ?? null },
    { chave: "cidPrincipal", rotulo: "CID documentado", valor: lote ? textoDado(lote.cid) : null },
    { chave: "localizacaoTumorPrimario", rotulo: "Topografia documentada", valor: lote ? textoDado(lote.topografia) : null },
    { chave: "diagnosticoCitoHistopatologico", rotulo: "Histologia documentada", valor: lote ? textoDado(lote.histologia) : null },
    { chave: "finalidadeApac", rotulo: "Finalidade APAC confirmada", valor: lote ? textoDado(lote.finalidadeApac) : null },
    { chave: "qtEsquema", rotulo: "Esquema da prescrição assinada", valor: rx.vigente?.protocoloId ?? null },
  ];
  const revisao = hash({ eventos: eventos.map(e => ({ eventId: e.eventId, payload: e.payload, fontes: e.fontes,
    revisao: e.revisao, supersedesEventId: e.supersedesEventId })), retrato: retrato.revisao, config,
    apacs: apacs.map(a => a.apac), falhasFonte, falhasApac,
    sigtap: deps.corpus?.sigtap ?? null, caixas: deps.corpus?.caixasTodas ?? null });
  const publica = BaseApacRascunhoRespostaSchema.parse({ contexto, revisao,
    prescricao: bloqueios.length || !rx.vigente ? null : { documentId: rx.vigente.documentId,
      documentVersion: rx.vigente.documentVersion, protocoloId: rx.vigente.protocoloId, dataPrevista: rx.vigente.dataPrevista },
    sugestao, camposClinicos, existentes: apacs.map(({ apac }) => ({ apacId: apac.apacId, versao: apac.versao,
      competencia: apac.competencia, estado: apac.estado })), pendencias: [...new Set(bloqueios)] });
  return { publica, rx, lote, paciente, apacs, hoje: civil.dataCivil, config,
    limiteClinico: retrato.dataClinicaEncontro ?? civil.dataCivil };
}
type Base = ReturnType<typeof baseApac>;

function montarApac(deps: Deps, base: Base, edicao: EdicaoApacRascunho, draftId: string) {
  if (!base.publica.prescricao || !base.lote || !base.paciente || !base.rx.vigente) throw new Error("BASE_APAC_PENDENTE");
  const anteriores = base.apacs.filter(a => a.apac.competencia === edicao.competencia
    && a.apac.prescricaoAssinadaRef.documentId === base.rx.vigente!.documentId
    && a.evento.encounterId === base.publica.contexto.encounterId);
  if (anteriores.length > 1) throw new Error("APAC_VIGENTE_AMBIGUA");
  const anterior = anteriores[0];
  if (anterior && (anterior.apac.estado !== "RASCUNHO" || anterior.apac.resultadoExterno !== null))
    throw new Error("APAC_RESULTADO_EXTERNO_PRESERVADO");
  const lote = structuredClone(base.lote);
  if (!seguro(lote.finalidadeApac)) lote.finalidadeApac = { valor: null, campo: "NAO_INFORMADO",
    estado: "PENDENTE", revisao: "REVISAR", fontes: [], motivo: "Finalidade APAC depende de escolha humana confirmada." };
  const campos: Record<string, unknown> = { ...edicao.campos, pacienteNome: base.paciente.nome,
    cidPrincipal: seguro(lote.cid) ? lote.cid : null,
    localizacaoTumorPrimario: seguro(lote.topografia) ? lote.topografia : null,
    diagnosticoCitoHistopatologico: seguro(lote.histologia) ? lote.histologia : null,
    qtEsquema: base.rx.vigente.protocoloId, dataSolicitacao: base.hoje };
  const estadios = lote.estadiamentos.filter(e => e.usoAtivo.includes("APAC") && e.data <= base.limiteClinico);
  if (estadios.length === 1 && estadios[0]!.grupo) {
    const e = estadios[0]!;
    campos[e.sistema === "UICC" ? "estadioUicc" : "estadioOutroSistema"] = {
      campo: "PRESENTE", revisao: "CONFIRMADO", fontes: e.fontes,
      valor: e.sistema === "UICC" ? e.grupo : `${e.sistema} ${e.edicao} · ${e.prefixo}: ${e.grupo}`,
    };
  }
  const apac = apacGerar({ apacId: anterior?.apac.apacId ?? `apac:${hash(draftId)}`,
    documentId: base.rx.vigente.documentId, documentVersion: base.rx.vigente.documentVersion,
    revisao: "ASSINADO", competencia: edicao.competencia, campos }, lote, base.hoje);
  if (anterior) { apac.versao = anterior.apac.versao + 1; apac.dataGeracaoApp = anterior.apac.dataGeracaoApp; }
  const validacao = validarEmissaoApac(apac, CAMPOS_OBRIGATORIOS_PADRAO);
  const pendencias = validacao.camposFaltantes.map(c => `Campo pendente: ${rotulos[c] ?? c}.`);
  const avisos = ["Salvar mantém a APAC em rascunho. Emissão, exportação e autorização são operações separadas."];
  if (estadios.length !== 1 || !estadios[0]?.grupo)
    pendencias.push("Estadiamento para APAC ausente ou com seleção ambígua; conferir as fontes do lote.");
  if (!deps.corpus) pendencias.push("Corpus administrativo/SIGTAP indisponível; validação de exportação pendente.");
  else {
    const v = antiglosa(apac, { hoje: base.hoje, sigtap: deps.corpus.sigtap, caixas: deps.corpus.caixasTodas,
      cnesConfigurado: base.config.cnes ?? "", esquemaVigente: base.rx.vigente.protocoloId,
      apacsDoLote: base.apacs.map(a => a.apac).filter(a => a.apacId !== apac.apacId) });
    for (const achado of v.achados)
      (achado.severidade === "BLOQUEIA_EXPORTACAO" ? pendencias : avisos).push(achado.motivo);
  }
  const linhas = Object.keys(apac.campos).map(chave => {
    const campo = lerCampo(apac.campos, chave);
    return `${rotulos[chave] ?? chave}: ${campo.estado === "PRESENTE" ? String(campo.valor) : "PENDENTE"}`;
  });
  const texto = [`APAC EM RASCUNHO · versão ${apac.versao}`, `Paciente: ${base.paciente.nome}`,
    `Competência: ${apac.competencia}`, `Prescrição: versão ${apac.prescricaoAssinadaRef.documentVersion} · ${base.rx.vigente.protocoloId}`,
    ...linhas, "", "PENDÊNCIAS", ...pendencias, "", ...avisos].join("\n");
  return { apac: Apac.parse(apac), pendencias: [...new Set(pendencias)], avisos: [...new Set(avisos)], texto,
    anteriorEventId: anterior?.evento.eventId ?? null };
}

function preparar(deps: Deps, token: string, raw: unknown, contexto: Contexto, sessao: Sessao, em: string): Resposta {
  const p = PrepararApacRascunhoPedidoSchema.safeParse(raw);
  if (!p.success) return negar("PAYLOAD_INVALIDO", 400);
  const base = baseApac(deps, contexto, sessao, em);
  if (base.publica.revisao !== p.data.expectedBaseHash) return negar("BASE_APAC_ALTERADA");
  const draftId = `apac-preparar:${hash([contexto, p.data.idempotencyKey])}`;
  const requestHash = hash({ entrada: p.data, atorId: sessao.medicoId });
  const montagem = montarApac(deps, base, p.data.edicao, draftId);
  const resposta: ApacRascunhoPreparado = ApacRascunhoPreparadoSchema.parse({ contexto, draftId, revision: 0,
    conteudoHash: "0".repeat(64), baseHash: base.publica.revisao, apac: montagem.apac, texto: montagem.texto,
    pendencias: montagem.pendencias, avisos: montagem.avisos, permiteExportar: false });
  const registro: Registro = { kind: "APAC_PREPARACAO_RASCUNHO", contexto, atorId: sessao.medicoId,
    requestHash, edicao: p.data.edicao, resposta, anteriorEventId: montagem.anteriorEventId };
  resposta.conteudoHash = hashRegistro(registro);
  const existente = lerDraft(deps.db, draftId);
  if (existente) {
    const salvo = Registro.safeParse(existente.payload);
    if (!salvo.success || existente.patientId !== contexto.patientId || existente.revision !== resposta.revision
      || hash(salvo.data) !== hash(registro)) return negar("IDEMPOTENCIA_CONFLITO");
  } else salvarDraft(deps.db, { draftId, patientId: contexto.patientId, sourceId: `apac-fonte:${base.publica.revisao}`,
    rawRef: "referencia-local", payload: registro, revision: 0, diagnostics: resposta.pendencias, criadoEm: em });
  depoisDoCommit(deps.db, () => deps.sessoes.registrarBundleExibido(token, contexto, [{ documentId: resposta.apac.apacId,
    documentVersion: resposta.apac.versao, conteudoHash: resposta.conteudoHash, draftId }]));
  return { status: 200, body: resposta };
}

function confirmar(deps: Deps, token: string, raw: unknown, contexto: Contexto, sessao: Sessao, em: string): Resposta {
  const p = ConfirmarApacRascunhoPedidoSchema.safeParse(raw);
  if (!p.success) return negar("PAYLOAD_INVALIDO", 400);
  const operationId = `apac-confirmar:${p.data.idempotencyKey}`, requestHash = hash({ entrada: p.data, atorId: sessao.medicoId });
  if(confirmacaoCancelada(deps.db,operationId))return negar("INTENCAO_CANCELADA");
  const anteriores = listarEventos(deps.db, contexto.patientId).filter(e => e.operationId === operationId);
  const retorno = (codigo: "GRAVADA" | "REPLAY", eventId: string, apac: Apac): Resposta => ({ status: 200, body: {
    codigo, apacId: apac.apacId, versao: apac.versao, eventId, estado: "RASCUNHO", permiteExportar: false } });
  if (anteriores.length) {
    const e = anteriores[0]!, a = Apac.safeParse(dadosDoEvento(e));
    if (anteriores.length !== 1 || e.tipo !== "APAC" || e.revisao !== "CONFIRMADO"
      || e.criadoPor.tipo !== "SESSAO" || Date.parse(e.criadoEm) > Date.parse(em) || e.criadoPor.id !== sessao.medicoId
      || e.encounterId !== contexto.encounterId || e.tumorLotId !== contexto.tumorLotId || e.fontes[0]?.contentHash !== requestHash
      || !a.success || a.data.tumorLotId !== contexto.tumorLotId || a.data.estado !== "RASCUNHO" || a.data.resultadoExterno !== null) return negar("IDEMPOTENCIA_CONFLITO");
    const recibo = resultadoExistente(deps.db,{operationId,payloadHash:hashPayload(anteriores),resultRef:e.eventId,criadoEm:em});
    if(recibo?.estado!=="REPLAY" || recibo.resultRef!==e.eventId)return negar("IDEMPOTENCIA_CONFLITO");
    return retorno("REPLAY", e.eventId, a.data);
  }
  const draft = lerDraft(deps.db, p.data.draftId), registro = Registro.safeParse(draft?.payload);
  if (!draft || !registro.success || draft.patientId !== contexto.patientId
    || hash(registro.data.contexto) !== hash(contexto) || registro.data.atorId !== sessao.medicoId)
    return negar("PREPARACAO_APAC_NAO_ENCONTRADA");
  const r = registro.data, resposta = r.resposta;
  if (draft.revision !== p.data.expectedRevision || resposta.revision !== p.data.expectedRevision
    || resposta.draftId !== draft.draftId || resposta.conteudoHash !== p.data.conteudoHash
    || hashRegistro(r) !== resposta.conteudoHash) return negar("CONTEUDO_APAC_ALTERADO");
  if (!deps.sessoes.bundleExibido(token, contexto)?.some(e => e.draftId === draft.draftId
    && e.documentId === resposta.apac.apacId && e.documentVersion === resposta.apac.versao
    && e.conteudoHash === resposta.conteudoHash)) return negar("APAC_NAO_EXIBIDA_NESTA_SESSAO");
  const base = baseApac(deps, contexto, sessao, em);
  if (base.publica.revisao !== resposta.baseHash) return negar("BASE_APAC_ALTERADA");
  const atual = montarApac(deps, base, r.edicao, draft.draftId);
  if (hash(atual) !== hash({ apac: resposta.apac, texto: resposta.texto, pendencias: resposta.pendencias,
    avisos: resposta.avisos, anteriorEventId: r.anteriorEventId })) return negar("PREVIA_APAC_DESATUALIZADA");
  const key = hash(operationId), revisaoId = `apac-revisao:${key}`, eventId = `apac-evento:${key}`;
  // Only this authenticated, displayed confirmation creates the canonical draft.
  // The preparation artifact itself remains non-promotable by the generic writer.
  const canonicoId = `apac-confirmada:${key}`;
  if (lerDraft(deps.db, canonicoId)) return negar("DRAFT_APAC_CONFLITANTE");
  salvarDraft(deps.db, { draftId: canonicoId, patientId: contexto.patientId, sourceId: draft.sourceId,
    rawRef: "referencia-local", payload: { kind: "APAC_CONFIRMACAO_CANONICA", contexto,
      origem: draft.draftId, conteudoHash: resposta.conteudoHash, apac: resposta.apac },
    revision: 0, diagnostics: [], criadoEm: em });
  const fonte: Fonte = { sourceId: draft.sourceId, classe: "MANUAL", localizador: null, dataClinica: base.hoje,
    dataCaptura: em, versao: String(resposta.apac.versao), contentHash: requestHash };
  const gravacao = executarConfirmacao(deps.db, { autorizadoEm: deps.agora(), operationId, ...contexto, reviewDecisionId: revisaoId,
    sessao, em, registros: [{ draftId: canonicoId, expectedRevision: 0, eventId, tipo: "APAC",
      payload: resposta.apac, fontes: [fonte], revisao: "CONFIRMADO", supersedesEventId: r.anteriorEventId }] });
  if (gravacao.estado === "NEGADA") throw new Error("APAC_TRANSACAO_NEGADA");
  return retorno(gravacao.estado, eventId, resposta.apac);
}

function recuperar(deps:Deps,token:string,raw:unknown,ctx:Contexto,sessao:Sessao,em:string,cancelar=false):Resposta {
 const p=ConfirmarApacRascunhoPedidoSchema.safeParse(raw);if(!p.success)return negar("PAYLOAD_INVALIDO",400);
 if(listarEventos(deps.db,ctx.patientId).some(e=>e.operationId===`apac-confirmar:${p.data.idempotencyKey}`)) {
   const r=confirmar(deps,token,raw,ctx,sessao,em);return r.status===200?{status:200,body:{estado:"CONFIRMADA",resultado:r.body}}:r;
 }
 if(confirmacaoCancelada(deps.db,`apac-confirmar:${p.data.idempotencyKey}`))return {status:200,body:{estado:"CANCELADA"}};
 const d=lerDraft(deps.db,p.data.draftId),v=Registro.safeParse(d?.payload);
 if(!d||!v.success||d.patientId!==ctx.patientId||hash(v.data.contexto)!==hash(ctx)||v.data.atorId!==sessao.medicoId
   ||d.revision!==p.data.expectedRevision||v.data.resposta.revision!==p.data.expectedRevision
   ||v.data.resposta.conteudoHash!==p.data.conteudoHash||hashRegistro(v.data)!==p.data.conteudoHash)return negar("PREPARACAO_APAC_NAO_ENCONTRADA");
 if(cancelar){cancelarConfirmacao(deps.db,`apac-confirmar:${p.data.idempotencyKey}`,sessao.medicoId,em);return {status:200,body:{estado:"CANCELADA"}};}
 const r=v.data.resposta;
 depoisDoCommit(deps.db, () => deps.sessoes.registrarBundleExibido(token,ctx,[{documentId:r.apac.apacId,documentVersion:r.apac.versao,conteudoHash:r.conteudoHash,draftId:d.draftId}]));
 return {status:200,body:{estado:"PREVIA",texto:r.texto,avisos:[...r.avisos,...r.pendencias]}};
}

export function operarApacRascunho(deps: Deps, token: string, operacao: "base" | "preparar" | "confirmar" | "recuperar" | "cancelar", raw: unknown): Resposta {
  const em = deps.agora(), sessao = Sessao.safeParse(deps.sessoes.obter(token));
  if (!sessao.success || !Number.isFinite(Date.parse(em)) || Date.parse(sessao.data.emitidaEm) > Date.parse(em)
    || Date.parse(sessao.data.expiraEm) <= Date.parse(em)) return negar("SESSAO_INVALIDA", 401);
  const c = ContextoAcaoComposta.safeParse(operacao === "base" ? raw :
    raw && typeof raw === "object" && "contexto" in raw ? raw.contexto : null);
  if (!c.success) return negar("PAYLOAD_INVALIDO", 400);
  const selecionado = deps.sessoes.consultaSelecionada(token);
  if (!selecionado || selecionado.patientId !== c.data.patientId || selecionado.encounterId !== c.data.encounterId
    || (selecionado.tumorLotId ?? null) !== c.data.tumorLotId) return negar("CONTEXTO_CONSULTA_ALTERADO");
  try {
    return transacao(deps.db, () => operacao === "base" ? { status: 200, body: baseApac(deps, c.data, sessao.data, em).publica }
      : operacao === "preparar" ? preparar(deps, token, raw, c.data, sessao.data, em)
      : (operacao === "recuperar" || operacao === "cancelar") ? recuperar(deps,token,raw,c.data,sessao.data,em,operacao === "cancelar")
      : confirmar(deps, token, raw, c.data, sessao.data, em));
  } catch (error) {
    const codigo = error instanceof Error ? error.message : "";
    return negar(["BASE_APAC_PENDENTE", "APAC_VIGENTE_AMBIGUA", "APAC_RESULTADO_EXTERNO_PRESERVADO"].includes(codigo)
      ? codigo : "APAC_TRANSACAO_NAO_CONFIRMADA");
  }
}
