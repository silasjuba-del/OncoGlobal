import { classeSemaforo } from "../tema/temas.js";
import type { CabecalhoVisao } from "./viewmodels.js";

function rotuloValor(d: { valor: string | null; campo: string }): string {
  if (d.campo === "CONFLITO") return "CONFLITO";
  if (d.campo === "NAO_SE_APLICA") return "não se aplica";
  if (d.campo === "PRESENTE" && d.valor !== null && d.valor !== "") return d.valor;
  return "PENDENTE";
}

function idadeCivil(nascimento: string, hoje: string): string {
  const anos = Number(hoje.slice(0, 4)) - Number(nascimento.slice(0, 4));
  const feita = hoje.slice(5) >= nascimento.slice(5);
  const n = feita ? anos : anos - 1;
  return n < 0 ? "PENDENTE" : String(n);
}

function listaOuPendente(itens: readonly string[]): string {
  return itens.length > 0 ? itens.join(", ") : "PENDENTE";
}

export function CabecalhoPaciente({
  visao,
  onSelecionarLote,
}: {
  visao: CabecalhoVisao;
  onSelecionarLote: (tumorLotId: string) => void;
}) {
  const lote = visao.lotes.find((l) => l.tumorLotId === visao.loteSelecionadoId) ?? null;
  const tumor = lote ? rotuloValor(lote.topografia) : "PENDENTE";
  const cid = lote ? rotuloValor(lote.cid) : "PENDENTE";

  return (
    <header aria-label="Cabeçalho do paciente" className="cartao pilha">
      <p data-campo="paciente">{visao.paciente.nome}</p>
      <p>Idade: {visao.paciente.nascimento ? idadeCivil(visao.paciente.nascimento, visao.hoje) : "PENDENTE"}</p>
      {visao.paciente.divergencia ? (
        <p className={classeSemaforo("VERMELHO")}>VERMELHO · divergência de identidade</p>
      ) : null}

      <section aria-label="Alergias e comorbidades do paciente">
        <p>Alergias: {listaOuPendente(visao.alergiasPaciente)}</p>
        <p>Comorbidades: {listaOuPendente(visao.comorbidadesPaciente)}</p>
      </section>

      {visao.lotes.length > 1 ? (
        <label>
          Tumor / lote
          <select
            aria-label="Tumor / lote"
            value={visao.loteSelecionadoId ?? ""}
            onChange={(e) => {
              if (e.target.value) onSelecionarLote(e.target.value);
            }}
          >
            {visao.lotes.map((l) => (
              <option key={l.tumorLotId} value={l.tumorLotId}>
                {rotuloValor(l.topografia)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <p data-campo="tumor">Tumor: {tumor}</p>
      <p>CID: {cid}</p>

      <p>Episódio: {visao.episodio ? visao.episodio.modalidade : "PENDENTE"}</p>
      <p>Linha: {visao.episodio ? String(visao.episodio.linha) : "PENDENTE"}</p>
      <p>Ciclo: {visao.ciclo ? String(visao.ciclo.numero) : "PENDENTE"}</p>

      <p
        className={classeSemaforo(visao.semaforo)}
        data-semaforo={visao.semaforo}
      >
        <span aria-hidden="true">●</span>
        {visao.semaforo === "VERDE"
          ? "VERDE — nenhum alerta com os dados disponíveis"
          : visao.semaforo}
      </p>
      <p data-campo="completude">◐ {visao.pendentes} pendentes</p>

      <section aria-label="Contatos desde a última consulta">
        {visao.contatosDesdeUltima.length === 0 ? (
          <p>nenhum contato novo</p>
        ) : (
          <ul>
            {visao.contatosDesdeUltima.map((c) => (
              <li key={c.contatoId}>
                {c.relacao} · {c.canal}
                {c.patientId === null ? " · contato não vinculado" : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </header>
  );
}
