import type { Executor } from "../../kernel/gateway/gateway.js";

/** Capacidades sem implementação local ficam inertes e não tentam rede. */
export function criarExecutorDesabilitado(codigo = "CAPACIDADE_DESABILITADA"): Executor {
  return {
    async executar() {
      return { ok: false, incerto: false, erro: codigo };
    },
  };
}
