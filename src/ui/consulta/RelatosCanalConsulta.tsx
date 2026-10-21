import { useId, useState } from "react";
import { Instante } from "../../contracts/base.js";
import type { ContextoAcaoComposta } from "../../contracts/api/acoesCompostas.js";
import type { MensagemCanalVisao } from "../api/porta.js";
// @ts-expect-error folha CSS pura, resolvida pelo Vite
import "./relatos-canal.css";

type Props = {
  contexto: ContextoAcaoComposta;
  mensagens: readonly MensagemCanalVisao[];
  pendenciasSemAtribuicao?: number;
  aoAbrirCanal?: () => void;
};
const recibos: Record<NonNullable<MensagemCanalVisao["reciboTecnico"]>, string> = {
  RECEBIDA: "recebida", PROCESSADA: "processada pelo canal", ENVIADA: "enviada",
  ENTREGUE: "entregue", LIDA: "lida", FALHOU: "falha no processamento ou envio",
};
const conversas: Record<NonNullable<MensagemCanalVisao["estadoConversa"]>, string> = {
  NOVA: "nova", TRIADA: "triada", AGUARDA_MEDICO: "aguardando médico",
  RESPONDIDA: "respondida", ENCERRADA: "encerrada",
};

function chaveContexto(contexto: ContextoAcaoComposta): string {
  return JSON.stringify([contexto.patientId, contexto.encounterId, contexto.tumorLotId]);
}

function instanteCanal(instante: string): number {
  return Instante.safeParse(instante).success ? Date.parse(instante) : NaN;
}

function formatarHorarioCanal(instante: string): string | null {
  const ms = instanteCanal(instante);
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
    const ta = instanteCanal(a.mensagem.em), tb = instanteCanal(b.mensagem.em);
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
      {mensagem.estadoConversa ? <p className="relatos-canal__status">Conversa: {conversas[mensagem.estadoConversa]}</p> : null}
      <details className="relatos-canal__rastreabilidade">
        <summary>Rastreabilidade</summary>
        <dl>
          <dt>Identificador do relato</dt><dd>{mensagem.mensagemId}</dd>
          <dt>Contato</dt><dd>{mensagem.contatoId}</dd>
          <dt>Horário original do canal</dt><dd>{mensagem.em}</dd>
          {mensagem.reciboTecnico ? <><dt>Recibo da mensagem</dt><dd>{recibos[mensagem.reciboTecnico]}</dd></> : null}
          {mensagem.midia ? <><dt>Identificador da mídia</dt><dd>{mensagem.midia.providerMediaId}</dd></> : null}
        </dl>
      </details>
    </article>
  </li>;
}

export function RelatosCanalConsulta(props: Props) {
  // Remontar por contexto tambem reinicia o estado nativo de <details>.
  return <RelatosNoContexto key={chaveContexto(props.contexto)} {...props} />;
}

function RelatosNoContexto({ contexto, mensagens, pendenciasSemAtribuicao = 0, aoAbrirCanal }: Props) {
  const [aberto, setAberto] = useState(true);
  const listaId = useId();
  const vinculadas = ordenarPorHorarioCanal(mensagens.filter(mensagem =>
    mensagem.patientId === contexto.patientId && mensagem.estadoVinculo === "VINCULADO"));

  function alternarExpansao() {
    setAberto(anterior => !anterior);
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

    {pendenciasSemAtribuicao > 0 ? <p className="relatos-canal__aviso" role="status">
      {pendenciasSemAtribuicao === 1
        ? "Há 1 relato na caixa do canal com vínculo não validado; não atribuído a este paciente. Conteúdo omitido nesta consulta."
        : `Há ${pendenciasSemAtribuicao} relatos na caixa do canal com vínculo não validado; não atribuídos a este paciente. Conteúdo omitido nesta consulta.`}
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
