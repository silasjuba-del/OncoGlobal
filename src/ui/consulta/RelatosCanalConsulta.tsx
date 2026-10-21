import { useId, useState } from "react";
import type { ContextoAcaoComposta } from "../../contracts/api/acoesCompostas.js";
import type { MensagemCanalVisao } from "../api/porta.js";
// @ts-expect-error folha CSS pura, resolvida pelo Vite
import "./relatos-canal.css";

type Expansao = { contexto: string; aberto: boolean };

function chaveContexto(contexto: ContextoAcaoComposta): string {
  return JSON.stringify([contexto.patientId, contexto.encounterId, contexto.tumorLotId]);
}

function formatarHorarioCanal(instante: string): string | null {
  const ms = Date.parse(instante);
  if (!Number.isFinite(ms)) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo",
  }).format(new Date(ms));
}

function origemHumana(origem: MensagemCanalVisao["origemCanal"]): string {
  switch (origem) {
    case "WHATSAPP_SERVICO": return "WhatsApp do serviço";
    case "WHATSAPP_PESSOAL": return "WhatsApp pessoal";
    case "EMAIL": return "E-mail";
    case "TELEFONE": return "Telefone";
    default: return "Origem não informada";
  }
}

function ordenarPorHorarioCanal(mensagens: readonly MensagemCanalVisao[]): MensagemCanalVisao[] {
  return mensagens.map((mensagem, indice) => ({ mensagem, indice })).sort((a, b) => {
    const ta = Date.parse(a.mensagem.em), tb = Date.parse(b.mensagem.em);
    const va = Number.isFinite(ta), vb = Number.isFinite(tb);
    if (va && vb) return tb - ta || a.indice - b.indice;
    if (va !== vb) return va ? -1 : 1;
    return a.indice - b.indice;
  }).map(item => item.mensagem);
}

function Relato({ mensagem }: { mensagem: MensagemCanalVisao }) {
  const horarioCanal = formatarHorarioCanal(mensagem.em);
  return <li>
    <article className="relatos-canal__relato">
      <div className="relatos-canal__meta">
        <span>{origemHumana(mensagem.origemCanal)}</span>
        <span>Horário do canal: <time dateTime={mensagem.em}>{horarioCanal ?? "Horário do canal ilegível"}</time></span>
      </div>
      <p className="relatos-canal__autoria">Autoria e data clínica: a conferir. O horário informado pelo canal não confirma quando o sintoma ocorreu.</p>
      <pre className="relatos-canal__texto">{mensagem.texto}</pre>
      {mensagem.redFlag ? <p className="relatos-canal__sinal" role="status">
        Sinalizador do canal: relato pendente de revisão médica.
      </p> : null}
      {mensagem.pendenciaProcessamento ? <p className="relatos-canal__status" role="status">
        Processamento pendente; este painel não apresenta transcrição ou extração de mídia.
      </p> : null}
      {mensagem.midia ? <p className="relatos-canal__midia" data-midia-status={mensagem.midia.processamento}>
        Mídia anexada{mensagem.midia.mimeType ? ` (${mensagem.midia.mimeType})` : ""}: {mensagem.midia.processamento === "NAO_PROCESSADA"
          ? "não processada; conteúdo não disponível aqui."
          : "marcada como lida localmente."}
      </p> : null}
      {(mensagem.reciboTecnico || mensagem.estadoConversa) ? <p className="relatos-canal__status">
        {mensagem.reciboTecnico ? <>Estado técnico: {mensagem.reciboTecnico}</> : null}
        {mensagem.reciboTecnico && mensagem.estadoConversa ? " · " : null}
        {mensagem.estadoConversa ? <>Estado da conversa: {mensagem.estadoConversa}</> : null}
      </p> : null}
      <details className="relatos-canal__rastreabilidade">
        <summary>Rastreabilidade</summary>
        <dl>
          <dt>Identificador do relato</dt><dd>{mensagem.mensagemId}</dd>
          <dt>Contato</dt><dd>{mensagem.contatoId}</dd>
          <dt>Horário original do canal</dt><dd>{mensagem.em}</dd>
          {mensagem.midia ? <><dt>Identificador da mídia</dt><dd>{mensagem.midia.providerMediaId}</dd></> : null}
        </dl>
      </details>
    </article>
  </li>;
}

export function RelatosCanalConsulta({ contexto, mensagens, aoAbrirCanal }: {
  contexto: ContextoAcaoComposta;
  mensagens: readonly MensagemCanalVisao[];
  aoAbrirCanal?: () => void;
}) {
  const contextoAtual = chaveContexto(contexto);
  const [expansao, setExpansao] = useState<Expansao>({ contexto: contextoAtual, aberto: true });
  const aberto = expansao.contexto === contextoAtual ? expansao.aberto : true;
  const listaId = useId();
  const vinculadas = ordenarPorHorarioCanal(mensagens.filter(mensagem =>
    mensagem.patientId === contexto.patientId && mensagem.estadoVinculo === "VINCULADO"));
  const vinculosPendentes = mensagens.filter(mensagem =>
    mensagem.patientId === contexto.patientId && mensagem.estadoVinculo !== "VINCULADO").length;

  function alternarExpansao() {
    setExpansao({ contexto: contextoAtual, aberto: !aberto });
  }

  return <section className="relatos-canal" aria-label="Relatos do canal">
    <header className="relatos-canal__cabecalho">
      <div>
        <p className="relatos-canal__eyebrow">HISTÓRICO DE MENSAGENS VINCULADAS</p>
        <h3>Relatos do canal</h3>
        <p>Relatos recebidos neste paciente; não representam uma seleção comprovada desde a última consulta.</p>
      </div>
      <span className="relatos-canal__contagem">{vinculadas.length} {vinculadas.length === 1 ? "relato vinculado" : "relatos vinculados"}</span>
    </header>

    {vinculosPendentes > 0 ? <p className="relatos-canal__aviso" role="status">
      {vinculosPendentes === 1
        ? "Há um relato deste paciente com vínculo ausente, conflitante ou revogado; o conteúdo foi omitido."
        : `Há ${vinculosPendentes} relatos deste paciente com vínculo ausente, conflitante ou revogado; o conteúdo foi omitido.`}
    </p> : null}

    <div className="relatos-canal__acoes">
      <button type="button" aria-expanded={aberto} aria-controls={listaId} onClick={alternarExpansao}>
        {aberto ? "Ocultar relatos" : "Mostrar relatos"}
      </button>
      {aoAbrirCanal ? <button type="button" onClick={aoAbrirCanal}>Abrir caixa do canal</button> : null}
    </div>

    <div id={listaId} hidden={!aberto}>
      {vinculadas.length === 0 ? <p className="relatos-canal__vazio">Nenhum relato vinculado disponível para exibição.</p>
        : <ol className="relatos-canal__lista">{vinculadas.map(mensagem => <Relato key={mensagem.mensagemId} mensagem={mensagem} />)}</ol>}
    </div>
  </section>;
}
