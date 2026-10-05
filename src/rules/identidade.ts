import type { Paciente } from "../contracts/clinico.js";

export interface IdentificadoresEntrada {
  identificadores: readonly { tipo: "CNS" | "CPF" | "PRONTUARIO"; valor: string }[];
  nome?: string;
  nascimento?: string | null;
  /** Contact endpoints are deliberately NOT identity identifiers. */
  telefone?: string;
  email?: string;
}
export type ResultadoIdentidade =
  | { patientId: string }
  | { candidato: { patientId: string; motivo: "DEMOGRAFICO_EXATO" } }
  | { conflito: { patientIds: string[]; estado: "VERMELHO" } }
  | null;

/** FN-23: exact patient identifiers only. Demographics need human review. */
export function resolverIdentidade(ids: IdentificadoresEntrada, cadastro: readonly Paciente[]): ResultadoIdentidade {
  const encontrados = new Set<string>();
  for (const id of ids.identificadores) {
    if (!id.valor) continue;
    for (const pessoa of cadastro)
      if (pessoa.identificadores.some((stored) => stored.tipo === id.tipo && stored.valor === id.valor))
        encontrados.add(pessoa.patientId);
  }
  if (encontrados.size > 1) return { conflito: { patientIds: [...encontrados].sort(), estado: "VERMELHO" } };
  const exato = encontrados.values().next().value as string | undefined;
  if (exato) return { patientId: exato };
  // A mismatched supplied identifier is not overwritten by a name match.
  if (ids.identificadores.some((id) => id.valor)) return null;
  if (!ids.nome || !ids.nascimento) return null;
  const candidates = cadastro.filter((p) => p.nome === ids.nome && p.nascimento === ids.nascimento);
  if (candidates.length !== 1) return null;
  return { candidato: { patientId: candidates[0]!.patientId, motivo: "DEMOGRAFICO_EXATO" } };
}
