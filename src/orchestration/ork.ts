import type { AgenteFake, Plano, ResultadoPasso, RunOrk, Passo } from "./tipos.js";

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
  anteriores: readonly ResultadoPasso[]): Promise<ResultadoPasso> {
  const agente = agentes[p.id];
  if (!agente) return { id: p.id, resultado: "missing", motivo: "AGENTE_INDISPONIVEL", tentativas: 0 };
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const trabalho = Promise.resolve().then(() => agente({ evento: plano.evento, resultados: anteriores }));
    // Se o timeout vencer a corrida, uma falha tardia do agente não pode virar unhandledRejection.
    trabalho.catch(() => {});
    try {
      const outcome = await Promise.race([
        trabalho,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("TIMEOUT")), p.timeoutMs);
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
      return { id: p.id, resultado: "ok", saida: outcome, tentativas: tentativa };
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
export async function executarOrk(plano: Plano, agentes: Readonly<Record<string, AgenteFake>>): Promise<RunOrk> {
  validarPlano(plano);
  const run: RunOrk = { estado: "RECEBIDO", etapa: "RECEBIDO", resultados: [] };
  run.estado = "EM_CURSO";
  const pending = new Map(plano.passos.map((p) => [p.id, p]));
  while (pending.size) {
    const ready = [...pending.values()].filter((p) => p.dependsOn.every((id) =>
      run.resultados.some((result) => result.id === id)));
    if (!ready.length) throw new Error("PLANO_CICLICO");
    const successful = ready.filter((p) => p.dependsOn.every((id) =>
      run.resultados.find((r) => r.id === id)?.resultado === "ok"));
    for (const step of ready.filter((p) => !successful.includes(p))) {
      run.resultados.push({ id: step.id, resultado: "unattempted", motivo: "DEPENDENCIA_INDISPONIVEL", tentativas: 0 });
      pending.delete(step.id);
    }
    run.etapa = ready.map((p) => p.id).join("+");
    const settled = await Promise.allSettled(successful.map((p) => executarUm(p, plano, agentes, [...run.resultados])));
    for (let i = 0; i < settled.length; i++) {
      const value = settled[i];
      const step = successful[i]!;
      run.resultados.push(value?.status === "fulfilled" ? value.value
        : { id: step.id, resultado: "error", motivo: "AGENTE_ERRO", tentativas: 1 });
      pending.delete(step.id);
    }
  }
  run.estado = run.resultados.some((r) => r.resultado === "ok") ? "PRONTO" : "FALHOU";
  run.etapa = "JOIN";
  return run;
}

export function concluirRun(run: RunOrk): RunOrk {
  if (run.estado !== "PRONTO") throw new Error("RUN_NAO_PRONTO");
  return { ...run, estado: "CONCLUIDO", etapa: "FINALIZADO" };
}
