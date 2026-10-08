// GROK-13 · Emissão APAC persistível. Não grava ledger, não exporta SIA, não chama antiglosa.
// Uma competência por lote sai de montarApacBatch. Relógio, finalidade, CNS e CNES são desta função.

import rulesetEmissao from "../../../corpus/rulesets/agenda-apac-emissao.v1.json" with { type: "json" };
import { diferencaDiasCivis } from "../base.js";
import { validarCns, type ResultadoCns } from "./cns.js";
import { montarApacBatch, type CriterioApacBatch, type ItemApacLote } from "./lote.js";

export interface TabelaEmissao {
  fusoOffsetMinutos: number;
  avisoAdiantadoDias: number;
  finalidades: { QT: readonly string[]; RT: readonly string[] };
}

export interface PacienteEmissao {
  apacId: string;
  pacienteId: string;
  competencia: string | null;
  cid: string | null;
  esquema: string | null;
  estado: ItemApacLote["estado"];
  artefato: ItemApacLote["artefato"];
  modalidadeFaturamento: ItemApacLote["modalidade"];
  motivoBloqueio: string | null;
  dataEmissao: string | null;
  referencia: string | null;
  modalidade: "QT" | "RT" | null;
  finalidadeEscolhida: string | null;
  intencao: string | null;
  cns: string | null;
  cnesInformado: string | null;
}

export interface EntradaEmissao {
  batchId: string;
  geradoEm: string;
  criterio: CriterioApacBatch;
  cnesConfigurado: string | null;
  pacientes: readonly PacienteEmissao[];
}

export interface ResultadoAdiantamento {
  dias: number | null;
  aviso: boolean;
  estado: "OK" | "AVISO" | "FORA" | "PENDENTE";
  motivo: string;
}

export interface ResultadoFinalidade {
  estado: "OK" | "PENDENTE" | "RECUSADA";
  finalidade: string | null;
  motivo: string;
  intencaoIgnorada: string | null;
}

export interface ResultadoCnes {
  estado: "OK" | "PENDENTE" | "BLOQUEADO";
  cnes: string | null;
  motivo: string;
}

export interface ItemEmissaoAvaliado {
  apacId: string;
  pacienteId: string;
  incluido: boolean;
  motivoLote: string;
  documento: "PRONTO" | "BLOQUEADO" | "PENDENTE" | "EXCLUIDO";
  consultaSegue: true;
  pendencias: readonly { codigo: string; texto: string }[];
  alertas: readonly { codigo: string; texto: string }[];
  conflitos: readonly { codigo: string; texto: string }[];
  finalidade: string | null;
  intencaoIgnorada: string | null;
  cns: ResultadoCns | null;
  cnes: string | null;
}

export interface RegistroEmissaoApac {
  kind: "REGISTRO_EMISSAO_APAC";
  batchId: string;
  geradoEm: string;
  consultaSegue: true;
  bloqueiaSalvar: false;
  trava: false;
  documento: "PRONTO" | "BLOQUEADO" | "PENDENTE";
  competenciaLote: string | null;
  incluidos: readonly string[];
  excluidos: readonly { apacId: string; motivo: string }[];
  itens: readonly ItemEmissaoAvaliado[];
  fatosPersistiveis: readonly string[];
  gravadoNoLedger: false;
}

const ISO_CIVIL = /^(\d{4}-\d{2}-\d{2})$/;
const ISO_INSTANTE = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export function lerTabelaEmissao(json: unknown = jsonPadrao()): TabelaEmissao {
  const emissao = (json as { emissao?: unknown }).emissao;
  if (!emissao || typeof emissao !== "object") throw new Error("tabela de emissão ausente");
  const corpo = emissao as {
    fusoOffsetMinutos?: unknown;
    avisoAdiantadoDias?: unknown;
    finalidades?: unknown;
  };
  const offset = corpo.fusoOffsetMinutos;
  const limite = corpo.avisoAdiantadoDias;
  const listas = corpo.finalidades as { QT?: unknown; RT?: unknown } | undefined;
  const qt = listaTexto(listas?.QT);
  const rt = listaTexto(listas?.RT);
  if (typeof offset !== "number" || !Number.isInteger(offset)) throw new Error("fuso da emissão ausente");
  if (typeof limite !== "number" || !Number.isInteger(limite) || limite < 1) {
    throw new Error("limite de adiantamento ausente");
  }
  if (!qt || !rt) throw new Error("finalidades da emissão ausentes");
  return { fusoOffsetMinutos: offset, avisoAdiantadoDias: limite, finalidades: { QT: qt, RT: rt } };
}

export function diaCivilNoFuso(iso: string, offsetMinutos: number): string | null {
  const texto = iso.trim();
  if (ISO_CIVIL.test(texto)) return diferencaDiasCivis(texto, texto) === null ? null : texto;
  if (!ISO_INSTANTE.test(texto) || !Number.isInteger(offsetMinutos)) return null;
  const instante = Date.parse(texto);
  if (!Number.isFinite(instante)) return null;
  const deslocado = new Date(instante + offsetMinutos * 60_000);
  const ano = deslocado.getUTCFullYear();
  const mes = String(deslocado.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(deslocado.getUTCDate()).padStart(2, "0");
  const civil = `${ano}-${mes}-${dia}`;
  return diferencaDiasCivis(civil, civil) === null ? null : civil;
}

export function avaliarAdiantamento(
  dataEmissao: string | null,
  referencia: string | null,
  offsetMinutos: number,
  limiteDias: number,
): ResultadoAdiantamento {
  const emissao = dataEmissao === null ? null : diaCivilNoFuso(dataEmissao, offsetMinutos);
  const ancora = referencia === null ? null : diaCivilNoFuso(referencia, offsetMinutos);
  if (emissao === null || ancora === null) {
    return {
      dias: null,
      aviso: false,
      estado: "PENDENTE",
      motivo: "data ausente; não contada como dia 0 (D-W5-01)",
    };
  }
  const dias = diferencaDiasCivis(ancora, emissao);
  if (dias === null) {
    return {
      dias: null,
      aviso: false,
      estado: "PENDENTE",
      motivo: "data ausente; não contada como dia 0 (D-W5-01)",
    };
  }
  if (dias > limiteDias) {
    return {
      dias,
      aviso: false,
      estado: "FORA",
      motivo: `adiantamento de ${dias} dias civis acima de ${limiteDias} (D-W5-02)`,
    };
  }
  if (dias >= 1) {
    return {
      dias,
      aviso: true,
      estado: "AVISO",
      motivo: `emissão adiantada em ${dias} dia civil; aviso até ${limiteDias} (D-W5-02)`,
    };
  }
  return { dias, aviso: false, estado: "OK", motivo: "emissão sem adiantamento (D-W5-02)" };
}

export function classificarFinalidade(
  modalidade: "QT" | "RT" | null,
  escolhida: string | null,
  intencao: string | null,
  listas: TabelaEmissao["finalidades"],
): ResultadoFinalidade {
  const ignorada = texto(intencao);
  if (modalidade === null) {
    return {
      estado: "PENDENTE",
      finalidade: null,
      motivo: "modalidade ausente (D-W9-12)",
      intencaoIgnorada: ignorada,
    };
  }
  const pedido = texto(escolhida);
  if (pedido === null) {
    return {
      estado: "PENDENTE",
      finalidade: null,
      motivo: "Finalidade APAC depende de escolha humana (D-W9-12)",
      intencaoIgnorada: ignorada,
    };
  }
  const oficial = listas[modalidade].find((item) => item.toLowerCase() === pedido.toLowerCase());
  if (oficial === undefined) {
    return {
      estado: "RECUSADA",
      finalidade: null,
      motivo: "finalidade fora da lista da modalidade (D-W9-12)",
      intencaoIgnorada: ignorada,
    };
  }
  return {
    estado: "OK",
    finalidade: oficial,
    motivo: "finalidade escolhida pelo médico (D-W9-12)",
    intencaoIgnorada: ignorada,
  };
}

export function avaliarCnes(informado: string | null, configurado: string | null): ResultadoCnes {
  const pedido = cnesDigitos(informado);
  const unidade = cnesDigitos(configurado);
  if (informado !== null && texto(informado) !== null && pedido === null) {
    return { estado: "BLOQUEADO", cnes: null, motivo: "CNES com formato inválido (D-W9-10)" };
  }
  if (configurado !== null && texto(configurado) !== null && unidade === null) {
    return { estado: "BLOQUEADO", cnes: null, motivo: "CNES configurado com formato inválido (D-W9-10)" };
  }
  if (pedido === null) return { estado: "PENDENTE", cnes: null, motivo: "CNES ausente (D-W9-10)" };
  if (unidade === null) {
    return { estado: "PENDENTE", cnes: null, motivo: "CNES da unidade não configurado (D-W9-10)" };
  }
  if (pedido !== unidade) {
    return { estado: "BLOQUEADO", cnes: null, motivo: "CNES não confere com o configurado (D-W9-10)" };
  }
  return { estado: "OK", cnes: pedido, motivo: "CNES configurado pelo médico (D-W9-10)" };
}

export function validarEmissaoPersistida(
  entrada: EntradaEmissao,
  tabela: TabelaEmissao = lerTabelaEmissao(),
): RegistroEmissaoApac {
  const lote = montarApacBatch(
    entrada.batchId,
    entrada.criterio,
    entrada.pacientes.map(paraItemLote),
    entrada.geradoEm,
  );
  const incluidos = new Set(lote.itens);
  const motivoExclusao = new Map(lote.excluidos.map((item) => [item.apacId, item.motivo]));
  const itens = entrada.pacientes.map((paciente) => avaliarPaciente(
    paciente,
    incluidos.has(paciente.apacId),
    motivoExclusao.get(paciente.apacId) ?? (incluidos.has(paciente.apacId) ? "incluído" : "excluído"),
    entrada.cnesConfigurado,
    tabela,
  ));
  return {
    kind: "REGISTRO_EMISSAO_APAC",
    batchId: entrada.batchId,
    geradoEm: entrada.geradoEm,
    consultaSegue: true,
    bloqueiaSalvar: false,
    trava: false,
    documento: documentoDoLote(itens),
    competenciaLote: lote.criterio.competencia,
    incluidos: lote.itens,
    excluidos: lote.excluidos,
    itens,
    fatosPersistiveis: fatosDe(itens, lote.criterio.competencia),
    gravadoNoLedger: false,
  };
}

function avaliarPaciente(
  paciente: PacienteEmissao,
  incluido: boolean,
  motivoLote: string,
  cnesConfigurado: string | null,
  tabela: TabelaEmissao,
): ItemEmissaoAvaliado {
  if (!incluido) {
    return {
      apacId: paciente.apacId,
      pacienteId: paciente.pacienteId,
      incluido: false,
      motivoLote,
      documento: "EXCLUIDO",
      consultaSegue: true,
      pendencias: [],
      alertas: [],
      conflitos: [],
      finalidade: null,
      intencaoIgnorada: texto(paciente.intencao),
      cns: null,
      cnes: null,
    };
  }

  const pendencias: { codigo: string; texto: string }[] = [];
  const alertas: { codigo: string; texto: string }[] = [];
  const conflitos: { codigo: string; texto: string }[] = [];

  const relogio = avaliarAdiantamento(
    paciente.dataEmissao,
    paciente.referencia,
    tabela.fusoOffsetMinutos,
    tabela.avisoAdiantadoDias,
  );
  if (relogio.estado === "PENDENTE") pendencias.push({ codigo: "DATA", texto: relogio.motivo });
  else if (relogio.estado === "FORA") conflitos.push({ codigo: "ADIANTAMENTO", texto: relogio.motivo });
  else if (relogio.aviso) alertas.push({ codigo: "ADIANTAMENTO", texto: relogio.motivo });

  const finalidade = classificarFinalidade(
    paciente.modalidade,
    paciente.finalidadeEscolhida,
    paciente.intencao,
    tabela.finalidades,
  );
  if (finalidade.estado === "PENDENTE") pendencias.push({ codigo: "FINALIDADE", texto: finalidade.motivo });
  else if (finalidade.estado === "RECUSADA") conflitos.push({ codigo: "FINALIDADE", texto: finalidade.motivo });
  if (finalidade.intencaoIgnorada !== null) {
    alertas.push({
      codigo: "INTENCAO",
      texto: "intenção clínica não define finalidade (D-W9-12)",
    });
  }

  const cnsInformado = texto(paciente.cns);
  let cns: ResultadoCns | null = null;
  if (cnsInformado === null) pendencias.push({ codigo: "CNS", texto: "CNS ausente (D-W9-13)" });
  else {
    cns = validarCns(cnsInformado);
    if (!cns.valido) conflitos.push({ codigo: "CNS", texto: `CNS inválido: ${cns.motivo} (D-W9-13)` });
    else alertas.push({ codigo: "CNS", texto: `${cns.aviso} (D-W9-13)` });
  }

  const cnes = avaliarCnes(paciente.cnesInformado, cnesConfigurado);
  if (cnes.estado === "PENDENTE") pendencias.push({ codigo: "CNES", texto: cnes.motivo });
  else if (cnes.estado === "BLOQUEADO") conflitos.push({ codigo: "CNES", texto: cnes.motivo });

  let documento: ItemEmissaoAvaliado["documento"] = "PRONTO";
  if (conflitos.length > 0) documento = "BLOQUEADO";
  else if (pendencias.length > 0) documento = "PENDENTE";

  return {
    apacId: paciente.apacId,
    pacienteId: paciente.pacienteId,
    incluido: true,
    motivoLote,
    documento,
    consultaSegue: true,
    pendencias,
    alertas,
    conflitos,
    finalidade: finalidade.finalidade,
    intencaoIgnorada: finalidade.intencaoIgnorada,
    cns,
    cnes: cnes.cnes,
  };
}

function documentoDoLote(itens: readonly ItemEmissaoAvaliado[]): RegistroEmissaoApac["documento"] {
  const dentro = itens.filter((item) => item.incluido);
  if (dentro.length === 0) {
    if (itens.length === 0) return "PENDENTE";
    const soAusencia = itens.every((item) => item.motivoLote.includes("ausente"));
    return soAusencia ? "PENDENTE" : "BLOQUEADO";
  }
  if (dentro.some((item) => item.documento === "BLOQUEADO")) return "BLOQUEADO";
  if (dentro.some((item) => item.documento === "PENDENTE")) return "PENDENTE";
  return "PRONTO";
}

function fatosDe(itens: readonly ItemEmissaoAvaliado[], competencia: string | null): string[] {
  const fatos: string[] = [];
  if (competencia) fatos.push(`competência ${competencia} (D-W5-10)`);
  for (const item of itens) {
    if (item.documento !== "PRONTO") continue;
    const partes = [`apac ${item.apacId}`, `paciente ${item.pacienteId}`];
    if (item.finalidade) partes.push(`finalidade ${item.finalidade}`);
    if (item.cnes) partes.push(`cnes ${item.cnes}`);
    fatos.push(partes.join("; "));
    for (const alerta of item.alertas) fatos.push(`${item.apacId}: ${alerta.texto}`);
  }
  return fatos;
}

function paraItemLote(paciente: PacienteEmissao): ItemApacLote {
  return {
    apacId: paciente.apacId,
    competencia: paciente.competencia,
    cid: paciente.cid,
    esquema: paciente.esquema,
    estado: paciente.estado,
    artefato: paciente.artefato,
    modalidade: paciente.modalidadeFaturamento,
    motivoBloqueio: paciente.motivoBloqueio,
  };
}

function jsonPadrao(): unknown {
  return rulesetEmissao as unknown;
}

function listaTexto(valor: unknown): readonly string[] | null {
  if (!Array.isArray(valor) || valor.length === 0) return null;
  const saida: string[] = [];
  for (const item of valor) {
    if (typeof item !== "string" || item.trim() === "") return null;
    saida.push(item);
  }
  return saida;
}

function texto(valor: string | null): string | null {
  if (valor === null) return null;
  const limpo = valor.trim();
  return limpo.length === 0 ? null : limpo;
}

function cnesDigitos(valor: string | null): string | null {
  const limpo = texto(valor);
  if (limpo === null) return null;
  const digitos = limpo.replace(/[\s.-]/g, "");
  return /^\d{7}$/.test(digitos) ? digitos : null;
}
