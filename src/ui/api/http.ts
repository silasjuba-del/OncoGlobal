import { PropostasDoseReceitaResposta } from '../../contracts/api/propostaDoseReceita.js';
import { InvestigacaoConsultaVisao } from '../../contracts/api/investigacao.js';
import { RevisaoClinicaResposta } from '../../contracts/fase2/revisaoClinica.js';
import { EstadoDoencaPreparado } from '../../contracts/fase2/estadoDoenca.js';
import { SintesePropostaResposta } from '../../contracts/api/sinteseProposta.js';
import { ActionIntent, ConfirmarBloco } from "../../contracts/operacao.js";
import { EstadoOncoassist, FontesOncoassist, RespostaOncoassist } from "./oncoassist.js";
import { FonteRevisao, ReconciliacaoProposta, RevisaoPreparada } from "./revisaoExtracao.js";
import { AcaoResposta, AgendaResposta, ApacResposta, BundleResposta, CanalResposta, ChatResposta, ConfirmacaoResposta, ConsultaResposta, FlashPreparadaResposta, FlashRascunhoResposta, SalaoResposta } from "./respostas.js";
import { z } from "zod";
import {DitadoResposta} from '../../contracts/fase2/ditado.js';
import { ResultadoInstrumentoSchema } from "../../contracts/f0c/resultadoInstrumento.js";
import { criarApiBiblioteca } from "./biblioteca.js";
import {
  ErroPorta,
  type AcaoIntent,
  type PortaConsulta,
  type ResultadoAcao,
  type ResultadoConfirmar,
  type ResultadoLogin,
} from "./porta.js";

const CaixaConfiguracaoResposta = z.object({ revision: z.number().int().nonnegative(), value: z.unknown().nullable() }).passthrough();
const AlteracaoConfiguracaoResposta = z.object({ estado: z.enum(["GRAVADA", "REPLAY"]), revision: z.number().int().nonnegative() }).passthrough();

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
    if (resposta.status === 404 && codigoDe(json,'') === 'CONSULTA_NAO_ENCONTRADA') throw new ErroPorta('CONSULTA_NAO_ENCONTRADA');
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
    async ditado(pedido,signal){
      const {status,json}=await enviar('/consulta/ditado',pedido,true,signal),p=DitadoResposta.safeParse(json);
      if(status!==200||!p.success)throw new ErroPorta(codigoDe(json,'DITADO_INDISPONIVEL'));
      return p.data;
    },
    biblioteca: criarApiBiblioteca((rota, corpo, signal) => enviar(rota, corpo, true, signal)),
    async reconciliarMedicamentos(pedido, signal) {
      const {status,json}=await enviar("/consulta/medicamentos/reconciliar",pedido,true,signal);
      const r=z.object({codigo:z.enum(["GRAVADA","REPLAY"]),eventId:z.string().min(1)}).safeParse(json);
      if((status===200||status===201)&&r.success)return r.data;
      const refs=json&&typeof json==="object"&&"refs" in json&&Array.isArray(json.refs)?json.refs.filter((v):v is string=>typeof v==="string").join(", "):undefined;
      throw new ErroPorta(codigoDe(json,"RECONCILIACAO_MEDICAMENTOS_NEGADA"),refs);
    },
    async sintetizarRetrato(contexto, signal) {
      const { status, json } = await enviar("/consulta/oncoassist/sintese", contexto, true, signal);
      const r = SintesePropostaResposta.safeParse(json);
      if (!r.success || ![200, 201, 409].includes(status)) throw new ErroPorta(codigoDe(json, "SINTESE_PENDENTE"));
      if (r.data.contexto.patientId !== contexto.patientId || r.data.contexto.encounterId !== contexto.encounterId || r.data.contexto.tumorLotId !== contexto.tumorLotId)
        throw new ErroPorta("SINTESE_FORA_CONTEXTO");
      return r.data;
    },
    async prepararEstadoDoenca(pedido,signal){
      const {status,json}=await enviar('/consulta/estado-doenca/preparar',pedido,true,signal),p=EstadoDoencaPreparado.safeParse(json);
      if(status!==200||!p.success||p.data.contexto.patientId!==pedido.patientId||p.data.contexto.encounterId!==pedido.encounterId||p.data.contexto.tumorLotId!==pedido.tumorLotId)
        throw new ErroPorta(codigoDe(json,'ESTADO_DOENCA_PENDENTE'));return p.data;
    },
    async confirmarEstadoDoenca(pedido,signal){
      const {status,json}=await enviar('/consulta/estado-doenca/confirmar',pedido,true,signal);
      const p=z.object({codigo:z.enum(['GRAVADA','REPLAY']),eventId:z.string().min(1)}).safeParse(json);
      if(status!==200||!p.success)throw new ErroPorta(codigoDe(json,'ESTADO_DOENCA_PENDENTE'));return p.data;
    },
    async revisaoClinica(contexto,packId,signal){
      const {status,json}=await enviar('/consulta/revisao-clinica',{patientId:contexto.patientId,encounterId:contexto.encounterId,
        tumorLotId:contexto.tumorLotId,...(packId?{packId}:{})},true,signal);
      const r=RevisaoClinicaResposta.safeParse(json);
      if(status!==200||!r.success)throw new ErroPorta(codigoDe(json,'REVISAO_CLINICA_PENDENTE'));
      if(r.data.contexto.patientId!==contexto.patientId||r.data.contexto.encounterId!==contexto.encounterId||r.data.contexto.tumorLotId!==contexto.tumorLotId)throw new ErroPorta('REVISAO_FORA_CONTEXTO');
      return r.data;
    },
    async investigacao(contexto, signal) {
      const {status,json}=await enviar("/consulta/investigacao",{patientId:contexto.patientId,encounterId:contexto.encounterId,tumorLotId:contexto.tumorLotId},true,signal);
      const r=InvestigacaoConsultaVisao.safeParse(json);
      if(status!==200)throw new ErroPorta(codigoDe(json,"INVESTIGACAO_PENDENTE"));
      if(!r.success||r.data.contexto.patientId!==contexto.patientId||r.data.contexto.encounterId!==contexto.encounterId||r.data.contexto.tumorLotId!==contexto.tumorLotId)throw new ErroPorta("INVESTIGACAO_FORA_CONTEXTO");
      return r.data;
    },
    async uploadDocumentoLocal(pedido,signal) {
      const {status,json}=await enviar("/consulta/upload",pedido,true,signal);
      const parsed=z.object({codigo:z.enum(["RASCUNHO_SALVO","REPLAY"]),draftId:z.string().min(1),revision:z.number().int().nonnegative(),
        linkedPatientId:z.string().nullable(),requiresMedicalReview:z.literal(true),conversionStatus:z.enum(["PRONTO","PENDENTE"]).optional(),motivo:z.string().nullable().optional(),
        paginasPendentes:z.array(z.number().int().positive()).default([]),totalPaginas:z.number().int().nonnegative().nullable().default(null)}).safeParse(json);
      if((status===201||status===200)&&parsed.success){const {conversionStatus,motivo,...r}=parsed.data;return {...r,...(conversionStatus===undefined?{}:{conversionStatus}),...(motivo===undefined?{}:{motivo})};}
      throw new ErroPorta("UPLOAD_RECUSADO",codigoDe(json,"UPLOAD_INVALIDO"));
    },
    async importarTranscricaoLocal(pedido,signal) {
      const {status,json}=await enviar("/consulta/extrair",pedido,true,signal);
      const parsed=z.object({codigo:z.enum(["RASCUNHO_SALVO","REPLAY"]),draftId:z.string().min(1),revision:z.number().int().nonnegative(),
        linkedPatientId:z.null(),requiresMedicalReview:z.literal(true)}).safeParse(json);
      if((status===201||status===200)&&parsed.success)return parsed.data;
      throw new ErroPorta("TRANSCRICAO_RECUSADA",codigoDe(json,"TRANSCRICAO_INVALIDA"));
    },
    async avaliarInstrumento(contexto,pedido) {
      const r=await enviar("/consulta/instrumento/avaliar",{...contexto,pedido},true);
      const parsed=z.object({resultado:ResultadoInstrumentoSchema,gravado:z.literal(false),assinado:z.literal(false)}).safeParse(r.json);
      if(r.status!==200 || !parsed.success)throw new ErroPorta(codigoDe(r.json,"PAYLOAD_INVALIDO"));
      return parsed.data.resultado;
    },
    async lerCaixaConfiguracao(numero) {
      const { status, json } = await enviar("/config/caixa/ler", { numero }, true);
      const parsed = CaixaConfiguracaoResposta.safeParse(json);
      if (status !== 200 || !parsed.success) throw new ErroPorta(codigoDe(json, "PAYLOAD_INVALIDO"));
      return parsed.data;
    },
    async alterarCaixaConfiguracao(pedido) {
      const { status, json } = await enviar("/config/caixa/alterar", pedido, true);
      const parsed = AlteracaoConfiguracaoResposta.safeParse(json);
      if (status !== 200 || !parsed.success) throw new ErroPorta(codigoDe(json, "PAYLOAD_INVALIDO"));
      return parsed.data;
    },
    // W12-F4: o servidor recusa com um código (sem dado clínico); a UI mostra esse código e mantém o overlay.
    async salvarRascunhoFlash(pedido, signal) {
      const { status, json } = await enviar("/consulta/flash/rascunho", pedido, true, signal);
      const parsed = FlashRascunhoResposta.safeParse(json);
      if (status === 201 && parsed.success) return parsed.data;
      throw new ErroPorta("FLASH_RECUSADA", codigoDe(json, "PAYLOAD_INVALIDO"));
    },
    async prepararFinalizacaoFlash(pedido, signal) {
      const { status, json } = await enviar("/consulta/flash/preparar", pedido, true, signal);
      const parsed = FlashPreparadaResposta.safeParse(json);
      if (status === 200 && parsed.success) {
        const { registros, documentos, alvoImpressao } = parsed.data;
        return { registros, documentos, alvoImpressao };
      }
      throw new ErroPorta("FLASH_RECUSADA", codigoDe(json, "PAYLOAD_INVALIDO"));
    },
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
    async reconciliarFontes(draftIds, signal) {
      const { status, json } = await enviar("/consulta/rascunho/reconciliar", { draftIds: [...draftIds] }, true, signal);
      const result = ReconciliacaoProposta.safeParse(json);
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
    async lotesPaciente(patientId,signal) {
      const {status,json}=await enviar('/consulta/lotes',LotesPacientePedido.parse({patientId}),true,signal);
      const parsed=LotesPacienteResposta.safeParse(json);
      if(status!==200||!parsed.success||parsed.data.patientId!==patientId)throw new ErroPorta(codigoDe(json,'LOTES_INVALIDOS'));
      return parsed.data;
    },
    async carregarConsulta(patientId, tumorLotId, encounterId) {
      if (!encounterId) throw new ErroPorta("ENCONTRO_EXPLICITO_OBRIGATORIO");
      return leitura("/consulta/carregar", { patientId, encounterId, ...(tumorLotId === undefined ? {} : { tumorLotId }) }, ConsultaResposta);
    },

    // [SERVIDOR_PENDENTE]
    async agendaDoDia() {
      return leitura("/consulta/agenda", {}, AgendaResposta);
    },

    // [SERVIDOR_PENDENTE]
    async revisarRelatoInfusao(entrada) {
      const {status,json}=await enviar('/salao/revisar-relato-canal',entrada,true);
      if(status!==200)throw new ErroPorta(codigoDe(json,'REVISAO_NAO_GRAVADA'));
      return json;
    },
    async proporDoseReceita(contexto,medicamento){
      return (await leitura('/consulta/receita/propor-dose',{...contexto,medicamento},PropostasDoseReceitaResposta)).propostas;
    },
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
import {LotesPacientePedido,LotesPacienteResposta} from '../../contracts/api/lotes.js';
