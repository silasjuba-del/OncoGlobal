// AG-07 · Patologia por sítio e validação ISUP (lições P1–P3)
// Regras puras: sem I/O, sem Date.now, sem Math.random.
// Soma de percentuais Gleason = 100.
// Primário/secundário coerentes com ISUP por tabela com fonte (ISUP 2014/OMS [VERIFICAR edição]).
// agregarCaso existe mas retorna PENDENTE enquanto o ruleset patologia-agregacao estiver inativo.

import type { Semaforo } from "../../contracts/estados.js";

export interface EntradaSitioPatologia {
  sitio: string; // Ex: "Lobo direito - ápice", "Frasco A"
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
  header?: {
    id: string;
    versao: string;
  };
  ativo: boolean; // [VERIFICAR]: false até definição formal com Dr. Silas
}

export interface SaidaAgregacaoCaso {
  grauDoCaso: number | null;
  cribriformeNoCaso: "presente" | "ausente" | null;
  percentualFragmentosComprometidos: number | null;
  estado: Semaforo;
  motivo: string;
}

/**
 * [VERIFICAR edição]: Tabela canônica de correspondência Gleason -> Grupo de Grau ISUP
 * Fonte estável: Consenso ISUP 2014 / Classificação OMS de Tumores do Sistema Urogenital (OMS 2016 / 5ª ed. 2022).
 */
export function calcularGrupoGrauISUP(
  primario: number,
  secundario: number,
): number | null {
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

/**
 * Valida a integridade matemática e a consistência histológica de um sítio de biópsia.
 * - P1: negação de cribriforme preservada por sítio.
 * - Soma de percentuais Gleason deve fechar 100%.
 * - Inconsistência entre Gleason primário/secundário e ISUP gera conflito VERMELHO.
 */
export function validarSitioPatologia(sitio: EntradaSitioPatologia): SaidaValidacaoSitio {
  // Validação da soma de percentuais Gleason
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

  // Validação da coerência Gleason primário + secundário versus grupo de grau ISUP
  if (
    typeof sitio.gleasonPrimario === "number" &&
    typeof sitio.gleasonSecundario === "number"
  ) {
    const esperado = calcularGrupoGrauISUP(
      sitio.gleasonPrimario,
      sitio.gleasonSecundario,
    );

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

/**
 * P2: Agregação do caso como um todo (grau do caso, cribriforme geral, % fragmentos).
 * Deve ser estritamente governada por regras, NUNCA por LLM.
 * Enquanto o ruleset patologia-agregacao estiver inativo, retorna PENDENTE.
 */
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

  // Se o ruleset estiver formalmente ativo:
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
      // continua negativo
    } else {
      todosCribriformesNegativos = false;
    }

    if (typeof s.fragmentosComprometidos === "number") {
      totalComprometidos += s.fragmentosComprometidos;
    }
    if (typeof s.fragmentosAvaliados === "number") {
      totalAvaliados += s.fragmentosAvaliados;
    }
  }

  const cribriformeNoCaso = algumCribriforme
    ? "presente"
    : todosCribriformesNegativos
      ? "ausente"
      : null;

  const pct =
    totalAvaliados > 0
      ? Math.round((totalComprometidos / totalAvaliados) * 100)
      : null;

  return {
    grauDoCaso: maiorGrau > 0 ? maiorGrau : null,
    cribriformeNoCaso,
    percentualFragmentosComprometidos: pct,
    estado: "VERDE",
    motivo: "caso agregado com base no ruleset patologia-agregacao ativo",
  };
}
