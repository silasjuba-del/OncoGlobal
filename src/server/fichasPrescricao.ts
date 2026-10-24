import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { Sessao } from "../contracts/base.js";
import { ProtocolTemplate } from "../contracts/w10/prescricao.js";
import { CatalogoFichasRespostaSchema, FichaProtocoloCatalogoSchema, RevisaoFichaProtocoloSchema,
  RevisarFichaPedidoSchema, type FichaProtocoloCatalogo } from "../contracts/api/fichasPrescricao.js";
import { auditar, lerDraft, salvarDraft, transacao } from "../kernel/comandos/portas.js";
import { hashConteudoExibido as hash, type GerenciadorSessao } from "./sessao.js";

export interface DepsFichas {
  db: DatabaseSync; sessoes: GerenciadorSessao; agora: () => string;
  corpus?: { templatesProtocolo: ProtocolTemplate[] } | null;
}
export interface RespostaFicha { status: number; body: unknown }
export const recusarFicha = (codigo: string, status = 409): RespostaFicha => ({ status, body: { codigo } });
const Registro = z.object({
  kind: z.literal("FICHA_PROTOCOLO_REVISOES"), templateId: z.string(), versao: z.string(),
  auditoriaDesde: z.number().int().positive().optional(),
  historico: z.array(z.object({ operationId: z.string(), requestHash: z.string(),
    template: ProtocolTemplate, revisao: RevisaoFichaProtocoloSchema }).strict()),
}).strict();
type RegistroFicha = z.infer<typeof Registro>;
const idRegistro = (id: string, versao: string) => `ficha-revisao:${hash([id, versao])}`;
const chave = (t: ProtocolTemplate) => JSON.stringify([t.templateId, t.versao]);
const hashRevisao = (revisao: Omit<z.infer<typeof RevisaoFichaProtocoloSchema>, "reviewHash">, anterior: string | null) =>
  hash({ revisao, anterior });

export function autenticarFichas(deps: DepsFichas, token: string) {
  const sessao = Sessao.safeParse(deps.sessoes.obter(token)), em = deps.agora();
  return sessao.success && Number.isFinite(Date.parse(em)) && Date.parse(sessao.data.emitidaEm) <= Date.parse(em)
    && Date.parse(sessao.data.expiraEm) > Date.parse(em) ? { sessao: sessao.data, em } : null;
}
function lerRegistro(deps: DepsFichas, templateId: string, versao: string): RegistroFicha {
  const draft = lerDraft(deps.db, idRegistro(templateId, versao));
  if (!draft) return { kind: "FICHA_PROTOCOLO_REVISOES", templateId, versao, historico: [] };
  const p = Registro.safeParse(draft.payload);
  if (!p.success || draft.patientId !== null || p.data.templateId !== templateId || p.data.versao !== versao
    || draft.revision !== p.data.historico.length) throw new Error("REVISAO_FICHA_CORROMPIDA");
  let anterior: string | null = null;
  const chaves = new Set<string>();
  for (const [i, item] of p.data.historico.entries()) {
    const { reviewHash, ...r } = item.revisao;
    if (r.templateId !== templateId || r.versao !== versao || r.revision !== i + 1
      || item.template.templateId !== templateId || item.template.versao !== versao
      || r.contentHash !== hash(item.template) || reviewHash !== hashRevisao(r, anterior) || chaves.has(item.operationId))
      throw new Error("REVISAO_FICHA_CORROMPIDA");
    if(p.data.auditoriaDesde!==undefined&&r.revision>=p.data.auditoriaDesde
      &&!deps.db.prepare("SELECT 1 FROM audit_event WHERE acaoPedida=? AND politicaVersao=? AND em=? AND json_extract(ator,'$.id')=?")
        .get(`REVISAR_FICHA:${reviewHash}`,"FICHA_PROTOCOLO_REVISOES@1",r.em,r.medicoId))throw new Error("REVISAO_FICHA_SEM_AUDITORIA");
    chaves.add(item.operationId); anterior = reviewHash;
  }
  return p.data;
}

/** O original nunca é reescrito nem ganha status de aprovação por rótulo do arquivo. */
export function catalogoFichas(deps: DepsFichas): FichaProtocoloCatalogo[] {
  const grupos = new Map<string, ProtocolTemplate[]>();
  for (const raw of deps.corpus?.templatesProtocolo ?? []) {
    const template = ProtocolTemplate.parse(raw), key = chave(template);
    const grupo = grupos.get(key) ?? []; grupo.push(template); grupos.set(key, grupo);
  }
  return [...grupos.values()].map(grupo => {
    const template = [...grupo].sort((a, b) => hash(a).localeCompare(hash(b)))[0]!, contentHash = hash(template);
    const registro = lerRegistro(deps, template.templateId, template.versao);
    const ultima = registro.historico.at(-1)?.revisao ?? null;
    const revisao = ultima?.contentHash === contentHash ? ultima : null;
    const bloqueios: string[] = [];
    if (grupo.length !== 1) bloqueios.push("FICHA_IDENTIDADE_DUPLICADA");
    if (new Set(template.itens.map(i => i.sequence)).size !== template.itens.length) bloqueios.push("SEQUENCIA_DE_ITENS_DUPLICADA");
    return FichaProtocoloCatalogoSchema.parse({ template, contentHash, revision: registro.historico.length, revisao,
      estado: revisao?.decisao === "CONFERIR" ? "CONFERIDA" : revisao?.decisao === "INATIVAR" ? "INATIVA" : "PENDENTE", bloqueios });
  }).sort((a, b) => a.template.nome.localeCompare(b.template.nome, "pt-BR") || chave(a.template).localeCompare(chave(b.template)));
}
export function fichaAtual(deps: DepsFichas, templateId: string, versao: string,
  expectedContentHash: string, expectedRevision: number, exigirConferida = false): FichaProtocoloCatalogo {
  const ficha = catalogoFichas(deps).find(f => f.template.templateId === templateId && f.template.versao === versao);
  if (!ficha) throw new Error("FICHA_NAO_ENCONTRADA");
  if (ficha.bloqueios.length) throw new Error(ficha.bloqueios[0]!);
  if (ficha.contentHash !== expectedContentHash) throw new Error("FICHA_CONTEUDO_ALTERADO");
  if (ficha.revision !== expectedRevision) throw new Error("FICHA_REVISAO_ALTERADA");
  if (exigirConferida && ficha.estado !== "CONFERIDA") throw new Error("FICHA_NAO_CONFERIDA");
  return ficha;
}
export function erroFicha(error: unknown): RespostaFicha {
  return recusarFicha(error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "FICHA_OPERACAO_RECUSADA");
}
export function operarFichasPrescricao(deps: DepsFichas, token: string, operacao: "listar" | "revisar", raw: unknown): RespostaFicha {
  const auth = autenticarFichas(deps, token);
  if (!auth) return recusarFicha("SESSAO_INVALIDA", 401);
  try {
    if (operacao === "listar") {
      if (!z.object({}).strict().safeParse(raw).success) return recusarFicha("PAYLOAD_INVALIDO", 400);
      return { status: 200, body: CatalogoFichasRespostaSchema.parse({ fichas: catalogoFichas(deps) }) };
    }
    const p = RevisarFichaPedidoSchema.safeParse(raw);
    if (!p.success) return recusarFicha("PAYLOAD_INVALIDO", 400);
    return transacao(deps.db, () => {
      const entrada = p.data, registro = lerRegistro(deps, entrada.templateId, entrada.versao);
      const requestHash = hash({ entrada, medicoId: auth.sessao.medicoId });
      const anterior = registro.historico.find(h => h.operationId === entrada.idempotencyKey);
      if (anterior) {
        if (anterior.requestHash !== requestHash) return recusarFicha("IDEMPOTENCIA_CONFLITO");
        // Retry não retrocede uma inativação ou revisão posterior.
        const atual = catalogoFichas(deps).find(f => f.template.templateId === entrada.templateId && f.template.versao === entrada.versao);
        if (!atual || atual.contentHash !== entrada.expectedContentHash) return recusarFicha("FICHA_CONTEUDO_ALTERADO");
        if (atual.revision !== anterior.revisao.revision) return recusarFicha("FICHA_REVISAO_ALTERADA");
        return { status: 200, body: atual };
      }
      const ficha = fichaAtual(deps, entrada.templateId, entrada.versao, entrada.expectedContentHash, entrada.expectedRevision);
      const conteudo = { templateId: entrada.templateId, versao: entrada.versao, revision: ficha.revision + 1,
        decisao: entrada.decisao, motivo: entrada.motivo, medicoId: auth.sessao.medicoId, em: auth.em, contentHash: ficha.contentHash };
      const revisao = RevisaoFichaProtocoloSchema.parse({ ...conteudo,
        reviewHash: hashRevisao(conteudo, registro.historico.at(-1)?.revisao.reviewHash ?? null) });
      const historico = [...registro.historico, { operationId: entrada.idempotencyKey, requestHash, template: ficha.template, revisao }];
      salvarDraft(deps.db, { draftId: idRegistro(entrada.templateId, entrada.versao), patientId: null,
        sourceId: `ficha-fonte:${ficha.contentHash}`, rawRef: "referencia-local", revision: historico.length,
        criadoEm: auth.em, diagnostics: [], payload: { ...registro, auditoriaDesde:registro.auditoriaDesde??historico.length, historico } });
      auditar(deps.db,{ator:{tipo:"SESSAO",id:auth.sessao.medicoId},acaoPedida:`REVISAR_FICHA:${revisao.reviewHash}`,
        decisao:"PERMITIDA",motivoCodigo:entrada.decisao,politicaVersao:"FICHA_PROTOCOLO_REVISOES@1",em:auth.em});
      return { status: 200, body: FichaProtocoloCatalogoSchema.parse({ ...ficha, revision: revisao.revision, revisao,
        estado: revisao.decisao === "CONFERIR" ? "CONFERIDA" : "INATIVA" }) };
    });
  } catch (error) { return erroFicha(error); }
}
