// GRK-01 · PRE-CONSULT PACK. Só snapshots CONFIRMED. Sem dado → seção PENDENTE. Não inventa valor.
import { diferencaDiasCivis, fonteInformada, secaoDe, secaoVazia } from "../tipos.js";
import type { DeltaKind, Secao, Semaforo } from "../tipos.js";

export interface FatoSnapshot {
  campo: string;
  valor: string;
  revisao: "CONFIRMADO" | "ASSINADO";
}

export interface PendenciaVista {
  codigo: string;
  texto: string;
}

export interface TratamentoVista {
  episodioId: string;
  modalidade: string;
  esquemaId: string;
  linha: number;
  cicloNumero: number | null;
  cicloId: string | null;
}

export interface CumulativoVista {
  droga: string;
  totalMg: number;
  fonteId: string;
}

export interface ContatoCanalVista {
  contatoId: string;
  canal: string;
  resumo: string;
  em: string;
}

export interface ApacVista {
  apacId: string;
  dataGeracaoApp: string;
  estado: string;
  competencia: string | null;
  diasDesdeGeracao: number | null;
  aviso: boolean;
  vencida: boolean;
}

export interface DecisaoDia {
  id: string;
  texto: string;
  em: string;
}

export interface SnapshotConfirmado {
  kind: "CONFIRMED";
  snapshotId: string;
  patientId: string;
  tumorLotId: string | null;
  encounterId: string;
  fatos: readonly FatoSnapshot[];
  pendencias: readonly PendenciaVista[] | null;
  tratamento: TratamentoVista | null;
  cumulativos: readonly CumulativoVista[] | null;
  contatos: readonly ContatoCanalVista[] | null;
  apac: {
    apacId: string;
    dataGeracaoApp: string;
    estado: string;
    competencia: string | null;
  } | null;
  decisoes: readonly DecisaoDia[] | null;
}

/** Limiares injetados. Sem fonte o pack não calcula D85/D90. */
export interface PrazosApac {
  avisoNoDia: number;
  venceNoDia: number;
  fonte: string;
}

/** Direção só quando a regra injetada casa de/para e traz fonte (K-17). */
export interface RegraDirecao {
  campo: string;
  de: string;
  para: string;
  direcao: "MELHOR" | "PIOR";
  fonte: string;
}

export interface Mudanca {
  campo: string;
  kind: DeltaKind;
  antes: string | null;
  depois: string | null;
  direcao: "MELHOR" | "PIOR" | null;
}

export interface SecaoMudanca extends Secao<Mudanca> {
  camposConflitantes: string[];
}

export interface PreConsultPack {
  patientId: string;
  snapshotAtualId: string;
  snapshotAnteriorId: string | null;
  oQueMudou: SecaoMudanca;
  pendencias: Secao<PendenciaVista>;
  tratamentoCiclo: Secao<TratamentoVista>;
  cumulativos: Secao<CumulativoVista>;
  contatosCanal: Secao<ContatoCanalVista>;
  apac: Secao<ApacVista>;
  decisoesDoDia: Secao<DecisaoDia>;
}

export interface EntradaPreConsulta {
  atual: SnapshotConfirmado;
  anterior: SnapshotConfirmado | null;
  hoje: string;
  prazosApac: PrazosApac | null;
  direcoes: readonly RegraDirecao[] | null;
}

export function montarPreConsulta(entrada: EntradaPreConsulta): PreConsultPack {
  const anterior = entrada.anterior;
  return {
    patientId: entrada.atual.patientId,
    snapshotAtualId: entrada.atual.snapshotId,
    snapshotAnteriorId: anterior?.snapshotId ?? null,
    oQueMudou: montarDelta(entrada.atual, anterior, entrada.direcoes),
    pendencias: listaOuPendente(entrada.atual.pendencias, "pendências ausentes", "nenhuma pendência no snapshot"),
    tratamentoCiclo: entrada.atual.tratamento === null
      ? secaoVazia("tratamento ausente")
      : secaoDe("VERDE", "tratamento do snapshot confirmado", [entrada.atual.tratamento]),
    cumulativos: listaOuPendente(entrada.atual.cumulativos, "cumulativos ausentes", "nenhum cumulativo no snapshot"),
    contatosCanal: listaOuPendente(entrada.atual.contatos, "contatos do canal ausentes", "nenhum contato no snapshot"),
    apac: montarApac(entrada.atual.apac, entrada.hoje, entrada.prazosApac),
    decisoesDoDia: montarDecisoes(entrada.atual.decisoes, entrada.hoje),
  };
}

function listaOuPendente<T>(
  itens: readonly T[] | null,
  motivoAusente: string,
  motivoVazio: string,
): Secao<T> {
  if (itens === null) return secaoVazia(motivoAusente);
  if (itens.length === 0) return secaoDe("VERDE", motivoVazio, []);
  return secaoDe("VERDE", "dados do snapshot confirmado", itens);
}

function mudancaVazia(motivo: string): SecaoMudanca {
  return { estado: "PENDENTE", motivo, itens: [], camposConflitantes: [] };
}

function montarDelta(
  atual: SnapshotConfirmado,
  anterior: SnapshotConfirmado | null,
  direcoes: readonly RegraDirecao[] | null,
): SecaoMudanca {
  if (anterior === null) return mudancaVazia("sem snapshot anterior confirmado");
  if (anterior.patientId !== atual.patientId) {
    return mudancaVazia("snapshots de pacientes distintos; comparação não feita");
  }

  const idxAtual = indexarFatos(atual.fatos);
  const idxAnterior = indexarFatos(anterior.fatos);
  const conflitos = new Set<string>();
  for (const [campo, valor] of idxAtual) if (valor === FATO_CONFLITO) conflitos.add(campo);
  for (const [campo, valor] of idxAnterior) if (valor === FATO_CONFLITO) conflitos.add(campo);

  const campos = [...new Set([...idxAtual.keys(), ...idxAnterior.keys()])].sort();
  const itens: Mudanca[] = [];
  for (const campo of campos) {
    if (conflitos.has(campo)) continue;
    const antes = idxAnterior.get(campo);
    const depois = idxAtual.get(campo);
    const valorAntes = typeof antes === "string" ? antes : null;
    const valorDepois = typeof depois === "string" ? depois : null;
    if (valorAntes === null && valorDepois === null) continue;
    const kind: DeltaKind = valorAntes === null
      ? "NOVO"
      : valorDepois === null
        ? "RESOLVEU"
        : valorAntes === valorDepois
          ? "PERSISTE"
          : "MUDOU";
    itens.push({
      campo,
      kind,
      antes: valorAntes,
      depois: valorDepois,
      direcao: kind === "MUDOU" ? direcaoDe(campo, valorAntes, valorDepois, direcoes) : null,
    });
  }

  if (campos.length === 0) return mudancaVazia("sem fatos confirmados para comparar");

  const estado: Semaforo = conflitos.size > 0 ? "VERMELHO" : "VERDE";
  const motivo = conflitos.size > 0
    ? "conflito em campo confirmado; valor não eleito"
    : itens.some((item) => item.kind !== "PERSISTE")
      ? "comparação entre snapshots confirmados"
      : "nenhuma mudança entre os snapshots confirmados";
  return { estado, motivo, itens, camposConflitantes: [...conflitos].sort() };
}

const FATO_CONFLITO = Symbol("fato-conflito");

function indexarFatos(fatos: readonly FatoSnapshot[]): Map<string, string | typeof FATO_CONFLITO> {
  const mapa = new Map<string, string | typeof FATO_CONFLITO>();
  for (const fato of fatos) {
    if (fato.revisao !== "CONFIRMADO" && fato.revisao !== "ASSINADO") continue;
    const previo = mapa.get(fato.campo);
    if (previo === undefined) mapa.set(fato.campo, fato.valor);
    else if (previo !== fato.valor) mapa.set(fato.campo, FATO_CONFLITO);
  }
  return mapa;
}

function direcaoDe(
  campo: string,
  de: string | null,
  para: string | null,
  direcoes: readonly RegraDirecao[] | null,
): "MELHOR" | "PIOR" | null {
  if (de === null || para === null || direcoes === null) return null;
  const casadas = direcoes.filter((regra) =>
    regra.campo === campo && regra.de === de && regra.para === para && fonteInformada(regra.fonte),
  );
  const primeira = casadas[0];
  if (primeira === undefined) return null;
  if (casadas.some((regra) => regra.direcao !== primeira.direcao)) return null;
  return primeira.direcao;
}

function montarApac(
  apac: SnapshotConfirmado["apac"],
  hoje: string,
  prazos: PrazosApac | null,
): Secao<ApacVista> {
  if (apac === null) return secaoVazia("APAC ausente");
  if (prazos === null || !fonteInformada(prazos.fonte)) {
    return secaoVazia("[VERIFICAR] prazo D85/D90 sem fonte injetada");
  }
  if (!Number.isInteger(prazos.avisoNoDia) || !Number.isInteger(prazos.venceNoDia)
    || prazos.avisoNoDia < 0 || prazos.venceNoDia <= prazos.avisoNoDia) {
    return secaoVazia("[VERIFICAR] prazos APAC inconsistentes");
  }
  const dias = diferencaDiasCivis(apac.dataGeracaoApp, hoje);
  if (dias === null) return secaoVazia("data de geração da APAC ou hoje inválido");
  if (dias < 0) return secaoVazia("data de geração da APAC posterior a hoje");

  const vencida = dias >= prazos.venceNoDia;
  const aviso = !vencida && dias >= prazos.avisoNoDia;
  const estado: Semaforo = aviso || vencida ? "VERMELHO" : "VERDE";
  const motivo = vencida
    ? `prazo vencido (dia ${dias}; limite ${prazos.venceNoDia}); faturamento não emite; consulta segue`
    : aviso
      ? `aviso de prazo (dia ${dias}; limiar ${prazos.avisoNoDia})`
      : `dentro do prazo (dia ${dias})`;
  return secaoDe(estado, motivo, [{
    apacId: apac.apacId,
    dataGeracaoApp: apac.dataGeracaoApp,
    estado: apac.estado,
    competencia: apac.competencia,
    diasDesdeGeracao: dias,
    aviso,
    vencida,
  }]);
}

function montarDecisoes(decisoes: readonly DecisaoDia[] | null, hoje: string): Secao<DecisaoDia> {
  if (decisoes === null) return secaoVazia("decisões ausentes");
  if (diferencaDiasCivis(hoje, hoje) === null) return secaoVazia("hoje inválido");
  const doDia = decisoes.filter((decisao) => decisao.em === hoje);
  if (doDia.length === 0) return secaoDe("VERDE", "nenhuma decisão nesta data", []);
  return secaoDe("VERDE", "decisões do dia no snapshot confirmado", doDia);
}
