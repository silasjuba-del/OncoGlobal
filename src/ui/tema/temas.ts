import type { Semaforo } from "../../contracts/estados.js";

/** Camada visual. Trocar o id não altera paciente, escopo, autoria nem E1. */
export const TEMAS = {
  gelo: { id: "gelo", nome: "Gelo" },
  contraste: { id: "contraste", nome: "Contraste" },
} as const;

export type TemaId = keyof typeof TEMAS;

/** Cor sempre junto da palavra. PENDENTE nunca cai na classe verde. */
export function classeSemaforo(estado: Semaforo): string {
  switch (estado) {
    case "VERDE":
      return "semaforo semaforo-verde";
    case "VERMELHO":
      return "semaforo semaforo-vermelho";
    case "PENDENTE":
      return "semaforo semaforo-pendente";
  }
}
