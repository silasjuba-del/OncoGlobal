import { Contato, type Contato as ContatoType } from "../../contracts/clinico.js";
import type { ClinicalEvent } from "../../contracts/operacao.js";
import { ClosureVinculoContato } from "../../contracts/w10/closure.js";

export interface ContatoOrigem { event: ClinicalEvent; value: ContatoType }
export interface ContatoProjetado extends ContatoOrigem {
  patientIdResolvido: string | null;
  estadoVinculo: "VINCULADO" | "PENDENTE" | "CONFLITO";
  candidatosVinculo: readonly string[];
  reviewEventIds: readonly string[];
}

/** Projection of explicit identity decisions, preserving source event identity and context. */
export function projetarVinculosContato(contatos: readonly ContatoOrigem[], eventos: readonly ClinicalEvent[]): ContatoProjetado[] {
  return contatos.map((origem) => {
    const decisoes = eventos.flatMap((event) => {
      if (event.tipo !== "ReviewDecision" || (event.revisao !== "CONFIRMADO" && event.revisao !== "ASSINADO")
        || event.criadoPor.tipo !== "SESSAO") return [];
      const outer = event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
        ? event.payload as Record<string, unknown> : null;
      if (typeof outer?.reviewDecisionId !== "string" || !outer.reviewDecisionId) return [];
      const parsed = ClosureVinculoContato.safeParse(outer.data);
      if (!parsed.success || parsed.data.contatoId !== origem.value.contatoId
        || parsed.data.sourceEventId !== origem.event.eventId || parsed.data.patientId !== event.patientId
        || parsed.data.encounterId !== event.encounterId || parsed.data.tumorLotId !== event.tumorLotId) return [];
      return [{ event, value: parsed.data }];
    });
    const candidatos = [...new Set([...(origem.value.patientId ? [origem.value.patientId] : []),
      ...decisoes.map((d) => d.value.patientId)])];
    const fontesDuplicadas = contatos.filter((c) => c.value.contatoId === origem.value.contatoId).length !== 1;
    const conflito = fontesDuplicadas || candidatos.length > 1;
    const escolhido = !conflito && origem.value.revogadoEm === null ? candidatos[0] ?? null : null;
    const value = Contato.parse({ ...origem.value, patientId: escolhido,
      vinculadoEm: escolhido ? origem.value.vinculadoEm ?? decisoes[0]?.event.criadoEm ?? null : null });
    return { event: origem.event, value, patientIdResolvido: escolhido,
      estadoVinculo: conflito ? "CONFLITO" : escolhido ? "VINCULADO" : "PENDENTE",
      candidatosVinculo: candidatos, reviewEventIds: decisoes.map((d) => d.event.eventId) };
  });
}
