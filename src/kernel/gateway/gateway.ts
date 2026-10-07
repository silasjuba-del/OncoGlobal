// Action Gateway único (INV-05, ROE-0, G-19, G-20). Tudo que AGE no mundo passa aqui.
// F0: executores são portas injetadas (fake nos testes). Store de idempotência é porta (SQLite em S-F0-03).
import { createHash, randomUUID } from "node:crypto";
import type { z } from "zod";
import { ActionIntent, type Sessao } from "../../contracts/index.js";
import { g02PhiEgress, g27SaidaExternaLimpa } from "../harness/gates.js";
import type { DicionarioPaciente } from "../llm/desidentificar.js";

type Intent = z.infer<typeof ActionIntent>;

export type Verbo = Intent["verbo"];
// PROVISORIO-W10: contexto será consolidado em SanitizationReport/contrato de autorização pelo tech lead.
export interface EvidenciaSaidaExterna {
  payload: string;
  destinoCanonico: string;
  artefato: { id: string; versao: number; hash: string; tipo: string; metadados?: Record<string, unknown> | null };
  dicionarioPaciente: DicionarioPaciente;
  sanitizationReport: { riscoResidual: unknown; versaoSanitizador: unknown; payloadHash: string; destinoHash: string };
  autorizacao: {
    patientId: string; encounterId: string; artefatoId: string; versao: number; artefatoHash: string;
    payloadHash: string; destinoHash: string; vigente: true;
  };
}
export type ResultadoValidacaoSaida = { ok: true; evidencia: EvidenciaSaidaExterna }
  | { ok: false; codigo?: string };
export interface Executor {
  executar(intent: Intent, evidencia?: EvidenciaSaidaExterna): Promise<{ ok: true; recibo: string } | { ok: false; incerto: boolean; erro: string }>;
}
export interface ResultadoGateway {
  decisao: "EXECUTADA" | "REPLAY" | "NEGADA" | "OUTCOME_UNKNOWN" | "FALHOU";
  motivoCodigo: string;
  recibo?: string;
}
export interface RegistroAuditoria { acaoPedida: string; decisao: "PERMITIDA" | "NEGADA"; motivoCodigo: string; em: string }
export interface StoreIdempotencia {
  get(chave: string): { payloadHash: string; resultado: ResultadoGateway } | undefined;
  reserve(chave: string, payloadHash: string, atualizadoEm: string): {
    criada: boolean;
    registro: { payloadHash: string; resultado: ResultadoGateway };
  };
  set(chave: string, v: { payloadHash: string; resultado: ResultadoGateway }, atualizadoEm: string): void;
  delete?(chave: string): void;
}

const VERBOS_SAIDA_EXTERNA = new Set<Verbo>(["ENVIAR_WHATSAPP", "ENVIAR_EMAIL", "AGENDAR", "EXPORTAR_APAC"]);
const CODIGOS_NEGATIVA_EGRESS = new Set(["SAIDA_NAO_AUTORIZADA", "CANAL_EXTERNO_NAO_HABILITADO",
  "VALIDACAO_APAC_NAO_PERSISTIDA", "ARTEFATO_NAO_ASSINADO", "CONSENTIMENTO_AUSENTE"]);
const codigoNegativaSeguro = (codigo: unknown): string =>
  typeof codigo === "string" && CODIGOS_NEGATIVA_EGRESS.has(codigo) ? codigo : "SAIDA_NAO_AUTORIZADA";
const hashPayload = (payload: string) => createHash("sha256").update(payload, "utf8").digest("hex");
const hashDestino = (destino: string) => createHash("sha256").update(destino, "utf8").digest("hex");
function congelarProfundo<T>(value: T, vistos = new WeakSet<object>()): T {
  if (!value || typeof value !== "object" || vistos.has(value as object)) return value;
  vistos.add(value as object);
  for (const child of Object.values(value as Record<string, unknown>)) congelarProfundo(child, vistos);
  return Object.freeze(value);
}

function evidenciasSaidaPassam(intent: Intent, evidencia: EvidenciaSaidaExterna): boolean {
  if (!evidencia || typeof evidencia !== "object" || typeof evidencia.payload !== "string" || !evidencia.payload
    || typeof evidencia.destinoCanonico !== "string" || !evidencia.destinoCanonico.trim()) return false;
  const { artefato, autorizacao, sanitizationReport: report } = evidencia;
  const payloadHash = hashPayload(evidencia.payload);
  const destino = evidencia.destinoCanonico;
  if (!artefato || !autorizacao || !report || intent.escopo.patientId === null || intent.escopo.encounterId === null
    || artefato.id !== intent.objeto.id || artefato.versao !== intent.objeto.versao
    || autorizacao.vigente !== true || autorizacao.patientId !== intent.escopo.patientId
    || autorizacao.encounterId !== intent.escopo.encounterId || autorizacao.artefatoId !== artefato.id
    || autorizacao.versao !== artefato.versao || typeof artefato.hash !== "string" || !artefato.hash
    || autorizacao.artefatoHash !== artefato.hash || autorizacao.payloadHash !== payloadHash
    || report.payloadHash !== payloadHash || autorizacao.destinoHash !== hashDestino(destino)
    || report.destinoHash !== hashDestino(destino)
    || (intent.destino !== null && intent.destino !== destino)) return false;
  const g02 = g02PhiEgress(evidencia.payload, evidencia.dicionarioPaciente);
  const g27 = g27SaidaExternaLimpa({ artefato: { tipo: artefato.tipo, metadados: artefato.metadados ?? null },
    destino, sanitizationReport: report });
  return g02.decisao === "PASSA" && g27.decisao === "PASSA";
}

const HARD_FORBIDDEN: { id: string; teste: (i: Intent) => boolean }[] = [
  { id: "rede-social-paciente", teste: (i) => /rede[_\s-]?social/i.test(i.destino ?? "") && !!i.escopo.patientId },
  { id: "producao", teste: (i) => /produ(c|ç)(a|ã)o|production/i.test(i.destino ?? "") },
];

export function memoriaIdempotencia(): StoreIdempotencia {
  const m = new Map<string, { payloadHash: string; resultado: ResultadoGateway }>();
  return {
    get: (k) => m.get(k),
    reserve(k, payloadHash) {
      const anterior = m.get(k);
      if (anterior) return { criada: false, registro: anterior };
      const registro = { payloadHash, resultado: {
        decisao: "OUTCOME_UNKNOWN" as const, motivoCodigo: "RESERVADA_EM_EXECUCAO",
      } };
      m.set(k, registro);
      return { criada: true, registro };
    },
    set: (k, v) => void m.set(k, v),
    delete: (k) => void m.delete(k),
  };
}

export function criarGateway(deps: {
  executores: Partial<Record<Verbo, Executor>>;
  store: StoreIdempotencia;
  agora: () => string;
  auditar: (r: RegistroAuditoria) => void;
  /** Contexto obtido do servidor/ledger; nunca derivado de um booleano do corpo HTTP. */
  validarSaida?: (intent: Intent, sessao: Sessao) => Promise<ResultadoValidacaoSaida> | ResultadoValidacaoSaida;
}) {
  const auditarSeguro = (r: RegistroAuditoria): boolean => { try { deps.auditar(r); return true; } catch { return false; } };
  const negar = (acao: string, motivoCodigo: string): ResultadoGateway => {
    auditarSeguro({ acaoPedida: acao, decisao: "NEGADA", motivoCodigo, em: deps.agora() });
    return { decisao: "NEGADA", motivoCodigo };
  };

  // A01: chamadas concorrentes com a mesma chave compartilham UMA execução em andamento.
  const emAndamento = new Map<string, { payloadHash: string; promessa: Promise<ResultadoGateway> }>();
  const instante = (iso: string) => Date.parse(iso);
  const replay = (resultado: ResultadoGateway): ResultadoGateway => ({
    ...resultado,
    decisao: resultado.decisao === "EXECUTADA" ? "REPLAY" : resultado.decisao,
  });

  return {
    /** Entrada HTTP vincula o mesmo executor a um store persistente do ledger local. */
    withStore(store: StoreIdempotencia) {
      return criarGateway({ ...deps, store });
    },
    async executar(bruto: unknown, sessao: Sessao | null): Promise<ResultadoGateway> {
      const p = ActionIntent.safeParse(bruto);
      if (!p.success) return negar("desconhecida", "NO_ACTION_INTENT_INCOMPLETO"); // ROE-0
      const intent = p.data;
      // Não copie campos do pedido (inclusive `objeto.tipo`) para log/retorno.
      const acao = intent.verbo;
      if (!sessao) return negar(acao, "SEM_SESSAO"); // autorização vem do servidor
      // A03: compara INSTANTES (offsets diferentes), nunca strings; data inválida = expirada.
      const expira = instante(sessao.expiraEm), agoraMs = instante(deps.agora());
      if (!Number.isFinite(expira) || !Number.isFinite(agoraMs) || expira <= agoraMs) return negar(acao, "SESSAO_EXPIRADA");
      const proibido = HARD_FORBIDDEN.find((h) => h.teste(intent));
      if (proibido) return negar(acao, `HARD_FORBIDDEN:${proibido.id}`);

      let evidencia: EvidenciaSaidaExterna | undefined;
      if (VERBOS_SAIDA_EXTERNA.has(intent.verbo)) {
        if (!deps.validarSaida) return negar(acao, "SAIDA_NAO_AUTORIZADA");
        let validacao: ResultadoValidacaoSaida;
        try { validacao = await deps.validarSaida(intent, sessao); }
        catch { return negar(acao, "CONTEXTO_SAIDA_INDISPONIVEL"); }
        if (!validacao || validacao.ok !== true) {
          const codigo = validacao && validacao.ok === false ? validacao.codigo : undefined;
          return negar(acao, codigoNegativaSeguro(codigo));
        }
        try { evidencia = congelarProfundo(structuredClone(validacao.evidencia)); }
        catch { return negar(acao, "CONTEXTO_SAIDA_INDISPONIVEL"); }
        try {
          if (!evidenciasSaidaPassam(intent, evidencia)) return negar(acao, "GATES_SAIDA_NAO_PASSARAM");
        } catch { return negar(acao, "GATES_SAIDA_NAO_PASSARAM"); }
      }

      // Hash de conteúdo validado integra a chave idempotente; mudança de payload/destino nunca reaproveita autorização anterior.
      const payloadHash = createHash("sha256").update(JSON.stringify(evidencia
        ? { intent, payloadHash: evidencia.sanitizationReport.payloadHash, destino: evidencia.destinoCanonico }
        : intent)).digest("hex");
      const chave = intent.idempotencyKey;
      const andamento = emAndamento.get(chave);
      if (andamento) {
        if (andamento.payloadHash !== payloadHash) return negar(acao, "CHAVE_REUSADA_PAYLOAD_DIFERENTE");
        const r = await andamento.promessa;
        return replay(r);
      }
      const anterior = deps.store.get(chave);
      if (anterior) {
        if (anterior.payloadHash !== payloadHash) return negar(acao, "CHAVE_REUSADA_PAYLOAD_DIFERENTE"); // N06
        return replay(anterior.resultado);
      }
      const exec = deps.executores[intent.verbo];
      if (!exec) return negar(acao, "VERBO_SEM_EXECUTOR");

      // A02: a reserva é gravada ANTES do efeito. Se o processo cair ou o executor lançar,
      // o resultado fica OUTCOME_UNKNOWN e a mesma chave nunca reenvia às cegas.
      const reserva = deps.store.reserve(chave, payloadHash, deps.agora());
      if (!reserva.criada) {
        if (reserva.registro.payloadHash !== payloadHash) return negar(acao, "CHAVE_REUSADA_PAYLOAD_DIFERENTE");
        return replay(reserva.registro.resultado);
      }
      if (evidencia && !auditarSeguro({ acaoPedida: acao, decisao: "PERMITIDA", motivoCodigo: "OK", em: deps.agora() })) {
        deps.store.delete?.(chave);
        return negar(acao, "AUDITORIA_INDISPONIVEL");
      }
      const promessa = (async (): Promise<ResultadoGateway> => {
        let resultado: ResultadoGateway;
        try {
          const r = await exec.executar(intent, evidencia);
          resultado = r.ok
            ? { decisao: "EXECUTADA", motivoCodigo: "OK", recibo: evidencia ? `saida-${randomUUID()}` : r.recibo }
            : r.incerto
              ? { decisao: "OUTCOME_UNKNOWN", motivoCodigo: "RESULTADO_INCERTO_SEM_REENVIO" }
              : { decisao: "FALHOU", motivoCodigo: "FALHA_EXECUTOR" };
        } catch {
          resultado = { decisao: "OUTCOME_UNKNOWN", motivoCodigo: "EXCECAO_NO_EXECUTOR_SEM_REENVIO" };
        }
        // FALHOU = falha certa sem efeito: libera a chave para nova tentativa explícita.
        if (resultado.decisao === "FALHOU") deps.store.delete?.(chave);
        else deps.store.set(chave, { payloadHash, resultado }, deps.agora());
        if (!evidencia) auditarSeguro({ acaoPedida: acao, decisao: "PERMITIDA", motivoCodigo: resultado.motivoCodigo, em: deps.agora() });
        return resultado;
      })();
      emAndamento.set(chave, { payloadHash, promessa });
      try { return await promessa; } finally { emAndamento.delete(chave); }
    },
  };
}
