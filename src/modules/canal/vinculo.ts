// GRK-09 · Vínculo por identificador exato. Nome não liga. Telefone compartilhado vai à fila.
// Resposta fixa só com consentimento registrado (A10).

export type TipoIdentificador = "CNS" | "CPF" | "PRONTUARIO" | "TELEFONE" | "EMAIL";

export interface IdentificadorExato {
  tipo: TipoIdentificador;
  valor: string;
}

export interface CadastroVinculo {
  patientId: string;
  identificadores: readonly IdentificadorExato[];
  chaveDemografica: string | null;
  nome: string | null;
}

export interface ContatoVinculo {
  contatoId: string;
  tipo: TipoIdentificador;
  endereco: string;
  nomeInformado: string | null;
  chaveDemografica: string | null;
  consentimentoRegistrado: boolean;
}

export interface ResultadoVinculo {
  classe: "VINCULO" | "CANDIDATO" | "FILA";
  patientId: string | null;
  patientIds: string[];
  podeRespostaFixa: boolean;
  motivo: string;
}

export function resolverVinculo(
  contato: ContatoVinculo,
  cadastros: readonly CadastroVinculo[],
): ResultadoVinculo {
  const endereco = contato.endereco.trim();
  const consentimento = contato.consentimentoRegistrado === true;
  const sufixoConsentimento = consentimento ? "" : " resposta fixa exige consentimento registrado (A10)";

  if (endereco.length === 0) {
    return fila(consentimento, `endereço ausente; nome não vincula.${sufixoConsentimento}`);
  }

  const porIdentificador = cadastros.filter((cadastro) =>
    cadastro.identificadores.some((id) => id.tipo === contato.tipo && id.valor.trim() === endereco),
  );
  const ids = unicos(porIdentificador.map((cadastro) => cadastro.patientId));

  if (contato.tipo === "TELEFONE" && ids.length > 1) {
    return fila(consentimento, `telefone compartilhado não prova identidade.${sufixoConsentimento}`);
  }
  if (ids.length > 1) {
    return fila(consentimento, `identificador exato em mais de um cadastro; nada eleito.${sufixoConsentimento}`);
  }
  if (ids.length === 1) {
    const patientId = ids[0];
    if (patientId === undefined) return fila(consentimento, `sem identificador exato.${sufixoConsentimento}`);
    return {
      classe: "VINCULO",
      patientId,
      patientIds: [patientId],
      podeRespostaFixa: consentimento,
      motivo: `identificador exato.${sufixoConsentimento}`.trim(),
    };
  }

  const chave = contato.chaveDemografica?.trim() ?? "";
  if (chave.length > 0) {
    const porDemografia = cadastros.filter((cadastro) => (cadastro.chaveDemografica?.trim() ?? "") === chave);
    const demograficos = unicos(porDemografia.map((cadastro) => cadastro.patientId));
    if (demograficos.length === 1) {
      const patientId = demograficos[0];
      if (patientId !== undefined) {
        return {
          classe: "CANDIDATO",
          patientId: null,
          patientIds: [patientId],
          podeRespostaFixa: consentimento,
          motivo: `demográfico exato aguarda revisão; nome não foi usado.${sufixoConsentimento}`.trim(),
        };
      }
    }
    if (demograficos.length > 1) {
      return fila(consentimento, `demográfico exato em mais de um cadastro.${sufixoConsentimento}`);
    }
  }

  return fila(consentimento, `sem identificador exato; nome não vincula.${sufixoConsentimento}`);
}

function fila(consentimento: boolean, motivo: string): ResultadoVinculo {
  return {
    classe: "FILA",
    patientId: null,
    patientIds: [],
    podeRespostaFixa: consentimento,
    motivo: motivo.trim(),
  };
}

function unicos(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}
