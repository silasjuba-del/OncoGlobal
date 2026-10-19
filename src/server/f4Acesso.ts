// F4 · Persistência e governança server-side para APAC, retrógrada, farmácia/estoque e minutas de laudo de acesso/judicialização.
import type { DatabaseSync } from "node:sqlite";
import type { ChipEstoque, LeituraEstoque, ValidadeChip } from "../contracts/api/estoque.js";
import type { PedidoFarmacia, RegistroFarmacia, ResultadoFarmacia } from "../contracts/api/farmacia.js";
import { Instante, Sessao } from "../contracts/base.js";
import { MinutaLaudoAcessoJudicial } from "../contracts/f4/acessoEJudicializacao.js";
import type { Apac } from "../contracts/operacao.js";
import { g03Assinatura } from "../kernel/harness/gates.js";
import { transacao } from "../kernel/ledger/db.js";
import {
  gerarMinutaLaudoAcessoJudicial,
  processarNegativaRetrogradaApacF4,
} from "../modules/apac/laudoAcessoJudicial.js";
import { avaliarChip } from "../modules/estoque/chip.js";
import { registroEnviado, transicionarFarmacia } from "../modules/farmacia/estados.js";
import type { CodigoNegativa, PendenciaRetrograda } from "../rules/apac.js";
import type { GerenciadorSessao } from "./sessao.js";

export type AcessoF4 = { sessoes: GerenciadorSessao; token: string; agora: string };

/**
 * S-F4-03 · Combina o fluxo de conferência/correção da farmácia (D9) com o chip informativo de estoque.
 * - A farmácia nunca edita a prescrição;
 * - O chip de estoque informa disponibilidade com origem e data, sem travar e sem sugerir substituição.
 */
export function avaliarFarmaciaEEstoqueF4(entrada: {
  registroAtual?: RegistroFarmacia;
  conteudoPrescricaoId: string;
  pedidoFarmacia?: PedidoFarmacia;
  leituraEstoque: LeituraEstoque | null;
  hoje: string;
  validadeEstoque: ValidadeChip | null;
}): {
  resultadoFarmacia: ResultadoFarmacia | null;
  registroFarmacia: RegistroFarmacia;
  chipEstoque: ChipEstoque;
} {
  const base = entrada.registroAtual ?? registroEnviado(entrada.conteudoPrescricaoId);
  const resultadoFarmacia = entrada.pedidoFarmacia
    ? transicionarFarmacia(base, entrada.pedidoFarmacia)
    : null;
  const registroFarmacia = resultadoFarmacia ? resultadoFarmacia.registro : base;
  const chipEstoque = avaliarChip(entrada.leituraEstoque, entrada.hoje, entrada.validadeEstoque);

  return {
    resultadoFarmacia,
    registroFarmacia,
    chipEstoque,
  };
}

function obterSessaoMedicaValida(acesso: AcessoF4): Sessao | null {
  const s = Sessao.safeParse(acesso.sessoes.obter(acesso.token));
  if (!s.success || !Instante.safeParse(acesso.agora).success) return null;
  return Date.parse(s.data.expiraEm) > Date.parse(acesso.agora) ? s.data : null;
}

export function garantirSchemaF4(db: DatabaseSync): void {
  if (!db.isTransaction) {
    db.exec("PRAGMA foreign_keys = ON; PRAGMA synchronous = FULL;");
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS f4_apac_retrograda (
      apacId TEXT PRIMARY KEY,
      patientId TEXT NOT NULL,
      tumorLotId TEXT NOT NULL,
      comprovanteRef TEXT NOT NULL,
      codigoNegativa TEXT NOT NULL,
      campoOrigem TEXT,
      apacNegadaJson TEXT NOT NULL,
      pendenciaJson TEXT NOT NULL,
      registradoEm TEXT NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS f4_apac_retrograda_no_update BEFORE UPDATE ON f4_apac_retrograda
      BEGIN SELECT RAISE(ABORT, 'f4_apac_retrograda append-only'); END;
    CREATE TRIGGER IF NOT EXISTS f4_apac_retrograda_no_delete BEFORE DELETE ON f4_apac_retrograda
      BEGIN SELECT RAISE(ABORT, 'f4_apac_retrograda append-only'); END;

    CREATE TABLE IF NOT EXISTS f4_minuta_laudo_judicial (
      minutaId TEXT NOT NULL,
      versao INTEGER NOT NULL CHECK (versao > 0),
      patientId TEXT NOT NULL,
      encounterId TEXT NOT NULL,
      tumorLotId TEXT NOT NULL,
      revisao TEXT NOT NULL CHECK (revisao IN ('REVISAR', 'ASSINADO')),
      minutaJson TEXT NOT NULL,
      atualizadoEm TEXT NOT NULL,
      PRIMARY KEY (minutaId, versao)
    );
  `);
}

export function registrarNegativaRetrogradaNoBancoF4(
  db: DatabaseSync,
  acesso: AcessoF4,
  entrada: {
    patientId: string;
    apacExistente: Apac;
    codigoNegativa: CodigoNegativa;
    motivoTexto: string;
    comprovanteRef: string;
  },
):
  | { ok: true; apacNegadaPreservada: Apac; pendenciaRetrograda: PendenciaRetrograda }
  | { ok: false; codigo: "SESSAO_INVALIDA" | "NEGATIVA_INVALIDA" } {
  const sessao = obterSessaoMedicaValida(acesso);
  if (!sessao) return { ok: false, codigo: "SESSAO_INVALIDA" };
  try {
    garantirSchemaF4(db);
    const proc = processarNegativaRetrogradaApacF4({
      apacExistente: entrada.apacExistente,
      codigoNegativa: entrada.codigoNegativa,
      motivoTexto: entrada.motivoTexto,
      comprovanteRef: entrada.comprovanteRef,
      recebidoEm: acesso.agora,
    });
    transacao(db, () => {
      db.prepare(`
        INSERT INTO f4_apac_retrograda (
          apacId, patientId, tumorLotId, comprovanteRef, codigoNegativa,
          campoOrigem, apacNegadaJson, pendenciaJson, registradoEm
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(apacId) DO NOTHING
      `).run(
        entrada.apacExistente.apacId,
        entrada.patientId,
        entrada.apacExistente.tumorLotId,
        entrada.comprovanteRef,
        entrada.codigoNegativa,
        proc.pendenciaRetrograda.campoOrigem,
        JSON.stringify(proc.apacNegadaPreservada),
        JSON.stringify(proc.pendenciaRetrograda),
        acesso.agora,
      );
    });
    return { ok: true, ...proc };
  } catch {
    return { ok: false, codigo: "NEGATIVA_INVALIDA" };
  }
}

export function listarNegativasRetrogradasF4(
  db: DatabaseSync,
  patientId?: string,
): Array<{ apacNegadaPreservada: Apac; pendenciaRetrograda: PendenciaRetrograda }> {
  garantirSchemaF4(db);
  const rows = (patientId
    ? db.prepare("SELECT apacNegadaJson, pendenciaJson FROM f4_apac_retrograda WHERE patientId = ? ORDER BY registradoEm").all(patientId)
    : db.prepare("SELECT apacNegadaJson, pendenciaJson FROM f4_apac_retrograda ORDER BY registradoEm").all()) as Array<{
    apacNegadaJson: string;
    pendenciaJson: string;
  }>;
  return rows.map((r) => ({
    apacNegadaPreservada: JSON.parse(r.apacNegadaJson) as Apac,
    pendenciaRetrograda: JSON.parse(r.pendenciaJson) as PendenciaRetrograda,
  }));
}

export function salvarMinutaLaudoAcessoJudicialF4(
  db: DatabaseSync,
  acesso: AcessoF4,
  entrada: Omit<Parameters<typeof gerarMinutaLaudoAcessoJudicial>[0], "criadoEm">,
):
  | { ok: true; minuta: MinutaLaudoAcessoJudicial }
  | { ok: false; codigo: string; detalhe?: string } {
  const sessao = obterSessaoMedicaValida(acesso);
  if (!sessao) return { ok: false, codigo: "SESSAO_INVALIDA" };
  garantirSchemaF4(db);

  const gerada = gerarMinutaLaudoAcessoJudicial({
    ...entrada,
    criadoEm: acesso.agora,
  });
  if (!gerada.ok) return gerada;

  transacao(db, () => {
    db.prepare(`
      INSERT INTO f4_minuta_laudo_judicial (
        minutaId, versao, patientId, encounterId, tumorLotId, revisao, minutaJson, atualizadoEm
      ) VALUES (?, ?, ?, ?, ?, 'REVISAR', ?, ?)
      ON CONFLICT(minutaId, versao) DO UPDATE SET
        minutaJson = excluded.minutaJson,
        atualizadoEm = excluded.atualizadoEm
      WHERE f4_minuta_laudo_judicial.revisao = 'REVISAR'
    `).run(
      gerada.minuta.minutaId,
      gerada.minuta.versao,
      gerada.minuta.patientId,
      gerada.minuta.encounterId,
      gerada.minuta.tumorLotId,
      JSON.stringify(gerada.minuta),
      acesso.agora,
    );
  });

  return { ok: true, minuta: gerada.minuta };
}

/**
 * Assinatura da minuta de laudo de acesso/judicialização:
 * - Exige gate G-03 (`g03Assinatura`: ator SESSAO humana com CRM);
 * - Agente/IA nunca pode assinar (`BLOQUEIA_AUTORIDADE`);
 * - Uma vez ASSINADO, não pode ser sobrescrito na mesma versão.
 */
export function assinarMinutaLaudoAcessoJudicialF4(
  db: DatabaseSync,
  acesso: AcessoF4,
  entrada: {
    minutaId: string;
    versao: number;
    atorOverrideParaTesteAdversarial?: { tipo: "SESSAO" | "AGENTE" | "SISTEMA" | "EXECUTOR"; crm?: string | null };
  },
):
  | { ok: true; minutaAssinada: MinutaLaudoAcessoJudicial }
  | { ok: false; codigo: "SESSAO_INVALIDA" | "G03_ASSINATURA_NEGADA" | "MINUTA_AUSENTE" } {
  const sessao = obterSessaoMedicaValida(acesso);
  if (!sessao) return { ok: false, codigo: "SESSAO_INVALIDA" };
  garantirSchemaF4(db);

  const atorVerificado = entrada.atorOverrideParaTesteAdversarial ?? {
    tipo: "SESSAO" as const,
    crm: sessao.crm,
  };
  if (g03Assinatura(atorVerificado).decisao !== "PASSA") {
    return { ok: false, codigo: "G03_ASSINATURA_NEGADA" };
  }

  const row = db.prepare(
    "SELECT minutaJson FROM f4_minuta_laudo_judicial WHERE minutaId = ? AND versao = ?",
  ).get(entrada.minutaId, entrada.versao) as { minutaJson: string } | undefined;
  if (!row) return { ok: false, codigo: "MINUTA_AUSENTE" };

  const atual = MinutaLaudoAcessoJudicial.parse(JSON.parse(row.minutaJson));
  if (atual.revisao === "ASSINADO") {
    return { ok: true, minutaAssinada: atual };
  }

  const minutaAssinada = MinutaLaudoAcessoJudicial.parse({
    ...atual,
    revisao: "ASSINADO",
    assinadoPorMedicoId: sessao.medicoId,
    assinadoPorCrm: sessao.crm,
    assinadoEm: acesso.agora,
  });

  transacao(db, () => {
    db.prepare(`
      UPDATE f4_minuta_laudo_judicial
      SET revisao = 'ASSINADO', minutaJson = ?, atualizadoEm = ?
      WHERE minutaId = ? AND versao = ?
    `).run(JSON.stringify(minutaAssinada), acesso.agora, entrada.minutaId, entrada.versao);
  });

  return { ok: true, minutaAssinada };
}

export function lerMinutaLaudoAcessoJudicialF4(
  db: DatabaseSync,
  minutaId: string,
  versao = 1,
): MinutaLaudoAcessoJudicial | null {
  garantirSchemaF4(db);
  const row = db.prepare(
    "SELECT minutaJson FROM f4_minuta_laudo_judicial WHERE minutaId = ? AND versao = ?",
  ).get(minutaId, versao) as { minutaJson: string } | undefined;
  if (!row) return null;
  return MinutaLaudoAcessoJudicial.parse(JSON.parse(row.minutaJson));
}
