import { z } from "zod";
import { ContextoConversa, PreferenciasConversa, ConfiguracaoConversa, SalvarConfiguracaoConversa, PedidoConversa, CancelarConversa,
  FonteConversa, TurnoConversa, HistoricoConversa, RespostaConversa, ConfiguracaoConversaResposta,
  type EventoConversa } from "../contracts/api/conversaOncoassist.js";
import { lerDraft, listarDrafts, salvarDraft, transacao } from "../kernel/comandos/portas.js";
import { endpointConversaLocal, responderModeloLocal } from "../kernel/llm/conversaLocal.js";
import { hashConteudoExibido as hash } from "./sessao.js";
import { lerPaciente } from "./leituras.js";
import { lerConhecimentoBrain } from "./conhecimentoBrain.js";
import type { ServidorDeps } from "./rotas.js";

const Registro = z.object({ kind: z.literal("SINTESE_RASCUNHO"), formato: z.literal("CONVERSA_ONCOASSIST"),
  contexto: ContextoConversa, requestHash: z.string(), baseHash: z.string(), turno: TurnoConversa, contentHash: z.string() }).strict();
const RegistroConfig = z.object({ kind: z.literal("SINTESE_RASCUNHO"), formato: z.literal("CONFIG_ONCOASSIST"),
  atorId: z.string(), configuracao: ConfiguracaoConversa, contentHash: z.string() }).strict();
const PADRAO = PreferenciasConversa.parse({ formato: "TOPICOS", extensao: "BREVE", incluirBiblioteca: false });
const ativas = new WeakMap<ServidorDeps["db"], Map<string, AbortController>>();
class Recusa extends Error { constructor(readonly codigo: string, readonly status = 409) { super(codigo); } }
const mesmo = (a: unknown, b: unknown) => hash(a) === hash(b);
function validarContexto(deps: ServidorDeps, token: string, contexto: ContextoConversa) {
  const sessao = deps.sessoes.obter(token);
  if (!sessao) throw new Recusa("SESSAO_INVALIDA", 401);
  const selecionado = deps.sessoes.consultaSelecionada(token);
  if (!selecionado || !mesmo(selecionado, contexto)) throw new Recusa("CONTEXTO_CONSULTA_ALTERADO");
  if (!lerPaciente(deps.db, contexto.patientId)) throw new Recusa("PACIENTE_INDISPONIVEL");
  return sessao;
}
function configuracao(deps: ServidorDeps, atorId: string) {
  const prefixo = `oa-config:${hash(atorId)}:`;
  // O namespace identifica os registros próprios mesmo se kind/atorId estiverem
  // corrompidos. Não materializar configurações de outro médico para filtrá-las depois.
  const candidatos = deps.db.prepare(`SELECT draftId FROM draft_envelope WHERE
    substr(draftId,1,?)=? OR (patientId IS NULL AND CASE WHEN json_valid(payload) THEN
      json_extract(payload,'$.kind')='SINTESE_RASCUNHO'
      AND json_extract(payload,'$.formato')='CONFIG_ONCOASSIST'
      AND json_extract(payload,'$.atorId')=? ELSE 0 END
  )`).all(prefixo.length, prefixo, atorId);
  const versoes = candidatos.map(row => {
    let d: ReturnType<typeof lerDraft>;
    try { d = lerDraft(deps.db, String(row.draftId)); }
    catch { throw new Recusa("CONFIGURACAO_INTEGRA_NECESSARIA"); }
    const r = RegistroConfig.safeParse(d?.payload);
    if (!d || d.patientId !== null || !r.success || r.data.atorId !== atorId || r.data.configuracao.revision < 1
      || d.draftId !== `${prefixo}${r.data.configuracao.revision}` || d.revision !== 0)
      throw new Recusa("CONFIGURACAO_INTEGRA_NECESSARIA");
    const { contentHash, ...conteudo } = r.data;
    if (contentHash !== hash(conteudo)) throw new Recusa("CONFIGURACAO_INTEGRA_NECESSARIA");
    return r.data.configuracao;
  }).sort((a, b) => b.revision - a.revision);
  return versoes[0] ?? { revision: 0, preferencias: PADRAO, modelo: null };
}
function fontesDoContexto(deps: ServidorDeps, contexto: ContextoConversa, incluirBiblioteca: boolean): FonteConversa[] {
  const fontes: FonteConversa[] = [];
  const retrato = deps.motorF1?.retrato(contexto);
  if (retrato && !mesmo({ patientId: retrato.patientId, encounterId: retrato.encounterId, tumorLotId: retrato.tumorLotId }, contexto))
    throw new Recusa("RETRATO_FORA_CONTEXTO");
  for (const resumo of retrato?.resumo ?? []) {
    for (const ref of resumo.fatos) {
      const fato = retrato!.fatos.find(f => mesmo(f.ref, ref));
      if (!fato) throw new Recusa("REFERENCIA_NAO_VIGENTE");
      const id = `evento:${ref.eventId}`;
      if (fontes.some(f => f.id === id)) continue;
      fontes.push(FonteConversa.parse({ id, tipo: "PRONTUARIO", titulo: fato.campo ?? fato.tipo,
        texto: resumo.texto.slice(0, 12000), hash: hash(fato), revisao: `CONFIRMADO · ${ref.revisao}`,
        eventId: ref.eventId, draftId: null, sourceId: fato.fontes[0]?.sourceId ?? null, pagina: null,
        data: fato.tempoClinico, url: null }));
    }
  }
  for (const d of listarDrafts(deps.db, contexto.patientId)) {
    const p = z.object({ kind: z.literal("EXTRACAO_RASCUNHO"), input: z.object({ rawTranscript: z.string(), sourceId: z.string() }),
      patientLinkReview: ContextoConversa.extend({ segmentId: z.string() }).passthrough(),
      state: z.object({ segments: z.array(z.object({ id: z.string(), sourceId: z.string(), rawTranscript: z.string() }).passthrough()) }).passthrough(),
    }).passthrough().safeParse(d.payload);
    if (!p.success || !mesmo({ patientId: p.data.patientLinkReview.patientId, encounterId: p.data.patientLinkReview.encounterId,
      tumorLotId: p.data.patientLinkReview.tumorLotId }, contexto)) continue;
    const segmento = p.data.state.segments.find(s => s.id === p.data.patientLinkReview.segmentId
      && s.sourceId === p.data.input.sourceId && s.sourceId === d.sourceId);
    if (!segmento) continue;
    fontes.push(FonteConversa.parse({ id: `documento:${d.draftId}`, tipo: "DOCUMENTO", titulo: `Documento ${d.sourceId}`,
      texto: segmento.rawTranscript.slice(0, 12000), hash: hash(d.payload), revisao: `FONTE VINCULADA · versão ${d.revision}; extração exige revisão`,
      draftId: d.draftId, eventId: null, sourceId: d.sourceId, pagina: null, data: d.criadoEm, url: null }));
  }
  if (incluirBiblioteca) {
    const brain = lerConhecimentoBrain(deps.db);
    const admitidas = new Set(brain.referenciasCandidatas.filter(r => r.dependenciasAprovadas && r.escopoCompativel).map(r => r.referenciaId));
    for (const r of brain.conhecimento.referencias) {
      if (!admitidas.has(r.referenciaId) || !["CONSULTAVEL", "ALERTA"].includes(r.estado)) continue;
      fontes.push(FonteConversa.parse({ id: `biblioteca:${r.referenciaId}`, tipo: "BIBLIOTECA", titulo: r.titulo,
        texto: r.trecho, hash: hash({ referencia: r, biblioteca: brain.conhecimento.biblioteca }), revisao: `${r.estado} · ${r.versao}`,
        draftId: null, eventId: null, sourceId: r.referenciaId, pagina: null, data: r.publicadoEm, url: r.fonte }));
    }
  }
  return fontes.filter(f => f.texto.trim()).slice(0, 100);
}
function registro(raw: unknown) {
  const r = Registro.parse(raw), { contentHash, ...conteudo } = r;
  if (contentHash !== hash(conteudo)) throw new Recusa("CONVERSA_INTEGRIDADE_INVALIDA");
  return r;
}
function historico(deps: ServidorDeps, contexto: ContextoConversa) {
  return listarDrafts(deps.db, contexto.patientId).flatMap(d => {
    if (!d.payload || typeof d.payload !== "object" || !("formato" in d.payload) || d.payload.formato !== "CONVERSA_ONCOASSIST") return [];
    const r = registro(d.payload);
    if (!mesmo(r.contexto, contexto)) return [];
    if (r.turno.id !== d.draftId) throw new Recusa("CONVERSA_INTEGRIDADE_INVALIDA");
    return [r.turno];
  }).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm) || b.id.localeCompare(a.id)).slice(0, 100).reverse();
}
function comValidade(turno: TurnoConversa, fontesAtuais: readonly FonteConversa[]): TurnoConversa {
  return { ...turno, validadeFontes: turno.fontes.every(f => fontesAtuais.some(atual => atual.id === f.id && atual.hash === f.hash)) ? "ATUAIS" : "ALTERADAS" };
}
const codigosModelo = new Set(["MODELO_ENDPOINT_INVALIDO", "MODELO_APENAS_LOOPBACK", "MODELO_LOCAL_INDISPONIVEL", "MODELO_STREAM_INVALIDO", "MODELO_RESPOSTA_EXCESSIVA", "CITACAO_NAO_SUSTENTADA", "FONTES_NECESSARIAS", "FONTES_EXCESSIVAS_SELECIONE_MENOS"]);

/** Conversation is an inert DraftEnvelope. No clinical event, corpus mutation or signature is produced. */
export async function operarConversa(deps: ServidorDeps, token: string, url: string, raw: unknown,
  signal?: AbortSignal, aoEvento?: (evento: EventoConversa) => void): Promise<{ status: number; body: unknown }> {
  try {
    const contexto = ContextoConversa.parse(url.endsWith("/historico") ? raw
      : Object.fromEntries(Object.entries(raw as Record<string, unknown> ?? {}).filter(([k]) => ["patientId", "encounterId", "tumorLotId"].includes(k))));
    const sessao = validarContexto(deps, token, contexto);
    const config = configuracao(deps, sessao.medicoId);
    if (url.endsWith("/historico")) {
      const fontes = fontesDoContexto(deps, contexto, config.preferencias.incluirBiblioteca);
      return { status: 200, body: HistoricoConversa.parse({ codigo: "CONVERSA_HISTORICO", contexto,
        configuracao: config, fontes, turnos: historico(deps, contexto).map(t => comValidade(t, fontes)), limiteHistorico: 100 }) };
    }
    if (url.endsWith("/cancelar")) {
      const p = CancelarConversa.parse(raw);
      const r = transacao(deps.db, () => {
        const d = lerDraft(deps.db, p.turnoId); if (!d || d.patientId !== contexto.patientId) throw new Recusa("CONVERSA_FORA_CONTEXTO");
        const anterior = registro(d.payload);
        if (!mesmo(anterior.contexto, contexto) || anterior.turno.atorId !== sessao.medicoId) throw new Recusa("CONVERSA_FORA_CONTEXTO");
        if (anterior.turno.estado === "CONCLUIDA") throw new Recusa("CONVERSA_JA_CONCLUIDA");
        if (anterior.turno.estado !== "EM_CURSO") return RespostaConversa.parse({ codigo: "CONVERSA_REPLAY", contexto, turno: anterior.turno });
        const turno = TurnoConversa.parse({ ...anterior.turno, estado: "CANCELADA", texto: "", citacoes: [], codigo: "CANCELADA_PELO_MEDICO", concluidoEm: deps.agora() });
        const { contentHash: _hash, ...conteudo } = anterior;
        const novo = { ...conteudo, turno };
        salvarDraft(deps.db, { ...d, revision: d.revision + 1, payload: { ...novo, contentHash: hash(novo) } });
        return RespostaConversa.parse({ codigo: "CONVERSA_REPLAY", contexto, turno });
      });
      ativas.get(deps.db)?.get(p.turnoId)?.abort();
      return { status: 200, body: r };
    }
    if (url.endsWith("/configurar")) {
      const p = SalvarConfiguracaoConversa.parse(raw);
      if (p.modelo) { try { endpointConversaLocal(p.modelo.endpoint); } catch { throw new Recusa("MODELO_APENAS_LOOPBACK", 400); } }
      return transacao(deps.db, () => {
        validarContexto(deps, token, contexto);
        const atual = configuracao(deps, sessao.medicoId);
        if (atual.revision !== p.expectedRevision) throw new Recusa("CONFIGURACAO_REVISAO_CONFLITANTE");
        const nova = ConfiguracaoConversa.parse({ revision: atual.revision + 1, preferencias: p.preferencias, modelo: p.modelo });
        const conteudo = { kind: "SINTESE_RASCUNHO" as const, formato: "CONFIG_ONCOASSIST" as const, atorId: sessao.medicoId, configuracao: nova };
        salvarDraft(deps.db, { draftId: `oa-config:${hash(sessao.medicoId)}:${nova.revision}`, patientId: null, sourceId: "preferencias-assistente-local", rawRef: "referencia-local",
          payload: { ...conteudo, contentHash: hash(conteudo) }, revision: 0, criadoEm: deps.agora(), diagnostics: ["PREFERENCIA_NAO_CLINICA"] });
        return { status: 200, body: ConfiguracaoConversaResposta.parse({ codigo: "CONVERSA_CONFIGURADA", configuracao: nova }) };
      });
    }
    if (!url.endsWith("/responder") && !url.endsWith("/responder-stream")) return { status: 404, body: { codigo: "ROTA_NAO_ENCONTRADA" } };
    const p = PedidoConversa.parse(raw), requestHash = hash({ pedido: p, ator: sessao.medicoId });
    const id = `oa-conversa:${hash({ operationId: p.operationId, ator: sessao.medicoId })}`;
    const anterior = lerDraft(deps.db, id);
    if (anterior) {
      const r = registro(anterior.payload);
      if (r.requestHash !== requestHash || !mesmo(r.contexto, contexto)) throw new Recusa("IDEMPOTENCIA_CONFLITO");
      return { status: r.turno.estado === "EM_CURSO" ? 202 : 200, body: RespostaConversa.parse({ codigo: r.turno.estado === "EM_CURSO" ? "CONVERSA_EM_CURSO" : "CONVERSA_REPLAY", contexto,
        turno: comValidade(r.turno, fontesDoContexto(deps, contexto, config.preferencias.incluirBiblioteca)) }) };
    }
    const disponiveis = fontesDoContexto(deps, contexto, config.preferencias.incluirBiblioteca);
    const selecionadas = p.fontesIds.length ? p.fontesIds.map(id => {
      const fonte = disponiveis.find(f => f.id === id); if (!fonte) throw new Recusa("FONTE_FORA_CONTEXTO"); return fonte;
    }) : disponiveis.slice(0, 12);
    if (new Set(selecionadas.map(f => f.id)).size !== selecionadas.length) throw new Recusa("FONTE_DUPLICADA", 400);
    if (p.modo === "MODELO_LOCAL" && !config.modelo) throw new Recusa("MODELO_LOCAL_NAO_CONFIGURADO");
    const baseHash = hash({ fontes: selecionadas, config });
    const turno = TurnoConversa.parse({ id, operationId: p.operationId, pergunta: p.pergunta, modo: p.modo, modelo: p.modo === "MODELO_LOCAL" ? config.modelo?.modelo : null,
      estado: "EM_CURSO", texto: "", citacoes: [], fontes: selecionadas, criadoEm: deps.agora(), concluidoEm: null, atorId: sessao.medicoId,
      codigo: null, validadeFontes: "ATUAIS", revisaoObrigatoria: true, assinado: false, criaEventoClinico: false });
    const persistir = (valor: TurnoConversa, revision: number) => {
      const conteudo = { kind: "SINTESE_RASCUNHO" as const, formato: "CONVERSA_ONCOASSIST" as const, contexto, requestHash, baseHash, turno: valor };
      return salvarDraft(deps.db, { draftId: id, patientId: contexto.patientId, sourceId: "oncoassist-conversa", rawRef: "referencia-local",
        payload: { ...conteudo, contentHash: hash(conteudo) }, revision, criadoEm: turno.criadoEm, diagnostics: ["PROPOSTA_NAO_ASSINADA", "REVISAO_MEDICA_OBRIGATORIA"] });
    };
    transacao(deps.db, () => { if (lerDraft(deps.db, id)) throw new Recusa("OPERACAO_EM_CURSO"); persistir(turno, 0); });
    const controller = new AbortController();
    const mapa = ativas.get(deps.db) ?? new Map<string, AbortController>(); mapa.set(id, controller); ativas.set(deps.db, mapa);
    const abort = AbortSignal.any([controller.signal, ...(signal ? [signal] : []), AbortSignal.timeout(45_000)]);
    const exigirReserva = () => {
      const d = lerDraft(deps.db, id);
      if (!d || d.revision !== 0 || registro(d.payload).turno.estado !== "EM_CURSO") throw new Recusa("CONVERSA_CANCELADA");
    };
    try {
      aoEvento?.({ tipo: "inicio", turnoId: id });
      let saida: { texto: string; citacoes: { fonteId: string; trecho: string }[] };
      if (p.modo === "BRIEFING") {
        const limite = config.preferencias.extensao === "BREVE" ? 400 : 1000;
        const itens = selecionadas.map(f => `${f.titulo} — ${f.revisao}${f.data ? ` · ${f.data}` : ""}\n${f.texto.slice(0, limite)}${f.texto.length > limite ? "\n[Excerto; abra a fonte para conferir o texto completo.]" : ""}`);
        saida = { texto: itens.length ? `Briefing documental local — não é resposta de modelo.\n\n${itens.join("\n\n")}\n\nConfira as fontes e as pendências antes de registrar.` : "Nenhuma fonte disponível neste contexto. Vincule/revise documentos; ausência de fonte não significa ausência de doença.",
          citacoes: selecionadas.map(f => ({ fonteId: f.id, trecho: f.texto.slice(0, limite) })) };
      } else saida = await responderModeloLocal(config.modelo!, p.pergunta, selecionadas, config.preferencias, abort, texto => {
        validarContexto(deps, token, contexto); exigirReserva(); if (abort.aborted) throw new Recusa("CONVERSA_CANCELADA");
        aoEvento?.({ tipo: "delta", texto, parcialNaoValidado: true });
      }, historico(deps, contexto).filter(t => t.estado === "CONCLUIDA"
        && t.fontes.every(f => disponiveis.some(atual => atual.id === f.id && atual.hash === f.hash)))
        .slice(-6).map(t => ({ pergunta: t.pergunta.slice(0, 2000), texto: t.texto.slice(0, 4000) })));
      if (abort.aborted) throw new Recusa("CONVERSA_CANCELADA");
      return transacao(deps.db, () => {
        validarContexto(deps, token, contexto);
        exigirReserva();
        const atuais = fontesDoContexto(deps, contexto, config.preferencias.incluirBiblioteca);
        const recapturadas = selecionadas.map(f => atuais.find(a => a.id === f.id) ?? null);
        if (hash({ fontes: recapturadas, config: configuracao(deps, sessao.medicoId) }) !== baseHash) throw new Recusa("FONTES_OU_CONFIGURACAO_ALTERADAS");
        const final = TurnoConversa.parse({ ...turno, ...saida, estado: "CONCLUIDA", concluidoEm: deps.agora() });
        const gravado = persistir(final, 1); if (gravado.draftId !== id) throw new Recusa("CONVERSA_REVISAO_CONFLITANTE");
        return { status: 200, body: RespostaConversa.parse({ codigo: "CONVERSA_CONCLUIDA", contexto, turno: final }) };
      });
    } catch (error) {
      const codigo = error instanceof Recusa ? error.codigo : abort.aborted ? "CONVERSA_CANCELADA"
        : error instanceof Error && codigosModelo.has(error.message) ? error.message : "CONVERSA_RESPOSTA_INVALIDA";
      const atual = lerDraft(deps.db, id);
      if (atual?.revision === 0 && registro(atual.payload).turno.estado === "EM_CURSO")
        persistir(TurnoConversa.parse({ ...turno, estado: abort.aborted ? "CANCELADA" : "FALHOU", codigo, concluidoEm: deps.agora() }), 1);
      throw new Recusa(codigo);
    } finally { mapa.delete(id); if (!mapa.size) ativas.delete(deps.db); }
  } catch (error) {
    return { status: error instanceof Recusa ? error.status : error instanceof z.ZodError ? 400 : 503,
      body: { codigo: error instanceof Recusa ? error.codigo : error instanceof z.ZodError ? "PAYLOAD_INVALIDO" : "CONVERSA_INDISPONIVEL" } };
  }
}
