import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Id, type Sessao } from "../../contracts/base.js";
import { Paciente } from "../../contracts/clinico.js";
import { lerConfiguracaoServico, NUMERO_CAIXA_RECEITUARIO_ESPECIAL } from "../../contracts/configServico.js";
import { PrescriptionItem, ProtocolTemplate } from "../../contracts/w10/prescricao.js";
import { proporPrescricao } from "../../kernel/comandos/index.js";
import { lerDraft, listarDrafts, listarEventos, salvarDraft } from "../../kernel/comandos/portas.js";
import { dataCivilDoServico } from "../../kernel/gateway/tempo.js";
import { dadosDoEvento, eventosVigentes } from "../../kernel/projections/snapshot.js";
import { aplicarAjuste } from "../../rules/prescricao/aplicarAjuste.js";
import { classificarDocumento } from "../../rules/prescricao/classificarDocumento.js";
import { instanciarProtocolo } from "../../rules/prescricao/instanciarProtocolo.js";
import { parserLinha } from "../../rules/prescricao/parserLinha.js";
import { rotearItemReceita } from "../../rules/prescricao/receituarioEspecial.js";
import { baseAjusteAnterior } from "../f0c/baseAjusteAnterior.js";
import { PlanoFlashEntrada, prepararFinalizacaoFlash, salvarRascunhoFlash } from "../flash.js";
import { obterInvestigacao } from "../investigacao.js";
import { lerConsulta } from "../leituras.js";
import { nomeMedicamento } from "../propostasDoseReceita.js";
import type { ServidorDeps } from "../rotas.js";
import { hashConteudoExibido } from "../sessao.js";
import { resolverEvolucaoFlash } from "../atendimentoV6.js";
import { contextoDraft, opcoesLeituraConsulta, revisaoDocumentosFlash, sha } from "./confirmacao.js";
import type { RespostaRota } from "./salaoCanal.js";

export function rotearPrescricaoFlashConfig(
  deps: ServidorDeps,
  token: string,
  sessao: Sessao,
  rota: string,
  raw: unknown,
): RespostaRota | null {
  const reply = (status: number, codigo: string, body: unknown = { codigo }): RespostaRota => ({ status, codigo, body });

  if (rota === "proporPrescricao") {
    const parsed = z.object({
      patientId: Id, encounterId: Id, tumorLotId: Id.nullable(), id: Id, operationId: Id,
      expectedRevision: z.number().int().nonnegative().nullable(), rascunhoOrigemId: Id.optional(),
      itens: z.array(PrescriptionItem).min(1),
    }).strict().safeParse(raw);
    if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
    const ctx = deps.sessoes.consultaSelecionada(token);
    if (!ctx || ctx.patientId !== parsed.data.patientId || ctx.encounterId !== parsed.data.encounterId
      || (ctx.tumorLotId ?? null) !== parsed.data.tumorLotId)
      return reply(409, "CONTEXTO_CONSULTA_ALTERADO");
    if (parsed.data.itens.some(i => i.source !== "MANUAL"))
      return reply(409, "PROPOSTA_MANUAL_EXIGE_ORIGEM_MANUAL");
    const contextoProposta = { ...ctx, tumorLotId: ctx.tumorLotId ?? null };
    const r = deps.motorF1?.retrato(contextoProposta);
    if (!r) return reply(409, "RETRATO_INDISPONIVEL");
    let origem: { templateId: string; templateVersao: string; templateHash: string; rascunhoOrigemId: string } | null = null;
    if (parsed.data.rascunhoOrigemId) {
      const draft = lerDraft(deps.db, parsed.data.rascunhoOrigemId), ctxOrigem = contextoDraft(draft?.payload);
      const payload = draft?.payload as {
        kind?: unknown; template?: unknown; revisaoFatos?: string | null; contexto?: { patientId?: string };
        instanciacao?: { ok?: boolean; pendentes?: number; itens?: { estado: string; item: unknown; doseAnteriorPrescrita?: number | null }[] };
      } | undefined;
      if (!draft || draft.patientId !== ctx.patientId || !ctxOrigem || payload?.contexto?.patientId !== ctx.patientId
        || ctxOrigem.encounterId !== ctx.encounterId || ctxOrigem.tumorLotId !== (ctx.tumorLotId ?? null)
        || payload?.kind !== "PRESCRICAO_RASCUNHO" || payload.instanciacao?.ok !== true)
        return reply(409, "ORIGEM_TEMPLATE_INVALIDA");
      const t = ProtocolTemplate.safeParse(payload.template);
      if (!t.success || t.data.status !== "CONFERIDA_MEDICO") return reply(409, "ORIGEM_TEMPLATE_INVALIDA");
      if (payload.revisaoFatos !== r.revisao) return reply(409, "ORIGEM_TEMPLATE_CONTEXTO_DESATUALIZADO");
      const candidatos = deps.corpus?.templatesProtocolo.filter(x => x.templateId === t.data.templateId && x.versao === t.data.versao && x.hash === t.data.hash) ?? [];
      if (candidatos.length !== 1 || hashConteudoExibido(candidatos[0]) !== hashConteudoExibido(t.data))
        return reply(409, "ORIGEM_TEMPLATE_DIVERGENTE");
      if (payload.instanciacao.pendentes !== 0 || payload.instanciacao.itens?.length !== t.data.itens.length
        || payload.instanciacao.itens.some(i => i.estado !== "PRONTO"))
        return reply(409, "ORIGEM_TEMPLATE_PENDENTE");
      const prontos = payload.instanciacao.itens;
      const originais = prontos.map(i => PrescriptionItem.safeParse(i.item));
      if (originais.length !== parsed.data.itens.length || originais.some(i => !i.success))
        return reply(409, "ORIGEM_TEMPLATE_ITENS_DIVERGENTES");
      const parteFixa = (item: PrescriptionItem) => {
        const { source, overrideMotivo, prescribedDose, adjustmentPercent, adjustmentReason, ...fixa } = item;
        return fixa;
      };
      for (const [indice, item] of parsed.data.itens.entries()) {
        const original = originais[indice]!;
        if (!original.success || hashConteudoExibido(parteFixa(item)) !== hashConteudoExibido(parteFixa(original.data)))
          return reply(409, "ORIGEM_TEMPLATE_ITENS_DIVERGENTES");
        const ajuste = item.adjustmentPercent === null ? null
          : aplicarAjuste(original.data, item.adjustmentPercent, item.adjustmentReason ?? "", { doseBase: prontos[indice]!.doseAnteriorPrescrita ?? null });
        if (ajuste && !ajuste.ok) return reply(409, "ORIGEM_TEMPLATE_ITENS_DIVERGENTES");
        const doseEsperada = ajuste?.ok ? ajuste.item.prescribedDose : original.data.prescribedDose;
        if (item.prescribedDose !== doseEsperada) return reply(409, "ORIGEM_TEMPLATE_ITENS_DIVERGENTES");
      }
      origem = { templateId: t.data.templateId, templateVersao: t.data.versao, templateHash: t.data.hash, rascunhoOrigemId: draft.draftId };
    }
    const revisao = sha(JSON.stringify([r.revisao, parsed.data.itens, ...(origem ? [origem] : [])]));
    const salvo = proporPrescricao(deps.db, {
      schema: "PrescricaoProposta@1", id: parsed.data.id, revisao,
      correlacao: {
        ...contextoProposta, operationId: parsed.data.operationId, revisaoFatos: r.revisao,
        regras: r.regras, biblioteca: r.biblioteca, proposta: { id: parsed.data.id, revisao },
      },
      templateId: null, templateVersao: null, ...(origem ?? {}), itens: parsed.data.itens, estado: "DRAFT",
    }, sessao, deps.agora(), parsed.data.expectedRevision);
    return reply(201, "PROPOSTA_SALVA", { draftId: salvo.draftId, revision: salvo.revision, revisao, assina: false, exporta: false });
  }

  if (rota === "rascunhoPrescricao") {
    const parsed = z.object({
      patientId: Id, encounterId: Id, tumorLotId: Id.nullable(),
      templateId: z.string().min(1).optional(), expression: z.string().min(1).max(5000).optional(),
    }).strict().refine((x) => Number(!!x.templateId) + Number(!!x.expression) === 1).safeParse(raw);
    if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
    const contexto = deps.sessoes.consultaSelecionada(token);
    if (!contexto) return reply(409, "CONTEXTO_CONSULTA_NAO_SELECIONADO");
    if (contexto.patientId !== parsed.data.patientId || contexto.encounterId !== parsed.data.encounterId
      || (contexto.tumorLotId ?? null) !== parsed.data.tumorLotId)
      return reply(409, "CONTEXTO_CONSULTA_ALTERADO");
    const hoje = dataCivilDoServico(deps.agora(), "-03:00");
    if (parsed.data.templateId) {
      const candidatas=deps.corpus?.templatesProtocolo.filter(t=>t.templateId===parsed.data.templateId)??[];
      if(candidatas.length>1)return reply(409,'TEMPLATE_AMBIGUO');
      const template = candidatas[0];
      if (!template) return reply(404, "TEMPLATE_NAO_ENCONTRADO");
      const consultaCorporal = lerConsulta(deps.db, contexto.patientId, deps.agora(), sessao, contexto.tumorLotId, { ...opcoesLeituraConsulta(deps,sessao),encounterId: contexto.encounterId });
      const dadosCorporais = "codigo" in consultaCorporal
        ? { pesoKg: null, alturaCm: null, bsaM2: null, clcr: null, medidoEm: null }
        : consultaCorporal.avaliacaoClinica.dadosCorporais;
      const { itens: basesAnteriores, ...provenienciaBaseAnterior } = baseAjusteAnterior(
        listarEventos(deps.db, contexto.patientId), contexto, template, deps.agora(),
      );
      const instanciacao = hoje.estado === "OK"
        ? instanciarProtocolo(template, dadosCorporais, basesAnteriores)
        : { ok: false as const, recusa: { codigo: "DADOS_CORPORAIS_PENDENTES", motivo: hoje.codigo } };
      const seguranca = {
        resultado: "NOT_EVALUABLE" as const,
        motivos: [{
          codigo: "REQUISITOS_DE_SEGURANCA_NAO_DISPONIVEIS",
          texto: "requisitos de segurança e medidas de paciente ainda não foram validados para esta ficha",
          fonte: template.fonte,
        }],
      };
      const saved = salvarDraft(deps.db, {
        draftId: randomUUID(), patientId: contexto.patientId,
        sourceId: "selecao-local-de-prescricao", rawRef: "proposta-prescricao-local",
        payload: {
          kind: "PRESCRICAO_RASCUNHO", contexto, template, instanciacao, seguranca,
          revisaoFatos: deps.motorF1?.retrato({ ...contexto, tumorLotId: contexto.tumorLotId ?? null }).revisao ?? null,
          baseAjusteAnterior: provenienciaBaseAnterior,
          status: "RASCUNHO", assinada: false,
        },
        diagnostics: [
          template.status === "RASCUNHO" ? "TEMPLATE_NAO_CONFERIDO" : "REVISAO_MEDICA_OBRIGATORIA",
          "SEGURANCA_NAO_AVALIAVEL",
        ],
        revision: 0, criadoEm: deps.agora(),
      });
      return reply(201, "PRESCRICAO_RASCUNHO_SALVA", {
        draftId: saved.draftId,
        instanciacao, classificacao: template.itens.map((item) => classificarDocumento(item.drug, deps.corpus?.regulatorio ?? null)),
        seguranca, assina: false, exporta: false,
      });
    }
    const quickLine = parserLinha(parsed.data.expression!);
    const classificacao = classificarDocumento(quickLine.parsed.drug ?? "", deps.corpus?.regulatorio ?? null);
    let configuracaoReceituario = lerConfiguracaoServico(null);
    try { configuracaoReceituario = lerConfiguracaoServico(deps.settings?.readBox(NUMERO_CAIXA_RECEITUARIO_ESPECIAL, sessao).value); }
    catch { /* Recurso do serviço não comprovado: permanece falso. */ }
    const receituario = rotearItemReceita(
      { id: "linha-manual", medicamento: quickLine.parsed.drug ?? "" },
      configuracaoReceituario, deps.corpus?.controlados ?? [],
    );
    const seguranca = {
      resultado: "NOT_EVALUABLE" as const,
      motivos: [{
        codigo: "SEM_ITEM_E_REQUISITO_TIPADO",
        texto: "linha em rascunho sem item validado e sem requisitos de segurança declarados",
        fonte: "prescricao local: fonte/manual",
      }],
    };
    const saved = salvarDraft(deps.db, {
      draftId: randomUUID(), patientId: contexto.patientId,
      sourceId: "linha-manual-de-prescricao", rawRef: "proposta-prescricao-local",
      payload: {
        kind: "PRESCRICAO_RASCUNHO", contexto, quickLine, classificacao, seguranca, receituario,
        status: "RASCUNHO", assinada: false,
      },
      diagnostics: [
        ...quickLine.pendencias,
        ...(classificacao.estado === "PENDENTE" ? ["CLASSIFICACAO_DOCUMENTAL_PENDENTE"] : []),
        "SEGURANCA_NAO_AVALIAVEL", "REVISAO_MEDICA_OBRIGATORIA",
      ],
      revision: 0, criadoEm: deps.agora(),
    });
    return reply(201, "PRESCRICAO_RASCUNHO_SALVA", {
      draftId: saved.draftId, quickLine,
      classificacao, seguranca, receituario, assina: false, exporta: false,
    });
  }

  if (rota === "rascunhoFlash" || rota === "prepararFlash") {
    const base = { patientId: Id, encounterId: Id, tumorLotId: Id.nullable(), plano: PlanoFlashEntrada };
    const parsed = rota === "rascunhoFlash"
      ? z.object({ ...base, expectedRevision: z.number().int().nonnegative().nullable() }).strict().safeParse(raw)
      : z.object({ ...base, idempotencyKey: z.string().min(8) }).strict().safeParse(raw);
    if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
    const contexto = deps.sessoes.consultaSelecionada(token);
    if (!contexto) return reply(409, "CONTEXTO_CONSULTA_NAO_SELECIONADO");
    if (contexto.patientId !== parsed.data.patientId || contexto.encounterId !== parsed.data.encounterId
      || (contexto.tumorLotId ?? null) !== parsed.data.tumorLotId)
      return reply(409, "CONTEXTO_CONSULTA_ALTERADO");
    const consultaRevisada = lerConsulta(deps.db, parsed.data.patientId, deps.agora(), sessao, parsed.data.tumorLotId,
      { ...opcoesLeituraConsulta(deps, sessao), encounterId: parsed.data.encounterId });
    if ("codigo" in consultaRevisada) return reply(409, consultaRevisada.codigo);
    // Rascunho não prepara documentos nem varre suas fontes/histórico de assinatura.
    if ("expectedRevision" in parsed.data) {
      const result = salvarRascunhoFlash(deps.db, deps.agora(), parsed.data);
      return reply(result.status, String(result.body.codigo), result.body);
    }
    const resumoClinico = consultaRevisada.resumoConfirmadoParaDocumento;
    const contextoS9 = { patientId: parsed.data.patientId, encounterId: parsed.data.encounterId, tumorLotId: parsed.data.tumorLotId };
    const resumoRef = `resumo-revisado:${hashConteudoExibido(resumoClinico)}`;
    if ("idempotencyKey" in parsed.data) {
      const eventosAssinados = listarEventos(deps.db, parsed.data.patientId).filter(e => e.tipo === "DOCUMENTO" && e.revisao === "ASSINADO");
      const finalizada = listarDrafts(deps.db, parsed.data.patientId).some(d => {
        if (d.revision === 0 || !d.payload || typeof d.payload !== "object") return false;
        const p = d.payload as Record<string, unknown>, meta = p.preparacaoS9;
        if (!meta || typeof meta !== "object" || !("revisao" in meta) || typeof meta.revisao !== "string" || !Array.isArray(p.fontes)) return false;
        const anterior = hashConteudoExibido({ contexto: contextoS9, plano: parsed.data!.plano, revisao: meta.revisao });
        return p.fontes.some(f => f && typeof f === "object" && "contentHash" in f && f.contentHash === anterior
          && "localizador" in f && (f.localizador === resumoRef || f.localizador === null))
          && eventosAssinados.some(e => e.payload && typeof e.payload === "object" && "data" in e.payload
            && e.payload.data && typeof e.payload.data === "object" && "data" in e.payload.data
            && e.payload.data.data && typeof e.payload.data.data === "object" && "documentId" in e.payload.data.data
            && e.payload.data.data.documentId === p.documentId);
      });
      if (finalizada) return reply(409, "FLASH_JA_FINALIZADA");
    }
    const evolucaoAtendimento = parsed.data.plano.evolucaoAtendimento
      ? resolverEvolucaoFlash(deps, token, contextoS9, parsed.data.plano.evolucaoAtendimento) : null;
    if (parsed.data.plano.evolucaoAtendimento && !evolucaoAtendimento) return reply(409, "EVOLUCAO_ALTERADA_OU_PENDENTE");
    const indicacoesInvestigacao: Record<string, string> = {};
    if (rota === "prepararFlash" && parsed.data.plano.propostasInvestigacao?.length) {
      const atual = obterInvestigacao(deps, contextoS9);
      for (const escolhida of parsed.data.plano.propostasInvestigacao) {
        const candidatas = atual.resultado?.propostas.filter(p => p.exameCodigo === escolhida.exameCodigo && p.contexto === escolhida.contexto
          && p.regras.some(ref => hashConteudoExibido(ref) === hashConteudoExibido(escolhida.referencia))) ?? [];
        const proposta = candidatas.length === 1 ? candidatas[0] : null;
        if (atual.revisao !== escolhida.revisaoFatos || !proposta || !["LABORATORIO", "IMAGEM"].includes(proposta.categoria ?? ""))
          return reply(409, "INVESTIGACAO_ALTERADA_REPREPARAR");
        const itens: readonly string[] | undefined = proposta.categoria === "IMAGEM" ? parsed.data.plano.solicitacoes?.imagem : parsed.data.plano.solicitacoes?.laboratorio;
        if (!itens?.includes(proposta.exameCodigo)) return reply(409, "PROPOSTA_FORA_DO_PEDIDO");
        const chave = `${proposta.categoria}|${proposta.exameCodigo}`;
        if (indicacoesInvestigacao[chave]) return reply(409, "PROPOSTA_INVESTIGACAO_DUPLICADA");
        indicacoesInvestigacao[chave] = `${proposta.justificativa} Referência: ${escolhida.referencia.id} v${escolhida.referencia.versao}.`;
      }
    }
    const revisaoS9 = revisaoDocumentosFlash(deps, contextoS9, sessao, consultaRevisada);
    const civilS9 = dataCivilDoServico(deps.agora(), "-03:00");
    if (civilS9.estado !== "OK") return reply(409, civilS9.codigo);
    const hashDecisao = hashConteudoExibido({ contexto: contextoS9, plano: parsed.data.plano, revisao: revisaoS9 });
    const sourceIdS9 = `flash-decisao:${hashDecisao}`;
    const capturadoEm = listarDrafts(deps.db, parsed.data.patientId).flatMap(d => {
      const fs = d.payload && typeof d.payload === "object" ? (d.payload as Record<string, unknown>).fontes : undefined;
      return Array.isArray(fs) ? fs.flatMap(f => f && typeof f === "object" && (f as Record<string, unknown>).sourceId === sourceIdS9
        && typeof (f as Record<string, unknown>).dataCaptura === "string" ? [(f as Record<string, unknown>).dataCaptura as string] : []) : [];
    }).sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? deps.agora();
    const cadastros = eventosVigentes(listarEventos(deps.db, parsed.data.patientId).filter(e => Date.parse(e.criadoEm) <= Date.parse(deps.agora())))
      .filter(e => ["Paciente", "Paciente@1"].includes(e.tipo) && ["CONFIRMADO", "ASSINADO"].includes(e.revisao)).flatMap(e => {
        const p = Paciente.safeParse(dadosDoEvento(e));
        return p.success && p.data.patientId === parsed.data.patientId
          ? [{ patientId: p.data.patientId, nome: p.data.nome, cadastroEventId: e.eventId }] : [];
      });
    if ("idempotencyKey" in parsed.data && cadastros.length !== 1)
      return reply(409, cadastros.length ? "IDENTIDADE_PACIENTE_AMBIGUA" : "IDENTIDADE_PACIENTE_AUSENTE");
    const identidadePaciente = cadastros[0];
    const propostasDose = [];
    for (const ref of parsed.data.plano.propostasDoseReceita ?? []) {
      if ("expectedRevision" in parsed.data || !parsed.data.plano.receitasMarcadas.includes(ref.receitaId)) continue;
      const receita = parsed.data.plano.receitas?.find(r => r.id === ref.receitaId);
      const candidato = deps.corpus?.propostasDoseReceita?.find(p => p.id === ref.propostaId && p.fonte.hash === ref.hashFonte && p.hashProposta === ref.hashProposta);
      if (!receita || !candidato || nomeMedicamento(receita.medicamento) !== nomeMedicamento(candidato.medicamento))
        return reply(409, "PROPOSTA_DOSE_DESATUALIZADA");
      if (parsed.data.plano.receitasMarcadas.includes(ref.receitaId)) propostasDose.push(candidato);
    }
    const fonteS9 = {
      ...(evolucaoAtendimento ? { evolucaoAtendimento } : {}),
      propostasDoseReceita: propostasDose,
      ...(Object.keys(indicacoesInvestigacao).length ? { indicacoesInvestigacao } : {}),
      ...(identidadePaciente ? { identidadePaciente } : {}),
      identidadeResponsavel: { medicoId: sessao.medicoId, crm: sessao.crm },
      medicamentos: parsed.data.plano.receitas ?? [],
      fonte: {
        sourceId: sourceIdS9, classe: "MANUAL" as const, localizador: resumoRef,
        dataClinica: civilS9.dataCivil, dataCaptura: capturadoEm, versao: "s9-flash@1", contentHash: hashDecisao,
      },
      dataReferencia: civilS9.dataCivil, revisao: revisaoS9,
    };
    const result = prepararFinalizacaoFlash(
        deps.db, deps.agora(), parsed.data, resumoClinico,
        consultaRevisada.cabecalho.episodio && consultaRevisada.cabecalho.ciclo
          ? {
            protocolo: consultaRevisada.cabecalho.episodio.esquemaId,
            ciclo: consultaRevisada.cabecalho.ciclo.numero,
            ciclosPrevistos: consultaRevisada.flash.ciclosPrevistos ?? null,
          } : null,
        fonteS9,
      );
    return reply(result.status, String(result.body.codigo), result.body);
  }

  return null;
}
