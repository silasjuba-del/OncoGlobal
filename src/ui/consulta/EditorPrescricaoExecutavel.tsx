import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  EdicaoPrescricaoExecutavel,
  type BasePrescricaoExecutavelResposta as Base,
  type EdicaoPrescricaoExecutavel as Edicao,
  type PrescricaoExecutavelPreparada as Preparada,
} from "../../contracts/api/operacaoPrescricaoExecutavel.js";
import type { ItemPrescricaoExecutavel } from "../../contracts/api/prescricaoExecutavel.js";
import type { DoseBasis } from "../../contracts/w10/prescricao.js";
import type { InstanciacaoFichaResposta } from "../../contracts/api/fichasPrescricao.js";
import type { AcaoCompostaPreparada } from "../../contracts/api/execucaoAcaoComposta.js";
import { edicaoDaAcao } from "../../modules/prescricao/acaoParaPrescricao.js";
import { pendenciasLimitesDeclarados } from "../../rules/prescricao/documentoExecutavel.js";
// @ts-expect-error folha CSS pura, resolvida pelo Vite
import "./prescricao-executavel.css";

type ItemCompleto = ItemPrescricaoExecutavel["item"];
type Classe = NonNullable<ItemCompleto["classe"]>;
type ItemDraft = {
  itemId: string;
  drug: string;
  classe: Classe | "";
  sequence: string;
  standardDose: number | null;
  doseBasis: DoseBasis | "";
  calculatedDose: number | null;
  prescribedDose: string;
  unit: string;
  adjustmentPercent: ItemCompleto["adjustmentPercent"];
  adjustmentReason: string;
  route: string;
  diluent: string;
  finalVolumeMl: string;
  infusionTime: string;
  days: string;
  observacao: string;
  source: "PROTOCOL" | "MANUAL";
  overrideMotivo: string;
  doseMaximaMg?: number;
  taxaMaximaMgMin?: number;
  sequenciamentoPendente?: string;
  resgateMtx?: ItemCompleto["resgateMtx"];
};
type FormularioPrescricao = Omit<EdicaoPrescricaoExecutavel, "itens">;
type PreparacaoVisivel = { resposta: Preparada; geracao: number; revisaoBase: string; chaveBase: string };

const INTENCOES = ["DEFINITIVA", "NEOADJUVANTE", "ADJUVANTE", "PALIATIVA"] as const;
const CLASSES = ["PRE_QT", "QT", "POS_QT", "NAO_ONCOLOGICA"] as const;
const BASES = ["FIXED", "MG_KG", "MCG_KG", "MG_M2", "AUC", "OTHER"] as const;
const ROTULOS_CLASSE: Record<Classe, string> = {
  PRE_QT: "Pré-QT", QT: "QT", POS_QT: "Pós-QT", NAO_ONCOLOGICA: "Não oncológica",
};
const ROTULOS_ACAO = {
  MANTER_CICLO: "Manter ciclo",
  ADIAR_CICLO: "Adiar ciclo",
  REDUZIR_DOSE: "Reduzir dose",
  TROCAR_PROTOCOLO: "Trocar protocolo",
} as const;

function diffAcao(acao: AcaoCompostaPreparada): string[] {
  return acao.resultado.diff.map(mudanca => {
    if (mudanca.campo === "doseMg")
      return `Item ${mudanca.item}: ${mudanca.antes} mg → ${mudanca.depois} mg`;
    if (mudanca.campo === "previstoEm")
      return `Data prevista: ${mudanca.antes ?? "Não informada"} → ${mudanca.depois ?? "Não informada"}`;
    if (mudanca.campo === "protocoloId")
      return `Protocolo: ${mudanca.antes ?? "Não informado"} → ${mudanca.depois ?? "Não informado"}`;
    return `Item ${mudanca.item}: ${mudanca.antes ?? "Não informado"} → ${mudanca.depois ?? "Não informado"}`;
  });
}

function canonico(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonico);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, canonico(v)]));
}

function uuid(): string {
  return globalThis.crypto.randomUUID();
}

function chaveDaBase(base: Base | null): string {
  if (!base) return "SEM_BASE";
  return JSON.stringify([base.contexto.patientId, base.contexto.encounterId, base.contexto.tumorLotId,
    base.episodio?.episodioId ?? null, base.ciclo?.cicloId ?? null, base.revisao]);
}

function paraRascunho(entry: ItemPrescricaoExecutavel, index: number): ItemDraft {
  const item = entry.item;
  return {
    itemId: entry.itemId, drug: item.drug, classe: item.classe, sequence: String(item.sequence),
    standardDose: item.standardDose, doseBasis: item.doseBasis, calculatedDose: item.calculatedDose,
    prescribedDose: item.prescribedDose === null ? "" : String(item.prescribedDose), unit: item.unit,
    adjustmentPercent: item.adjustmentPercent, adjustmentReason: item.adjustmentReason ?? "", route: item.route,
    diluent: item.diluent ?? "", finalVolumeMl: item.finalVolumeMl === null ? "" : String(item.finalVolumeMl),
    infusionTime: item.infusionTime ?? "", days: item.days.join(", "), observacao: item.observacao ?? "",
    source: item.source, overrideMotivo: item.overrideMotivo ?? "",
    ...(item.doseMaximaMg !== undefined ? { doseMaximaMg: item.doseMaximaMg } : {}),
    ...(item.taxaMaximaMgMin !== undefined ? { taxaMaximaMgMin: item.taxaMaximaMgMin } : {}),
    ...(item.sequenciamentoPendente !== undefined ? { sequenciamentoPendente: item.sequenciamentoPendente } : {}),
    ...(item.resgateMtx !== undefined ? { resgateMtx: item.resgateMtx } : {}),
  };
}

function itemManual(sequence: number): ItemDraft {
  return {
    itemId: uuid(), drug: "", classe: "", sequence: String(sequence), standardDose: null, doseBasis: "",
    calculatedDose: null, prescribedDose: "", unit: "", adjustmentPercent: null, adjustmentReason: "",
    route: "", diluent: "", finalVolumeMl: "", infusionTime: "", days: "", observacao: "",
    source: "MANUAL", overrideMotivo: "",
  };
}

function planejar(base: Base | null, modo: Edicao["planejamento"]["modo"]): Edicao["planejamento"] {
  const episodio = base?.episodio;
  const numeroCiclo = modo === "CICLO_ATUAL" ? base?.ciclo?.numero ?? null : null;
  return {
    modo,
    linha: modo === "NOVA_LINHA" ? null : episodio?.linha ?? null,
    intencao: episodio && (INTENCOES as readonly string[]).includes(episodio.intencao)
      ? episodio.intencao as Edicao["planejamento"]["intencao"] : null,
    numeroCiclo,
  };
}

function inicializar(base: Base | null): FormularioPrescricao {
  const modo = base?.ciclo ? "CICLO_ATUAL" : base?.episodio ? "NOVO_CICLO" : "NOVA_LINHA";
  const protocoloId = base?.vigente?.protocoloId ?? base?.episodio?.esquemaId ?? "";
  return {
    protocoloId,
    dataPrevista: base?.ciclo?.previstoEm ?? "",
    motivo: "",
    planejamento: planejar(base, modo),
    // The signed version retains its historical source; a new edit starts a new proposal.
    origemProposta: null,
    encaminharFarmacia: false,
  };
}

function numero(valor: string): number | null {
  if (!valor.trim()) return null;
  const parsed = Number(valor.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function materializar(item: ItemDraft): ItemPrescricaoExecutavel | null {
  const sequence = Number(item.sequence);
  if (!item.drug.trim() || !item.classe || !Number.isSafeInteger(sequence) || sequence < 1
    || !item.doseBasis || !item.unit.trim() || !item.route.trim()) return null;
  const prescribedDose = numero(item.prescribedDose);
  const finalVolumeMl = numero(item.finalVolumeMl);
  const itemCompleto: ItemCompleto = {
    drug: item.drug.trim(), classe: item.classe, sequence,
    standardDose: item.standardDose, doseBasis: item.doseBasis,
    calculatedDose: item.calculatedDose, prescribedDose, unit: item.unit.trim(),
    adjustmentPercent: item.adjustmentPercent,
    adjustmentReason: item.adjustmentReason.trim() || null,
    route: item.route.trim(), diluent: item.diluent.trim() || null,
    finalVolumeMl, infusionTime: item.infusionTime.trim() || null,
    days: item.days.split(/[;,\n]+/u).map(day => day.trim()).filter(Boolean),
    observacao: item.observacao.trim() || null, source: item.source,
    overrideMotivo: item.overrideMotivo.trim() || null,
    ...(item.doseMaximaMg !== undefined ? { doseMaximaMg: item.doseMaximaMg } : {}),
    ...(item.taxaMaximaMgMin !== undefined ? { taxaMaximaMgMin: item.taxaMaximaMgMin } : {}),
    ...(item.sequenciamentoPendente !== undefined ? { sequenciamentoPendente: item.sequenciamentoPendente } : {}),
    ...(item.resgateMtx !== undefined ? { resgateMtx: item.resgateMtx } : {}),
  };
  return { itemId: item.itemId, item: itemCompleto };
}

export interface EditorPrescricaoExecutavelProps {
  base: Base | null;
  origemFicha?: InstanciacaoFichaResposta | null;
  origemAcao?: AcaoCompostaPreparada | null;
  ocupado?: boolean;
  aoPreparar: (edicao: Edicao) => Promise<Preparada>;
  aoAssinar: (preparacao: Preparada) => Promise<void>;
  aoAlterarPendente?: (pendente: boolean) => void;
  aoDescartarAcao?: () => void;
}

export function EditorPrescricaoExecutavel({ base, origemFicha = null, origemAcao = null, ocupado = false,
  aoPreparar, aoAssinar, aoAlterarPendente, aoDescartarAcao }: EditorPrescricaoExecutavelProps) {
  const [edicao, setEdicao] = useState<FormularioPrescricao>(() => inicializar(base));
  const [itens, setItens] = useState<ItemDraft[]>(() => base?.vigente?.itens.map(paraRascunho) ?? []);
  const [preparacao, setPreparacao] = useState<PreparacaoVisivel | null>(null);
  const [ocupadoLocal, setOcupadoLocal] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erros, setErros] = useState<string[]>([]);
  const geracao = useRef(0);
  const chaveAtual = chaveDaBase(base);
  const baseAtual = useRef(chaveAtual);
  const baseAnterior = useRef(base);
  const montado = useRef(true);
  const pendente = useRef(false);
  const origemVista = useRef<InstanciacaoFichaResposta | null>(null);
  const origemAcaoVista = useRef<{ origem: AcaoCompostaPreparada; chaveBase: string } | null>(null);
  const origemAcaoIgnorada = useRef<AcaoCompostaPreparada | null>(null);
  const [fichaAplicada, setFichaAplicada] = useState<InstanciacaoFichaResposta | null>(null);
  const [fichaPendente, setFichaPendente] = useState<InstanciacaoFichaResposta | null>(null);
  const [acaoAplicada, setAcaoAplicada] = useState<AcaoCompostaPreparada | null>(null);
  const [acaoPendente, setAcaoPendente] = useState<AcaoCompostaPreparada | null>(null);
  const [pendenciasAcao, setPendenciasAcao] = useState<string[]>([]);

  useEffect(() => {
    montado.current = true;
    // Informa o estado real: uma edição pode ter chegado antes deste efeito, e
    // marcarEdicao só avisa a transição; um "false" fixo apagaria a proteção.
    aoAlterarPendente?.(pendente.current);
    return () => { montado.current = false; geracao.current += 1; };
  }, []);

  useEffect(() => {
    const chaveNova = chaveDaBase(base);
    if (baseAtual.current === chaveNova) return;
    const anterior = baseAnterior.current;
    baseAtual.current = chaveNova;
    baseAnterior.current = base;
    geracao.current += 1;
    const mesmoContexto = !!anterior && !!base
      && anterior.contexto.patientId === base.contexto.patientId
      && anterior.contexto.encounterId === base.contexto.encounterId
      && anterior.contexto.tumorLotId === base.contexto.tumorLotId;
    if (mesmoContexto && pendente.current) {
      setPreparacao(null);
      setMensagem("A base mudou. Os campos editados foram preservados; revise-os e prepare uma nova prévia.");
      setErros([]);
      setOcupadoLocal(false);
      return;
    }
    setEdicao(inicializar(base));
    setItens(base?.vigente?.itens.map(paraRascunho) ?? []);
    setFichaAplicada(null); setFichaPendente(null);
    setAcaoAplicada(null); setAcaoPendente(null); setPendenciasAcao([]); origemAcaoVista.current = null;
    origemAcaoIgnorada.current = null;
    setPreparacao(null);
    setMensagem("");
    setErros([]);
    setOcupadoLocal(false);
    pendente.current = false;
    aoAlterarPendente?.(false);
  }, [base, aoAlterarPendente]);

  useEffect(() => {
    if (!origemFicha || !base || origemAcao || origemVista.current === origemFicha) return;
    origemVista.current = origemFicha;
    if (origemFicha.contexto.patientId !== base.contexto.patientId
      || origemFicha.contexto.encounterId !== base.contexto.encounterId || origemFicha.contexto.tumorLotId !== base.contexto.tumorLotId) {
      setMensagem("A ficha calculada pertence a outro contexto. Selecione novamente."); return;
    }
    if (pendente.current) setFichaPendente(origemFicha);
    else aplicarFicha(origemFicha);
  }, [origemFicha, origemAcao, base?.contexto.patientId, base?.contexto.encounterId, base?.contexto.tumorLotId]);

  useEffect(() => {
    if (!origemAcao || !base || origemAcaoIgnorada.current === origemAcao) return;
    const chaveBase = chaveDaBase(base);
    if (origemAcaoVista.current?.origem === origemAcao && origemAcaoVista.current.chaveBase === chaveBase) return;
    origemAcaoVista.current = { origem: origemAcao, chaveBase };
    if (origemAcao.resultado.baseRevisao !== base.revisao) {
      setAcaoPendente(null);
      setPendenciasAcao(["A base da prescrição mudou. Gere uma nova ação revisada antes de continuar."]);
      return;
    }
    const proposta = edicaoDaAcao(base, origemAcao);
    setPendenciasAcao(proposta.pendencias);
    if (!proposta.edicao) return;
    if (pendente.current) setAcaoPendente(origemAcao);
    else aplicarAcao(origemAcao, proposta.edicao);
  }, [origemAcao, base]);

  const protocolos = useMemo(() => [...new Set([
    base?.vigente?.protocoloId,
    base?.episodio?.esquemaId,
  ].filter((value): value is string => !!value))], [base]);
  const bloqueado = ocupado || ocupadoLocal || baseAtual.current !== chaveAtual;
  const atual = preparacao && preparacao.geracao === geracao.current && preparacao.chaveBase === chaveAtual
    ? preparacao.resposta : null;

  function marcarEdicao() {
    geracao.current += 1;
    setPreparacao(null);
    setMensagem("");
    setErros([]);
    if (!pendente.current) {
      pendente.current = true;
      aoAlterarPendente?.(true);
    }
  }
  function aplicarFicha(ficha: InstanciacaoFichaResposta) {
    marcarEdicao();
    setEdicao(anterior => ({ ...anterior, protocoloId: ficha.template.nome, origemProposta: ficha.origemProposta }));
    setItens(ficha.itens.map(paraRascunho));
    setFichaAplicada(ficha); setFichaPendente(null);
    setAcaoAplicada(null); setAcaoPendente(null); setPendenciasAcao([]);
  }

  function aplicarAcao(acao: AcaoCompostaPreparada, proposta: Edicao) {
    marcarEdicao();
    setEdicao({ ...proposta });
    setItens(proposta.itens.map(paraRascunho));
    setFichaAplicada(null); setFichaPendente(null);
    setAcaoAplicada(acao); setAcaoPendente(null); setPendenciasAcao([]);
  }

  function descartarAcao() {
    if (origemAcao) origemAcaoIgnorada.current = origemAcao;
    if (acaoAplicada) {
      marcarEdicao();
      setEdicao(anterior => ({ ...anterior, origemProposta: null }));
      setAcaoAplicada(null);
    }
    setAcaoPendente(null); setPendenciasAcao([]);
    aoDescartarAcao?.();
  }

  function alterarCampo<K extends keyof FormularioPrescricao>(campo: K, valor: FormularioPrescricao[K]) {
    marcarEdicao();
    if (campo === "protocoloId" && edicao.protocoloId && valor !== edicao.protocoloId)
      setItens(anteriores => anteriores.map(item => ({ ...item, source: "MANUAL", overrideMotivo: "",
        standardDose: null, calculatedDose: null, adjustmentPercent: null, adjustmentReason: "" })));
    setEdicao(anterior => ({ ...anterior, [campo]: valor, ...(campo === "protocoloId" ? { origemProposta: null } : {}) }));
  }

  function alterarPlanejamento(campo: keyof Edicao["planejamento"], valor: string) {
    marcarEdicao();
    setEdicao(anterior => ({ ...anterior, planejamento: { ...anterior.planejamento,
      [campo]: campo === "modo" ? valor
        : campo === "intencao" ? (valor || null)
          : valor.trim() ? Number(valor) : null,
    } as Edicao["planejamento"] }));
  }

  function atualizarItem(index: number, campo: keyof ItemDraft, value: string) {
    marcarEdicao();
    // A mudança manual de um item não apaga a origem verificável dos demais.
    setItens(previous => previous.map((item, position) => {
      if (position !== index) return item;
      if (campo === "drug" && item.drug && value !== item.drug)
        return { ...itemManual(Number(item.sequence)), itemId: item.itemId, classe: item.classe, drug: value };
      const alterado = { ...item, [campo]: value };
      if (campo !== "observacao" && campo !== "overrideMotivo") {
        alterado.source = "MANUAL";
        alterado.adjustmentPercent = null;
        alterado.adjustmentReason = "";
      }
      return alterado;
    }));
  }

  function alterarModo(event: ChangeEvent<HTMLSelectElement>) {
    const modo = event.target.value as Edicao["planejamento"]["modo"];
    marcarEdicao();
    if (modo === "NOVA_LINHA") setItens([]);
    setEdicao(previous => ({ ...previous, planejamento: planejar(base, modo),
      dataPrevista: modo === "CICLO_ATUAL" ? base?.ciclo?.previstoEm ?? "" : "",
      ...(modo === "NOVA_LINHA" ? { protocoloId: "", origemProposta: null } : {}),
    }));
  }

  function adicionarItem() {
    marcarEdicao();
    const maior = Math.max(0, ...itens.map(item => Number(item.sequence) || 0));
    setItens(previous => [...previous, itemManual(maior + 1)]);
  }

  function removerItem(index: number) {
    marcarEdicao();
    setItens(previous => previous.filter((_, position) => position !== index));
  }

  function construirEdicao(): Edicao | null {
    const problemas: string[] = [];
    if (pendenciasAcao.length) problemas.push(...pendenciasAcao);
    if (!base) problemas.push("Base da prescrição indisponível para conferir o contexto.");
    if (!edicao.protocoloId.trim()) problemas.push("Informe o protocolo ou esquema desta prescrição.");
    if (!edicao.dataPrevista) problemas.push("Informe a data prevista.");
    if (!edicao.motivo.trim()) problemas.push("Informe o motivo da prescrição.");
    if (!edicao.planejamento.linha) problemas.push("Informe a linha terapêutica.");
    if (!edicao.planejamento.intencao) problemas.push("Selecione a intenção terapêutica.");
    if (!edicao.planejamento.numeroCiclo) problemas.push("Informe o número do ciclo.");
    if (!itens.length) problemas.push("Adicione ao menos um item de prescrição.");
    const completos = itens.map(materializar);
    if (completos.some(item => item === null)) problemas.push("Complete medicamento, classe, sequência, base de dose, unidade e via de cada item.");
    const ids = itens.map(item => item.itemId);
    if (new Set(ids).size !== ids.length) problemas.push("Os identificadores dos itens devem ser únicos.");
    const sequencias = itens.map(item => Number(item.sequence));
    if (sequencias.some(value => !Number.isSafeInteger(value) || value < 1) || new Set(sequencias).size !== sequencias.length)
      problemas.push("A sequência dos itens deve ser positiva e única.");
    if (itens.some(item => item.source === "MANUAL" && item.classe === "QT" && !item.overrideMotivo.trim()))
      problemas.push("Informe o motivo do override de cada antineoplásico manual.");
    if (problemas.length) { setErros(problemas); return null; }
    const parsed = EdicaoPrescricaoExecutavel.safeParse({
      ...edicao,
      motivo: edicao.motivo.trim(),
      itens: completos as ItemPrescricaoExecutavel[],
      origemProposta: edicao.origemProposta,
    });
    if (!parsed.success) {
      setErros(["Revise os campos estruturados da prescrição antes de preparar a prévia."]);
      return null;
    }
    if (acaoAplicada && base) {
      const proposta = edicaoDaAcao(base, acaoAplicada);
      const semFarmacia = (value: Edicao) => ({ ...value, encaminharFarmacia: false });
      if (!proposta.edicao || JSON.stringify(canonico(semFarmacia(parsed.data)))
        !== JSON.stringify(canonico(semFarmacia(proposta.edicao)))) {
        setErros(["A edição mudou além da ação revisada. Desvincule a proposta para editar manualmente ou gere uma nova ação."]);
        return null;
      }
    }
    const limites = parsed.data.itens.flatMap(entry => pendenciasLimitesDeclarados(entry.item));
    if (limites.length) { setErros(limites); return null; }
    setErros([]);
    return parsed.data;
  }

  async function preparar() {
    if (bloqueado) return;
    const payload = construirEdicao();
    if (!payload) return;
    const token = geracao.current;
    const revisaoBase = base?.revisao;
    const chaveSolicitada = chaveDaBase(base);
    if (!revisaoBase || chaveAtual !== chaveSolicitada) return;
    setOcupadoLocal(true); setMensagem(""); setPreparacao(null);
    try {
      const response = await aoPreparar(payload);
      if (!montado.current || geracao.current !== token || baseAtual.current !== chaveSolicitada) return;
      const contextoPreparado = response.conteudo.contexto;
      if (response.baseHash !== revisaoBase || contextoPreparado.patientId !== base?.contexto.patientId
        || contextoPreparado.encounterId !== base?.contexto.encounterId
        || contextoPreparado.tumorLotId !== base?.contexto.tumorLotId) {
        setMensagem("A base ou o contexto mudou durante o preparo. Recarregue a prescrição e revise os campos.");
        return;
      }
      setPreparacao({ resposta: response, geracao: token, revisaoBase, chaveBase: chaveSolicitada });
      // A prévia persistida ainda precisa de assinatura; navegar não pode
      // descartar silenciosamente a revisão que está aberta na tela.
      pendente.current = true;
      aoAlterarPendente?.(true);
    } catch (error) {
      if (montado.current && geracao.current === token && baseAtual.current === chaveSolicitada)
        setMensagem(error instanceof Error ? error.message : "Não foi possível preparar a prévia da prescrição.");
    } finally {
      if (montado.current) setOcupadoLocal(false);
    }
  }

  async function assinar() {
    if (!atual || bloqueado) return;
    const token = geracao.current;
    const revisaoBase = base?.revisao;
    const chaveSolicitada = chaveDaBase(base);
    const snapshot = atual;
    setOcupadoLocal(true); setMensagem("");
    try {
      await aoAssinar(snapshot);
      if (!montado.current || geracao.current !== token || baseAtual.current !== chaveSolicitada) return;
      setPreparacao(null);
      setMensagem(`Prescrição assinada.${edicao.encaminharFarmacia ? " Encaminhamento à fila interna solicitado." : ""} Isso não comprova preparo, dispensação ou administração.`);
      pendente.current = false;
      aoAlterarPendente?.(false);
    } catch (error) {
      if (montado.current && geracao.current === token && baseAtual.current === chaveSolicitada)
        setMensagem(error instanceof Error ? error.message : "Não foi possível concluir a assinatura da prescrição.");
    } finally {
      if (montado.current) setOcupadoLocal(false);
    }
  }

  return <section className="prescricao-executavel" aria-label="Editor de prescrição executável" aria-busy={bloqueado}>
    {pendenciasAcao.length ? <section className="prescricao-executavel__pending" aria-label="Pendências da ação" role="status">
      {pendenciasAcao.map((pendencia, index) => <p key={"acao-pendencia-" + index}>{pendencia}</p>)}
      {!acaoAplicada && !acaoPendente && origemAcao ? <button type="button" disabled={bloqueado}
        onClick={descartarAcao}>Descartar proposta de ação e seguir manualmente</button> : null}
    </section> : null}
    {acaoPendente ? <section className="prescricao-executavel__pending" aria-label="Substituição por ação revisada" role="alert">
      <p>A ação {ROTULOS_ACAO[acaoPendente.resultado.tipo ?? "MANTER_CICLO"]} está pronta para substituir os campos editados.
        Confirme para manter a origem e as mudanças revisadas.</p>
      {diffAcao(acaoPendente).length ? <ul>{diffAcao(acaoPendente).map((item, index) =>
        <li key={"acao-pendente-diff-" + index}>{item}</li>)}</ul> : <p>Sem alteração de dose ou data prevista.</p>}
      <button type="button" disabled={bloqueado} onClick={() => {
        const proposta = base ? edicaoDaAcao(base, acaoPendente)
          : { edicao: null, pendencias: ["Base da prescrição ausente."] };
        if (proposta.edicao) aplicarAcao(acaoPendente, proposta.edicao);
        else setPendenciasAcao(proposta.pendencias);
      }}>Substituir pela ação revisada</button>
      <button type="button" disabled={bloqueado} onClick={descartarAcao}>Manter minha edição</button>
    </section> : null}
    {acaoAplicada && edicao.origemProposta ? <section aria-label="Origem da proposta de ação" style={{ minWidth: 0, overflowWrap: "anywhere" }}>
      <h3>Proposta revisada: {ROTULOS_ACAO[acaoAplicada.resultado.tipo ?? "MANTER_CICLO"]}</h3>
      <p>Motivo: {acaoAplicada.resultado.motivo}</p>
      {diffAcao(acaoAplicada).length ? <ul>{diffAcao(acaoAplicada).map((item, index) =>
        <li key={"acao-diff-" + index}>{item}</li>)}</ul> : <p>Sem alteração de dose ou data prevista.</p>}
      <details><summary>Rastreabilidade da ação</summary>
        <p>Rascunho revisado {acaoAplicada.draftId} · revisão {acaoAplicada.revision}</p>
        <p style={{ overflowWrap: "anywhere" }}>Hash SHA-256: {acaoAplicada.conteudoHash}</p>
        <p>Revisão da base: {acaoAplicada.resultado.baseRevisao}</p>
        <p>Hash da base da ação: {acaoAplicada.resultado.baseHash}</p>
      </details>
    </section> : null}
    {acaoAplicada && edicao.origemProposta ? <button type="button" disabled={bloqueado}
      onClick={descartarAcao}>Desvincular ação e editar manualmente</button> : null}
    {fichaPendente ? <section aria-label="Substituição por ficha de protocolo" role="alert">
      <p>Há alterações na prescrição. A ficha {fichaPendente.template.nome} está pronta para substituir os itens atuais.</p>
      <button type="button" disabled={bloqueado} onClick={() => aplicarFicha(fichaPendente)}>Substituir itens pela ficha selecionada</button>
      <button type="button" disabled={bloqueado} onClick={() => setFichaPendente(null)}>Manter minha edição</button>
    </section> : null}
    {fichaAplicada && edicao.origemProposta ? <section aria-label="Origem da prescrição">
      <h3>{fichaAplicada.template.nome} · versão {fichaAplicada.template.versao}</h3>
      <p>Fonte: {fichaAplicada.template.fonte}</p>
      <p>Peso: {fichaAplicada.dadosCorporais.pesoKg ?? "Não informado"} kg · Altura: {fichaAplicada.dadosCorporais.alturaCm ?? "Não informada"} cm
        {" · "}SC: {fichaAplicada.dadosCorporais.bsaM2 ?? "Não informada"} m² · ClCr: {fichaAplicada.dadosCorporais.clcr ?? "Não informado"} mL/min</p>
      {fichaAplicada.pendencias.map((p, i) => <p key={`p-${i}`} role="alert">{p}</p>)}
      {fichaAplicada.avisos.map((a, i) => <p key={`a-${i}`}>{a}</p>)}
      <details><summary>Rastreabilidade da ficha</summary><p>Revisão local {fichaAplicada.revisionFicha}</p>
        <p style={{ overflowWrap: "anywhere" }}>SHA-256: {fichaAplicada.contentHash}</p></details>
    </section> : null}
    {fichaAplicada && edicao.origemProposta ? <button type="button" disabled={bloqueado} onClick={() => {
      marcarEdicao(); setEdicao(anterior => ({ ...anterior, origemProposta: null }));
      setItens(anteriores => anteriores.map(i => ({ ...i, source: "MANUAL", overrideMotivo: "" })));
      setFichaAplicada(null);
    }}>Desvincular ficha e editar manualmente</button> : null}
    <header className="prescricao-executavel__header">
      <div><p className="prescricao-executavel__eyebrow">PRESCRIÇÃO · REVISÃO MÉDICA</p>
        <h2>Prescrição executável</h2>
        <p>{base ? `${base.pacienteNome} · ${base.contexto.encounterId} · ${base.contexto.tumorLotId ?? "lote não vinculado"}` : "Base da prescrição indisponível."}</p>
      </div>
      {base ? <span className="prescricao-executavel__revision">Base {base.revisao.slice(0, 12)}</span> : null}
    </header>
    {!base ? <p className="prescricao-executavel__pending" role="status">Base da prescrição indisponível; nenhum preparo ou assinatura pode ser solicitado.</p> : null}
    <div className="prescricao-executavel__grid">
      <fieldset disabled={bloqueado} className="prescricao-executavel__section">
        <legend>Planejamento e identificação</legend>
        <label>Protocolo ou esquema
          <input aria-label="Protocolo ou esquema" list="prescricao-esquemas" value={edicao.protocoloId}
            onChange={event => alterarCampo("protocoloId", event.target.value)} />
          <datalist id="prescricao-esquemas">{protocolos.map(protocol => <option key={protocol} value={protocol} />)}</datalist>
        </label>
        <label>Modo do ciclo
          <select aria-label="Modo do ciclo" value={edicao.planejamento.modo} onChange={alterarModo}>
            <option value="CICLO_ATUAL" disabled={!base?.ciclo}>Ciclo atual</option>
            <option value="NOVO_CICLO" disabled={!!base?.ciclo || !base?.episodio}>Novo ciclo</option>
            <option value="NOVA_LINHA" disabled={!!base?.ciclo}>Nova linha</option>
          </select>
        </label>
        <div className="prescricao-executavel__pair">
          <label>Linha terapêutica
            <input aria-label="Linha terapêutica" type="number" min="1" step="1" value={edicao.planejamento.linha ?? ""}
              onChange={event => alterarPlanejamento("linha", event.target.value)} />
          </label>
          <label>Intenção terapêutica
            <select aria-label="Intenção terapêutica" value={edicao.planejamento.intencao ?? ""}
              onChange={event => alterarPlanejamento("intencao", event.target.value)}>
              <option value="">Selecione</option>{INTENCOES.map(intencao => <option key={intencao} value={intencao}>{intencao}</option>)}
            </select>
          </label>
        </div>
        <div className="prescricao-executavel__pair">
          <label>Número do ciclo
            <input aria-label="Número do ciclo" type="number" min="1" step="1" value={edicao.planejamento.numeroCiclo ?? ""}
              onChange={event => alterarPlanejamento("numeroCiclo", event.target.value)} />
          </label>
          <label>Data prevista
            <input aria-label="Data prevista" type="date" value={edicao.dataPrevista}
              onChange={event => alterarCampo("dataPrevista", event.target.value as Edicao["dataPrevista"])} />
          </label>
        </div>
        <label>Motivo da prescrição
          <textarea aria-label="Motivo da prescrição" rows={3} maxLength={2000} value={edicao.motivo}
            onChange={event => alterarCampo("motivo", event.target.value)} />
        </label>
        <label className="prescricao-executavel__checkbox"><input aria-label="Encaminhar para a fila interna da farmácia" type="checkbox"
          checked={edicao.encaminharFarmacia} onChange={event => alterarCampo("encaminharFarmacia", event.target.checked)} />
          Encaminhar para a fila interna da farmácia após assinatura</label>
      </fieldset>

      <section className="prescricao-executavel__section" aria-label="Itens da prescrição">
        <div className="prescricao-executavel__section-title"><h3>Itens da prescrição</h3>
          <button type="button" disabled={bloqueado} onClick={adicionarItem}>Adicionar item manual</button></div>
        {!itens.length ? <p className="prescricao-executavel__pending">Nenhum item executável confirmado na base. Adicione os itens que deseja prescrever.</p> : null}
        {itens.map((item, index) => <fieldset className="prescricao-executavel__item" disabled={bloqueado} key={item.itemId} aria-label={`Item da prescrição ${index + 1}`}>
          <legend>Item {index + 1} · sequência {item.sequence}</legend>
          <div className="prescricao-executavel__pair">
            <label>Medicamento · item {index + 1}
              <input aria-label={`Medicamento · item ${index + 1}`} value={item.drug} onChange={event => atualizarItem(index, "drug", event.target.value)} />
            </label>
            <label>Classe · item {index + 1}
              <select aria-label={`Classe · item ${index + 1}`} value={item.classe} onChange={event => atualizarItem(index, "classe", event.target.value)}>
                <option value="">Selecione</option>{CLASSES.map(value => <option key={value} value={value}>{ROTULOS_CLASSE[value]}</option>)}
              </select>
            </label>
          </div>
          <div className="prescricao-executavel__pair">
            <label>Sequência · item {index + 1}
              <input aria-label={`Sequência · item ${index + 1}`} type="number" min="1" step="1" value={item.sequence}
                onChange={event => atualizarItem(index, "sequence", event.target.value)} />
            </label>
            <label>Base da dose · item {index + 1}
              <select aria-label={`Base da dose · item ${index + 1}`} value={item.doseBasis} onChange={event => atualizarItem(index, "doseBasis", event.target.value)}>
                <option value="">Selecione</option>{BASES.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div>
          <div className="prescricao-executavel__pair">
            <label>Dose final · item {index + 1}
              <input aria-label={`Dose final · item ${index + 1}`} type="text" inputMode="decimal" value={item.prescribedDose}
                onChange={event => atualizarItem(index, "prescribedDose", event.target.value)} />
            </label>
            <label>Unidade · item {index + 1}
              <input aria-label={`Unidade · item ${index + 1}`} value={item.unit} onChange={event => atualizarItem(index, "unit", event.target.value)} />
            </label>
          </div>
          <div className="prescricao-executavel__pair">
            <label>Via · item {index + 1}
              <input aria-label={`Via · item ${index + 1}`} value={item.route} onChange={event => atualizarItem(index, "route", event.target.value)} />
            </label>
            <label>Diluente · item {index + 1}
              <input aria-label={`Diluente · item ${index + 1}`} value={item.diluent} onChange={event => atualizarItem(index, "diluent", event.target.value)} />
            </label>
          </div>
          <div className="prescricao-executavel__pair">
            <label>Volume final (mL) · item {index + 1}
              <input aria-label={`Volume final (mL) · item ${index + 1}`} type="text" inputMode="decimal" value={item.finalVolumeMl}
                onChange={event => atualizarItem(index, "finalVolumeMl", event.target.value)} />
            </label>
            <label>Tempo de infusão · item {index + 1}
              <input aria-label={`Tempo de infusão · item ${index + 1}`} value={item.infusionTime}
                onChange={event => atualizarItem(index, "infusionTime", event.target.value)} />
            </label>
          </div>
          <label>Dias de administração · item {index + 1}
            <input aria-label={`Dias de administração · item ${index + 1}`} value={item.days} placeholder="Ex.: d1, d8"
              onChange={event => atualizarItem(index, "days", event.target.value)} />
          </label>
          <label>Observação · item {index + 1}
            <textarea aria-label={`Observação · item ${index + 1}`} rows={2} value={item.observacao}
              onChange={event => atualizarItem(index, "observacao", event.target.value)} />
          </label>
          <p>Origem do item: {item.source}</p>
          {item.doseMaximaMg !== undefined ? <p>Dose máxima declarada: {String(item.doseMaximaMg).replace(".", ",")} mg por administração</p> : null}
          {item.taxaMaximaMgMin !== undefined ? <p>Taxa máxima declarada: {String(item.taxaMaximaMgMin).replace(".", ",")} mg/min</p> : null}
          {item.source === "MANUAL" ? <div className="prescricao-executavel__override">
            <label>Motivo do override · item {index + 1}
              <textarea aria-label={`Motivo do override · item ${index + 1}`} required={item.classe === "QT"} rows={2} value={item.overrideMotivo}
                onChange={event => atualizarItem(index, "overrideMotivo", event.target.value)} />
            </label>
            <button type="button" disabled={bloqueado || !edicao.motivo.trim()}
              onClick={() => atualizarItem(index, "overrideMotivo", edicao.motivo)}>
              Usar motivo médico informado acima
            </button>
          </div> : item.overrideMotivo ? <p>Motivo do override: {item.overrideMotivo}</p> : null}
          <button type="button" disabled={bloqueado} onClick={() => removerItem(index)}>Remover item {index + 1}</button>
        </fieldset>)}
      </section>
    </div>

    {erros.length ? <ul className="prescricao-executavel__errors" role="alert">{erros.map(error => <li key={error}>{error}</li>)}</ul> : null}
    {mensagem ? <p role="status" className="prescricao-executavel__message">{mensagem}</p> : null}
    <div className="prescricao-executavel__actions">
      <button type="button" disabled={bloqueado || !base} onClick={preparar}>Preparar prévia exata</button>
    </div>
    {atual ? <section className="prescricao-executavel__preview" aria-label="Prévia da prescrição">
      <h3>Confira a prescrição</h3>
      <p>Confira o texto e os efeitos datados antes de assinar. A prévia não comprova preparo, dispensação ou administração.</p>
      <p>Encaminhamento à fila interna da farmácia: {edicao.encaminharFarmacia ? "selecionado" : "não selecionado"}.</p>
      <pre>{atual.texto}</pre>
      <details>
        <summary>Rastreabilidade da prescrição</summary>
        <pre>{JSON.stringify({ documento: atual.conteudo.documentId, versao: atual.conteudo.documentVersion,
          contexto: atual.conteudo.contexto, origemProposta: atual.conteudo.origemProposta, hash: atual.conteudoHash }, null, 2)}</pre>
      </details>
      <div className="prescricao-executavel__pair">
        <section aria-label="Avisos da prescrição"><h4>Avisos</h4>{atual.avisos.length ? <ul>{atual.avisos.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}</ul> : <p>Nenhum aviso retornado.</p>}</section>
        <section aria-label="Efeitos datados"><h4>Efeitos datados</h4>{atual.efeitos.length ? <ul>{atual.efeitos.map((effect, index) => <li key={`${index}-${effect}`}>{effect}</li>)}</ul> : <p>Nenhum efeito datado retornado.</p>}</section>
      </div>
      <button type="button" disabled={bloqueado} onClick={assinar}>Confirmar e assinar prescrição</button>
    </section> : null}
  </section>;
}
