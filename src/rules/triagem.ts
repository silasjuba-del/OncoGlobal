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
    idadeAnos: number;
  },
  rs: SalaoRuleset,
): Destino {
  if (input.temCorte || input.temPendencia) return "FILA_MEDICO";
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
