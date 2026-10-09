import { useEffect, useState } from "react";
import { apacPrazo } from "../../../rules/apac.js";
import type { ChavesIntencao } from "../../api/chaves.js";
import type { AcaoIntent, ItemApacVisao, LotesApacVisao, PortaConsulta } from "../../api/porta.js";

function finalidadeDoLote(item: ItemApacVisao): string {
  const finalidade = item.lote.finalidadeApac;
  if (finalidade.campo === "PRESENTE" && finalidade.valor) return finalidade.valor;
  return "PENDENTE";
}

function prazoDe(item: ItemApacVisao, hoje: string) {
  return apacPrazo(item.apac.dataGeracaoApp, hoje, item.ultimoAvisoEm);
}

function estadoTravado(item: ItemApacVisao): boolean {
  return item.apac.estado === "NEGADA" || item.apac.estado === "AUTORIZADA";
}

function vencida(item: ItemApacVisao, hoje: string): boolean {
  if (estadoTravado(item)) return false;
  return prazoDe(item, hoje).estado === "VENCIDA" || item.apac.estado === "VENCIDA";
}

/** Mostra o prazo que a regra devolveu. Não conta dias e não lê a intenção clínica. */
export function TelaApacLote({
  porta,
  chaves,
}: {
  porta: PortaConsulta;
  chaves: ChavesIntencao;
}) {
  const [visao, setVisao] = useState<LotesApacVisao | null>(null);
  const [selecionadas, setSelecionadas] = useState<readonly string[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let viva = true;
    setVisao(null); setErro(null);
    porta.lotesApac().then((proxima) => {
      if (viva) setVisao(proxima);
    }, () => { if (viva) setErro("APAC PENDENTE: não foi possível carregar os dados."); });
    return () => {
      viva = false;
    };
  }, [porta]);

  if (!visao) return <p role="status">{erro ?? "carregando APAC"}</p>;
  const hoje = visao.hoje;

  const lotes: { tumorLotId: string; itens: ItemApacVisao[] }[] = [];
  for (const item of visao.itens) {
    const existente = lotes.find((lote) => lote.tumorLotId === item.lote.tumorLotId);
    if (existente) existente.itens.push(item);
    else lotes.push({ tumorLotId: item.lote.tumorLotId, itens: [item] });
  }

  function alternar(apacId: string, bloqueada: boolean) {
    if (bloqueada) return;
    setSelecionadas((atual) => (
      atual.includes(apacId) ? atual.filter((id) => id !== apacId) : [...atual, apacId]
    ));
  }

  function exportar() {
    const porLote = new Map<string, ItemApacVisao>();
    for (const item of visao?.itens ?? []) {
      if (!selecionadas.includes(item.apac.apacId)) continue;
      if (vencida(item, hoje)) continue;
      if (!porLote.has(item.lote.tumorLotId)) porLote.set(item.lote.tumorLotId, item);
    }
    for (const item of porLote.values()) {
      const intent: AcaoIntent = {
        verbo: "EXPORTAR_APAC",
        objeto: { tipo: "LOTE_APAC", id: item.lote.tumorLotId, versao: 1 },
        escopo: { patientId: item.patientId, encounterId: item.encounterId },
        destino: null,
        idempotencyKey: chaves.novaChaveIntencao(`exportar:${item.lote.tumorLotId}`),
      };
      void porta.acao(intent);
    }
  }

  return (
    <section aria-label="APAC por lote" className="pilha">
      <h1>APAC por lote</h1>
      {lotes.map((lote) => {
        const primeiro = lote.itens[0];
        if (!primeiro) return null;
        return (
        <section key={lote.tumorLotId} aria-label={`Lote ${lote.tumorLotId}`} className="cartao pilha">
          <h2>Lote {lote.tumorLotId}</h2>
          <p>Finalidade: {finalidadeDoLote(primeiro)}</p>
          {lote.itens.map((item) => {
            const prazo = prazoDe(item, hoje);
            const bloqueada = vencida(item, hoje);
            const estado = estadoTravado(item)
              ? item.apac.estado
              : prazo.estado === "VENCIDA" ? "VENCIDA" : item.apac.estado;
            return (
              <article key={item.apac.apacId} data-apac={item.apac.apacId} className="pilha">
                <h3>{item.nomePaciente}</h3>
                <p>Competência: {item.apac.competencia}</p>
                <p>Geração: {item.apac.dataGeracaoApp}</p>
                <p>dias: {prazo.dias}</p>
                <p>Estado: {estado}</p>
                <section aria-label={`Antiglosa ${item.apac.apacId}`}>
                  <h4>Antiglosa · conferência do rascunho</h4>
                  {item.antiglosa ? <>
                    <p>{item.antiglosa.exportavel ? "Conferência disponível; exportação depende da validação do servidor."
                      : "Exportação bloqueada pelos achados abaixo. A consulta segue."}</p>
                    <ul>{item.antiglosa.achados.map((achado, i) => <li key={`${achado.regraId}-${i}`}>
                      {achado.motivo}<small> · Fonte: {achado.fonte}</small>
                    </li>)}</ul>
                    {item.antiglosaEstado === "AVALIADA_COM_TABELA_SIGTAP_AUSENTE"
                      ? <p>Tabela SIGTAP da competência PENDENTE.</p> : null}
                  </> : <p>Antiglosa PENDENTE de dados e catálogo.</p>}
                </section>
                {prazo.aviso ? <p>aviso D85</p> : null}
                {bloqueada ? (
                  <>
                    <p>VENCIDA</p>
                    <p>fora do faturamento</p>
                    <p>consulta segue</p>
                  </>
                ) : null}
                {item.motivoNegativa ? <p>Motivo: {item.motivoNegativa}</p> : null}
                {item.campoOrigem ? <button type="button">campo {item.campoOrigem}</button> : null}
                <label>
                  selecionar {item.apac.apacId}
                  <input
                    type="checkbox"
                    aria-label={`selecionar ${item.apac.apacId}`}
                    disabled={bloqueada}
                    checked={selecionadas.includes(item.apac.apacId)}
                    onChange={() => alternar(item.apac.apacId, bloqueada)}
                  />
                </label>
              </article>
            );
          })}
        </section>
        );
      })}
      <button type="button" onClick={exportar}>exportar selecionadas</button>
    </section>
  );
}
