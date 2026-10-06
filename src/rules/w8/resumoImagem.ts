// AG-08 · Resumo de imagem em 2 níveis (lições §3, S2)
// Regras puras: sem I/O, sem Date.now, sem Math.random.
// Resumo 1 (seco): sede + tamanho.
// Resumo 2 (modal): 8 campos, uma palavra cada, distinguindo ausente × nao_descrito × PENDENTE.
// Invariante S2: captação articular/degenerativa NUNCA vira "osso: lesão".

import type { Semaforo } from "../../contracts/estados.js";

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

/**
 * Normaliza um campo para exatamente UMA palavra, distinguindo
 * "ausente", "nao_descrito" e "PENDENTE".
 */
function normalizarCampo(
  val?: string | null,
  trechoRiscado?: boolean,
): CampoResumo2 {
  if (trechoRiscado) return "PENDENTE";
  if (!val || val.trim().length === 0) return "nao_descrito";

  const v = val.trim().toLowerCase();

  if (v === "nao_descrito" || v === "não descrito" || v === "nao descrito" || v === "omissao") {
    return "nao_descrito";
  }

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

  if (v === "pendente" || v === "duvidoso" || v === "inconclusivo") {
    return "PENDENTE";
  }

  // Uma única palavra: extrai o primeiro token significativo
  const primeiraPalavra = v.split(/[\s,;:.]+/)[0];
  return primeiraPalavra || "nao_descrito";
}

/**
 * Monta o resumo em dois níveis a partir da saída estruturada de laudos de imagem (RADS 1.1).
 */
export function gerarResumoImagem(entrada: EntradaRADS11): SaidaResumoImagem {
  const riscado = entrada.trechoRiscado === true;

  // Resumo 1: sede + tamanho
  const resumo1: Resumo1Imagem = {
    sede: riscado ? null : entrada.sede?.trim() || null,
    tamanho: riscado ? null : entrada.tamanho?.trim() || null,
  };

  const achados = entrada.achados ?? {};

  // Detecção da regra S2: captação articular degenerativa em cintilografia/imagem
  const textoGeral = `${entrada.textoLaudo ?? ""} ${achados.osso ?? ""} ${achados.naoOncologicos ?? ""}`.toLowerCase();
  const temAchadoDegenerativo =
    textoGeral.includes("articular") ||
    textoGeral.includes("degenerativ") ||
    textoGeral.includes("artrose") ||
    textoGeral.includes("espondilodisco");

  let ossoNorm = normalizarCampo(achados.osso, riscado);
  let naoOncoNorm = normalizarCampo(achados.naoOncologicos, riscado);

  // Invariante S2: captação articular degenerativa NUNCA vira lesão óssea neoplásica
  if (temAchadoDegenerativo) {
    // Se o osso foi incorretamente marcado como lesão/hiperfixação decorrente de artrose
    if (ossoNorm === "lesao" || ossoNorm === "hiperfixacao" || ossoNorm === "captacao") {
      ossoNorm = "ausente";
    }
    naoOncoNorm = "degenerativo";
  }

  const resumo2: Resumo2Imagem = {
    lesao: normalizarCampo(achados.lesao, riscado),
    dimensaoRecist: normalizarCampo(achados.dimensaoRecist, riscado),
    linfonodos: normalizarCampo(achados.linfonodos, riscado),
    osso: ossoNorm,
    pleura: normalizarCampo(achados.pleura, riscado),
    orgaosAdjacentes: normalizarCampo(achados.orgaosAdjacentes, riscado),
    infiltracaoObstrucaoPerfuracao: normalizarCampo(achados.infiltracaoObstrucaoPerfuracao, riscado),
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
