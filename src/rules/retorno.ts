// RETORNO como objeto operacional (decisão Dr. Silas): prazo + motivo + exames necessários antes do retorno.
// Função pura: sem relógio, rede ou I/O. A data de referência entra explícita. Nada é agendado nem enviado;
// a decisão é do médico, este módulo só calcula a agenda e os pedidos propostos.

export type PrazoUnidade = "DIAS" | "SEMANAS" | "MESES";

export interface PrazoRetorno {
  quantidade: number;
  unidade: PrazoUnidade;
}

export type TipoRetorno = "PROGRAMADO" | "CONDICIONADO" | "ANTECIPADO" | "SEM_RETORNO";

export interface ExameAntesRetorno {
  codigo?: string;
  nome?: string;
  prazoAntesDias: number;
}

export interface EntradaRetorno {
  prazo: PrazoRetorno | null;
  tipo: TipoRetorno;
  condicao?: string;
  motivo: string | null;
  examesAntes: ExameAntesRetorno[];
  /** Data civil ISO (AAAA-MM-DD) de onde o prazo é contado. Entrada explícita, nunca o relógio. */
  dataReferencia: string;
}

export interface PedidoExameRetorno {
  codigo?: string;
  nome?: string;
  dataLimite: string;
}

export interface AgendamentoRetorno {
  data: string;
  motivo: string;
}

export interface SaidaRetorno {
  estado: "PRONTO" | "PENDENTE";
  dataAlvo: string | null;
  pedidos: PedidoExameRetorno[];
  agendamento: AgendamentoRetorno | null;
  pendencias: string[];
}

const ISO_CIVIL = /^(\d{4})-(\d{2})-(\d{2})$/;

function ehInteiroNaoNegativo(valor: number): boolean {
  return Number.isInteger(valor) && valor >= 0;
}

/** Dias desde 1970-01-01 para data civil (algoritmo de dias por calendário gregoriano, sem relógio). */
function diasDeCivil(ano: number, mes: number, dia: number): number {
  const y = mes <= 2 ? ano - 1 : ano;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = (mes + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + dia - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Data civil a partir de dias desde 1970-01-01. */
function civilDeDias(dias: number): { ano: number; mes: number; dia: number } {
  const z = dias + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const dia = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const mes = mp < 10 ? mp + 3 : mp - 9;
  const ano = yoe + era * 400 + (mes <= 2 ? 1 : 0);
  return { ano, mes, dia };
}

function diasNoMes(ano: number, mes: number): number {
  return diasDeCivil(mes === 12 ? ano + 1 : ano, mes === 12 ? 1 : mes + 1, 1) - diasDeCivil(ano, mes, 1);
}

function parseDataCivil(data: string, campo: string): { ano: number; mes: number; dia: number } {
  const m = ISO_CIVIL.exec(data);
  if (!m) throw new Error(`${campo} deve ser data civil AAAA-MM-DD`);
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasNoMes(ano, mes)) {
    throw new Error(`${campo} não existe no calendário`);
  }
  return { ano, mes, dia };
}

function formatarDataCivil(ano: number, mes: number, dia: number): string {
  const aa = String(ano).padStart(4, "0");
  const mm = String(mes).padStart(2, "0");
  const dd = String(dia).padStart(2, "0");
  return `${aa}-${mm}-${dd}`;
}

function somarDiasCivis(data: string, dias: number): string {
  const { ano, mes, dia } = parseDataCivil(data, "dataReferencia");
  const c = civilDeDias(diasDeCivil(ano, mes, dia) + dias);
  return formatarDataCivil(c.ano, c.mes, c.dia);
}

function somarMesesCivis(data: string, meses: number): string {
  const { ano, mes, dia } = parseDataCivil(data, "dataReferencia");
  const indice = (mes - 1) + meses;
  const anoAlvo = ano + Math.floor(indice / 12);
  const mesAlvo = ((indice % 12) + 12) % 12 + 1;
  // Fim de mês preservado por clamp: 31/01 + 1 mês = 28/02 (ou 29/02 em ano bissexto).
  return formatarDataCivil(anoAlvo, mesAlvo, Math.min(dia, diasNoMes(anoAlvo, mesAlvo)));
}

function calcularDataAlvo(dataReferencia: string, prazo: PrazoRetorno): string {
  if (!ehInteiroNaoNegativo(prazo.quantidade)) {
    throw new Error("prazo.quantidade deve ser inteiro não negativo");
  }
  if (prazo.unidade === "DIAS") return somarDiasCivis(dataReferencia, prazo.quantidade);
  if (prazo.unidade === "SEMANAS") return somarDiasCivis(dataReferencia, prazo.quantidade * 7);
  return somarMesesCivis(dataReferencia, prazo.quantidade);
}

function textoPreenchido(valor: string | null | undefined): boolean {
  return typeof valor === "string" && valor.trim().length > 0;
}

/**
 * Calcula o objeto RETORNO. Mesma entrada = mesma saída.
 * Lança erro só para entrada malformada (data inválida, prazo negativo); lacunas clínicas viram pendências.
 */
export function calcularRetorno(entrada: EntradaRetorno): SaidaRetorno {
  parseDataCivil(entrada.dataReferencia, "dataReferencia");

  if (entrada.tipo === "SEM_RETORNO") {
    return { estado: "PRONTO", dataAlvo: null, pedidos: [], agendamento: null, pendencias: [] };
  }

  const pendencias: string[] = [];

  let dataAlvo: string | null = null;
  if (entrada.prazo === null) {
    pendencias.push("prazo do retorno ausente");
  } else {
    dataAlvo = calcularDataAlvo(entrada.dataReferencia, entrada.prazo);
  }

  if (entrada.tipo === "CONDICIONADO" && !textoPreenchido(entrada.condicao)) {
    pendencias.push("condição do retorno ausente");
  }

  if (!textoPreenchido(entrada.motivo)) {
    pendencias.push("motivo do retorno ausente");
  }

  const pedidos: PedidoExameRetorno[] = [];
  for (const exame of entrada.examesAntes) {
    if (!ehInteiroNaoNegativo(exame.prazoAntesDias)) {
      throw new Error("examesAntes.prazoAntesDias deve ser inteiro não negativo");
    }
    const identificado = textoPreenchido(exame.codigo) || textoPreenchido(exame.nome);
    if (!identificado) {
      pendencias.push("exame necessário sem código ou nome");
      continue;
    }
    if (dataAlvo === null) continue;
    const identificacao = textoPreenchido(exame.codigo)
      ? { codigo: exame.codigo as string }
      : { nome: exame.nome as string };
    pedidos.push({ ...identificacao, dataLimite: somarDiasCivis(dataAlvo, -exame.prazoAntesDias) });
  }

  const pronto = pendencias.length === 0;
  const agendamento: AgendamentoRetorno | null = pronto && dataAlvo !== null
    ? { data: dataAlvo, motivo: (entrada.motivo as string).trim() }
    : null;

  return {
    estado: pronto ? "PRONTO" : "PENDENTE",
    dataAlvo,
    pedidos,
    agendamento,
    pendencias,
  };
}
