import type { Sessao } from "../../contracts/base.js";
import type { ServidorDeps } from "../rotas.js";
import { extrairRascunho } from "./extracao/extrair.js";
import { listarFontesOncoassist } from "./extracao/fontes.js";
import { lerRascunho } from "./extracao/rascunho.js";
import { reconciliarRascunhos } from "./extracao/reconciliar.js";
import { revisarOuPrepararRascunho } from "./extracao/revisar.js";
import type { RespostaRota } from "./salaoCanal.js";

/** Despacho das rotas de extração e revisão; cada caso de uso vive em rotas/extracao/. */
export function rotearExtracaoERevisao(
  deps: ServidorDeps,
  token: string,
  sessao: Sessao,
  rota: string,
  raw: unknown,
): RespostaRota | null {
  if (rota === "reconciliarRascunhos") return reconciliarRascunhos(deps, token, sessao, raw);
  if (rota === "oncoassistFontes") return listarFontesOncoassist(deps, token, sessao, raw);
  if (rota === "extrair") return extrairRascunho(deps, token, sessao, raw);
  if (rota === "rascunho") return lerRascunho(deps, token, sessao, raw);
  if (rota === "revisarRascunho" || rota === "prepararRevisao") return revisarOuPrepararRascunho(deps, token, sessao, rota, raw);
  return null;
}
