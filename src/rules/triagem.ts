import type { Motivo, ResultadoTriagem, Triagem } from "../contracts/clinico.js";
import type { Destino, Semaforo } from "../contracts/estados.js";
import type { ContextoTriagem, SalaoRuleset } from "../contracts/regras.js";

function diferencaDiasCivis(de: string, ate: string): number {
  const a = Date.UTC(Number(de.slice(0, 4)), Number(de.slice(5, 7)) - 1, Number(de.slice(8, 10)));
  const b = Date.UTC(Number(ate.slice(0, 4)), Number(ate.slice(5, 7)) - 1, Number(ate.slice(8, 10)));
  return Math.trunc((b - a) / 86_400_000);
}

function validadeColeta(
  coleta: string | null,
  hoje: string,
  rs: SalaoRuleset,
): { estado: Semaforo; motivo: string } {
  if (coleta === null) return { estado: "PENDENTE", motivo: "hemograma ausente" };
  const dias = diferencaDiasCivis(coleta, hoje);
  if (dias < 0) return { estado: "PENDENTE", motivo: "coleta futura" };
  if (dias > rs.hemogramaValidadeDias) return { estado: "PENDENTE", motivo: "hemograma vencido" };
  return { estado: "VERDE", motivo: "hemograma válido" };
}

function destinoDe(
  input: {
    temCorte: boolean;
    temPendencia: boolean;
    recurso: "AMBULATORIAL" | "CADEIRA" | "CAMA";
    idadeAnos: number | null;
  },
  rs: SalaoRuleset,
): Destino {
  if (input.temCorte || input.temPendencia) return "FILA_MEDICO";
  // D-W9-03 · idade ausente é PENDENTE: nunca decide FRENTE nem SALAO.
  if (input.idadeAnos === null) return "FILA_MEDICO";
  if (rs.frente.recursos.includes(input.recurso) || input.idadeAnos > rs.frente.idadeAcimaDe) {
    return "FRENTE";
  }
  return "SALAO";
}

type CampoRequisito = ContextoTriagem["requisitosAplicaveis"][number];

function mot(codigo: string, texto: string, rs: SalaoRuleset): Motivo {
  return { codigo, texto, regraId: rs.header.id, rulesetVersao: rs.header.versao };
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
export function avaliarTriagem(t: Triagem, ctx: ContextoTriagem, rs: SalaoRuleset): ResultadoTriagem {
  const cortes: Motivo[] = [];
  const naoCortes: Motivo[] = [];
  const pendentes: Motivo[] = [];
  let emergencia = false;
  const c = rs.cortes;

  const pas = t.pas.valor;
  if (pendenteSeNulo(pas, "pas", "pressão arterial ausente", ctx, rs, pendentes)) {
    if (pas > c.pasMax) cortes.push(mot("corte.pas.alta", "pressão arterial acima do limite", rs));
    else if (pas < c.pasMin) cortes.push(mot("corte.pas.baixa", "pressão arterial abaixo do limite", rs));
  }

  const fc = t.fc.valor;
  if (pendenteSeNulo(fc, "fc", "frequência cardíaca ausente", ctx, rs, pendentes)) {
    if (fc > c.fcMax) cortes.push(mot("corte.fc.alta", "frequência cardíaca acima do limite", rs));
    // FN-01 (Q21) congela FC baixa como anotação. O corte D-W9-37 vive em avaliarCorteSalao.
    else if (fc < c.fcMinNaoCorta) {
      naoCortes.push(mot("naoCorte.fc.baixa", "frequência cardíaca baixa, anotada", rs));
    }
  }

  const spo2 = t.spo2.valor;
  if (pendenteSeNulo(spo2, "spo2", "saturação de oxigênio ausente", ctx, rs, pendentes)) {
    if (spo2 < c.spo2Min) cortes.push(mot("corte.spo2.baixa", "saturação de oxigênio abaixo do limite", rs));
  }

  const temp = t.tempDecimos.valor;
  if (pendenteSeNulo(temp, "tempDecimos", "temperatura ausente", ctx, rs, pendentes)) {
    if (temp > c.tempDecimosMax) cortes.push(mot("corte.temp.alta", "temperatura acima do limite", rs));
  }

  const hb = t.hbDgDl.valor;
  if (pendenteSeNulo(hb, "hbDgDl", "hemoglobina ausente", ctx, rs, pendentes)) {
    if (hb < c.hbDgDlMin) cortes.push(mot("corte.hb.baixa", "hemoglobina abaixo do limite", rs));
  }

  const anc = t.anc.valor;
  if (pendenteSeNulo(anc, "anc", "neutrófilos ausentes", ctx, rs, pendentes)) {
    if (anc < c.ancMin) cortes.push(mot("corte.anc.baixa", "neutrófilos abaixo do limite", rs));
  }

  const plq = t.plq.valor;
  if (pendenteSeNulo(plq, "plq", "plaquetas ausentes", ctx, rs, pendentes)) {
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
    } else if (ecog === 2 && t.tontura) {
      if (c.ecog2ComTonturaCorta) cortes.push(mot("corte.ecog.tontura", "ECOG 2 com tontura", rs));
      else naoCortes.push(mot("naoCorte.ecog.tontura", "ECOG 2 com tontura, anotado", rs));
    }
  }

  // D-W9-03 · idade decide a FRENTE; ausente é PENDENTE (nunca 0).
  if (t.idadeAnos === null) pendentes.push(mot("pendente.idadeAnos", "idade ausente", rs));

  if (aplicavel(ctx, "coletaHemograma")) {
    const v = validadeColeta(t.coletaHemograma.valor, ctx.hoje, rs);
    if (v.estado === "PENDENTE") {
      pendentes.push(mot("pendente.coletaHemograma", v.motivo, rs));
    }
  }

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

// PROVISORIO-W10: trocar por src/contracts/w10/ (pad e crCentesimos na Triagem; C-08 não tem os dois).
/** PAD em mmHg e creatinina em centésimos de mg/dL (150 = 1,50). null = ausente, nunca 0. */
export interface SinaisExtraW10 {
  pad: number | null;
  crCentesimos: number | null;
}

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
export function avaliarCorteSalao(t: Triagem, extra: SinaisExtraW10, rs: SalaoRuleset): ResultadoPortao {
  const nome = "corteSalao";
  const bloco = lerPortao(rs, nome, "corte-do-salao");
  const motivos: Motivo[] = [];
  const pendentes: Motivo[] = [];
  const tempMax = inteiroPortao(bloco, "tempDecimosMax", nome);
  const spo2Min = inteiroPortao(bloco, "spo2Min", nome);
  const pasMin = inteiroPortao(bloco, "pasMin", nome);
  const fcMin = inteiroPortao(bloco, "fcMin", nome);
  const hbMin = inteiroPortao(bloco, "hbDgDlMin", nome);
  const crMax = inteiroPortao(bloco, "crCentesimosMax", nome);
  const ancMin = inteiroPortao(bloco, "ancMin", nome);
  const plqMin = inteiroPortao(bloco, "plqMin", nome);
  const ecogCorta = listaInteiros(bloco, "ecogCorta", nome);

  const temp = t.tempDecimos.valor;
  compararLimite(
    temp, temp !== null && temp > tempMax,
    "corteSalao.temp.alta", "temperatura ausente",
    `temperatura ${temp === null ? "" : textoTemp(temp)} acima do limite do corte do salão`,
    decisaoPortao(bloco, "temp", nome), rs, motivos, pendentes,
  );
  const spo2 = t.spo2.valor;
  compararLimite(
    spo2, spo2 !== null && spo2 < spo2Min,
    "corteSalao.spo2.baixa", "saturação de oxigênio ausente",
    `saturação de oxigênio ${spo2 === null ? "" : spo2}% abaixo do limite do corte do salão`,
    decisaoPortao(bloco, "spo2", nome), rs, motivos, pendentes,
  );
  const pas = t.pas.valor;
  compararLimite(
    pas, pas !== null && pas < pasMin,
    "corteSalao.pas.baixa", "PAS ausente",
    `PAS ${pas === null ? "" : pas} mmHg abaixo do limite do corte do salão`,
    decisaoPortao(bloco, "pas", nome), rs, motivos, pendentes,
  );
  const fc = t.fc.valor;
  compararLimite(
    fc, fc !== null && fc < fcMin,
    "corteSalao.fc.baixa", "frequência cardíaca ausente",
    `frequência cardíaca ${fc === null ? "" : fc} bpm abaixo do limite do corte do salão`,
    decisaoPortao(bloco, "fc", nome), rs, motivos, pendentes,
  );
  const hb = t.hbDgDl.valor;
  compararLimite(
    hb, hb !== null && hb < hbMin,
    "corteSalao.hb.baixa", "hemoglobina ausente",
    `hemoglobina ${hb === null ? "" : textoHb(hb)} abaixo do limite do corte do salão`,
    decisaoPortao(bloco, "hb", nome), rs, motivos, pendentes,
  );
  compararLimite(
    extra.crCentesimos, extra.crCentesimos !== null && extra.crCentesimos > crMax,
    "corteSalao.cr.alta", "creatinina ausente",
    `creatinina ${extra.crCentesimos === null ? "" : textoCr(extra.crCentesimos)} acima do limite do corte do salão`,
    decisaoPortao(bloco, "cr", nome), rs, motivos, pendentes,
  );
  const anc = t.anc.valor;
  compararLimite(
    anc, anc !== null && anc < ancMin,
    "corteSalao.anc.baixa", "neutrófilos ausentes",
    `neutrófilos ${anc === null ? "" : anc}/µL abaixo do limiar de bula do corte do salão`,
    decisaoPortao(bloco, "anc", nome), rs, motivos, pendentes,
  );
  const plq = t.plq.valor;
  compararLimite(
    plq, plq !== null && plq < plqMin,
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

  const temp = t.tempDecimos.valor;
  compararLimite(
    temp, temp !== null && temp > tempMax,
    "triagemCiclo.temp.alta", "temperatura ausente",
    `temperatura ${temp === null ? "" : textoTemp(temp)} acima do limite da triagem do ciclo`,
    decisaoPortao(bloco, "temp", nome), rs, motivos, pendentes,
  );
  const pas = t.pas.valor;
  compararLimite(
    pas, pas !== null && pas > pasMax,
    "triagemCiclo.pas.alta", "PAS ausente",
    `PAS ${pas === null ? "" : pas} mmHg acima do limite da triagem do ciclo`,
    decisaoPortao(bloco, "pas", nome), rs, motivos, pendentes,
  );
  compararLimite(
    extra.pad, extra.pad !== null && extra.pad > padMax,
    "triagemCiclo.pad.alta", "PAD ausente",
    `PAD ${extra.pad === null ? "" : extra.pad} mmHg acima do limite da triagem do ciclo`,
    decisaoPortao(bloco, "pad", nome), rs, motivos, pendentes,
  );
  const fc = t.fc.valor;
  compararLimite(
    fc, fc !== null && fc > fcMax,
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
