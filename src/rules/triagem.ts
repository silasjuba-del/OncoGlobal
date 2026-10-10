import type { TriagemExtraW10 } from "../contracts/w10/clinico-w10.js";
import {
  ProvenienciaLaboratorial as ProvenienciaLaboratorialSchema,
  type ProvenienciaLaboratorial,
} from "../contracts/w10/closure.js";
import type { Motivo, ResultadoTriagem, Triagem } from "../contracts/clinico.js";
import type { Destino, Semaforo } from "../contracts/estados.js";
import type { ContextoTriagem, SalaoRuleset } from "../contracts/regras.js";

import { diferencaDiasCivis } from "./datas.js";

export function validadeHemograma(
  coleta: string | null,
  hoje: string,
  rs: SalaoRuleset,
): { estado: Semaforo; dias: number | null; motivo: string } {
  if (coleta === null) {
    return { estado: "PENDENTE", dias: null, motivo: "hemograma ausente" };
  }
  const dias = diferencaDiasCivis(coleta, hoje);
  if (dias < 0) return { estado: "PENDENTE", dias, motivo: "coleta futura" };
  if (dias > rs.hemogramaValidadeDias) return { estado: "PENDENTE", dias, motivo: "hemograma vencido" };
  return { estado: "VERDE", dias, motivo: "hemograma válido" };
}

import { decidirDestino as destinoDe } from "./destino.js";

type CampoRequisito = ContextoTriagem["requisitosAplicaveis"][number];

function mot(codigo: string, texto: string, rs: SalaoRuleset): Motivo {
  return { codigo, texto, regraId: rs.header.id, rulesetVersao: rs.header.versao };
}

function pendenciaOrigemHemoglobina(
  t: Triagem,
  origem?: ProvenienciaLaboratorial | null,
): string | null {
  // O campo legado hbDgDl já declara a escala canônica (décimos de g/dL).
  if (origem === undefined) return null;
  // A origem do conflito é diagnosticada separadamente; não reinterpretar null como ausência.
  if (t.hbDgDl.campo === "CONFLITO") return null;
  const proveniencia = ProvenienciaLaboratorialSchema.safeParse(origem);
  if (!proveniencia.success || proveniencia.data.valorOriginal === null || proveniencia.data.unidadeOriginal === null
    || proveniencia.data.fonte === null || proveniencia.data.dataClinica === null || t.hbDgDl.valor === null) {
    return "unidade/origem laboratorial ausente ou incompleta; confirmar antes de promover";
  }
  const fatorParaDecimos = proveniencia.data.unidadeOriginal === "g/dL" ? 10 : 1;
  const valorCanonico = proveniencia.data.valorOriginal * fatorParaDecimos;
  if (!Number.isFinite(valorCanonico) || Math.abs(valorCanonico - t.hbDgDl.valor) > 1e-6) {
    return "valor e unidade da origem não concordam com hbDgDl; manter pendente para revisão";
  }
  return null;
}

function aplicavel(ctx: ContextoTriagem, campo: CampoRequisito): boolean {
  return ctx.requisitosAplicaveis.includes(campo);
}

function pendenteSeNulo(
  valor: number | null,
  campo: CampoRequisito,
  texto: string,
  ctx: ContextoTriagem,
  rs: SalaoRuleset,
  pendentes: Motivo[],
): valor is number {
  if (valor !== null) return true;
  if (aplicavel(ctx, campo)) pendentes.push(mot(`pendente.${campo}`, texto, rs));
  return false;
}

/** FN-01 · cortes, anotações, pendências, emergência e destino. Igual ao limite passa. */
export function avaliarTriagem(
  t: Triagem,
  ctx: ContextoTriagem,
  rs: SalaoRuleset,
  origemHb?: ProvenienciaLaboratorial | null,
): ResultadoTriagem {
  const cortes: Motivo[] = [];
  const naoCortes: Motivo[] = [];
  const pendentes: Motivo[] = [];
  let emergencia = false;
  const c = rs.cortes;

  // RT-07 · mesmo contrato de plausibilidade dos portões: implausível vira PENDENTE, nunca corta.
  const plausivel = {
    pas: checarPlausibilidade("pas", t.pas.valor, "PAS", "FN-01", rs, pendentes),
    fc: checarPlausibilidade("fc", t.fc.valor, "frequência cardíaca", "FN-01", rs, pendentes),
    spo2: checarPlausibilidade("spo2", t.spo2.valor, "saturação de oxigênio", "FN-01", rs, pendentes),
    temp: checarPlausibilidade("tempDecimos", t.tempDecimos.valor, "temperatura", "FN-01", rs, pendentes),
    hb: checarPlausibilidade("hbDgDl", t.hbDgDl.valor, "hemoglobina", "FN-01", rs, pendentes),
    anc: checarPlausibilidade("anc", t.anc.valor, "neutrófilos", "FN-01", rs, pendentes),
    plq: checarPlausibilidade("plq", t.plq.valor, "plaquetas", "FN-01", rs, pendentes),
  };

  const pas = t.pas.valor;
  if (pendenteSeNulo(pas, "pas", "pressão arterial ausente", ctx, rs, pendentes) && plausivel.pas) {
    if (pas > c.pasMax) cortes.push(mot("corte.pas.alta", "pressão arterial acima do limite", rs));
    else if (pas < c.pasMin) cortes.push(mot("corte.pas.baixa", "pressão arterial abaixo do limite", rs));
  }

  const fc = t.fc.valor;
  if (pendenteSeNulo(fc, "fc", "frequência cardíaca ausente", ctx, rs, pendentes) && plausivel.fc) {
    if (fc > c.fcMax) cortes.push(mot("corte.fc.alta", "frequência cardíaca acima do limite", rs));
    // D-W9-58 · FC abaixo de fcMin corta (D-W9-37); igual ao limite passa.
    else if (fc < c.fcMin) {
      cortes.push(mot("corte.fc.baixa", "frequência cardíaca abaixo do limite", rs));
    }
  }

  const spo2 = t.spo2.valor;
  if (pendenteSeNulo(spo2, "spo2", "saturação de oxigênio ausente", ctx, rs, pendentes) && plausivel.spo2) {
    if (spo2 < c.spo2Min) cortes.push(mot("corte.spo2.baixa", "saturação de oxigênio abaixo do limite", rs));
  }

  const temp = t.tempDecimos.valor;
  if (pendenteSeNulo(temp, "tempDecimos", "temperatura ausente", ctx, rs, pendentes) && plausivel.temp) {
    if (temp > c.tempDecimosMax) cortes.push(mot("corte.temp.alta", "temperatura acima do limite", rs));
  }

  const hb = t.hbDgDl.valor;
  if (t.hbDgDl.campo === "CONFLITO") {
    pendentes.push(mot("pendente.hbDgDl.conflito", "hemoglobina em conflito entre fontes; nenhum valor foi eleito", rs));
  } else if (pendenteSeNulo(hb, "hbDgDl", "hemoglobina ausente", ctx, rs, pendentes) && plausivel.hb) {
    if (hb < c.hbDgDlMin) cortes.push(mot("corte.hb.baixa", "hemoglobina abaixo do limite", rs));
  }

  const anc = t.anc.valor;
  if (pendenteSeNulo(anc, "anc", "neutrófilos ausentes", ctx, rs, pendentes) && plausivel.anc) {
    if (anc < c.ancMin) cortes.push(mot("corte.anc.baixa", "neutrófilos abaixo do limite", rs));
  }

  const plq = t.plq.valor;
  if (pendenteSeNulo(plq, "plq", "plaquetas ausentes", ctx, rs, pendentes) && plausivel.plq) {
    if (plq < c.plqMin) cortes.push(mot("corte.plq.baixa", "plaquetas abaixo do limite", rs));
  }

  const grau = t.grauCtcae.valor;
  if (pendenteSeNulo(grau, "grauCtcae", "grau de toxicidade ausente", ctx, rs, pendentes)) {
    if (grau >= c.grauCtcaeCorta) {
      cortes.push(mot("corte.grau", "grau de toxicidade no limite de corte", rs));
      if (grau >= c.grauCtcaeEmergencia) emergencia = true;
    } else if (grau === 2) {
      naoCortes.push(mot("naoCorte.grau", "grau 2 anotado", rs));
    }
  }

  const ecog = t.ecog.valor;
  if (pendenteSeNulo(ecog, "ecog", "ECOG ausente", ctx, rs, pendentes)) {
    if (c.ecogCorta.includes(ecog)) {
      cortes.push(mot("corte.ecog", "ECOG no limite de corte", rs));
    }
  }

  // D-W9-76 · tontura não corta, não pesa no ECOG e não anota naoCorte.
  // D-W9-74 · null é desconhecido: PENDENTE, nunca false.
  if (t.tontura === null) pendentes.push(mot("pendente.tontura", "tontura desconhecida; não vira ausência", rs));

  // D-W9-03 · idade decide a FRENTE; ausente é PENDENTE (nunca 0).
  if (t.idadeAnos === null) pendentes.push(mot("pendente.idadeAnos", "idade ausente", rs));

  if (aplicavel(ctx, "coletaHemograma")) {
    const v = validadeHemograma(t.coletaHemograma.valor, ctx.hoje, rs);
    if (v.estado === "PENDENTE") {
      pendentes.push(mot("pendente.coletaHemograma", v.motivo, rs));
    }
  }

  const pendenciaHb = pendenciaOrigemHemoglobina(t, origemHb);
  if (pendenciaHb) pendentes.push(mot("pendente.hb.origem", pendenciaHb, rs));

  // Febre e neutrófilos baixos juntos: alerta urgente, sem nomear diagnóstico (K-28).
  if (temp !== null && anc !== null && temp > c.tempDecimosMax && anc < c.ancMin) {
    emergencia = true;
  }

  const destino = destinoDe(
    {
      temCorte: cortes.length > 0,
      temPendencia: pendentes.length > 0,
      recurso: t.recurso,
      idadeAnos: t.idadeAnos,
    },
    rs,
  );

  const rx = ctx.prescricaoVigente;
  const rxVigente = rx !== null && rx.validaAte >= ctx.hoje;
  const qtPodeIniciarSemMedico = cortes.length === 0 && pendentes.length === 0 && rxVigente;

  return {
    destino,
    cortes,
    naoCortes,
    pendentes,
    emergencia,
    qtPodeIniciarSemMedico,
    rulesetVersao: rs.header.versao,
  };
}

export type SinaisExtraW10 = TriagemExtraW10;

export interface ResultadoPortao {
  portao: "TRIAGEM_CICLO" | "CORTE_SALAO";
  decisao: string;
  destino: Destino;
  motivos: Motivo[];
  pendentes: Motivo[];
  bloqueiaSalvar: false;
  rulesetVersao: string;
}

type PortaoBruto = Record<string, unknown>;

function motivoPortao(codigo: string, texto: string, decisao: string, rs: SalaoRuleset): Motivo {
  return { codigo, texto: `${texto} (${decisao})`, regraId: rs.header.id, rulesetVersao: rs.header.versao };
}

function lerPortao(rs: SalaoRuleset, chave: "corteSalao" | "triagemCiclo", nomeEsperado: string): PortaoBruto {
  const raiz = rs as unknown as { portoes?: unknown };
  if (typeof raiz.portoes !== "object" || raiz.portoes === null || Array.isArray(raiz.portoes)) {
    throw new Error("ruleset salao-triagem sem portoes");
  }
  const bloco = (raiz.portoes as Record<string, unknown>)[chave];
  if (typeof bloco !== "object" || bloco === null || Array.isArray(bloco)) {
    throw new Error(`ruleset salao-triagem sem portoes.${chave}`);
  }
  const portao = bloco as PortaoBruto;
  if (portao.nome !== nomeEsperado) throw new Error(`portoes.${chave}.nome deve ser ${nomeEsperado}`);
  if (portao.bloqueiaSalvar !== false) throw new Error(`portoes.${chave} não pode bloquear salvar`);
  return portao;
}

function inteiroPortao(bloco: PortaoBruto, chave: string, nome: string): number {
  const v = bloco[chave];
  if (typeof v !== "number" || !Number.isInteger(v)) throw new Error(`portoes.${nome}.${chave} não é inteiro`);
  return v;
}

function listaInteiros(bloco: PortaoBruto, chave: string, nome: string): number[] {
  const v = bloco[chave];
  if (!Array.isArray(v) || v.some((item) => typeof item !== "number" || !Number.isInteger(item))) {
    throw new Error(`portoes.${nome}.${chave} não é lista de inteiros`);
  }
  return v as number[];
}

function decisaoPortao(bloco: PortaoBruto, chave: string, nome: string): string {
  if (chave === "idade") {
    const direta = bloco.idadeDecisao;
    if (typeof direta !== "string" || direta.length === 0) throw new Error(`portoes.${nome}.idadeDecisao ausente`);
    return direta;
  }
  const bruto = bloco.decisoes;
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) {
    throw new Error(`portoes.${nome}.decisoes ausente`);
  }
  const v = (bruto as Record<string, unknown>)[chave];
  if (typeof v !== "string" || v.length === 0) throw new Error(`portoes.${nome}.decisoes.${chave} ausente`);
  return v;
}

function textoTemp(decimos: number): string {
  const abs = Math.abs(decimos);
  return `${decimos < 0 ? "-" : ""}${Math.trunc(abs / 10)},${abs % 10} °C`;
}

function textoHb(dgDl: number): string {
  const abs = Math.abs(dgDl);
  return `${dgDl < 0 ? "-" : ""}${Math.trunc(abs / 10)},${abs % 10} g/dL`;
}

function textoCr(centesimos: number): string {
  const abs = Math.abs(centesimos);
  return `${centesimos < 0 ? "-" : ""}${Math.trunc(abs / 100)},${String(abs % 100).padStart(2, "0")} mg/dL`;
}

function fecharPortao(
  portao: ResultadoPortao["portao"],
  bloco: PortaoBruto,
  nome: string,
  t: Triagem,
  motivos: Motivo[],
  pendentes: Motivo[],
  rs: SalaoRuleset,
): ResultadoPortao {
  const decisao = bloco.decisao;
  if (typeof decisao !== "string" || decisao.length === 0) throw new Error(`portoes.${nome}.decisao ausente`);
  if (t.idadeAnos === null) {
    pendentes.push(motivoPortao("pendente.idadeAnos", "idade ausente", decisaoPortao(bloco, "idade", nome), rs));
  }
  return {
    portao,
    decisao,
    destino: destinoDe(
      {
        temCorte: motivos.length > 0,
        temPendencia: pendentes.length > 0,
        recurso: t.recurso,
        idadeAnos: t.idadeAnos,
      },
      rs,
    ),
    motivos,
    pendentes,
    bloqueiaSalvar: false,
    rulesetVersao: rs.header.versao,
  };
}

interface FaixaPlausivel {
  unidade: string;
  min: number;
  max: number;
}

/** RT-07 · lê a faixa de plausibilidade do ruleset. Ausente ou malformada = erro (fail-closed). */
function faixaPlausivel(rs: SalaoRuleset, campo: string): FaixaPlausivel {
  const raiz = rs as unknown as { plausibilidade?: unknown };
  const bloco = raiz.plausibilidade;
  if (typeof bloco !== "object" || bloco === null || Array.isArray(bloco)) {
    throw new Error("ruleset salao-triagem sem plausibilidade");
  }
  const campos = (bloco as Record<string, unknown>).campos;
  if (typeof campos !== "object" || campos === null || Array.isArray(campos)) {
    throw new Error("ruleset salao-triagem sem plausibilidade.campos");
  }
  const f = (campos as Record<string, unknown>)[campo];
  if (typeof f !== "object" || f === null) throw new Error(`plausibilidade.campos.${campo} ausente`);
  const { unidade, min, max } = f as Record<string, unknown>;
  if (typeof unidade !== "string" || typeof min !== "number" || typeof max !== "number" || min > max) {
    throw new Error(`plausibilidade.campos.${campo} inválido`);
  }
  return { unidade, min, max };
}

/**
 * RT-07 · contrato de plausibilidade. Valor fora da faixa para a unidade declarada vira PENDENTE
 * (motivo unidade/plausibilidade) e NÃO corta nem libera. Nunca converte unidade pela magnitude.
 * Retorna false quando o valor foi barrado; ausente (null) retorna true e segue o fluxo normal.
 */
function checarPlausibilidade(
  campo: string,
  valor: number | null,
  rotulo: string,
  decisao: string,
  rs: SalaoRuleset,
  pendentes: Motivo[],
): boolean {
  if (valor === null) return true;
  const f = faixaPlausivel(rs, campo);
  if (valor >= f.min && valor <= f.max) return true;
  pendentes.push(
    motivoPortao(
      `pendente.plausibilidade.${campo}`,
      `${rotulo} ${valor} (${f.unidade}) fora da faixa plausível para a unidade declarada: possível erro de unidade, confirmar`,
      decisao,
      rs,
    ),
  );
  return false;
}

function compararLimite(
  valor: number | null,
  dispara: boolean,
  codigo: string,
  textoPendente: string,
  textoCorte: string,
  decisao: string,
  rs: SalaoRuleset,
  motivos: Motivo[],
  pendentes: Motivo[],
): void {
  if (valor === null) {
    pendentes.push(motivoPortao(`pendente.${codigo}`, textoPendente, decisao, rs));
    return;
  }
  if (dispara) motivos.push(motivoPortao(codigo, textoCorte, decisao, rs));
}

/** D-W9-37/38 · corte do salão. Alerta: destino FILA_MEDICO + motivo. Nunca bloqueia salvar. */
export function avaliarCorteSalao(
  t: Triagem,
  extra: SinaisExtraW10,
  rs: SalaoRuleset,
): ResultadoPortao {
  const nome = "corteSalao";
  const bloco = lerPortao(rs, nome, "corte-do-salao");
  const motivos: Motivo[] = [];
  const pendentes: Motivo[] = [];
  const tempMax = inteiroPortao(bloco, "tempDecimosMax", nome);
  const spo2Min = inteiroPortao(bloco, "spo2Min", nome);
  const pasMin = inteiroPortao(bloco, "pasMin", nome);
  const pasMax = inteiroPortao(bloco, "pasMax", nome);
  const fcMin = inteiroPortao(bloco, "fcMin", nome);
  const hbMin = inteiroPortao(bloco, "hbDgDlMin", nome);
  const crMax = inteiroPortao(bloco, "crCentesimosMax", nome);
  const ancMin = inteiroPortao(bloco, "ancMin", nome);
  const plqMin = inteiroPortao(bloco, "plqMin", nome);
  const ecogCorta = listaInteiros(bloco, "ecogCorta", nome);

  const plausivel = {
    temp: checarPlausibilidade("tempDecimos", t.tempDecimos.valor, "temperatura", decisaoPortao(bloco, "temp", nome), rs, pendentes),
    spo2: checarPlausibilidade("spo2", t.spo2.valor, "saturação de oxigênio", decisaoPortao(bloco, "spo2", nome), rs, pendentes),
    pas: checarPlausibilidade("pas", t.pas.valor, "PAS", decisaoPortao(bloco, "pas", nome), rs, pendentes),
    fc: checarPlausibilidade("fc", t.fc.valor, "frequência cardíaca", decisaoPortao(bloco, "fc", nome), rs, pendentes),
    hb: checarPlausibilidade("hbDgDl", t.hbDgDl.valor, "hemoglobina", decisaoPortao(bloco, "hb", nome), rs, pendentes),
    cr: checarPlausibilidade("cr", extra.crCentesimos, "creatinina", decisaoPortao(bloco, "cr", nome), rs, pendentes),
    anc: checarPlausibilidade("anc", t.anc.valor, "neutrófilos", decisaoPortao(bloco, "anc", nome), rs, pendentes),
    plq: checarPlausibilidade("plq", t.plq.valor, "plaquetas", decisaoPortao(bloco, "plq", nome), rs, pendentes),
  };

  const temp = t.tempDecimos.valor;
  compararLimite(
    temp, plausivel.temp && temp !== null && temp > tempMax,
    "corteSalao.temp.alta", "temperatura ausente",
    `temperatura ${temp === null ? "" : textoTemp(temp)} acima do limite do corte do salão`,
    decisaoPortao(bloco, "temp", nome), rs, motivos, pendentes,
  );
  const spo2 = t.spo2.valor;
  compararLimite(
    spo2, plausivel.spo2 && spo2 !== null && spo2 < spo2Min,
    "corteSalao.spo2.baixa", "saturação de oxigênio ausente",
    `saturação de oxigênio ${spo2 === null ? "" : spo2}% abaixo do limite do corte do salão`,
    decisaoPortao(bloco, "spo2", nome), rs, motivos, pendentes,
  );
  const pas = t.pas.valor;
  compararLimite(
    pas, plausivel.pas && pas !== null && pas < pasMin,
    "corteSalao.pas.baixa", "PAS ausente",
    `PAS ${pas === null ? "" : pas} mmHg abaixo do limite do corte do salão`,
    decisaoPortao(bloco, "pas", nome), rs, motivos, pendentes,
  );
  if (pas !== null && plausivel.pas && pas > pasMax) {
    motivos.push(motivoPortao(
      "corteSalao.pas.alta",
      `PAS ${pas} mmHg acima do limite do corte do salão`,
      decisaoPortao(bloco, "pasAlta", nome),
      rs,
    ));
  }
  const fc = t.fc.valor;
  compararLimite(
    fc, plausivel.fc && fc !== null && fc < fcMin,
    "corteSalao.fc.baixa", "frequência cardíaca ausente",
    `frequência cardíaca ${fc === null ? "" : fc} bpm abaixo do limite do corte do salão`,
    decisaoPortao(bloco, "fc", nome), rs, motivos, pendentes,
  );
  const hb = t.hbDgDl.valor;
  if (t.hbDgDl.campo === "CONFLITO") {
    pendentes.push(motivoPortao("pendente.corteSalao.hb.conflito",
      "hemoglobina em conflito entre fontes; nenhum valor foi eleito",
      decisaoPortao(bloco, "hb", nome), rs));
  } else {
    compararLimite(
      hb, plausivel.hb && hb !== null && hb < hbMin,
      "corteSalao.hb.baixa", "hemoglobina ausente",
      `hemoglobina ${hb === null ? "" : textoHb(hb)} abaixo do limite do corte do salão`,
      decisaoPortao(bloco, "hb", nome), rs, motivos, pendentes,
    );
  }
  const pendenciaHb = pendenciaOrigemHemoglobina(t, extra.provenienciaHb);
  if (pendenciaHb) pendentes.push(motivoPortao("pendente.corteSalao.hb.origem", pendenciaHb,
    decisaoPortao(bloco, "hb", nome), rs));
  compararLimite(
    extra.crCentesimos, plausivel.cr && extra.crCentesimos !== null && extra.crCentesimos > crMax,
    "corteSalao.cr.alta", "creatinina ausente",
    `creatinina ${extra.crCentesimos === null ? "" : textoCr(extra.crCentesimos)} acima do limite do corte do salão`,
    decisaoPortao(bloco, "cr", nome), rs, motivos, pendentes,
  );
  const anc = t.anc.valor;
  compararLimite(
    anc, plausivel.anc && anc !== null && anc < ancMin,
    "corteSalao.anc.baixa", "neutrófilos ausentes",
    `neutrófilos ${anc === null ? "" : anc}/µL abaixo do limiar de bula do corte do salão`,
    decisaoPortao(bloco, "anc", nome), rs, motivos, pendentes,
  );
  const plq = t.plq.valor;
  compararLimite(
    plq, plausivel.plq && plq !== null && plq < plqMin,
    "corteSalao.plq.baixa", "plaquetas ausentes",
    `plaquetas ${plq === null ? "" : plq}/µL abaixo do limiar de bula do corte do salão`,
    decisaoPortao(bloco, "plq", nome), rs, motivos, pendentes,
  );
  const ecog = t.ecog.valor;
  compararLimite(
    ecog, ecog !== null && ecogCorta.includes(ecog),
    "corteSalao.ecog", "ECOG ausente",
    `ECOG ${ecog === null ? "" : ecog} no corte do salão`,
    decisaoPortao(bloco, "ecog", nome), rs, motivos, pendentes,
  );

  return fecharPortao("CORTE_SALAO", bloco, nome, t, motivos, pendentes, rs);
}

/** D-W9-22g · triagem do ciclo (febre 37,9, PA > 14/9, FC > 110). Não lê o corte do salão. */
export function avaliarTriagemCiclo(t: Triagem, extra: SinaisExtraW10, rs: SalaoRuleset): ResultadoPortao {
  const nome = "triagemCiclo";
  const bloco = lerPortao(rs, nome, "triagem-do-ciclo");
  const motivos: Motivo[] = [];
  const pendentes: Motivo[] = [];
  const tempMax = inteiroPortao(bloco, "tempDecimosMax", nome);
  const pasMax = inteiroPortao(bloco, "pasMax", nome);
  const padMax = inteiroPortao(bloco, "padMax", nome);
  const fcMax = inteiroPortao(bloco, "fcMax", nome);

  const plausivel = {
    temp: checarPlausibilidade("tempDecimos", t.tempDecimos.valor, "temperatura", decisaoPortao(bloco, "temp", nome), rs, pendentes),
    pas: checarPlausibilidade("pas", t.pas.valor, "PAS", decisaoPortao(bloco, "pas", nome), rs, pendentes),
    pad: checarPlausibilidade("pad", extra.pad, "PAD", decisaoPortao(bloco, "pad", nome), rs, pendentes),
    fc: checarPlausibilidade("fc", t.fc.valor, "frequência cardíaca", decisaoPortao(bloco, "fc", nome), rs, pendentes),
  };

  const temp = t.tempDecimos.valor;
  compararLimite(
    temp, plausivel.temp && temp !== null && temp > tempMax,
    "triagemCiclo.temp.alta", "temperatura ausente",
    `temperatura ${temp === null ? "" : textoTemp(temp)} acima do limite da triagem do ciclo`,
    decisaoPortao(bloco, "temp", nome), rs, motivos, pendentes,
  );
  const pas = t.pas.valor;
  compararLimite(
    pas, plausivel.pas && pas !== null && pas > pasMax,
    "triagemCiclo.pas.alta", "PAS ausente",
    `PAS ${pas === null ? "" : pas} mmHg acima do limite da triagem do ciclo`,
    decisaoPortao(bloco, "pas", nome), rs, motivos, pendentes,
  );
  compararLimite(
    extra.pad, plausivel.pad && extra.pad !== null && extra.pad > padMax,
    "triagemCiclo.pad.alta", "PAD ausente",
    `PAD ${extra.pad === null ? "" : extra.pad} mmHg acima do limite da triagem do ciclo`,
    decisaoPortao(bloco, "pad", nome), rs, motivos, pendentes,
  );
  const fc = t.fc.valor;
  compararLimite(
    fc, plausivel.fc && fc !== null && fc > fcMax,
    "triagemCiclo.fc.alta", "frequência cardíaca ausente",
    `frequência cardíaca ${fc === null ? "" : fc} bpm acima do limite da triagem do ciclo`,
    decisaoPortao(bloco, "fc", nome), rs, motivos, pendentes,
  );

  return fecharPortao("TRIAGEM_CICLO", bloco, nome, t, motivos, pendentes, rs);
}

/** Chama os dois portões sem misturar limiares. */
export function avaliarPortoesW10(
  t: Triagem,
  extra: SinaisExtraW10,
  rs: SalaoRuleset,
): { triagemCiclo: ResultadoPortao; corteSalao: ResultadoPortao } {
  return {
    triagemCiclo: avaliarTriagemCiclo(t, extra, rs),
    corteSalao: avaliarCorteSalao(t, extra, rs),
  };
}
