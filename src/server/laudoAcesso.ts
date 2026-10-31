import { auditarAcessoMedico } from "./acessoSetorial.js";
import { PedidoLaudoAcesso, RespostaLaudoAcesso } from "../contracts/api/laudoAcesso.js";
import { MinutaLaudoAcessoJudicial } from "../contracts/f4/acessoEJudicializacao.js";
import { dadosDoEvento } from "../kernel/projections/snapshot.js";
import { listarEventos, lerDraft, salvarDraft, transacao } from "../kernel/comandos/portas.js";
import { diaDaObservacao, observacaoNoHorizonte } from "../modules/consulta/observacoesTemporais.js";
import { projetarBasePrescricaoExecutavel } from "./prescricaoExecutavel.js";
import { garantirSchemaF4, salvarMinutaLaudoAcessoJudicialF4, assinarMinutaLaudoAcessoJudicialF4, lerMinutaLaudoAcessoJudicialF4 } from "./f4Acesso.js";
import { hashConteudoExibido as hash } from "./sessao.js";
import { metadadosDoFatoImpedemUso } from "./f0c/dadosDocumentados.js";
import type { ServidorDeps } from "./rotas.js";

/** F4 conectado à sessão, ao prontuário e à prescrição assinada; conteúdo exibido é vinculado por hash. */
export function operarLaudoAcesso(raw: unknown, token: string, deps: ServidorDeps) {
  const negar = (codigo: string, status = 409) => ({ status, body: { codigo } });
  const sessao = deps.sessoes.obter(token), agora = deps.agora();
  if (!sessao || Date.parse(sessao.expiraEm) <= Date.parse(agora)) return negar("SESSAO_EXPIRADA", 401);
  const p = PedidoLaudoAcesso.safeParse(raw);
  if (!p.success) return negar("PEDIDO_LAUDO_INVALIDO", 400);
  const pedido = p.data, ctx = pedido.contexto, selecionado = deps.sessoes.consultaSelecionada(token);
  if (!selecionado || selecionado.patientId !== ctx.patientId || selecionado.encounterId !== ctx.encounterId || (selecionado.tumorLotId ?? null) !== ctx.tumorLotId) return negar("CONTEXTO_CONSULTA_ALTERADO");
  if (!auditarAcessoMedico(deps, token, pedido.acao === "ASSINAR" ? "ASSINAR_DOCUMENTO_OU_PRESCRICAO" : "LER_PRONTUARIO_COMPLETO").permitida) return negar("ACESSO_SETORIAL_NEGADO", 403);
  return transacao(deps.db, () => {
    garantirSchemaF4(deps.db);
    const eventos = listarEventos(deps.db, ctx.patientId);
    const base = projetarBasePrescricaoExecutavel(eventos, ctx, agora);
    const retrato = deps.motorF1?.retrato(ctx, undefined, undefined, agora);
    const hoje = diaDaObservacao(agora)!;
    const candidatos = (retrato?.fatos ?? []).filter(f => f.patientId === ctx.patientId && (f.escopo === "PACIENTE" || f.tumorLotId === ctx.tumorLotId));
    const fontes: RespostaLaudoAcesso["fontes"] = candidatos.flatMap(f => {
      const data = diaDaObservacao(f.tempoClinico), valor = f.dados.valor;
      if (f.campo && candidatos.some(outro => outro.campo === f.campo && outro.tempoClinico === f.tempoClinico
        && hash(outro.dados.valor) !== hash(valor))) return [];
      if (f.patientId !== ctx.patientId || (f.escopo !== "PACIENTE" && f.tumorLotId !== ctx.tumorLotId)
        || !f.fontes.length || !data || !observacaoNoHorizonte(f.tempoClinico, hoje, Date.parse(agora)) || metadadosDoFatoImpedemUso(f.dados)
        || retrato?.integridade.some(i => i.eventoId === f.ref.eventId)
        || !["string", "number", "boolean"].includes(typeof valor)) return [];
      return [{ citacaoId: f.ref.eventId, tipoFonte: "FATO_CLINICO_CONFIRMADO" as const, referenciaId: f.fontes[0]!.sourceId,
        tituloOuDescricao: `${f.campo ?? f.tipo}: ${String(valor).slice(0, 350)}${String(valor).length > 2000 ? " · Excerto inicial; conferir original completo" : ""}`.slice(0, 500), dataFonte: data, consultadoEm: hoje,
        trechoSustentador: String(valor).slice(0, 2000), desfechosDocumentados: null }];
    });
    const resposta = (minuta: RespostaLaudoAcesso["minuta"] = null) => ({ status: 200, body: RespostaLaudoAcesso.parse({
      codigo: "LAUDO_ACESSO", contexto: ctx, baseHash: base.revisao, fontes,
      pendencias: [...base.pendencias, ...(!base.vigente ? ["Prescrição assinada não disponível neste encontro."] : []), ...(!fontes.length ? ["Confirme fatos com fonte e data antes de fundamentar o laudo."] : [])],
      historico: deps.db.prepare("SELECT minutaJson FROM f4_minuta_laudo_judicial WHERE patientId=? AND encounterId=? AND tumorLotId=? ORDER BY atualizadoEm DESC LIMIT 50")
        .all(ctx.patientId, ctx.encounterId, ctx.tumorLotId).map(row => MinutaLaudoAcessoJudicial.parse(JSON.parse(String(row.minutaJson)))),
      minuta, conteudoHash: minuta ? hash(minuta) : null,
    }) });
    if (pedido.acao === "BASE") return resposta();
    if (pedido.acao === "ABRIR") {
      const m = lerMinutaLaudoAcessoJudicialF4(deps.db, pedido.minutaId);
      if (!m || m.patientId !== ctx.patientId || m.encounterId !== ctx.encounterId || m.tumorLotId !== ctx.tumorLotId) return negar("LAUDO_FORA_CONTEXTO");
      return resposta(m);
    }
    if (!ctx.tumorLotId || !base.vigente || base.pendencias.length) return negar("BASE_LAUDO_PENDENTE");
    const acesso = { sessoes: deps.sessoes, token, agora };
    if (pedido.acao === "ASSINAR") {
      const minuta = lerMinutaLaudoAcessoJudicialF4(deps.db, pedido.minutaId), draft = lerDraft(deps.db, pedido.minutaId);
      const d = draft?.payload as { kind?: string; atorId?: string; baseHash?: string; conteudoHash?: string } | undefined;
      if (!minuta || !draft || draft.patientId !== ctx.patientId || minuta.patientId !== ctx.patientId || minuta.encounterId !== ctx.encounterId || minuta.tumorLotId !== ctx.tumorLotId
        || d?.kind !== "LAUDO_ACESSO_PREPARADO" || d.atorId !== sessao.medicoId) return negar("LAUDO_FORA_CONTEXTO");
      if (minuta.revisao === "ASSINADO" && d.conteudoHash === pedido.conteudoHash) return resposta(minuta);
      if (hash(minuta) !== pedido.conteudoHash || d.conteudoHash !== pedido.conteudoHash || d.baseHash !== base.revisao) return negar("LAUDO_ALTERADO_REVISAR_NOVAMENTE");
      const r = assinarMinutaLaudoAcessoJudicialF4(deps.db, acesso, { minutaId: minuta.minutaId, versao: minuta.versao });
      return r.ok ? resposta(r.minutaAssinada) : negar(r.codigo);
    }
    if (pedido.baseHash !== base.revisao) return negar("BASE_LAUDO_ALTERADA");
    if (new Set(pedido.citacoesIds).size !== pedido.citacoesIds.length || pedido.citacoesIds.some(id => !fontes.some(f => f.citacaoId === id))) return negar("FONTE_LAUDO_FORA_CONTEXTO");
    const id = `laudo-acesso:${hash([ctx, pedido.pedidoId])}`, anterior = lerDraft(deps.db, id);
    if (anterior) {
      const d = anterior.payload as { requestHash?: string };
      return d.requestHash === hash(pedido) ? resposta(lerMinutaLaudoAcessoJudicialF4(deps.db, id)) : negar("PEDIDO_LAUDO_DIVERGENTE");
    }
    // A referência assinada é resolvida no servidor; o cliente não pode inventar documento base.
    const ref = { documentId: base.vigente.documentId, documentVersion: base.vigente.documentVersion };
    const documento = eventos.find(e => e.tipo === "DOCUMENTO" && e.revisao === "ASSINADO" && e.patientId === ctx.patientId && e.encounterId === ctx.encounterId
      && e.tumorLotId === ctx.tumorLotId && (dadosDoEvento(e)?.data as Record<string, unknown> | undefined)?.documentId === ref.documentId);
    if (!documento) return negar("PRESCRICAO_ASSINADA_AUSENTE");
    const r = salvarMinutaLaudoAcessoJudicialF4(deps.db, acesso, { minutaId: id, patientId: ctx.patientId, encounterId: ctx.encounterId,
      tumorLotId: ctx.tumorLotId, prescricaoAssinadaRef: ref, medicamentoSolicitado: pedido.medicamento, indicacaoClinicaMedica: pedido.indicacao,
      registroRegulatorio: "NAO_VERIFICADO", coberturaPadrao: "NAO_VERIFICADO",
      chipEstoque: { estado: "DESCONHECIDO", origem: null, data: null, trava: false, sugereTroca: false, motivo: "Sem leitura de estoque vinculada" },
      citacoesVerificadas: fontes.filter(f => pedido.citacoesIds.includes(f.citacaoId)),
      afirmacoes: [{ afirmacaoId: "indicacao-medica", secao: "JUSTIFICATIVA_CLINICA", texto: pedido.indicacao, citacoesIds: pedido.citacoesIds }],
    });
    if (!r.ok) return negar(r.codigo);
    salvarDraft(deps.db, { draftId: id, patientId: ctx.patientId, sourceId: r.minuta.citacoesVerificadas[0]!.referenciaId,
      payload: { kind: "LAUDO_ACESSO_PREPARADO", atorId: sessao.medicoId, baseHash: base.revisao, conteudoHash: hash(r.minuta), requestHash: hash(pedido) },
      rawRef: id, revision: 0, criadoEm: agora, diagnostics: [] });
    return resposta(r.minuta);
  });
}
