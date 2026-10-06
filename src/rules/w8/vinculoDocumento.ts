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

function cpfValido(raw: string): boolean {
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

function cnsValido(raw: string): boolean {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length !== 15 || !/^[1-9]/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < 15; i++) s += Number(d[i]) * (15 - i);
  return s % 11 === 0;
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
