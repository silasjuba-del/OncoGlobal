import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  ApacRascunhoConfirmadoSchema,
  ApacRascunhoPreparadoSchema,
  BaseApacRascunhoRespostaSchema,
  ConfirmarApacRascunhoPedidoSchema,
  EdicaoApacRascunhoSchema,
  type ApacRascunhoPreparado,
  type BaseApacRascunhoResposta,
  type EdicaoApacRascunho,
} from "../../contracts/api/apacRascunho.js";
import type { PortaConsulta } from "../api/porta.js";
import type { ContextoAcaoComposta } from "../../contracts/api/acoesCompostas.js";
// @ts-expect-error folha CSS pura, resolvida pelo Vite
import "./prescricao-executavel.css";
// @ts-expect-error folha CSS pura, resolvida pelo Vite
import "./apac-rascunho.css";

type VisualizacaoPrevia = { resposta: ApacRascunhoPreparado; fingerprint: string };

const CAMPOS_TEXTO = [
  ["procedimentoPrincipal", "Procedimento principal"],
  ["pacienteCns", "CNS do paciente"],
  ["nomeMae", "Nome da mãe"],
  ["nomeEstabelecimento", "Nome do estabelecimento"],
  ["cnesSolicitante", "CNES do solicitante"],
  ["solicitanteNome", "Nome do médico solicitante"],
  ["solicitanteCns", "CNS do solicitante"],
] as const;

function mensagemErroApac(erro: unknown): string {
  const codigo = erro instanceof Error ? erro.message : "";
  const mensagens: Record<string, string> = {
    BASE_APAC_PENDENTE: "Faltam fontes confirmadas ou a prescrição assinada não está disponível. Confira as pendências da base.",
    BASE_APAC_ALTERADA: "A base da APAC mudou. Atualize os dados, confira os campos e prepare uma nova prévia.",
    APAC_VIGENTE_AMBIGUA: "Há mais de uma APAC para esta prescrição e competência. Confira o histórico antes de continuar.",
    APAC_RESULTADO_EXTERNO_PRESERVADO: "Esta APAC já tem estado ou resultado externo e não pode ser substituída por um rascunho.",
    PREVIA_APAC_DESATUALIZADA: "A prévia ficou desatualizada. Atualize a base e prepare novamente.",
    APAC_TRANSACAO_NEGADA: "A APAC não foi salva. Atualize a base e confira novamente os dados.",
  };
  return mensagens[codigo] ?? "Não foi possível concluir a operação da APAC. Os campos administrativos foram preservados.";
}

function fingerprint(contexto: ContextoAcaoComposta, baseHash: string, edicao: EdicaoApacRascunho): string {
  return JSON.stringify([chaveSemanticaContexto(contexto), baseHash, edicao]);
}

function chaveSemanticaContexto(contexto: ContextoAcaoComposta): string {
  return JSON.stringify([contexto.patientId, contexto.encounterId, contexto.tumorLotId]);
}

export function PrepararApacConsulta({ porta, contexto, aberto, ocupado = false, aoAtualizarClinico,
  aoAlterarPendente, aoAlterarSalvando }: {
  porta: PortaConsulta;
  contexto: ContextoAcaoComposta;
  aberto: boolean;
  ocupado?: boolean;
  aoAtualizarClinico?: () => void;
  aoAlterarPendente?: (pendente: boolean) => void;
  aoAlterarSalvando?: (salvando: boolean) => void;
}) {
  const [base, setBase] = useState<BaseApacRascunhoResposta | null>(null);
  const [edicao, setEdicao] = useState<EdicaoApacRascunho | null>(null);
  const [previa, setPrevia] = useState<VisualizacaoPrevia | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salva, setSalva] = useState(false);
  const aoAlterarPendenteAtual = useRef(aoAlterarPendente);
  aoAlterarPendenteAtual.current = aoAlterarPendente;
  const aoAlterarSalvandoAtual = useRef(aoAlterarSalvando);
  aoAlterarSalvandoAtual.current = aoAlterarSalvando;
  const geracao = useRef(0);
  const chaveContexto = chaveSemanticaContexto(contexto);
  const contextoAtual = useRef(chaveContexto);
  contextoAtual.current = chaveContexto;
  const contextoCarregado = useRef(chaveContexto);
  const portaCarregada = useRef(porta);
  const abortAtual = useRef<AbortController | null>(null);
  const edicaoAtual = useRef<EdicaoApacRascunho | null>(null);
  const tentativaPreparo = useRef<{ fingerprint: string; id: string } | null>(null);
  const tentativaConfirmacao = useRef<{ fingerprint: string; id: string } | null>(null);
  const fingerprintAtual = edicao && base ? fingerprint(contexto, base.revisao, edicao) : "";
  const atual = previa && previa.fingerprint === fingerprintAtual ? previa : null;
  const bloqueado = ocupado || carregando || salvando;

  edicaoAtual.current = edicao;

  async function carregarBase(preservarEdicao: boolean) {
    if (!porta.lerBaseApacRascunho) {
      setErro("A leitura da base administrativa da APAC não está disponível nesta porta.");
      setCarregando(false);
      return;
    }
    const token = ++geracao.current;
    abortAtual.current?.abort();
    const abort = new AbortController();
    abortAtual.current = abort;
    setCarregando(true); setErro(""); setMensagem(""); setPrevia(null); setSalva(false);
    tentativaPreparo.current = null; tentativaConfirmacao.current = null;
    try {
      const resposta = BaseApacRascunhoRespostaSchema.parse(
        await porta.lerBaseApacRascunho(contexto, abort.signal));
      const ctx = chaveSemanticaContexto(resposta.contexto);
      if (token !== geracao.current || ctx !== contextoAtual.current) return;
      if (resposta.contexto.patientId !== contexto.patientId || resposta.contexto.encounterId !== contexto.encounterId
        || resposta.contexto.tumorLotId !== contexto.tumorLotId) throw new Error("CONTEXTO_APAC_ALTERADO");
      setBase(resposta);
      if (!preservarEdicao || !edicaoAtual.current) setEdicao(resposta.sugestao);
      setMensagem(preservarEdicao ? "Base atualizada. A prévia anterior foi descartada; confira e prepare novamente." : "");
    } catch (cause) {
      if (token === geracao.current && !abort.signal.aborted) setErro(mensagemErroApac(cause));
    } finally {
      if (token === geracao.current) setCarregando(false);
    }
  }

  useEffect(() => {
    const chave = chaveContexto;
    const mudouContexto = contextoCarregado.current !== chave;
    const mudouPorta = portaCarregada.current !== porta;
    if (mudouContexto || mudouPorta) {
      contextoCarregado.current = chave;
      portaCarregada.current = porta;
      geracao.current++;
      abortAtual.current?.abort();
      setBase(null); setEdicao(null); setPrevia(null); setMensagem(""); setErro(""); setSalva(false);
      setCarregando(false); setSalvando(false);
      aoAlterarPendenteAtual.current?.(false); aoAlterarSalvandoAtual.current?.(false);
      tentativaPreparo.current = null; tentativaConfirmacao.current = null;
    }
    if (!aberto) {
      geracao.current++;
      abortAtual.current?.abort();
      setCarregando(false);
      setSalvando(false);
      aoAlterarPendenteAtual.current?.(false); aoAlterarSalvandoAtual.current?.(false);
      return;
    }
    if (!base || mudouContexto || mudouPorta) void carregarBase(false);
    return () => {
      geracao.current++;
      abortAtual.current?.abort();
      aoAlterarPendenteAtual.current?.(false); aoAlterarSalvandoAtual.current?.(false);
    };
  }, [porta, chaveContexto, aberto]);

  function alterarCompetencia(value: string) {
    if (!edicao || value === edicao.competencia) return;
    setEdicao({ ...edicao, competencia: value });
    setPrevia(null); setSalva(false); setErro(""); setMensagem("");
    aoAlterarPendenteAtual.current?.(true);
  }

  function alterarCampo(campo: keyof EdicaoApacRascunho["campos"], value: string | number | null) {
    if (!edicao || Object.is(edicao.campos[campo], value)) return;
    setEdicao({ ...edicao, campos: { ...edicao.campos, [campo]: value } });
    setPrevia(null); setSalva(false); setErro(""); setMensagem("");
    aoAlterarPendenteAtual.current?.(true);
  }

  async function preparar() {
    if (bloqueado || !base || !edicao || !base.prescricao || !porta.prepararApacRascunho) return;
    const validacao = EdicaoApacRascunhoSchema.safeParse(edicao);
    if (!validacao.success) { setErro("Revise competência e campos administrativos antes de preparar a prévia."); return; }
    const fingerprintPedido = fingerprint(contexto, base.revisao, validacao.data);
    if (tentativaPreparo.current?.fingerprint !== fingerprintPedido)
      tentativaPreparo.current = { fingerprint: fingerprintPedido, id: globalThis.crypto.randomUUID() };
    const token = geracao.current;
    setSalvando(true); aoAlterarSalvandoAtual.current?.(true); setErro(""); setMensagem(""); setPrevia(null);
    try {
      const pedido = { contexto, expectedBaseHash: base.revisao,
        idempotencyKey: tentativaPreparo.current.id, edicao: validacao.data };
      const resposta = ApacRascunhoPreparadoSchema.parse(await porta.prepararApacRascunho(pedido));
      if (token !== geracao.current || contextoAtual.current !== chaveSemanticaContexto(contexto)) return;
      if (chaveSemanticaContexto(resposta.contexto) !== chaveSemanticaContexto(contexto) || resposta.baseHash !== base.revisao
        || resposta.apac.estado !== "RASCUNHO" || resposta.apac.resultadoExterno !== null || resposta.permiteExportar !== false)
        throw new Error("BASE_APAC_ALTERADA");
      setPrevia({ resposta, fingerprint: fingerprintPedido });
      setMensagem("");
    } catch (cause) {
      if (token === geracao.current) setErro(mensagemErroApac(cause));
    } finally {
      if (token === geracao.current) { setSalvando(false); aoAlterarSalvandoAtual.current?.(false); }
    }
  }

  async function confirmar() {
    if (!atual || !base || !edicao || !porta.confirmarApacRascunho || bloqueado) return;
    const token = geracao.current, fingerprintPedido = atual.fingerprint, resposta = atual.resposta;
    if (tentativaConfirmacao.current?.fingerprint !== fingerprintPedido)
      tentativaConfirmacao.current = { fingerprint: fingerprintPedido, id: globalThis.crypto.randomUUID() };
    setSalvando(true); aoAlterarSalvandoAtual.current?.(true); setErro(""); setMensagem("");
    try {
      const pedido = ConfirmarApacRascunhoPedidoSchema.parse({ contexto, draftId: resposta.draftId,
        expectedRevision: resposta.revision, conteudoHash: resposta.conteudoHash,
        idempotencyKey: tentativaConfirmacao.current.id });
      const confirmada = ApacRascunhoConfirmadoSchema.parse(await porta.confirmarApacRascunho(pedido));
      if (token !== geracao.current || contextoAtual.current !== chaveSemanticaContexto(contexto)) return;
      if (confirmada.apacId !== resposta.apac.apacId || confirmada.versao !== resposta.apac.versao
        || confirmada.estado !== "RASCUNHO" || confirmada.permiteExportar !== false)
        throw new Error("APAC_CONFIRMACAO_DIVERGENTE");
      setSalva(true);
      aoAlterarPendenteAtual.current?.(false);
      setMensagem("APAC salva como RASCUNHO. Emissão, exportação e autorização são etapas separadas.");
      setBase(current => current ? { ...current, existentes: [
        ...current.existentes.filter(item => item.apacId !== confirmada.apacId),
        { apacId: confirmada.apacId, versao: confirmada.versao, competencia: resposta.apac.competencia,
          estado: "RASCUNHO" },
      ] } : current);
      aoAtualizarClinico?.();
    } catch (cause) {
      if (token === geracao.current) setErro(mensagemErroApac(cause));
    } finally {
      if (token === geracao.current) { setSalvando(false); aoAlterarSalvandoAtual.current?.(false); }
    }
  }

  if (!aberto) return null;

  return <section className="prescricao-executavel" aria-label="Preparação de APAC em rascunho" aria-busy={bloqueado}>
    <header className="prescricao-executavel__header">
      <div><p className="prescricao-executavel__eyebrow">APAC · DOCUMENTO ADMINISTRATIVO</p>
        <h2>Preparar APAC em rascunho</h2>
        <p>A referência é a versão exata da prescrição assinada. Salvar não emite, exporta nem autoriza.</p>
      </div>
      {base?.prescricao ? <span className="prescricao-executavel__revision">eRx v{base.prescricao.documentVersion}</span> : null}
    </header>

    {carregando ? <p role="status">Carregando fontes administrativas da APAC…</p> : null}
    {erro ? <p role="alert">{erro}</p> : null}
    {mensagem ? <p role="status">{mensagem}</p> : null}

    {base ? <>
      {base.prescricao ? <section aria-label="Prescrição assinada vinculada">
        <h3>Prescrição assinada vinculada</h3>
        <dl className="apac-rascunho__source-list">
          <dt>Versão assinada</dt><dd>v{base.prescricao.documentVersion}</dd>
          <dt>Esquema</dt><dd>{base.prescricao.protocoloId}</dd>
          <dt>Data prevista</dt><dd>{base.prescricao.dataPrevista}</dd>
        </dl>
        <details className="apac-rascunho__trace">
          <summary>Rastreabilidade</summary>
          <dl className="apac-rascunho__source-list">
            <dt>Documento da prescrição</dt><dd>{base.prescricao.documentId}</dd>
          </dl>
        </details>
      </section> : <p role="status">Prescrição assinada indisponível; o preparo da APAC fica bloqueado.</p>}

      {base.existentes.length ? <section aria-label="APACs existentes">
        <h3>APACs existentes neste lote</h3>
        <ul>{base.existentes.map(item => <li key={item.apacId}>v{item.versao} · {item.competencia} · {item.estado}
          <details className="apac-rascunho__trace"><summary>Rastreabilidade</summary><p>{item.apacId}</p></details>
        </li>)}</ul>
      </section> : null}

      <section aria-label="Campos clínicos da fonte" className="prescricao-executavel__section">
        <h3>Campos clínicos da fonte · somente leitura</h3>
        <dl className="apac-rascunho__source-list">{base.camposClinicos.map(field => <div key={field.chave} className="apac-rascunho__source-field">
          <dt>{field.rotulo}</dt><dd>{field.valor ?? "Não informado"}</dd>
        </div>)}</dl>
      </section>

      {base.pendencias.length ? <section aria-label="Pendências da base APAC" role="status">
        <h3>Pendências da base</h3><ul>{base.pendencias.map((item, index) => <li key={`base-pendencia-${index}`}>{item}</li>)}</ul>
      </section> : null}

      {edicao ? <fieldset className="prescricao-executavel__section" disabled={bloqueado} aria-label="Campos administrativos da APAC">
        <legend>Campos administrativos editáveis</legend>
        <div className="apac-rascunho__form-grid">
        <label>Competência da APAC
          <input aria-label="Competência da APAC" type="month" value={edicao.competencia}
            onChange={event => alterarCompetencia(event.currentTarget.value)} />
        </label>
        {CAMPOS_TEXTO.map(([campo, label]) => <label key={campo}>{label}
          <input aria-label={label} value={edicao.campos[campo] ?? ""}
            onChange={(event: ChangeEvent<HTMLInputElement>) => alterarCampo(campo, event.currentTarget.value || null)} />
        </label>)}
        <label>Justificativa
          <textarea aria-label="Justificativa" rows={3} maxLength={4000} value={edicao.campos.justificativa ?? ""}
            onChange={event => alterarCampo("justificativa", event.currentTarget.value || null)} />
        </label>
        <label>Descrição do diagnóstico
          <textarea aria-label="Descrição do diagnóstico" rows={3} maxLength={4000} value={edicao.campos.descricaoDiagnostico ?? ""}
            onChange={event => alterarCampo("descricaoDiagnostico", event.currentTarget.value || null)} />
        </label>
        <label>Quantidade do procedimento principal
          <input aria-label="Quantidade do procedimento principal" type="number" min="1" step="1"
            value={edicao.campos.quantidadePrincipal ?? ""}
            onChange={event => alterarCampo("quantidadePrincipal", event.currentTarget.value ? Number(event.currentTarget.value) : null)} />
        </label>
        <label>Nascimento do paciente
          <input aria-label="Nascimento do paciente" type="date" value={edicao.campos.pacienteNascimento ?? ""}
            onChange={event => alterarCampo("pacienteNascimento", event.currentTarget.value || null)} />
        </label>
        <label>Sexo cadastral do paciente
          <select aria-label="Sexo cadastral do paciente" value={edicao.campos.pacienteSexo ?? ""}
            onChange={event => alterarCampo("pacienteSexo", event.currentTarget.value === "M" || event.currentTarget.value === "F"
              ? event.currentTarget.value : null)}>
            <option value="">Não informado</option><option value="F">F</option><option value="M">M</option>
          </select>
        </label>
        </div>
        <button type="button" disabled={bloqueado || !porta.lerBaseApacRascunho} onClick={() => void carregarBase(true)}>
          Atualizar base da APAC
        </button>
      </fieldset> : null}

      <button type="button" disabled={bloqueado || !base.prescricao || !edicao || !porta.prepararApacRascunho}
        onClick={() => void preparar()}>Preparar prévia exata da APAC</button>

      {atual ? <section aria-label="Prévia exata da APAC" className="prescricao-executavel__preview">
        <h3>APAC RASCUNHO · versão {atual.resposta.apac.versao}</h3>
        <p>Prescrição assinada vinculada · versão {atual.resposta.apac.prescricaoAssinadaRef.documentVersion}</p>
        <details className="apac-rascunho__trace">
          <summary>Rastreabilidade da APAC</summary>
          <dl className="apac-rascunho__source-list">
            <dt>Identificador da APAC</dt><dd>{atual.resposta.apac.apacId}</dd>
            <dt>Documento da prescrição</dt><dd>{atual.resposta.apac.prescricaoAssinadaRef.documentId}</dd>
            <dt>Versão do documento</dt><dd>{atual.resposta.apac.prescricaoAssinadaRef.documentVersion}</dd>
            <dt>Hash do conteúdo</dt><dd>{atual.resposta.conteudoHash}</dd>
            <dt>Revisão</dt><dd>{atual.resposta.revision}</dd>
          </dl>
        </details>
        <p>Permite exportar: não</p>
        <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{atual.resposta.texto}</pre>
        {atual.resposta.pendencias.length ? <div><h4>Pendências</h4><ul>
          {atual.resposta.pendencias.map((item, index) => <li key={`preview-pendencia-${index}`}>{item}</li>)}
        </ul></div> : null}
        {atual.resposta.avisos.length ? <div><h4>Avisos</h4><ul>
          {atual.resposta.avisos.map((item, index) => <li key={`preview-aviso-${index}`}>{item}</li>)}
        </ul></div> : null}
        <p>Este preparo permanece em rascunho; emissão, exportação e autorização são etapas separadas.</p>
        <button type="button" disabled={bloqueado || salva || !porta.confirmarApacRascunho}
          onClick={() => void confirmar()}>Salvar APAC em rascunho</button>
      </section> : null}
    </> : null}
  </section>;
}
