import type { ClinicalEvent } from "../../contracts/operacao.js";

function dados(e: ClinicalEvent): Record<string, unknown> | null {
  if (!e.payload || typeof e.payload !== "object" || !("data" in e.payload)) return null;
  const data = e.payload.data;
  return data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : null;
}
const confirmado = (e: ClinicalEvent) => e.revisao === "CONFIRMADO" || e.revisao === "ASSINADO";
// The envelope contract admits only bare types and their explicit v1 alias.
const tipoBase = (tipo: string) => tipo.replace(/@1$/, "");
function listaMedicamentos(e: ClinicalEvent): boolean {
  const data = dados(e);
  return /^FATO(?:@1)?$/.test(e.tipo) && data?.campo === "medicamentos"
    && Array.isArray(data.valor) && data.valor.every(v => typeof v === "string" && v.trim().length > 0);
}

/** Explicit corrections cannot acquire authority over a different claim or earlier registration. */
export function supersessaoValida(anterior: ClinicalEvent, atual: ClinicalEvent): boolean {
  if (atual.supersedesEventId !== anterior.eventId || anterior.eventId === atual.eventId
    || !confirmado(anterior) || !confirmado(atual) || anterior.patientId !== atual.patientId
    || tipoBase(anterior.tipo) !== tipoBase(atual.tipo)) return false;
  const a = dados(anterior), b = dados(atual);
  if (!a || !b || a.campo !== b.campo) return false;
  // D-F1-18: only the typed medication list is explicitly global across tumor lots.
  if (anterior.tumorLotId !== atual.tumorLotId && !(listaMedicamentos(anterior) && listaMedicamentos(atual))) return false;
  const antes = Date.parse(anterior.criadoEm), depois = Date.parse(atual.criadoEm);
  if (!Number.isFinite(antes) || !Number.isFinite(depois) || antes > depois) return false;
  // At equal timestamps, the explicit pointer to an existing row establishes causality.
  // Opaque operation/event IDs never decide clinical precedence. Within an operation,
  // the target must precede its correction in the atomic insertion order.
  return anterior.operationId !== atual.operationId || anterior.eventIndex < atual.eventIndex;
}

/** Read legacy history defensively without rewriting it. Cyclic edges have no authority. */
export function idsSubstituidosValidos(eventos: readonly ClinicalEvent[]): Set<string> {
  const porId = new Map(eventos.map(e => [e.eventId, e]));
  const arestas = new Map<string, string>();
  for (const atual of eventos) {
    const anterior = atual.supersedesEventId ? porId.get(atual.supersedesEventId) : undefined;
    if (anterior && supersessaoValida(anterior, atual)) arestas.set(atual.eventId, anterior.eventId);
  }
  const visitados = new Set<string>(), ciclicos = new Set<string>();
  for (const inicio of arestas.keys()) {
    const caminho: string[] = [], posicoes = new Map<string, number>();
    let id: string | undefined = inicio;
    while (id !== undefined && !visitados.has(id)) {
      const posicao = posicoes.get(id);
      if (posicao !== undefined) {
        for (const membro of caminho.slice(posicao)) ciclicos.add(membro);
        break;
      }
      posicoes.set(id, caminho.length); caminho.push(id); id = arestas.get(id);
    }
    for (const membro of caminho) visitados.add(membro);
  }
  return new Set([...arestas].filter(([origem]) => !ciclicos.has(origem)).map(([, alvo]) => alvo));
}
