import { PropostasDoseReceitaResposta } from '../../contracts/api/propostaDoseReceita.js';
import { CatalogoFichasRespostaSchema, FichaProtocoloCatalogoSchema, InstanciacaoFichaRespostaSchema } from "../../contracts/api/fichasPrescricao.js";
import { EstudoServicoSchema, ListarEstudosRespostaSchema, AvaliacaoEstudoRespostaSchema,
  SchemaFatosTrialsResposta } from "../../contracts/api/trialsServico.js";
import { AcaoCompostaPreparada, BaseAcaoCompostaResposta } from "../../contracts/api/execucaoAcaoComposta.js";
import { TimelineMulticamadasResposta } from "../../contracts/api/timelineMulticamadas.js";
import { GerarContingenciaSalao, ContingenciaSalaoResposta, HistoricoContingenciaSalaoResposta } from '../../contracts/api/salaoContingencia.js';
import {RespostaCanalPreparada,RespostaCanalConfirmada} from '../../contracts/api/respostaCanal.js';
import { InvestigacaoConsultaVisao } from '../../contracts/api/investigacao.js';
import { RevisaoClinicaResposta } from '../../contracts/fase2/revisaoClinica.js';
import { EstadoDoencaPreparado } from '../../contracts/fase2/estadoDoenca.js';
import { SintesePropostaResposta } from '../../contracts/api/sinteseProposta.js';
import { ActionIntent, ConfirmarBloco } from "../../contracts/operacao.js";
import { EstadoOncoassist, FontesOncoassist, RespostaOncoassist, HistoricoOncoassist } from "./oncoassist.js";
import { FonteRevisao, ReconciliacaoProposta, RevisaoPreparada } from "./revisaoExtracao.js";
import { AcaoResposta, AgendaResposta, ApacResposta, BundleResposta, CanalResposta, ChatResposta, ConfirmacaoResposta, ConsultaResposta, FlashPreparadaResposta, FlashRascunhoResposta, SalaoResposta } from "./respostas.js";
import { z } from "zod";
import {DitadoResposta} from '../../contracts/fase2/ditado.js';
import { ResultadoInstrumentoSchema } from "../../contracts/f0c/resultadoInstrumento.js";
import { criarApiBiblioteca } from "./biblioteca.js";
import { BasePrescricaoExecutavelResposta, PrescricaoExecutavelConfirmada,
  PrescricaoExecutavelPreparada } from "../../contracts/api/operacaoPrescricaoExecutavel.js";
import { EstatisticaServicoResposta, type PeriodoClinicoEstatisticaServico } from "../../contracts/api/estatisticaServico.js";
import { BaseApacRascunhoRespostaSchema, ApacRascunhoPreparadoSchema,
  ApacRascunhoConfirmadoSchema } from "../../contracts/api/apacRascunho.js";
import type { BaseApacRascunhoResposta, ApacRascunhoPreparado } from "../../contracts/api/apacRascunho.js";
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
  const basesApac = new Map<string, BaseApacRascunhoResposta>();
  const preparadasApac = new Map<string, ApacRascunhoPreparado>();
  const chaveContexto = (contexto: { patientId: string; encounterId: string; tumorLotId: string | null }) =>
    JSON.stringify([contexto.patientId, contexto.encounterId, contexto.tumorLotId]);

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
    async carregarTimelineMulticamadas(contexto, signal) {
      const { status, json } = await enviar("/consulta/timeline-multicamadas", contexto, true, signal);
      if (status !== 200) throw new ErroPorta(codigoDe(json, "TIMELINE_INDISPONIVEL"));
      const p = TimelineMulticamadasResposta.safeParse(json);
      if (!p.success || p.data.contexto.patientId !== contexto.patientId || p.data.contexto.encounterId !== contexto.encounterId
        || p.data.contexto.tumorLotId !== contexto.tumorLotId
        || p.data.eventos.some(e => e.patientId !== contexto.patientId)) throw new ErroPorta("PAYLOAD_INVALIDO");
      return p.data;
    },
    async carregarBaseAcaoComposta(contexto, signal) {
      const { status, json } = await enviar("/consulta/acoes-compostas/base", contexto, true, signal);
      if (status !== 200) throw new ErroPorta(codigoDe(json, "BASE_ACAO_INDISPONIVEL"));
      const p = BaseAcaoCompostaResposta.safeParse(json);
      if (!p.success || p.data.base && (p.data.base.contexto.patientId !== contexto.patientId
        || p.data.base.contexto.encounterId !== contexto.encounterId
        || p.data.base.contexto.tumorLotId !== contexto.tumorLotId)) throw new ErroPorta("PAYLOAD_INVALIDO");
      return p.data;
    },
    async lerBasePrescricaoExecutavel(contexto, signal) {
      const { status, json } = await enviar("/consulta/prescricao-executavel/base", contexto, true, signal);
      if (status !== 200) throw new ErroPorta(codigoDe(json, "BASE_PRESCRICAO_EXECUTAVEL_INDISPONIVEL"));
      const result = BasePrescricaoExecutavelResposta.safeParse(json);
      if (!result.success || result.data.contexto.patientId !== contexto.patientId
        || result.data.contexto.encounterId !== contexto.encounterId
        || result.data.contexto.tumorLotId !== contexto.tumorLotId) throw new ErroPorta("PAYLOAD_INVALIDO");
      return result.data;
    },
    async prepararPrescricaoExecutavel(pedido, signal) {
      const { status, json } = await enviar("/consulta/prescricao-executavel/preparar", pedido, true, signal);
      if (status !== 200) throw new ErroPorta(codigoDe(json, "PRESCRICAO_EXECUTAVEL_PENDENTE"));
      const result = PrescricaoExecutavelPreparada.safeParse(json);
      const c = result.success ? result.data.conteudo.contexto : null;
      if (!result.success || result.data.baseHash !== pedido.expectedBaseHash || !c
        || c.patientId !== pedido.contexto.patientId || c.encounterId !== pedido.contexto.encounterId
        || c.tumorLotId !== pedido.contexto.tumorLotId) throw new ErroPorta("PAYLOAD_INVALIDO");
      return result.data;
    },
    async confirmarPrescricaoExecutavel(pedido, signal) {
      const { status, json } = await enviar("/consulta/prescricao-executavel/confirmar", pedido, true, signal);
      if (status !== 200) throw new ErroPorta(codigoDe(json, "PRESCRICAO_EXECUTAVEL_PENDENTE"));
      const result = PrescricaoExecutavelConfirmada.safeParse(json);
      if (!result.success) throw new ErroPorta("PAYLOAD_INVALIDO");
      return result.data;
    },
    async lerBaseApacRascunho(contexto, signal) {
      const { status, json } = await enviar("/consulta/apac-rascunho/base", contexto, true, signal);
      if (status !== 200) throw new ErroPorta(codigoDe(json, "BASE_APAC_INDISPONIVEL"));
      const p = BaseApacRascunhoRespostaSchema.safeParse(json);
      if (!p.success || p.data.contexto.patientId !== contexto.patientId
        || p.data.contexto.encounterId !== contexto.encounterId
        || p.data.contexto.tumorLotId !== contexto.tumorLotId) throw new ErroPorta("PAYLOAD_INVALIDO");
      basesApac.set(chaveContexto(contexto), p.data);
      return p.data;
    },
    async prepararApacRascunho(pedido, signal) {
      const { status, json } = await enviar("/consulta/apac-rascunho/preparar", pedido, true, signal);
      if (status !== 200) throw new ErroPorta(codigoDe(json, "APAC_RASCUNHO_PENDENTE"));
      const p = ApacRascunhoPreparadoSchema.safeParse(json);
      const base = basesApac.get(chaveContexto(pedido.contexto));
      if (!p.success || p.data.contexto.patientId !== pedido.contexto.patientId
        || p.data.contexto.encounterId !== pedido.contexto.encounterId
        || p.data.contexto.tumorLotId !== pedido.contexto.tumorLotId
        || p.data.baseHash !== pedido.expectedBaseHash
        || p.data.apac.competencia !== pedido.edicao.competencia
        || p.data.apac.tumorLotId !== pedido.contexto.tumorLotId
        || base && (base.revisao !== pedido.expectedBaseHash || !base.prescricao
          || p.data.apac.prescricaoAssinadaRef.documentId !== base.prescricao.documentId
          || p.data.apac.prescricaoAssinadaRef.documentVersion !== base.prescricao.documentVersion))
        throw new ErroPorta("PAYLOAD_INVALIDO");
      preparadasApac.set(p.data.draftId, p.data);
      return p.data;
    },
    async confirmarApacRascunho(pedido, signal) {
      const { status, json } = await enviar("/consulta/apac-rascunho/confirmar", pedido, true, signal);
      if (status !== 200) throw new ErroPorta(codigoDe(json, "APAC_RASCUNHO_NAO_CONFIRMADA"));
      const p = ApacRascunhoConfirmadoSchema.safeParse(json);
      const anterior = preparadasApac.get(pedido.draftId);
      if (!p.success || !anterior
        || anterior.contexto.patientId !== pedido.contexto.patientId
        || anterior.contexto.encounterId !== pedido.contexto.encounterId
        || anterior.contexto.tumorLotId !== pedido.contexto.tumorLotId
        || anterior.revision !== pedido.expectedRevision || anterior.conteudoHash !== pedido.conteudoHash
        || p.data.apacId !== anterior.apac.apacId || p.data.versao !== anterior.apac.versao)
        throw new ErroPorta("PAYLOAD_INVALIDO");
      return p.data;
    },
    async lerEstatisticaServico(periodo: PeriodoClinicoEstatisticaServico | null, signal) {
      const corpo = periodo === null ? {} : { periodoClinico: periodo };
      const { status, json } = await enviar("/consulta/estatistica", corpo, true, signal);
      if (status !== 200) throw new ErroPorta(codigoDe(json, "PAYLOAD_INVALIDO"));
      const result = EstatisticaServicoResposta.safeParse(json);
      if (!result.success) throw new ErroPorta("PAYLOAD_INVALIDO");
      return result.data;
    },
    async listarFichasPrescricao(signal) {
      const { status, json } = await enviar("/consulta/prescricao/fichas/listar", {}, true, signal);
      if (status !== 200) throw new ErroPorta(codigoDe(json, "FICHAS_INDISPONIVEIS"));
      const r = CatalogoFichasRespostaSchema.safeParse(json);
      if (!r.success) throw new ErroPorta("PAYLOAD_INVALIDO");
      return r.data;
    },
    async revisarFichaPrescricao(pedido, signal) {
      const { status, json } = await enviar("/consulta/prescricao/fichas/revisar", pedido, true, signal);
      if (status !== 200) throw new ErroPorta(codigoDe(json, "REVISAO_FICHA_RECUSADA"));
      const r = FichaProtocoloCatalogoSchema.safeParse(json);
      if (!r.success || r.data.template.templateId !== pedido.templateId || r.data.template.versao !== pedido.versao
        || r.data.contentHash !== pedido.expectedContentHash || r.data.revision !== pedido.expectedRevision + 1
        || r.data.revisao?.decisao !== pedido.decisao || r.data.revisao.motivo !== pedido.motivo.trim())
        throw new ErroPorta("PAYLOAD_INVALIDO");
      return r.data;
    },
    async instanciarFichaPrescricao(pedido, signal) {
      const { status, json } = await enviar("/consulta/prescricao/fichas/instanciar", pedido, true, signal);
      if (status !== 200) throw new ErroPorta(codigoDe(json, "FICHA_NAO_INSTANCIAVEL"));
      const r = InstanciacaoFichaRespostaSchema.safeParse(json);
      if (!r.success || r.data.template.templateId !== pedido.templateId || r.data.template.versao !== pedido.versao
        || r.data.contentHash !== pedido.expectedContentHash || r.data.revisionFicha !== pedido.expectedRevision
        || r.data.contexto.patientId !== pedido.contexto.patientId || r.data.contexto.encounterId !== pedido.contexto.encounterId
        || r.data.contexto.tumorLotId !== pedido.contexto.tumorLotId) throw new ErroPorta("PAYLOAD_INVALIDO");
      return r.data;
    },
    async listarEstudosTrials(signal) {
      const { status, json } = await enviar("/consulta/trials/listar", {}, true, signal);
      if (status !== 200) throw new ErroPorta(codigoDe(json, "ESTUDOS_INDISPONIVEIS"));
      const p = ListarEstudosRespostaSchema.safeParse(json);
      if (!p.success) throw new ErroPorta("PAYLOAD_INVALIDO");
      return p.data;
    },
    async importarEstudoTrial(pedido, signal) {
      const { status, json } = await enviar("/consulta/trials/importar", pedido, true, signal);
      if (status !== 200) throw new ErroPorta(codigoDe(json, "IMPORTACAO_ESTUDO_NAO_CONCLUIDA"));
      const p = EstudoServicoSchema.safeParse(json);
      if (!p.success || p.data.source.originalContent !== pedido.conteudo) throw new ErroPorta("PAYLOAD_INVALIDO");
      return p.data;
    },
    async revisarEstudoTrial(pedido, signal) {
      const { status, json } = await enviar("/consulta/trials/revisar", pedido, true, signal);
      if (status !== 200) throw new ErroPorta(codigoDe(json, "REVISAO_ESTUDO_NAO_CONCLUIDA"));
      const p = EstudoServicoSchema.safeParse(json);
      if (!p.success || p.data.draftId !== pedido.draftId || p.data.candidateHash !== pedido.candidateHash
        || p.data.revision !== pedido.expectedRevision + 1 || p.data.review?.decision !== pedido.decision
        || p.data.review.studyId !== pedido.studyId || p.data.review.title.text !== pedido.titleText)
        throw new ErroPorta("PAYLOAD_INVALIDO");
      const binding = (b: typeof pedido.bindings[number]) => {
        const e = b.expression;
        const expression = !e ? null : e.kind === "EQUALS" ? [e.kind, e.factKey, e.value]
          : e.kind === "NUMBER" ? [e.kind, e.factKey, e.operator, e.value, e.unit]
          : [e.kind, e.factKey, e.operator, e.value];
        return JSON.stringify([b.criterionId, b.groupId, b.groupOperator, expression, b.applicability, b.notApplicableReason]);
      };
      if (p.data.review.reviewedCriteria.length !== pedido.bindings.length
        || p.data.review.reviewedCriteria.some(c => {
          const esperado = pedido.bindings.find(b => b.criterionId === c.criterionId);
          return !esperado || binding(c) !== binding(esperado);
        })
        || JSON.stringify([...p.data.review.reviewedArmIds].sort()) !== JSON.stringify([...pedido.reviewedArmIds].sort())
        || !p.data.review.title.evidence.some(e => e.locator === pedido.titleEvidenceLocator && e.exactText === pedido.titleText))
        throw new ErroPorta("PAYLOAD_INVALIDO");
      return p.data;
    },
    async avaliarEstudoTrial(pedido, signal) {
      const { status, json } = await enviar("/consulta/trials/avaliar", pedido, true, signal);
      if (status !== 200) throw new ErroPorta(codigoDe(json, "AVALIACAO_ESTUDO_INDISPONIVEL"));
      const p = AvaliacaoEstudoRespostaSchema.safeParse(json);
      if (!p.success || p.data.estudo.draftId !== pedido.draftId || p.data.estudo.revision !== pedido.expectedRevision
        || p.data.estudo.review?.reviewHash !== pedido.expectedReviewHash
        || p.data.contexto.patientId !== pedido.contexto.patientId
        || p.data.contexto.encounterId !== pedido.contexto.encounterId
        || p.data.contexto.tumorLotId !== pedido.contexto.tumorLotId) throw new ErroPorta("PAYLOAD_INVALIDO");
      return p.data;
    },
    async lerFatosTrials(contexto, signal) {
      const { status, json } = await enviar("/consulta/trials/fatos", contexto, true, signal);
      if (status !== 200) throw new ErroPorta(codigoDe(json, "FATOS_ESTUDO_INDISPONIVEIS"));
      const p = SchemaFatosTrialsResposta.safeParse(json);
      if (!p.success || p.data.contexto.patientId !== contexto.patientId
        || p.data.contexto.encounterId !== contexto.encounterId
        || p.data.contexto.tumorLotId !== contexto.tumorLotId) throw new ErroPorta("PAYLOAD_INVALIDO");
      return p.data;
    },
    async prepararAcaoComposta(pedido, signal) {
      const { status, json } = await enviar("/consulta/acoes-compostas/preparar", pedido, true, signal);
      if (status !== 200) throw new ErroPorta(codigoDe(json, "ACAO_COMPOSTA_PENDENTE"));
      const p = AcaoCompostaPreparada.safeParse(json);
      const c = p.success ? p.data.resultado.antes?.contexto : null;
      if (!p.success || !c || c.patientId !== pedido.contexto.patientId || c.encounterId !== pedido.contexto.encounterId
        || c.tumorLotId !== pedido.contexto.tumorLotId || p.data.resultado.baseHash !== pedido.expectedBaseHash)
        throw new ErroPorta("PAYLOAD_INVALIDO");
      return p.data;
    },
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
      if (status !== 200) throw new ErroPorta(codigoDe(json, "PAYLOAD_INVALIDO"));
      if (!parsed.success) throw new ErroPorta("PAYLOAD_INVALIDO");
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
      if (status !== 200) throw new ErroPorta(codigoDe(json, "PAYLOAD_INVALIDO"));
      if (!parsed.success) throw new ErroPorta("PAYLOAD_INVALIDO");
      return parsed.data;
    },
    async confirmarRevisaoExtracao(pedido, signal) {
      const { status, json } = await enviar("/consulta/rascunho/revisar", pedido, true, signal);
      const codigo = codigoDe(json, "PAYLOAD_INVALIDO");
      if (status !== 200) throw new ErroPorta(codigo);
      if (codigo !== "GRAVADA" && codigo !== "REPLAY") throw new ErroPorta("PAYLOAD_INVALIDO");
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
      if (["FONTE_ALTERADA", "CONTEXTO_CONSULTA_ALTERADO", "OPERACAO_DIVERGENTE"].includes(codigo)) throw new ErroPorta(codigo);
      const result = RespostaOncoassist.safeParse(json);
      if (status !== 200 || !result.success) throw new ErroPorta("PAYLOAD_INVALIDO");
      return result.data;
    },
    async oncoassistHistorico(contexto, signal) {
      const { status, json } = await enviar("/consulta/oncoassist/historico", contexto, true, signal);
      if (status !== 200) throw new ErroPorta(codigoDe(json, "PAYLOAD_INVALIDO"));
      const result = HistoricoOncoassist.safeParse(json);
      if (!result.success) throw new ErroPorta("PAYLOAD_INVALIDO");
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
      if (status !== 200) throw new ErroPorta(codigoDe(json, "PAYLOAD_INVALIDO"));
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
    async gerarContingenciaSalao(pedido) {
      return (await leitura("/consulta/salao/contingencia/gerar", GerarContingenciaSalao.parse(pedido), ContingenciaSalaoResposta)).folha;
    },
    async historicoContingenciaSalao(contexto) {
      return (await leitura("/consulta/salao/contingencia/historico", contexto, HistoricoContingenciaSalaoResposta)).folhas;
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
    async prepararRespostaCanal(pedido){return (await leitura('/consulta/canal/resposta/preparar',pedido,RespostaCanalPreparada)).rascunho;},
    async confirmarRespostaCanal(pedido){const r=await leitura('/consulta/canal/resposta/confirmar',pedido,RespostaCanalConfirmada);return {respostaId:r.respostaId,versao:r.versao};},

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
