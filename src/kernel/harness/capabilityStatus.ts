import { CapabilityStatus, type CapabilityStatus as CapabilityStatusTipo } from "../../contracts/estados.js";

export interface DecisaoFonteAlertaCapability {
  gate: "G-22";
  mostrarComoFonteAlerta: boolean;
  rotulo: string;
  motivo: string;
}

/**
 * G-22 · só status TESTED ou superior, por allowlist explícita, pode aparecer como fonte de alerta.
 * Ausente/desconhecido não é convertido: fica oculto e rotulado em validação.
 */
export function decidirFonteAlertaPorCapabilityStatus(status: unknown): DecisaoFonteAlertaCapability {
  const parsed = CapabilityStatus.safeParse(status);
  if (!parsed.success) {
    return { gate: "G-22", mostrarComoFonteAlerta: false, rotulo: "Em validação",
      motivo: "status da capacidade ausente ou desconhecido; fonte de alerta oculta" };
  }

  const valor: CapabilityStatusTipo = parsed.data;
  switch (valor) {
    case "TESTED":
      return { gate: "G-22", mostrarComoFonteAlerta: true, rotulo: "TESTED",
        motivo: "capacidade testada pode aparecer como fonte de alerta" };
    case "VALIDATED":
      return { gate: "G-22", mostrarComoFonteAlerta: true, rotulo: "VALIDATED",
        motivo: "capacidade validada pode aparecer como fonte de alerta" };
    case "OPERATING":
      return { gate: "G-22", mostrarComoFonteAlerta: true, rotulo: "OPERATING",
        motivo: "capacidade operando pode aparecer como fonte de alerta" };
    case "SPECIFIED":
      return { gate: "G-22", mostrarComoFonteAlerta: false, rotulo: "Em validação",
        motivo: "capacidade apenas especificada; fonte de alerta oculta até TESTED" };
    case "DISABLED":
      return { gate: "G-22", mostrarComoFonteAlerta: false, rotulo: "Desativada · em validação",
        motivo: "capacidade desativada; fonte de alerta oculta e permanece em validação" };
    default:
      return { gate: "G-22", mostrarComoFonteAlerta: false, rotulo: "Em validação",
        motivo: "status de capacidade sem regra explícita; fonte de alerta oculta" };
  }
}
