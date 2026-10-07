// GROK-13 · Projeção estrutural → vista do módulo. Não importa src/kernel.
// CURRENT e proposta não viram fato. Ausente não vira VERDE nem string vazia. Conflito permanece.

export interface CampoProjetado {
  valor: unknown;
  eventIds: readonly string[];
  estado: "VERDE" | "VERMELHO" | "PENDENTE";
  candidatos?: readonly { valor: unknown; eventId: string }[];
  proposta?: { valor: unknown; sourceId: string };
}

export interface ProjecaoEstrutural {
  kind: "CURRENT" | "CONFIRMED";
  patientId: string;
  tumorLotId: string | null;
  encounterId: string;
  projectionVersion: string;
  contentHash: string;
  campos: Record<string, CampoProjetado>;
  eventIds?: readonly string[];
}

export interface FatoAlinhado {
  campo: string;
  valor: string;
  estado: "VERDE";
  eventIds: readonly string[];
}

export interface PendenciaAlinhada {
  campo: string;
  estado: "PENDENTE";
  motivo: string;
}

export interface ConflitoAlinhado {
  campo: string;
  estado: "VERMELHO";
  motivo: string;
  candidatos: readonly { valor: unknown; eventId: string }[];
}

export interface PropostaIgnorada {
  campo: string;
  sourceId: string;
}

export interface SnapshotAlinhado {
  kind: "CONFIRMED";
  patientId: string;
  tumorLotId: string | null;
  encounterId: string;
  projectionVersion: string;
  contentHash: string;
  fatos: readonly FatoAlinhado[];
  pendencias: readonly PendenciaAlinhada[];
  conflitos: readonly ConflitoAlinhado[];
  propostasIgnoradas: readonly PropostaIgnorada[];
}

export type ResultadoAlinhamento =
  | { ok: true; snapshot: SnapshotAlinhado }
  | { ok: false; codigo: "CURRENT" | "ENTRADA"; motivo: string };

export function alinharSnapshotProjecao(entrada: ProjecaoEstrutural): ResultadoAlinhamento {
  if (entrada.kind === "CURRENT") {
    return {
      ok: false,
      codigo: "CURRENT",
      motivo: "snapshot CURRENT não vira fato confirmado",
    };
  }
  if (entrada.kind !== "CONFIRMED") {
    return { ok: false, codigo: "ENTRADA", motivo: "kind de projeção ausente" };
  }
  if (entrada.patientId.trim() === "" || entrada.contentHash.trim() === ""
    || entrada.projectionVersion.trim() === "" || entrada.encounterId.trim() === "") {
    return { ok: false, codigo: "ENTRADA", motivo: "identidade da projeção ausente" };
  }
  if (entrada.campos === null || typeof entrada.campos !== "object") {
    return { ok: false, codigo: "ENTRADA", motivo: "campos da projeção ausentes" };
  }

  const fatos: FatoAlinhado[] = [];
  const pendencias: PendenciaAlinhada[] = [];
  const conflitos: ConflitoAlinhado[] = [];
  const propostasIgnoradas: PropostaIgnorada[] = [];

  for (const campo of Object.keys(entrada.campos).sort()) {
    const projetado = entrada.campos[campo];
    if (projetado === undefined) continue;
    if (projetado.proposta) {
      propostasIgnoradas.push({ campo, sourceId: projetado.proposta.sourceId });
    }
    const eventIds = [...projetado.eventIds];
    if (projetado.estado === "VERMELHO" || (projetado.candidatos?.length ?? 0) > 1) {
      conflitos.push({
        campo,
        estado: "VERMELHO",
        motivo: "conflito de projeção permanece",
        candidatos: candidatosDe(projetado),
      });
      continue;
    }
    if (projetado.estado === "PENDENTE" || !valorConfirmado(projetado.valor)) {
      pendencias.push({
        campo,
        estado: "PENDENTE",
        motivo: projetado.estado === "VERDE"
          ? "ausente não é verde"
          : "ausente permanece pendente",
      });
      continue;
    }
    if (projetado.estado !== "VERDE") {
      pendencias.push({ campo, estado: "PENDENTE", motivo: "estado de projeção não confirmado" });
      continue;
    }
    fatos.push({ campo, valor: textoConfirmado(projetado.valor), estado: "VERDE", eventIds });
  }

  return {
    ok: true,
    snapshot: {
      kind: "CONFIRMED",
      patientId: entrada.patientId,
      tumorLotId: entrada.tumorLotId,
      encounterId: entrada.encounterId,
      projectionVersion: entrada.projectionVersion,
      contentHash: entrada.contentHash,
      fatos,
      pendencias,
      conflitos,
      propostasIgnoradas,
    },
  };
}

function candidatosDe(campo: CampoProjetado): { valor: unknown; eventId: string }[] {
  if (campo.candidatos && campo.candidatos.length > 0) return [...campo.candidatos];
  return campo.eventIds.map((eventId) => ({ valor: campo.valor, eventId }));
}

function valorConfirmado(valor: unknown): boolean {
  if (typeof valor === "string") return valor.trim() !== "";
  return typeof valor === "number" && Number.isFinite(valor);
}

function textoConfirmado(valor: unknown): string {
  if (typeof valor === "string") return valor.trim();
  return String(valor);
}
