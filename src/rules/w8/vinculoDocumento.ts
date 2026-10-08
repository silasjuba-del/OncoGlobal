import { cpfValido } from "./identificadores.js";
import { cnsValido } from "../cns.js";
// AG-02 · Vínculo de documento ao paciente (lições I3–I5)
// Regras puras: comprovante de terceiro, acompanhante e médicos solicitante/assistente
// nunca ligam paciente nem preenchem dados. Só identificador exato VÁLIDO POR VALOR liga.

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
  /** Nome impresso no documento; quando presente é conferido contra o cadastro (D-W9-34a). */
  nomeDocumento?: string | null;
  identificador?: {
    rotulo?: string | null;
    valor: string;
  } | null;
  pacienteAlvo?: {
    patientId: string;
    nome?: string | null;
    identificadores: readonly { tipo: TipoIdentificadorClinico; valor: string }[];
  } | null;
}

export interface SaidaVinculoDocumento {
  liga: boolean;
  motivo: string;
}

export interface EntradaConfrontoNome {
  nomeDocumento?: string | null;
  identificador?: { tipo: TipoIdentificadorClinico; valor: string } | null;
  cadastroNome?: string | null;
}

export interface SaidaConfrontoNome {
  /** true quando o nome do documento diverge do cadastro do identificador: conflito visível. */
  excecao: boolean;
  motivo: string;
}

/** Nome em forma comparável: sem acento, caixa, pontuação ou espaço duplicado. */
function nomeComparavel(nome: string): string[] {
  return nome.normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLocaleUpperCase("pt-BR").replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/).filter(Boolean);
}

/**
 * Confronta o nome impresso no documento com o nome do cadastro do paciente ligado
 * pelo identificador. Divergência ⇒ exceção de revisão; nunca escolhe um dos dois em silêncio.
 * Um nome é compatível quando os tokens são iguais ou um é subconjunto do outro (≥ 2 tokens).
 */
export function confrontarNomeIdentificador(entrada: EntradaConfrontoNome): SaidaConfrontoNome {
  const documento = entrada.nomeDocumento ? nomeComparavel(entrada.nomeDocumento) : [];
  const cadastro = entrada.cadastroNome ? nomeComparavel(entrada.cadastroNome) : [];
  if (!documento.length || !cadastro.length) {
    return { excecao: false, motivo: "nome ausente em documento ou cadastro: confronto de nome não aplicável" };
  }
  const menor = documento.length <= cadastro.length ? documento : cadastro;
  const maior = menor === documento ? cadastro : documento;
  const conjunto = new Set(maior);
  const mesmoNome = documento.join(" ") === cadastro.join(" ");
  const compativel = mesmoNome || (menor.length >= 2 && menor.every((token) => conjunto.has(token)));
  if (compativel) return { excecao: false, motivo: "nome do documento compatível com o cadastro" };
  const tipo = entrada.identificador?.tipo ?? "identificador";
  return {
    excecao: true,
    motivo: `conflito de nome: nome impresso no documento diverge do cadastro vinculado por ${tipo} (revisão obrigatória, D-W9-34a)`,
  };
}

/**
 * Avalia se o documento ou fragmento vincula legitimamente ao cadastro do paciente.
 * Bloqueia vínculos por comprovantes em nome de terceiro (I3), assinatura de acompanhante (I4)
 * e figuras médicas (I5). Exige identificador com DV válido e correspondência exata por valor.
 */
export function vincularDocumentoAoPaciente(
  entrada: EntradaVinculoDocumento,
): SaidaVinculoDocumento {
  // I3: Comprovante de terceiro (familiar/locatário)
  if (entrada.tipoDocumento === "COMPROVANTE_RESIDENCIA_TERCEIRO") {
    return {
      liga: false,
      motivo: "comprovante de terceiro em nome de outra pessoa nunca vincula paciente (I3)",
    };
  }

  // I4: Assinatura ou registro de acompanhante/familiar/terceiro
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

  // I5: Médico solicitante, assistente ou laudista
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
    const cleanItem = item.valor.replace(/\D/g, "");
    return cleanItem === d;
  });

  if (!match) {
    return {
      liga: false,
      motivo: `identificador ${tipoPorValor} válido por valor não coincide com nenhum identificador do paciente alvo`,
    };
  }

  const confronto = confrontarNomeIdentificador({
    nomeDocumento: entrada.nomeDocumento ?? null,
    identificador: { tipo: tipoPorValor, valor: entrada.identificador.valor },
    cadastroNome: entrada.pacienteAlvo.nome ?? null,
  });
  if (confronto.excecao) {
    return { liga: false, motivo: confronto.motivo };
  }

  return {
    liga: true,
    motivo: `identificador ${tipoPorValor} exato e válido por valor vincula ao paciente`,
  };
}
