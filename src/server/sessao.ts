import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { Sessao, type Sessao as SessaoTipo } from "../contracts/base.js";

export interface GerenciadorSessao {
  login(senha: string): { token: string; sessao: SessaoTipo } | null;
  obter(token: string): SessaoTipo | null;
  registrarBundleExibido(token: string, contexto: { patientId: string; encounterId: string },
    docs: readonly { documentId: string; documentVersion: number }[]): void;
  bundleExibido(token: string, contexto: { patientId: string; encounterId: string }):
    readonly { documentId: string; documentVersion: number }[] | null;
}

/** Single-user local login. Caller supplies the secret at startup; no default credentials. */
export function criarGerenciadorSessao(config: {
  medicoId: string; crm: string; senha: string; duracaoMs: number; agora: () => string;
}): GerenciadorSessao {
  if (!config.medicoId || !config.crm || config.senha.length < 12 || config.duracaoMs <= 0)
    throw new Error("SESSAO_CONFIG_INVALIDA");
  const salt = randomBytes(16), secret = scryptSync(config.senha, salt, 32);
  const sessions = new Map<string, { sessao: SessaoTipo; bundle?: {
    contexto: { patientId: string; encounterId: string };
    docs: readonly { documentId: string; documentVersion: number }[];
  } }>();
  const obter = (token: string): SessaoTipo | null => {
    const record = sessions.get(token);
    if (!record) return null;
    if (Date.parse(record.sessao.expiraEm) <= Date.parse(config.agora())) {
      sessions.delete(token);
      return null;
    }
    return record.sessao;
  };
  return {
    login(senha) {
      const candidate = scryptSync(senha, salt, 32);
      if (!timingSafeEqual(secret, candidate)) return null;
      const emitidaEm = config.agora();
      const sessao = Sessao.parse({ medicoId: config.medicoId, crm: config.crm,
        emitidaEm, expiraEm: new Date(Date.parse(emitidaEm) + config.duracaoMs).toISOString() });
      const token = randomBytes(32).toString("hex");
      sessions.set(token, { sessao });
      return { token, sessao };
    },
    obter,
    registrarBundleExibido(token, contexto, docs) {
      if (!obter(token)) throw new Error("SESSAO_EXPIRADA");
      const record = sessions.get(token)!;
      record.bundle = { contexto: { ...contexto }, docs: docs.map((d) => ({ ...d })) };
    },
    bundleExibido(token, contexto) {
      if (!obter(token)) return null;
      const bundle = sessions.get(token)?.bundle;
      if (!bundle || bundle.contexto.patientId !== contexto.patientId
        || bundle.contexto.encounterId !== contexto.encounterId) return null;
      return bundle.docs.map((d) => ({ ...d }));
    },
  };
}
