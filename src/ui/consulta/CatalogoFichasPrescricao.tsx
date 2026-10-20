import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  FichaProtocoloCatalogoSchema,
  RevisarFichaPedidoSchema,
  type FichaProtocoloCatalogo,
  type RevisarFichaPedido,
} from "../../contracts/api/fichasPrescricao.js";
// @ts-expect-error folha CSS pura, resolvida pelo Vite
import "./fichas-prescricao.css";

interface FormularioRevisao {
  confirmei: boolean;
  motivo: string;
}

const ESTADO_LOCAL: Record<FichaProtocoloCatalogo["estado"], string> = {
  PENDENTE: "Aguardando revisão médica",
  CONFERIDA: "Protocolo conferido por médico",
  INATIVA: "Versão inativa",
};

const ESTADO_TEMPLATE: Record<FichaProtocoloCatalogo["template"]["status"], string> = {
  RASCUNHO: "Rascunho no corpus",
  CONFERIDA_MEDICO: "Conferida no corpus",
  INATIVA: "Inativa no corpus",
};

const CLASSE_ITEM: Record<FichaProtocoloCatalogo["template"]["itens"][number]["classe"], string> = {
  PRE_QT: "Pré-QT", QT: "QT", POS_QT: "Pós-QT", NAO_ONCOLOGICA: "Não oncológica",
};
const BASE_DOSE = { FIXED: "Dose fixa", MG_KG: "mg/kg", MCG_KG: "µg/kg",
  MG_M2: "mg/m²", AUC: "AUC (Calvert)", OTHER: "Outra base — conferir" };
const BLOQUEIOS: Record<string, string> = {
  FICHA_IDENTIDADE_DUPLICADA: "Mais de uma ficha tem a mesma identidade e versão. Confira o catálogo antes do uso.",
  SEQUENCIA_DE_ITENS_DUPLICADA: "Há itens com a mesma posição na sequência. Corrija a ficha antes do uso.",
};

export interface CatalogoFichasPrescricaoProps {
  fichas: FichaProtocoloCatalogo[];
  contextoChave: string;
  ocupado?: boolean;
  erro?: string;
  aoRecarregar: () => Promise<void>;
  aoRevisar: (pedido: RevisarFichaPedido) => Promise<FichaProtocoloCatalogo>;
  aoUsar: (ficha: FichaProtocoloCatalogo) => Promise<void>;
}

function chaveFicha(ficha: FichaProtocoloCatalogo): string {
  return `${ficha.template.templateId}\u0000${ficha.template.versao}`;
}

function canonicoJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicoJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, nested]) => [key, canonicoJson(nested)]));
}

function templateOriginalPreservado(recebido: FichaProtocoloCatalogo["template"], original: FichaProtocoloCatalogo["template"]): boolean {
  return JSON.stringify(canonicoJson(recebido)) === JSON.stringify(canonicoJson(original));
}

function texto(valor: unknown, unidade?: string): string {
  if (valor === null || valor === undefined || valor === "") return "Não informado";
  if (Array.isArray(valor)) return valor.length ? valor.map(item => String(item)).join(", ") : "Não informado";
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  return `${String(valor)}${unidade ? ` ${unidade}` : ""}`;
}

function Campo({ label, valor, unidade }: { label: string; valor: unknown; unidade?: string }) {
  return <div className="catalogo-fichas__field"><dt>{label}</dt><dd>{texto(valor, unidade)}</dd></div>;
}

function revisar(ficha: FichaProtocoloCatalogo): ficha is FichaProtocoloCatalogo {
  return ficha.estado === "PENDENTE" || ficha.estado === "CONFERIDA" || ficha.estado === "INATIVA";
}

export function CatalogoFichasPrescricao({ fichas, contextoChave, ocupado = false, erro,
  aoRecarregar, aoRevisar, aoUsar }: CatalogoFichasPrescricaoProps) {
  const [busca, setBusca] = useState("");
  const [abertas, setAbertas] = useState<Record<string, boolean>>({});
  const [formularios, setFormularios] = useState<Record<string, FormularioRevisao>>({});
  const [fichasLocais, setFichasLocais] = useState<Record<string, FichaProtocoloCatalogo>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [erroLocal, setErroLocal] = useState("");
  const [mensagem, setMensagem] = useState("");
  const geracao = useRef(0);
  const montado = useRef(true);
  const contextoAtual = useRef(contextoChave);
  const chavesIdempotencia = useRef(new Map<string, string>());

  const catalogo = useMemo(() => {
    const merged = new Map<string, FichaProtocoloCatalogo>();
    for (const ficha of fichas) merged.set(chaveFicha(ficha), ficha);
    for (const [key, ficha] of Object.entries(fichasLocais)) {
      const atual = merged.get(key);
      if (atual && ficha.contentHash === atual.contentHash && ficha.revision > atual.revision) merged.set(key, ficha);
    }
    return [...merged.values()].sort((a, b) => a.template.nome.localeCompare(b.template.nome, "pt-BR")
      || a.template.versao.localeCompare(b.template.versao, "pt-BR"));
  }, [fichas, fichasLocais]);

  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const visiveis = catalogo.filter(ficha => !termo || [ficha.template.nome, ficha.template.tumor, ficha.template.cenario]
    .some(valor => valor.toLocaleLowerCase("pt-BR").includes(termo)));
  const ocupadoLocal = busyKey !== null;
  const bloqueado = ocupado || ocupadoLocal;

  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; geracao.current += 1; };
  }, []);

  useEffect(() => {
    if (contextoAtual.current === contextoChave) return;
    contextoAtual.current = contextoChave;
    geracao.current += 1;
    setBusca(""); setAbertas({}); setFormularios({}); setFichasLocais({});
    chavesIdempotencia.current.clear();
    setBusyKey(null); setErroLocal(""); setMensagem("");
  }, [contextoChave]);

  function fichaKey(ficha: FichaProtocoloCatalogo) { return chaveFicha(ficha); }

  function atualizarFormulario(key: string, update: (current: FormularioRevisao) => FormularioRevisao) {
    setFormularios(current => ({ ...current,
      [key]: update(current[key] ?? { confirmei: false, motivo: "" }),
    }));
    setErroLocal(""); setMensagem("");
  }

  function alterarAbertura(key: string, aberto: boolean) {
    setAbertas(current => ({ ...current, [key]: aberto }));
  }

  function idempotencyKey(fingerprint: string): string {
    const existing = chavesIdempotencia.current.get(fingerprint);
    if (existing) return existing;
    const next = globalThis.crypto.randomUUID();
    chavesIdempotencia.current.set(fingerprint, next);
    return next;
  }

  async function revisarFicha(ficha: FichaProtocoloCatalogo, decisao: RevisarFichaPedido["decisao"]) {
    const key = fichaKey(ficha);
    const form = formularios[key] ?? { confirmei: false, motivo: "" };
    if (bloqueado || !revisar(ficha) || !abertas[key] || !form.confirmei || !form.motivo.trim()) return;
    const base = { templateId: ficha.template.templateId, versao: ficha.template.versao,
      expectedContentHash: ficha.contentHash, expectedRevision: ficha.revision, decisao, motivo: form.motivo.trim() };
    const parsed = RevisarFichaPedidoSchema.safeParse({ ...base, idempotencyKey: idempotencyKey(JSON.stringify(base)) });
    if (!parsed.success) { setErroLocal("Os dados da revisão não atendem ao contrato; confira a ficha e o motivo."); return; }
    const token = geracao.current;
    setBusyKey(key); setErroLocal(""); setMensagem("");
    try {
      const resposta = FichaProtocoloCatalogoSchema.parse(await aoRevisar(parsed.data));
      if (!montado.current || token !== geracao.current) return;
      if (resposta.template.templateId !== ficha.template.templateId || resposta.template.versao !== ficha.template.versao
        || resposta.contentHash !== ficha.contentHash || !templateOriginalPreservado(resposta.template, ficha.template)
        || resposta.revision <= ficha.revision
        || resposta.estado !== (decisao === "CONFERIR" ? "CONFERIDA" : "INATIVA")
        || resposta.revisao?.decisao !== decisao) throw new Error("A resposta não corresponde à revisão ou alterou o template original.");
      setFichasLocais(current => ({ ...current, [key]: resposta }));
      setFormularios(current => { const next = { ...current }; delete next[key]; return next; });
      setMensagem(decisao === "CONFERIR" ? "Conferência médica registrada. O template original permanece inalterado." : "Versão local inativada.");
    } catch (cause) {
      if (montado.current && token === geracao.current)
        setErroLocal(cause instanceof Error ? cause.message : "Não foi possível registrar a revisão. Seus campos foram preservados.");
    } finally {
      if (montado.current && token === geracao.current) setBusyKey(null);
    }
  }

  async function usarFicha(ficha: FichaProtocoloCatalogo) {
    if (bloqueado || ficha.estado !== "CONFERIDA" || ficha.bloqueios.length > 0) return;
    const token = geracao.current, key = fichaKey(ficha);
    setBusyKey(key); setErroLocal(""); setMensagem("");
    try {
      await aoUsar(ficha);
      if (montado.current && token === geracao.current)
        setMensagem("Ficha selecionada para preparar um rascunho. Esta ação não assina nem administra.");
    } catch (cause) {
      if (montado.current && token === geracao.current)
        setErroLocal(cause instanceof Error ? cause.message : "Não foi possível preparar o rascunho a partir da ficha.");
    } finally { if (montado.current && token === geracao.current) setBusyKey(null); }
  }

  async function recarregar() {
    if (bloqueado) return;
    const token = geracao.current;
    setBusyKey("catalogo"); setErroLocal(""); setMensagem("");
    try {
      await aoRecarregar();
      if (montado.current && token === geracao.current) {
        setFichasLocais({});
        setMensagem("CatÃ¡logo atualizado.");
      }
    } catch (cause) {
      if (montado.current && token === geracao.current)
        setErroLocal(cause instanceof Error ? cause.message : "Não foi possível atualizar o catálogo.");
    } finally { if (montado.current && token === geracao.current) setBusyKey(null); }
  }

  function itemRows(item: FichaProtocoloCatalogo["template"]["itens"][number]) {
    const valorDose = (dose: number | null) => dose === null ? null : `${dose} ${item.unit}`;
    return [
      ["Sequência", item.sequence], ["Classe", CLASSE_ITEM[item.classe]], ["Dose padrão", valorDose(item.standardDose)],
      ["Base da dose", BASE_DOSE[item.doseBasis]], ["Dose calculada original", valorDose(item.calculatedDose)],
      ["Dose prescrita original", valorDose(item.prescribedDose)], ["Unidade", item.unit],
      ["Ajuste percentual", item.adjustmentPercent === null ? null : `${item.adjustmentPercent}%`],
      ["Motivo do ajuste", item.adjustmentReason], ["Via", item.route], ["Diluente", item.diluent],
      ["Volume final", item.finalVolumeMl === null ? null : `${item.finalVolumeMl} mL`],
      ["Tempo de infusão", item.infusionTime], ["Dias", item.days], ["Observação", item.observacao],
      ["Origem do item", item.source], ["Motivo do override", item.overrideMotivo],
      ["Dose máxima por administração", item.doseMaximaMg === undefined ? null : `${item.doseMaximaMg} mg`],
      ["Taxa máxima", item.taxaMaximaMgMin === undefined ? null : `${item.taxaMaximaMgMin} mg/min`],
      ["Sequenciamento pendente", item.sequenciamentoPendente],
      ["Resgate de metotrexato", item.resgateMtx === undefined ? null : JSON.stringify(item.resgateMtx)],
    ] as const;
  }

  return <section className="catalogo-fichas" aria-label="Catálogo de fichas de prescrição" aria-busy={bloqueado}>
    <header className="catalogo-fichas__header">
      <div><p className="catalogo-fichas__eyebrow">FICHAS VERSIONADAS</p>
        <h2>Catálogo de fichas de prescrição</h2>
        <p>O corpus original é somente leitura. A conferência local registra uma decisão médica separada.</p></div>
      <button type="button" disabled={bloqueado} onClick={() => void recarregar()}>
        {busyKey === "catalogo" ? "Atualizando…" : "Atualizar catálogo"}
      </button>
    </header>

    {erro ? <p className="catalogo-fichas__error" role="alert">{erro}</p> : null}
    {erroLocal ? <p className="catalogo-fichas__error" role="alert">{erroLocal}</p> : null}
    {mensagem ? <p className="catalogo-fichas__message" role="status">{mensagem}</p> : null}

    <label className="catalogo-fichas__search">Buscar por nome, tumor ou cenário
      <input aria-label="Buscar por nome, tumor ou cenário" value={busca} disabled={bloqueado}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setBusca(event.currentTarget.value)} />
    </label>
    <p className="catalogo-fichas__count" aria-live="polite">{visiveis.length} {visiveis.length === 1 ? "versão" : "versões"}</p>
    {!visiveis.length ? <p className="catalogo-fichas__empty">{catalogo.length ? "Nenhuma versão corresponde à busca." : "Nenhuma ficha disponível no catálogo."}</p> : null}

    <div className="catalogo-fichas__list">
      {visiveis.map(ficha => {
        const key = fichaKey(ficha);
        const form = formularios[key] ?? { confirmei: false, motivo: "" };
        const aberta = abertas[key] ?? false;
        const reviewable = revisar(ficha) && ficha.bloqueios.length === 0;
        const locked = bloqueado || busyKey === key;
        const canUse = ficha.estado === "CONFERIDA" && ficha.bloqueios.length === 0;
        return <article className="catalogo-fichas__card" aria-label={`Ficha ${ficha.template.nome} versão ${ficha.template.versao}`}
          key={key}>
          <header className="catalogo-fichas__card-header">
            <div><p className="catalogo-fichas__eyebrow">{ficha.template.tumor}</p>
              <h3>{ficha.template.nome}</h3><p>{ficha.template.cenario} · versão {ficha.template.versao}</p></div>
            <span className={`catalogo-fichas__badge catalogo-fichas__badge--${ficha.estado.toLocaleLowerCase("en-US")}`}>
              {ESTADO_LOCAL[ficha.estado]}
            </span>
          </header>
          <p className="catalogo-fichas__original-status">Status original do template: {ESTADO_TEMPLATE[ficha.template.status]}</p>
          {ficha.bloqueios.length ? <section className="catalogo-fichas__blocks" aria-label="Bloqueios da ficha">
            <h4>Não disponível para uso</h4><ul>{ficha.bloqueios.map((block, index) => <li key={`${index}-${block}`}>{BLOQUEIOS[block] ?? block}</li>)}</ul>
          </section> : null}

          <details open={aberta}>
            <summary onClick={event => { event.preventDefault(); alterarAbertura(key, !aberta); }}>Conteúdo completo da versão {ficha.template.versao}</summary>
            {aberta ? <div className="catalogo-fichas__detail-body">
              <dl className="catalogo-fichas__fields">
                <Campo label="Tumor" valor={ficha.template.tumor} />
                <Campo label="Cenário" valor={ficha.template.cenario} />
                <Campo label="Código institucional" valor={ficha.template.codigoInstitucional} />
                <Campo label="Intervalo entre ciclos" valor={ficha.template.intervaloDias === null ? null : `${ficha.template.intervaloDias} dias`} />
                <Campo label="Número de ciclos" valor={ficha.template.ciclos} />
                <Campo label="Status imutável do corpus" valor={ESTADO_TEMPLATE[ficha.template.status]} />
                <Campo label="Fonte da ficha" valor={ficha.template.fonte} />
              </dl>
              <section className="catalogo-fichas__thresholds" aria-label="Limiares de bula">
                <h4>Limiares de bula</h4>
                <dl className="catalogo-fichas__fields">
                  <Campo label="Neutrófilos mínimos" valor={ficha.template.limiaresBula?.neutrofilosMin ?? null} unidade="/µL" />
                  <Campo label="Plaquetas mínimas" valor={ficha.template.limiaresBula?.plaquetasMin ?? null} unidade="/µL" />
                  <Campo label="ClCr mínimo" valor={ficha.template.limiaresBula?.clcrMinMlMin ?? null} unidade="mL/min" />
                  <Campo label="FEVE mínima" valor={ficha.template.limiaresBula?.fevePctMin ?? null} unidade="%" />
                  <Campo label="Fonte dos limiares" valor={ficha.template.limiaresBula?.fonte ?? null} />
                </dl>
              </section>
              <section className="catalogo-fichas__items" aria-label="Medicamentos e preparo">
                <h4>Medicamentos e preparo</h4>
                {ficha.template.itens.map((item, index) => <article className="catalogo-fichas__item" key={`${item.sequence}-${index}`}>
                  <h5>{item.sequence}. {item.drug} <span>{CLASSE_ITEM[item.classe]}</span></h5>
                  <dl className="catalogo-fichas__fields">
                    {itemRows(item).map(([label, value]) => <Campo label={label} valor={value} key={label} />)}
                  </dl>
                </article>)}
              </section>
              <details className="catalogo-fichas__trace">
                <summary>Identificadores e hashes</summary>
                <dl className="catalogo-fichas__fields">
                  <Campo label="ID original do template" valor={ficha.template.templateId} />
                  <Campo label="Hash original do template" valor={ficha.template.hash} />
                  <Campo label="Hash do conteúdo do catálogo" valor={ficha.contentHash} />
                  <Campo label="Revisão local" valor={ficha.revision} />
                </dl>
                {ficha.revisao ? <dl className="catalogo-fichas__fields">
                  <Campo label="Médico da decisão" valor={ficha.revisao.medicoId} />
                  <Campo label="Data da decisão" valor={ficha.revisao.em} />
                  <Campo label="Motivo registrado" valor={ficha.revisao.motivo} />
                  <Campo label="Hash da revisão" valor={ficha.revisao.reviewHash} />
                </dl> : null}
              </details>

            </div> : null}
          </details>

          {reviewable && aberta ? <fieldset className="catalogo-fichas__review" disabled={locked}>
            <legend>{ficha.estado === "PENDENTE" ? "Conferência médica desta versão" : ficha.estado === "INATIVA" ? "Reativação desta versão" : "Inativação desta versão"}</legend>
            <p className="catalogo-fichas__review-hint">Abra e confira o conteúdo completo acima antes de registrar a decisão.</p>
            <label className="catalogo-fichas__ack">
              <input aria-label="Confirmo a conferência integral da ficha" type="checkbox" checked={form.confirmei}
                onChange={event => { const checked = event.currentTarget.checked;
                  atualizarFormulario(key, current => ({ ...current, confirmei: checked })); }} />
              <span>Confirmo que conferi o conteúdo completo desta versão e sua fonte.</span>
            </label>
            <label>Motivo da revisão
              <textarea aria-label="Motivo da revisão" rows={3} value={form.motivo}
                onChange={event => { const value = event.currentTarget.value;
                  atualizarFormulario(key, current => ({ ...current, motivo: value })); }} />
            </label>
            <button type="button" className="catalogo-fichas__primary"
              disabled={locked || !aberta || !form.confirmei || !form.motivo.trim()}
              onClick={() => void revisarFicha(ficha, ficha.estado === "CONFERIDA" ? "INATIVAR" : "CONFERIR")}>
              {busyKey === key ? "Registrando…" : ficha.estado === "CONFERIDA" ? "Inativar versão" : ficha.estado === "INATIVA" ? "Conferir e reativar versão" : "Conferir e registrar versão"}
            </button>
          </fieldset> : null}

          {ficha.estado === "CONFERIDA" ? <div className="catalogo-fichas__use">
            <p>Usar a ficha prepara um rascunho de prescrição. Não calcula dose, não assina e não administra.</p>
            <button type="button" disabled={locked || !canUse} onClick={() => void usarFicha(ficha)}>
              Usar ficha em rascunho
            </button>
          </div> : null}
        </article>;
      })}
    </div>
  </section>;
}
