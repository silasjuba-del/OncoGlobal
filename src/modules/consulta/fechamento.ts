// GRK-03 · Validar prepara o escopo exibido (A1/G-25) e o reconhecimento (K-14). Não imprime (K-15).

export const BLOCOS = ["EVOLUCAO", "PRESCRICAO", "EXAMES", "RETORNO", "APAC", "TUDO"] as const;
export type BlocoFechamento = (typeof BLOCOS)[number];

export interface ItemExibido {
  documentId: string;
  documentVersion: number;
  exibido: boolean;
}

export interface AlertaExibido {
  alertaId: string;
  exibido: boolean;
}

export interface DocumentoNoEscopo {
  documentId: string;
  documentVersion: number;
}

export interface PlanoFechamento {
  bloco: BlocoFechamento | null;
  escopoAssinatura: DocumentoNoEscopo[];
  alertasAReconhecer: string[];
  imprime: false;
  motivo: string;
}

export function planejarFechamento(
  bloco: BlocoFechamento,
  itensExibidos: readonly ItemExibido[],
  alertas: readonly AlertaExibido[],
): PlanoFechamento {
  if (!(BLOCOS as readonly string[]).includes(bloco)) {
    return {
      bloco: null,
      escopoAssinatura: [],
      alertasAReconhecer: [],
      imprime: false,
      motivo: "bloco desconhecido; nada entra no escopo",
    };
  }

  const escopoAssinatura: DocumentoNoEscopo[] = [];
  const vistos = new Set<string>();
  for (const item of itensExibidos) {
    if (!item.exibido) continue;
    if (item.documentId.trim().length === 0) continue;
    if (!Number.isInteger(item.documentVersion) || item.documentVersion < 1) continue;
    const chave = `${item.documentId}\u0000${item.documentVersion}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    escopoAssinatura.push({ documentId: item.documentId, documentVersion: item.documentVersion });
  }

  const alertasAReconhecer: string[] = [];
  const alertasVistos = new Set<string>();
  for (const alerta of alertas) {
    if (!alerta.exibido) continue;
    if (alerta.alertaId.trim().length === 0) continue;
    if (alertasVistos.has(alerta.alertaId)) continue;
    alertasVistos.add(alerta.alertaId);
    alertasAReconhecer.push(alerta.alertaId);
  }

  return {
    bloco,
    escopoAssinatura,
    alertasAReconhecer,
    imprime: false,
    motivo: escopoAssinatura.length === 0
      ? "nada exibido para assinar; validar não imprime"
      : "escopo limitado ao que foi exibido; validar não imprime",
  };
}
