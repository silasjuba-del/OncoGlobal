// API pública FN-01…09. Rules não importam rules (R-08); cada arquivo nomeado é autônomo.
import type { Motivo, ResultadoTriagem, Triagem } from "../contracts/clinico.js";
import type { Destino, Semaforo } from "../contracts/estados.js";
import type {
  AlvoIntervalo,
  ContextoTriagem,
  DoseRuleset,
  EntradaDose,
  EntradaFila,
  FuncoesF0,
  Pesagem,
  PrazosRuleset,
  SaidaDose,
  SaidaIntervalo,
  SaidaPeso,
  SalaoRuleset,
} from "../contracts/regras.js";

const MS_POR_DIA = 86_400_000;

export function diferencaDiasCivis(de: string, ate: string): number {
  const a = Date.UTC(Number(de.slice(0, 4)), Number(de.slice(5, 7)) - 1, Number(de.slice(8, 10)));
  const b = Date.UTC(Number(ate.slice(0, 4)), Number(ate.slice(5, 7)) - 1, Number(ate.slice(8, 10)));
  return Math.trunc((b - a) / MS_POR_DIA);
}

export function decidirDestino(
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

  // D-W9-03 · idade decide a FRENTE; ausente é PENDENTE (nunca 0).
  if (t.idadeAnos === null) pendentes.push(mot("pendente.idadeAnos", "idade ausente", rs));

  if (aplicavel(ctx, "coletaHemograma")) {
    const v = validadeHemograma(t.coletaHemograma.valor, ctx.hoje, rs);
    if (v.estado === "PENDENTE") {
      pendentes.push(mot("pendente.coletaHemograma", v.motivo, rs));
    }
  }

  if (temp !== null && anc !== null && temp > c.tempDecimosMax && anc < c.ancMin) {
    emergencia = true;
  }

  const destino = decidirDestino(
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

function casaToken(token: string, e: EntradaFila, rs: SalaoRuleset): boolean {
  switch (token) {
    case "ECOG_4":
      return e.ecog === 4;
    case "ECOG_3":
      return e.ecog === 3;
    case "CAMA":
      return e.recurso === "CAMA";
    case "CADEIRA":
      return e.recurso === "CADEIRA";
    case "IDADE_80":
      return e.idadeAnos !== null && e.idadeAnos > rs.frente.idadeAcimaDe;
    default:
      return false;
  }
}

function nivel(e: EntradaFila, rs: SalaoRuleset): number {
  const ordem = rs.filaOrdem;
  for (let i = 0; i < ordem.length; i++) {
    const token = ordem[i];
    if (token !== undefined && casaToken(token, e, rs)) return i;
  }
  return ordem.length;
}

export function ordenarFila(entradas: readonly EntradaFila[], rs: SalaoRuleset): EntradaFila[] {
  return entradas
    .map((entrada, origem) => ({ entrada, origem }))
    .sort((a, b) => {
      const na = nivel(a.entrada, rs);
      const nb = nivel(b.entrada, rs);
      if (na !== nb) return na - nb;
      const ea = a.entrada.ecog ?? -1;
      const eb = b.entrada.ecog ?? -1;
      if (ea !== eb) return eb - ea;
      const ta = Date.parse(a.entrada.chegadaEm);
      const tb = Date.parse(b.entrada.chegadaEm);
      if (ta !== tb) return ta - tb;
      return a.origem - b.origem;
    })
    .map((x) => x.entrada);
}

function arredondaMg(base: number, reducaoPct: number): number {
  return Math.floor((base * (100 - reducaoPct) + 50) / 100);
}

export function calcularDose(e: EntradaDose, rs: DoseRuleset): SaidaDose {
  const versao = rs.header.versao;
  const ciclosSemPesoConsecutivos = e.pesoKg === null ? e.ciclosSemPesoAnteriores + 1 : 0;

  if (!rs.reducoesPct.includes(e.reducaoPct)) {
    return {
      doseMg: null,
      estado: "VERMELHO",
      motivo: "redução não prevista no ruleset",
      ciclosSemPesoConsecutivos,
      rulesetVersao: versao,
    };
  }

  if (e.doseAdministradaAnteriorMg === null) {
    return {
      doseMg: null,
      estado: "PENDENTE",
      motivo: "dose anterior ausente",
      ciclosSemPesoConsecutivos,
      rulesetVersao: versao,
    };
  }

  const doseMg = arredondaMg(e.doseAdministradaAnteriorMg, e.reducaoPct);

  if (e.pesoKg === null) {
    const estado = ciclosSemPesoConsecutivos >= rs.semPesoConsecutivosVermelho ? "VERMELHO" : "PENDENTE";
    return {
      doseMg,
      estado,
      motivo: "dose anterior mantida sem peso",
      ciclosSemPesoConsecutivos,
      rulesetVersao: versao,
    };
  }

  const motivo = e.origemPeso === "INFORMADO_PACIENTE"
    ? "dose calculada com peso informado pelo paciente"
    : "dose calculada";

  return {
    doseMg,
    estado: "VERDE",
    motivo,
    ciclosSemPesoConsecutivos: 0,
    rulesetVersao: versao,
  };
}

function acaoPesoVermelho(rs: SalaoRuleset): string[] {
  const extra = rs.pesoVermelho as { acao?: unknown };
  if (Array.isArray(extra.acao) && extra.acao.every((x) => typeof x === "string")) {
    return extra.acao.slice();
  }
  return [];
}

export function avaliarPeso(serie: readonly Pesagem[], hoje: string, rs: SalaoRuleset): SaidaPeso {
  const versao = rs.header.versao;
  const janela = rs.pesoVermelho.janelaDias;
  const limiar = rs.pesoVermelho.perdaKgAcimaDe;
  const naJanela = serie.filter((p) => {
    const dias = diferencaDiasCivis(p.data, hoje);
    return dias >= 0 && dias <= janela;
  });

  if (naJanela.length < 2) {
    return {
      estado: "PENDENTE",
      perdaKg: null,
      motivo: "pesagens insuficientes na janela",
      acao: [],
      rulesetVersao: versao,
    };
  }

  let recente = naJanela[0]!;
  let pico = naJanela[0]!;
  for (const p of naJanela) {
    if (p.data > recente.data) recente = p;
    else if (p.data === recente.data) recente = p;
    if (p.kg > pico.kg) pico = p;
  }

  const perdaKg = pico.kg - recente.kg;
  if (perdaKg > limiar) {
    const medidas = pico.origem === "MEDIDO" && recente.origem === "MEDIDO";
    if (medidas) {
      return {
        estado: "VERMELHO",
        perdaKg,
        motivo: "perda de peso acima do limite",
        acao: acaoPesoVermelho(rs),
        rulesetVersao: versao,
      };
    }
    return {
      estado: "PENDENTE",
      perdaKg,
      motivo: "diferença incerta, médico confirma",
      acao: [],
      rulesetVersao: versao,
    };
  }

  return {
    estado: "VERDE",
    perdaKg,
    motivo: "perda dentro do limite",
    acao: [],
    rulesetVersao: versao,
  };
}

export function avisoIntervaloPosQt(
  ultimaAdministracaoQt: string | null,
  dataAlvo: string,
  alvo: AlvoIntervalo,
  rs: PrazosRuleset,
): SaidaIntervalo {
  const versao = rs.header.versao;
  if (alvo === "RT_CONCOMITANTE") {
    const dias = ultimaAdministracaoQt === null
      ? null
      : diferencaDiasCivis(ultimaAdministracaoQt, dataAlvo);
    return {
      estado: "VERDE",
      dias,
      motivo: "intervalo não se aplica à radioterapia concomitante",
      rulesetVersao: versao,
    };
  }
  if (ultimaAdministracaoQt === null) {
    return {
      estado: "PENDENTE",
      dias: null,
      motivo: "data da última quimioterapia ausente",
      rulesetVersao: versao,
    };
  }
  const dias = diferencaDiasCivis(ultimaAdministracaoQt, dataAlvo);
  if (dias >= rs.intervaloPosQtDias) {
    return {
      estado: "VERDE",
      dias,
      motivo: "intervalo pós-quimioterapia respeitado",
      rulesetVersao: versao,
    };
  }
  return {
    estado: "VERMELHO",
    dias,
    motivo: "intervalo pós-quimioterapia menor que o previsto (aviso)",
    rulesetVersao: versao,
  };
}

export function ehConcomitante(
  qt: { inicio: string; fim: string | null },
  rt: { inicio: string; fim: string | null },
  hoje: string,
): boolean {
  const qFim = qt.fim ?? hoje;
  const rFim = rt.fim ?? hoje;
  return qt.inicio <= rFim && rt.inicio <= qFim;
}

function tokenAC(esquemaId: string): boolean {
  return esquemaId.split(/[^A-Za-z0-9]+/).some((t) => t.toUpperCase() === "AC");
}

export function cicloVaiAoMedico(
  esquemaId: string,
  numeroCiclo: number,
  r: ResultadoTriagem,
  rs: DoseRuleset,
): boolean {
  if (tokenAC(esquemaId)) {
    if (rs.AC.ciclosComMedico.includes(numeroCiclo)) return true;
    return r.cortes.length > 0 || r.pendentes.length > 0;
  }
  return !r.qtPodeIniciarSemMedico;
}

export const funcoesF0: FuncoesF0 = {
  avaliarTriagem,
  decidirDestino,
  ordenarFila,
  calcularDose,
  validadeHemograma,
  avaliarPeso,
  avisoIntervaloPosQt,
  ehConcomitante,
  cicloVaiAoMedico,
};
