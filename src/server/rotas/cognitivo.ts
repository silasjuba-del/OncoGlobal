import type { IncomingMessage, ServerResponse } from "node:http";
import { lerResultadoExtracaoLlm } from "../extracaoLlm.js";
import { listarRascunhosPubMed, operarLeituraPubMed } from "../leituraPubMed.js";
import type { ServidorDeps } from "../rotas.js";
import { operarSkillsClinicas } from "../skillsClinicas.js";
import type { RespostaRota } from "./salaoCanal.js";

function codigoDe(body: unknown, padrao: string): string {
  return body && typeof body === "object" && "codigo" in body && typeof body.codigo === "string" ? body.codigo : padrao;
}

/** Rotas do OncoAssist cognitivo: skills, relatório de extração e leitura bibliográfica PubMed. */
export async function rotearCognitivo(
  deps: ServidorDeps,
  token: string,
  rota: string,
  raw: unknown,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<RespostaRota | null> {
  if (rota === "skillsClinicas") {
    const result = operarSkillsClinicas(raw, token, deps);
    return { status: result.status, codigo: codigoDe(result.body, "SKILL_INDISPONIVEL"), body: result.body };
  }
  if (rota === "resultadoExtracaoLlm") {
    const result = lerResultadoExtracaoLlm(raw, token, deps);
    return { status: result.status, codigo: String(result.body.codigo), body: result.body };
  }
  if (rota === "leituraPubMed") {
    const result = await operarLeituraPubMed(deps, token, raw, req, res);
    return { status: result.status, codigo: codigoDe(result.body, "READ_INDISPONIVEL"), body: result.body };
  }
  if (rota === "listarRascunhosPubMed") {
    const result = listarRascunhosPubMed(deps, token, raw);
    return { status: result.status, codigo: codigoDe(result.body, "RASCUNHOS_PUBMED_INDISPONIVEIS"), body: result.body };
  }
  return null;
}
