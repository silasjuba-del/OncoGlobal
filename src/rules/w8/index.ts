// API pública W8 · Regras puras do caso real (identidade, patologia, dedupe, fonte, imagem)
// Sem I/O, sem Date.now, sem Math.random. Só importa contratos (R-08 / check-boundaries).

import type { Fonte } from "../../contracts/base.js";
import type { TipoIdentificador } from "../../contracts/clinico.js";
import type { Semaforo } from "../../contracts/estados.js";

// Re-exportações de tipos e funções das fatias AG-01 até AG-09

// ── AG-01 · Identificador por valor ─────────────────────────────────────────
export type TipoIdentificadorPorValor = "CPF" | "CNS" | "DESCONHECIDO";

export interface EntradaClassificarIdentificador {
  rotulo?: string | null;
  valor: string;
}

export interface SaidaClassificarIdentificador {
  tipoPorValor: TipoIdentificadorPorValor;
  valido: boolean;
  conflitoRotulo: boolean;
}

export function cpfValido(raw: string): boolean {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

/**
 * [VERIFICAR fonte]: Validação pública do CNS (Portaria SAS/MS nº 711/2004).
 */
export function cnsValido(raw: string): boolean {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length !== 15 || !/^[1-9]/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < 15; i++) s += Number(d[i]) * (15 - i);
  return s % 11 === 0;
}

export function classificarIdentificador(
  entrada: EntradaClassificarIdentificador,
): SaidaClassificarIdentificador {
  const d = (entrada.valor ?? "").replace(/\D/g, "");
  let tipoPorValor: TipoIdentificadorPorValor = "DESCONHECIDO";
  let valido = false;

  if (d.length === 11) {
    tipoPorValor = "CPF";
    valido = cpfValido(entrada.valor);
  } else if (d.length === 15) {
    tipoPorValor = "CNS";
    valido = cnsValido(entrada.valor);
  }

  let esperado: "CPF" | "CNS" | "OUTRO" | null = null;
  if (entrada.rotulo) {
    const r = entrada.rotulo.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (/\b(CPF|CIC)\b/.test(r)) esperado = "CPF";
    else if (/\b(CNS|CARTAO\s+SUS|SUS)\b/.test(r)) esperado = "CNS";
    else if (/\b(CI|RG|IDENTIDADE|REGISTRO\s+GERAL|MATRICULA|PRONTUARIO)\b/.test(r)) esperado = "OUTRO";
  }

  let conflitoRotulo = false;
  if (esperado !== null) {
    if (esperado === "CPF" && tipoPorValor !== "CPF") conflitoRotulo = true;
    else if (esperado === "CNS" && tipoPorValor !== "CNS") conflitoRotulo = true;
    else if (esperado === "OUTRO" && (tipoPorValor === "CPF" || tipoPorValor === "CNS")) conflitoRotulo = true;
  }

  return { tipoPorValor, valido, conflitoRotulo };
}

// ── AG-02 · Vínculo de documento ao paciente ────────────────────────────────
export type TipoDocumentoVinculo =
  | "COMPROVANTE_RESIDENCIA_TERCEIRO"
  | "FICHA_ADMIN"
  | "LAUDO_PRIMARIO"
  | "RECEITUARIO_SECUNDARIO"
  | "DOC_PESSOAL"
  | "OUTRO";

export type PapelPessoaDocumento =
  | "PACIENTE"
  | "ACOMPANHANTE"
  | "FAMILIAR"
  | "MEDICO_SOLICITANTE"
  | "MEDICO_ASSISTENTE"
  | "MEDICO_LAUDISTA"
  | "TERCEIRO"
  | "DESCONHECIDO";

export type TipoIdentificadorClinico = "CNS" | "CPF" | "PRONTUARIO";

export interface EntradaVinculoDocumento {
  tipoDocumento: TipoDocumentoVinculo;
  papelPessoa?: PapelPessoaDocumento;
  identificador?: {
    rotulo?: string | null;
    valor: string;
  } | null;
  pacienteAlvo?: {
    patientId: string;
    identificadores: readonly { tipo: TipoIdentificadorClinico; valor: string }[];
  } | null;
}

export interface SaidaVinculoDocumento {
  liga: boolean;
  motivo: string;
}

export function vincularDocumentoAoPaciente(
  entrada: EntradaVinculoDocumento,
): SaidaVinculoDocumento {
  if (entrada.tipoDocumento === "COMPROVANTE_RESIDENCIA_TERCEIRO") {
    return {
      liga: false,
      motivo: "comprovante de terceiro em nome de outra pessoa nunca vincula paciente (I3)",
    };
  }
  if (
    entrada.papelPessoa === "ACOMPANHANTE" ||
    entrada.papelPessoa === "FAMILIAR" ||
    entrada.papelPessoa === "TERCEIRO"
  ) {
    return {
      liga: false,
      motivo: "assinatura ou dado de acompanhante/familiar não vincula paciente (I4)",
    };
  }
  if (
    entrada.papelPessoa === "MEDICO_SOLICITANTE" ||
    entrada.papelPessoa === "MEDICO_ASSISTENTE" ||
    entrada.papelPessoa === "MEDICO_LAUDISTA"
  ) {
    return {
      liga: false,
      motivo: "médico solicitante, assistente ou laudista não vincula identidade do paciente (I5)",
    };
  }
  if (!entrada.identificador || !entrada.identificador.valor) {
    return {
      liga: false,
      motivo: "documento sem identificador numérico não pode vincular paciente",
    };
  }
  if (!entrada.pacienteAlvo) {
    return {
      liga: false,
      motivo: "paciente alvo ausente para conferência de vínculo",
    };
  }

  const d = entrada.identificador.valor.replace(/\D/g, "");
  let tipoPorValor: "CPF" | "CNS" | "DESCONHECIDO" = "DESCONHECIDO";
  let valido = false;
  if (d.length === 11) {
    tipoPorValor = "CPF";
    valido = cpfValido(entrada.identificador.valor);
  } else if (d.length === 15) {
    tipoPorValor = "CNS";
    valido = cnsValido(entrada.identificador.valor);
  }

  if (!valido || tipoPorValor === "DESCONHECIDO") {
    return {
      liga: false,
      motivo: "identificador do documento inválido por valor ou DV incorreto",
    };
  }

  const match = entrada.pacienteAlvo.identificadores.some((item) => {
    if (item.tipo !== tipoPorValor) return false;
    return item.valor.replace(/\D/g, "") === d;
  });

  if (!match) {
    return {
      liga: false,
      motivo: `identificador ${tipoPorValor} válido por valor não coincide com nenhum identificador do paciente alvo`,
    };
  }

  return {
    liga: true,
    motivo: `identificador ${tipoPorValor} exato e válido por valor vincula ao paciente`,
  };
}

// ── AG-03 · Data clínica e idade derivada ───────────────────────────────────
export interface EntradaDataClinica {
  dataClinica?: string | null;
  dataEmissao?: string | null;
  dataAssinaturaDigital?: string | null;
  dataExtracaoSistema?: string | null;
}

export interface SaidaDataClinica {
  data: string | null;
  estado: Semaforo;
  motivo: string;
}

export interface SaidaIdadeNaData {
  idadeAnos: number | null;
  estado: Semaforo;
  motivo: string;
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MS_POR_DIA = 86_400_000;

export function escolherDataClinica(entrada: EntradaDataClinica): SaidaDataClinica {
  const clinica = entrada.dataClinica ? entrada.dataClinica.trim() : null;
  if (!clinica) {
    const temOutras = Boolean(
      entrada.dataEmissao ||
      entrada.dataAssinaturaDigital ||
      entrada.dataExtracaoSistema,
    );
    return {
      data: null,
      estado: "PENDENTE",
      motivo: temOutras
        ? "data clínica ausente: emissão, assinatura digital ou extração não substituem data clínica (T1)"
        : "data clínica ausente",
    };
  }
  if (!ISO_DATE_REGEX.test(clinica)) {
    return {
      data: null,
      estado: "PENDENTE",
      motivo: `data clínica '${clinica}' inválida (formato esperado YYYY-MM-DD)`,
    };
  }
  return {
    data: clinica,
    estado: "VERDE",
    motivo: "data clínica de coleta/realização identificada",
  };
}

export function idadeNaData(
  nascimento: string | null | undefined,
  dataRef: string | null | undefined,
  offsetDias: number = 0,
): SaidaIdadeNaData {
  if (!nascimento || !dataRef) {
    return {
      idadeAnos: null,
      estado: "PENDENTE",
      motivo: "data de nascimento ou data de referência ausente",
    };
  }
  const nascLimpo = nascimento.trim();
  const refLimpa = dataRef.trim();
  if (!ISO_DATE_REGEX.test(nascLimpo) || !ISO_DATE_REGEX.test(refLimpa)) {
    return {
      idadeAnos: null,
      estado: "PENDENTE",
      motivo: "formato de data inválido para cálculo de idade (exige YYYY-MM-DD)",
    };
  }

  const nascY = Number(nascLimpo.slice(0, 4));
  const nascM = Number(nascLimpo.slice(5, 7));
  const nascD = Number(nascLimpo.slice(8, 10));

  const refY = Number(refLimpa.slice(0, 4));
  const refM = Number(refLimpa.slice(5, 7));
  const refD = Number(refLimpa.slice(8, 10));

  const refUtcMs = Date.UTC(refY, refM - 1, refD) + offsetDias * MS_POR_DIA;
  const dRefEfetiva = new Date(refUtcMs);

  const effY = dRefEfetiva.getUTCFullYear();
  const effM = dRefEfetiva.getUTCMonth() + 1;
  const effD = dRefEfetiva.getUTCDate();

  let anos = effY - nascY;
  if (effM < nascM || (effM === nascM && effD < nascD)) anos -= 1;

  if (anos < 0) {
    return {
      idadeAnos: null,
      estado: "PENDENTE",
      motivo: "data de referência é anterior à data de nascimento",
    };
  }
  return {
    idadeAnos: anos,
    estado: "VERDE",
    motivo: "idade calculada estritamente por derivação cronológica na data de referência (T2)",
  };
}

// ── AG-04 · Deduplicação de exame ───────────────────────────────────────────
export type TipoExameDedupe = "PATOLOGIA_IHQ" | "IMAGEM" | "OUTRO";

export interface EntradaExameDedupe {
  id: string;
  tipo: TipoExameDedupe;
  laboratorio?: string | null;
  numeroExame?: string | null;
  dataEntrada?: string | null;
  servico?: string | null;
  registro?: string | null;
  dataExame?: string | null;
  conteudoHash?: string | null;
  conteudoResumo?: string | null;
  conclusao?: string | null;
  pagina?: number;
}

export interface ExameUnicoAgrupado {
  chave: string;
  examePrincipal: EntradaExameDedupe;
  entradasIds: string[];
  paginas: number[];
  estado: Semaforo;
}

export interface SaidaDedupeExame {
  totalPaginasOuEntradas: number;
  totalExamesUnicos: number;
  examesUnicos: ExameUnicoAgrupado[];
  duplicatasDetectadas: { chave: string; idsDuplicados: string[] }[];
  conflitos: { chave: string; estado: Semaforo; motivo: string; idsEmConflito: string[] }[];
  concordancias: { chavesDistintas: [string, string]; conclusaoComum: string }[];
}

function normalizarStr(s?: string | null): string {
  if (!s) return "NULO";
  return s.trim().toUpperCase().replace(/\s+/g, "_");
}

export function gerarChaveDedupe(exame: EntradaExameDedupe): string {
  if (exame.tipo === "PATOLOGIA_IHQ") {
    return `PATOLOGIA_IHQ:${normalizarStr(exame.laboratorio)}:${normalizarStr(exame.numeroExame)}:${normalizarStr(exame.dataEntrada)}`;
  }
  if (exame.tipo === "IMAGEM") {
    return `IMAGEM:${normalizarStr(exame.servico)}:${normalizarStr(exame.registro)}:${normalizarStr(exame.dataExame)}`;
  }
  return `OUTRO:${normalizarStr(exame.servico ?? exame.laboratorio)}:${normalizarStr(exame.registro ?? exame.numeroExame)}:${normalizarStr(exame.dataExame ?? exame.dataEntrada)}`;
}

export function deduplicarExames(entradas: EntradaExameDedupe[]): SaidaDedupeExame {
  const grupos = new Map<string, EntradaExameDedupe[]>();
  for (const item of entradas) {
    const chave = gerarChaveDedupe(item);
    const lista = grupos.get(chave) ?? [];
    lista.push(item);
    grupos.set(chave, lista);
  }

  const examesUnicos: ExameUnicoAgrupado[] = [];
  const duplicatasDetectadas: SaidaDedupeExame["duplicatasDetectadas"] = [];
  const conflitos: SaidaDedupeExame["conflitos"] = [];

  for (const [chave, itens] of grupos.entries()) {
    if (itens.length === 0) continue;
    const principal = itens[0]!;
    const ids = itens.map((i) => i.id);
    const paginas = itens.map((i) => i.pagina ?? 0).filter((p) => p > 0);

    let temConflito = false;
    if (itens.length > 1) {
      const primeiroHash = principal.conteudoHash ?? normalizarStr(principal.conteudoResumo);
      for (let k = 1; k < itens.length; k++) {
        const itemK = itens[k];
        if (itemK) {
          const hashAtual = itemK.conteudoHash ?? normalizarStr(itemK.conteudoResumo);
          if (primeiroHash !== hashAtual) {
            temConflito = true;
            break;
          }
        }
      }
    }

    if (temConflito) {
      conflitos.push({
        chave,
        estado: "VERMELHO",
        motivo: "mesma chave de exame com conteúdos discordantes (conflito de versão ou laudo alterado)",
        idsEmConflito: ids,
      });
      examesUnicos.push({
        chave,
        examePrincipal: principal,
        entradasIds: ids,
        paginas,
        estado: "VERMELHO",
      });
    } else {
      if (itens.length > 1) {
        duplicatasDetectadas.push({ chave, idsDuplicados: ids.slice(1) });
      }
      examesUnicos.push({
        chave,
        examePrincipal: principal,
        entradasIds: ids,
        paginas,
        estado: "VERDE",
      });
    }
  }

  const concordancias: SaidaDedupeExame["concordancias"] = [];
  for (let i = 0; i < examesUnicos.length; i++) {
    for (let j = i + 1; j < examesUnicos.length; j++) {
      const a = examesUnicos[i];
      const b = examesUnicos[j];
      if (!a || !b) continue;
      const cA = a.examePrincipal.conclusao ? a.examePrincipal.conclusao.trim().toLowerCase() : null;
      const cB = b.examePrincipal.conclusao ? b.examePrincipal.conclusao.trim().toLowerCase() : null;
      if (cA && cB && cA === cB && a.chave !== b.chave) {
        concordancias.push({
          chavesDistintas: [a.chave, b.chave],
          conclusaoComum: a.examePrincipal.conclusao!,
        });
      }
    }
  }

  return {
    totalPaginasOuEntradas: entradas.length,
    totalExamesUnicos: examesUnicos.length,
    examesUnicos,
    duplicatasDetectadas,
    conflitos,
    concordancias,
  };
}

// ── AG-05 · Hierarquia de fonte ─────────────────────────────────────────────
export type NaturezaFonte = "PRIMARIA" | "SECUNDARIA" | "ADMINISTRATIVA";

export interface AchadoFonte {
  natureza: NaturezaFonte;
  valor?: unknown | null;
  categoria?: string | null;
  escore?: number | string | null;
  fonte?: Fonte | null;
  descricao?: string | null;
}

export type OrigemResultado =
  | "PRIMARIA_CONFIRMADA"
  | "MENCIONADO_SEM_LAUDO"
  | "CONFLITO_ENTRE_FONTES"
  | "CATEGORIA_SEM_VALOR"
  | "ADMINISTRATIVO_IGNORADO";

export interface SaidaHierarquiaFonte {
  valorEleito: unknown | null;
  origem: OrigemResultado;
  estado: Semaforo;
  motivo: string;
  corrobora: boolean;
  conflito: boolean;
}

export function avaliarHierarquiaFonte(
  primaria?: AchadoFonte | null,
  secundaria?: AchadoFonte | null,
  administrativa?: AchadoFonte | null,
): SaidaHierarquiaFonte {
  const eCatSemNum = (item?: AchadoFonte | null) => {
    if (!item) return false;
    if (item.categoria && (item.escore === null || item.escore === undefined || item.escore === "")) return true;
    if (typeof item.valor === "string") {
      const limpo = item.valor.trim().toUpperCase();
      if (/^(PIRADS|PI-RADS|BIRADS|BI-RADS|LIRADS|LI-RADS)$/.test(limpo)) return true;
    }
    return false;
  };

  if (eCatSemNum(primaria) || eCatSemNum(secundaria)) {
    return {
      valorEleito: null,
      origem: "CATEGORIA_SEM_VALOR",
      estado: "PENDENTE",
      motivo: "categoria informada sem escore ou número associado (E3: proibido inferir classificação)",
      corrobora: false,
      conflito: false,
    };
  }

  if (primaria && primaria.valor !== null && primaria.valor !== undefined) {
    if (secundaria && secundaria.valor !== null && secundaria.valor !== undefined) {
      const strA = String(primaria.valor ?? "").trim().toLowerCase();
      const strB = String(secundaria.valor ?? "").trim().toLowerCase();
      const concorda = primaria.valor === secundaria.valor || (strA.length > 0 && strA === strB);
      if (concorda) {
        return {
          valorEleito: primaria.valor,
          origem: "PRIMARIA_CONFIRMADA",
          estado: "VERDE",
          motivo: "laudo primário comprobatório prevalece e fonte secundária corrobora (E1)",
          corrobora: true,
          conflito: false,
        };
      }
      return {
        valorEleito: primaria.valor,
        origem: "CONFLITO_ENTRE_FONTES",
        estado: "VERMELHO",
        motivo: "fonte secundária diverge do laudo primário (E1: conflito registrado)",
        corrobora: false,
        conflito: true,
      };
    }
    return {
      valorEleito: primaria.valor,
      origem: "PRIMARIA_CONFIRMADA",
      estado: "VERDE",
      motivo: "laudo primário comprobatório prevalece (E1)",
      corrobora: false,
      conflito: false,
    };
  }

  if (secundaria && secundaria.valor !== null && secundaria.valor !== undefined) {
    return {
      valorEleito: secundaria.valor,
      origem: "MENCIONADO_SEM_LAUDO",
      estado: "PENDENTE",
      motivo: "mencionado em documento secundário de outro médico, sem laudo comprobatório (E2)",
      corrobora: false,
      conflito: false,
    };
  }

  if (administrativa && administrativa.valor !== null && administrativa.valor !== undefined) {
    return {
      valorEleito: null,
      origem: "ADMINISTRATIVO_IGNORADO",
      estado: "PENDENTE",
      motivo: "documento administrativo não estabelece fato clínico comprobatório",
      corrobora: false,
      conflito: false,
    };
  }

  return {
    valorEleito: null,
    origem: "MENCIONADO_SEM_LAUDO",
    estado: "PENDENTE",
    motivo: "dado ausente em todas as fontes",
    corrobora: false,
    conflito: false,
  };
}

// ── AG-06 · Trecho riscado e baixa confiança ────────────────────────────────
export interface EntradaCampoExtraido {
  valor: unknown;
  riscado?: boolean;
  confianca?: number;
  recorteRef?: string | null;
}

export interface ConfigRasura {
  limiarConfiancaMinima: number;
}

export interface SaidaAvaliacaoRasura {
  valor: unknown | null;
  estado: Semaforo;
  motivo: string;
  recorteRef: string | null;
  pendenteRevisao: boolean;
}

export function avaliarRasuraEConfianca(
  campo: EntradaCampoExtraido,
  config: ConfigRasura,
): SaidaAvaliacaoRasura {
  const recorte = campo.recorteRef ?? null;
  if (campo.riscado === true) {
    return {
      valor: null,
      estado: "PENDENTE",
      motivo: "trecho riscado à mão: não usar sem revisão médica (R1)",
      recorteRef: recorte,
      pendenteRevisao: true,
    };
  }
  if (
    campo.confianca !== undefined &&
    campo.confianca !== null &&
    campo.confianca < config.limiarConfiancaMinima
  ) {
    return {
      valor: null,
      estado: "PENDENTE",
      motivo: `baixa confiança de extração (${campo.confianca} < limiar ${config.limiarConfiancaMinima}): requer conferência médica (C1)`,
      recorteRef: recorte,
      pendenteRevisao: true,
    };
  }
  if (campo.valor === null || campo.valor === undefined) {
    return {
      valor: null,
      estado: "PENDENTE",
      motivo: "campo ausente ou não informado",
      recorteRef: recorte,
      pendenteRevisao: false,
    };
  }
  return {
    valor: campo.valor,
    estado: "VERDE",
    motivo: "extração íntegra e confiança satisfatória",
    recorteRef: recorte,
    pendenteRevisao: false,
  };
}

// ── AG-07 · Patologia por sítio ─────────────────────────────────────────────
export interface EntradaSitioPatologia {
  sitio: string;
  lateralidade?: "DIREITA" | "ESQUERDA" | "BILATERAL" | "CENTRAL" | null;
  posicao?: "BASE" | "TERCO_MEDIO" | "APICE" | "OUTRA" | null;
  fragmentosComprometidos?: number | null;
  fragmentosAvaliados?: number | null;
  percentuaisGleason?: number[] | null;
  gleasonPrimario?: number | null;
  gleasonSecundario?: number | null;
  grupoGrauISUP?: number | null;
  padraoCribriforme?: "presente" | "ausente" | null;
}

export interface SaidaValidacaoSitio {
  valido: boolean;
  conflito: boolean;
  estado: Semaforo;
  motivo: string;
  isupEsperado?: number | null;
}

export interface RulesetPatologiaAgregacao {
  header?: { id: string; versao: string };
  ativo: boolean;
}

export interface SaidaAgregacaoCaso {
  grauDoCaso: number | null;
  cribriformeNoCaso: "presente" | "ausente" | null;
  percentualFragmentosComprometidos: number | null;
  estado: Semaforo;
  motivo: string;
}

export function calcularGrupoGrauISUP(primario: number, secundario: number): number | null {
  if (primario === 3 && secundario === 3) return 1;
  if (primario === 3 && secundario === 4) return 2;
  if (primario === 4 && secundario === 3) return 3;
  if (
    (primario === 4 && secundario === 4) ||
    (primario === 3 && secundario === 5) ||
    (primario === 5 && secundario === 3)
  )
    return 4;
  if (
    (primario === 4 && secundario === 5) ||
    (primario === 5 && secundario === 4) ||
    (primario === 5 && secundario === 5)
  )
    return 5;
  return null;
}

export function validarSitioPatologia(sitio: EntradaSitioPatologia): SaidaValidacaoSitio {
  if (sitio.percentuaisGleason && sitio.percentuaisGleason.length > 0) {
    const soma = sitio.percentuaisGleason.reduce((acc, val) => acc + val, 0);
    if (Math.abs(soma - 100) > 0.01) {
      return {
        valido: false,
        conflito: true,
        estado: "VERMELHO",
        motivo: `soma dos percentuais de padrão Gleason (${soma}%) diverge de 100%`,
      };
    }
  }

  if (typeof sitio.gleasonPrimario === "number" && typeof sitio.gleasonSecundario === "number") {
    const esperado = calcularGrupoGrauISUP(sitio.gleasonPrimario, sitio.gleasonSecundario);
    if (esperado !== null && typeof sitio.grupoGrauISUP === "number") {
      if (sitio.grupoGrauISUP !== esperado) {
        return {
          valido: false,
          conflito: true,
          estado: "VERMELHO",
          motivo: `inconsistência histológica: Gleason ${sitio.gleasonPrimario}+${sitio.gleasonSecundario} corresponde ao Grupo de Grau ISUP ${esperado}, mas o laudo reportou ${sitio.grupoGrauISUP}`,
          isupEsperado: esperado,
        };
      }
    }
    return {
      valido: true,
      conflito: false,
      estado: "VERDE",
      motivo: "sítio patológico íntegro e consistente com tabela ISUP 2014/OMS [VERIFICAR edição]",
      isupEsperado: esperado,
    };
  }

  return {
    valido: true,
    conflito: false,
    estado: "VERDE",
    motivo: "sítio patológico estruturado sem dados conflitantes",
  };
}

export function agregarCaso(
  sitios: EntradaSitioPatologia[],
  ruleset?: RulesetPatologiaAgregacao,
): SaidaAgregacaoCaso {
  if (!ruleset || ruleset.ativo !== true) {
    return {
      grauDoCaso: null,
      cribriformeNoCaso: null,
      percentualFragmentosComprometidos: null,
      estado: "PENDENTE",
      motivo: "ruleset patologia-agregacao inativo: agregação de grau do caso e padrão cribriforme pendente de validação médica [VERIFICAR]",
    };
  }

  let maiorGrau = 0;
  let algumCribriforme = false;
  let todosCribriformesNegativos = true;
  let totalComprometidos = 0;
  let totalAvaliados = 0;

  for (const s of sitios) {
    if (typeof s.grupoGrauISUP === "number" && s.grupoGrauISUP > maiorGrau) {
      maiorGrau = s.grupoGrauISUP;
    }
    if (s.padraoCribriforme === "presente") {
      algumCribriforme = true;
      todosCribriformesNegativos = false;
    } else if (s.padraoCribriforme === "ausente") {
      // continua ausente
    } else {
      todosCribriformesNegativos = false;
    }

    if (typeof s.fragmentosComprometidos === "number") totalComprometidos += s.fragmentosComprometidos;
    if (typeof s.fragmentosAvaliados === "number") totalAvaliados += s.fragmentosAvaliados;
  }

  const cribriformeNoCaso = algumCribriforme
    ? "presente"
    : todosCribriformesNegativos
      ? "ausente"
      : null;

  const pct = totalAvaliados > 0 ? Math.round((totalComprometidos / totalAvaliados) * 100) : null;

  return {
    grauDoCaso: maiorGrau > 0 ? maiorGrau : null,
    cribriformeNoCaso,
    percentualFragmentosComprometidos: pct,
    estado: "VERDE",
    motivo: "caso agregado com base no ruleset patologia-agregacao ativo",
  };
}

// ── AG-08 · Resumo de imagem em 2 níveis ────────────────────────────────────
export interface EntradaRADS11 {
  sede?: string | null;
  tamanho?: string | null;
  achados?: {
    lesao?: string | null;
    dimensaoRecist?: string | null;
    linfonodos?: string | null;
    osso?: string | null;
    pleura?: string | null;
    orgaosAdjacentes?: string | null;
    infiltracaoObstrucaoPerfuracao?: string | null;
    naoOncologicos?: string | null;
  } | null;
  textoLaudo?: string | null;
  trechoRiscado?: boolean;
}

export interface Resumo1Imagem {
  sede: string | null;
  tamanho: string | null;
}

export type CampoResumo2 = "ausente" | "nao_descrito" | "PENDENTE" | string;

export interface Resumo2Imagem {
  lesao: CampoResumo2;
  dimensaoRecist: CampoResumo2;
  linfonodos: CampoResumo2;
  osso: CampoResumo2;
  pleura: CampoResumo2;
  orgaosAdjacentes: CampoResumo2;
  infiltracaoObstrucaoPerfuracao: CampoResumo2;
  naoOncologicos: CampoResumo2;
}

export interface SaidaResumoImagem {
  resumo1: Resumo1Imagem;
  resumo2: Resumo2Imagem;
  estado: Semaforo;
  motivo: string;
}

function normalizarCampoResumo(val?: string | null, trechoRiscado?: boolean): CampoResumo2 {
  if (trechoRiscado) return "PENDENTE";
  if (!val || val.trim().length === 0) return "nao_descrito";
  const v = val.trim().toLowerCase();
  if (v === "nao_descrito" || v === "não descrito" || v === "nao descrito" || v === "omissao") return "nao_descrito";
  if (
    v === "ausente" ||
    v === "sem_lesao" ||
    v === "negativo" ||
    v === "livre" ||
    v.startsWith("sem ") ||
    v.startsWith("nao ") ||
    v.startsWith("não ")
  ) {
    return "ausente";
  }
  if (v === "pendente" || v === "duvidoso" || v === "inconclusivo") return "PENDENTE";
  return v.split(/[\s,;:.]+/)[0] || "nao_descrito";
}

export function gerarResumoImagem(entrada: EntradaRADS11): SaidaResumoImagem {
  const riscado = entrada.trechoRiscado === true;
  const resumo1: Resumo1Imagem = {
    sede: riscado ? null : entrada.sede?.trim() || null,
    tamanho: riscado ? null : entrada.tamanho?.trim() || null,
  };

  const achados = entrada.achados ?? {};
  const textoGeral = `${entrada.textoLaudo ?? ""} ${achados.osso ?? ""} ${achados.naoOncologicos ?? ""}`.toLowerCase();
  const temAchadoDegenerativo =
    textoGeral.includes("articular") ||
    textoGeral.includes("degenerativ") ||
    textoGeral.includes("artrose") ||
    textoGeral.includes("espondilodisco");

  let ossoNorm = normalizarCampoResumo(achados.osso, riscado);
  let naoOncoNorm = normalizarCampoResumo(achados.naoOncologicos, riscado);

  if (temAchadoDegenerativo) {
    if (ossoNorm === "lesao" || ossoNorm === "hiperfixacao" || ossoNorm === "captacao") {
      ossoNorm = "ausente";
    }
    naoOncoNorm = "degenerativo";
  }

  const resumo2: Resumo2Imagem = {
    lesao: normalizarCampoResumo(achados.lesao, riscado),
    dimensaoRecist: normalizarCampoResumo(achados.dimensaoRecist, riscado),
    linfonodos: normalizarCampoResumo(achados.linfonodos, riscado),
    osso: ossoNorm,
    pleura: normalizarCampoResumo(achados.pleura, riscado),
    orgaosAdjacentes: normalizarCampoResumo(achados.orgaosAdjacentes, riscado),
    infiltracaoObstrucaoPerfuracao: normalizarCampoResumo(achados.infiltracaoObstrucaoPerfuracao, riscado),
    naoOncologicos: naoOncoNorm,
  };

  const temPendente = Object.values(resumo2).some((v) => v === "PENDENTE") || riscado;

  return {
    resumo1,
    resumo2,
    estado: temPendente ? "PENDENTE" : "VERDE",
    motivo: temPendente
      ? "resumo de imagem possui campos com pendência ou rasura"
      : "resumo de imagem estruturado em 2 níveis com sucesso",
  };
}

// ── AG-09 · Interações sem fonte = PENDENTE ─────────────────────────────────
export interface RegraInteracaoItem {
  drogaA: string;
  drogaBouClasse: string;
  mecanismo?: string | null;
  severidade?: "LEVE" | "MODERADA" | "GRAVE" | "CONTRAINDICADA" | string | null;
  monitorizacao?: string | null;
  notaManejo?: string | null;
  fonte?: {
    tipo?: string | null;
    referencia?: string | null;
    trecho?: string | null;
    edicao?: string | null;
  } | null;
  ativo: boolean;
}

export interface RulesetInteracoes {
  header?: { id: string; versao: string };
  interacoes: readonly RegraInteracaoItem[];
}

export interface SaidaAvaliacaoInteracao {
  drogaA: string;
  drogaB: string;
  estado: Semaforo;
  severidade: string | null;
  motivo: string;
  regraAtiva: boolean;
  fonteReferencia: string | null;
}

export function avaliarInteracaoMedicamentosa(
  droga1: string,
  droga2: string,
  ruleset: RulesetInteracoes,
): SaidaAvaliacaoInteracao {
  const d1 = droga1?.trim() || "droga_1";
  const d2 = droga2?.trim() || "droga_2";

  const norm = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const match = (r: string, c: string) => {
    const nr = norm(r);
    const nc = norm(c);
    return nr === nc || nc.includes(nr) || nr.includes(nc);
  };

  const regras = ruleset?.interacoes ?? [];
  const regraEncontrada = regras.find((item) => {
    const direta = match(item.drogaA, d1) && match(item.drogaBouClasse, d2);
    const inversa = match(item.drogaA, d2) && match(item.drogaBouClasse, d1);
    return direta || inversa;
  });

  const temFonteValida =
    regraEncontrada?.fonte?.referencia &&
    regraEncontrada.fonte.referencia.trim() !== "" &&
    regraEncontrada.fonte.referencia !== "[VERIFICAR]";

  if (regraEncontrada && regraEncontrada.ativo === true && temFonteValida) {
    const sev = regraEncontrada.severidade || "MODERADA";
    return {
      drogaA: d1,
      drogaB: d2,
      estado: "VERMELHO",
      severidade: sev,
      motivo: `interação ativa detectada: ${regraEncontrada.drogaA} + ${regraEncontrada.drogaBouClasse} (severidade ${sev})`,
      regraAtiva: true,
      fonteReferencia: regraEncontrada.fonte!.referencia!,
    };
  }

  return {
    drogaA: d1,
    drogaB: d2,
    estado: "PENDENTE",
    severidade: null,
    motivo: "não verificado: ausência de regra ativa com fonte clínica comprovada",
    regraAtiva: false,
    fonteReferencia: null,
  };
}
