import { z } from "zod";

export const CATEGORIAS_JEV = ["LAB", "RADS", "PATH", "NOTA", "OUTRO", "INDETERMINADO"] as const;
export type CategoriaJev = (typeof CATEGORIAS_JEV)[number];
export const LIMITE_TEXTO_JEV = 32_000;
export const TIMEOUT_JEV_MS = 10_000;

export const entradaJevSchema = z.object({
  fonte: z.object({
    id: z.string().min(1).max(240).refine((s) => s.trim().length > 0),
    texto: z.string().min(1).max(LIMITE_TEXTO_JEV).refine((s) => s.trim().length > 0),
  }).strict(),
}).strict();

const probabilidade = z.number().finite().min(0).max(1);
const distribuicao = z.object({
  LAB: probabilidade, RADS: probabilidade, PATH: probabilidade,
  NOTA: probabilidade, OUTRO: probabilidade, INDETERMINADO: probabilidade,
}).strict();

/** Validate the provider at runtime; SDK TypeScript declarations are not evidence. */
export const respostaJevSchema = z.object({
  model: z.string().regex(/^jev-(?:latest|\d+\.\d+(?:\.\d+)?)$/),
  answers: z.object({
    categoria: z.object({
      type: z.literal("choice"), choice: z.enum(CATEGORIAS_JEV),
      confidence: probabilidade, probabilities: distribuicao,
    }).strict().refine((r) => {
      const valores = Object.values(r.probabilities);
      return Math.abs(valores.reduce((a, b) => a + b, 0) - 1) <= 0.000001
        && r.probabilities[r.choice] >= Math.max(...valores) - 0.000001;
    }),
  }).strict(),
  usage: z.object({
    input_tokens: z.number().int().nonnegative().safe(),
    output_tokens: z.number().int().nonnegative().safe(),
  }).strict(),
}).strict();

export interface TransporteJev {
  avaliar(textoDesidentificado: string, signal: AbortSignal): Promise<unknown>;
}

export type CodigoJev = "DESABILITADO" | "CHAVE_AUSENTE" | "DICIONARIO_AUSENTE"
  | "ENTRADA_INVALIDA" | "PHI_RESIDUAL" | "RESPOSTA_INVALIDA" | "PROVEDOR_INDISPONIVEL"
  | "TIMEOUT" | "CANCELADO";

export type ResultadoOncoassistJev = {
  status: "PROPOSTA";
  revisaoObrigatoria: true;
  fonte: { id: string; sha256: string };
  categoria: CategoriaJev;
  probabilidades: Record<CategoriaJev, number>;
  confianca: number;
  modelo: string;
} | { status: "PENDENTE" | "ERRO"; codigo: CodigoJev };

export type StatusOncoassistJev = { status: "DISPONIVEL" }
  | { status: "PENDENTE"; motivo: "DESABILITADO" | "CHAVE_AUSENTE" };
