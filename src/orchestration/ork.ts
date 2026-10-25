import type { AgenteFake, Plano, ResultadoPasso, RunOrk, Passo, OpcoesOrk } from "./tipos.js";
import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";
import { VisaoIntegrada } from "../contracts/f1/visaoIntegrada.js";

const emAgente = new AsyncLocalStorage<boolean>();
/** Clone data without retaining executable capabilities returned by a legacy agent. */
function snapshotSaida(value: unknown): unknown {
  try { return structuredClone(value); } catch {
    const vistos = new WeakSet<object>();
    const copiar = (v: unknown): unknown => {
      if (v === null || typeof v === "string" || typeof v === "boolean" || typeof v === "number" || typeof v === "undefined") return v;
      if (typeof v !== "object" || vistos.has(v)) return null;
      vistos.add(v);
      if (Array.isArray(v)) return v.map(copiar);
      const proto = Object.getPrototypeOf(v);
      if (proto !== Object.prototype && proto !== null) return null;
      const out: Record<string, unknown> = {};
      for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(v))) {
        // Accessors are executable too; do not invoke them during publication.
        if (descriptor.enumerable && "value" in descriptor) Object.defineProperty(out, key, { value: copiar(descriptor.value), enumerable: true, writable: true, configurable: true });
      }
      return out;
    };
    return copiar(value);
  }
}
const planoSchema = z.object({ evento: z.string().min(1), passos: z.array(z.object({
  id: z.string().min(1), dependsOn: z.array(z.string().min(1)),
  timeoutMs: z.number().finite().int().positive().max(2_147_483_647),
}).strict()) }).strict();

/** Reentrada pelo ORK é proibida dentro do contexto assíncrono de um agente. */
export function verificarChamadaAgente(): { decisao: "PASSA" | "REJEITA" } {
  return { decisao: emAgente.getStore() ? "REJEITA" : "PASSA" };
}

function validarPlano(plano: Plano): void {
  const ids = new Set(plano.passos.map((p) => p.id));
  if (ids.size !== plano.passos.length || plano.passos.some((p) =>
    !p.id || p.timeoutMs <= 0 || p.dependsOn.includes(p.id)
      || p.dependsOn.some((dep) => !ids.has(dep)))) throw new Error("PLANO_INVALIDO");
  const done = new Set<string>();
  while (done.size < ids.size) {
    const ready = plano.passos.filter((p) => !done.has(p.id) && p.dependsOn.every((d) => done.has(d)));
    if (!ready.length) throw new Error("PLANO_CICLICO");
    for (const p of ready) done.add(p.id);
  }
}

async function executarUm(p: Passo, plano: Plano, agentes: Readonly<Record<string, AgenteFake>>,
  anteriores: readonly ResultadoPasso[], opcoes: OpcoesOrk): Promise<ResultadoPasso> {
  const agente = Object.hasOwn(agentes, p.id) ? agentes[p.id] : undefined;
  if (typeof agente !== "function") return { id: p.id, resultado: "missing", motivo: "AGENTE_INDISPONIVEL", tentativas: 0 };
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    let expirou = false;
    const notificar = (callback: ((id: string) => void) | undefined) => { try { callback?.(p.id); } catch { /* Audit failure cannot publish output. */ } };
    const trabalho = Promise.resolve().then(() => emAgente.run(true, () => agente({ evento: plano.evento,
      resultados: structuredClone(anteriores), signal: controller.signal })));
    trabalho.then(() => { if (expirou) notificar(opcoes.aoDescartarTardio); },
      () => { if (expirou) notificar(opcoes.aoDescartarTardio); });
    // Se o timeout vencer a corrida, uma falha tardia do agente não pode virar unhandledRejection.
    trabalho.catch(() => {});
    try {
      const outcome = await Promise.race([
        trabalho,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            expirou = true; reject(new Error("TIMEOUT")); controller.abort(); notificar(opcoes.onTimeout);
          }, p.timeoutMs);
        }),
      ]);
      if (outcome && typeof outcome === "object" && "failure" in outcome) {
        const failure = outcome.failure;
        if (failure === "missing" || failure === "unattempted")
          return { id: p.id, resultado: failure, motivo: "AGENTE_SEM_RESULTADO", tentativas: tentativa };
        if (failure === "error") {
          if (tentativa === 1) continue;
          return { id: p.id, resultado: "error", motivo: "AGENTE_ERRO", tentativas: tentativa };
        }
      }
      // In particular outcome.state has no authority over the run state.
      return { id: p.id, resultado: "ok", saida: snapshotSaida(outcome), tentativas: tentativa };
    } catch (err) {
      if (err instanceof Error && err.message === "TIMEOUT")
        return { id: p.id, resultado: "unattempted", motivo: "TIMEOUT", tentativas: tentativa };
      if (tentativa === 2)
        return { id: p.id, resultado: "error", motivo: "AGENTE_ERRO", tentativas: tentativa };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  throw new Error("INTERNAL_UNREACHABLE");
}

/** Dependency waves run concurrently; each Promise settles before the one-shot join. */
export async function executarOrk(plano: Plano, agentes: Readonly<Record<string, AgenteFake>>, opcoes: OpcoesOrk = {}): Promise<RunOrk> {
  if (verificarChamadaAgente().decisao === "REJEITA") throw new Error("COMPOSICAO_AGENTE_PROIBIDA");
  const parsed = planoSchema.safeParse(plano);
  if (!parsed.success) throw new Error("PLANO_INVALIDO");
  // Snapshot before any asynchronous callback; caller mutation cannot add steps.
  plano = structuredClone(parsed.data);
  agentes = { ...agentes };
  opcoes = { ...opcoes };
  validarPlano(plano);
  const run: RunOrk = { estado: "RECEBIDO", etapa: "RECEBIDO", resultados: [] };
  run.estado = "EM_CURSO";
  const pending = new Map(plano.passos.map((p) => [p.id, p]));
  while (pending.size) {
    const ready = [...pending.values()].filter((p) => p.dependsOn.every((id) =>
      run.resultados.some((result) => result.id === id)));
    if (!ready.length) throw new Error("PLANO_CICLICO");
    const successful = ready.filter((p) => p.id === "RECONCILIADOR" || p.dependsOn.every((id) =>
      run.resultados.find((r) => r.id === id)?.resultado === "ok"));
    for (const step of ready.filter((p) => !successful.includes(p))) {
      run.resultados.push({ id: step.id, resultado: "unattempted", motivo: "DEPENDENCIA_INDISPONIVEL", tentativas: 0 });
      pending.delete(step.id);
    }
    run.etapa = ready.map((p) => p.id).join("+");
    const settled = await Promise.allSettled(successful.map((p) => executarUm(p, plano, agentes, [...run.resultados], opcoes)));
    for (let i = 0; i < settled.length; i++) {
      const value = settled[i];
      const step = successful[i]!;
      run.resultados.push(value?.status === "fulfilled" ? value.value
        : { id: step.id, resultado: "error", motivo: "AGENTE_ERRO", tentativas: 1 });
      pending.delete(step.id);
    }
  }
  const final = plano.passos.at(-1);
  if (final?.id === "RECONCILIADOR") {
    const resultado = run.resultados.find(r => r.id === final.id);
    const visao = resultado?.resultado === "ok" ? VisaoIntegrada.safeParse(resultado.saida) : null;
    const setores = plano.passos.filter(p => p.id !== "RECONCILIADOR").map(p => p.id);
    const completa = visao?.success && setores.every(s => visao.data.cobertura.setoresEsperados.some(setor => setor === s))
      && visao.data.cobertura.setoresEsperados.every(s => visao.data.cobertura.setoresAvaliados.includes(s)
        || visao.data.lacunas.some(l => l.setor === s));
    run.estado = completa ? "PRONTO" : "FALHOU";
  } else {
    const resultadoFinal = final ? run.resultados.find((r) => r.id === final.id) : undefined;
    run.estado = resultadoFinal?.resultado === "ok" ? "PRONTO" : "FALHOU";
  }
  run.etapa = "JOIN";
  return run;
}

export function concluirRun(run: RunOrk): RunOrk {
  if (run.estado !== "PRONTO") throw new Error("RUN_NAO_PRONTO");
  return { ...run, estado: "CONCLUIDO", etapa: "FINALIZADO" };
}
