import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { ContextoAcaoComposta } from "../../contracts/api/acoesCompostas.js";
import {
  AvaliacaoEstudoRespostaSchema,
  EstudoServicoSchema,
  ImportarEstudoPedidoSchema,
  RevisarEstudoPedidoSchema,
  type AvaliacaoEstudoResposta,
  type AvaliarEstudoPedido,
  type CriterionExpression,
  type EvidenceRef,
  type EstudoServico,
  type ImportarEstudoPedido,
  type PatientFact,
  type RevisarEstudoPedido,
  type StudyCandidateDraft,
  type StudyCriterionDraft,
} from "../../contracts/api/trialsServico.js";
// @ts-expect-error folha CSS pura, resolvida pelo Vite
import "./estudos.css";

type TipoExpressao = "" | "EQUALS" | "NUMBER" | "DATE";
type TipoValorIgual = "TEXTO" | "NUMERO" | "BOOLEANO";
type Applicability = RevisarEstudoPedido["bindings"][number]["applicability"];

interface CriterioEdicao {
  groupId: string;
  groupOperator: "" | "AND" | "OR";
  applicability: Applicability;
  notApplicableReason: string;
  expressionKind: TipoExpressao;
  factKey: string;
  equalsType: TipoValorIgual;
  equalsValue: string;
  numberOperator: "EQ" | "GT" | "GTE" | "LT" | "LTE";
  numberValue: string;
  unit: string;
  dateOperator: "ON_OR_AFTER" | "ON_OR_BEFORE";
  dateValue: string;
}

interface EdicaoRevisao {
  studyId: string;
  titleText: string;
  titleEvidenceLocator: string;
  reviewedArmIds: string[];
  criterions: Record<string, CriterioEdicao>;
}

interface ResultadoVisivel {
  contexto: ContextoAcaoComposta;
  dados: AvaliacaoEstudoResposta;
}

export interface PainelEstudosProps {
  estudos: EstudoServico[];
  contexto: ContextoAcaoComposta | null;
  ocupado?: boolean;
  fatosDisponiveis?: PatientFact[];
  aoImportar: (pedido: ImportarEstudoPedido) => Promise<EstudoServico>;
  aoRevisar: (pedido: RevisarEstudoPedido) => Promise<EstudoServico>;
  aoAvaliar: (pedido: AvaliarEstudoPedido) => Promise<AvaliacaoEstudoResposta>;
  aoAlterarPendente?: (pendente: boolean) => void;
  aoAlterarSalvamento?: (salvando: boolean) => void;
}

const OPCOES_MIME = [
  { value: "text/plain", label: "Texto simples (.txt)" },
  { value: "text/markdown", label: "Markdown (.md)" },
  { value: "application/json", label: "JSON (.json)" },
] as const;

function listarCriterios(candidate: StudyCandidateDraft): StudyCriterionDraft[] {
  return [...candidate.inclusionCriteria, ...candidate.exclusionCriteria];
}

function etiquetaCriterio(candidate: StudyCandidateDraft, criterionId: string): string {
  const index = listarCriterios(candidate).findIndex(item => item.criterionId === criterionId);
  const criterion = listarCriterios(candidate)[index];
  if (!criterion) return "Critério";
  return `Critério ${index + 1} · ${criterion.polarity === "INCLUSAO" ? "inclusão" : "exclusão"}`;
}

function formaCriterioInicial(criterion: StudyCriterionDraft, existing?: RevisarEstudoPedido["bindings"][number]): CriterioEdicao {
  const expression = existing?.expression;
  return {
    groupId: existing?.groupId ?? "",
    groupOperator: existing?.groupOperator ?? "",
    applicability: existing?.applicability ?? "PENDENTE",
    notApplicableReason: existing?.notApplicableReason ?? "",
    expressionKind: expression?.kind ?? "",
    factKey: expression?.factKey ?? "",
    equalsType: expression?.kind === "EQUALS" ? typeof expression.value === "boolean" ? "BOOLEANO"
      : typeof expression.value === "number" ? "NUMERO" : "TEXTO" : "TEXTO",
    equalsValue: expression?.kind === "EQUALS" ? String(expression.value) : "",
    numberOperator: expression?.kind === "NUMBER" ? expression.operator : "GTE",
    numberValue: expression?.kind === "NUMBER" ? String(expression.value) : "",
    unit: expression?.kind === "NUMBER" ? expression.unit : "",
    dateOperator: expression?.kind === "DATE" ? expression.operator : "ON_OR_AFTER",
    dateValue: expression?.kind === "DATE" ? expression.value : "",
  };
}

function formaRevisaoInicial(estudo: EstudoServico): EdicaoRevisao {
  const review = estudo.review;
  const reviewed = new Map(review?.reviewedCriteria.map(item => [item.criterionId, item]) ?? []);
  return {
    studyId: review?.studyId ?? estudo.candidate.studyId ?? "",
    titleText: review?.title.text ?? estudo.candidate.title?.text ?? "",
    titleEvidenceLocator: review?.title.evidence[0]?.locator ?? "",
    reviewedArmIds: [...(review?.reviewedArmIds ?? [])],
    criterions: Object.fromEntries(listarCriterios(estudo.candidate).map(item => [item.criterionId,
      formaCriterioInicial(item, reviewed.get(item.criterionId))])),
  };
}

function inferirMime(file: File): string | null {
  const extensao = file.name.toLocaleLowerCase("pt-BR").split(".").pop();
  const peloNome = extensao === "txt" ? "text/plain" : extensao === "md" ? "text/markdown"
    : extensao === "json" ? "application/json" : null;
  if (!peloNome) return null;
  if (file.type && file.type !== peloNome) return null;
  return peloNome;
}

function idempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

function formatarValorFact(fact: PatientFact): string {
  return fact.status === "CONFIRMADO" ? `${String(fact.value)}${fact.unit ? ` ${fact.unit}` : ""}` : "CONFLITO — valores não eleitos";
}

export function PainelEstudos({
  estudos, contexto, ocupado = false, fatosDisponiveis = [], aoImportar, aoRevisar, aoAvaliar,
  aoAlterarPendente, aoAlterarSalvamento,
}: PainelEstudosProps) {
  const [nome, setNome] = useState("");
  const [mimeType, setMimeType] = useState<ImportarEstudoPedido["mimeType"]>("text/plain");
  const [conteudo, setConteudo] = useState("");
  const [arquivoCarregando, setArquivoCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [acaoEmCurso, setAcaoEmCurso] = useState("");
  const [estudosLocais, setEstudosLocais] = useState<EstudoServico[]>([]);
  const [rascunhosRevisao, setRascunhosRevisao] = useState<Record<string, EdicaoRevisao>>({});
  const [revisaoSelecionada, setRevisaoSelecionada] = useState<string | null>(null);
  const [resultados, setResultados] = useState<Record<string, ResultadoVisivel>>({});
  const [dirtyImport, setDirtyImport] = useState(false);
  const generation = useRef(0);
  const actionGeneration = useRef(0);
  const mounted = useRef(true);
  const pendingReported = useRef(false);
  const savingReported = useRef(false);
  const dirtyReviews = useRef(new Set<string>());
  const importIntent = useRef<{ fingerprint: string; key: string } | null>(null);
  const reviewIntents = useRef(new Map<string, { fingerprint: string; key: string }>());
  const contextKey = contexto ? JSON.stringify([contexto.patientId, contexto.encounterId, contexto.tumorLotId]) : "SEM_CONTEXTO";
  const previousContext = useRef(contextKey);

  const catalogo = useMemo(() => {
    const byId = new Map<string, EstudoServico>();
    for (const item of estudos) byId.set(item.draftId, item);
    for (const item of estudosLocais) {
      const current = byId.get(item.draftId);
      if (!current || current.revision <= item.revision) byId.set(item.draftId, item);
    }
    return [...byId.values()].sort((a, b) => a.source.originalName.localeCompare(b.source.originalName, "pt-BR"));
  }, [estudos, estudosLocais]);
  const estudoSelecionado = catalogo.find(item => item.draftId === revisaoSelecionada) ?? null;
  const fatosDaConsulta = contexto ? fatosDisponiveis.filter(fact => fact.patientId === contexto.patientId) : [];
  const formularioRevisao = estudoSelecionado ? rascunhosRevisao[estudoSelecionado.draftId]
    ?? formaRevisaoInicial(estudoSelecionado) : null;
  const bloqueado = ocupado || !!acaoEmCurso;

  function reportarPendente(next = dirtyImport || dirtyReviews.current.size > 0) {
    if (pendingReported.current !== next) {
      pendingReported.current = next;
      aoAlterarPendente?.(next);
    }
  }

  function reportarSalvamento(next: boolean) {
    if (savingReported.current !== next) {
      savingReported.current = next;
      aoAlterarSalvamento?.(next);
    }
  }

  function marcarImportPendente() {
    setDirtyImport(true);
    setErro("");
    setMensagem("");
    reportarPendente(true);
  }

  function atualizarEdicao(draftId: string, update: (form: EdicaoRevisao) => EdicaoRevisao) {
    const currentStudy = catalogo.find(item => item.draftId === draftId);
    if (!currentStudy) return;
    setRascunhosRevisao(previous => {
      const current = previous[draftId] ?? formaRevisaoInicial(currentStudy);
      return { ...previous, [draftId]: update(current) };
    });
    dirtyReviews.current.add(draftId);
    setErro(""); setMensagem("");
    setResultados(previous => { const copy = { ...previous }; delete copy[draftId]; return copy; });
    reportarPendente(true);
  }

  useEffect(() => {
    mounted.current = true;
    aoAlterarPendente?.(false);
    aoAlterarSalvamento?.(false);
    return () => { mounted.current = false; generation.current += 1; actionGeneration.current += 1; };
  }, []);

  useEffect(() => {
    if (previousContext.current === contextKey) return;
    previousContext.current = contextKey;
    generation.current += 1;
    actionGeneration.current += 1;
    setAcaoEmCurso("");
    setArquivoCarregando(false);
    setResultados({});
    setErro(""); setMensagem("");
    reportarSalvamento(false);
  }, [contextKey]);

  function beginAction(name: string): number {
    const token = ++actionGeneration.current;
    setAcaoEmCurso(name);
    reportarSalvamento(true);
    return token;
  }

  function finishAction(token: number) {
    if (!mounted.current || token !== actionGeneration.current) return;
    setAcaoEmCurso("");
    reportarSalvamento(false);
  }

  function mergeStudy(next: EstudoServico) {
    setEstudosLocais(previous => {
      const other = previous.filter(item => item.draftId !== next.draftId);
      return [...other, next];
    });
  }

  function keyForImport(request: Omit<ImportarEstudoPedido, "idempotencyKey">): string {
    const fingerprint = JSON.stringify(request);
    if (importIntent.current?.fingerprint !== fingerprint)
      importIntent.current = { fingerprint, key: idempotencyKey() };
    return importIntent.current.key;
  }

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const mime = inferirMime(file);
    if (!mime) { setErro("Selecione somente arquivo TXT, Markdown ou JSON com tipo correspondente."); return; }
    const readToken = generation.current;
    setArquivoCarregando(true); setErro(""); setMensagem("");
    try {
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Não foi possível ler o arquivo local."));
        reader.onerror = () => reject(new Error("Não foi possível ler o arquivo local."));
        reader.readAsText(file);
      });
      if (!mounted.current || readToken !== generation.current) return;
      setNome(file.name); setMimeType(mime as ImportarEstudoPedido["mimeType"]); setConteudo(text); marcarImportPendente();
    } catch (cause) {
      if (mounted.current && readToken === generation.current)
        setErro(cause instanceof Error ? cause.message : "Não foi possível ler o arquivo local.");
    } finally { if (mounted.current && readToken === generation.current) setArquivoCarregando(false); }
  }

  async function importar() {
    if (bloqueado || arquivoCarregando) return;
    const basePedido = { nome: nome.trim(), mimeType, conteudo };
    const parsed = ImportarEstudoPedidoSchema.safeParse({ ...basePedido, idempotencyKey: "pending-import" });
    if (!parsed.success) { setErro("Informe nome, tipo e conteúdo literal válidos antes de importar."); return; }
    const request = { ...basePedido, idempotencyKey: keyForImport(basePedido) };
    const valid = ImportarEstudoPedidoSchema.safeParse(request);
    if (!valid.success) { setErro("Os dados da fonte não atendem ao contrato de importação."); return; }
    const token = generation.current, actionToken = beginAction("importar");
    setErro(""); setMensagem("");
    try {
      const response = EstudoServicoSchema.parse(await aoImportar(valid.data));
      if (!mounted.current || token !== generation.current) return;
      mergeStudy(response);
      setRevisaoSelecionada(response.draftId);
      setRascunhosRevisao(previous => ({ ...previous, [response.draftId]: formaRevisaoInicial(response) }));
      setDirtyImport(false); reportarPendente(dirtyReviews.current.size > 0);
      setMensagem("Fonte original preservada. Candidato pendente de revisão médica; nenhum estudo foi confirmado automaticamente.");
    } catch (cause) {
      if (mounted.current && token === generation.current)
        setErro(cause instanceof Error ? cause.message : "A importação não foi concluída. A fonte original permanece no formulário.");
    } finally { finishAction(actionToken); }
  }

  function iniciarRevisao(estudo: EstudoServico) {
    setErro(""); setMensagem("");
    setRascunhosRevisao(previous => previous[estudo.draftId] ? previous
      : { ...previous, [estudo.draftId]: formaRevisaoInicial(estudo) });
    setRevisaoSelecionada(estudo.draftId);
  }

  function bindingExpression(form: CriterioEdicao): CriterionExpression | null {
    if (!form.expressionKind) return null;
    if (form.expressionKind === "EQUALS") {
      let value: string | number | boolean = form.equalsValue;
      if (form.equalsType === "BOOLEANO") {
        if (form.equalsValue !== "true" && form.equalsValue !== "false") throw new Error("Selecione verdadeiro ou falso para EQUALS.");
        value = form.equalsValue === "true";
      } else if (form.equalsType === "NUMERO") {
        const parsed = Number(form.equalsValue.replace(",", "."));
        if (!form.equalsValue.trim() || !Number.isFinite(parsed)) throw new Error("Informe um valor numérico finito para EQUALS.");
        value = parsed;
      } else if (!form.equalsValue.trim()) throw new Error("Informe o valor exato para EQUALS.");
      if (!form.factKey.trim()) throw new Error("Informe a chave do fato vinculada.");
      return { kind: "EQUALS", factKey: form.factKey.trim(), value };
    }
    if (!form.factKey.trim()) throw new Error("Informe a chave do fato vinculada.");
    if (form.expressionKind === "NUMBER") {
      const value = Number(form.numberValue.replace(",", "."));
      if (!form.numberValue.trim() || !Number.isFinite(value)) throw new Error("Informe valor numérico finito.");
      if (!form.unit.trim()) throw new Error("Informe a unidade do critério.");
      return { kind: "NUMBER", factKey: form.factKey.trim(), operator: form.numberOperator, value, unit: form.unit.trim() };
    }
    if (!form.dateValue) throw new Error("Informe a data do critério.");
    return { kind: "DATE", factKey: form.factKey.trim(), operator: form.dateOperator, value: form.dateValue };
  }

  function montarPedidoRevisao(estudo: EstudoServico, form: EdicaoRevisao, decision: "CONFIRMAR" | "REJEITAR"):
    RevisarEstudoPedido | null {
    const errors: string[] = [];
    const titleEvidence = estudo.candidate.title?.evidence.find(item => item.locator === form.titleEvidenceLocator);
    if (!form.studyId.trim()) errors.push("Informe o ID do estudo revisado.");
    if (!form.titleText.trim()) errors.push("Informe o título revisado.");
    if (!titleEvidence) errors.push("Selecione a evidência exata do título.");
    else if (titleEvidence.exactText !== form.titleText) errors.push("O título deve corresponder exatamente ao trecho de evidência selecionado.");
    const candidateArmIds = estudo.candidate.arms.map(arm => arm.armId);
    const reviewedArmIds = form.reviewedArmIds.filter(id => candidateArmIds.includes(id));
    if (decision === "CONFIRMAR" && candidateArmIds.some(id => !reviewedArmIds.includes(id)))
      errors.push("Revise todos os braços declarados pela fonte antes de confirmar o protocolo.");
    const bindings: RevisarEstudoPedido["bindings"] = [];
    for (const [index, item] of listarCriterios(estudo.candidate).entries()) {
      const fields = form.criterions[item.criterionId] ?? formaCriterioInicial(item);
      const label = `Critério ${index + 1}`;
      const groupId = fields.groupId.trim() || null;
      const groupOperator = fields.groupOperator || null;
      if ((groupId === null) !== (groupOperator === null)) errors.push(`${label}: grupo e operador devem ser informados juntos.`);
      if (fields.applicability === "NAO_APLICAVEL" && !fields.notApplicableReason.trim())
        errors.push(`${label}: informe o motivo do critério não aplicável.`);
      let expression: CriterionExpression | null = null;
      try { expression = bindingExpression(fields); }
      catch (cause) { if (fields.applicability === "APLICAVEL") errors.push(`${label}: ${cause instanceof Error ? cause.message : "vinculação inválida"}`); }
      if (fields.applicability === "APLICAVEL" && !expression)
        errors.push(`${label}: selecione e complete uma vinculação estruturada ou mantenha pendente.`);
      bindings.push({ criterionId: item.criterionId, groupId, groupOperator, expression,
        applicability: fields.applicability,
        notApplicableReason: fields.applicability === "NAO_APLICAVEL" ? fields.notApplicableReason.trim() || null : null,
      });
    }
    if (errors.length) { setErro(errors.join(" ")); return null; }
    const basePedido = { draftId: estudo.draftId, expectedRevision: estudo.revision,
      candidateHash: estudo.candidateHash, studyId: form.studyId.trim(), decision,
      titleText: form.titleText, titleEvidenceLocator: form.titleEvidenceLocator,
      bindings, reviewedArmIds };
    const fingerprint = JSON.stringify(basePedido);
    let intent = reviewIntents.current.get(estudo.draftId);
    if (!intent || intent.fingerprint !== fingerprint) {
      intent = { fingerprint, key: idempotencyKey() };
      reviewIntents.current.set(estudo.draftId, intent);
    }
    const parsed = RevisarEstudoPedidoSchema.safeParse({ ...basePedido, idempotencyKey: intent.key });
    if (!parsed.success) { setErro("A revisão preenchida não atende ao contrato. Confira critérios, grupos e título evidenciado."); return null; }
    return parsed.data;
  }

  async function revisar(decision: "CONFIRMAR" | "REJEITAR") {
    if (!estudoSelecionado || !formularioRevisao || bloqueado) return;
    const pedido = montarPedidoRevisao(estudoSelecionado, formularioRevisao, decision);
    if (!pedido) return;
    const token = generation.current, actionToken = beginAction("revisar");
    setErro(""); setMensagem("");
    try {
      const response = EstudoServicoSchema.parse(await aoRevisar(pedido));
      if (!mounted.current || token !== generation.current) return;
      if (response.draftId !== estudoSelecionado.draftId || !response.review
        || response.review.candidateHash !== estudoSelecionado.candidateHash) throw new Error("A resposta de revisão não corresponde à versão selecionada.");
      mergeStudy(response);
      dirtyReviews.current.delete(estudoSelecionado.draftId);
      setRascunhosRevisao(previous => { const copy = { ...previous }; delete copy[estudoSelecionado.draftId]; return copy; });
      setRevisaoSelecionada(null); setResultados(previous => { const copy = { ...previous }; delete copy[estudoSelecionado.draftId]; return copy; });
      setMensagem(decision === "CONFIRMAR" ? "Revisão humana registrada. Compatibilidade ainda não determina elegibilidade." : "Estudo rejeitado na revisão humana.");
      reportarPendente();
    } catch (cause) {
      if (mounted.current && token === generation.current)
        setErro(cause instanceof Error ? cause.message : "A revisão não foi concluída. Campos permanecem preservados.");
    } finally { finishAction(actionToken); }
  }

  async function avaliar(estudo: EstudoServico) {
    if (!contexto || !estudo.review || estudo.review.decision !== "CONFIRMAR" || bloqueado) return;
    const pedido = { contexto, draftId: estudo.draftId, expectedRevision: estudo.revision,
      expectedReviewHash: estudo.review.reviewHash };
    const token = generation.current, actionToken = beginAction("avaliar");
    setErro(""); setMensagem("");
    try {
      const response = AvaliacaoEstudoRespostaSchema.parse(await aoAvaliar(pedido));
      if (!mounted.current || token !== generation.current) return;
      if (response.contexto.patientId !== contexto.patientId || response.contexto.encounterId !== contexto.encounterId
        || response.contexto.tumorLotId !== contexto.tumorLotId || response.estudo.draftId !== estudo.draftId
        || response.estudo.review?.reviewHash !== estudo.review.reviewHash)
        throw new Error("A resposta de avaliação pertence a outra consulta ou versão revisada.");
      setResultados(previous => ({ ...previous, [estudo.draftId]: { contexto, dados: response } }));
      setMensagem("Critérios avaliados pelo serviço. Este resultado não define elegibilidade ou inclusão no estudo.");
    } catch (cause) {
      if (mounted.current && token === generation.current)
        setErro(cause instanceof Error ? cause.message : "Não foi possível avaliar os critérios. Reabra a consulta para tentar novamente.");
    } finally { finishAction(actionToken); }
  }

  function alterarCriterio(criterionId: string, update: (current: CriterioEdicao) => CriterioEdicao) {
    if (!estudoSelecionado || !formularioRevisao) return;
    atualizarEdicao(estudoSelecionado.draftId, current => ({ ...current, criterions: {
      ...current.criterions,
      [criterionId]: update(current.criterions[criterionId] ?? formaCriterioInicial(listarCriterios(estudoSelecionado.candidate)
        .find(item => item.criterionId === criterionId)!)),
    } }));
  }

  const errorId = "estudos-erro";
  return <section className="estudos-panel" aria-label="Estudos clínicos" aria-busy={bloqueado}>
    <header className="estudos-panel__header">
      <div><p className="estudos-panel__eyebrow">EVIDÊNCIA E REVISÃO HUMANA</p>
        <h2>Estudos clínicos</h2>
        <p>Fontes e critérios exigem conferência médica. Importar ou avaliar não confirma elegibilidade.</p></div>
      <span className="estudos-panel__count">{catalogo.length} {catalogo.length === 1 ? "estudo" : "estudos"}</span>
    </header>

    <section className="estudos-panel__import" aria-label="Importar estudo">
      <h3>Importar fonte local</h3>
      <p>Use TXT, Markdown ou JSON. O conteúdo literal e sua proveniência serão preservados; PDF não é interpretado aqui.</p>
      <div className="estudos-panel__form-grid">
        <label>Nome do arquivo-fonte
          <input aria-label="Nome do arquivo-fonte" value={nome} disabled={bloqueado}
            onChange={event => { setNome(event.target.value); marcarImportPendente(); }} />
        </label>
        <label>Tipo MIME da fonte
          <select aria-label="Tipo MIME da fonte" value={mimeType} disabled={bloqueado}
            onChange={event => { setMimeType(event.target.value as ImportarEstudoPedido["mimeType"]); marcarImportPendente(); }}>
            {OPCOES_MIME.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="estudos-panel__file">Arquivo de estudo local
          <input aria-label="Arquivo de estudo local" type="file" accept=".txt,.md,.json,text/plain,text/markdown,application/json"
            disabled={bloqueado || arquivoCarregando} onChange={event => void readFile(event)} />
        </label>
        <label className="estudos-panel__source-text">Conteúdo literal da fonte
          <textarea aria-label="Conteúdo literal da fonte" rows={7} value={conteudo} disabled={bloqueado}
            onChange={event => { setConteudo(event.target.value); marcarImportPendente(); }} />
        </label>
      </div>
      <button type="button" disabled={bloqueado || arquivoCarregando || !nome.trim() || !conteudo.trim()}
        onClick={() => void importar()}>{acaoEmCurso === "importar" ? "Importando fonte…" : "Importar fonte local"}</button>
    </section>

    {erro ? <p id={errorId} className="estudos-panel__error" role="alert">{erro}</p> : null}
    {mensagem ? <p className="estudos-panel__status" role="status">{mensagem}</p> : null}
    {acaoEmCurso ? <p className="estudos-panel__status" role="status">Operação em curso: {acaoEmCurso}.</p> : null}

    <section className="estudos-panel__list" aria-label="Estudos importados">
      <h3>Estudos e versões</h3>
      {!catalogo.length ? <p>Nenhum estudo importado nesta sessão.</p> : null}
      {catalogo.map(estudo => {
        const title = estudo.review?.title.text ?? estudo.candidate.title?.text ?? "Título pendente na fonte";
        const result = resultados[estudo.draftId];
        const resultCurrent = result && contexto && result.contexto.patientId === contexto.patientId
          && result.contexto.encounterId === contexto.encounterId && result.contexto.tumorLotId === contexto.tumorLotId
          && estudo.review?.decision === "CONFIRMAR"
          && result.dados.estudo.revision === estudo.revision
          && result.dados.estudo.candidateHash === estudo.candidateHash
          && result.dados.estudo.review?.reviewHash === estudo.review.reviewHash
          ? result.dados : null;
        return <article className="estudos-panel__study" aria-label={`${estudo.review ? "Estudo revisado" : "Estudo pendente"}: ${title}`}
          key={estudo.draftId}>
          <header><div><p className="estudos-panel__eyebrow">{estudo.review ? `VERSÃO REVISADA ${estudo.review.version}` : "CANDIDATO PENDENTE"}</p>
            <h4>{title}</h4></div><span>Rascunho v{estudo.revision}</span></header>
          <p>Status: {estudo.review?.decision === "CONFIRMAR" ? "Protocolo revisado"
            : estudo.review?.decision === "REJEITAR" ? "Protocolo rejeitado" : "Aguardando revisão médica"}</p>
          {estudo.candidate.description ? <p>{estudo.candidate.description.text}</p> : null}
          {estudo.candidate.warnings.length ? <ul className="estudos-panel__warnings">{estudo.candidate.warnings.map((warning, index) =>
            <li key={`${index}-${warning}`}>{warning.startsWith("CANDIDATO_EXTRAIDO_DE_ESTRUTURA_DOCUMENTAL")
              ? "Revise o texto original e a vinculação de cada critério." : warning}</li>)}</ul> : null}
          <details>
            <summary>Fonte original e metadados</summary>
            <p>{estudo.source.originalName} · {estudo.source.mimeType} · {estudo.source.kind}</p>
            <p>Referência local: {estudo.source.sourceRef}</p>
            <details><summary>Identificadores e hash</summary><p>Source ID: {estudo.source.sourceId}</p><p>SHA-256: {estudo.source.contentHash}</p></details>
            {estudo.source.originalContent !== null ? <pre className="estudos-panel__original">{estudo.source.originalContent}</pre>
              : <p>Anexo sem texto extraído. Importe o texto do protocolo para revisar os critérios.</p>}
          </details>
          <details>
            <summary>Candidato e critérios extraídos</summary>
            <details><summary>Estado imutável do candidato</summary><p>{estudo.candidate.reviewStatus}</p></details>
            {estudo.candidate.title ? <p>Título candidato: {estudo.candidate.title.text}</p> : <p>Título candidato ausente.</p>}
            {estudo.candidate.arms.map(arm => <article aria-label={`Braço candidato ${arm.armId}`} key={arm.armId}>
              <h5>{arm.name.text}</h5><p>{arm.description?.text ?? "Descrição não informada."}</p>
              <EvidenceList refs={[...arm.name.evidence, ...(arm.description?.evidence ?? [])]} />
            </article>)}
            {listarCriterios(estudo.candidate).map((item, index) => <article aria-label={`Critério original ${index + 1}`} key={item.criterionId}>
              <h5>{etiquetaCriterio(estudo.candidate, item.criterionId)}</h5>
              <p>{item.rawText}</p><EvidenceList refs={item.evidence} />
              <details><summary>Identificador de rastreabilidade</summary><code>{item.criterionId}</code></details>
              {item.expression ? <details><summary>Expressão sugerida, ainda não revisada</summary><pre>{JSON.stringify(item.expression, null, 2)}</pre></details> : null}
            </article>)}
          </details>
          <div className="estudos-panel__actions">
            {!estudo.review || estudo.review.decision !== "CONFIRMAR" ? <button type="button" disabled={bloqueado}
              onClick={() => iniciarRevisao(estudo)}>Revisar estudo</button> : null}
            {estudo.review?.decision === "CONFIRMAR" ? <button type="button" disabled={bloqueado || !contexto}
              onClick={() => void avaliar(estudo)}>Avaliar critérios</button> : null}
          </div>
          {resultCurrent ? <section className="estudos-panel__result" aria-label="Resultado da avaliação">
            <h4>Compatibilidade com critérios revisados</h4>
            <p>{{ POSSIBLE_MATCH: "Possível candidato para triagem", PENDENTE: "Dados pendentes para comparação",
              SEM_MATCH: "Sem compatibilidade nos critérios revisados" }[resultCurrent.resultado.status]} · elegibilidade: não determinada.</p>
            <p>A avaliação não autoriza inclusão, conduta ou tratamento.</p>
            {resultCurrent.resultado.criteria.map((item, index) => <article key={item.criterionId}>
              <h5>Critério {index + 1} · {item.status}</h5><p>{item.reason}</p><EvidenceList refs={item.sources} />
              <details><summary>Identificador de rastreabilidade</summary><code>{item.criterionId}</code></details>
            </article>)}
            <details><summary>Fatos retornados pelo serviço</summary>
              {resultCurrent.fatos.map((fact, index) => <article key={`${fact.factKey}-${index}`}>
                <h5>{fact.factKey} · {fact.status}</h5><p>{formatarValorFact(fact)}</p>
                {fact.status === "CONFIRMADO" ? <EvidenceList refs={[fact.source]} /> : <EvidenceList refs={fact.sources} />}
              </article>)}
            </details>
            <details><summary>Metadados de revisão e versão</summary><p>Study ID: {resultCurrent.estudo.review?.studyId}</p>
              <p>Versão do estudo revisada: {resultCurrent.resultado.reviewedStudyVersion}</p>
              <p>Hash da revisão: {resultCurrent.estudo.review?.reviewHash}</p>
              <p>Revisão de fatos: {resultCurrent.revisaoFatos}</p></details>
          </section> : null}
        </article>;
      })}
    </section>

    {revisaoSelecionada && estudoSelecionado && formularioRevisao ? <section className="estudos-panel__review" aria-label="Revisão humana do estudo">
      <header><div><p className="estudos-panel__eyebrow">REVISÃO EXPLÍCITA</p><h3>Revisão médica: {estudoSelecionado.candidate.title?.text ?? estudoSelecionado.source.originalName}</h3></div>
        <button type="button" disabled={bloqueado} onClick={() => setRevisaoSelecionada(null)}>Fechar revisão</button></header>
      <p>Candidato, expressão extraída e comparação são propostas de máquina. A decisão permanece humana; nenhum botão marca elegibilidade.</p>
      <div className="estudos-panel__form-grid">
        <label>ID do estudo
          <input aria-label="ID do estudo" value={formularioRevisao.studyId} disabled={bloqueado}
            onChange={event => { const value = event.currentTarget.value;
              atualizarEdicao(estudoSelecionado.draftId, form => ({ ...form, studyId: value })); }} />
        </label>
        <label>Título revisado
          <input aria-label="Título revisado" value={formularioRevisao.titleText} disabled={bloqueado}
            onChange={event => { const value = event.currentTarget.value;
              atualizarEdicao(estudoSelecionado.draftId, form => ({ ...form, titleText: value })); }} />
        </label>
        <label>Evidência exata do título
          <select aria-label="Evidência exata do título" value={formularioRevisao.titleEvidenceLocator} disabled={bloqueado}
            onChange={event => { const value = event.currentTarget.value;
              atualizarEdicao(estudoSelecionado.draftId, form => ({ ...form, titleEvidenceLocator: value })); }}>
            <option value="">Selecione o trecho exato</option>
            {(estudoSelecionado.candidate.title?.evidence ?? []).map((item, index) => <option key={`${index}-${item.locator}`} value={item.locator}>
              {item.locator} · {item.sourceRef}</option>)}
          </select>
        </label>
      </div>
      {formularioRevisao.titleEvidenceLocator ? <EvidenceList refs={estudoSelecionado.candidate.title?.evidence.filter(item =>
        item.locator === formularioRevisao.titleEvidenceLocator) ?? []} /> : <p>Sem trecho do título selecionado; confirmação bloqueada.</p>}

      <section className="estudos-panel__arms" aria-label="Braços revisados">
        <h4>Ensaios/braços conferidos</h4>
        {!estudoSelecionado.candidate.arms.length ? <p>A fonte não declara braços para este protocolo.</p> : null}
        {estudoSelecionado.candidate.arms.map(arm => <label key={arm.armId}>
          <input type="checkbox" aria-label={`Revisar braço · ${arm.armId}`} checked={formularioRevisao.reviewedArmIds.includes(arm.armId)}
            disabled={bloqueado} onChange={event => { const checked = event.currentTarget.checked;
              atualizarEdicao(estudoSelecionado.draftId, form => ({ ...form,
                reviewedArmIds: checked ? [...form.reviewedArmIds, arm.armId]
                  : form.reviewedArmIds.filter(id => id !== arm.armId),
              })); }} /> {arm.armId} · {arm.name.text}
        </label>)}
      </section>

      <section className="estudos-panel__criteria" aria-label="Critérios revisados">
        <h4>Critérios revisados</h4>
        {listarCriterios(estudoSelecionado.candidate).map((item, index) => {
          const form = formularioRevisao.criterions[item.criterionId] ?? formaCriterioInicial(item);
          const label = etiquetaCriterio(estudoSelecionado.candidate, item.criterionId);
          return <fieldset key={item.criterionId} disabled={bloqueado} className="estudos-panel__criterion" aria-label={`Revisão ${label}`}>
            <legend>{label}</legend>
            <p className="estudos-panel__quote">{item.rawText}</p><EvidenceList refs={item.evidence} />
            <details><summary>Identificador de rastreabilidade</summary><code>{item.criterionId}</code></details>
            {item.expression ? <details><summary>Expressão candidata não vinculada</summary><pre>{JSON.stringify(item.expression, null, 2)}</pre></details> : null}
            <div className="estudos-panel__form-grid">
              <label>Aplicabilidade · critério {index + 1}
                <select aria-label={`Aplicabilidade · critério ${index + 1}`} value={form.applicability}
                  onChange={event => { const value = event.currentTarget.value as Applicability;
                    alterarCriterio(item.criterionId, previous => ({ ...previous,
                      applicability: value,
                      notApplicableReason: value === "NAO_APLICAVEL" ? previous.notApplicableReason : "",
                    })); }}>
                  <option value="PENDENTE">Pendente de revisão</option>
                  <option value="APLICAVEL">Aplicável</option>
                  <option value="NAO_APLICAVEL">Não aplicável</option>
                </select>
              </label>
              <label>Tipo de vinculação · critério {index + 1}
                <select aria-label={`Tipo de vinculação · critério ${index + 1}`} value={form.expressionKind}
                  onChange={event => { const value = event.currentTarget.value as TipoExpressao;
                    alterarCriterio(item.criterionId, previous => ({ ...previous, expressionKind: value })); }}>
                  <option value="">Sem vinculação estruturada</option><option value="EQUALS">Igualdade</option>
                  <option value="NUMBER">Comparação numérica</option><option value="DATE">Comparação de data</option>
                </select>
              </label>
              <label>Grupo de critérios · critério {index + 1}
                <input aria-label={`Grupo de critérios · critério ${index + 1}`} value={form.groupId} onChange={event => { const value = event.currentTarget.value;
                  alterarCriterio(item.criterionId, previous => ({ ...previous, groupId: value })); }} />
              </label>
              <label>Operador do grupo · critério {index + 1}
                <select aria-label={`Operador do grupo · critério ${index + 1}`} value={form.groupOperator}
                  onChange={event => { const value = event.currentTarget.value as "" | "AND" | "OR";
                    alterarCriterio(item.criterionId, previous => ({ ...previous, groupOperator: value })); }}>
                  <option value="">Sem grupo</option><option value="AND">AND</option><option value="OR">OR</option>
                </select>
              </label>
              {form.applicability === "NAO_APLICAVEL" ? <label>Motivo de não aplicável · critério {index + 1}
                <textarea aria-label={`Motivo de não aplicável · critério ${index + 1}`} rows={2} value={form.notApplicableReason}
                  onChange={event => { const value = event.currentTarget.value;
                    alterarCriterio(item.criterionId, previous => ({ ...previous, notApplicableReason: value })); }} />
              </label> : null}
              {form.expressionKind ? <label>Fato vinculado · critério {index + 1}
                <input aria-label={`Fato vinculado · critério ${index + 1}`} value={form.factKey}
                  onChange={event => { const value = event.currentTarget.value;
                    alterarCriterio(item.criterionId, previous => ({ ...previous, factKey: value })); }} />
              </label> : null}
              {form.expressionKind === "EQUALS" ? <>
                <label>Tipo do valor EQUALS · critério {index + 1}
                  <select aria-label={`Tipo do valor EQUALS · critério ${index + 1}`} value={form.equalsType}
                    onChange={event => { const value = event.currentTarget.value as TipoValorIgual;
                      alterarCriterio(item.criterionId, previous => ({ ...previous, equalsType: value })); }}>
                    <option value="TEXTO">Texto</option><option value="NUMERO">Número</option><option value="BOOLEANO">Booleano</option>
                  </select>
                </label>
                <label>Valor igual · critério {index + 1}
                  <input aria-label={`Valor igual · critério ${index + 1}`} value={form.equalsValue}
                    onChange={event => { const value = event.currentTarget.value;
                      alterarCriterio(item.criterionId, previous => ({ ...previous, equalsValue: value })); }} />
                </label>
              </> : null}
              {form.expressionKind === "NUMBER" ? <>
                <label>Operador · critério {index + 1}
                  <select aria-label={`Operador · critério ${index + 1}`} value={form.numberOperator}
                    onChange={event => { const value = event.currentTarget.value as CriterioEdicao["numberOperator"];
                      alterarCriterio(item.criterionId, previous => ({ ...previous, numberOperator: value })); }}>
                    {(["EQ", "GT", "GTE", "LT", "LTE"] as const).map(op => <option key={op} value={op}>{op}</option>)}
                  </select>
                </label>
                <label>Valor numérico · critério {index + 1}
                  <input aria-label={`Valor numérico · critério ${index + 1}`} type="text" inputMode="decimal" value={form.numberValue}
                    onChange={event => { const value = event.currentTarget.value;
                      alterarCriterio(item.criterionId, previous => ({ ...previous, numberValue: value })); }} />
                </label>
                <label>Unidade · critério {index + 1}
                  <input aria-label={`Unidade · critério ${index + 1}`} value={form.unit}
                    onChange={event => { const value = event.currentTarget.value;
                      alterarCriterio(item.criterionId, previous => ({ ...previous, unit: value })); }} />
                </label>
              </> : null}
              {form.expressionKind === "DATE" ? <>
                <label>Operador de data · critério {index + 1}
                  <select aria-label={`Operador de data · critério ${index + 1}`} value={form.dateOperator}
                    onChange={event => { const value = event.currentTarget.value as CriterioEdicao["dateOperator"];
                      alterarCriterio(item.criterionId, previous => ({ ...previous, dateOperator: value })); }}>
                    <option value="ON_OR_AFTER">Em ou após</option><option value="ON_OR_BEFORE">Em ou antes</option>
                  </select>
                </label>
                <label>Data do critério · critério {index + 1}
                  <input aria-label={`Data do critério · critério ${index + 1}`} type="date" value={form.dateValue}
                    onChange={event => { const value = event.currentTarget.value;
                      alterarCriterio(item.criterionId, previous => ({ ...previous, dateValue: value })); }} />
                </label>
              </> : null}
            </div>
          </fieldset>;
        })}
      </section>

      {contexto ? <section className="estudos-panel__facts" aria-label="Fatos clínicos confirmados para vinculação">
        <h4>Fatos disponíveis na consulta (somente leitura)</h4>
        <p>Os valores abaixo apenas orientam a revisão da chave do fato; não são enviados no pedido de avaliação.</p>
        {!fatosDaConsulta.length ? <p>Nenhum fato confirmado/conflictado disponibilizado para esta consulta.</p> : null}
        {fatosDaConsulta.map((fact, index) => <article key={`${fact.factKey}-${index}`}>
          <strong>{fact.factKey}</strong><span>{formatarValorFact(fact)}</span>
          {fact.status === "CONFIRMADO" ? <EvidenceList refs={[fact.source]} /> : <EvidenceList refs={fact.sources} />}
        </article>)}
      </section> : <p>Selecione uma consulta para comparar critérios com fatos clínicos confirmados.</p>}
      <div className="estudos-panel__actions">
        <button type="button" disabled={bloqueado} onClick={() => void revisar("CONFIRMAR")}>Confirmar estudo revisado</button>
        <button type="button" disabled={bloqueado} onClick={() => void revisar("REJEITAR")}>Rejeitar estudo</button>
      </div>
    </section> : null}
  </section>;
}

function EvidenceList({ refs }: { refs: EvidenceRef[] }) {
  return <ul className="estudos-panel__evidence">{refs.map((item, index) => <li key={`${item.sourceId}-${item.locator}-${index}`}>
    <p><strong>Trecho exato · {item.locator}</strong></p>
    <blockquote>{item.exactText}</blockquote>
    <details><summary>Proveniência e integridade</summary><p>{item.sourceRef} · {item.sourceId}</p><code>SHA-256 {item.contentHash}</code></details>
  </li>)}</ul>;
}
