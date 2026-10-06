// Action Gateway único (INV-05, ROE-0, G-19, G-20). Tudo que AGE no mundo passa aqui.
// F0: executores são portas injetadas (fake nos testes). Store de idempotência é porta (SQLite em S-F0-03).
import { createHash } from "node:crypto";
import type { z } from "zod";
import { ActionIntent, type Sessao } from "../../contracts/index.js";

type Intent = z.infer<typeof ActionIntent>;

export type Verbo = Intent["verbo"];
export interface Executor { executar(intent: Intent): Promise<{ ok: true; recibo: string } | { ok: false; incerto: boolean; erro: string }> }
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
}) {
  const negar = (acao: string, motivoCodigo: string): ResultadoGateway => {
    deps.auditar({ acaoPedida: acao, decisao: "NEGADA", motivoCodigo, em: deps.agora() });
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
      const acao = `${intent.verbo}:${intent.objeto.tipo}`;
      if (!sessao) return negar(acao, "SEM_SESSAO"); // autorização vem do servidor
      // A03: compara INSTANTES (offsets diferentes), nunca strings; data inválida = expirada.
      const expira = instante(sessao.expiraEm), agoraMs = instante(deps.agora());
      if (!Number.isFinite(expira) || !Number.isFinite(agoraMs) || expira <= agoraMs) return negar(acao, "SESSAO_EXPIRADA");
      const proibido = HARD_FORBIDDEN.find((h) => h.teste(intent));
      if (proibido) return negar(acao, `HARD_FORBIDDEN:${proibido.id}`);

      const payloadHash = createHash("sha256").update(JSON.stringify(intent)).digest("hex");
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
      const promessa = (async (): Promise<ResultadoGateway> => {
        let resultado: ResultadoGateway;
        try {
          const r = await exec.executar(intent);
          resultado = r.ok
            ? { decisao: "EXECUTADA", motivoCodigo: "OK", recibo: r.recibo }
            : r.incerto
              ? { decisao: "OUTCOME_UNKNOWN", motivoCodigo: "RESULTADO_INCERTO_SEM_REENVIO" }
              : { decisao: "FALHOU", motivoCodigo: r.erro };
        } catch {
          resultado = { decisao: "OUTCOME_UNKNOWN", motivoCodigo: "EXCECAO_NO_EXECUTOR_SEM_REENVIO" };
        }
        // FALHOU = falha certa sem efeito: libera a chave para nova tentativa explícita.
        if (resultado.decisao === "FALHOU") deps.store.delete?.(chave);
        else deps.store.set(chave, { payloadHash, resultado }, deps.agora());
        deps.auditar({ acaoPedida: acao, decisao: "PERMITIDA", motivoCodigo: resultado.motivoCodigo, em: deps.agora() });
        return resultado;
      })();
      emAndamento.set(chave, { payloadHash, promessa });
      try { return await promessa; } finally { emAndamento.delete(chave); }
    },
  };
}
