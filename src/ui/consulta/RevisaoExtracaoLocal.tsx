import { useEffect, useRef, useState } from "react";
import type { PortaConsulta, PedidoBundle } from "../api/porta.js";
import type { FonteRevisao, PedidoRevisaoExtracao, RevisaoPreparada } from "../api/revisaoExtracao.js";

/** Linked sources are reviewed locally, independently of provider availability. */
export function RevisaoExtracaoLocal({ porta, contexto }: { porta: PortaConsulta; contexto: PedidoBundle }) {
  const [fontes, setFontes] = useState<Array<{ draftId: string; rotulo: string }>>([]);
  const [fonte, setFonte] = useState<FonteRevisao["draft"] | null>(null);
  const [ids, setIds] = useState<string[]>([]);
  const [preparada, setPreparada] = useState<{ pedido: PedidoRevisaoExtracao; resposta: RevisaoPreparada } | null>(null);
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
    setFonte(null); setIds([]); setPreparada(null); setConcluida(false); setFontes([]); setMensagem("");
    emCurso.current = false; setOcupado(false);
    if (porta.oncoassistFontes && porta.carregarFonteRevisao) {
      void porta.oncoassistFontes({ patientId, encounterId, tumorLotId }, abort.signal)
        .then((r) => { if (atual === geracao.current) setFontes(r.fontes); })
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
    catch { if (atual === geracao.current) setMensagem("A operação não foi concluída. Reabra a fonte se ela ou a consulta mudou."); }
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
    <label>Fonte para revisão <select aria-label="Fonte para revisão" disabled={ocupado}
      onChange={(e) => void abrir(e.target.value)} defaultValue="">
      <option value="">Selecione uma fonte</option>
      {fontes.map((f) => <option key={f.draftId} value={f.draftId}>{f.rotulo}</option>)}
    </select></label>
    {fonte ? <>
      <h3>Texto original</h3><pre style={{ whiteSpace: "pre-wrap" }}>{fonte.payload.input.rawTranscript}</pre>
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
