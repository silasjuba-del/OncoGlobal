import type { DatabaseSync } from "node:sqlite";
import { Sessao, type Fonte, type Sessao as SessaoTipo } from "../../contracts/base.js";
import { g07Lateralidade, g08AnatomiaSexo, g09PtDeBiopsia, g25EscopoAssinatura } from "../harness/gates.js";
import { lerDraft } from "../ledger/drafts.js";
import { auditar, listarEventos } from "../ledger/ledger.js";
import { confirmar, motivoInvarianteEscrita, type RegistroConfirmacao } from "../ledger/writeRouter.js";
import { hashCanonico } from "../../modules/tipos.js";
import type { DraftEnvelope } from "../../contracts/base.js";

export interface ComprovanteExibicaoMedica {
  documentId: string;
  documentVersion: number;
  conteudoHash: string;
  draftId?: string;
}

export interface PedidoEscritaGatewayClinico {
  operationId: string;
  reviewDecisionId: string;
  ator: { tipo: "SESSAO" | "AGENTE" | "SISTEMA" | "BRAIN_OS"; id: string };
  sessao: SessaoTipo | null;
  acaoMedicaExplicita: boolean;
  contexto: {
    patientId: string;
    encounterId: string;
    tumorLotId: string | null;
  };
  bundleExibidoNoServidor: readonly ComprovanteExibicaoMedica[] | null;
  documentosAssinadosNoPedido: readonly { documentId: string; documentVersion: number }[];
  regrasDeterministicas?: {
    lateralidade?: Parameters<typeof g07Lateralidade>[0];
    anatomiaSexo?: Parameters<typeof g08AnatomiaSexo>[0];
    ptBiopsia?: Parameters<typeof g09PtDeBiopsia>[0];
  };
  /** Confirmação específica dos alertas exibidos e revisados pelo médico autenticado. */
  alertasDeterministicosRevisados?: readonly ("G-07" | "G-08")[];
  registros: readonly (RegistroConfirmacao & {
    exigeProveniencia?: boolean;
  })[];
}

export interface ResultadoWriterClinico {
  decisao: "PERSISTIDA" | "REPLAY" | "NEGADA";
  motivoCodigo: string;
  resultRef: string | null;
}

export interface WriterClinicoGateway {
  /** O funil único é writeRouter.confirmar; este writer soma exibição (G-25) e regras G-07/G-08/G-09. */
  readonly funilEscrita: "ledger.writeRouter.confirmar";
  persistir(pedido: PedidoEscritaGatewayClinico): ResultadoWriterClinico;
  historicoEventos(patientId: string): ReturnType<typeof listarEventos>;
  trilhaAuditoria(): readonly Record<string, unknown>[];
}

function provenienciaValida(fontes: readonly Fonte[]): boolean {
  return fontes.length > 0 && fontes.every((f) => f.sourceId.trim().length > 0 && f.versao.trim().length > 0
    && f.contentHash.trim().length >= 8 && Number.isFinite(Date.parse(f.dataCaptura)));
}

/**
 * GATEWAY — writer clínico com exibição comprovada:
 * - Soma escopo exibido (G-25), hash exibido e regras G-07/G-08/G-09 às invariantes
 *   comuns de writeRouter.confirmar (sessão íntegra e vigente), que valem para todas as rotas.
 * - Exige proveniência de FATO; o funil comum não exige, pois há registro médico manual sem documento.
 * - Persiste somente após ação autorizada do médico; mantém histórico e auditoria.
 */
export function criarWriterClinicoGateway(deps: {
  db: DatabaseSync;
  agora: () => string;
  politicaVersao?: string;
  /** Resolver do acervo confiável: hash dos bytes originais vinculados ao sourceId do draft. */
  hashFonteOriginal?: (draft: DraftEnvelope) => string | null;
}): WriterClinicoGateway {
  const politicaVersao = deps.politicaVersao ?? "gateway-writer-clinico-v1";

  const negar = (ator: { tipo: "SESSAO" | "AGENTE" | "SISTEMA"; id: string }, motivoCodigo: string, em: string): ResultadoWriterClinico => {
    auditar(deps.db, {
      ator,
      acaoPedida: "PERSISTIR_EVENTO_CLINICO",
      decisao: "NEGADA",
      motivoCodigo,
      politicaVersao,
      em,
    });
    return { decisao: "NEGADA", motivoCodigo, resultRef: null };
  };

  return {
    funilEscrita: "ledger.writeRouter.confirmar",
    persistir(pedido: PedidoEscritaGatewayClinico): ResultadoWriterClinico {
      const em = deps.agora();
      const atorAuditavel: { tipo: "SESSAO" | "AGENTE" | "SISTEMA"; id: string } = {
        tipo: pedido.ator.tipo === "BRAIN_OS" ? "AGENTE" : pedido.ator.tipo,
        id: pedido.ator.id || "desconhecido",
      };

      // 1. Permissão e autoridade médica: BRAIN_OS, AGENTE e SISTEMA nunca escrevem estado clínico.
      if (pedido.ator.tipo !== "SESSAO" || !pedido.acaoMedicaExplicita || !pedido.reviewDecisionId.trim()) {
        return negar(atorAuditavel, "ESCRITA_CLINICA_EXIGE_AUTORIZACAO_MEDICA", em);
      }

      // 2. Identidade da sessão médica ativa e não expirada.
      const sessaoParsed = Sessao.safeParse(pedido.sessao);
      if (!sessaoParsed.success || sessaoParsed.data.medicoId !== pedido.ator.id) {
        return negar(atorAuditavel, "IDENTIDADE_MEDICA_INVALIDA", em);
      }
      const invariante = motivoInvarianteEscrita({ sessao: sessaoParsed.data, em });
      if (invariante) return negar(atorAuditavel, invariante, em);

      // 3. Identidade do paciente e contexto clínico.
      if (!pedido.contexto.patientId.trim() || !pedido.contexto.encounterId.trim() || pedido.registros.length === 0) {
        return negar(atorAuditavel, "IDENTIDADE_CONTEXTO_INVALIDA", em);
      }

      // 4. Escopo de exibição/assinatura (G-25) e integridade do conteúdo exibido (A13).
      if (!pedido.bundleExibidoNoServidor || pedido.bundleExibidoNoServidor.length === 0) {
        return negar(atorAuditavel, "BUNDLE_NAO_EXIBIDO", em);
      }
      if (g25EscopoAssinatura(pedido.documentosAssinadosNoPedido, pedido.bundleExibidoNoServidor).decisao !== "PASSA") {
        return negar(atorAuditavel, "ESCOPO_ASSINATURA_INVALIDO", em);
      }

      // 5. Regras determinísticas independentes (G-07, G-08, G-09).
      if (pedido.regrasDeterministicas?.lateralidade) {
        const v07 = g07Lateralidade(pedido.regrasDeterministicas.lateralidade);
        if (v07.decisao === "ALERTA") {
          if (!pedido.alertasDeterministicosRevisados?.includes("G-07"))
            return negar(atorAuditavel, "ALERTA_G07_REQUER_REVISAO_MEDICA", em);
        } else if (v07.decisao !== "PASSA") return negar(atorAuditavel, "REGRA_DETERMINISTICA_G07_REPROVADA", em);
      }
      if (pedido.regrasDeterministicas?.anatomiaSexo) {
        const v08 = g08AnatomiaSexo(pedido.regrasDeterministicas.anatomiaSexo);
        if (v08.decisao === "ALERTA") {
          if (!pedido.alertasDeterministicosRevisados?.includes("G-08"))
            return negar(atorAuditavel, "ALERTA_G08_REQUER_REVISAO_MEDICA", em);
        } else if (v08.decisao !== "PASSA") return negar(atorAuditavel, "REGRA_DETERMINISTICA_G08_REPROVADA", em);
      }
      if (pedido.regrasDeterministicas?.ptBiopsia) {
        const v09 = g09PtDeBiopsia(pedido.regrasDeterministicas.ptBiopsia);
        if (v09.decisao !== "PASSA") return negar(atorAuditavel, "REGRA_DETERMINISTICA_G09_REPROVADA", em);
      }

      // 6. Proveniência, vínculo ao paciente e hash exibido de cada registro.
      for (const reg of pedido.registros) {
        const draft = lerDraft(deps.db, reg.draftId);
        if (!draft) return negar(atorAuditavel, "DRAFT_NAO_ENCONTRADO", em);
        if (draft.patientId !== pedido.contexto.patientId) {
          return negar(atorAuditavel, "IDENTIDADE_PACIENTE_DIVERGENTE", em);
        }
        const hashAtual = hashCanonico(draft.payload);
        const comprovante = pedido.bundleExibidoNoServidor.find((b) =>
          (b.draftId ? b.draftId === reg.draftId : b.documentId === reg.draftId) &&
          b.conteudoHash === hashAtual,
        );
        if (!comprovante) {
          return negar(atorAuditavel, "CONTEUDO_ALTERADO_APOS_EXIBICAO", em);
        }
        if (!pedido.documentosAssinadosNoPedido.some(d =>
          d.documentId === comprovante.documentId && d.documentVersion === comprovante.documentVersion)) {
          return negar(atorAuditavel, "ESCOPO_ASSINATURA_INVALIDO", em);
        }
        // O evento gravado deve ser exatamente o conteúdo cuja exibição foi comprovada.
        // Hash do draft sozinho não vincula o payload fornecido no pedido de escrita.
        if (hashCanonico(reg.payload) !== hashAtual) {
          return negar(atorAuditavel, "CONTEUDO_ALTERADO_APOS_EXIBICAO", em);
        }
        if (reg.tipo === "FATO" || reg.exigeProveniencia) {
          const hashConfiavel = deps.hashFonteOriginal?.(draft);
          if (!provenienciaValida(reg.fontes) || !hashConfiavel
            || !reg.fontes.some(f => f.sourceId === draft.sourceId && f.contentHash === hashConfiavel))
            return negar(atorAuditavel, "PROVENIENCIA_OBRIGATORIA_AUSENTE", em);
        }
      }

      // 7. Validação de schema (ClinicalEvent.parse em confirmar) e persistência transacional no ledger.
      let gravacao;
      try {
        gravacao = confirmar(deps.db, {
          operationId: pedido.operationId,
          patientId: pedido.contexto.patientId,
          encounterId: pedido.contexto.encounterId,
          tumorLotId: pedido.contexto.tumorLotId,
          reviewDecisionId: pedido.reviewDecisionId,
          sessao: sessaoParsed.data,
          em,
          registros: pedido.registros.map(({ exigeProveniencia: _omit, ...r }) => r),
        });
      } catch {
        return negar(atorAuditavel, "SCHEMA_EVENTO_CLINICO_INVALIDO", em);
      }

      if (gravacao.estado === "NEGADA") {
        return negar(atorAuditavel, gravacao.motivo ?? "ESCRITA_NEGADA", em);
      }

      const motivoCodigo = gravacao.estado === "REPLAY" ? "ESCRITA_REPLAY_IDEMPOTENTE" : "ESCRITA_CLINICA_PERSISTIDA";
      auditar(deps.db, {
        ator: atorAuditavel,
        acaoPedida: "PERSISTIR_EVENTO_CLINICO",
        decisao: "PERMITIDA",
        motivoCodigo,
        politicaVersao,
        em,
      });
      return {
        decisao: gravacao.estado === "REPLAY" ? "REPLAY" : "PERSISTIDA",
        motivoCodigo,
        resultRef: gravacao.resultRef,
      };
    },
    historicoEventos(patientId: string) {
      return listarEventos(deps.db, patientId);
    },
    trilhaAuditoria() {
      return deps.db.prepare("SELECT * FROM audit_event ORDER BY auditId").all() as Record<string, unknown>[];
    },
  };
}
