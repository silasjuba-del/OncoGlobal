import type { Contato, Paciente } from "../../contracts/clinico.js";
import { Contato as ContatoSchema } from "../../contracts/clinico.js";
import { resolverIdentidade, type IdentificadoresEntrada } from "../../rules/identidade.js";

export interface PendenciaVinculo {
  contatoNaoVinculadoId: string;
  endereco: string;
  candidatos: string[];
  estado: "PENDENTE" | "VERMELHO";
}
export type RoteamentoContato =
  | { vinculo: Contato; identidadePacienteConfirmada: false }
  | { fila: PendenciaVinculo };

/** An address finds a contact, not the identity of the message's author. */
export function rotearContato(
  endereco: string, contatoNaoVinculadoId: string, contatos: readonly Contato[],
  ids: IdentificadoresEntrada, cadastro: readonly Paciente[],
): RoteamentoContato {
  const matches = contatos.filter((c) => c.endereco === endereco && c.revogadoEm === null);
  const possiveis = [...new Set(matches.map((c) => c.patientId).filter((id): id is string => !!id))].sort();
  const identidade = resolverIdentidade(ids, cadastro);
  if (matches.length !== 1 || !matches[0]?.patientId || "conflito" in (identidade ?? {})) {
    return { fila: { contatoNaoVinculadoId, endereco, candidatos: possiveis,
      estado: matches.length > 1 || possiveis.length > 1 || (identidade && "conflito" in identidade)
        ? "VERMELHO" : "PENDENTE" } };
  }
  // An explicit, dated contact link is available, but the speaker may be a relative.
  // A name in the message can NEVER create a patient link.
  return { vinculo: matches[0], identidadePacienteConfirmada: false };
}

export function vincularContato(contato: Contato, patientId: string, em: string,
  relacao: Contato["relacao"]): Contato {
  if (contato.revogadoEm) throw new Error("CONTATO_REVOGADO");
  return ContatoSchema.parse({ ...contato, patientId, relacao, vinculadoEm: em, revogadoEm: null });
}

export function revogarVinculo(contato: Contato, em: string): Contato {
  if (!contato.patientId || !contato.vinculadoEm || em < contato.vinculadoEm)
    throw new Error("VINCULO_INVALIDO");
  // The dated link stays in the record for audit; routing ignores revoked links.
  return ContatoSchema.parse({ ...contato, revogadoEm: em });
}
