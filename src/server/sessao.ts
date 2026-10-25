import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { Instante, Sessao, type Sessao as SessaoTipo } from "../contracts/base.js";
import { hashCanonico } from "../modules/tipos.js";

/** Documento exibido = id + versão + hash do CONTEÚDO exato mostrado ao médico (A13). */
export interface DocumentoExibido { documentId: string; documentVersion: number; conteudoHash: string; draftId?: string }
/** Contexto de consulta: lote sempre explícito (string ou null); ausência não é curinga nem vira null. */
type ContextoExibicao = { patientId: string; encounterId: string; tumorLotId: string | null };

/** Único canon SHA-256 do módulo, mantendo a API pública do servidor. */
export function hashConteudoExibido(conteudo: unknown): string {
  return hashCanonico(conteudo);
}

export interface GerenciadorSessao {
  registrarConteudoExibido?(token:string,contexto:ContextoExibicao,finalidade:string,recursoId:string,conteudoHash:string):void;
  conteudoFoiExibido?(token:string,contexto:ContextoExibicao,finalidade:string,recursoId:string,conteudoHash:string):boolean;
  registrarAlertasExibidos?(token: string, contexto: ContextoExibicao, ids: readonly string[]): void;
  alertasExibidos?(token: string, contexto: ContextoExibicao): readonly string[];
  bloqueadoPorTentativas?(): boolean;
  login(senha: string): { token: string; sessao: SessaoTipo } | null;
  obter(token: string): SessaoTipo | null;
  registrarBundleExibido(token: string, contexto: ContextoExibicao,
    docs: readonly DocumentoExibido[]): void;
  bundleExibido(token: string, contexto: ContextoExibicao):
    readonly DocumentoExibido[] | null;
  selecionarConsulta(token: string, contexto: ContextoExibicao | null): void;
  consultaSelecionada(token: string): ContextoExibicao | null;
}

/** Single-user local login. Caller supplies the secret at startup; no default credentials. */
export function criarGerenciadorSessao(config: {
  medicoId: string; crm: string; senha: string; duracaoMs: number; agora: () => string;
  maxTentativasJanela?: number; janelaTentativasMs?: number;
}): GerenciadorSessao {
  const maxTentativas = config.maxTentativasJanela ?? 5;
  const janelaTentativasMs = config.janelaTentativasMs ?? 60_000;
  if (!config.medicoId || !config.crm || config.senha.length < 12 || !Number.isFinite(config.duracaoMs) || config.duracaoMs <= 0
    || !Number.isInteger(maxTentativas) || maxTentativas < 1
    || !Number.isFinite(janelaTentativasMs) || janelaTentativasMs <= 0)
    throw new Error("SESSAO_CONFIG_INVALIDA");
  const salt = randomBytes(16), secret = scryptSync(config.senha, salt, 32);
  const falhasRecentes: number[] = [];
  const podarFalhas = (agoraMs: number) => {
    while (falhasRecentes.length > 0 && (agoraMs - falhasRecentes[0]! >= janelaTentativasMs || agoraMs < falhasRecentes[0]!)) {
      falhasRecentes.shift();
    }
  };
  const bloqueadoEm = (agoraMs: number): boolean => {
    if (!Number.isFinite(agoraMs)) return true;
    podarFalhas(agoraMs);
    return falhasRecentes.length >= maxTentativas;
  };
  const bloqueadoPorTentativas = (): boolean => {
    const agora=config.agora();
    return !Instante.safeParse(agora).success || bloqueadoEm(Date.parse(agora));
  };
  const sessions = new Map<string, { sessao: SessaoTipo; exibicoes?:Map<string,string>; alertas?: {contexto:ContextoExibicao;ids:readonly string[]}; bundle?: {
    contexto: ContextoExibicao;
    docs: readonly DocumentoExibido[];
  }; consulta?: ContextoExibicao }>();
  const obter = (token: string): SessaoTipo | null => {
    const record = sessions.get(token);
    if (!record) return null;
    const agora=config.agora(), instante=Date.parse(agora);
    if (!Instante.safeParse(agora).success || !Number.isFinite(instante)
      || !Sessao.safeParse(record.sessao).success
      || Date.parse(record.sessao.expiraEm)<=Date.parse(record.sessao.emitidaEm)
      || Date.parse(record.sessao.emitidaEm)>instante) return null;
    if (Date.parse(record.sessao.expiraEm) <= instante) {
      sessions.delete(token);
      return null;
    }
    return record.sessao;
  };
  return {
    bloqueadoPorTentativas,
    login(senha) {
      const emitidaEm=config.agora(),agoraMs=Date.parse(emitidaEm);
      if (!Instante.safeParse(emitidaEm).success || bloqueadoEm(agoraMs)) return null;
      if (typeof senha !== "string" || senha.length === 0 || senha.length > 512) {
        if (Number.isFinite(agoraMs)) falhasRecentes.push(agoraMs);
        return null;
      }
      const candidate = scryptSync(senha, salt, 32);
      if (!timingSafeEqual(secret, candidate)) {
        if (Number.isFinite(agoraMs)) falhasRecentes.push(agoraMs);
        return null;
      }
      falhasRecentes.length = 0;
      const expiracao=new Date(agoraMs+config.duracaoMs);
      if (!Number.isFinite(expiracao.getTime()) || expiracao.getTime()<=agoraMs) return null;
      const sessao = Sessao.parse({ medicoId: config.medicoId, crm: config.crm,
        emitidaEm, expiraEm: expiracao.toISOString() });
      const token = randomBytes(32).toString("hex");
      sessions.set(token, { sessao });
      return { token, sessao };
    },
    obter,
    registrarConteudoExibido(token,contexto,finalidade,recursoId,conteudoHash){
      if(!obter(token))throw Error("SESSAO_EXPIRADA");
      if(!/^[a-f0-9]{64}$/.test(conteudoHash))throw Error("HASH_EXIBIDO_INVALIDO");
      const record=sessions.get(token)!,map=record.exibicoes??=new Map<string,string>();
      const chave=JSON.stringify([contexto.patientId,contexto.encounterId,contexto.tumorLotId,finalidade,recursoId]);
      map.delete(chave);map.set(chave,conteudoHash);
      if(map.size>128)map.delete(map.keys().next().value!);
    },
    conteudoFoiExibido(token,contexto,finalidade,recursoId,conteudoHash){
      if(!obter(token))return false;
      return sessions.get(token)?.exibicoes?.get(JSON.stringify([contexto.patientId,contexto.encounterId,contexto.tumorLotId,finalidade,recursoId]))===conteudoHash;
    },
    registrarAlertasExibidos(token,contexto,ids){if(!obter(token))throw Error("SESSAO_EXPIRADA");sessions.get(token)!.alertas={contexto:{...contexto},ids:[...ids]};},
    alertasExibidos(token,contexto){if(!obter(token))return [];const a=sessions.get(token)?.alertas;
      return a && a.contexto.patientId===contexto.patientId && a.contexto.encounterId===contexto.encounterId
        && a.contexto.tumorLotId===contexto.tumorLotId ? [...a.ids] : [];},
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
        || bundle.contexto.tumorLotId !== contexto.tumorLotId) return null;
      return bundle.docs.map((d) => ({ ...d }));
    },
    selecionarConsulta(token, contexto) {
      if (!obter(token)) throw new Error("SESSAO_EXPIRADA");
      const record = sessions.get(token)!;
      if (record.consulta?.patientId !== contexto?.patientId
        || record.consulta?.encounterId !== contexto?.encounterId
        || (record.consulta?.tumorLotId ?? null) !== (contexto?.tumorLotId ?? null)) { delete record.bundle; delete record.alertas; delete record.exibicoes; }
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
