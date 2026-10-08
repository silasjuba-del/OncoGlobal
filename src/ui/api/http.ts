import { ActionIntent, ConfirmarBloco } from "../../contracts/operacao.js";
import { EstadoOncoassist, FontesOncoassist, RespostaOncoassist } from "./oncoassist.js";
import { FonteRevisao, RevisaoPreparada } from "./revisaoExtracao.js";
import { AcaoResposta, AgendaResposta, ApacResposta, BundleResposta, CanalResposta, ChatResposta, ConfirmacaoResposta, ConsultaResposta, SalaoResposta } from "./respostas.js";
import { z } from "zod";
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
    if (resposta.status === 404 || resposta.status === 501) throw new ErroPorta("SERVIDOR_PENDENTE");
    return { status: resposta.status, json };
  }

  async function leitura<T>(caminho: string, corpo: unknown, schema: z.ZodType<T>): Promise<T> {
    const { status, json } = await enviar(caminho, corpo, true);
    const parsed = schema.safeParse(json);
    if (status !== 200) throw new ErroPorta(codigoDe(json, "PAYLOAD_INVALIDO"));
    if (!parsed.success) throw new ErroPorta("PAYLOAD_INVALIDO");
    return parsed.data;
  }

  return {
    async carregarFonteRevisao(draftId, signal) {
      const { status, json } = await enviar("/consulta/rascunho", { draftId }, true, signal);
      const parsed = FonteRevisao.safeParse(json);
      if (status !== 200 || !parsed.success) throw new ErroPorta("PAYLOAD_INVALIDO");
      return parsed.data;
    },
    async vincularFonteRevisao(pedido, signal) {
      const { status, json } = await enviar("/consulta/rascunho/revisar", pedido, true, signal);
      const result = z.object({ codigo: z.literal("VINCULO_REVISTO"), revision: z.number().int().nonnegative() }).safeParse(json);
      if (status !== 200 || !result.success) throw new ErroPorta(codigoDe(json, "PAYLOAD_INVALIDO"));
      return result.data;
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

    async selecionarContexto(contexto) {
      const { status, json } = await enviar("/consulta/contexto/selecionar", contexto, true);
      if (status !== 200) throw new ErroPorta(codigoDe(json, "PAYLOAD_INVALIDO"));
    },

    async confirmar(bloco: ConfirmarBloco): Promise<ResultadoConfirmar> {
      const parsed = ConfirmarBloco.safeParse(bloco);
      if (!parsed.success) throw new ErroPorta("PAYLOAD_INVALIDO");
      const { status, json } = await enviar("/consulta/confirmar", parsed.data, true);
      const result = ConfirmacaoResposta.safeParse(json);
      if (!result.success || (status === 200 && !["GRAVADA", "REPLAY"].includes(result.data.codigo)))
        throw new ErroPorta("PAYLOAD_INVALIDO");
      return { codigo: result.data.codigo, resultRef: result.data.resultRef ?? null };
    },

    async acao(intent: AcaoIntent): Promise<ResultadoAcao> {
      const parsed = ActionIntent.safeParse(intent);
      if (!parsed.success) throw new ErroPorta("PAYLOAD_INVALIDO");
      const { status, json } = await enviar("/acao", parsed.data, true);
      const result = AcaoResposta.safeParse(json);
      if (result.success) return { codigo: result.data.motivoCodigo, decisao: result.data.decisao };
      if (status !== 200 && ConfirmacaoResposta.safeParse(json).success)
        return { codigo: ConfirmacaoResposta.parse(json).codigo, decisao: null };
      throw new ErroPorta("PAYLOAD_INVALIDO");
    },

    // [SERVIDOR_PENDENTE] POST /consulta/bundle
    async exibirBundle(pedido) {
      const r = await leitura("/consulta/bundle", pedido, BundleResposta);
      return { ...r, documentos: r.documentos.map((d) => ({ ...d, titulo: "Documento em revisão", preMarcado: false, visivel: true })) };
    },

    // [SERVIDOR_PENDENTE]
    async carregarConsulta(patientId, tumorLotId) {
      return leitura("/consulta/carregar", { patientId, ...(tumorLotId === undefined ? {} : { tumorLotId }) }, ConsultaResposta);
    },

    // [SERVIDOR_PENDENTE]
    async agendaDoDia() {
      return leitura("/consulta/agenda", {}, AgendaResposta);
    },

    // [SERVIDOR_PENDENTE]
    async filaSalao() {
      return leitura("/consulta/salao", {}, SalaoResposta);
    },

    // [SERVIDOR_PENDENTE]
    async salvarTriagem(triagem, expectedRevision = null) {
      return leitura("/consulta/salao/triagem", { triagem, expectedRevision }, SalaoResposta);
    },

    // [SERVIDOR_PENDENTE]
    async liberarComCorte(patientId, motivo, contexto) {
      return leitura("/consulta/salao/liberar", { patientId, ...(contexto ?? {}), motivo }, SalaoResposta);
    },

    // [SERVIDOR_PENDENTE]
    async caixaCanal() {
      return leitura("/consulta/canal", {}, CanalResposta);
    },

    // [SERVIDOR_PENDENTE]
    async pedirVinculo(contatoId, patientId) {
      return leitura("/consulta/canal/vincular", { contatoId, patientId,
        idempotencyKey: crypto.randomUUID() }, CanalResposta);
    },

    // [SERVIDOR_PENDENTE]
    async lotesApac() {
      return leitura("/consulta/apac", {}, ApacResposta);
    },

    // [SERVIDOR_PENDENTE]
    async chatSetor(setor) {
      return leitura("/consulta/chat", { setor }, ChatResposta);
    },
  };
}
