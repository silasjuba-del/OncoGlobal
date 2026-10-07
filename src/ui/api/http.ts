import { ActionIntent, ConfirmarBloco } from "../../contracts/operacao.js";
import { EstadoOncoassist, FontesOncoassist, RespostaOncoassist } from "./oncoassist.js";
import { FonteRevisao, RevisaoPreparada } from "./revisaoExtracao.js";
import {
  ErroPorta,
  type AcaoIntent,
  type PortaConsulta,
  type ResultadoAcao,
  type ResultadoConfirmar,
  type ResultadoLogin,
} from "./porta.js";

export interface OpcoesHttp {
  onSessaoExpirada: () => void;
}

interface RespostaBruta {
  status: number;
  json: unknown;
}

function codigoDe(json: unknown, fallback: string): string {
  if (json && typeof json === "object" && "codigo" in json && typeof json.codigo === "string") return json.codigo;
  if (json && typeof json === "object" && "motivoCodigo" in json && typeof json.motivoCodigo === "string") {
    return json.motivoCodigo;
  }
  return fallback;
}

function decisaoDe(json: unknown): string | null {
  if (json && typeof json === "object" && "decisao" in json && typeof json.decisao === "string") return json.decisao;
  return null;
}

/** Cliente local. Caminhos relativos, Bearer no header, sem cookie e sem token na URL. */
export function criarPortaHttp(opcoes: OpcoesHttp): PortaConsulta {
  let token: string | null = null;

  async function enviar(caminho: string, corpo: unknown, autenticar: boolean, signal?: AbortSignal): Promise<RespostaBruta> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    if (autenticar && token) headers.Authorization = `Bearer ${token}`;
    const resposta = await fetch(caminho, {
      method: "POST",
      headers,
      body: JSON.stringify(corpo),
      credentials: "omit",
      ...(signal ? { signal } : {}),
    });
    let json: unknown = null;
    try {
      json = await resposta.json();
    } catch {
      json = null;
    }
    if (resposta.status === 401 && autenticar) {
      opcoes.onSessaoExpirada();
      throw new ErroPorta("SESSAO_EXPIRADA");
    }
    if (resposta.status === 404) throw new ErroPorta("SERVIDOR_PENDENTE");
    return { status: resposta.status, json };
  }

  return {
    async carregarFonteRevisao(draftId, signal) {
      const { status, json } = await enviar("/consulta/rascunho", { draftId }, true, signal);
      const parsed = FonteRevisao.safeParse(json);
      if (status !== 200 || !parsed.success) throw new ErroPorta("PAYLOAD_INVALIDO");
      return parsed.data;
    },
    async prepararRevisaoExtracao(pedido, signal) {
      const { status, json } = await enviar("/consulta/rascunho/preparar-revisao", pedido, true, signal);
      const parsed = RevisaoPreparada.safeParse(json);
      if (status !== 200 || !parsed.success) throw new ErroPorta("PAYLOAD_INVALIDO");
      return parsed.data;
    },
    async confirmarRevisaoExtracao(pedido, signal) {
      const { status, json } = await enviar("/consulta/rascunho/revisar", pedido, true, signal);
      const codigo = codigoDe(json, "PAYLOAD_INVALIDO");
      if (status !== 200 || (codigo !== "GRAVADA" && codigo !== "REPLAY")) throw new ErroPorta("PAYLOAD_INVALIDO");
      return { codigo };
    },
    async oncoassistStatus(signal) {
      const { status, json } = await enviar("/consulta/oncoassist/status", {}, true, signal);
      const result = EstadoOncoassist.safeParse(json);
      if (status !== 200 || !result.success) throw new ErroPorta("PAYLOAD_INVALIDO");
      return result.data;
    },
    async oncoassistFontes(contexto, signal) {
      const { status, json } = await enviar("/consulta/oncoassist/fontes", contexto, true, signal);
      const result = FontesOncoassist.safeParse(json);
      if (status !== 200 || !result.success) throw new ErroPorta("PAYLOAD_INVALIDO");
      return result.data;
    },
    async oncoassistClassificar(pedido, signal) {
      const { status, json } = await enviar("/consulta/oncoassist/classificar-fonte", pedido, true, signal);
      const codigo = codigoDe(json, "PAYLOAD_INVALIDO");
      if (codigo === "FONTE_ALTERADA" || codigo === "CONTEXTO_CONSULTA_ALTERADO") throw new ErroPorta(codigo);
      const result = RespostaOncoassist.safeParse(json);
      if (status !== 200 || !result.success) throw new ErroPorta("PAYLOAD_INVALIDO");
      return result.data;
    },
    async login(senha: string): Promise<ResultadoLogin> {
      const { status, json } = await enviar("/login", { senha }, false);
      if (status === 200 && json && typeof json === "object" && "token" in json && typeof json.token === "string") {
        token = json.token;
        const expiraEm = "expiraEm" in json && typeof json.expiraEm === "string" ? json.expiraEm : null;
        return { ok: true, expiraEm };
      }
      return { ok: false, expiraEm: null };
    },

    async confirmar(bloco: ConfirmarBloco): Promise<ResultadoConfirmar> {
      const parsed = ConfirmarBloco.safeParse(bloco);
      if (!parsed.success) throw new ErroPorta("PAYLOAD_INVALIDO");
      const { json } = await enviar("/consulta/confirmar", parsed.data, true);
      return { codigo: codigoDe(json, "CONFIRMADO"), resultRef: refDe(json) };
    },

    async acao(intent: AcaoIntent): Promise<ResultadoAcao> {
      const parsed = ActionIntent.safeParse(intent);
      if (!parsed.success) throw new ErroPorta("PAYLOAD_INVALIDO");
      const { json } = await enviar("/acao", parsed.data, true);
      return { codigo: codigoDe(json, "OK"), decisao: decisaoDe(json) };
    },

    // [SERVIDOR_PENDENTE] POST /consulta/bundle
    async exibirBundle(pedido) {
      const { json } = await enviar("/consulta/bundle", pedido, true);
      return json as Awaited<ReturnType<PortaConsulta["exibirBundle"]>>;
    },

    // [SERVIDOR_PENDENTE]
    async carregarConsulta(patientId, tumorLotId) {
      const { status, json } = await enviar("/consulta/carregar", { patientId,
        ...(tumorLotId === undefined ? {} : { tumorLotId }) }, true);
      if (status !== 200) throw new ErroPorta("PACIENTE_AUSENTE");
      return json as Awaited<ReturnType<PortaConsulta["carregarConsulta"]>>;
    },

    // [SERVIDOR_PENDENTE]
    async agendaDoDia() {
      const { json } = await enviar("/consulta/agenda", {}, true);
      return json as Awaited<ReturnType<PortaConsulta["agendaDoDia"]>>;
    },

    // [SERVIDOR_PENDENTE]
    async filaSalao() {
      const { json } = await enviar("/consulta/salao", {}, true);
      return json as Awaited<ReturnType<PortaConsulta["filaSalao"]>>;
    },

    // [SERVIDOR_PENDENTE]
    async salvarTriagem(triagem) {
      const { json } = await enviar("/consulta/salao/triagem", triagem, true);
      return json as Awaited<ReturnType<PortaConsulta["salvarTriagem"]>>;
    },

    // [SERVIDOR_PENDENTE]
    async liberarComCorte(patientId, motivo) {
      const { json } = await enviar("/consulta/salao/liberar", { patientId, motivo }, true);
      return json as Awaited<ReturnType<PortaConsulta["liberarComCorte"]>>;
    },

    // [SERVIDOR_PENDENTE]
    async caixaCanal() {
      const { json } = await enviar("/consulta/canal", {}, true);
      return json as Awaited<ReturnType<PortaConsulta["caixaCanal"]>>;
    },

    // [SERVIDOR_PENDENTE]
    async pedirVinculo(contatoId, patientId) {
      const { json } = await enviar("/consulta/canal/vincular", { contatoId, patientId }, true);
      return json as Awaited<ReturnType<PortaConsulta["pedirVinculo"]>>;
    },

    // [SERVIDOR_PENDENTE]
    async lotesApac() {
      const { json } = await enviar("/consulta/apac", {}, true);
      return json as Awaited<ReturnType<PortaConsulta["lotesApac"]>>;
    },

    // [SERVIDOR_PENDENTE]
    async chatSetor(setor) {
      const { json } = await enviar("/consulta/chat", { setor }, true);
      return json as Awaited<ReturnType<PortaConsulta["chatSetor"]>>;
    },
  };
}

function refDe(json: unknown): string | null {
  if (json && typeof json === "object" && "resultRef" in json && typeof json.resultRef === "string") return json.resultRef;
  return null;
}
