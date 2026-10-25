import { z } from "zod";
import { Id, type Fonte, type Sessao } from "../../contracts/base.js";
import { Contato, Triagem } from "../../contracts/clinico.js";
import { ConfirmarRespostaCanal, PrepararRespostaCanal } from "../../contracts/api/respostaCanal.js";
import { ClosureVinculoContato } from "../../contracts/w10/closure.js";
import { auditar, lerDraft, salvarDraft, transacao } from "../../kernel/comandos/portas.js";
import { executarConfirmacao as confirmar } from "../../kernel/comandos/index.js";
import { dataCivilDoServico } from "../../kernel/gateway/tempo.js";
import { detalheMensagemCanal } from "../canalEntrada.js";
import {
  contatoRevogadoCanal,
  lerMensagensOperacionaisCanal,
  revisaoContextoCanal,
  vinculoAtualCanal,
} from "../canalOperacao.js";
import { confirmarRespostaCanalPeloMedico, prepararRascunhoRespostaCanal } from "../canalResposta.js";
import { lerCanal, lerPaciente, lerSalao } from "../leituras.js";
import type { ServidorDeps } from "../rotas.js";
import { hashConteudoExibido } from "../sessao.js";
import { sha } from "./confirmacao.js";
import { registrarSalaoExibido,hashExibicaoCorte } from '../exibicaoSalao.js';

export type RespostaRota = { status: number; codigo: string; body?: unknown };

export function rotearSalaoECanal(
  deps: ServidorDeps,
  token: string,
  sessao: Sessao,
  rota: string,
  raw: unknown,
): RespostaRota | null {
  const reply = (status: number, codigo: string, body: unknown = { codigo }): RespostaRota => ({ status, codigo, body });
  // O rollback de um vínculo recusado também desfaz a auditoria gravada pelo kernel; ela é refeita fora da transação.
  const auditarRecusaDesfeita = (motivo: string | undefined) => auditar(deps.db, { ator: { tipo: "SESSAO", id: sessao.medicoId },
    acaoPedida: "CONFIRMAR", decisao: "NEGADA", motivoCodigo: motivo ?? "VINCULO_CANAL_NEGADO", politicaVersao: "W2-01", em: deps.agora() });

  if (rota === "prepararRespostaCanal") {
    const p = PrepararRespostaCanal.safeParse(raw);
    if (!p.success) return reply(400, "PAYLOAD_INVALIDO");
    const revisaoContexto = revisaoContextoCanal(deps.db, p.data);
    if (!revisaoContexto) return reply(409, "CONTEXTO_RESPOSTA_INVALIDADO");
    const origem = detalheMensagemCanal(deps.db, { sessoes: deps.sessoes, token, agora: deps.agora() }, p.data.mensagemOrigemId);
    if (!origem.ok || !vinculoAtualCanal(deps.db, p.data.patientId, origem.mensagem.senderRef))
      return reply(409, "CONTATO_NAO_VINCULADO_AO_PACIENTE");
    const { patientId, encounterId, tumorLotId, ...entrada } = p.data;
    const r = prepararRascunhoRespostaCanal(
      deps.db,
      { sessoes: deps.sessoes, token, agora: deps.agora() },
      { ...entrada, tipoResposta: "RESPOSTA_LIVRE_MEDICA", contexto: { patientId, encounterId, tumorLotId, revisaoContexto } },
    );
    return r.ok
      ? reply(200, "RESPOSTA_PREPARADA", { codigo: "RESPOSTA_PREPARADA", rascunho: r.rascunho })
      : reply(r.codigo === "ARMAZENAMENTO_INDISPONIVEL" ? 503 : 409, r.codigo);
  }

  if (rota === "confirmarRespostaCanal") {
    const p = ConfirmarRespostaCanal.safeParse(raw);
    if (!p.success) return reply(400, "PAYLOAD_INVALIDO");
    const c = p.data.comprovanteExibicao.contexto;
    if (!vinculoAtualCanal(deps.db, c.patientId, p.data.comprovanteExibicao.destinatario))
      return reply(409, "CONTATO_NAO_VINCULADO_AO_PACIENTE");
    if (revisaoContextoCanal(deps.db, c) !== c.revisaoContexto)
      return reply(409, "CONTEXTO_RESPOSTA_INVALIDADO");
    const r = confirmarRespostaCanalPeloMedico(deps.db, { sessoes: deps.sessoes, token, agora: deps.agora() }, p.data);
    return r.ok
      ? reply(200, "RESPOSTA_CONFIRMADA", { codigo: "RESPOSTA_CONFIRMADA", respostaId: r.autorizacao.respostaId, versao: r.autorizacao.versao })
      : reply(r.codigo === "ARMAZENAMENTO_INDISPONIVEL" ? 503 : 409, r.codigo);
  }

  if (rota === "salvarTriagemSalao") {
    const parsed = z.object({ triagem: Triagem, expectedRevision: z.number().int().nonnegative().nullable() }).strict().safeParse(raw);
    if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
    const contexto = deps.sessoes.consultaSelecionada(token);
    if (!contexto || contexto.patientId !== parsed.data.triagem.patientId
      || contexto.encounterId !== parsed.data.triagem.encounterId)
      return reply(409, "CONTEXTO_CONSULTA_ALTERADO");
    if (!lerPaciente(deps.db, contexto.patientId)) return reply(404, "PACIENTE_NAO_ENCONTRADO");
    const agoraSalao = deps.agora();
    const salaoAntes = lerSalao(deps.db, agoraSalao, deps.salaoRuleset);
    if ("estado" in salaoAntes && salaoAntes.estado === "PENDENTE") return reply(503, salaoAntes.codigo, salaoAntes);
    const draftId = `salao-triagem-${sha(JSON.stringify([contexto.patientId, contexto.encounterId])).slice(0, 36)}`;
    const existente = lerDraft(deps.db, draftId);
    const rawTriagem = parsed.data.triagem;
    const valores = {
      pas: rawTriagem.pas.valor, fc: rawTriagem.fc.valor, spo2: rawTriagem.spo2.valor,
      tempDecimos: rawTriagem.tempDecimos.valor, hbDgDl: rawTriagem.hbDgDl.valor, anc: rawTriagem.anc.valor,
      plq: rawTriagem.plq.valor, coletaHemograma: rawTriagem.coletaHemograma.valor,
      ecog: rawTriagem.ecog.valor, grauCtcae: rawTriagem.grauCtcae.valor,
      tontura: rawTriagem.tontura, vertigemHistoricoAnterior: rawTriagem.vertigemHistoricoAnterior ?? null,
      vertigemInicioNovo: rawTriagem.vertigemInicioNovo ?? null, recurso: rawTriagem.recurso, idadeAnos: rawTriagem.idadeAnos,
    };
    const contentHash = hashConteudoExibido(valores);
    const mesmoConteudo = !!existente
      && (existente.payload as { contentHash?: string } | null)?.contentHash === contentHash;
    const retryDaMesmaGravacao = mesmoConteudo && (parsed.data.expectedRevision === null
      ? existente!.revision === 0 : existente!.revision === parsed.data.expectedRevision + 1);
    if (retryDaMesmaGravacao){
      registrarSalaoExibido(deps,token,salaoAntes);
      return reply(200, "REPLAY", { ...salaoAntes, codigo: "REPLAY" });
    }
    if ((existente?.revision ?? null) !== parsed.data.expectedRevision)
      return reply(409, "REVISAO_RASCUNHO_CONFLITANTE");
    const em = existente ? existente.criadoEm : agoraSalao;
    const dataCaptura = dataCivilDoServico(em, "-03:00");
    const fonte: Fonte = {
      sourceId: `triagem-${sha(draftId).slice(0, 24)}`, classe: "MANUAL",
      localizador: "triagem presencial", dataClinica: dataCaptura.estado === "OK" ? dataCaptura.dataCivil : null,
      dataCaptura: agoraSalao,
      versao: "salao-triagem-v1", contentHash,
    };
    const dado = <T>(valor: T | null, label: string) => valor === null
      ? { valor: null, estado: "PENDENTE" as const, campo: "AUSENTE" as const,
        motivo: `${label} ausente na triagem`, fontes: [], revisao: "RAW" as const }
      : { valor, estado: "PENDENTE" as const, campo: "PRESENTE" as const,
        motivo: `${label} informado em triagem; aguarda revisão`, fontes: [fonte], revisao: "REVISAR" as const };
    const triagem = {
      ...rawTriagem, chegadaEm: existente ? rawTriagem.chegadaEm : agoraSalao,
      pas: dado(rawTriagem.pas.valor, "pressão sistólica"), fc: dado(rawTriagem.fc.valor, "frequência cardíaca"),
      spo2: dado(rawTriagem.spo2.valor, "saturação"), tempDecimos: dado(rawTriagem.tempDecimos.valor, "temperatura"),
      hbDgDl: dado(rawTriagem.hbDgDl.valor, "hemoglobina"), anc: dado(rawTriagem.anc.valor, "neutrófilos"),
      plq: dado(rawTriagem.plq.valor, "plaquetas"), coletaHemograma: dado(rawTriagem.coletaHemograma.valor, "coleta do hemograma"),
      ecog: dado(rawTriagem.ecog.valor, "ECOG"), grauCtcae: dado(rawTriagem.grauCtcae.valor, "grau CTCAE"),
    };
    const saved = salvarDraft(deps.db, {
      draftId, patientId: contexto.patientId, sourceId: fonte.sourceId,
      rawRef: `triagem-local:${contexto.encounterId}`, payload: {
        kind: "SALAO_TRIAGEM_RASCUNHO",
        contexto: { patientId: contexto.patientId, encounterId: contexto.encounterId, tumorLotId: null },
        status: "RASCUNHO", triagem, source: fonte, contentHash,
      }, diagnostics: ["AGUARDA_DECISAO_MEDICA"],
      revision: (existente?.revision ?? -1) + 1, criadoEm: agoraSalao,
    });
    const visaoSalao=lerSalao(deps.db,agoraSalao,deps.salaoRuleset);registrarSalaoExibido(deps,token,visaoSalao);
    return reply(200, "RASCUNHO_SALVO", {
      ...visaoSalao,
      codigo: "RASCUNHO_SALVO", rascunho: { draftId: saved.draftId, revision: saved.revision, criaEventoClinico: false },
    });
  }

  if (rota === "liberarSalao") {
    const parsed = z.object({
      patientId: Id, encounterId: Id, expectedRevision: z.number().int().nonnegative(),
      motivo: z.string().trim().min(1).max(1000), idempotencyKey: z.string().min(8).max(120),
    }).strict().safeParse(raw);
    if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
    const contexto = deps.sessoes.consultaSelecionada(token);
    if (!contexto || contexto.patientId !== parsed.data.patientId || contexto.encounterId !== parsed.data.encounterId)
      return reply(409, "CONTEXTO_CONSULTA_ALTERADO");
    const agoraSalao = deps.agora();
    const projected = lerSalao(deps.db, agoraSalao, deps.salaoRuleset);
    if ("estado" in projected && projected.estado === "PENDENTE") return reply(503, projected.codigo, projected);
    const draftId = `salao-triagem-${sha(JSON.stringify([contexto.patientId, contexto.encounterId])).slice(0, 36)}`;
    const draft = lerDraft(deps.db, draftId);
    if (!draft || draft.patientId !== contexto.patientId) return reply(409, "TRIAGEM_RASCUNHO_AUSENTE");
    const operationId = `salao-release-${parsed.data.idempotencyKey}`;
    const existing = deps.db.prepare("SELECT criadoEm FROM operation WHERE operationId=?").get(operationId) as { criadoEm?: string } | undefined;
    const priorDecision = (deps.db.prepare("SELECT payload FROM clinical_event WHERE tipo='ReviewDecision' AND patientId=? AND encounterId=?")
      .all(contexto.patientId, contexto.encounterId) as Array<{ payload: unknown }>).flatMap((row) => {
        try {
          const outer = typeof row.payload === "string" ? JSON.parse(row.payload) as Record<string, unknown> : row.payload as Record<string, unknown>;
          const value = outer.data && typeof outer.data === "object" ? outer.data as Record<string, unknown> : outer;
          return value.campo === "liberacaoComCorteSalao" && value.triagemDraftId === draftId
            && typeof value.triagemRevision === "number" ? [value] : [];
        } catch { return []; }
      }).find((value) => typeof value.triagemRevision === "number"
        && value.triagemRevision + 1 === draft.revision);
    if (priorDecision) {
      if (priorDecision.motivo === parsed.data.motivo)
        return reply(200, "REPLAY", { ...projected, codigo: "REPLAY" });
      if (existing) return reply(409, "OPERATION_HASH_CONFLICT");
      return reply(409, "LIBERACAO_JA_REGISTRADA", { codigo: "LIBERACAO_JA_REGISTRADA", motivoPreservado: true });
    }
    if (draft.revision !== parsed.data.expectedRevision
      && !(existing && draft.revision === parsed.data.expectedRevision + 1))
      return reply(409, "REVISAO_RASCUNHO_CONFLITANTE");
    const card = projected.cartoes.find((item) => item.entrada.patientId === contexto.patientId);
    if (!card?.temCorte) return reply(409, "CORTE_AUSENTE");
    if(!deps.sessoes.conteudoFoiExibido?.(token,contexto,'SALAO_CORTE',draft.draftId,hashExibicaoCorte(draft,card,projected.ruleset)))
      return reply(409,'CORTE_NAO_EXIBIDO_NESTA_SESSAO');
    // Num replay, o kernel remonta os eventos com o criadoEm já gravado da operação.
    const em = agoraSalao;
    const payload = {
      campo: "liberacaoComCorteSalao", patientId: contexto.patientId,
      encounterId: contexto.encounterId, triagemDraftId: draft.draftId,
      triagemRevision: parsed.data.expectedRevision,
      triagemHash: (draft.payload as { contentHash?: string })?.contentHash ?? hashConteudoExibido(draft.payload),
      motivo: parsed.data.motivo,
    };
    const result = confirmar(deps.db, { autorizadoEm: deps.agora(),
      operationId, patientId: contexto.patientId,
      tumorLotId: null, encounterId: contexto.encounterId,
      reviewDecisionId: operationId, sessao, em, registros: [{
        draftId: draft.draftId,
        expectedRevision: parsed.data.expectedRevision, eventId: `salao-release-event-${sha(operationId).slice(0, 32)}`,
        tipo: "ReviewDecision", payload, fontes: [], revisao: "CONFIRMADO",
      }],
    });
    if (result.estado === "NEGADA") return reply(409, result.motivo ?? "LIBERACAO_NEGADA");
    return reply(200, result.estado, { ...lerSalao(deps.db, agoraSalao, deps.salaoRuleset), codigo: result.estado });
  }

  if (rota === "vincularCanal") {
    const parsed = z.object({ contatoId: Id, patientId: Id, idempotencyKey: z.string().min(8).max(120) }).strict().safeParse(raw);
    if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
    const contexto = deps.sessoes.consultaSelecionada(token);
    if (!contexto || contexto.patientId !== parsed.data.patientId)
      return reply(409, "CONTEXTO_CONSULTA_ALTERADO");
    if (!lerPaciente(deps.db, parsed.data.patientId)) return reply(404, "PACIENTE_NAO_ENCONTRADO");
    const acessoCanal = { sessoes: deps.sessoes, token, agora: deps.agora() };
    const operacionais = lerMensagensOperacionaisCanal(deps.db, acessoCanal).filter(m => m.contatoId === parsed.data.contatoId);
    if (operacionais.length) {
      if (operacionais.some(m => m.origemCanal !== "WHATSAPP_SERVICO" || m.estadoVinculo === "REVOGADO"
        || m.estadoVinculo === "CONFLITO" || (m.patientId !== null && m.patientId !== parsed.data.patientId))
        || contatoRevogadoCanal(deps.db, parsed.data.contatoId)) return reply(409, "CONFLITO_VINCULO_CONTATO");
      if (vinculoAtualCanal(deps.db, parsed.data.patientId, parsed.data.contatoId))
        return reply(200, "REPLAY", { mensagens: [...lerCanal(deps.db).mensagens, ...lerMensagensOperacionaisCanal(deps.db, acessoCanal)] });
      const operationId = `canal-operacional-link-${parsed.data.idempotencyKey}`;
      const draftId = `canal-link-${sha(operationId)}`;
      const payload = Contato.parse({
        contatoId: parsed.data.contatoId, canal: "WHATSAPP_SERVICO", endereco: parsed.data.contatoId,
        patientId: parsed.data.patientId, relacao: "DESCONHECIDO", vinculadoEm: acessoCanal.agora, revogadoEm: null,
      });
      const fontes = operacionais.map(m => ({
        sourceId: m.mensagemId, classe: "CHAT_TEXT" as const,
        localizador: null, dataClinica: null, dataCaptura: acessoCanal.agora, versao: "vinculo-operacional-v1", contentHash: hashConteudoExibido(m.texto),
      }));
      const existente = lerDraft(deps.db, draftId);
      if (existente) return reply(409, "CHAVE_IDEMPOTENCIA_REUTILIZADA");
      // Rascunho e vínculo formam uma unidade: recusa não deixa rascunho órfão nem trava o retry.
      const r = transacao(deps.db, () => {
        const draft = salvarDraft(deps.db, {
          draftId, patientId: parsed.data.patientId, sourceId: fontes[0]!.sourceId,
          rawRef: "vinculo-operacional-local", payload, diagnostics: [], revision: 0, criadoEm: acessoCanal.agora,
        });
        return confirmar(deps.db, { autorizadoEm: deps.agora(),
          operationId, patientId: parsed.data.patientId, encounterId: contexto.encounterId,
          tumorLotId: contexto.tumorLotId ?? null, reviewDecisionId: operationId, sessao, em: acessoCanal.agora,
          registros: [{ draftId, expectedRevision: draft.revision, eventId: `contato-${sha(operationId)}`, tipo: "Contato", payload, fontes, revisao: "CONFIRMADO" }],
        });
      }, (gravacao) => gravacao.estado === "NEGADA");
      if (r.estado === "NEGADA") {
        auditarRecusaDesfeita(r.motivo);
        return reply(409, r.motivo ?? "VINCULO_CANAL_NEGADO");
      }
      return reply(200, "VINCULO_GRAVADO", { mensagens: [...lerCanal(deps.db).mensagens, ...lerMensagensOperacionaisCanal(deps.db, acessoCanal)] });
    }
    const caixa = lerCanal(deps.db);
    const mensagens = caixa.mensagens.filter((item) => item.contatoId === parsed.data.contatoId);
    if (!mensagens.length) return reply(409, "MENSAGEM_CONTATO_NAO_ENCONTRADA");
    if (mensagens.some((item) => item.patientId && item.patientId !== parsed.data.patientId))
      return reply(409, "CONFLITO_VINCULO_CONTATO");
    const contatoRows = deps.db.prepare("SELECT eventId,payload FROM clinical_event WHERE tipo='Contato'")
      .all() as Array<{ eventId: string; payload: unknown }>;
    const contatos = contatoRows.flatMap((row) => {
      try {
        const outer = typeof row.payload === "string" ? JSON.parse(row.payload) as Record<string, unknown> : row.payload as Record<string, unknown>;
        const value = Contato.safeParse(outer.data ?? outer);
        return value.success && value.data.contatoId === parsed.data.contatoId
          ? [{ eventId: row.eventId, value: value.data }] : [];
      } catch { return []; }
    });
    if (!contatos.length) return reply(404, "CONTATO_NAO_ENCONTRADO");
    if (contatos.some((item) => item.value.revogadoEm !== null)) return reply(409, "CONTATO_REVOGADO");
    if (contatos.length !== 1) return reply(409, "CONTATO_DIVERGENTE");
    const contatoOriginal = contatos[0]!;
    if (contatoOriginal.value.patientId !== null && contatoOriginal.value.patientId !== parsed.data.patientId)
      return reply(409, "CONFLITO_VINCULO_CONTATO");
    const decisions = (deps.db.prepare("SELECT eventId,patientId,encounterId,tumorLotId,payload FROM clinical_event WHERE tipo='ReviewDecision'")
      .all() as Array<Record<string, unknown>>).flatMap((row) => {
        try {
          const outer = typeof row.payload === "string" ? JSON.parse(row.payload) as Record<string, unknown> : row.payload as Record<string, unknown>;
          const value = outer.data && typeof outer.data === "object" ? outer.data as Record<string, unknown> : outer;
          return value.kind === "VinculoContato" && value.contatoId === parsed.data.contatoId
            && value.sourceEventId === contatoOriginal.eventId && typeof value.patientId === "string"
            ? [{ patientId: value.patientId, encounterId: row.encounterId, tumorLotId: row.tumorLotId ?? null }] : [];
        } catch { return []; }
      });
    const priorTargets = [...new Set(decisions.map((item) => item.patientId))];
    if (priorTargets.length > 1 || (priorTargets.length === 1 && priorTargets[0] !== parsed.data.patientId))
      return reply(409, "CONFLITO_VINCULO_CONTATO", {
        codigo: "CONFLITO_VINCULO_CONTATO",
        candidatos: priorTargets, preservado: true,
      });
    if (decisions.some((item) => item.patientId === parsed.data.patientId
      && item.encounterId === contexto.encounterId && item.tumorLotId === (contexto.tumorLotId ?? null)))
      return reply(200, "REPLAY", { ...caixa, codigo: "REPLAY" });
    const operationId = `canal-link-${parsed.data.idempotencyKey}`;
    const existing = deps.db.prepare("SELECT criadoEm FROM operation WHERE operationId=?").get(operationId) as { criadoEm?: string } | undefined;
    const em = existing?.criadoEm ?? deps.agora();
    const eventRows = deps.db.prepare("SELECT * FROM clinical_event WHERE tipo='CanalMessage'")
      .all() as Array<Record<string, unknown>>;
    const fontes = eventRows.flatMap((row) => {
      try {
        const outer = JSON.parse(String(row.payload)) as Record<string, unknown>;
        const value = (outer.data && typeof outer.data === "object" ? outer.data : outer) as Record<string, unknown>;
        if (value.contatoId !== parsed.data.contatoId || typeof value.mensagemId !== "string") return [];
        const text = typeof value.texto === "string" ? value.texto : "";
        return [{
          sourceId: value.mensagemId, classe: "CHAT_TEXT" as const, localizador: null,
          dataClinica: null, dataCaptura: em, versao: "canal-link-v1", contentHash: hashConteudoExibido(text),
        }];
      } catch { return []; }
    });
    fontes.sort((a, b) => a.sourceId.localeCompare(b.sourceId));
    if (!fontes.length) return reply(409, "MENSAGEM_FORA_DO_ESCOPO");
    const payload = ClosureVinculoContato.parse({
      kind: "VinculoContato", contatoId: parsed.data.contatoId,
      sourceEventId: contatoOriginal.eventId, patientId: parsed.data.patientId, encounterId: contexto.encounterId,
      tumorLotId: contexto.tumorLotId ?? null,
    });
    const draftId = `canal-link-draft-${sha(operationId).slice(0, 32)}`;
    const current = lerDraft(deps.db, draftId);
    if (current && (current.patientId !== parsed.data.patientId || JSON.stringify(current.payload) !== JSON.stringify(payload)))
      return reply(409, "CHAVE_IDEMPOTENCIA_REUTILIZADA");
    // Rascunho e decisão formam uma unidade: recusa do kernel não deixa rascunho órfão.
    const result = transacao(deps.db, () => {
      if (!current) salvarDraft(deps.db, {
        draftId, patientId: parsed.data.patientId,
        sourceId: fontes[0]!.sourceId, rawRef: `canal-link:${parsed.data.contatoId}`, payload,
        diagnostics: ["VINCULO_EXPLICITO_PENDENTE"], revision: 0, criadoEm: em,
      });
      return confirmar(deps.db, { autorizadoEm: deps.agora(),
        operationId, patientId: parsed.data.patientId,
        tumorLotId: contexto.tumorLotId ?? null, encounterId: contexto.encounterId,
        reviewDecisionId: operationId, sessao, em, registros: [{
          draftId, expectedRevision: 0,
          eventId: `canal-link-event-${sha(operationId).slice(0, 32)}`, tipo: "ReviewDecision", payload,
          fontes, revisao: "CONFIRMADO",
        }],
      });
    }, (gravacao) => gravacao.estado === "NEGADA");
    if (result.estado === "NEGADA") {
      auditarRecusaDesfeita(result.motivo);
      return reply(409, result.motivo ?? "VINCULO_CANAL_NEGADO");
    }
    return reply(200, result.estado, { ...lerCanal(deps.db), codigo: result.estado });
  }

  return null;
}
