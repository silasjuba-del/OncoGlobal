import type { Fonte } from "../../contracts/base.js";
import { TipoIdentificador } from "../../contracts/clinico.js";
import type { Semaforo } from "../../contracts/estados.js";
import type { z } from "zod";

export type TipoIdentificadorClinico = z.infer<typeof TipoIdentificador>;

// ── AG-01 · Identificadores por valor ───────────────────────────────────────
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

export interface SaidaDedupeExame {
  totalPaginasOuEntradas: number;
  totalExamesUnicos: number;
  examesUnicos: {
    chave: string;
    examePrincipal: EntradaExameDedupe;
    entradasIds: string[];
    paginas: number[];
  }[];
  duplicatasDetectadas: {
    chave: string;
    idsDuplicados: string[];
  }[];
  conflitos: {
    chave: string;
    estado: Semaforo;
    motivo: string;
    idsEmConflito: string[];
  }[];
  concordancias: {
    chavesDistintas: [string, string];
    conclusaoComum: string;
  }[];
}

// ── AG-05 · Hierarquia de fonte ─────────────────────────────────────────────
export type NaturezaFonte = "PRIMARIA" | "SECUNDARIA" | "ADMINISTRATIVA";

export interface AchadoFonte {
  natureza: NaturezaFonte;
  valor: unknown;
  categoria?: string | null;
  escore?: number | string | null;
  fonte?: Fonte | null;
}

export interface SaidaHierarquiaFonte {
  valorEleito: unknown | null;
  origem: "PRIMARIA_CONFIRMADA" | "MENCIONADO_SEM_LAUDO" | "CONFLITO_ENTRE_FONTES" | "ADMINISTRATIVO_IGNORADO";
  estado: Semaforo;
  motivo: string;
  corrobora: boolean;
  conflito: boolean;
}

// ── AG-06 · Trecho riscado e baixa confiança ────────────────────────────────
export interface EntradaCampoExtraido {
  valor: unknown;
  riscado?: boolean;
  confianca?: number;
  recorteRef?: string | null;
}

export interface ConfigRasura {
  limiarConfiancaMinima: number; // [VERIFICAR ruleset]: injetado via ruleset
}

export interface SaidaAvaliacaoRasura {
  valor: unknown | null;
  estado: Semaforo;
  motivo: string;
  recorteRef: string | null;
  pendenteRevisao: boolean;
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
}

export interface RulesetPatologiaAgregacao {
  header?: { id: string; versao: string };
  ativo: boolean; // [VERIFICAR]: false até curadoria médica
}

export interface SaidaAgregacaoCaso {
  grauDoCaso: number | null;
  cribriformeNoCaso: "presente" | "ausente" | null;
  percentualFragmentosComprometidos: number | null;
  estado: Semaforo;
  motivo: string;
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
  };
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

// ── AG-09 · Interações sem fonte = PENDENTE ─────────────────────────────────
export interface RegraInteracaoItem {
  drogaA: string;
  drogaBouClasse: string;
  mecanismo: string | null;
  severidade: "LEVE" | "MODERADA" | "GRAVE" | "CONTRAINDICADA" | null;
  monitorizacao: string | null;
  notaManejo: string | null;
  fonte: {
    tipo: string;
    referencia: string;
    trecho: string | null;
    edicao: string | null;
  };
  ativo: boolean;
}

export interface RulesetInteracoes {
  header: {
    id: string;
    versao: string;
  };
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
