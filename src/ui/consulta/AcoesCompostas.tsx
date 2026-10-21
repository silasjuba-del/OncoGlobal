import { useEffect, useMemo, useRef, useState } from "react";
import type {
  BaseAcaoComposta as Base,
  PedidoAcaoComposta as Pedido,
  ResultadoAcaoComposta as Resultado,
  TipoAcaoComposta as Tipo,
} from "../../contracts/api/acoesCompostas.js";

export interface AcoesCompostasProps {
  base: Base | null;
  tipoInicial: Tipo;
  ocupado?: boolean;
  aoPreparar: (pedido: Pedido) => Promise<Resultado>;
  aoUsar: (resultado: Resultado) => void;
}

const rotuloTipo: Record<Tipo, string> = {
  MANTER_CICLO: "Manter ciclo",
  REDUZIR_DOSE: "Reduzir dose",
  ADIAR_CICLO: "Adiar ciclo",
  TROCAR_PROTOCOLO: "Trocar protocolo",
};

function formatarValor(value: string | number | null): string {
  if (value === null) return "—";
  return typeof value === "number" ? `${value} mg` : value;
}

export function AcoesCompostas({ base, tipoInicial, ocupado = false, aoPreparar, aoUsar }: AcoesCompostasProps) {
  const [tipo, setTipo] = useState<Tipo>(tipoInicial);
  const [motivo, setMotivo] = useState("");
  const [reducaoPct, setReducaoPct] = useState("20");
  const [dias, setDias] = useState("7");
  const [novoProtocoloId, setNovoProtocoloId] = useState("");
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [preview, setPreview] = useState<Resultado | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const identidadeBase = `${base?.revisao ?? "ausente"}:${base?.baseHash ?? "ausente"}`;
  const identidadePreview = useRef(identidadeBase);
  const sequencia = useRef(0);

  useEffect(() => {
    if (identidadePreview.current !== identidadeBase) {
      identidadePreview.current = identidadeBase;
      sequencia.current += 1;
      setPreview(null);
      setErro(null);
      setPreparando(false);
    }
  }, [identidadeBase]);

  const temBase = Boolean(base);
  const pedido = useMemo<Pedido | null>(() => {
    const razao = motivo.trim();
    if (!razao) return null;
    if (tipo === "MANTER_CICLO") return { tipo, motivo: razao };
    if (tipo === "REDUZIR_DOSE") {
      const percentual = Number(reducaoPct);
      if (!Number.isInteger(percentual) || percentual < 1 || percentual > 99 || selecionados.length === 0) return null;
      return { tipo, motivo: razao, reducaoPct: percentual, itensSelecionados: selecionados };
    }
    if (tipo === "ADIAR_CICLO") {
      const quantidadeDias = Number(dias);
      if (!Number.isInteger(quantidadeDias) || quantidadeDias < 1 || quantidadeDias > 365) return null;
      return { tipo, motivo: razao, dias: quantidadeDias };
    }
    const protocolo = novoProtocoloId.trim();
    if (!protocolo) return null;
    return { tipo, motivo: razao, novoProtocoloId: protocolo };
  }, [dias, motivo, novoProtocoloId, reducaoPct, selecionados, tipo]);

  const alternarItem = (itemId: number) => {
    setSelecionados(current => current.includes(itemId)
      ? current.filter(id => id !== itemId)
      : [...current, itemId]);
  };

  const preparar = async () => {
    if (!pedido || !base || ocupado || preparando) return;
    const tarefa = ++sequencia.current;
    const identidadeDaSolicitacao = identidadeBase;
    setPreparando(true);
    setErro(null);
    setPreview(null);
    try {
      const resultado = await aoPreparar(pedido);
      if (tarefa !== sequencia.current || identidadeDaSolicitacao !== identidadePreview.current) return;
      setPreview(resultado);
    } catch (cause) {
      if (tarefa !== sequencia.current) return;
      setErro(cause instanceof Error ? cause.message : "Não foi possível preparar a prévia.");
    } finally {
      if (tarefa === sequencia.current) setPreparando(false);
    }
  };

  const usar = () => {
    if (!preview || preview.estado !== "PREPARADA" || !base) return;
    if (preview.baseHash !== base.baseHash || preview.baseRevisao !== base.revisao) {
      setPreview(null);
      setErro("A base mudou. Prepare uma nova prévia para revisar.");
      return;
    }
    aoUsar(preview);
  };

  const podePreparar = Boolean(base && pedido && !ocupado && !preparando);
  return (
    <section aria-labelledby="acoes-compostas-titulo">
      <h2 id="acoes-compostas-titulo">Ações compostas</h2>
      {!temBase && <p role="status">Base do ciclo ausente; recarregue os dados estruturados antes de preparar uma ação.</p>}
      {base && (
        <p>
          Base {base.revisao} · {base.protocoloId} · prevista para {base.previstoEm}
        </p>
      )}

      <label htmlFor="acao-composta-tipo">Ação</label>
      <select id="acao-composta-tipo" value={tipo} disabled={!temBase || ocupado || preparando}
        onChange={event => { setTipo(event.target.value as Tipo); setPreview(null); }}>
        {Object.entries(rotuloTipo).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>

      <label htmlFor="acao-composta-motivo">Motivo</label>
      <textarea id="acao-composta-motivo" value={motivo} maxLength={2000}
        disabled={!temBase || ocupado || preparando} onChange={event => { setMotivo(event.target.value); setPreview(null); }} />

      {tipo === "REDUZIR_DOSE" && base && (
        <fieldset disabled={ocupado || preparando}>
          <legend>Itens e redução</legend>
          <label htmlFor="acao-composta-percentual">Percentual de redução</label>
          <input id="acao-composta-percentual" type="number" min="1" max="99" step="1" value={reducaoPct}
            onChange={event => { setReducaoPct(event.target.value); setPreview(null); }} />
          {base.itens.map(item => (
            <label key={item.item}>
              <input type="checkbox" checked={selecionados.includes(item.item)}
                aria-label={`Selecionar item ${item.item} — ${item.droga} (${item.doseMg === null ? "dose não informada" : `${item.doseMg} mg`})`}
                onChange={() => { alternarItem(item.item); setPreview(null); }} />
              {` Item ${item.item}: ${item.droga} · ${item.doseMg === null ? "dose não informada" : `${item.doseMg} mg`}`}
            </label>
          ))}
        </fieldset>
      )}

      {tipo === "ADIAR_CICLO" && (
        <>
          <label htmlFor="acao-composta-dias">Dias para adiar</label>
          <input id="acao-composta-dias" type="number" min="1" max="365" step="1" value={dias}
            disabled={!temBase || ocupado || preparando} onChange={event => { setDias(event.target.value); setPreview(null); }} />
        </>
      )}

      {tipo === "TROCAR_PROTOCOLO" && (
        <>
          <label htmlFor="acao-composta-protocolo">Novo protocolo ID</label>
          <input id="acao-composta-protocolo" value={novoProtocoloId} maxLength={200}
            disabled={!temBase || ocupado || preparando} onChange={event => { setNovoProtocoloId(event.target.value); setPreview(null); }} />
          <p>A intenção não copia doses. A nova prescrição fica pendente para preparação e revisão.</p>
        </>
      )}

      <button type="button" disabled={!podePreparar} onClick={() => void preparar()}>
        {preparando ? "Preparando…" : "Preparar prévia"}
      </button>
      {erro && <p role="alert">{erro}</p>}
      {preview && (
        <section aria-label="Prévia para revisão">
          <h3>Prévia para revisão</h3>
          <p>Estado: {preview.estado === "PREPARADA" ? "preparada" : "pendente"}</p>
          <p>Ação: {preview.tipo ? rotuloTipo[preview.tipo] : "não informada"}</p>
          <p>Motivo: {preview.motivo || "não informado"}</p>
          <p>Protocolo atual: {preview.antes?.protocoloId ?? "não informado"}</p>
          <p>Resultado: protocolo {preview.depois?.protocoloId ?? "não informado"}; previsão {preview.depois?.previstoEm ?? "não informada"}</p>
          <ul aria-label="Diff da ação">
            {preview.diff.length === 0 && <li>Sem alterações nos dados da base.</li>}
            {preview.diff.map((change, index) => (
              <li key={`${change.campo}-${change.item ?? "geral"}-${index}`}>
                {{ doseMg: "Dose", previstoEm: "Data prevista", protocoloId: "Protocolo", item: "Item" }[change.campo]}
                {change.item === null ? "" : ` · item ${change.item}`}: <span>{formatarValor(change.antes)}</span>{" → "}<span>{formatarValor(change.depois)}</span>
              </li>
            ))}
          </ul>
          <details><summary>Rastreabilidade da proposta</summary>
            <p style={{ overflowWrap: "anywhere" }}>Revisão da base: {preview.baseRevisao ?? "não informada"}</p>
          </details>
          {preview.pendencias.length > 0 && <ul aria-label="Pendências">
            {preview.pendencias.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
          </ul>}
          {preview.estado === "PREPARADA" && <button type="button" disabled={ocupado} onClick={usar}>Usar esta proposta revisada</button>}
        </section>
      )}
    </section>
  );
}
