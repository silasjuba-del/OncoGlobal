import { executarConfirmacao } from "../kernel/comandos/index.js";
import { PedidoResultadoExame, ResultadosPedidosResposta } from "../contracts/api/resultadosPedidos.js";
import { Tarefa, type AcompanhamentoPedido } from "../contracts/f1/tarefa.js";
import { Sessao, type Fonte } from "../contracts/base.js";
import { atualizarResultadoPedido } from "../modules/agenda/tarefas.js";
import { hashCanonico } from "../modules/hash.js";
import { listarEventos, salvarDraft, transacao, depoisDoCommit } from "../kernel/comandos/portas.js";
import { eventosVigentes, dadosDoEvento } from "../kernel/projections/snapshot.js";
import { provarDocumentoAssinado } from "../kernel/ledger/provaDocumento.js";
import { dataCivilDoServico } from "../rules/tempoServico.js";
import { encontroNoHistorico, fontesPaciente } from "./fontesPaciente.js";
import type { DepsDutos } from "./dutos.js";

export function operarResultadosPedidos(deps: DepsDutos, token: string, raw: unknown, resolvida: Sessao) {
  const negar = (codigo: string, status = 409) => ({ status, body: { codigo } });
  const p = PedidoResultadoExame.safeParse(raw); if (!p.success) return negar("PEDIDO_RESULTADO_INVALIDO", 400);
  const em = deps.agora(), s = deps.sessoes.obter(token), ctx = p.data.contexto;
  const selecionada = deps.sessoes.consultaSelecionada(token);
  if (!s || hashCanonico(s) !== hashCanonico(resolvida) || Date.parse(s.expiraEm) <= Date.parse(em)) return negar("SESSAO_INVALIDA", 401);
  if (!selecionada || selecionada.patientId !== ctx.patientId || selecionada.encounterId !== ctx.encounterId || (selecionada.tumorLotId ?? null) !== ctx.tumorLotId) return negar("CONTEXTO_CONSULTA_ALTERADO");
  return transacao(deps.db, () => {
    const eventos = listarEventos(deps.db, ctx.patientId).filter(e => e.patientId === ctx.patientId && Date.parse(e.criadoEm) <= Date.parse(em));
    const vigentes = eventosVigentes(eventos.filter(e => {
      if (e.tipo !== "Tarefa") return true;
      const t = Tarefa.safeParse(dadosDoEvento(e));
      return t.success && encontroNoHistorico(eventos, { ...t.data, encounterId: t.data.atualizadoNoEncontroId ?? t.data.encounterId }, ctx);
    }));
    const fontesDoPaciente = fontesPaciente(deps.db, eventos, ctx, true).map(({ draft, fonte, texto }) => ({
      draftId: draft.draftId, revision: draft.revision, sourceId: draft.sourceId, hash: fonte.patientLinkReview.sourceHash,
      encounterId: fonte.patientLinkReview.encounterId, texto, registradoEm: draft.criadoEm,
    }));
    const tarefas = vigentes.filter(e => e.tipo === "Tarefa" && ["CONFIRMADO", "ASSINADO"].includes(e.revisao)).flatMap(e => {
      const t = Tarefa.safeParse(dadosDoEvento(e));
      if (!t.success || e.patientId !== t.data.patientId || e.encounterId !== t.data.encounterId || e.tumorLotId !== t.data.tumorLotId
        || !encontroNoHistorico(eventos, t.data, ctx) || ["RASCUNHO", "CANCELADA", "SUPERSEDED"].includes(t.data.estado)) return [];
      const pedidos = t.data.pedidoRefs.flatMap(ref => {
        const ds = vigentes.filter(d => d.tipo === "DOCUMENTO" && d.patientId === ctx.patientId && d.encounterId === t.data.encounterId && d.tumorLotId === ctx.tumorLotId)
          .flatMap(d => { const prova = provarDocumentoAssinado(d); return prova && prova.corpo.documentId === ref.documentId && prova.corpo.documentVersion === ref.documentVersion
            ? [{ ...ref, titulo: typeof prova.corpo.titulo === "string" ? prova.corpo.titulo : "Pedido de exame", texto: prova.corpo.texto, assinadoEm: d.criadoEm }] : []; });
        return ds.length === 1 ? ds : [];
      });
      return t.data.pedidoRefs.length ? [{ eventId: e.eventId, tarefa: t.data, pedidos }] : [];
    });
    // Fontes históricas só são expostas aqui se já estiverem vinculadas a um pedido.
    const fontes = fontesDoPaciente.filter(f => f.encounterId === ctx.encounterId || tarefas.some(t =>
      t.tarefa.acompanhamentoPedidos.some(a => a.resultado?.draftId === f.draftId && a.resultado.sourceId === f.sourceId
        && a.resultado.revision === f.revision && a.resultado.hash === f.hash && a.resultado.encounterId === f.encounterId)));
    const resposta = () => {
      const provas = tarefas.map(t => ({ id:t.eventId, hash:hashCanonico(t) }));
      depoisDoCommit(deps.db, () => {
        for (const t of provas) deps.sessoes.registrarConteudoExibido?.(token, ctx, "RESULTADO_PEDIDO", t.id, t.hash);
        for (const f of fontes) deps.sessoes.registrarConteudoExibido?.(token, ctx, "RESULTADO_FONTE", f.draftId, f.hash);
      });
      return { status: 200, body: ResultadosPedidosResposta.parse({ codigo: "RESULTADOS_PEDIDOS", contexto: ctx, tarefas, fontes }) };
    };
    if (p.data.acao === "LISTAR") return resposta();
    const pedido = p.data, operationId = `resultado-pedido:${pedido.operationId}`, requestHash = hashCanonico(pedido);
    const replay = eventos.filter(e => e.operationId === operationId && e.tipo === "Tarefa");
    if (replay.length) return replay.length === 1 && replay[0]!.fontes.some(f => f.contentHash === requestHash) && replay[0]!.criadoPor.id === s.medicoId
      ? resposta() : negar("OPERACAO_RESULTADO_DIVERGENTE");
    const alvo = tarefas.find(t => t.tarefa.tarefaId === pedido.tarefaId);
    if (!alvo || alvo.eventId !== pedido.expectedEventId) return negar("TAREFA_ALTERADA_OU_FORA_CONTEXTO");
    const ref = alvo.pedidos.find(d => d.documentId === pedido.pedido.documentId && d.documentVersion === pedido.pedido.documentVersion);
    if (!ref) return negar("PEDIDO_ASSINADO_NAO_ENCONTRADO");
    if (deps.sessoes.conteudoFoiExibido && !deps.sessoes.conteudoFoiExibido(token, ctx, "RESULTADO_PEDIDO", alvo.eventId, hashCanonico(alvo))) return negar("TAREFA_NAO_EXIBIDA");
    const anterior = alvo.tarefa.acompanhamentoPedidos.find(r => r.pedido.documentId === ref.documentId && r.pedido.documentVersion === ref.documentVersion);
    const proximo: AcompanhamentoPedido = { pedido: pedido.pedido, estado: pedido.acao, realizadoEm: anterior?.realizadoEm ?? null,
      resultado: anterior?.resultado ?? null, disponivelEm: anterior?.disponivelEm ?? null, revisadoEm: null, revisadoPor: null };
    if (pedido.acao === "REALIZADO") {
      const hoje = dataCivilDoServico(em); if (hoje.estado !== "OK" || pedido.realizadoEm > hoje.dataCivil) return negar("REALIZACAO_FUTURA");
      proximo.realizadoEm = pedido.realizadoEm;
    } else {
      const referencia = pedido.acao === "RESULTADO_DISPONIVEL" ? pedido.fonte : anterior?.resultado;
      const fonte = fontes.find(f => f.draftId === referencia?.draftId && f.sourceId === referencia.sourceId && f.hash === referencia.hash && f.revision === referencia.revision && f.encounterId === referencia.encounterId);
      const historicoRevisavel = pedido.acao === "REVISADO" && referencia
        && encontroNoHistorico(eventos, { ...ctx, encounterId: referencia.encounterId }, ctx);
      if (!fonte || !referencia || (referencia.encounterId !== ctx.encounterId && !historicoRevisavel)) return negar("RESULTADO_FORA_CONTEXTO_OU_ALTERADO");
      if (pedido.acao === "RESULTADO_DISPONIVEL") { proximo.resultado = pedido.fonte; proximo.disponivelEm = em; }
      else {
        if (pedido.expectedFonteHash !== fonte.hash) return negar("RESULTADO_ALTERADO");
        if (deps.sessoes.conteudoFoiExibido && !deps.sessoes.conteudoFoiExibido(token, ctx, "RESULTADO_FONTE", fonte.draftId, fonte.hash)) return negar("RESULTADO_NAO_EXIBIDO");
        proximo.revisadoEm = em; proximo.revisadoPor = s.medicoId;
      }
    }
    const r = atualizarResultadoPedido(alvo.tarefa, { ...ctx, atorId: s.medicoId, em }, proximo);
    if (!r.ok) return negar(r.codigo);
    const id = `resultado-pedido:${hashCanonico([ctx, pedido.operationId])}`;
    const fonte: Fonte = { sourceId: id, classe: "MANUAL", localizador: "Vínculo documental pedido–resultado; não confirma valores clínicos", dataClinica: proximo.realizadoEm,
      dataCaptura: em, versao: "1", contentHash: requestHash };
    const contextoPedido = { patientId: alvo.tarefa.patientId, encounterId: alvo.tarefa.encounterId, tumorLotId: alvo.tarefa.tumorLotId };
    salvarDraft(deps.db, { draftId: id, patientId: ctx.patientId, sourceId: id, rawRef: id, revision: 0, criadoEm: em, payload: { contexto: contextoPedido }, diagnostics: [] });
    const gravado = executarConfirmacao(deps.db, { ...contextoPedido, operationId, reviewDecisionId: `revisao:${id}`, sessao: s, em,
      registros: [{ draftId: id, expectedRevision: 0, eventId: id, tipo: "Tarefa", payload: r.tarefa, fontes: [fonte], revisao: "CONFIRMADO", supersedesEventId: alvo.eventId }] });
    if (gravado.estado === "NEGADA") throw Error("RESULTADO_GRAVACAO_NEGADA");
    alvo.eventId = id; alvo.tarefa = r.tarefa;
    return resposta();
  });
}
