import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { Sessao, type Sessao as SessaoTipo } from "../contracts/base.js";
import { hashCanonico } from "../modules/tipos.js";

/** Documento exibido = id + versão + hash do CONTEÚDO exato mostrado ao médico (A13). */
export interface DocumentoExibido { documentId: string; documentVersion: number; conteudoHash: string; draftId?: string }
type ContextoExibicao = { patientId: string; encounterId: string; tumorLotId?: string | null };

/** Único canon SHA-256 do módulo, mantendo a API pública do servidor. */
export function hashConteudoExibido(conteudo: unknown): string {
  return hashCanonico(conteudo);
}

export interface GerenciadorSessao {
  login(senha: string): { token: string; sessao: SessaoTipo } | null;
  obter(token: string): SessaoTipo | null;
  registrarBundleExibido(token: string, contexto: ContextoExibicao,
    docs: readonly DocumentoExibido[]): void;
  bundleExibido(token: string, contexto: ContextoExibicao):
    readonly DocumentoExibido[] | null;
  selecionarConsulta(token: string, contexto: { patientId: string; encounterId: string; tumorLotId?: string | null } | null): void;
  consultaSelecionada(token: string): { patientId: string; encounterId: string; tumorLotId?: string | null } | null;
}

/** Single-user local login. Caller supplies the secret at startup; no default credentials. */
export function criarGerenciadorSessao(config: {
  medicoId: string; crm: string; senha: string; duracaoMs: number; agora: () => string;
}): GerenciadorSessao {
  if (!config.medicoId || !config.crm || config.senha.length < 12 || config.duracaoMs <= 0)
    throw new Error("SESSAO_CONFIG_INVALIDA");
  const salt = randomBytes(16), secret = scryptSync(config.senha, salt, 32);
  const sessions = new Map<string, { sessao: SessaoTipo; bundle?: {
    contexto: ContextoExibicao;
    docs: readonly DocumentoExibido[];
  }; consulta?: { patientId: string; encounterId: string; tumorLotId?: string | null } }>();
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
      if (docs.some((d) => !/^[0-9a-f]{64}$/.test(d.conteudoHash))) throw new Error("HASH_EXIBIDO_INVALIDO");
      const record = sessions.get(token)!;
      record.bundle = { contexto: { ...contexto }, docs: docs.map((d) => ({ ...d })) };
    },
    bundleExibido(token, contexto) {
      if (!obter(token)) return null;
      const bundle = sessions.get(token)?.bundle;
      if (!bundle || bundle.contexto.patientId !== contexto.patientId
        || bundle.contexto.encounterId !== contexto.encounterId
        || (contexto.tumorLotId !== undefined
          && (bundle.contexto.tumorLotId ?? null) !== contexto.tumorLotId)) return null;
      return bundle.docs.map((d) => ({ ...d }));
    },
    selecionarConsulta(token, contexto) {
      if (!obter(token)) throw new Error("SESSAO_EXPIRADA");
      const record = sessions.get(token)!;
      if (record.consulta?.patientId !== contexto?.patientId
        || record.consulta?.encounterId !== contexto?.encounterId
        || (record.consulta?.tumorLotId ?? null) !== (contexto?.tumorLotId ?? null)) delete record.bundle;
      if (contexto === null) delete record.consulta;
      else record.consulta = { ...contexto };
    },
    consultaSelecionada(token) {
      if (!obter(token)) return null;
      const contexto = sessions.get(token)?.consulta;
      return contexto ? { ...contexto } : null;
    },
  };
}
