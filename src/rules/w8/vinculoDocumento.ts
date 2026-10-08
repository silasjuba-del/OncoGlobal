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

export interface EntradaConfrontoNomeIdentificador {
  nomeDocumento?: string | null;
  identificador?: { tipo: TipoIdentificadorClinico; valor: string } | null;
  cadastroNome: string;
  cadastroIdentificadores?: readonly { tipo: TipoIdentificadorClinico; valor: string }[];
}

function nomeCanonico(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR").replace(/[^A-Z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

/** Detects contradictory identity evidence. It never chooses or links a patient. */
export function confrontarNomeIdentificador(entrada: EntradaConfrontoNomeIdentificador): SaidaVinculoDocumento {
  const nome = entrada.nomeDocumento?.trim();
  if (nome && nomeCanonico(nome) !== nomeCanonico(entrada.cadastroNome)) {
    return { liga: false, motivo: "conflito entre nome documental e nome do cadastro; revisão médica necessária" };
  }
  const id = entrada.identificador;
  if (id) {
    const match = (entrada.cadastroIdentificadores ?? []).some((cadastrado) => cadastrado.tipo === id.tipo
      && cadastrado.valor.replace(/\D/g, "") === id.valor.replace(/\D/g, ""));
    const validado = vincularDocumentoAoPaciente({ tipoDocumento: "LAUDO_PRIMARIO", papelPessoa: "PACIENTE",
      identificador: { valor: id.valor }, pacienteAlvo: { patientId: "confronto", identificadores: entrada.cadastroIdentificadores ?? [] } });
    if (!match || !validado.liga) return { liga: false,
      motivo: "conflito entre identificador documental e cadastro; revisão médica necessária" };
  }
  return { liga: true, motivo: "sem conflito de identidade nos campos documentais disponíveis; vínculo continua explícito" };
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

  return {
    liga: true,
    motivo: `identificador ${tipoPorValor} exato e válido por valor vincula ao paciente`,
  };
}
