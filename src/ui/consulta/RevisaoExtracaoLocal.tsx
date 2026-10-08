import { useEffect, useRef, useState } from "react";
import type { PortaConsulta, PedidoBundle } from "../api/porta.js";
import type { FonteRevisao, PedidoRevisaoExtracao, ReconciliacaoProposta, RevisaoPreparada } from "../api/revisaoExtracao.js";
import { ErroPorta } from "../api/porta.js";

/** Linked sources are reviewed locally, independently of provider availability. */
export function RevisaoExtracaoLocal({ porta, contexto, patientLabel }: {
  porta: PortaConsulta; contexto: PedidoBundle; patientLabel?: string;
}) {
  const [fontes, setFontes] = useState<Array<{ draftId: string; rotulo: string }>>([]);
  const [fontesSemVinculo, setFontesSemVinculo] = useState<Array<{ draftId: string; sourceId: string;
    segmentId: string | null; exceptionId: string | null; rotulo: string; criadoEm: string; revision: number; textoOriginal: string }>>([]);
  const [fontePendenteId, setFontePendenteId] = useState("");
  const [fonte, setFonte] = useState<FonteRevisao["draft"] | null>(null);
  const [ids, setIds] = useState<string[]>([]);
  const [preparada, setPreparada] = useState<{ pedido: PedidoRevisaoExtracao; resposta: RevisaoPreparada } | null>(null);
  const [fontesSelecionadas, setFontesSelecionadas] = useState<string[]>([]);
  const [reconciliacao, setReconciliacao] = useState<ReconciliacaoProposta | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [concluida, setConcluida] = useState(false);
  const geracao = useRef(0);
  const emCurso = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const { patientId, encounterId, tumorLotId } = contexto;

  useEffect(() => {
    const atual = ++geracao.current;
    const abort = new AbortController();
    controller.current = abort;
    setFonte(null); setIds([]); setPreparada(null); setConcluida(false); setFontes([]);
    setFontesSemVinculo([]); setFontePendenteId(""); setFontesSelecionadas([]); setReconciliacao(null); setMensagem("");
    emCurso.current = false; setOcupado(false);
    if (porta.oncoassistFontes && porta.carregarFonteRevisao) {
      void porta.oncoassistFontes({ patientId, encounterId, tumorLotId }, abort.signal)
        .then((r) => { if (atual === geracao.current) {
          setFontes(r.fontes); setFontesSemVinculo(r.fontesSemVinculo ?? []);
        } })
        .catch(() => { if (atual === geracao.current) setMensagem("Não foi possível carregar as fontes locais."); });
    }
    return () => { geracao.current++; abort.abort(); };
  }, [porta, patientId, encounterId, tumorLotId]);

  function mesmoContexto(c: { patientId: string; encounterId: string; tumorLotId: string | null }) {
    return c.patientId === patientId && c.encounterId === encounterId && c.tumorLotId === (tumorLotId ?? null);
  }

  async function executar(acao: (atual: number) => Promise<void>) {
    if (emCurso.current) return;
    emCurso.current = true; setOcupado(true); setMensagem("");
    const atual = geracao.current;
    try { await acao(atual); }
    catch (error) { if (atual === geracao.current) setMensagem(error instanceof ErroPorta
      ? `A operação não foi concluída (${error.codigo}). Reconfira a fonte e o contexto.`
      : "A operação não foi concluída. Reabra a fonte se ela ou a consulta mudou."); }
    finally { if (atual === geracao.current) { emCurso.current = false; setOcupado(false); } }
  }

  async function abrir(draftId: string) {
    setFonte(null); setIds([]); setPreparada(null); setConcluida(false);
    if (!draftId || !porta.carregarFonteRevisao) return;
    await executar(async (atual) => {
      const r = await porta.carregarFonteRevisao!(draftId, controller.current?.signal);
      if (atual !== geracao.current) return;
      if (r.draft.draftId !== draftId || r.draft.patientId !== patientId || !mesmoContexto(r.draft.payload.patientLinkReview))
        throw new Error("CONTEXTO_DIVERGENTE");
      setFonte(r.draft);
    });
  }

  async function vincularFontePendente() {
    const pendente = fontesSemVinculo.find((item) => item.draftId === fontePendenteId);
    if (!pendente || !porta.vincularFonteRevisao) return;
    if (!pendente.exceptionId) { setMensagem("A exceção de vínculo não consta nesta fonte; o vínculo segue pendente."); return; }
    await executar(async (atual) => {
      const idempotencyKey = ["review-link", pendente.draftId, pendente.revision, patientId,
        encounterId, tumorLotId ?? "sem-lote"].join(":");
      const resultado = await porta.vincularFonteRevisao!({ exceptionId: pendente.exceptionId!,
        acao: "LIGAR_PACIENTE", patientId, sourceId: pendente.sourceId, draftId: pendente.draftId,
        expectedRevision: pendente.revision, encounterId, tumorLotId: tumorLotId ?? null,
        idempotencyKey }, controller.current?.signal);
      if (atual !== geracao.current) return;
      const atualizadas = await porta.oncoassistFontes?.({ patientId, encounterId, tumorLotId }, controller.current?.signal);
      if (atual !== geracao.current) return;
      setFontes(atualizadas?.fontes ?? fontes);
      setFontesSemVinculo(atualizadas?.fontesSemVinculo ?? []);
      setFontePendenteId("");
      setMensagem(`Vínculo explícito registrado (${resultado.codigo}). A fonte permanece em revisão médica.`);
    });
  }

  async function preparar() {
    if (!fonte || !ids.length || !porta.prepararRevisaoExtracao) return;
    setPreparada(null);
    const pedido = { draftId: fonte.draftId, expectedRevision: fonte.revision, patientId,
      factIds: [...ids], operationId: crypto.randomUUID() };
    await executar(async (atual) => {
      const resposta = await porta.prepararRevisaoExtracao!(pedido, controller.current?.signal);
      if (atual !== geracao.current) return;
      if (!mesmoContexto(resposta.conteudo.contexto)
        || JSON.stringify(resposta.conteudo.selectedFactIds) !== JSON.stringify(ids)) throw new Error("SELECAO_DIVERGENTE");
      setPreparada({ pedido, resposta });
    });
  }

  async function reconciliar() {
    if (fontesSelecionadas.length < 2 || !porta.reconciliarFontes) return;
    setReconciliacao(null);
    await executar(async (atual) => {
      const resultado = await porta.reconciliarFontes!(fontesSelecionadas, controller.current?.signal);
      if (atual !== geracao.current) return;
      if (resultado.decisaoClinicaTomada || resultado.contexto.patientId !== patientId
        || resultado.contexto.encounterId !== encounterId
        || resultado.contexto.tumorLotId !== (tumorLotId ?? null)) throw new Error("ESCOPO_RECONCILIACAO_DIVERGENTE");
      setReconciliacao(resultado);
    });
  }

  async function confirmar() {
    if (!preparada || !porta.confirmarRevisaoExtracao || concluida) return;
    await executar(async (atual) => {
      await porta.confirmarRevisaoExtracao!({ ...preparada.pedido,
        comprovanteExibicao: preparada.resposta.comprovanteExibicao }, controller.current?.signal);
      if (atual !== geracao.current) return;
      setConcluida(true); setMensagem("Revisão registrada. Candidatos incertos conservam sua pendência.");
    });
  }

  if (!porta.carregarFonteRevisao) return null;
  return <section aria-label="Revisão clínica da extração">
    <h2>Revisar extração</h2>
    <p>Selecione os achados, confira o resumo e registre sua revisão.</p>
    {mensagem ? <p role="status">{mensagem}</p> : null}
    {fontesSemVinculo.length ? <section aria-label="Fontes sem vínculo">
      <h3>Trechos sem paciente vinculado</h3>
      <p>O vínculo exige sua escolha explícita. Confira o trecho original antes de associá-lo a {patientLabel ?? patientId} ({patientId}).</p>
      <label>Trecho sem vínculo <select aria-label="Trecho sem vínculo" disabled={ocupado}
        value={fontePendenteId} onChange={(e) => setFontePendenteId(e.target.value)}>
        <option value="">Selecione uma fonte</option>
        {fontesSemVinculo.map((item) => <option key={item.draftId} value={item.draftId}>{item.rotulo} · {item.sourceId}</option>)}
      </select></label>
      {fontesSemVinculo.find((item) => item.draftId === fontePendenteId) ? <>
        <h4>Texto original da fonte</h4>
        <pre style={{ whiteSpace: "pre-wrap" }}>{fontesSemVinculo.find((item) => item.draftId === fontePendenteId)!.textoOriginal}</pre>
        <button type="button" disabled={ocupado || !porta.vincularFonteRevisao
          || !fontesSemVinculo.find((item) => item.draftId === fontePendenteId)?.exceptionId}
          onClick={() => void vincularFontePendente()}>Confirmar vínculo deste trecho com {patientLabel ?? patientId} · {patientId}</button>
      </> : null}
    </section> : null}
    {fontes.length >= 2 && porta.reconciliarFontes ? <section aria-label="Reconciliar fontes vinculadas">
      <h3>Confrontar fontes da consulta</h3>
      <p>A comparação é uma proposta. Fatos repetidos permanecem disponíveis; nenhum regime ou conflito é resolvido automaticamente.</p>
      <fieldset disabled={ocupado}><legend>Fontes explicitamente vinculadas</legend>
        {fontes.map((item) => <label key={item.draftId} style={{ display: "block" }}>
          <input type="checkbox" checked={fontesSelecionadas.includes(item.draftId)} onChange={(e) => {
            setReconciliacao(null);
            setFontesSelecionadas((antes) => e.target.checked ? [...antes, item.draftId]
              : antes.filter((id) => id !== item.draftId));
          }} />{item.rotulo} · {item.draftId}
        </label>)}
      </fieldset>
      <button type="button" disabled={ocupado || fontesSelecionadas.length < 2}
        onClick={() => void reconciliar()}>Confrontar fontes selecionadas</button>
    </section> : null}
    {reconciliacao ? <section aria-label="Proposta de reconciliação">
      <h3>Proposta de reconciliação · revisão médica pendente</h3>
      <p>Encontro {reconciliacao.contexto.encounterId} · data clínica comum {reconciliacao.contexto.dataClinica}. Nenhum fato foi gravado.</p>
      {reconciliacao.conflitos.length ? <section aria-label="Conflitos preservados">
        <h4>Conflitos preservados para decisão</h4>
        <ul>{reconciliacao.conflitos.map((item) => <li key={item.id}>{item.reason}
          <small> Fontes: {item.sourceIds.join(", ")} · fatos: {item.factIds.join(", ")}</small></li>)}</ul>
      </section> : <p>Nenhum conflito explícito encontrado neste conjunto.</p>}
      {reconciliacao.deduplicacao.repeticoes.length || reconciliacao.deduplicacao.versoesDiscordantes.length
        ? <section aria-label="Repetições propostas">
          <h4>Repetições/versões propostas — fontes preservadas</h4>
          {reconciliacao.deduplicacao.repeticoes.map((item) => <p key={item.chaveExame}>
            PENDENTE_REVISAO · {item.fatoPrincipalIds.length} fato(s) principal(is), {item.fatoRepetidoIds.length} repetido(s) · fontes {item.fontes.map((fonte) => fonte.sourceId).join(", ")}
          </p>)}
          {reconciliacao.deduplicacao.versoesDiscordantes.map((item) => <p key={item.chaveExame}>
            Versões discordantes · fatos {item.factIds.join(", ")}
          </p>)}
        </section> : <p>Nenhuma repetição documental proposta.</p>}
      <details><summary>Fatos e trechos preservados ({reconciliacao.fatos.length})</summary>
        <ul>{reconciliacao.fatos.map((fact) => <li key={fact.id}>{fact.domain} · {fact.rawEvidence}
          <small> Fonte {fact.sourceId} · segmento {fact.segmentId} · {fact.evidence}{fact.requiresConfirmation ? " · confirmação pendente" : ""}</small>
        </li>)}</ul>
      </details>
    </section> : null}
    <label>Fonte para revisão <select aria-label="Fonte para revisão" disabled={ocupado}
      onChange={(e) => void abrir(e.target.value)} defaultValue="">
      <option value="">Selecione uma fonte</option>
      {fontes.map((f) => <option key={f.draftId} value={f.draftId}>{f.rotulo}</option>)}
    </select></label>
    {fonte ? <>
      {fonte.payload.patientLinkReview.segmentId
        ? <p>Trecho vinculado explicitamente: {fonte.payload.patientLinkReview.segmentId}</p> : null}
      <h3>Texto original</h3><pre style={{ whiteSpace: "pre-wrap" }}>{fonte.payload.input.rawTranscript}</pre>
      {fonte.payload.alertasRads?.length ? <section aria-label="Alertas RADS para revisão">
        <h3>Alertas de imagem — confirmação médica pendente</h3>
        {fonte.payload.alertasRads.map((a, i) => <p key={i}>{a.nome}: {a.trecho} — fonte {a.sourceId}</p>)}
      </section> : null}
      <fieldset disabled={ocupado || concluida}><legend>Achados para revisão</legend>
        {fonte.payload.state.facts.map((fact) => <label key={fact.id} style={{ display: "block" }}>
          <input type="checkbox" checked={ids.includes(fact.id)} onChange={(e) => {
            setPreparada(null); setIds((antes) => e.target.checked ? [...antes, fact.id] : antes.filter((id) => id !== fact.id));
          }} />{fact.rawEvidence} — {fact.evidence}{fact.requiresConfirmation ? " · confirmação adicional pendente" : ""}
        </label>)}
      </fieldset>
      <button type="button" disabled={ocupado || concluida || ids.length === 0} onClick={() => void preparar()}>Preparar revisão</button>
    </> : null}
    {preparada ? <section aria-label="Conteúdo preparado para revisão">
      <h3>Resumo dos achados selecionados</h3><pre style={{ whiteSpace: "pre-wrap" }}>{preparada.resposta.conteudo.resumo}</pre>
      <details><summary>Fatos, fontes e contexto desta revisão</summary>
        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(preparada.resposta.conteudo, null, 2)}</pre>
      </details>
      <button type="button" disabled={ocupado || concluida} onClick={() => void confirmar()}>Confirmar revisão exibida</button>
    </section> : null}
  </section>;
}
