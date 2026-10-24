import { transacao } from "../../kernel/ledger/db.js";
import { registrarCienciaAlertas, validarCienciaAlertas } from "../alertasConsulta.js";
import { rascunhoNaoPromovivel } from "../../contracts/rascunhos.js";
import { documentoReceitaDosePendente } from "../../contracts/f1/receitaDose.js";
import { createHash } from "node:crypto";
import { z } from "zod";
import { DataCivil, Id } from "../../contracts/base.js";
import type { ConfirmarBloco as Confirmar } from "../../contracts/operacao.js";
import { auditar, depoisDoCommit, lerDraft, listarEventos, salvarDraft } from "../../kernel/comandos/portas.js";
import { executarConfirmacao as confirmar } from "../../kernel/comandos/index.js";
import { g25EscopoAssinatura } from "../../kernel/harness/gates.js";
import { hashConteudoExibido } from "../sessao.js";
import { lerConsulta } from "../leituras.js";
import { dataCivilDoServico } from "../../kernel/gateway/tempo.js";
import { lerModeloFlash } from "../flash.js";
import { CHAVE_CAIXA_MODELO_FLASH } from "../../contracts/configFlash.js";
import type { ServidorDeps } from "../rotas.js";

type SessaoLeitura = Parameters<NonNullable<ServidorDeps["settings"]>["readBox"]>[1];
export function opcoesLeituraConsulta(deps: ServidorDeps, sessao: SessaoLeitura) {
  const numeroModelo = deps.corpus?.caixasTodas.find((c) => c.chave === CHAVE_CAIXA_MODELO_FLASH)?.numero ?? null;
  let modeloFlash = null as ReturnType<typeof lerModeloFlash>;
  if (numeroModelo !== null && deps.settings) {
    try { modeloFlash = lerModeloFlash(deps.settings.readBox(numeroModelo, sessao).value); } catch { modeloFlash = null; }
  }
  return { limiarPlaquetas: deps.corpus?.limiarPlaquetas ?? null, modeloFlash,
    templates: deps.corpus?.templatesProtocolo ?? [], salaoRuleset: deps.salaoRuleset,
    interacoes: deps.corpus?.interacoes, catalogo: deps.corpus?.catalogoInteracoes, feveRuleset: deps.corpus?.feveRuleset,
    tetosCumulativos: deps.corpus?.tetosCumulativos ?? [],
    instrumentos: deps.corpus?.instrumentos ?? [], ...(deps.corpus?.condicionais ? { condicionais: deps.corpus.condicionais } : {}) };
}
export const sha = (s: string) => createHash("sha256").update(s).digest("hex");
export const ExibirBundle = z.object({
  patientId: Id,
  encounterId: Id,
  draftIds: z.array(Id),
  tumorLotId: Id.nullable().optional(),
}).strict();
export function payloadDocumento(value: unknown): { documentId: string; documentVersion: number; documentHash: string } | null {
  if (!value || typeof value !== "object") return null;
  const d = value as Record<string, unknown>;
  return typeof d.documentId === "string" && Number.isInteger(d.documentVersion)
    && typeof d.documentHash === "string"
    ? { documentId: d.documentId, documentVersion: d.documentVersion as number, documentHash: d.documentHash }
    : null;
}
export function contextoDraft(value: unknown): { encounterId: string; tumorLotId: string | null } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const outer = value as Record<string, unknown>;
  const inner = outer.contexto && typeof outer.contexto === "object" && !Array.isArray(outer.contexto)
    ? outer.contexto as Record<string, unknown> : outer;
  return typeof inner.encounterId === "string"
    && (typeof inner.tumorLotId === "string" || inner.tumorLotId === null)
    ? { encounterId: inner.encounterId, tumorLotId: inner.tumorLotId } : null;
}
/** W4-03 · a tela recebe conteúdo/hash calculado no servidor, nunca uma declaração do cliente. */
export function exibirBundle(deps: ServidorDeps, token: string,
  input: z.infer<typeof ExibirBundle>): { status: number; body: unknown } {
  if (new Set(input.draftIds).size !== input.draftIds.length)
    return { status: 400, body: { codigo: "DRAFT_DUPLICADO" } };
  const documentos: { draftId: string; documentId: string; documentVersion: number;
    conteudo: unknown; conteudoHash: string }[] = [];
  const chaves = new Set<string>();
  for (const draftId of input.draftIds) {
    const draft = lerDraft(deps.db, draftId);
    if (!draft || draft.patientId !== input.patientId)
      return { status: 409, body: { codigo: "DRAFT_NAO_ENCONTRADO" } };
    const contexto = contextoDraft(draft.payload);
    if (!contexto) return { status: 409, body: { codigo: "DRAFT_CONTEXTO_AUSENTE" } };
    if (contexto.encounterId !== input.encounterId)
      return { status: 409, body: { codigo: "DRAFT_ENCONTRO_DIVERGENTE" } };
    if (contexto.tumorLotId !== (input.tumorLotId ?? null))
      return { status: 409, body: { codigo: "DRAFT_LOTE_DIVERGENTE" } };
    if (rascunhoNaoPromovivel(draft.payload)) return { status: 409, body: { codigo: "DRAFT_AINDA_RASCUNHO" } };
    // Generic facts also need a server-issued reference and exact displayed content.
    const doc = payloadDocumento(draft.payload) ?? { documentId: draft.draftId, documentVersion: draft.revision + 1 };
    const chave = JSON.stringify([doc.documentId, doc.documentVersion]);
    if (chaves.has(chave)) return { status: 409, body: { codigo: "DOCUMENTO_DUPLICADO" } };
    chaves.add(chave);
    documentos.push({
      draftId, documentId: doc.documentId, documentVersion: doc.documentVersion,
      conteudo: draft.payload, conteudoHash: hashConteudoExibido(draft.payload),
    });
  }
  depoisDoCommit(deps.db, () => deps.sessoes.registrarBundleExibido(token,
    { patientId: input.patientId, encounterId: input.encounterId, tumorLotId: input.tumorLotId ?? null },
    documentos.map(({ draftId, documentId, documentVersion, conteudoHash }) =>
      ({ draftId, documentId, documentVersion, conteudoHash }))));
  return { status: 200, body: { patientId: input.patientId, encounterId: input.encounterId, documentos } };
}
/** Fatos e resumos com recibo válido compõem a revisão documental; o relógio não a altera. */
export function revisaoDocumentosFlash(deps:ServidorDeps,contexto:{patientId:string;encounterId:string;tumorLotId:string|null},
  sessao: Parameters<typeof lerConsulta>[3]):string {
  const retrato = deps.motorF1?.retrato(contexto).revisao ?? hashConteudoExibido(listarEventos(deps.db,contexto.patientId));
  const consulta = lerConsulta(deps.db, contexto.patientId, deps.agora(), sessao, contexto.tumorLotId,
    { ...opcoesLeituraConsulta(deps, sessao), encounterId: contexto.encounterId });
  if ("codigo" in consulta) return retrato;
  const resumos = consulta.evolucoesRascunho.filter((e) => e.revisaoRegistrada)
    .map(({ draftId, revision, resumo }) => ({ draftId, revision, resumo }))
    .sort((a, b) => a.draftId.localeCompare(b.draftId));
  return resumos.length ? hashConteudoExibido({ retrato, resumos }) : retrato;
}
/** ConfirmarBloco is strict; all clinical contents are fetched from local drafts, not HTTP input. */
export function confirmarBloco(deps: ServidorDeps, token: string, input: Confirmar): { status: number; body: unknown } {
  const resultado=transacao(deps.db,()=>confirmarBlocoNaTransacao(deps,token,input),r=>r.status>=400);
  if(resultado.negativa) auditar(deps.db,{ator:{tipo:"SESSAO",id:deps.sessoes.obter(token)!.medicoId},acaoPedida:"CONFIRMAR",
    decisao:"NEGADA",motivoCodigo:resultado.negativa.motivo,politicaVersao:"W2-01",em:resultado.negativa.em});
  return {status:resultado.status,body:resultado.body};
}
function confirmarBlocoNaTransacao(deps: ServidorDeps, token: string, input: Confirmar): { status: number; body: unknown; negativa?:{motivo:string;em:string} } {
  const sessao = deps.sessoes.obter(token)!;
  const contexto = { patientId: input.patientId, encounterId: input.encounterId, tumorLotId: input.tumorLotId };
  const exibidosNoServidor = deps.sessoes.bundleExibido(token, contexto);
  if (!exibidosNoServidor) return { status: 409, body: { codigo: "BUNDLE_NAO_EXIBIDO" } };
  if (g25EscopoAssinatura(input.documentosExibidos, exibidosNoServidor).decisao !== "PASSA")
    return { status: 409, body: { codigo: "ESCOPO_ASSINATURA_INVALIDO" } };
  if (new Set(input.registros.map((r) => r.id)).size !== input.registros.length)
    return { status: 409, body: { codigo: "DRAFT_DUPLICADO" } };
  const drafts = input.registros.map((r) => lerDraft(deps.db, r.id));
  if (drafts.some((draft) => !draft || draft.patientId !== input.patientId))
    return { status: 409, body: { codigo: "DRAFT_NAO_ENCONTRADO" } };
  if (drafts.some((draft) => {
    const contexto = contextoDraft(draft?.payload);
    return !contexto || contexto.encounterId !== input.encounterId || contexto.tumorLotId !== input.tumorLotId;
  })) return { status: 409, body: { codigo: "DRAFT_FORA_DO_ESCOPO" } };
  if (drafts.some((draft) => {
    return rascunhoNaoPromovivel(draft?.payload);
  })) return { status: 409, body: { codigo: "DRAFT_AINDA_RASCUNHO" } };
  for(const draft of drafts){
    const corpo=draft!.payload as {propostasDoseReceita?:{id:string;hashProposta:string;fonte:{hash:string}}[]};
    if(corpo.propostasDoseReceita?.some(p=>!(deps.corpus?.propostasDoseReceita??[]).some(c=>c.id===p.id&&c.hashProposta===p.hashProposta&&c.fonte.hash===p.fonte.hash)))
      return {status:409,body:{codigo:'PROPOSTA_DOSE_DESATUALIZADA'}};
  }
  for(const draft of drafts){
    const d=draft!.payload as {tipoDocumento?:string;documentosIncluidos?:{documentId:string;documentVersion:number}[]};
    if(d.tipoDocumento==='FLASH_CONJUNTO_IMPRESSAO'&&Array.isArray(d.documentosIncluidos)){
      for(const ref of d.documentosIncluidos){
        const filho=lerDraft(deps.db,ref.documentId);
        if(filho&&documentoReceitaDosePendente(filho.payload))return {status:409,body:{codigo:'RECEITA_DOSE_PENDENTE'}};
      }
    }
  }
  if(drafts.some(d=>documentoReceitaDosePendente(d!.payload)))
    return {status:409,body:{codigo:'RECEITA_DOSE_PENDENTE'}};
  const consulta = deps.sessoes.consultaSelecionada(token);
  // A assinatura exige a consulta aberta na sessão, como as demais escritas clínicas.
  if (!consulta) return { status: 409, body: { codigo: "CONTEXTO_CONSULTA_NAO_SELECIONADO" } };
  if (consulta.patientId !== contexto.patientId || consulta.encounterId !== contexto.encounterId
    || consulta.tumorLotId !== contexto.tumorLotId)
    return { status: 409, body: { codigo: "CONTEXTO_CONSULTA_ALTERADO" } };
  const escolhidos = input.documentosExibidos;
  const docs = drafts.map((d) => payloadDocumento(d!.payload));
  const refs = docs.map((doc, i) => doc ?? { documentId: drafts[i]!.draftId,
    documentVersion: input.registros[i]!.expectedRevision + 1 });
  if (refs.length !== escolhidos.length || new Set(refs.map((r) => JSON.stringify([r.documentId, r.documentVersion]))).size !== refs.length
    || refs.some((ref) => !escolhidos.some((d) => d.documentId === ref.documentId && d.documentVersion === ref.documentVersion)))
    return { status: 409, body: { codigo: "DOCUMENTO_NAO_SELECIONADO" } };
  // A13: só assina o conteúdo EXATO exibido. Hash ausente ou diferente ⇒ 409 (o draft mudou depois da tela).
  const hashes = drafts.map((d) => hashConteudoExibido(d!.payload));
  const alterado = refs.some((doc, i) => !exibidosNoServidor.some((x) => x.documentId === doc.documentId
      && x.documentVersion === doc.documentVersion && x.conteudoHash === hashes[i]
      && x.draftId === drafts[i]!.draftId));
  if (alterado) return { status: 409, body: { codigo: "CONTEUDO_ALTERADO_APOS_EXIBICAO" } };
  const operacaoExistente = deps.db.prepare("SELECT criadoEm FROM operation WHERE operationId=?").get(input.idempotencyKey);
  const em = operacaoExistente?.criadoEm as string | undefined ?? deps.agora();
  if(!operacaoExistente) {
    const revisaoAtual=revisaoDocumentosFlash(deps,contexto,sessao);
    const vencido=drafts.some(d=>{
      const p=d!.payload as Record<string,unknown>,meta=p.preparacaoS9;
      return meta&&typeof meta==="object"&&"revisao" in meta&&meta.revisao!==revisaoAtual;
    });
    if(vencido)return {status:409,body:{codigo:"REVISAO_FATOS_ALTERADA"}};
    // O writer ainda confere a identidade imutável do pedido no replay.
    const consultaAlertas = lerConsulta(deps.db,input.patientId,deps.agora(),sessao,input.tumorLotId,
      {...opcoesLeituraConsulta(deps,sessao),encounterId:input.encounterId});
    const alertasAtuais = "alertas" in consultaAlertas ? consultaAlertas.alertas : [];
    const exibidos = deps.sessoes.alertasExibidos?.(token,contexto) ?? [];
    const ciencia = validarCienciaAlertas(alertasAtuais, exibidos, input.reconhecerAlertas);
    if (ciencia) return {status:409,body:{codigo:ciencia}};
  }
  const reviewDecisionId = sha(JSON.stringify({ input, medicoId: sessao.medicoId }));
  const registros = input.registros.map((r, i) => {
    const doc = docs[i];
    const selected = doc && escolhidos.some((e) =>
      e.documentId === doc.documentId && e.documentVersion === doc.documentVersion);
    const draft = drafts[i]!;
    return { draftId: r.id, expectedRevision: r.expectedRevision,
      eventId: sha(`${input.idempotencyKey}:${r.id}:${i}`), tipo: doc ? "DOCUMENTO" : "FATO",
      payload: selected ? { data: draft.payload,
        signature: { documentId: doc.documentId, documentVersion: doc.documentVersion,
          documentHash: hashes[i]!, declaredHash: doc.documentHash, reviewDecisionId, serverActorId: sessao.medicoId } }
        : draft.payload,
      fontes: [], revisao: selected ? "ASSINADO" as const : "CONFIRMADO" as const };
  });
  // Marcador e tarefa pertencem à mesma operação da assinatura e não são HTTP input.
  const referencias = z.object({documentId:Id,documentVersion:z.number().int().positive()}).strict();
  const tarefaRefSchema=z.object({tarefaId:Id,contexto:z.object({patientId:Id,encounterId:Id,tumorLotId:Id.nullable()}).strict(),
    documentoRef:referencias,pedidosRef:z.array(referencias).min(1),dataAlvo:DataCivil,motivo:z.string().nullable()}).strict();
  let tarefaReferenciaInvalida=false;
  const tarefas=drafts.flatMap(d=>{
    const p=d!.payload as Record<string,unknown>;
    if(p.tarefasRetornoS9===undefined)return [];
    if(!Array.isArray(p.tarefasRetornoS9)){tarefaReferenciaInvalida=true;return [];}
    return p.tarefasRetornoS9.flatMap(t=>{const r=tarefaRefSchema.safeParse(t);if(!r.success){tarefaReferenciaInvalida=true;return [];}return[r.data];});
  });
  if(tarefaReferenciaInvalida)return {status:409,body:{codigo:"TAREFA_REFERENCIA_INVALIDA"}};
  if(tarefas.some(t=>t.contexto.patientId!==contexto.patientId||t.contexto.encounterId!==contexto.encounterId||t.contexto.tumorLotId!==contexto.tumorLotId
    ||[t.documentoRef,...t.pedidosRef].some(ref=>!escolhidos.some(d=>d.documentId===ref.documentId&&d.documentVersion===ref.documentVersion))))
    return {status:409,body:{codigo:"TAREFA_DOCUMENTO_NAO_SELECIONADO"}};
  for(const d of drafts) {
    const p=d!.payload as Record<string,unknown>;
    if(p.tipoDocumento!=="FLASH_CONJUNTO_IMPRESSAO")continue;
    if(!Array.isArray(p.documentosIncluidos))return {status:409,body:{codigo:"CONJUNTO_REFERENCIA_INVALIDA"}};
    const conjunto=p.documentosIncluidos.map(ref=>referencias.passthrough().safeParse(ref));
    if(conjunto.some(ref=>!ref.success)||conjunto.some(ref=>ref.success&&!escolhidos.some(e=>e.documentId===ref.data.documentId&&e.documentVersion===ref.data.documentVersion)))
      return {status:409,body:{codigo:"CONJUNTO_DOCUMENTO_NAO_SELECIONADO"}};
  }
  const auxiliares:{draftId:string;eventId:string;tipo:string;payload:unknown}[]=[];
  if(drafts.some(d=>String((d!.payload as Record<string,unknown>).tipoDocumento).startsWith("FLASH_"))) {
    const civil=dataCivilDoServico(em,"-03:00");
    if(civil.estado!=="OK")return {status:409,body:{codigo:civil.codigo}};
    auxiliares.push({draftId:`flash-consulta-confirmada-${sha(input.idempotencyKey)}`,eventId:sha(`${input.idempotencyKey}:consulta-confirmada`),tipo:"ConsultaConfirmada",
      payload:{dataClinica:civil.dataCivil,documentoIds:escolhidos}});
  }
  const vistos=new Set<string>();
  for(const t of tarefas) {
    if(vistos.has(t.tarefaId))continue;vistos.add(t.tarefaId);
    const existente=listarEventos(deps.db,input.patientId).find(e=>e.tipo==="Tarefa"&&e.payload&&typeof e.payload==="object"&&"data" in e.payload
      &&e.payload.data&&typeof e.payload.data==="object"&&"tarefaId" in e.payload.data&&e.payload.data.tarefaId===t.tarefaId);
    if(existente&&existente.operationId!==input.idempotencyKey)continue;
    const indice=refs.findIndex(d=>d.documentId===t.documentoRef.documentId&&d.documentVersion===t.documentoRef.documentVersion);
    auxiliares.push({draftId:`flash-tarefa-assinada-${sha(t.tarefaId)}`,eventId:sha(`${input.idempotencyKey}:tarefa:${t.tarefaId}`),tipo:"Tarefa",
      payload:{tarefaId:t.tarefaId,...contexto,operationId:input.idempotencyKey,titulo:"Retorno e exames de controle",responsavel:sessao.medicoId,
        prazo:null,estado:"CONFIRMADA",recebidoEm:null,criadoPor:sessao.medicoId,substituiTarefaId:null,dataAlvo:t.dataAlvo,pedidoRefs:t.pedidosRef,
        retornoRef:t.documentoRef,geradaPorEventoId:registros[indice]!.eventId,rulesetVersao:"documentos-consulta@1"}});
  }

    for(const a of auxiliares) {
      if(!lerDraft(deps.db,a.draftId))salvarDraft(deps.db,{draftId:a.draftId,patientId:input.patientId,sourceId:"flash-assinatura",rawRef:"referencia-local",payload:a.payload,diagnostics:[],revision:0,criadoEm:em});
    }
    const result=confirmar(deps.db, { autorizadoEm: deps.agora(), operationId:input.idempotencyKey,patientId:input.patientId,tumorLotId:input.tumorLotId,encounterId:input.encounterId,
      reviewDecisionId,sessao,em,registros:[...registros,...auxiliares.map(a=>({...a,expectedRevision:0,fontes:[],revisao:"CONFIRMADO" as const}))]});
    if(result.estado==="GRAVADA") registrarCienciaAlertas(deps.db,contexto,input.reconhecerAlertas,sessao.medicoId,em,input.idempotencyKey);
    return {status:result.estado==="NEGADA"?409:200,body:{codigo:result.estado,resultRef:result.resultRef},
      ...(result.estado==="NEGADA"?{negativa:{motivo:result.motivo??"CONFIRMACAO_NEGADA",em}}:{})};


}
