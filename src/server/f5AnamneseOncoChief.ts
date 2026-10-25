// F5 · Persistência de anamnese guiada, integração de voz com consentimento e expurgo do áudio bruto (A5/Q16),
// e revisão cruzada OncoChief sob demanda (ORK-2) reutilizando criarOncoboard sem serviço/memória paralela.
import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { Instante, Sessao } from "../contracts/base.js";
import {
  RegistroVozAnamneseCanal,
  ResultadoRevisaoCruzadaOncoChief,
  ResumoEstruturadoAnamnese,
  type RespostaPassoAnamnese,
  type RoteiroAnamneseTumor,
} from "../contracts/f5/anamneseEOncoChief.js";
import { g23ComandoDeepgram } from "../kernel/harness/gates.js";
import { transacao } from "../kernel/ledger/db.js";
import {
  criarOncoboard,
  type ContextoOncoboard,
  type FonteOncoboard,
  type LlmAdapter,
  type PersonaOncoboard,
} from "../kernel/llm/oncoboard.js";
import {
  admitirRoteiroAnamneseAprovado,
  compilarResumoEstruturadoAnamnese,
} from "../modules/canal/anamneseGuiada.js";
import { consultarConsentimentoCanal } from "./canalEntrada.js";
import type { GerenciadorSessao } from "./sessao.js";

export type AcessoF5 = { sessoes: GerenciadorSessao; token: string; agora: string };

function obterSessaoValida(acesso: AcessoF5): Sessao | null {
  const s = Sessao.safeParse(acesso.sessoes.obter(acesso.token));
  if (!s.success || !Instante.safeParse(acesso.agora).success) return null;
  return Date.parse(s.data.expiraEm) > Date.parse(acesso.agora) ? s.data : null;
}

export function garantirSchemaF5(db: DatabaseSync): void {
  if (!db.isTransaction) {
    db.exec("PRAGMA foreign_keys = ON; PRAGMA synchronous = FULL;");
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS f5_anamnese_resumo (
      sessaoAnamneseId TEXT PRIMARY KEY,
      patientId TEXT NOT NULL,
      contatoId TEXT NOT NULL,
      roteiroId TEXT NOT NULL,
      resumoJson TEXT NOT NULL,
      geradoEm TEXT NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS f5_anamnese_resumo_no_update BEFORE UPDATE ON f5_anamnese_resumo
      BEGIN SELECT RAISE(ABORT, 'f5_anamnese_resumo append-only'); END;
    CREATE TRIGGER IF NOT EXISTS f5_anamnese_resumo_no_delete BEFORE DELETE ON f5_anamnese_resumo
      BEGIN SELECT RAISE(ABORT, 'f5_anamnese_resumo append-only'); END;

    CREATE TABLE IF NOT EXISTS f5_voz_anamnese (
      vozId TEXT PRIMARY KEY,
      sessaoAnamneseId TEXT NOT NULL,
      patientId TEXT NOT NULL,
      contatoId TEXT NOT NULL,
      registroVozJson TEXT NOT NULL,
      apagadoEm TEXT NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS f5_voz_anamnese_no_update BEFORE UPDATE ON f5_voz_anamnese
      BEGIN SELECT RAISE(ABORT, 'f5_voz_anamnese append-only'); END;
    CREATE TRIGGER IF NOT EXISTS f5_voz_anamnese_no_delete BEFORE DELETE ON f5_voz_anamnese
      BEGIN SELECT RAISE(ABORT, 'f5_voz_anamnese append-only'); END;
  `);
}

/**
 * Executa e persiste o resumo estruturado de uma anamnese guiada (F5):
 * - Exige roteiro `CONFERIDA_MEDICO`;
 * - Exige consentimento `TERMO_ACEITO` do contato no canal;
 * - Mantém o resumo como `REVISAR` (`avaliacaoMedicaConcluida: false`).
 */
export function registrarResumoAnamneseGuiadaF5(
  db: DatabaseSync,
  acesso: AcessoF5,
  entrada: {
    sessaoAnamneseId: string;
    patientId: string;
    contatoId: string;
    roteiroCandidato: unknown;
    respostas: readonly RespostaPassoAnamnese[];
    alertasRedFlag?: readonly string[];
  },
):
  | { ok: false; codigo: "SESSAO_INVALIDA" | "ROTEIRO_INVALIDO" | "ROTEIRO_EM_RASCUNHO_NAO_AUTORIZADO" | "CONSENTIMENTO_CANAL_AUSENTE_OU_REVOGADO" | "IDENTIDADE_OU_CONTEXTO_CONFLITANTE" }
  | { ok: true; resumo: ResumoEstruturadoAnamnese } {
  if (!obterSessaoValida(acesso)) return { ok: false, codigo: "SESSAO_INVALIDA" };
  garantirSchemaF5(db);

  const admitido = admitirRoteiroAnamneseAprovado(entrada.roteiroCandidato);
  if (!admitido.ok) return admitido;

  const consentimento = consultarConsentimentoCanal(db, entrada.contatoId);
  if (consentimento.estado !== "TERMO_ACEITO"
    || consentimento.patientId !== entrada.patientId
    || !consentimento.finalidade.includes("COMUNICACAO_CLINICA")) {
    return { ok: false, codigo: "CONSENTIMENTO_CANAL_AUSENTE_OU_REVOGADO" };
  }

  const resumo = compilarResumoEstruturadoAnamnese({
    sessaoAnamneseId: entrada.sessaoAnamneseId,
    patientId: entrada.patientId,
    contatoId: entrada.contatoId,
    roteiro: admitido.roteiro,
    respostas: entrada.respostas,
    ...(entrada.alertasRedFlag ? { alertasRedFlag: entrada.alertasRedFlag } : {}),
    geradoEm: acesso.agora,
  });

  return transacao(db, () => {
    db.prepare(`
      INSERT INTO f5_anamnese_resumo (sessaoAnamneseId, patientId, contatoId, roteiroId, resumoJson, geradoEm)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(sessaoAnamneseId) DO NOTHING
    `).run(
      resumo.sessaoAnamneseId,
      resumo.patientId,
      resumo.contatoId,
      resumo.roteiroId,
      JSON.stringify(resumo),
      resumo.geradoEm,
    );
    const persistido = lerResumoAnamneseGuiadaF5(db, resumo.sessaoAnamneseId)!;
    if (persistido.patientId !== resumo.patientId
      || persistido.contatoId !== resumo.contatoId
      || persistido.roteiroId !== resumo.roteiroId
      || persistido.roteiroVersao !== resumo.roteiroVersao
      || persistido.tumorPackId !== resumo.tumorPackId) {
      return { ok: false, codigo: "IDENTIDADE_OU_CONTEXTO_CONFLITANTE" };
    }
    return { ok: true, resumo: persistido };
  });
}

export function lerResumoAnamneseGuiadaF5(
  db: DatabaseSync,
  sessaoAnamneseId: string,
): ResumoEstruturadoAnamnese | null {
  garantirSchemaF5(db);
  const row = db.prepare(
    "SELECT resumoJson FROM f5_anamnese_resumo WHERE sessaoAnamneseId = ?",
  ).get(sessaoAnamneseId) as { resumoJson: string } | undefined;
  if (!row) return null;
  return ResumoEstruturadoAnamnese.parse(JSON.parse(row.resumoJson));
}

/**
 * Integração de voz na F5 conforme tecnologia, consentimento e política autorizados (Q16 / A5 / G-23):
 * - Exige consentimento vigente (`TERMO_ACEITO`);
 * - Se usar `DEEPGRAM_COMANDO_CURTO`, aplica o gate `G-23` (`g23ComandoDeepgram`: duração ≤ limiteSeg);
 * - Apaga (zera) o buffer de áudio bruto após a transcrição validada e guarda apenas o texto + `audioSha256Original`.
 */
export function processarVozAnamneseComExpurgoAudioF5(
  db: DatabaseSync,
  acesso: AcessoF5,
  entrada: {
    vozId?: string;
    sessaoAnamneseId: string;
    patientId: string;
    contatoId: string;
    tecnologia: "TRANSCRICAO_LOCAL" | "DEEPGRAM_COMANDO_CURTO";
    duracaoSegundos: number;
    limiteComandoCurtoSegundos?: number;
    audioBufferTemporario: Uint8Array;
    transcricaoValidadaPeloMedico: string;
  },
):
  | {
    ok: false;
    codigo:
      | "SESSAO_INVALIDA"
      | "CONSENTIMENTO_VOZ_AUSENTE_OU_REVOGADO"
      | "G23_AUDIO_LONGO_BLOQUEADO_PARA_DEEPGRAM"
      | "TRANSCRICAO_NAO_VALIDADA"
      | "IDENTIDADE_OU_CONTEXTO_CONFLITANTE";
  }
  | { ok: true; registroVoz: RegistroVozAnamneseCanal } {
  if (!obterSessaoValida(acesso)) return { ok: false, codigo: "SESSAO_INVALIDA" };
  garantirSchemaF5(db);

  const consentimento = consultarConsentimentoCanal(db, entrada.contatoId);
  if (consentimento.estado !== "TERMO_ACEITO" || !consentimento.referenciaTermo
    || consentimento.patientId !== entrada.patientId
    || !consentimento.finalidade.includes("COMUNICACAO_CLINICA")) {
    return { ok: false, codigo: "CONSENTIMENTO_VOZ_AUSENTE_OU_REVOGADO" };
  }

  if (entrada.tecnologia === "DEEPGRAM_COMANDO_CURTO") {
    const vereditoG23 = g23ComandoDeepgram(entrada.duracaoSegundos, entrada.limiteComandoCurtoSegundos ?? 15);
    if (vereditoG23.decisao !== "PASSA") {
      return { ok: false, codigo: "G23_AUDIO_LONGO_BLOQUEADO_PARA_DEEPGRAM" };
    }
  }

  const texto = entrada.transcricaoValidadaPeloMedico.trim();
  if (!texto || entrada.audioBufferTemporario.byteLength === 0) {
    entrada.audioBufferTemporario.fill(0);
    return { ok: false, codigo: "TRANSCRICAO_NAO_VALIDADA" };
  }

  const audioSha256Original = createHash("sha256").update(entrada.audioBufferTemporario).digest("hex");
  // Expurgo imediato dos bytes de áudio em memória após calcular o hash e validar a transcrição (A5 / Q16)
  entrada.audioBufferTemporario.fill(0);

  const registroVoz = RegistroVozAnamneseCanal.parse({
    vozId: entrada.vozId ?? `voz-${randomUUID()}`,
    sessaoAnamneseId: entrada.sessaoAnamneseId,
    patientId: entrada.patientId,
    contatoId: entrada.contatoId,
    consentimentoVigenteRef: consentimento.referenciaTermo,
    tecnologia: entrada.tecnologia,
    duracaoSegundos: entrada.duracaoSegundos,
    audioSha256Original,
    transcricaoValidada: texto,
    audioBrutoApagado: true,
    apagadoEm: acesso.agora,
  });

  return transacao(db, () => {
    db.prepare(`
      INSERT INTO f5_voz_anamnese (vozId, sessaoAnamneseId, patientId, contatoId, registroVozJson, apagadoEm)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(vozId) DO NOTHING
    `).run(
      registroVoz.vozId,
      registroVoz.sessaoAnamneseId,
      registroVoz.patientId,
      registroVoz.contatoId,
      JSON.stringify(registroVoz),
      registroVoz.apagadoEm,
    );
    const row = db.prepare("SELECT registroVozJson FROM f5_voz_anamnese WHERE vozId = ?")
      .get(registroVoz.vozId) as { registroVozJson: string };
    const persistido = RegistroVozAnamneseCanal.parse(JSON.parse(row.registroVozJson));
    if (persistido.patientId !== registroVoz.patientId
      || persistido.contatoId !== registroVoz.contatoId
      || persistido.sessaoAnamneseId !== registroVoz.sessaoAnamneseId
      || persistido.tecnologia !== registroVoz.tecnologia
      || persistido.consentimentoVigenteRef !== registroVoz.consentimentoVigenteRef) {
      return { ok: false, codigo: "IDENTIDADE_OU_CONTEXTO_CONFLITANTE" };
    }
    return { ok: true, registroVoz: persistido };
  });
}

/**
 * OncoChief (F5 / ORK-2) · Modo de revisão cruzada sob demanda sobre o `criarOncoboard` existente:
 * - Não cria serviço paralelo nem memória paralela (`servicoParaleloCriado: false`, `memoriaParalelaCriada: false`);
 * - Aplica assimetria A9: se houver qualquer reprovação determinística do código, o veredito final é `BLOQUEADO_POR_CODIGO`,
 *   mesmo que o LLM retorne parecer favorável.
 */
export async function executarRevisaoCruzadaOncoChiefF5(entrada: {
  revisaoId?: string;
  patientRef: string;
  pergunta: string;
  personas: readonly PersonaOncoboard[];
  fontes: readonly FonteOncoboard[];
  contexto?: ContextoOncoboard;
  reprovacoesDeterministicasCodigo?: readonly string[];
  adapter: LlmAdapter | null;
  agora: string;
}): Promise<ResultadoRevisaoCruzadaOncoChief> {
  const board = criarOncoboard({ adapter: entrada.adapter });
  const pareceresPorPersona: ResultadoRevisaoCruzadaOncoChief["pareceresPorPersona"] = [];

  for (const persona of entrada.personas) {
    const rascunho = await board.responder({
      patientRef: entrada.patientRef,
      persona,
      pergunta: entrada.pergunta,
      fontes: entrada.fontes,
      ...(entrada.contexto ? { contexto: entrada.contexto } : {}),
    });
    pareceresPorPersona.push({
      persona: rascunho.persona,
      resposta: rascunho.resposta,
      perguntas: rascunho.perguntas,
      lacunas: rascunho.lacunas,
      divergencias: rascunho.divergencias,
      citacoes: rascunho.citacoes,
    });
  }

  const reprovacoes = [...(entrada.reprovacoesDeterministicasCodigo ?? ['VERIFICACAO_DETERMINISTICA_NAO_EXECUTADA'])];
  const vereditoFinalCodigoPrevalece = reprovacoes.length > 0
    ? "BLOQUEADO_POR_CODIGO"
    : "APROVADO_PARA_REVISAO_MEDICA";

  return ResultadoRevisaoCruzadaOncoChief.parse({
    schema: "ResultadoRevisaoCruzadaOncoChief@1",
    revisaoId: entrada.revisaoId ?? `oncochief-${randomUUID()}`,
    patientRef: entrada.patientRef,
    personasConsultadas: [...entrada.personas],
    pareceresPorPersona,
    reprovacoesDeterministicasCodigo: reprovacoes,
    vereditoFinalCodigoPrevalece,
    memoriaParalelaCriada: false,
    servicoParaleloCriado: false,
    tipo: "RASCUNHO_REVISAO_CRUZADA",
    geradoEm: entrada.agora,
  });
}
