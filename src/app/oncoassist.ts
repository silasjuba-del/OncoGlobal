import { createHash } from "node:crypto";
import { z } from "zod";
import { contemPhiResidual, desidentificar, type DicionarioPaciente } from "../kernel/llm/desidentificar.js";
import { criarTransporteJev, TimeoutTransporteJev } from "../kernel/llm/jev/sdk.js";
import {
  entradaJevSchema, respostaJevSchema, TIMEOUT_JEV_MS,
  type TransporteJev, type ResultadoOncoassistJev, type StatusOncoassistJev,
} from "../kernel/llm/jev/contrato.js";

export { CATEGORIAS_JEV, LIMITE_TEXTO_JEV } from "../kernel/llm/jev/contrato.js";
export type { CategoriaJev, TransporteJev, ResultadoOncoassistJev, StatusOncoassistJev } from "../kernel/llm/jev/contrato.js";

export interface ContextoServidorJev {
  /** Loaded by the server from its local source. Never copy from a request body. */
  dicionario: DicionarioPaciente;
}
export interface OpcoesOncoassistJev {
  env?: Readonly<Record<string, string | undefined>>;
  /** Dependency injection for offline tests, never a client-controlled transport. */
  transporte?: TransporteJev;
}
export interface OncoassistJev {
  status(): StatusOncoassistJev;
  avaliar(entrada: unknown, contextoServidor: ContextoServidorJev, signal?: AbortSignal): Promise<ResultadoOncoassistJev>;
}

const dicionarioSchema = z.object({
  nomes: z.array(z.string().trim().min(1)).min(1),
  identificadores: z.array(z.string().trim().min(1)),
}).strict();

/** OncoAssist creates a document-organization proposal, with no canonical writes. */
export function criarOncoassistJev(opcoes: OpcoesOncoassistJev = {}): OncoassistJev {
  const env = opcoes.env ?? process.env;
  const habilitado = env.ONCOASSIST_JEV_ENABLED === "true";
  const chave = env.TYPESAFE_API_KEY?.trim();
  let transporte = opcoes.transporte;
  const status = (): StatusOncoassistJev => !habilitado
    ? { status: "PENDENTE", motivo: "DESABILITADO" }
    : !chave ? { status: "PENDENTE", motivo: "CHAVE_AUSENTE" } : { status: "DISPONIVEL" };

  return {
    status,
    async avaliar(entrada, contextoServidor, signal) {
      const capacidade = status();
      if (capacidade.status === "PENDENTE") return { status: "PENDENTE", codigo: capacidade.motivo };
      const parsed = entradaJevSchema.safeParse(entrada);
      if (!parsed.success) return { status: "ERRO", codigo: "ENTRADA_INVALIDA" };
      const dic = dicionarioSchema.safeParse(contextoServidor?.dicionario);
      if (!dic.success) return { status: "PENDENTE", codigo: "DICIONARIO_AUSENTE" };
      if (signal?.aborted) return { status: "ERRO", codigo: "CANCELADO" };

      // Input source, map and original hash stay local; only redacted text leaves.
      const { fonte } = parsed.data;
      let texto: string;
      try {
        texto = desidentificar(fonte.texto, dic.data).texto;
        if (contemPhiResidual(texto, dic.data)) return { status: "ERRO", codigo: "PHI_RESIDUAL" };
      } catch {
        return { status: "ERRO", codigo: "PHI_RESIDUAL" };
      }
      const sha256 = createHash("sha256").update(fonte.texto, "utf8").digest("hex");
      const controller = new AbortController();
      let timeout = false;
      const cancelar = () => controller.abort();
      signal?.addEventListener("abort", cancelar, { once: true });
      const timer = setTimeout(() => { timeout = true; controller.abort(); }, TIMEOUT_JEV_MS);
      let aoAbortar: (() => void) | undefined;
      try {
        transporte ??= criarTransporteJev(chave!);
        // Bound even a broken injected transport that ignores cancellation.
        const interrupcao = new Promise<never>((_, reject) => {
          aoAbortar = () => reject(new Error("INTERROMPIDO"));
          controller.signal.addEventListener("abort", aoAbortar, { once: true });
        });
        const resposta = await Promise.race([transporte.avaliar(texto, controller.signal), interrupcao]);
        if (signal?.aborted) return { status: "ERRO", codigo: "CANCELADO" };
        const validada = respostaJevSchema.safeParse(resposta);
        if (!validada.success) return { status: "ERRO", codigo: "RESPOSTA_INVALIDA" };
        const respostaCategoria = validada.data.answers.categoria;
        return {
          status: "PROPOSTA", revisaoObrigatoria: true, fonte: { id: fonte.id, sha256 },
          categoria: respostaCategoria.choice, probabilidades: respostaCategoria.probabilities,
          confianca: respostaCategoria.confidence, modelo: validada.data.model,
        };
      } catch (erro) {
        return { status: "ERRO", codigo: signal?.aborted ? "CANCELADO"
          : timeout || erro instanceof TimeoutTransporteJev ? "TIMEOUT" : "PROVEDOR_INDISPONIVEL" };
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", cancelar);
        if (aoAbortar) controller.signal.removeEventListener("abort", aoAbortar);
      }
    },
  };
}
