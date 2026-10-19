// S-F2-03 · Caixa clínica, integração com pré-consulta/cabeçalho, leitura local de mídia
// e autorização específica no servidor para resposta pelo Action Gateway.
import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { z } from "zod";
import { Instante, Sessao } from "../contracts/base.js";
import { Contato, Paciente } from "../contracts/clinico.js";
import { ActionIntent } from "../contracts/operacao.js";
import {
  AutorizacaoRespostaCanalServidor,
  RascunhoRespostaCanal,
  type ContextoRespostaCanal,
  type EstadoOperacionalMensagemCanal,
  type ResumoContatoIntegradoPreConsulta,
  type TipoRespostaCanal,
} from "../contracts/f2/caixaRespostaCanal.js";
import type { EstadoReciboCanal, EstadoVinculoContatoEntrada } from "../contracts/f2/canalEntrada.js";
import { criarGateway, type EvidenciaSaidaExterna, type ResultadoGateway } from "../kernel/gateway/gateway.js";
import { sqliteIdempotencia } from "../kernel/ledger/idempotencia.js";
import { auditar, listarEventos } from "../kernel/comandos/portas.js";
import { transacao } from "../kernel/ledger/db.js";
import { contemPhiResidual, sanitizarArtefato, type DicionarioPaciente } from "../kernel/llm/desidentificar.js";
import {
  montarResumosContatoPreConsulta,
  projetarEstadoOperacionalMensagem,
  validarOrientacaoGeralPorCenario,
  type MensagemEntradaResumo,
} from "../modules/canal/caixaResposta.js";
import {
  montarPreConsulta,
  type EntradaPreConsulta,
  type PreConsultPack,
} from "../modules/consulta/preConsulta.js";
import {
  consultarConsentimentoCanal,
  detalheMensagemCanal,
  garantirSchema,
  type AcessoCanal,
  type FalhaArmazenamento,
} from "./canalEntrada.js";

type Intent = z.infer<typeof ActionIntent>;

function sha256(texto: string): string {
  return createHash("sha256").update(texto, "utf8").digest("hex");
}

function garantirTabelasS03(db: DatabaseSync): void {
  garantirSchema(db);
  db.exec(`
    CREATE TABLE IF NOT EXISTS canal_midia_lida (
      mensagemId TEXT PRIMARY KEY REFERENCES canal_mensagem(mensagemId),
      providerMediaId TEXT NOT NULL,
      sha256LocalComprovado TEXT NOT NULL,
      sizeBytesLocal INTEGER NOT NULL CHECK (sizeBytesLocal > 0),
      mimeTypeVerificado TEXT NOT NULL,
      lidoPorMedicoId TEXT NOT NULL,
      lidoEm TEXT NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS canal_midia_lida_no_update BEFORE UPDATE ON canal_midia_lida
      BEGIN SELECT RAISE(ABORT, 'canal_midia_lida append-only'); END;
    CREATE TRIGGER IF NOT EXISTS canal_midia_lida_no_delete BEFORE DELETE ON canal_midia_lida
      BEGIN SELECT RAISE(ABORT, 'canal_midia_lida append-only'); END;

    CREATE TABLE IF NOT EXISTS canal_resposta_rascunho (
      respostaId TEXT NOT NULL,
      versao INTEGER NOT NULL CHECK (versao > 0),
      rascunhoJson TEXT NOT NULL,
      invalidada INTEGER NOT NULL DEFAULT 0 CHECK (invalidada IN (0, 1)),
      criadoEm TEXT NOT NULL,
      PRIMARY KEY (respostaId, versao)
    );

    CREATE TABLE IF NOT EXISTS canal_resposta_autorizada (
      respostaId TEXT NOT NULL,
      versao INTEGER NOT NULL CHECK (versao > 0),
      autorizacaoJson TEXT NOT NULL,
      invalidada INTEGER NOT NULL DEFAULT 0 CHECK (invalidada IN (0, 1)),
      aprovadoEm TEXT NOT NULL,
      PRIMARY KEY (respostaId, versao)
    );

    CREATE TABLE IF NOT EXISTS canal_resposta_envio (
      envioId TEXT PRIMARY KEY,
      respostaId TEXT NOT NULL,
      versao INTEGER NOT NULL,
      mensagemOrigemId TEXT NOT NULL,
      reciboGateway TEXT NOT NULL,
      enviadoEm TEXT NOT NULL,
      UNIQUE (respostaId, versao)
    );
    CREATE TRIGGER IF NOT EXISTS canal_resposta_envio_no_update BEFORE UPDATE ON canal_resposta_envio
      BEGIN SELECT RAISE(ABORT, 'canal_resposta_envio append-only'); END;
    CREATE TRIGGER IF NOT EXISTS canal_resposta_envio_no_delete BEFORE DELETE ON canal_resposta_envio
      BEGIN SELECT RAISE(ABORT, 'canal_resposta_envio append-only'); END;
  `);
}

function obterSessaoMedicaValida(acesso: AcessoCanal): Sessao | null {
  const s = Sessao.safeParse(acesso.sessoes.obter(acesso.token));
  if (!s.success || !Instante.safeParse(acesso.agora).success) return null;
  if (Date.parse(s.data.expiraEm) <= Date.parse(acesso.agora)) return null;
  if (!s.data.medicoId.trim() || !s.data.crm.trim()) return null;
  return s.data;
}

/**
 * S-F2-03 · Mídia recebida permanece NAO_PROCESSADA até leitura local comprovada por bytes e SHA-256.
 */
export function registrarLeituraLocalMidiaCanal(
  db: DatabaseSync,
  acesso: AcessoCanal,
  entrada: {
    mensagemId: string;
    bytesLocais: Uint8Array;
    mimeTypeVerificado: string;
  },
):
  | { ok: false; codigo: "SESSAO_INVALIDA" | "MENSAGEM_AUSENTE" | "NAO_EH_MIDIA" | "MIDIA_BYTES_INVALIDOS" }
  | FalhaArmazenamento
  | { ok: true; mensagemId: string; processamento: "LIDA_LOCALMENTE"; sha256LocalComprovado: string } {
  const sessao = obterSessaoMedicaValida(acesso);
  if (!sessao) return { ok: false, codigo: "SESSAO_INVALIDA" };
  const det = detalheMensagemCanal(db, acesso, entrada.mensagemId);
  if (!det.ok) return det;
  if (det.mensagem.conteudo.tipo !== "MEDIA_UNPROCESSED") {
    return { ok: false, codigo: "NAO_EH_MIDIA" };
  }
  if (!(entrada.bytesLocais instanceof Uint8Array) || entrada.bytesLocais.byteLength === 0
    || !entrada.mimeTypeVerificado.trim()) {
    return { ok: false, codigo: "MIDIA_BYTES_INVALIDOS" };
  }
  const esperadoSize = det.mensagem.conteudo.sizeBytes;
  if (esperadoSize !== null && entrada.bytesLocais.byteLength !== esperadoSize) {
    return { ok: false, codigo: "MIDIA_BYTES_INVALIDOS" };
  }
  const sha256LocalComprovado = createHash("sha256").update(entrada.bytesLocais).digest("hex");
  if (det.mensagem.conteudo.contentSha256 !== null
    && det.mensagem.conteudo.contentSha256 !== sha256LocalComprovado) {
    return { ok: false, codigo: "MIDIA_BYTES_INVALIDOS" };
  }
  const providerMediaId = det.mensagem.conteudo.providerMediaId;

  try {
    garantirTabelasS03(db);
    return transacao(db, () => {
      const jaLida = db.prepare(
        "SELECT sha256LocalComprovado FROM canal_midia_lida WHERE mensagemId = ?",
      ).get(entrada.mensagemId) as { sha256LocalComprovado: string } | undefined;
      if (jaLida) {
        if (jaLida.sha256LocalComprovado !== sha256LocalComprovado) {
          return { ok: false as const, codigo: "MIDIA_BYTES_INVALIDOS" as const };
        }
        return {
          ok: true as const,
          mensagemId: entrada.mensagemId,
          processamento: "LIDA_LOCALMENTE" as const,
          sha256LocalComprovado: jaLida.sha256LocalComprovado,
        };
      }
      db.prepare(`
        INSERT INTO canal_midia_lida (
          mensagemId, providerMediaId, sha256LocalComprovado, sizeBytesLocal,
          mimeTypeVerificado, lidoPorMedicoId, lidoEm
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        entrada.mensagemId,
        providerMediaId,
        sha256LocalComprovado,
        entrada.bytesLocais.byteLength,
        entrada.mimeTypeVerificado.trim(),
        sessao.medicoId,
        acesso.agora,
      );
      return {
        ok: true as const,
        mensagemId: entrada.mensagemId,
        processamento: "LIDA_LOCALMENTE" as const,
        sha256LocalComprovado,
      };
    });
  } catch {
    return { ok: false, codigo: "ARMAZENAMENTO_INDISPONIVEL", recuperavel: true, persistida: false };
  }
}

export function consultarStatusMidiaCanal(
  db: DatabaseSync,
  mensagemId: string,
): { processamento: "NAO_PROCESSADA" | "LIDA_LOCALMENTE"; sha256LocalComprovado: string | null } {
  garantirTabelasS03(db);
  const row = db.prepare(
    "SELECT sha256LocalComprovado FROM canal_midia_lida WHERE mensagemId = ?",
  ).get(mensagemId) as { sha256LocalComprovado: string } | undefined;
  if (!row) return { processamento: "NAO_PROCESSADA", sha256LocalComprovado: null };
  return { processamento: "LIDA_LOCALMENTE", sha256LocalComprovado: row.sha256LocalComprovado };
}

/**
 * S-F2-03 · Prepara rascunho de resposta exibindo destinatário, conteúdo e contexto antes da confirmação.
 * Se for ORIENTACAO_GERAL_CENARIO, aplica as restrições da D-W9-75 (curadoria médica, sem dose/posologia/início/diagnóstico, frase final).
 */
export function prepararRascunhoRespostaCanal(
  db: DatabaseSync,
  acesso: AcessoCanal,
  entrada: {
    respostaId: string;
    versao: number;
    mensagemOrigemId: string;
    contatoId?: string;
    contexto: ContextoRespostaCanal;
    tipoResposta: TipoRespostaCanal;
    cenarioId?: string | null;
    statusCuradoriaCenario?: "CONFERIDA_MEDICO" | "RASCUNHO" | null;
    texto: string;
  },
):
  | {
    ok: false;
    codigo:
      | "SESSAO_INVALIDA"
      | "MENSAGEM_AUSENTE"
      | "CONTATO_NAO_VINCULADO_AO_PACIENTE"
      | "CENARIO_NAO_CURADO_PELO_MEDICO"
      | "ORIENTACAO_VAZIA"
      | "FALTA_FRASE_FINAL_D_W9_75"
      | "DOSE_NUMERICA_PROIBIDA"
      | "POSOLOGIA_PROIBIDA"
      | "INICIO_MEDICAMENTO_PROIBIDO"
      | "DIAGNOSTICO_DEFINITIVO_PROIBIDO"
      | "RASCUNHO_INVALIDO";
  }
  | FalhaArmazenamento
  | { ok: true; rascunho: RascunhoRespostaCanal } {
  const sessao = obterSessaoMedicaValida(acesso);
  if (!sessao) return { ok: false, codigo: "SESSAO_INVALIDA" };
  const det = detalheMensagemCanal(db, acesso, entrada.mensagemOrigemId);
  if (!det.ok) return det;

  if (det.mensagem.vinculo.classe !== "CONHECIDO" || det.mensagem.vinculo.patientId !== entrada.contexto.patientId) {
    return { ok: false, codigo: "CONTATO_NAO_VINCULADO_AO_PACIENTE" };
  }
  if (entrada.contatoId !== undefined && entrada.contatoId !== det.mensagem.senderRef) {
    return { ok: false, codigo: "CONTATO_NAO_VINCULADO_AO_PACIENTE" };
  }

  let textoFinal = entrada.texto.trim();
  let cenarioId: string | null = entrada.cenarioId ?? null;
  let statusCuradoriaCenario: "CONFERIDA_MEDICO" | "RASCUNHO" | null = entrada.statusCuradoriaCenario ?? null;

  if (entrada.tipoResposta === "ORIENTACAO_GERAL_CENARIO") {
    if (!cenarioId || !statusCuradoriaCenario) {
      return { ok: false, codigo: "CENARIO_NAO_CURADO_PELO_MEDICO" };
    }
    const validacao = validarOrientacaoGeralPorCenario({
      cenarioId,
      statusCuradoria: statusCuradoriaCenario,
      textoOrientacao: textoFinal,
    });
    if (!validacao.ok) return { ok: false, codigo: validacao.codigo };
    textoFinal = validacao.textoValidado;
  }

  const parsed = RascunhoRespostaCanal.safeParse({
    respostaId: entrada.respostaId,
    versao: entrada.versao,
    mensagemOrigemId: entrada.mensagemOrigemId,
    accountId: det.mensagem.accountId,
    canal: det.mensagem.canal,
    contatoId: entrada.contatoId ?? det.mensagem.senderRef,
    destinatario: det.mensagem.senderRef,
    contexto: entrada.contexto,
    tipoResposta: entrada.tipoResposta,
    cenarioId,
    statusCuradoriaCenario,
    texto: textoFinal,
    conteudoSha256: sha256(textoFinal),
    exibidoEm: acesso.agora,
    confirmadoPeloMedico: false,
    confirmadoPorMedicoId: null,
    confirmadoPorCrm: null,
    confirmadoEm: null,
  });
  if (!parsed.success) return { ok: false, codigo: "RASCUNHO_INVALIDO" };

  try {
    garantirTabelasS03(db);
    return transacao(db, () => {
      const jaInvalidada = db.prepare(
        "SELECT invalidada FROM canal_resposta_rascunho WHERE respostaId = ? AND versao = ?",
      ).get( parsed.data.respostaId, parsed.data.versao ) as { invalidada: number } | undefined;
      if (jaInvalidada?.invalidada === 1) {
        return { ok: false as const, codigo: "RASCUNHO_INVALIDO" as const };
      }
      db.prepare(`
        INSERT INTO canal_resposta_rascunho (respostaId, versao, rascunhoJson, invalidada, criadoEm)
        VALUES (?, ?, ?, 0, ?)
        ON CONFLICT(respostaId, versao) DO UPDATE SET
          rascunhoJson = excluded.rascunhoJson,
          criadoEm = excluded.criadoEm
      `).run(parsed.data.respostaId, parsed.data.versao, JSON.stringify(parsed.data), acesso.agora);
      return { ok: true as const, rascunho: parsed.data };
    });
  } catch {
    return { ok: false, codigo: "ARMAZENAMENTO_INDISPONIVEL", recuperavel: true, persistida: false };
  }
}

/**
 * S-F2-03 · Confirmação médica explícita da resposta exibida (destinatário, conteúdo e contexto).
 * Grava autorização específica no servidor para essa operação/contato/destinatário/consentimento/versão.
 */
export function confirmarRespostaCanalPeloMedico(
  db: DatabaseSync,
  acesso: AcessoCanal,
  entrada: {
    respostaId: string;
    versao: number;
    comprovanteExibicao: {
      destinatario: string;
      conteudoSha256: string;
      contexto: ContextoRespostaCanal;
    };
  },
):
  | {
    ok: false;
    codigo:
      | "SESSAO_INVALIDA"
      | "RASCUNHO_RESPOSTA_AUSENTE"
      | "DESTINATARIO_ALTERADO_APOS_EXIBICAO"
      | "CONTEUDO_ALTERADO_APOS_EXIBICAO"
      | "CONTEXTO_ALTERADO_APOS_EXIBICAO"
      | "CONSENTIMENTO_REVOGADO_OU_AUSENTE"
      | "CONTATO_REVOGADO";
  }
  | FalhaArmazenamento
  | { ok: true; autorizacao: AutorizacaoRespostaCanalServidor } {
  const sessao = obterSessaoMedicaValida(acesso);
  if (!sessao) return { ok: false, codigo: "SESSAO_INVALIDA" };

  try {
    garantirTabelasS03(db);
    return transacao(db, () => {
      const row = db.prepare(
        "SELECT rascunhoJson, invalidada FROM canal_resposta_rascunho WHERE respostaId = ? AND versao = ?",
      ).get(entrada.respostaId, entrada.versao) as { rascunhoJson: string; invalidada: number } | undefined;
      if (!row) return { ok: false as const, codigo: "RASCUNHO_RESPOSTA_AUSENTE" as const };
      if (row.invalidada === 1) {
        return { ok: false as const, codigo: "CONTEXTO_ALTERADO_APOS_EXIBICAO" as const };
      }
      const autPrevia = db.prepare(
        "SELECT invalidada FROM canal_resposta_autorizada WHERE respostaId = ? AND versao = ?",
      ).get(entrada.respostaId, entrada.versao) as { invalidada: number } | undefined;
      if (autPrevia?.invalidada === 1) {
        return { ok: false as const, codigo: "CONTEXTO_ALTERADO_APOS_EXIBICAO" as const };
      }

      const rascunho = RascunhoRespostaCanal.parse(JSON.parse(row.rascunhoJson));
      if (rascunho.contatoId !== rascunho.destinatario) {
        return { ok: false as const, codigo: "DESTINATARIO_ALTERADO_APOS_EXIBICAO" as const };
      }
      if (rascunho.destinatario !== entrada.comprovanteExibicao.destinatario) {
        return { ok: false as const, codigo: "DESTINATARIO_ALTERADO_APOS_EXIBICAO" as const };
      }
      if (rascunho.conteudoSha256 !== entrada.comprovanteExibicao.conteudoSha256) {
        return { ok: false as const, codigo: "CONTEUDO_ALTERADO_APOS_EXIBICAO" as const };
      }
      if (rascunho.contexto.patientId !== entrada.comprovanteExibicao.contexto.patientId
        || rascunho.contexto.encounterId !== entrada.comprovanteExibicao.contexto.encounterId
        || rascunho.contexto.tumorLotId !== entrada.comprovanteExibicao.contexto.tumorLotId
        || rascunho.contexto.revisaoContexto !== entrada.comprovanteExibicao.contexto.revisaoContexto) {
        return { ok: false as const, codigo: "CONTEXTO_ALTERADO_APOS_EXIBICAO" as const };
      }

      if (contatoFoiRevogadoNoLedger(db, rascunho.contatoId, rascunho.destinatario)) {
        return { ok: false as const, codigo: "CONTATO_REVOGADO" as const };
      }

      const consentimento = consultarConsentimentoCanal(db, rascunho.contatoId);
      const finalidadeExigida = rascunho.tipoResposta === "ORIENTACAO_GERAL_CENARIO"
        ? "ORIENTACAO_GERAL"
        : "COMUNICACAO_CLINICA";
      if (consentimento.estado !== "TERMO_ACEITO"
        || (consentimento.patientId !== null && consentimento.patientId !== rascunho.contexto.patientId)
        || (!consentimento.finalidade.includes(finalidadeExigida) && !consentimento.finalidade.includes("COMUNICACAO_CLINICA"))
        || !consentimento.referenciaTermo || !consentimento.versaoTermo || !consentimento.registradoEm) {
        return { ok: false as const, codigo: "CONSENTIMENTO_REVOGADO_OU_AUSENTE" as const };
      }

      const verboPermitido = rascunho.canal === "EMAIL" ? "ENVIAR_EMAIL" as const : "ENVIAR_WHATSAPP" as const;
      const autorizacao = AutorizacaoRespostaCanalServidor.parse({
        respostaId: rascunho.respostaId,
        versao: rascunho.versao,
        mensagemOrigemId: rascunho.mensagemOrigemId,
        accountId: rascunho.accountId,
        canal: rascunho.canal,
        verboPermitido,
        contatoId: rascunho.contatoId,
        destinatarioCanonico: rascunho.destinatario,
        contexto: rascunho.contexto,
        consentimento: {
          estado: "TERMO_ACEITO",
          referenciaTermo: consentimento.referenciaTermo,
          versaoTermo: consentimento.versaoTermo,
          registradoEm: consentimento.registradoEm,
        },
        tipoResposta: rascunho.tipoResposta,
        textoAprovado: rascunho.texto,
        conteudoSha256: rascunho.conteudoSha256,
        aprovadoPor: {
          medicoId: sessao.medicoId,
          crm: sessao.crm,
          em: acesso.agora,
        },
        invalidadaPorMudancaDeContexto: false,
      });

      const rascunhoConfirmado: RascunhoRespostaCanal = {
        ...rascunho,
        confirmadoPeloMedico: true,
        confirmadoPorMedicoId: sessao.medicoId,
        confirmadoPorCrm: sessao.crm,
        confirmadoEm: acesso.agora,
      };

      db.prepare(`
        UPDATE canal_resposta_rascunho
        SET rascunhoJson = ?
        WHERE respostaId = ? AND versao = ?
      `).run(JSON.stringify(rascunhoConfirmado), rascunho.respostaId, rascunho.versao);

      db.prepare(`
        INSERT INTO canal_resposta_autorizada (respostaId, versao, autorizacaoJson, invalidada, aprovadoEm)
        VALUES (?, ?, ?, 0, ?)
        ON CONFLICT(respostaId, versao) DO UPDATE SET
          autorizacaoJson = excluded.autorizacaoJson,
          invalidada = 0,
          aprovadoEm = excluded.aprovadoEm
      `).run(autorizacao.respostaId, autorizacao.versao, JSON.stringify(autorizacao), acesso.agora);

      return { ok: true as const, autorizacao };
    });
  } catch {
    return { ok: false, codigo: "ARMAZENAMENTO_INDISPONIVEL", recuperavel: true, persistida: false };
  }
}

/**
 * Invalida rascunhos/aprovações em aberto quando o contexto clínico ou a revisão muda (S-F2-03).
 */
export function invalidarRespostasPorMudancaContextoCanal(
  db: DatabaseSync,
  patientId: string,
  encounterId?: string,
): number {
  garantirTabelasS03(db);
  const rows = db.prepare(
    "SELECT respostaId, versao, autorizacaoJson FROM canal_resposta_autorizada WHERE invalidada = 0",
  ).all() as Array<{ respostaId: string; versao: number; autorizacaoJson: string }>;
  const rowsDrafts = db.prepare(
    "SELECT respostaId, versao, rascunhoJson FROM canal_resposta_rascunho WHERE invalidada = 0",
  ).all() as Array<{ respostaId: string; versao: number; rascunhoJson: string }>;
  let invalidadas = 0;
  transacao(db, () => {
    for (const row of rows) {
      const aut = AutorizacaoRespostaCanalServidor.parse(JSON.parse(row.autorizacaoJson));
      if (aut.contexto.patientId === patientId && (!encounterId || aut.contexto.encounterId === encounterId)) {
        const atualizada: AutorizacaoRespostaCanalServidor = {
          ...aut,
          invalidadaPorMudancaDeContexto: true,
        };
        db.prepare(`
          UPDATE canal_resposta_autorizada
          SET invalidada = 1, autorizacaoJson = ?
          WHERE respostaId = ? AND versao = ?
        `).run(JSON.stringify(atualizada), row.respostaId, row.versao);
        invalidadas += 1;
      }
    }
    for (const row of rowsDrafts) {
      const draft = RascunhoRespostaCanal.parse(JSON.parse(row.rascunhoJson));
      if (draft.contexto.patientId === patientId && (!encounterId || draft.contexto.encounterId === encounterId)) {
        db.prepare(`
          UPDATE canal_resposta_rascunho
          SET invalidada = 1
          WHERE respostaId = ? AND versao = ?
        `).run(row.respostaId, row.versao);
        invalidadas += 1;
      }
    }
  });
  return invalidadas;
}

function carregarDicionarioPacienteDoLedger(
  db: DatabaseSync,
  patientId: string,
  destinatario: string,
): DicionarioPaciente {
  const nomes = new Set<string>();
  const identificadores = new Set<string>();
  try {
    const eventos = listarEventos(db, patientId);
    for (const ev of eventos) {
      if (ev.tipo !== "Paciente") continue;
      const outer = ev.payload && typeof ev.payload === "object" ? ev.payload as Record<string, unknown> : null;
      const parsed = Paciente.safeParse(outer?.data ?? outer);
      if (parsed.success) {
        if (parsed.data.nome.trim()) nomes.add(parsed.data.nome.trim());
        for (const id of parsed.data.identificadores) {
          if (id.valor.trim()) identificadores.add(id.valor.trim());
        }
      }
    }
  } catch { /* fallback seguro quando a tabela de eventos está vazia */ }
  if (nomes.size === 0) nomes.add("Paciente Sintetico Padrao");
  if (identificadores.size === 0) identificadores.add(`ID-PACIENTE-${patientId}`);
  void destinatario;
  return {
    nomes: [...nomes],
    identificadores: [...identificadores],
  };
}

function contatoFoiRevogadoNoLedger(db: DatabaseSync, contatoId: string, endereco: string): boolean {
  try {
    const temTabela = db.prepare(
      "SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name='clinical_event'",
    ).get();
    if (!temTabela) return false;
    const rows = db.prepare(
      "SELECT payload FROM clinical_event WHERE tipo = 'Contato'",
    ).all() as Array<{ payload: string }>;
    for (const r of rows) {
      const outer = JSON.parse(String(r.payload)) as Record<string, unknown>;
      const parsed = Contato.safeParse(outer.data ?? outer);
      if (parsed.success && (parsed.data.contatoId === contatoId || parsed.data.endereco === endereco)) {
        if (parsed.data.revogadoEm !== null) return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Revalidação server-side específica por operação, contato, destinatário, consentimento,
 * contexto e versão (inclusive após operações assíncronas e em replays).
 * Se não houver autorização específica registrada para o objeto, preserva CANAL_EXTERNO_NAO_HABILITADO.
 */
export function revalidarAutorizacaoSaidaCanalNoLedger(
  db: DatabaseSync,
  intent: Intent,
  opcoes?: {
    revisaoContextoAtual?: string;
    textoEnviado?: string;
  },
): { ok: true; autorizacao: AutorizacaoRespostaCanalServidor } | { ok: false; codigo: string } {
  if (intent.verbo !== "ENVIAR_WHATSAPP" && intent.verbo !== "ENVIAR_EMAIL") {
    return { ok: false, codigo: "CANAL_EXTERNO_NAO_HABILITADO" };
  }
  if (intent.objeto.tipo !== "MENSAGEM_CANAL") {
    return { ok: false, codigo: "CANAL_EXTERNO_NAO_HABILITADO" };
  }
  try {
    const temTabelaAut = db.prepare(
      "SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name='canal_resposta_autorizada'",
    ).get();
    if (!temTabelaAut) return { ok: false, codigo: "CANAL_EXTERNO_NAO_HABILITADO" };

    const rowAut = db.prepare(
      "SELECT autorizacaoJson, invalidada FROM canal_resposta_autorizada WHERE respostaId = ? AND versao = ?",
    ).get(intent.objeto.id, intent.objeto.versao) as { autorizacaoJson: string; invalidada: number } | undefined;

    if (!rowAut) {
      const rowDraft = db.prepare(
        "SELECT invalidada FROM canal_resposta_rascunho WHERE respostaId = ? AND versao = ?",
      ).get(intent.objeto.id, intent.objeto.versao) as { invalidada: number } | undefined;
      if (rowDraft) {
        return {
          ok: false,
          codigo: rowDraft.invalidada === 1 ? "CONTEXTO_RESPOSTA_INVALIDADO" : "RESPOSTA_NAO_CONFIRMADA_PELO_MEDICO",
        };
      }
      return { ok: false, codigo: "CANAL_EXTERNO_NAO_HABILITADO" };
    }

    const aut = AutorizacaoRespostaCanalServidor.parse(JSON.parse(rowAut.autorizacaoJson));
    if (rowAut.invalidada === 1 || aut.invalidadaPorMudancaDeContexto) {
      return { ok: false, codigo: "CONTEXTO_RESPOSTA_INVALIDADO" };
    }
    if (intent.verbo !== aut.verboPermitido) {
      return { ok: false, codigo: "CANAL_VERBO_INCOMPATIVEL" };
    }
    if (intent.escopo.patientId !== aut.contexto.patientId || intent.escopo.encounterId !== aut.contexto.encounterId) {
      return { ok: false, codigo: "CONTEXTO_RESPOSTA_INVALIDADO" };
    }
    if (opcoes?.revisaoContextoAtual !== undefined && opcoes.revisaoContextoAtual !== aut.contexto.revisaoContexto) {
      return { ok: false, codigo: "CONTEXTO_RESPOSTA_INVALIDADO" };
    }
    if (!intent.destino || intent.destino !== aut.destinatarioCanonico || aut.contatoId !== aut.destinatarioCanonico) {
      return { ok: false, codigo: "DESTINO_DIVERGENTE_DO_CONTATO" };
    }
    if (opcoes?.textoEnviado !== undefined && sha256(opcoes.textoEnviado) !== aut.conteudoSha256) {
      return { ok: false, codigo: "CONTEUDO_ALTERADO_APOS_CONFIRMACAO" };
    }
    if (contatoFoiRevogadoNoLedger(db, aut.contatoId, aut.destinatarioCanonico)) {
      return { ok: false, codigo: "CONTATO_REVOGADO" };
    }

    const consentimentoAtual = consultarConsentimentoCanal(db, aut.contatoId);
    const finalidadeExigida = aut.tipoResposta === "ORIENTACAO_GERAL_CENARIO"
      ? "ORIENTACAO_GERAL"
      : "COMUNICACAO_CLINICA";
    if (consentimentoAtual.estado !== "TERMO_ACEITO"
      || (consentimentoAtual.patientId !== null && consentimentoAtual.patientId !== aut.contexto.patientId)
      || (!consentimentoAtual.finalidade.includes(finalidadeExigida) && !consentimentoAtual.finalidade.includes("COMUNICACAO_CLINICA"))) {
      return { ok: false, codigo: "CONSENTIMENTO_REVOGADO_OU_AUSENTE" };
    }

    const msgRow = db.prepare(
      "SELECT vinculoClasse, vinculoPatientId, senderRef FROM canal_mensagem WHERE mensagemId = ?",
    ).get(aut.mensagemOrigemId) as { vinculoClasse: string; vinculoPatientId: string | null; senderRef: string } | undefined;
    if (!msgRow || msgRow.vinculoClasse !== "CONHECIDO"
      || msgRow.vinculoPatientId !== aut.contexto.patientId
      || msgRow.senderRef !== aut.destinatarioCanonico) {
      return { ok: false, codigo: "CONTATO_NAO_VINCULADO_AO_PACIENTE" };
    }

    return { ok: true, autorizacao: aut };
  } catch {
    return { ok: false, codigo: "CANAL_EXTERNO_NAO_HABILITADO" };
  }
}

/**
 * S-F2-03 · Executa envio autorizado através do Action Gateway existente (`criarGateway`),
 * revalidando identidade, contexto, consentimento, destinatário e versão antes e após aguardar,
 * com auditoria (`AuditEvent`) e idempotência (`action_idempotency`).
 */
export async function executarEnvioAutorizadoCanal(
  db: DatabaseSync,
  acesso: AcessoCanal,
  opcoes: {
    intent: Intent;
    textoParaEnviar?: string;
    revisaoContextoAtual?: string;
    dicionarioPaciente?: DicionarioPaciente;
    antesDoEnvioAssincrono?: () => Promise<void> | void;
    transporteSaida: (envio: {
      canal: "WHATSAPP_SERVICO" | "EMAIL";
      accountId: string;
      destinatario: string;
      texto: string;
      respostaId: string;
      versao: number;
    }) => Promise<{ ok: true; providerReceiptId: string } | { ok: false; incerto: boolean; erro: string }>;
  },
): Promise<{
  resultadoGateway: ResultadoGateway;
  estadoOperacional: EstadoOperacionalMensagemCanal | null;
}> {
  const sessao = obterSessaoMedicaValida(acesso);
  garantirTabelasS03(db);
  if (!sessao) {
    auditar(db, {
      ator: { tipo: "SISTEMA", id: "canal-saida" },
      acaoPedida: opcoes.intent.verbo,
      decisao: "NEGADA",
      motivoCodigo: "SEM_SESSAO",
      politicaVersao: "F2-S03",
      em: Instante.safeParse(acesso.agora).success ? acesso.agora : new Date().toISOString(),
    });
    return {
      resultadoGateway: { decisao: "NEGADA", motivoCodigo: "SEM_SESSAO" },
      estadoOperacional: null,
    };
  }

  // Revalidação prévia antes do gateway (inclusive em replay!)
  const revalidacaoPrevia = revalidarAutorizacaoSaidaCanalNoLedger(db, opcoes.intent, {
    ...(opcoes.revisaoContextoAtual !== undefined ? { revisaoContextoAtual: opcoes.revisaoContextoAtual } : {}),
    ...(opcoes.textoParaEnviar !== undefined ? { textoEnviado: opcoes.textoParaEnviar } : {}),
  });
  if (!revalidacaoPrevia.ok) {
    auditar(db, {
      ator: sessao ? { tipo: "SESSAO", id: sessao.medicoId } : { tipo: "SISTEMA", id: "canal-saida" },
      acaoPedida: opcoes.intent.verbo,
      decisao: "NEGADA",
      motivoCodigo: revalidacaoPrevia.codigo,
      politicaVersao: "F2-S03",
      em: acesso.agora,
    });
    return {
      resultadoGateway: { decisao: "NEGADA", motivoCodigo: revalidacaoPrevia.codigo },
      estadoOperacional: null,
    };
  }

  const autInicial = revalidacaoPrevia.autorizacao;
  const dic: DicionarioPaciente = opcoes.dicionarioPaciente
    ?? carregarDicionarioPacienteDoLedger(db, autInicial.contexto.patientId, autInicial.destinatarioCanonico);

  let autorizacaoRevalidadaPosAsync: AutorizacaoRespostaCanalServidor | null = null;

  const gateway = criarGateway({
    agora: () => acesso.agora,
    store: sqliteIdempotencia(db),
    auditar: (r) => {
      auditar(db, {
        ator: sessao ? { tipo: "SESSAO", id: sessao.medicoId } : { tipo: "SISTEMA", id: "canal-saida" },
        acaoPedida: r.acaoPedida,
        decisao: r.decisao,
        motivoCodigo: r.motivoCodigo,
        politicaVersao: "F2-S03",
        em: r.em,
      });
    },
    validarSaida: async (intent) => {
      await opcoes.antesDoEnvioAssincrono?.();
      // Revalida a sessão médica e a autorização APÓS qualquer operação assíncrona!
      const sessaoPosAsync = obterSessaoMedicaValida(acesso);
      if (!sessaoPosAsync || sessaoPosAsync.medicoId !== sessao.medicoId) {
        return { ok: false, codigo: "SAIDA_NAO_AUTORIZADA" };
      }
      const rev = revalidarAutorizacaoSaidaCanalNoLedger(db, intent, {
        ...(opcoes.revisaoContextoAtual !== undefined ? { revisaoContextoAtual: opcoes.revisaoContextoAtual } : {}),
        ...(opcoes.textoParaEnviar !== undefined ? { textoEnviado: opcoes.textoParaEnviar } : {}),
      });
      if (!rev.ok) {
        return {
          ok: false,
          codigo: rev.codigo === "CONSENTIMENTO_REVOGADO_OU_AUSENTE" ? "CONSENTIMENTO_AUSENTE" : "SAIDA_NAO_AUTORIZADA",
        };
      }
      autorizacaoRevalidadaPosAsync = rev.autorizacao;
      const payload = rev.autorizacao.textoAprovado;
      const payloadHash = sha256(payload);
      const destinoHash = sha256(rev.autorizacao.destinatarioCanonico);
      const sanitizado = sanitizarArtefato({
        artefatoId: rev.autorizacao.respostaId,
        tipo: "TEXTO",
        texto: payload,
        em: acesso.agora,
        detectorPhi: (conteudo) => contemPhiResidual(conteudo, dic),
      });
      const evidencia: EvidenciaSaidaExterna = {
        payload,
        destinoCanonico: rev.autorizacao.destinatarioCanonico,
        artefato: {
          id: rev.autorizacao.respostaId,
          versao: rev.autorizacao.versao,
          hash: rev.autorizacao.conteudoSha256,
          tipo: "MENSAGEM_CANAL",
          metadados: {},
        },
        dicionarioPaciente: dic,
        sanitizationReport: {
          riscoResidual: sanitizado.report.riscoResidual,
          versaoSanitizador: sanitizado.report.versaoSanitizador,
          payloadHash,
          destinoHash,
        },
        autorizacao: {
          patientId: rev.autorizacao.contexto.patientId,
          encounterId: rev.autorizacao.contexto.encounterId,
          artefatoId: rev.autorizacao.respostaId,
          versao: rev.autorizacao.versao,
          artefatoHash: rev.autorizacao.conteudoSha256,
          payloadHash,
          destinoHash,
          vigente: true,
        },
      };
      return { ok: true, evidencia };
    },
    executores: {
      [autInicial.verboPermitido]: {
        executar: async () => {
          const vigente = autorizacaoRevalidadaPosAsync ?? autInicial;
          const res = await opcoes.transporteSaida({
            canal: vigente.canal,
            accountId: vigente.accountId,
            destinatario: vigente.destinatarioCanonico,
            texto: vigente.textoAprovado,
            respostaId: vigente.respostaId,
            versao: vigente.versao,
          });
          if (!res.ok) return res;
          return { ok: true, recibo: res.providerReceiptId };
        },
      },
    },
  });

  const resultadoGateway = await gateway.executar(opcoes.intent, sessao);

  if (resultadoGateway.decisao === "EXECUTADA" || resultadoGateway.decisao === "REPLAY") {
    transacao(db, () => {
      db.prepare(`
        INSERT INTO canal_resposta_envio (envioId, respostaId, versao, mensagemOrigemId, reciboGateway, enviadoEm)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(respostaId, versao) DO NOTHING
      `).run(
        `envio-${autInicial.respostaId}-v${autInicial.versao}`,
        autInicial.respostaId,
        autInicial.versao,
        autInicial.mensagemOrigemId,
        resultadoGateway.recibo ?? "recibo-local",
        acesso.agora,
      );
      db.prepare(`
        INSERT INTO canal_recibo_tecnico (reciboTecnicoId, accountId, providerMessageId, statusRecibo, ocorreuEm, ingestedAt, payloadSha256)
        VALUES (?, ?, ?, 'ENVIADA', ?, ?, ?)
        ON CONFLICT(accountId, providerMessageId, statusRecibo, ocorreuEm) DO NOTHING
      `).run(
        `recibo-envio-${autInicial.respostaId}-v${autInicial.versao}`,
        autInicial.accountId,
        `${autInicial.respostaId}@${autInicial.versao}`,
        acesso.agora,
        acesso.agora,
        autInicial.conteudoSha256,
      );
    });

    const estadoOperacional = projetarEstadoOperacionalMensagem({
      mensagemId: autInicial.mensagemOrigemId,
      reciboTecnico: "ENVIADA",
      triada: true,
      aguardaMedico: false,
      respostaMedicaEnviada: autInicial.tipoResposta !== "ACUSO_RECEBIMENTO_TECNICO",
      encerradaExplicitamentePeloMedico: false,
      acusoRecebimentoEnviado: autInicial.tipoResposta === "ACUSO_RECEBIMENTO_TECNICO",
    });
    return { resultadoGateway, estadoOperacional };
  }

  return { resultadoGateway, estadoOperacional: null };
}

/**
 * S-F2-03 · Integra ContactSummary à pré-consulta e ao cabeçalho da consulta, com acesso às mensagens originais,
 * mantendo histórico completo preservado e desconhecidos/ambíguos na fila de revisão.
 */
export function integrarCanalNaPreConsultaECabecalho(
  db: DatabaseSync,
  opcoes: {
    entradaPreConsulta: EntradaPreConsulta;
    ultimaConsultaConfirmadaEm: string | null;
    cacheAnterior?: ReadonlyMap<string, ResumoContatoIntegradoPreConsulta>;
  },
): {
  preConsulta: PreConsultPack;
  resumosDoPaciente: ResumoContatoIntegradoPreConsulta[];
  filaRevisao: ResumoContatoIntegradoPreConsulta[];
  recalculados: number;
  reutilizadosDoCache: number;
  latenciaMs: number;
} {
  const inicio = performance.now();
  garantirTabelasS03(db);

  const linhas = db.prepare(`
    SELECT m.mensagemId, m.accountId, m.providerMessageId, m.canal, m.senderRef,
           m.providerSentAt, m.ingestedAt, m.conteudo, m.vinculoClasse, m.vinculoPatientId,
           r.resolvidoEm, ml.sha256LocalComprovado
    FROM canal_mensagem m
    LEFT JOIN canal_pendencia_resolucao r ON r.mensagemId = m.mensagemId
    LEFT JOIN canal_midia_lida ml ON ml.mensagemId = m.mensagemId
    ORDER BY m.ingestedAt, m.mensagemId
  `).all() as Array<{
    mensagemId: string;
    accountId: string;
    providerMessageId: string;
    canal: "WHATSAPP_SERVICO" | "EMAIL";
    senderRef: string;
    providerSentAt: string | null;
    ingestedAt: string;
    conteudo: string;
    vinculoClasse: "CONHECIDO" | "DESCONHECIDO" | "AMBIGUO";
    vinculoPatientId: string | null;
    resolvidoEm: string | null;
    sha256LocalComprovado: string | null;
  }>;

  const mensagensParaResumo: MensagemEntradaResumo[] = linhas.map((l) => {
    const rawConteudo = JSON.parse(l.conteudo) as Record<string, unknown>;
    const revogado = contatoFoiRevogadoNoLedger(db, l.senderRef, l.senderRef);
    const estadoVinculo: EstadoVinculoContatoEntrada = revogado
      ? "REVOGADO"
      : l.vinculoClasse === "CONHECIDO" && l.vinculoPatientId
        ? "CONTATO_EXATO"
        : l.vinculoClasse === "AMBIGUO"
          ? "CONFLITO"
          : "PENDENTE";
    const reciboTecnico: EstadoReciboCanal = l.resolvidoEm ? "PROCESSADA" : "RECEBIDA";

    if (rawConteudo.tipo === "TEXT") {
      return {
        accountId: l.accountId,
        mensagemId: l.mensagemId,
        providerMessageId: l.providerMessageId,
        canal: l.canal,
        contatoId: l.senderRef,
        patientId: !revogado && l.vinculoClasse === "CONHECIDO" ? l.vinculoPatientId : null,
        estadoVinculo,
        senderRef: l.senderRef,
        providerSentAt: l.providerSentAt,
        ingestedAt: l.ingestedAt,
        reciboTecnico,
        decisaoReconciliacaoHash: l.resolvidoEm,
        conteudo: { tipo: "TEXT", texto: String(rawConteudo.texto) },
      };
    }
    return {
      accountId: l.accountId,
      mensagemId: l.mensagemId,
      providerMessageId: l.providerMessageId,
      canal: l.canal,
      contatoId: l.senderRef,
      patientId: !revogado && l.vinculoClasse === "CONHECIDO" ? l.vinculoPatientId : null,
      estadoVinculo,
      senderRef: l.senderRef,
      providerSentAt: l.providerSentAt,
      ingestedAt: l.ingestedAt,
      reciboTecnico,
      decisaoReconciliacaoHash: l.resolvidoEm,
      conteudo: {
        tipo: "MEDIA_UNPROCESSED",
        providerMediaId: String(rawConteudo.providerMediaId),
        mimeType: rawConteudo.mimeType === null ? null : String(rawConteudo.mimeType),
        processamento: l.sha256LocalComprovado ? "LIDA_LOCALMENTE" : "NAO_PROCESSADA",
        sha256LocalComprovado: l.sha256LocalComprovado ?? null,
      },
    };
  });

  const { resumosPorContato, recalculados, reutilizadosDoCache } = montarResumosContatoPreConsulta({
    mensagens: mensagensParaResumo,
    ultimaConsultaConfirmadaEm: opcoes.ultimaConsultaConfirmadaEm,
    ...(opcoes.cacheAnterior ? { cacheAnterior: opcoes.cacheAnterior } : {}),
  });

  const patientIdAlvo = opcoes.entradaPreConsulta.atual.patientId;
  const resumosDoPaciente = resumosPorContato.filter(
    (r) => r.estadoVinculo === "CONTATO_EXATO" && r.patientId === patientIdAlvo,
  );
  const filaRevisao = resumosPorContato.filter((r) => r.estadoVinculo !== "CONTATO_EXATO");

  const contatosPreConsulta = [
    ...(opcoes.entradaPreConsulta.atual.contatos ?? []),
    ...resumosDoPaciente.map((r) => ({
      contatoId: r.contatoId,
      canal: r.canal,
      resumo: r.resumoTexto,
      em: r.ultimaMensagemEm ?? opcoes.entradaPreConsulta.hoje,
      mensagensOriginaisIds: r.mensagensOriginaisIds,
      mensagensOriginais: r.mensagensOriginais,
    })),
  ];

  const preConsulta = montarPreConsulta({
    ...opcoes.entradaPreConsulta,
    atual: {
      ...opcoes.entradaPreConsulta.atual,
      contatos: contatosPreConsulta,
    },
  });

  const latenciaMs = Math.max(0, performance.now() - inicio);
  return {
    preConsulta,
    resumosDoPaciente,
    filaRevisao,
    recalculados,
    reutilizadosDoCache,
    latenciaMs,
  };
}
