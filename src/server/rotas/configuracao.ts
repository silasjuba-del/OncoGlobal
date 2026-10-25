import { z } from "zod";
import type { Sessao } from "../../contracts/base.js";
import type { ServidorDeps } from "../rotas.js";
import type { RespostaRota } from "./salaoCanal.js";

const ROTAS_CONFIGURACAO = new Set(["lerPerfil", "salvarPerfil", "lerCaixa", "alterarCaixa", "historicoConfig"]);

/** Configuração do serviço (perfil e caixas globais). Separada do roteador de prescrição; sem efeito clínico. */
export function rotearConfiguracao(deps: ServidorDeps, sessao: Sessao, rota: string, raw: unknown): RespostaRota | null {
  if (!ROTAS_CONFIGURACAO.has(rota)) return null;
  const reply = (status: number, codigo: string, body: unknown = { codigo }): RespostaRota => ({ status, codigo, body });
  if (!deps.settings) return reply(503, "CONFIGURACAO_INDISPONIVEL");
  if (rota === "lerPerfil") {
    if (!z.object({}).strict().safeParse(raw).success) return reply(400, "PAYLOAD_INVALIDO");
    return reply(200, "PERFIL_CARREGADO", deps.settings.readProfile(sessao));
  }
  if (rota === "salvarPerfil") {
    const parsed = z.object({
      operationId: z.string().min(8), expectedRevision: z.number().int().nonnegative(),
      perfil: z.unknown(), motivo: z.string().max(1000).nullable().optional(),
    }).strict().safeParse(raw);
    if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
    const result = deps.settings.saveProfile({ ...parsed.data, motivo: parsed.data.motivo ?? null }, sessao);
    return reply(result.estado === "CONFLITO" || result.estado === "NEGADA" ? 409 : 200, result.estado, result);
  }
  if (rota === "lerCaixa") {
    const parsed = z.object({ numero: z.number().int().positive() }).strict().safeParse(raw);
    if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
    const catalog = deps.corpus?.caixasTodas.find((box) => box.numero === parsed.data.numero);
    if (!catalog) return reply(404, "CAIXA_DESCONHECIDA");
    if (catalog.chave.startsWith("apac.")) return reply(409, "CONTEXTO_PACIENTE_OBRIGATORIO");
    if (!catalog.chave.startsWith("config.")) return reply(409, "CAIXA_FORA_DA_CONFIGURACAO_GLOBAL");
    return reply(200, "CAIXA_CARREGADA", deps.settings.readBox(parsed.data.numero, sessao));
  }
  if (rota === "alterarCaixa") {
    const parsed = z.object({
      autorizacaoMedica:z.boolean().optional(),
      numero: z.number().int().positive(), valorNovo: z.unknown(),
      expectedRevision: z.number().int().nonnegative(), operationId: z.string().min(8),
      motivo: z.string().max(1000).nullable().optional(),
    }).strict().safeParse(raw);
    if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
    const catalog = deps.corpus?.caixasTodas.find((box) => box.numero === parsed.data.numero);
    if (!catalog) return reply(404, "CAIXA_DESCONHECIDA");
    if (catalog.chave.startsWith("apac.")) return reply(409, "CONTEXTO_PACIENTE_OBRIGATORIO");
    if (!catalog.chave.startsWith("config.")) return reply(409, "CAIXA_FORA_DA_CONFIGURACAO_GLOBAL");
    if(catalog.tipo==='REGRA_CLINICA'&&parsed.data.autorizacaoMedica!==true)return reply(409,'AUTORIZACAO_MEDICA_EXPLICITA_OBRIGATORIA');
    const result = deps.settings.changeBox({
      ...parsed.data, motivo: parsed.data.motivo ?? null,
      autorizacaoMedica: catalog.tipo==='REGRA_CLINICA'?parsed.data.autorizacaoMedica===true:true,
    }, sessao);
    return reply(result.estado === "CONFLITO" || result.estado === "NEGADA" ? 409 : 200, result.estado, result);
  }
  if (!z.object({}).strict().safeParse(raw).success) return reply(400, "PAYLOAD_INVALIDO");
  return reply(200, "HISTORICO_CARREGADO", { itens: deps.settings.readHistory(sessao) });
}
