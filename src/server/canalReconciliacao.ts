// S-F2-02 · Serviço local de vínculo, desidentificação pré-LLM, classificação e reconciliação clínica do canal.
// Mantém relato do paciente separado de fato confirmado pelo médico (revisao: "REVISAR").
// Não remove o bloqueio de envio externo (CANAL_EXTERNO_NAO_HABILITADO preservado em S-F2-02).
import type { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { ReconciliacaoClinicaCanal, type PropostaClassificacaoLlmBruta } from "../contracts/f2/reconciliacaoCanal.js";
import { g02PhiEgress } from "../kernel/harness/gates.js";
import { desidentificar, type DicionarioPaciente } from "../kernel/llm/desidentificar.js";
import { transacao } from "../kernel/ledger/db.js";
import { lerCanalRedflags } from "../rules/canalRedflags.js";
import { tipoIdentificadorDoCanal } from "../modules/canal/ingresso.js";
import {
  avaliarAlarmesCanalConferidos,
  classificarRelatoCanal,
  detectarConflitosRelatoCanal,
  extrairMencoesClinicasCanal,
  resolverVinculoReconciliadoCanal,
  type ContatoExistenteStatus,
  type RulesetAlarmeCanalEntrada,
} from "../modules/canal/reconciliacaoClinica.js";
import type { CadastroVinculo } from "../modules/canal/vinculo.js";
import {
  consultarCaixaCanal,
  detalheMensagemCanal,
  lerMensagemIngressoLocal,
  listarPendenciasCanal,
  garantirSchema,
  type AcessoCanal,
  type FalhaArmazenamento,
  type ItemCaixa,
} from "./canalEntrada.js";

export type ClassificadorCanalLlm = (entrada: {
  textoDesidentificado: string;
  origemCanal: "WHATSAPP_SERVICO" | "EMAIL";
}) => Promise<PropostaClassificacaoLlmBruta | unknown> | PropostaClassificacaoLlmBruta | unknown;

let rulesetPadraoCache: RulesetAlarmeCanalEntrada | null = null;

function carregarCorpusCtcae(): unknown {
  try { return JSON.parse(readFileSync(new URL("../../corpus/rulesets/salao-ctcae.v1.json", import.meta.url), "utf8")); }
  catch { return null; }
}

export function carregarRulesetAlarmeCanalPadrao(): RulesetAlarmeCanalEntrada | null {
  if (rulesetPadraoCache) return rulesetPadraoCache;
  try {
    const raw = JSON.parse(
      readFileSync(new URL("../../corpus/rulesets/canal-redflags.v1.json", import.meta.url), "utf8"),
    ) as Record<string, unknown>;
    const lido = lerCanalRedflags(raw);
    const sinaisBrutos = Array.isArray(raw.sinais) ? raw.sinais as Array<Record<string, unknown>> : [];
    rulesetPadraoCache = {
      rulesetId: lido.rulesetId,
      rulesetVersao: lido.rulesetVersao,
      fraseFinal: lido.fraseFinal,
      sinais: lido.sinais.map((s, idx) => ({
        ...s,
        fonte: typeof sinaisBrutos[idx]?.fonte === "string" ? String(sinaisBrutos[idx]!.fonte) : "[VERIFICAR]",
      })),
    };
    return rulesetPadraoCache;
  } catch {
    return null;
  }
}

function garantirTabelaReconciliacao(db: DatabaseSync): void {
  garantirSchema(db);
  db.exec(`
    CREATE TABLE IF NOT EXISTS canal_reconciliacao_clinica (
      mensagemId TEXT PRIMARY KEY REFERENCES canal_mensagem(mensagemId),
      reconciliacaoJson TEXT NOT NULL,
      avaliadoEm TEXT NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS canal_reconciliacao_no_update BEFORE UPDATE ON canal_reconciliacao_clinica
      BEGIN SELECT RAISE(ABORT, 'canal_reconciliacao_clinica append-only'); END;
    CREATE TRIGGER IF NOT EXISTS canal_reconciliacao_no_delete BEFORE DELETE ON canal_reconciliacao_clinica
      BEGIN SELECT RAISE(ABORT, 'canal_reconciliacao_clinica append-only'); END;
  `);
}

function montarDicionarioDesidentificacao(
  cadastros: readonly CadastroVinculo[],
  senderRef: string,
  nomesExtras: readonly string[] = [],
): DicionarioPaciente {
  const nomes = new Set<string>(nomesExtras.filter((n) => n.trim().length > 0));
  const identificadores = new Set<string>([senderRef]);
  for (const c of cadastros) {
    if (c.nome && c.nome.trim()) nomes.add(c.nome.trim());
    for (const id of c.identificadores) {
      if (id.valor.trim()) identificadores.add(id.valor.trim());
    }
  }
  return {
    nomes: [...nomes],
    identificadores: [...identificadores],
  };
}

/**
 * Processa e reconcilia uma mensagem persistida no canal (S-F2-02).
 * - Se usar classificador LLM, desidentifica antes (FN-24) e passa por G-02 (g02PhiEgress).
 * - Preserva negação, dúvida, temporalidade, autor, origem e conflitos.
 * - Só ativa alarmes de regras CONFERIDA_MEDICO/APROVADO (regras em RASCUNHO permanecem inativas).
 * - Nunca cria evento em clinical_event nem promove a fato confirmado.
 */
export async function reconciliarMensagemCanalPersistida(
  db: DatabaseSync, acesso: AcessoCanal, opcoes: Parameters<typeof reconciliarItemCanalPersistido>[3],
) {
  const detalhe = detalheMensagemCanal(db, acesso, opcoes.mensagemId);
  if (!detalhe.ok) return detalhe;
  return reconciliarItemCanalPersistido(db, acesso.agora, detalhe.mensagem, opcoes);
}

/** Retomada técnica durável, sem sessão fabricada, LLM, confirmação clínica ou efeitos externos. */
export async function processarPendenciasClinicasCanal(db: DatabaseSync, opcoes: {
  agora: string; cadastros: readonly CadastroVinculo[] | (() => readonly CadastroVinculo[]);
}) {
  const pendencias = listarPendenciasCanal(db).filter(p => p.estado === "PENDENTE_PROCESSAMENTO");
  if (!pendencias.length) return;
  const cadastros = typeof opcoes.cadastros === "function" ? opcoes.cadastros() : opcoes.cadastros;
  for (const pendencia of pendencias) {
    const detalhe = lerMensagemIngressoLocal(db, pendencia.mensagemId);
    if (!detalhe.ok) throw new Error("PROCESSAMENTO_CANAL_PENDENTE");
    const r = await reconciliarItemCanalPersistido(db, opcoes.agora, detalhe.mensagem,
      { mensagemId: pendencia.mensagemId, cadastros });
    if (!r.ok) throw new Error("PROCESSAMENTO_CANAL_PENDENTE");
  }
}

async function reconciliarItemCanalPersistido(
  db: DatabaseSync,
  agora: string,
  mensagem: ItemCaixa,
  opcoes: {
    mensagemId: string;
    cadastros: readonly CadastroVinculo[];
    nomeDeclaradoNoRemetente?: string | null;
    chaveDemografica?: string | null;
    statusContatoExistente?: ContatoExistenteStatus | null;
    dicionarioExtras?: { nomes?: readonly string[]; identificadores?: readonly string[] };
    classificadorLlm?: ClassificadorCanalLlm;
    rulesetAlarmes?: RulesetAlarmeCanalEntrada | null;
  },
): Promise<
  | { ok: false; codigo: "SESSAO_INVALIDA" | "MENSAGEM_AUSENTE" | "PHI_EGRESS_BLOQUEADO" | "VINCULO_EMAIL_REQUER_REVISAO" | "RECONCILIACAO_REQUER_REPROCESSAMENTO" }
  | FalhaArmazenamento
  | { ok: true; reconciliacao: ReconciliacaoClinicaCanal; replay: boolean }
> {
  try {
    garantirTabelaReconciliacao(db);
    const jaExistente = db.prepare(
      "SELECT reconciliacaoJson FROM canal_reconciliacao_clinica WHERE mensagemId = ?",
    ).get(opcoes.mensagemId) as { reconciliacaoJson: string } | undefined;
    if (jaExistente) {
      const reconciliacao = ReconciliacaoClinicaCanal.parse(JSON.parse(jaExistente.reconciliacaoJson));
      if (mensagem.vinculo.motivo === "REMETENTE_EMAIL_NAO_AUTENTICADO_REQUER_REVISAO"
        && reconciliacao.vinculo.patientId !== null) {
        return { ok: false, codigo: "VINCULO_EMAIL_REQUER_REVISAO" };
      }
      if (!reconciliacao.classificacao.leituraComplementar) {
        return { ok: false, codigo: "RECONCILIACAO_REQUER_REPROCESSAMENTO" };
      }
      return {
        ok: true,
        reconciliacao,
        replay: true,
      };
    }
  } catch {
    return { ok: false, codigo: "ARMAZENAMENTO_INDISPONIVEL", recuperavel: true, persistida: false };
  }

  const msg: ItemCaixa = mensagem;
  const remetenteImapNaoValidado = msg.vinculo.motivo === "REMETENTE_EMAIL_NAO_AUTENTICADO_REQUER_REVISAO";
  const vinculo = resolverVinculoReconciliadoCanal({
    endereco: msg.senderRef,
    tipo: tipoIdentificadorDoCanal(msg.canal),
    nomeDeclaradoNoRemetente: opcoes.nomeDeclaradoNoRemetente ?? null,
    chaveDemografica: opcoes.chaveDemografica ?? null,
    cadastros: remetenteImapNaoValidado ? [] : opcoes.cadastros,
    // Um vínculo prévio do endereço não autentica esta mensagem recebida por IMAP.
    statusContatoExistente: remetenteImapNaoValidado && opcoes.statusContatoExistente
      ? { ...opcoes.statusContatoExistente, patientIdVinculadoManual: null }
      : opcoes.statusContatoExistente ?? null,
  });

  const ehMidia = msg.conteudo.tipo === "MEDIA_UNPROCESSED";
  const textoOriginal = msg.conteudo.tipo === "TEXT" ? msg.conteudo.texto : "";

  let propostaLlm: {
    textoDesidentificadoEnviado: string;
    phiEgressPassou: boolean;
    saidaBrutaLlm: unknown;
  } | null = null;

  if (opcoes.classificadorLlm && !ehMidia && vinculo.estado === "VINCULADO"
    && opcoes.cadastros.some((c) => c.patientId === vinculo.patientId && c.nome?.trim())) {
    const dicBase = montarDicionarioDesidentificacao(
      opcoes.cadastros,
      msg.senderRef,
      [
        ...(opcoes.nomeDeclaradoNoRemetente ? [opcoes.nomeDeclaradoNoRemetente] : []),
        ...(opcoes.dicionarioExtras?.nomes ?? []),
      ],
    );
    const dic: DicionarioPaciente = {
      nomes: dicBase.nomes,
      identificadores: [...new Set([...dicBase.identificadores, ...(opcoes.dicionarioExtras?.identificadores ?? [])])],
    };
    // Lista de nomes não cobre terceiros citados em texto livre. Só sai uma projeção
    // de vocabulário fechado extraída localmente, sem trechos, nomes ou identificadores.
    const projecaoMinima = JSON.stringify({ mencoes: extrairMencoesClinicasCanal(textoOriginal).map(
      ({ termo, polaridade, temporalidade, temperaturaDecimos }) => ({ termo, polaridade, temporalidade, temperaturaDecimos }),
    ) });
    const desid = desidentificar(projecaoMinima, dic);
    const gate = g02PhiEgress(desid.texto, dic);
    if (gate.decisao !== "PASSA") {
      return { ok: false, codigo: "PHI_EGRESS_BLOQUEADO" };
    }
    try {
      const saidaBrutaLlm = await opcoes.classificadorLlm({
        textoDesidentificado: desid.texto,
        origemCanal: msg.canal,
      });
      propostaLlm = {
        textoDesidentificadoEnviado: desid.texto,
        phiEgressPassou: true,
        saidaBrutaLlm,
      };
    } catch {
      propostaLlm = null;
    }
  }

  const classificacao = classificarRelatoCanal({
    textoOriginal,
    corpusCtcae: carregarCorpusCtcae(),
    ehMidia,
    origemCanal: msg.canal,
    providerSentAt: msg.providerSentAt,
    ingestedAt: msg.ingestedAt,
    ...(opcoes.statusContatoExistente?.relacao ? { relacaoCadastrada: opcoes.statusContatoExistente.relacao } : {}),
    vinculado: vinculo.estado === "VINCULADO",
    propostaLlm,
  });

  const ruleset = opcoes.rulesetAlarmes === undefined
    ? carregarRulesetAlarmeCanalPadrao()
    : opcoes.rulesetAlarmes;

  const alarmes = avaliarAlarmesCanalConferidos({
    textoOriginal,
    mencoes: classificacao.mencoes,
    patientIdVinculado: vinculo.patientId,
    autorRelato: classificacao.autorRelato,
    ruleset,
  });

  // Busca reconciliações anteriores filtradas diretamente no SQLite por senderRef ou patientId (sem depender de LIMITE_CAIXA global)
  const rowsAnteriores = (vinculo.patientId !== null
    ? db.prepare(`
        SELECT r.mensagemId, r.reconciliacaoJson
        FROM canal_reconciliacao_clinica r
        JOIN canal_mensagem m ON m.mensagemId = r.mensagemId
        WHERE r.mensagemId <> ? AND m.provaMetodo <> 'IMAP_CONTA_LOCAL' AND (m.senderRef = ? OR CASE WHEN json_valid(r.reconciliacaoJson) THEN json_extract(r.reconciliacaoJson, '$.vinculo.patientId') END = ?)
        ORDER BY m.ingestedAt, r.mensagemId
      `).all(msg.mensagemId, msg.senderRef, vinculo.patientId)
    : db.prepare(`
        SELECT r.mensagemId, r.reconciliacaoJson
        FROM canal_reconciliacao_clinica r
        JOIN canal_mensagem m ON m.mensagemId = r.mensagemId
        WHERE r.mensagemId <> ? AND m.senderRef = ?
        ORDER BY m.ingestedAt, r.mensagemId
      `).all(msg.mensagemId, msg.senderRef)) as Array<{ mensagemId: string; reconciliacaoJson: string }>;

  const anteriores: Array<{ mensagemId: string; mencoes: ReconciliacaoClinicaCanal["classificacao"]["mencoes"] }> = [];
  for (const row of rowsAnteriores) {
    // E-mail autentica a caixa, não o autor/sujeito de cada mensagem. Não formar
    // conflito clínico entre mensagens pelo endereço enquanto não existir essa prova.
    if (msg.canal === "EMAIL" || vinculo.patientId === null) continue;
    const parsed = ReconciliacaoClinicaCanal.safeParse(JSON.parse(row.reconciliacaoJson));
    if (parsed.success && parsed.data.vinculo.estado === "VINCULADO" && parsed.data.vinculo.patientId === vinculo.patientId && parsed.data.classificacao.leituraComplementar?.versao === "F2-LEITURA-2") {
      anteriores.push({ mensagemId: row.mensagemId, mencoes: parsed.data.classificacao.mencoes });
    }
  }

  const conflitosRelato = detectarConflitosRelatoCanal(
    { mensagemId: msg.mensagemId, mencoes: classificacao.mencoes },
    anteriores,
  );

  const reconciliacao = ReconciliacaoClinicaCanal.parse({
    schema: "ReconciliacaoClinicaCanal@1",
    mensagemId: msg.mensagemId,
    accountId: msg.accountId,
    senderRef: msg.senderRef,
    vinculo,
    classificacao,
    alarmes,
    conflitosRelato,
    naturezaEvidencia: "RELATO_CANAL_NAO_CONFIRMADO",
    revisao: "REVISAR",
    diagnostico: false,
    prescricao: false,
    assinatura: false,
    avaliadoEm: agora,
  });

  try {
    return transacao(db, () => {
      garantirTabelaReconciliacao(db);
      const insercao = db.prepare(`
        INSERT INTO canal_reconciliacao_clinica (mensagemId, reconciliacaoJson, avaliadoEm)
        VALUES (?, ?, ?)
        ON CONFLICT(mensagemId) DO NOTHING
      `).run(msg.mensagemId, JSON.stringify(reconciliacao), agora);

      if(insercao.changes===0){
        const vencedora=lerReconciliacaoMensagemCanal(db,msg.mensagemId);
        return vencedora?{ok:true as const,reconciliacao:vencedora,replay:true}
          :{ok:false as const,codigo:'RECONCILIACAO_REQUER_REPROCESSAMENTO' as const};
      }
      db.prepare(`
        INSERT INTO canal_pendencia_resolucao (mensagemId, resolvidoEm, resultadoJson)
        VALUES (?, ?, ?)
        ON CONFLICT(mensagemId) DO NOTHING
      `).run(msg.mensagemId, agora, JSON.stringify({
        reciboTecnico: "PROCESSADA",
        vinculoEstado: vinculo.estado,
        categoria: classificacao.categoria,
        estadoRegras: alarmes.estadoRegras,
      }));

      return { ok: true as const, reconciliacao, replay: false };
    });
  } catch {
    return { ok: false, codigo: "ARMAZENAMENTO_INDISPONIVEL", recuperavel: true, persistida: false };
  }
}

export function lerReconciliacaoMensagemCanal(
  db: DatabaseSync,
  mensagemId: string,
): ReconciliacaoClinicaCanal | null {
  garantirTabelaReconciliacao(db);
  const row = db.prepare(
    "SELECT reconciliacaoJson FROM canal_reconciliacao_clinica WHERE mensagemId = ?",
  ).get(mensagemId) as { reconciliacaoJson: string } | undefined;
  if (!row) return null;
  const reconciliacao = ReconciliacaoClinicaCanal.parse(JSON.parse(row.reconciliacaoJson));
  const origem = db.prepare("SELECT provaMetodo FROM canal_mensagem WHERE mensagemId = ?").get(mensagemId);
  if (origem?.provaMetodo === "IMAP_CONTA_LOCAL" && reconciliacao.vinculo.patientId !== null) return null;
  if (!reconciliacao.classificacao.leituraComplementar) return null;
  return reconciliacao;
}
