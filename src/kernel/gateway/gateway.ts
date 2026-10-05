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
  set(chave: string, v: { payloadHash: string; resultado: ResultadoGateway }): void;
}

const HARD_FORBIDDEN: { id: string; teste: (i: Intent) => boolean }[] = [
  { id: "rede-social-paciente", teste: (i) => /rede[_\s-]?social/i.test(i.destino ?? "") && !!i.escopo.patientId },
  { id: "producao", teste: (i) => /produ(c|ç)(a|ã)o|production/i.test(i.destino ?? "") },
];

export function memoriaIdempotencia(): StoreIdempotencia {
  const m = new Map<string, { payloadHash: string; resultado: ResultadoGateway }>();
  return { get: (k) => m.get(k), set: (k, v) => void m.set(k, v) };
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

  return {
    async executar(bruto: unknown, sessao: Sessao | null): Promise<ResultadoGateway> {
      const p = ActionIntent.safeParse(bruto);
      if (!p.success) return negar("desconhecida", "NO_ACTION_INTENT_INCOMPLETO"); // ROE-0
      const intent = p.data;
      const acao = `${intent.verbo}:${intent.objeto.tipo}`;
      if (!sessao) return negar(acao, "SEM_SESSAO"); // autorização vem do servidor
      if (sessao.expiraEm <= deps.agora()) return negar(acao, "SESSAO_EXPIRADA");
      const proibido = HARD_FORBIDDEN.find((h) => h.teste(intent));
      if (proibido) return negar(acao, `HARD_FORBIDDEN:${proibido.id}`);

      const payloadHash = createHash("sha256").update(JSON.stringify(intent)).digest("hex");
      const anterior = deps.store.get(intent.idempotencyKey);
      if (anterior) {
        if (anterior.payloadHash !== payloadHash) return negar(acao, "CHAVE_REUSADA_PAYLOAD_DIFERENTE"); // N06
        return { ...anterior.resultado, decisao: anterior.resultado.decisao === "EXECUTADA" ? "REPLAY" : anterior.resultado.decisao };
      }
      const exec = deps.executores[intent.verbo];
      if (!exec) return negar(acao, "VERBO_SEM_EXECUTOR");

      const r = await exec.executar(intent);
      const resultado: ResultadoGateway = r.ok
        ? { decisao: "EXECUTADA", motivoCodigo: "OK", recibo: r.recibo }
        : r.incerto
          ? { decisao: "OUTCOME_UNKNOWN", motivoCodigo: "RESULTADO_INCERTO_SEM_REENVIO" }
          : { decisao: "FALHOU", motivoCodigo: r.erro };
      if (resultado.decisao !== "FALHOU") deps.store.set(intent.idempotencyKey, { payloadHash, resultado });
      deps.auditar({ acaoPedida: acao, decisao: "PERMITIDA", motivoCodigo: resultado.motivoCodigo, em: deps.agora() });
      return resultado;
    },
  };
}
