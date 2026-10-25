import { PedidoRecuperacaoConfirmacao } from "../contracts/api/recuperacaoConfirmacao.js";
import { ErroProveniencia } from "../kernel/comandos/proveniencia.js";
import { registrarSalaoExibido } from './exibicaoSalao.js';
import {registrarFontesDutoExibidas} from './exibicaoDutos.js';
import { operarAtendimentoV6 } from "./atendimentoV6.js";
import { criarResolverDocumentoLedger, listarDrafts, listarEventos } from "../kernel/comandos/portas.js";
import { dadosDoEvento } from "../kernel/projections/snapshot.js";
import { opcoesLeituraConsulta, ExibirBundle, contextoDraft, payloadDocumento, exibirBundle, confirmarBloco } from "./rotas/confirmacao.js";
export { g08AnatomiaSexo, g09PtDeBiopsia, g25EscopoAssinatura } from "../kernel/harness/gates.js";
import { rotaHttp } from "./rotas/catalogo.js";
import { servirUiLocal } from "./rotas/uiLocal.js";
import { rotearSalaoECanal } from "./rotas/salaoCanal.js";
import { rotearConfiguracao } from "./rotas/configuracao.js";
import { rotearPrescricaoFlashConfig } from "./rotas/prescricaoFlash.js";
import { rotearCognitivo } from "./rotas/cognitivo.js";
import { rotearExtracaoERevisao } from "./rotas/extracaoRevisao.js";
import { rascunhoNaoPromovivel } from "../contracts/rascunhos.js";
import { nomeMedicamento } from "./propostasDoseReceita.js";
import { operarAcoesCompostas } from "./acoesCompostas.js";
import { operarPrescricaoExecutavel } from "./prescricaoExecutavel.js";
import { operarApacRascunho } from "./apacRascunho.js";
import { operarTrials } from "./trialsServico.js";
import { operarFichasPrescricao } from "./fichasPrescricao.js";
import { instanciarFichaPrescricao } from "./origemFichaPrescricao.js";
import { lerTimelineMulticamadas } from "./timelineMulticamadas.js";
import { ContextoAcaoComposta } from "../contracts/api/acoesCompostas.js";
import { operarContingenciaSalao } from "./salaoContingencia.js";
import { rotearWebhookCanal } from "./canalWebhookHttp.js";
import {
  type OperacaoCanal,
  revisaoContextoCanal,
  lerMensagensOperacionaisCanal,
  lerRelatosConsultaCanal,
  vinculoAtualCanal,
  cadastrosCanal,
  contatoRevogadoCanal,
} from "./canalOperacao.js";
import { processarPendenciasClinicasCanal } from "./canalReconciliacao.js";
import { detalheMensagemCanal } from "./canalEntrada.js";
import { prepararRascunhoRespostaCanal, confirmarRespostaCanalPeloMedico,
  executarEnvioAutorizadoCanal, revalidarAutorizacaoSaidaCanalNoLedger } from "./canalResposta.js";
import { PrepararRespostaCanal, ConfirmarRespostaCanal } from "../contracts/api/respostaCanal.js";
import { LotesPacientePedido, LotesPacienteResposta } from "../contracts/api/lotes.js";
import { respostaHttpValida } from "../contracts/api/saidasHttp.js";
import { projetarDutos } from "./projecaoDutos.js";
import { rotearBiblioteca } from "./biblioteca.js";
import { rotearDutos, referenciaSigtapDuto } from "./dutos.js";
import { reconciliarMedicamentos } from "./medicamentos.js";
import { obterInvestigacao, type DepsInvestigacao } from "./investigacao.js";
import { obterRevisaoClinica } from "./revisaoClinica.js";
import { rotearEstadoDoenca } from "./estadoDoenca.js";
import type { CatalogoTumorPacks } from "../kernel/corpus/tumorPacks.js";
import { executarSinteseRetratoLlm, executarDocumentoOriginalLlm, executarExtracaoLlm } from "./extracaoLlm.js";
import type { criarRuntimeExtracaoLlm } from "../kernel/llm/openai/runtime.js";
import { processarUploadLocal } from "./upload.js";
import { ConsultaCarregar } from "../contracts/f1/consultaCarregar.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { DataCivil, Id } from "../contracts/base.js";
import { ActionIntent, ConfirmarBloco } from "../contracts/operacao.js";
import { sqliteIdempotencia } from "../kernel/ledger/idempotencia.js";
import type { criarGateway, ReadTransport } from "../kernel/gateway/gateway.js";
import { autorizarSaida } from "./autorizacao.js";
import type { GerenciadorSessao } from "./sessao.js";
import { lerAgenda, lerApacs, lerCanal, lerConsulta, lerLotes, lerMensagensChat, lerPaciente, lerRecist, lerSalao, lerTriagens } from "./leituras.js";
import type { SettingsService } from "../kernel/config/settings.js";
import type { carregarCorpusServidor } from "./corpus.js";
import { dataCivilDoServico } from "../kernel/gateway/tempo.js";
import { projetarEstatisticaLedger } from "../kernel/projections/estatistica.js";
import { consultarGrafoLocal } from "../kernel/corpus/conhecimento.js";
import { criarOncoassistJev } from "../kernel/llm/jev/oncoassist.js";
import { operarOncoassistPropostas } from "./oncoassistPropostas.js";
import { AvaliacaoInstrumentoRequest, avaliarInstrumentoEstruturado } from "./f0c/instrumentosClinicos.js";
import type { criarMotorF1 } from "../kernel/orquestracao/runtime.js";
import type { criarDitado } from "../kernel/gateway/ditado.js";

export interface ServidorDeps {
  canal?: OperacaoCanal;
  ditado?: ReturnType<typeof criarDitado>;
  db: DatabaseSync;
  sessoes: GerenciadorSessao;
  gateway: ReturnType<typeof criarGateway>;
  salaoRuleset?: unknown;
  settings?: SettingsService | null;
  configRootDir?: string;
  corpus?: ReturnType<typeof carregarCorpusServidor> | null;
  oncoassistJev?: ReturnType<typeof criarOncoassistJev>;
  motorF1?: ReturnType<typeof criarMotorF1>;
  catalogoTumorPacks?: CatalogoTumorPacks;
  extracaoLlm?: ReturnType<typeof criarRuntimeExtracaoLlm>;
  transportePubMed?: ReadTransport;
  packInvestigacao?: NonNullable<DepsInvestigacao["packInvestigacao"]>;
  agora: () => string;
  log: (entry: { rota: string; codigo: string; status: number }) => void;
}

class JsonInvalido extends Error {}

function contentTypeJson(req: IncomingMessage): boolean {
  const header = req.headers["content-type"];
  return typeof header === "string"
    && /^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?$/i.test(header.trim());
}

function send(res: ServerResponse, status: number, object: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(object));
}

async function body(req: IncomingMessage, limite = 1_000_000): Promise<unknown> {
  let value = "", bytes = 0;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    for await (const chunk of req) {
      const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      bytes += buffer.length;
      if (bytes > limite) throw new Error("BODY_TOO_LARGE");
      value += decoder.decode(buffer, { stream: true });
    }
    value += decoder.decode();
    return JSON.parse(value);
  } catch (error) {
    // Só a falha do corpo HTTP é 400; JSON interno do ledger continua erro interno.
    if (error instanceof SyntaxError || (error instanceof TypeError
      && "code" in error && error.code === "ERR_ENCODING_INVALID_ENCODED_DATA")) throw new JsonInvalido();
    throw error;
  }
}

export async function rotear(deps: ServidorDeps, req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (await rotearWebhookCanal(deps, req, res)) return;
  if (servirUiLocal(deps, req, res)) return;
  const rota = rotaHttp(req.url)?.nome ?? "desconhecida";
  const reply = (status: number, codigo: string, result: unknown = { codigo }) => {
    const valida = respostaHttpValida(rota, status, result);
    if (!valida) {
      deps.log({ rota, codigo: "RESPOSTA_FORA_CONTRATO", status: 500 });
      return send(res, 500, { codigo: "RESPOSTA_FORA_CONTRATO" });
    }
    deps.log({ rota, codigo, status });
    send(res, status, result);
  };
  if (req.method !== "POST" || rota === "desconhecida") return reply(404, "ROTA_NAO_ENCONTRADA");
  try {
    // Relógio indisponível impede autenticação/efeitos, mas não é credencial incorreta.
    const tempoServico=dataCivilDoServico(deps.agora(),"-03:00");
    if(tempoServico.estado!=="OK")return reply(503,tempoServico.codigo,
      rota==="agenda"||rota==="apac"?{hoje:null,itens:[],estado:"PENDENTE",codigo:tempoServico.codigo}:{codigo:tempoServico.codigo});
    if (rota === "login") {
      const parsed = z.object({ senha: z.string() }).strict().safeParse(await body(req));
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      if (deps.sessoes.bloqueadoPorTentativas?.()) return reply(429, "LOGIN_BLOQUEADO_TEMPORARIAMENTE");
      const login = deps.sessoes.login(parsed.data.senha);
      return login
        ? reply(200, "LOGIN_OK", { token: login.token, expiraEm: login.sessao.expiraEm })
        : reply(401, "LOGIN_NEGADO");
    }
    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
    const sessao = deps.sessoes.obter(token);
    if (!sessao) return reply(401, "SESSAO_INVALIDA");
    if(rota==="recuperarAtendimentoV6"||rota==="prepararAtendimentoV6"){
      const r=operarAtendimentoV6(deps,token,rota==="recuperarAtendimentoV6"?"recuperar":"preparar",await body(req));
      return reply(r.status,r.body.codigo,r.body);
    }
    // A rota de efeito externo não aceita JSON sob um tipo de mídia diferente.
    // O gate de autenticação continua anterior a esta checagem.
    if (rota === "acao" && !contentTypeJson(req)) return reply(415, "CONTENT_TYPE_INVALIDO");
    // Conteúdo da biblioteca continua limitado a 8 MB após decodificação; envelope cobre escapes JSON/base64.
    const raw = await body(req, rota === "upload" ? 11_300_000 : rota === "/biblioteca/importar" ? 24_000_000 : 1_000_000);
    if (rota === "recuperarConfirmacao") {
      const p = PedidoRecuperacaoConfirmacao.safeParse(raw); if (!p.success) return reply(400, "PAYLOAD_INVALIDO");
      const r = p.data.tipo === "PRESCRICAO" ? operarPrescricaoExecutavel(deps, token, p.data.cancelar ? "cancelar" : "recuperar", p.data.pedido) : operarApacRascunho(deps, token, p.data.cancelar ? "cancelar" : "recuperar", p.data.pedido);
      return reply(r.status, "RECUPERACAO_CONFIRMACAO", r.body);
    }
    if (rota === "documentoImpressao") {
      const p = ContextoAcaoComposta.extend({ documentId: Id, documentVersion: z.number().int().positive() }).strict().safeParse(raw);
      if (!p.success) return reply(400, "PAYLOAD_INVALIDO");
      const c = deps.sessoes.consultaSelecionada(token), v = p.data;
      if (!c || c.patientId !== v.patientId || c.encounterId !== v.encounterId || (c.tumorLotId ?? null) !== v.tumorLotId) return reply(409, "CONTEXTO_CONSULTA_ALTERADO");
      const docs = listarEventos(deps.db, v.patientId).filter(e => e.tipo === "DOCUMENTO" && e.revisao === "ASSINADO"
        && e.encounterId === v.encounterId && e.tumorLotId === v.tumorLotId);
      if (!docs.some(e => { const d = dadosDoEvento(e)?.data as Record<string, unknown> | undefined; return d?.documentId === v.documentId && d.documentVersion === v.documentVersion; })) return reply(409, "DOCUMENTO_FORA_CONTEXTO");
      const intent = { verbo: "IMPRIMIR" as const, objeto: { tipo: "DOCUMENTO" as const, id: v.documentId, versao: v.documentVersion }, escopo: { patientId: v.patientId, encounterId: v.encounterId }, destino: null, idempotencyKey: "leitura-impressao" };
      const autorizacao = autorizarSaida(deps.db, intent);
      if (!autorizacao.ok) return reply(409, autorizacao.codigo);
      const doc = await criarResolverDocumentoLedger(deps.db).resolver({ id: v.documentId, version: v.documentVersion });
      const atual = deps.sessoes.consultaSelecionada(token);
      if (!deps.sessoes.obter(token) || !atual || JSON.stringify(atual) !== JSON.stringify(c)) return reply(409, "CONTEXTO_CONSULTA_ALTERADO");
      if (!doc || doc.patientId !== v.patientId) return reply(409, "DOCUMENTO_INDISPONIVEL");
      return reply(200, "DOCUMENTO_IMPRIMIVEL", { html: doc.html });
    }
    if (rota === "timelineMulticamadas") {
      const p = ContextoAcaoComposta.safeParse(raw), c = deps.sessoes.consultaSelecionada(token);
      if (!p.success) return reply(400, "PAYLOAD_INVALIDO");
      if (!c || c.patientId !== p.data.patientId || c.encounterId !== p.data.encounterId
        || (c.tumorLotId ?? null) !== p.data.tumorLotId) return reply(409, "CONTEXTO_CONSULTA_ALTERADO");
      return reply(200, "TIMELINE_CARREGADA", lerTimelineMulticamadas(deps.db, p.data, deps.agora()));
    }
    if (rota === "baseAcaoComposta" || rota === "prepararAcaoComposta") {
      const r = operarAcoesCompostas(deps, token, rota === "baseAcaoComposta" ? "base" : "preparar", raw);
      return reply(r.status, rota, r.body);
    }
    if (rota === "listarFichasPrescricao" || rota === "revisarFichaPrescricao" || rota === "instanciarFichaPrescricao") {
      const r = rota === "instanciarFichaPrescricao" ? instanciarFichaPrescricao(deps, token, raw)
        : operarFichasPrescricao(deps, token, rota === "listarFichasPrescricao" ? "listar" : "revisar", raw);
      return reply(r.status, rota, r.body);
    }
    if (rota === "basePrescricaoExecutavel" || rota === "prepararPrescricaoExecutavel" || rota === "confirmarPrescricaoExecutavel") {
      const r = operarPrescricaoExecutavel(deps, token, rota === "basePrescricaoExecutavel" ? "base"
        : rota === "prepararPrescricaoExecutavel" ? "preparar" : "confirmar", raw);
      const codigo = r.body && typeof r.body === "object" && "codigo" in r.body && typeof r.body.codigo === "string"
        ? r.body.codigo : rota;
      return reply(r.status, codigo, r.body);
    }
    if (rota === "baseApacRascunho" || rota === "prepararApacRascunho" || rota === "confirmarApacRascunho") {
      const r = operarApacRascunho(deps, token, rota === "baseApacRascunho" ? "base"
        : rota === "prepararApacRascunho" ? "preparar" : "confirmar", raw);
      return reply(r.status, rota, r.body);
    }
    if (rota === "listarEstudosTrials" || rota === "importarEstudoTrial" || rota === "revisarEstudoTrial"
      || rota === "avaliarEstudoTrial" || rota === "fatosTrials") {
      const operacao = rota === "listarEstudosTrials" ? "listar" : rota === "importarEstudoTrial" ? "importar"
        : rota === "revisarEstudoTrial" ? "revisar" : rota === "avaliarEstudoTrial" ? "avaliar" : "fatos";
      const r = await operarTrials(deps, token, operacao, raw);
      return reply(r.status, rota, r.body);
    }
    if (rota === "gerarContingenciaSalao" || rota === "historicoContingenciaSalao") {
      const r = operarContingenciaSalao(deps, token, rota, raw);
      return reply(r.status, "codigo" in r.body ? String(r.body.codigo) : "CONTINGENCIA_SALAO", r.body);
    }
    if (rota === "ditado") {
      if (!contentTypeJson(req)) return reply(415, "CONTENT_TYPE_INVALIDO");
      const result = deps.ditado?.rotear(raw, token) ?? { status: 503, body: { codigo: "DITADO_INDISPONIVEL" } };
      return reply(result.status, "DITADO", result.body);
    }
    if (rota === "reconciliarMedicamentos") { const result = reconciliarMedicamentos(raw, token, deps); return reply(result.status, String(result.body.codigo), result.body); }
    if (rota === "sinteseRetratoLlm") { const result = await executarSinteseRetratoLlm(raw, token, deps); return reply(result.status, String(result.body.codigo), result.body); }
    if (rota === "documentoOriginalLlm") { const result = await executarDocumentoOriginalLlm(raw, token, deps); return reply(result.status, String(result.body.codigo), result.body); }
    const estadoDoenca = rotearEstadoDoenca(deps, token, rota, raw);
    if (estadoDoenca) return reply(estadoDoenca.status, String(estadoDoenca.body.codigo), estadoDoenca.body);
    if (rota === "proporDoseReceita") {
      const p = z.object({ patientId: Id, encounterId: Id, tumorLotId: Id.nullable(), medicamento: z.string().trim().min(1).max(300) }).strict().safeParse(raw);
      if (!p.success) return reply(400, "PAYLOAD_INVALIDO");
      const c = deps.sessoes.consultaSelecionada(token);
      if (!c || c.patientId !== p.data.patientId || c.encounterId !== p.data.encounterId || (c.tumorLotId ?? null) !== p.data.tumorLotId)
        return reply(409, "CONTEXTO_CONSULTA_ALTERADO");
      return reply(200, "PROPOSTAS_DOSE", {
        propostas: (deps.corpus?.propostasDoseReceita ?? []).filter(x => nomeMedicamento(x.medicamento) === nomeMedicamento(p.data.medicamento)),
        autorizaTratamento: false,
      });
    }
    if (rota === "revisaoClinica") {
      const p = z.object({ patientId: Id, encounterId: Id, tumorLotId: Id.nullable(), packId: Id.optional() }).strict().safeParse(raw);
      if (!p.success) return reply(400, "PAYLOAD_INVALIDO");
      const ctx = deps.sessoes.consultaSelecionada(token);
      if (!ctx || ctx.patientId !== p.data.patientId || ctx.encounterId !== p.data.encounterId || (ctx.tumorLotId ?? null) !== p.data.tumorLotId)
        return reply(409, "CONTEXTO_CONSULTA_ALTERADO");
      if (!deps.motorF1 || !deps.catalogoTumorPacks) return reply(409, "REVISAO_CLINICA_INDISPONIVEL");
      try {
        const { packId, ...contexto } = p.data;
        const result = await obterRevisaoClinica(
          deps.motorF1, deps.catalogoTumorPacks, contexto, packId,
          () => lerRecist(deps.db, contexto.patientId, { encounterId: contexto.encounterId, tumorLotId: contexto.tumorLotId, agora: deps.agora() }),
        );
        const atual = deps.sessoes.consultaSelecionada(token);
        if (!deps.sessoes.obter(token) || !atual || atual.patientId !== contexto.patientId || atual.encounterId !== contexto.encounterId || (atual.tumorLotId ?? null) !== contexto.tumorLotId)
          return reply(409, "CONTEXTO_CONSULTA_ALTERADO");
        return reply(200, result.codigo, result);
      } catch { return reply(409, "REVISAO_CLINICA_PENDENTE"); }
    }
    if (rota === "investigacao") {
      const p = z.object({ patientId: Id, encounterId: Id, tumorLotId: Id.nullable() }).strict().safeParse(raw);
      if (!p.success) return reply(400, "PAYLOAD_INVALIDO");
      const ctx = deps.sessoes.consultaSelecionada(token);
      if (!ctx || ctx.patientId !== p.data.patientId || ctx.encounterId !== p.data.encounterId || (ctx.tumorLotId ?? null) !== p.data.tumorLotId)
        return reply(409, "CONTEXTO_CONSULTA_ALTERADO");
      const result = obterInvestigacao(deps, p.data);
      return reply(200, result.codigo, result);
    }
    if (rota === "extracaoLlm") { const result = await executarExtracaoLlm(raw, token, deps); return reply(result.status, String(result.body.codigo), result.body); }
    const cognitivo = await rotearCognitivo(deps, token, rota, raw, req, res);
    if (cognitivo) return reply(cognitivo.status, cognitivo.codigo, cognitivo.body);
    const biblioteca = rotearBiblioteca(deps, token, rota, raw, sessao);
    if (biblioteca) return reply(biblioteca.status, String((biblioteca.body as { codigo?: string }).codigo ?? "BIBLIOTECA_CONSULTADA"), biblioteca.body);
    const duto = rotearDutos(deps, token, rota, raw, sessao);
    if (duto) return reply(duto.status, String((duto.body as { codigo?: string }).codigo ?? "DUTO_PROCESSADO"), duto.body);
    if (rota === "upload") { const result = await processarUploadLocal(deps, token, sessao, raw); return reply(result.status, String(result.body.codigo), result.body); }
    if (rota === "lotesPaciente") {
      const p = LotesPacientePedido.safeParse(raw);
      if (!p.success) return reply(400, "PAYLOAD_INVALIDO");
      if (!lerPaciente(deps.db, p.data.patientId)) return reply(404, "PACIENTE_NAO_ENCONTRADO");
      const r = LotesPacienteResposta.parse({ codigo: "LOTES_CARREGADOS", patientId: p.data.patientId, lotes: lerLotes(deps.db, p.data.patientId) });
      return reply(200, r.codigo, r);
    }
    if (rota === "selecionarContexto") {
      const parsed = z.object({ patientId: Id, encounterId: Id, tumorLotId: Id.nullable() }).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      deps.ditado?.cancelar(token);
      deps.sessoes.selecionarConsulta(token, null);
      if (!lerPaciente(deps.db, parsed.data.patientId)) return reply(404, "PACIENTE_NAO_ENCONTRADO");
      if (parsed.data.tumorLotId !== null
        && !lerLotes(deps.db, parsed.data.patientId).some((lote) => lote.tumorLotId === parsed.data.tumorLotId))
        return reply(409, "TUMOR_LOT_FORA_DO_PACIENTE");
      const hoje = dataCivilDoServico(deps.agora(), "-03:00");
      const dataCivilHoje = hoje.estado === "OK" ? hoje.dataCivil : null;
      const agendaAtiva = dataCivilHoje !== null
        && (deps.db.prepare("SELECT patientId,encounterId,payload FROM clinical_event WHERE tipo='AgendaEntry'").all() as Array<Record<string, unknown>>)
          .some((row) => {
            try {
              const outer = typeof row.payload === "string" ? JSON.parse(row.payload) as Record<string, unknown> : row.payload as Record<string, unknown>;
              const value = outer.data && typeof outer.data === "object" ? outer.data as Record<string, unknown> : outer;
              return row.patientId === parsed.data.patientId && value.patientId === parsed.data.patientId
                && value.encounterId === parsed.data.encounterId && value.data === dataCivilHoje;
            } catch { return false; }
          });
      const permitido = lerTriagens(deps.db).some((item) => item.patientId === parsed.data.patientId
        && item.encounterId === parsed.data.encounterId)
        || !!deps.db.prepare("SELECT 1 AS ok FROM clinical_event WHERE patientId=? AND encounterId=? LIMIT 1")
          .get(parsed.data.patientId, parsed.data.encounterId) || agendaAtiva;
      if (!permitido) return reply(409, "ENCONTRO_FORA_DO_ESCOPO");
      deps.sessoes.selecionarConsulta(token, parsed.data);
      return reply(200, "CONTEXTO_SELECIONADO", { codigo: "CONTEXTO_SELECIONADO" });
    }
    const salaoCanal = rotearSalaoECanal(deps, token, sessao, rota, raw);
    if (salaoCanal) return reply(salaoCanal.status, salaoCanal.codigo, salaoCanal.body);
    const configuracao = rotearConfiguracao(deps, sessao, rota, raw);
    if (configuracao) return reply(configuracao.status, configuracao.codigo, configuracao.body);
    const prescricaoFlash = rotearPrescricaoFlashConfig(deps, token, sessao, rota, raw);
    if (prescricaoFlash) return reply(prescricaoFlash.status, prescricaoFlash.codigo, prescricaoFlash.body);
    const extracaoRevisao = rotearExtracaoERevisao(deps, token, sessao, rota, raw);
    if (extracaoRevisao) return reply(extracaoRevisao.status, extracaoRevisao.codigo, extracaoRevisao.body);
    if (rota === "oncoassistStatus") {
      if (!z.object({}).strict().safeParse(raw).success) return reply(400, "PAYLOAD_INVALIDO");
      const service = deps.oncoassistJev ?? criarOncoassistJev();
      return reply(200, "ONCOASSIST_STATUS", service.status());
    }
    if (rota === "oncoassistClassificar" || rota === "oncoassistHistorico") {
      const controller = new AbortController();
      const desconectado = () => controller.abort();
      res.once("close", desconectado);
      try {
        const r = await operarOncoassistPropostas(deps, token, rota, raw, controller.signal);
        return reply(r.status, r.codigo, r.body);
      } finally { res.off("close", desconectado); }
    }
    if (rota === "consultarConhecimento") {
      const parsed = z.object({
        query: z.string().min(1).max(240), tipos: z.array(z.string()).optional(),
        status: z.array(z.string()).optional(), proveniencia: z.object({ modulo: z.string().optional(), aula: z.string().optional() })
          .strict().optional(), topK: z.number().int().positive().max(100).optional(),
      }).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "CONSULTA_INVALIDA");
      const proveniencia = parsed.data.proveniencia === undefined ? undefined : {
        ...(parsed.data.proveniencia.modulo === undefined ? {} : { modulo: parsed.data.proveniencia.modulo }),
        ...(parsed.data.proveniencia.aula === undefined ? {} : { aula: parsed.data.proveniencia.aula }),
      };
      const consulta = {
        query: parsed.data.query,
        ...(parsed.data.tipos === undefined ? {} : { tipos: parsed.data.tipos }),
        ...(parsed.data.status === undefined ? {} : { status: parsed.data.status }),
        ...(proveniencia === undefined ? {} : { proveniencia }),
        ...(parsed.data.topK === undefined ? {} : { topK: parsed.data.topK }),
      };
      const result = await consultarGrafoLocal(consulta);
      return reply(
        result.status === "OK" ? 200 : 409,
        result.status === "OK" ? "REFERENCIAS_CARREGADAS" : result.codigo,
        result,
      );
    }
    if (rota === "recist") {
      const parsed = z.object({ patientId: Id, encounterId: Id.optional(), tumorLotId: Id.nullable().optional() }).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      if (parsed.data.encounterId === undefined || parsed.data.tumorLotId === undefined)
        return reply(409, "CONTEXTO_ENCONTRO_OBRIGATORIO");
      const atual = deps.sessoes.consultaSelecionada(token);
      if (!atual || atual.patientId !== parsed.data.patientId || atual.encounterId !== parsed.data.encounterId
        || (atual.tumorLotId ?? null) !== parsed.data.tumorLotId) return reply(409, "CONTEXTO_CONSULTA_ALTERADO");
      const result = lerRecist(deps.db, parsed.data.patientId, {encounterId: parsed.data.encounterId,
        tumorLotId: parsed.data.tumorLotId, agora: deps.agora()});
      return reply(
        result.estado === "PENDENTE" ? 404 : 200,
        "codigo" in result ? result.codigo : "RECIST_PROPOSTO",
        result,
      );
    }
    if (rota === "estatistica") {
      const parsed = z.object({
        periodoClinico: z.object({ inicio: DataCivil, fim: DataCivil }).strict()
          .refine((value) => value.inicio <= value.fim).optional(),
      }).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      return reply(200, "ESTATISTICA_DERIVADA", projetarEstatisticaLedger(
        deps.db,
        parsed.data.periodoClinico ? { periodoClinico: parsed.data.periodoClinico } : undefined,
      ));
    }
    if (rota === "avaliarInstrumento") {
      const parsed = z.object({ patientId: Id, encounterId: Id, tumorLotId: Id.nullable(), pedido: AvaliacaoInstrumentoRequest }).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const atual = deps.sessoes.consultaSelecionada(token);
      if (!atual || atual.patientId !== parsed.data.patientId || atual.encounterId !== parsed.data.encounterId
        || (atual.tumorLotId ?? null) !== parsed.data.tumorLotId) return reply(409, "CONTEXTO_CONSULTA_ALTERADO");
      const regras = deps.corpus?.instrumentos.filter(r => r.id === parsed.data.pedido.instrumento) ?? [];
      const resultado = avaliarInstrumentoEstruturado(parsed.data.pedido, regras.length === 1 ? regras[0]! : null);
      return reply(200, "INSTRUMENTO_CALCULADO", { resultado, gravado: false, assinado: false });
    }
    if (rota === "carregarConsulta") {
      const parsed = ConsultaCarregar.safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const anterior = deps.sessoes.consultaSelecionada(token);
      if (anterior?.patientId !== parsed.data.patientId || anterior?.encounterId !== parsed.data.encounterId || (anterior?.tumorLotId ?? null) !== (parsed.data.tumorLotId ?? null))
        deps.ditado?.cancelar(token);
      let leituraInicial: Parameters<NonNullable<NonNullable<Parameters<typeof lerConsulta>[5]>["aoLer"]>>[0] | undefined;
      const result = lerConsulta(deps.db, parsed.data.patientId, deps.agora(), sessao, parsed.data.tumorLotId, {
        ...opcoesLeituraConsulta(deps, sessao), encounterId: parsed.data.encounterId, aoLer: leitura => { leituraInicial = leitura; },
      });
      if (!("codigo" in result)) deps.sessoes.selecionarConsulta(token, {
        patientId: result.patientId, encounterId: result.encounterId, tumorLotId: result.tumorLotId,
      });
      else deps.sessoes.selecionarConsulta(token, null);
      if (!("codigo" in result)) deps.sessoes.registrarAlertasExibidos?.(token, result, result.alertas.map(a=>a.alertaId));
       const leituraClinica=leituraInicial && { ...leituraInicial, itens:leituraInicial.itens.filter(e=>
         e.patientId===parsed.data.patientId || ['Contato','Contato@1','ReviewDecision','ReviewDecision@1'].includes(e.tipo)) };
       const integrado = !("codigo" in result) && deps.motorF1
         ? await deps.motorF1.consultar({patientId:result.patientId,encounterId:result.encounterId,tumorLotId:result.tumorLotId},leituraClinica) : null;
      // Recuperação da caixa usa cadastros globais no servidor/rota do canal; abrir consulta é leitura,
      // sem processar pendências de todos os pacientes nem atribuir contato por snapshot parcial.
      const contatosCanal = !("codigo" in result) ? lerRelatosConsultaCanal(deps.db,
         { sessoes: deps.sessoes, token, agora: deps.agora() }, result.patientId, leituraInicial?.itens) : undefined;
      const dutos=integrado&&!("codigo" in result)?projetarDutos(leituraClinica?.itens??[],{patientId:result.patientId,encounterId:result.encounterId,tumorLotId:result.tumorLotId},deps.corpus):undefined;
      if(!('codigo' in result)){
        const ids=new Set([...result.historicoDocumentos.map(d=>d.eventId),...dutos?.farmacia.map(d=>d.eventId)??[],
          ...dutos?.tarefas.map(d=>d.eventId)??[],...dutos?.apacs.map(d=>d.eventId)??[]]);
        registrarFontesDutoExibidas(deps.sessoes,token,result,(leituraInicial?.itens??[]).filter(e=>ids.has(e.eventId)
          ||e.tipo==='Ciclo'&&dadosDoEvento(e)?.cicloId===result.cabecalho.ciclo?.cicloId));
      }
      return reply("codigo" in result ? 404 : 200, "codigo" in result ? result.codigo : "CONSULTA_CARREGADA",
         integrado && !("codigo" in result) ? {...result,contatosCanal,dutos,retrato:integrado.retrato,...(integrado.visaoIntegrada?{visaoIntegrada:integrado.visaoIntegrada}:{})}:"codigo" in result?result:{...result,contatosCanal});
    }
    if (rota === "agenda") {
      const parsed = z.object({}).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const result = lerAgenda(deps.db, deps.agora(), undefined, deps.salaoRuleset);
      if (result.hoje === null) return reply(503, result.codigo, result);
      return reply(200, result.estado === "FONTE_AUSENTE" ? "FONTE_AGENDA_AUSENTE" : "AGENDA_CARREGADA", result);
    }
    if (rota === "salao") {
      const parsed = z.object({}).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const result = lerSalao(deps.db, deps.agora(), deps.salaoRuleset);
      if ("estado" in result && result.estado === "PENDENTE")
        return reply(503, result.codigo, result);
      registrarSalaoExibido(deps,token,result);
      return reply(200, "SALAO_CARREGADO", result);
    }
    if (rota === "canal") {
      const parsed = z.object({}).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      await processarPendenciasClinicasCanal(deps.db, { agora: deps.agora(), cadastros: () => cadastrosCanal(deps.db) });
      const legado = lerCanal(deps.db), operacionais = lerMensagensOperacionaisCanal(deps.db, { sessoes: deps.sessoes, token, agora: deps.agora() });
      const result = { ...legado, mensagens: [...legado.mensagens, ...operacionais], estado: operacionais.length ? "PARCIAL" : legado.estado };
      return reply(200, result.estado === "FONTE_AUSENTE" ? "FONTE_CANAL_AUSENTE" : "CANAL_CARREGADO", result);
    }
    if (rota === "apac") {
      const parsed = z.object({}).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const cnes = deps.settings?.readProfile(sessao).perfil.instituicao.cnes ?? "";
      const result = lerApacs(deps.db, deps.agora(), {
        caixas: deps.corpus?.caixasTodas ?? [],
        sigtap: deps.corpus?.sigtap ?? {}, cnesConfigurado: cnes,
      });
      if (result.hoje === null) return reply(503, result.codigo, result);
      return reply(200, result.estado === "FONTE_AUSENTE" ? "FONTE_APAC_AUSENTE" : "APAC_CARREGADA", result);
    }
    if (rota === "chat") {
      const parsed = z.object({ setor: z.enum(["TRIAGEM", "FARMACIA", "SECRETARIA", "MEDICO"]) }).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const contexto = deps.sessoes.consultaSelecionada(token);
      if (!contexto) return reply(409, "CONTEXTO_CHAT_NAO_SELECIONADO", { setor: parsed.data.setor, mensagens: [] });
      const mensagens = lerMensagensChat(deps.db, parsed.data.setor, contexto);
      registrarFontesDutoExibidas(deps.sessoes,token,contexto,listarEventos(deps.db,contexto.patientId).filter(e=>e.tipo==='ChatMessage'
        &&e.encounterId===contexto.encounterId&&e.tumorLotId===contexto.tumorLotId&&mensagens.some(m=>m.mensagemId===dadosDoEvento(e)?.mensagemId)));
      return reply(200, "CHAT_CARREGADO", { ...contexto, setor: parsed.data.setor, mensagens, prescricao: null });
    }
    if (rota === "bundle") {
      const parsed = ExibirBundle.safeParse(raw);
      if (parsed.success) {
        const result = exibirBundle(deps, token, parsed.data);
        return reply(result.status, (result.body as { codigo?: string }).codigo ?? "BUNDLE_EXIBIDO", result.body);
      }
      const pedido = z.object({ patientId: Id, encounterId: Id, tumorLotId: Id.nullable() }).strict().safeParse(raw);
      if (!pedido.success) return reply(400, "PAYLOAD_INVALIDO");
      const draftIds = listarDrafts(deps.db, pedido.data.patientId).filter((draft) => {
        const contexto = contextoDraft(draft.payload);
        return !rascunhoNaoPromovivel(draft.payload)
          && contexto?.encounterId === pedido.data.encounterId
          && contexto.tumorLotId === pedido.data.tumorLotId && payloadDocumento(draft.payload) !== null;
      }).map((draft) => draft.draftId);
      const result = exibirBundle(deps, token, { ...pedido.data, draftIds });
      return reply(result.status, (result.body as { codigo?: string }).codigo ?? "BUNDLE_EXIBIDO", result.body);
    }
    if (rota === "confirmar") {
      const parsed = ConfirmarBloco.safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const result = confirmarBloco(deps, token, parsed.data);
      return reply(result.status, (result.body as { codigo: string }).codigo, result.body);
    }
    const parsed = ActionIntent.safeParse(raw);
    if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
    if (parsed.data.verbo === "ENVIAR_WHATSAPP" || parsed.data.verbo === "ENVIAR_EMAIL") {
      const a = revalidarAutorizacaoSaidaCanalNoLedger(deps.db, parsed.data);
      if (!a.ok) return reply(409, a.codigo);
      if (!deps.canal?.transporteSaida) return reply(409, "TRANSPORTE_CANAL_NAO_CONFIGURADO");
      const r = await executarEnvioAutorizadoCanal(deps.db, { sessoes: deps.sessoes, token, agora: deps.agora() }, {
        intent: parsed.data,
        agoraAtual: deps.agora, revisaoContextoAtual: () => revisaoContextoCanal(deps.db, a.autorizacao.contexto) ?? "CONTEXTO_AUSENTE",
        validarVinculoAtual: () => vinculoAtualCanal(deps.db, a.autorizacao.contexto.patientId, a.autorizacao.destinatarioCanonico),
        transporteSaida: deps.canal.transporteSaida,
      });
      const result = r.resultadoGateway;
      return reply(result.decisao === "NEGADA" ? 409 : 200, result.motivoCodigo, result);
    }
    const autorizacao = autorizarSaida(deps.db, parsed.data, competencia => referenciaSigtapDuto(deps.corpus, competencia));
    if (!autorizacao.ok) return reply(409, autorizacao.codigo);
    // Uma rota /acao nunca usa a idempotencia volátil do caller: o ledger local
    // conserva a reserva OUTCOME_UNKNOWN antes do executor, inclusive após reiniciar.
    const result = await deps.gateway.withStore(sqliteIdempotencia(deps.db)).executar(parsed.data, sessao);
    return reply(result.decisao === "NEGADA" ? 409 : 200, result.motivoCodigo, result);
  } catch (error) {
    if(error instanceof ErroProveniencia)return reply(409,error.codigo);
    if (error instanceof Error && error.message === "BODY_TOO_LARGE") return reply(413, "UPLOAD_EXCESSIVO");
    if (error instanceof JsonInvalido) return reply(400, "JSON_INVALIDO");
    if (error instanceof Error && error.message === "CONTEXTO_PACIENTE_OBRIGATORIO")
      return reply(409, "CONTEXTO_PACIENTE_OBRIGATORIO");
    // Never log request bodies, identifiers, thrown error text or stack.
    return reply(500, "ERRO_INTERNO");
  }
}
