import { z } from "zod";
import { ClinicalFact, EncounterSegment } from "../contracts/w10/extracao.js";
import { MetodoCapturaTranscricao } from "../contracts/capturaTranscricao.js";
import { PedidoSkillClinica, ExecucaoSkill, DocumentoSkill, ContextoSkill, TipoDocumentoSkill, ResultadoSkillClinica, SkillClinicaId } from "../contracts/skillsClinicas.js";
import type { ResultadoJornada } from "../contracts/jornadaClinica.js";
import { lerDraft, listarDrafts, listarEventos, salvarDraft, transacao } from "../kernel/comandos/portas.js";
import { dadosDoEvento } from "../kernel/projections/snapshot.js";
import { executarPipelineExtracao } from "../kernel/extracao/pipeline.js";
import { prepararJornadaClinica } from "../modules/documentos/jornadaClinica.js";
import { detectarEmergencias } from "../rules/radsEmergencias.js";
import { hashCanonico } from "../modules/hash.js";
import { lerPaciente, lerConsulta } from "./leituras.js";
import type { ServidorDeps } from "./rotas.js";

const Fonte = z.object({ kind: z.literal("EXTRACAO_RASCUNHO"),
  input: z.object({ recordingId: z.string(), sourceId: z.string(), sourceType: ClinicalFact.shape.sourceType,
    captureMethod: MetodoCapturaTranscricao.optional(), rawTranscript: z.string().min(1) }),
  state: z.object({ segments: z.array(EncounterSegment) }),
  patientLinkReview: ContextoSkill.extend({ segmentId: z.string(), sourceId: z.string(), sourceHash: z.string(),
    reviewDecisionId: z.string(), exceptionId: z.string(), medicoId: z.string() }).strip(),
});
class RecusaSkill extends Error { constructor(readonly codigo: string, readonly status = 409) { super(codigo); } }
const mesmo = (a: z.infer<typeof ContextoSkill>, b: z.infer<typeof ContextoSkill>) => hashCanonico(a) === hashCanonico(b);
const contextoDe = (v: z.infer<typeof ContextoSkill>) => ContextoSkill.parse({ patientId: v.patientId, encounterId: v.encounterId, tumorLotId: v.tumorLotId });
function valorClinico(texto: string): string {
  try {
    const v: unknown = JSON.parse(texto);
    if (v === null) return "não informado";
    if (["string","number","boolean"].includes(typeof v)) return String(v);
    if (Array.isArray(v) && v.every(x=>typeof x === "string" || typeof x === "number")) return v.join(", ");
    return "registro estruturado alterado; conferir o original";
  } catch { return texto; }
}

export function operarSkillsClinicas(raw: unknown, token: string, deps: ServidorDeps): { status: number; body: unknown } {
  const ok = (body: unknown) => ({ status: 200, body: ResultadoSkillClinica.parse(body) });
  try {
    const sessao = deps.sessoes.obter(token);
    if (!sessao) throw new RecusaSkill("SESSAO_EXPIRADA", 401);
    const parsed = PedidoSkillClinica.safeParse(raw);
    if (!parsed.success) throw new RecusaSkill("PEDIDO_SKILL_INVALIDO", 400);
    const p = parsed.data;
    if (p.acao === "CATALOGO") return ok({ codigo: "SKILLS_DISPONIVEIS", pacotesExternos: "ADAPTADOR_DE_ADMISSAO_NAO_CONFIGURADO",
      corpus: deps.corpus?.jornadaPulmao ?? null,
      skills: SkillClinicaId.options.map(id=>({id, versao:"1.0.0", titulo: id === "primeira-consulta" ? "Primeira consulta — kit, resumo e rascunhos" : id === "retorno" ? "Retorno — resultados, tratamento e segurança" : "Seguimento — exames e encaminhamentos",
        origem:"NATIVA_DO_APP",documentos:TipoDocumentoSkill.options})) });
    const contexto = p.contexto;
    const atual = deps.sessoes.consultaSelecionada(token);
    if (!atual || !mesmo({ ...atual, tumorLotId: atual.tumorLotId ?? null }, p.contexto)) throw new RecusaSkill("CONTEXTO_CONSULTA_ALTERADO");
    const paciente = lerPaciente(deps.db, p.contexto.patientId);
    if (!paciente) throw new RecusaSkill("PACIENTE_NAO_ENCONTRADO");
    const corpus = deps.corpus?.jornadaPulmao ?? null;
    // A política de segurança também faz parte da entrada: uma regra RADS nova
    // precisa invalidar o rascunho antigo mesmo se o paciente e o texto não mudaram.
    const corpusHash = hashCanonico({ conhecimento:corpus, rads:deps.corpus?.rads ?? null,
      feve:deps.corpus?.feveRuleset ?? null, salao:deps.salaoRuleset ?? null,
      interacoes:deps.corpus?.interacoes ?? null, catalogo:deps.corpus?.catalogoInteracoes ?? null,
      tetos:deps.corpus?.tetosCumulativos ?? null });
    const ledgerHash = () => hashCanonico(listarEventos(deps.db, contexto.patientId));
    const avaliacaoAtual = () => {
      const c = lerConsulta(deps.db, contexto.patientId, deps.agora(), sessao, contexto.tumorLotId,
        {encounterId:contexto.encounterId, salaoRuleset:deps.salaoRuleset,
          ...(deps.corpus ? {interacoes:deps.corpus.interacoes,catalogo:deps.corpus.catalogoInteracoes,
            feveRuleset:deps.corpus.feveRuleset,limiarPlaquetas:deps.corpus.limiarPlaquetas,
            tetosCumulativos:deps.corpus.tetosCumulativos,templates:deps.corpus.templatesProtocolo} : {})});
      if (!("avaliacaoClinica" in c) || !c.avaliacaoClinica || !c.elegibilidade || !c.delta || !c.historicoTratamento)
        return {seguranca:["AVALIAÇÃO CLÍNICA INDISPONÍVEL"],mudancas:[] as string[],historico:[] as string[],urgente:false};
      const renal = c.avaliacaoClinica.renal;
      return {seguranca:[...c.elegibilidade.motivos.map(m=>m.texto),
        `Função renal: ${renal.estado}; Cockcroft peso real ${renal.clcrMlMin ?? "PENDENTE"}; peso ajustado ${renal.clcrPesoAjustadoMlMin ?? "não disponível"}. ${renal.aviso ?? ""}`],
        mudancas:c.delta.itens.filter(d=>!/auditor|reconcil|indice|hash/i.test(d.rotulo))
          .map(d=>`${d.rotulo}: ${d.candidatos.map(v=>`${v.rotulo}: ${valorClinico(v.valorTexto)}`).join(" → ")}`),
        historico:[...(c.resumoConfirmadoParaDocumento ? [`Resumo previamente revisado: ${c.resumoConfirmadoParaDocumento}`] : []),
          ...c.historicoTratamento.linhas.map(l=>`${l.data ?? l.periodo?.inicio ?? "data não informada"}: ${l.tipo}; ${l.protocoloOuTipo ?? l.topografia ?? "descrição pendente"}${l.ciclo===null?"":`; ciclo ${l.ciclo}`}; ${l.estado}. ${l.observacao}`),
          ...(c.flash.ultimoAdministrado ? [`Último administrado: ${c.flash.ultimoAdministrado}`] : [])],urgente:c.avaliacaoClinica.emergencia};
    };
    if (p.acao === "FONTES") return ok({codigo:"SKILL_FONTES",fontes:listarDrafts(deps.db,contexto.patientId).flatMap(d=>{
      const f=Fonte.safeParse(d.payload);
      return f.success && mesmo(contextoDe(f.data.patientLinkReview),contexto)
        ? [{draftId:d.draftId,revision:d.revision,sourceId:d.sourceId}] : [];
    })});
    if (p.acao === "HISTORICO") {
      const registros = listarDrafts(deps.db, p.contexto.patientId).flatMap(d => {
        const r = ExecucaoSkill.safeParse(d.payload);
        return r.success && mesmo(r.data.contexto, p.contexto) ? [r.data] : [];
      }).sort((a, b) => Date.parse(b.criadoEm) - Date.parse(a.criadoEm) || b.execucaoId.localeCompare(a.execucaoId));
      return ok({ codigo: "SKILLS_HISTORICO", temMais: registros.length > 50, execucoes: registros.slice(0, 50).map(r => ({
        execucaoId: r.execucaoId, skillId: r.skillId, versao: r.versao, criadoEm: r.criadoEm, documentos: r.documentos.length })) });
    }
    function recuperar(id: string, codigo: "SKILL_REPLAY" | "SKILL_CARREGADA" | "SKILL_PREPARADA") {
      const d = lerDraft(deps.db, id), r = ExecucaoSkill.safeParse(d?.payload);
      if (!d || d.patientId !== contexto.patientId || !r.success || !mesmo(r.data.contexto, contexto)) throw new RecusaSkill("SKILL_FORA_DO_ESCOPO");
      const documentos = r.data.documentos.map(ref => {
        const documento = lerDraft(deps.db, ref.documentId), conteudo = DocumentoSkill.safeParse(documento?.payload);
        if (!documento || documento.patientId !== contexto.patientId || !conteudo.success || conteudo.data.execucaoId !== id
          || !mesmo(conteudo.data.contexto, contexto) || hashCanonico(conteudo.data) !== ref.hash) throw new RecusaSkill("DOCUMENTO_SKILL_INTEGRIDADE_INVALIDA");
        return conteudo.data;
      });
      const vigente = r.data.cadastroHash === hashCanonico(paciente) && r.data.fontes.every(ref => hashCanonico(lerDraft(deps.db, ref.draftId)) === ref.hash)
        && (!r.data.jornada || (r.data.jornada.ledgerHash === ledgerHash() && r.data.jornada.corpusHash === corpusHash
          && r.data.jornada.avaliacaoHash === hashCanonico(avaliacaoAtual())));
      return ok({ codigo, execucao: r.data, documentos, validade: vigente ? "ATUAL" : "ENTRADA_ALTERADA", criaEventoClinico: false });
    }
    if (p.acao === "LER") return recuperar(p.execucaoId, "SKILL_CARREGADA");
    return transacao(deps.db, () => {
      const execucaoId = `skill-exec:${hashCanonico(p.operationId)}`;
      const recibos = listarEventos(deps.db, p.contexto.patientId);
      let totalTexto = 0;
      const fontes: ExecucaoSkill["fontes"] = [];
      const facts: z.infer<typeof ClinicalFact>[] = [], pendencias: string[] = [];
      const alertas: ResultadoJornada["alertas"] = [];
      const selecao=p.configuracao.jornada;
      if (selecao && (selecao.cartoesIds.some(id=>!corpus?.cartoes.some(c=>c.id===id))
        || selecao.acoesIds.some(id=>!corpus?.acoes_consulta.some(a=>a.id===id)))) throw new RecusaSkill("REFERENCIA_CORPUS_INDISPONIVEL");
      for (const ref of p.fontes) {
        const draft = lerDraft(deps.db, ref.draftId), fonte = Fonte.safeParse(draft?.payload);
        if (!draft || draft.patientId !== p.contexto.patientId || draft.revision !== ref.expectedRevision || !fonte.success)
          throw new RecusaSkill("FONTE_SKILL_NAO_VINCULADA_OU_ALTERADA");
        const f = fonte.data, link = f.patientLinkReview;
        if (!mesmo(contextoDe(link), p.contexto) || link.sourceId !== draft.sourceId || f.input.sourceId !== draft.sourceId)
          throw new RecusaSkill("FONTE_SKILL_FORA_DO_ESCOPO");
        const original = { ...(draft.payload as Record<string, unknown>) }; delete original.patientLinkReview;
        if (hashCanonico(original) !== link.sourceHash) throw new RecusaSkill("FONTE_SKILL_ALTERADA");
        const segmentos = f.state.segments.filter(s => s.id === link.segmentId && s.sourceId === draft.sourceId);
        if (segmentos.length !== 1) throw new RecusaSkill("SEGMENTO_SKILL_AMBIGUO");
        const segmento = segmentos[0]!;
        if (deps.corpus?.rads) alertas.push(...detectarEmergencias(segmento.rawTranscript,deps.corpus.rads).alertas
          .map(a=>({texto:a.nome,sourceId:draft.sourceId,trecho:a.trecho})));
        const prova = recibos.filter(e => {
          const dado = dadosDoEvento(e), source = dado?.source as Record<string, unknown> | undefined;
          return e.tipo === "ReviewDecision" && e.operationId === link.reviewDecisionId && e.encounterId === p.contexto.encounterId
            && e.tumorLotId === p.contexto.tumorLotId && e.criadoPor.tipo === "SESSAO" && e.criadoPor.id === link.medicoId
            && dado?.acao === "LIGAR_PACIENTE" && dado.patientId === p.contexto.patientId && dado.segmentId === link.segmentId
            && dado.exceptionId === link.exceptionId && source?.draftId === draft.draftId && source.sourceId === draft.sourceId
            && source.contentHash === link.sourceHash && source.revision === draft.revision - 1;
        });
        if (prova.length !== 1 || segmento.sourceType !== f.input.sourceType || segmento.recordingId !== f.input.recordingId)
          throw new RecusaSkill("DECISAO_VINCULO_SKILL_NAO_COMPROVADA");
        totalTexto += segmento.rawTranscript.length;
        if (totalTexto > 1_000_000) throw new RecusaSkill("KIT_SKILL_EXCESSIVO");
        // Reexecutar a extração local sobre o segmento vinculado, preservando o original e o método de captura.
        const extracao = executarPipelineExtracao({ recordingId: f.input.recordingId, sourceId: f.input.sourceId, sourceType: f.input.sourceType,
          ...(f.input.captureMethod ? { captureMethod: f.input.captureMethod } : {}), rawTranscript: segmento.rawTranscript,
          ...(segmento.page === undefined ? {} : { page: segmento.page }) });
        facts.push(...extracao.facts.map(fact => ({ ...fact, segmentId: segmento.id })));
        pendencias.push(...extracao.confirmationRequired.filter(e => e.kind !== "UNLINKED_PATIENT").map(e => e.reason));
        if (extracao.rejeitados.length || extracao.factContractRejections.length) pendencias.push(`Extração com candidatos rejeitados na fonte ${draft.sourceId}: conferir original.`);
        fontes.push({ draftId: draft.draftId, revision: draft.revision, sourceId: draft.sourceId, segmentId: segmento.id,
          hash: hashCanonico(draft), reviewDecisionId: link.reviewDecisionId });
      }
      const clinica=avaliacaoAtual(), hashLedger=ledgerHash();
      if (clinica.urgente) alertas.push({texto:"Emergência na triagem do encontro",sourceId:null,trecho:null});
      const inputHash = hashCanonico({ pedido: p, fontes, cadastroHash: hashCanonico(paciente), corpusHash, ledgerHash:hashLedger, clinica });
      if (new Set(fontes.map(f => f.sourceId)).size !== fontes.length) throw new RecusaSkill("FONTES_SKILL_AMBIGUAS");
      const anterior = lerDraft(deps.db, execucaoId);
      if (anterior) {
        const r = ExecucaoSkill.safeParse(anterior.payload);
        if (!r.success || r.data.inputHash !== inputHash) throw new RecusaSkill("OPERACAO_SKILL_DIVERGENTE");
        return recuperar(execucaoId, "SKILL_REPLAY");
      }
      const preparados = prepararJornadaClinica({ execucaoId, contexto: p.contexto, nome: paciente.nome,skillId:p.skillId,
        configuracao: p.configuracao, fontes, facts, pendenciasFontes: pendencias,corpus,corpusHash,ledgerHash:hashLedger,
        avaliacaoHash:hashCanonico(clinica),alertas,seguranca:clinica.seguranca,mudancas:clinica.mudancas,historico:clinica.historico });
      const criadoEm = deps.agora();
      const execucao = ExecucaoSkill.parse({ kind: "SKILL_EXECUCAO_RASCUNHO", execucaoId, contexto: p.contexto,
        skillId: p.skillId, versao: p.versao, mecanismo: "COMPOSICAO_LOCAL_DETERMINISTICA", operationId: p.operationId,
        inputHash, cadastroHash: hashCanonico(paciente), criadoEm, medicoId: sessao.medicoId, configuracao: p.configuracao,
        fontes, evidencias: preparados.evidencias, documentos: preparados.documentos.map(d => ({ documentId: d.documentId, hash: hashCanonico(d) })),
        pendencias: preparados.pendencias, jornada:preparados.jornada, estado: "RASCUNHOS_PREPARADOS", criaEventoClinico: false, assinaDocumentos: false });
      for (const documento of preparados.documentos) salvarDraft(deps.db, { draftId: documento.documentId,
        patientId: p.contexto.patientId, sourceId: execucaoId, rawRef: execucaoId, payload: documento, revision: 0,
        criadoEm, diagnostics: ["RASCUNHO_SKILL_NAO_ASSINADO", ...documento.pendencias] });
      salvarDraft(deps.db, { draftId: execucaoId, patientId: p.contexto.patientId, sourceId: execucaoId,
        rawRef: `skill-nativa:${p.skillId}@1.0.0`, payload: execucao, revision: 0, criadoEm, diagnostics: preparados.pendencias });
      return recuperar(execucaoId, "SKILL_PREPARADA");
    });
  } catch (erro) {
    if (erro instanceof RecusaSkill) return { status: erro.status, body: { codigo: erro.codigo } };
    throw erro;
  }
}
