export interface PacienteBusca {
  patientId: string;
  nome: string;
  prontuario: string;
}

export type ComandoInterpretado =
  | { tipo: "INCOMPLETO" }
  | { tipo: "NADA" }
  | { tipo: "ABRIR"; patientId: string }
  | { tipo: "LISTA"; pacientes: readonly PacienteBusca[] }
  | { tipo: "PROXIMO" }
  | { tipo: "VALIDAR" }
  | { tipo: "IMPRIMIR" }
  | { tipo: "TRIAGEM" }
  | { tipo: "SALAO" }
  | { tipo: "APAC" }
  | { tipo: "CANAL" };

function norm(texto: string): string {
  return texto.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ");
}

function unico(lista: readonly PacienteBusca[]): ComandoInterpretado {
  if (lista.length === 1) {
    const paciente = lista[0];
    if (!paciente) return { tipo: "INCOMPLETO" };
    return { tipo: "ABRIR", patientId: paciente.patientId };
  }
  if (lista.length > 1) return { tipo: "LISTA", pacientes: lista };
  return { tipo: "INCOMPLETO" };
}

/** ROE-0: sem verbo, objeto ou paciente único, não escolhe sozinho. */
export function interpretarComando(texto: string, pacientes: readonly PacienteBusca[]): ComandoInterpretado {
  const frase = norm(texto);
  if (frase.length === 0) return { tipo: "INCOMPLETO" };
  if (frase === "proximo paciente") return { tipo: "PROXIMO" };
  if (frase === "validar tudo") return { tipo: "VALIDAR" };
  if (frase === "imprimir") return { tipo: "IMPRIMIR" };
  if (frase === "nova triagem") return { tipo: "TRIAGEM" };
  if (frase === "salao") return { tipo: "SALAO" };
  if (frase === "apac") return { tipo: "APAC" };
  if (frase === "canal") return { tipo: "CANAL" };
  if (!frase.startsWith("abrir")) return { tipo: "INCOMPLETO" };
  const alvo = frase.slice("abrir".length).trim();
  if (alvo.length === 0) return { tipo: "INCOMPLETO" };
  const porProntuario = pacientes.filter((p) => norm(p.prontuario) === alvo);
  if (porProntuario.length > 0) return unico(porProntuario);
  return unico(pacientes.filter((p) => norm(p.nome) === alvo));
}

/** Segue a ordem recebida. Não reordena e não inventa paciente depois do último. */
export function proximoPaciente(ordem: readonly string[], abertoId: string | null): string | null {
  if (ordem.length === 0) return null;
  if (!abertoId) return ordem[0] ?? null;
  const indice = ordem.indexOf(abertoId);
  if (indice < 0) return ordem[0] ?? null;
  return ordem[indice + 1] ?? null;
}
