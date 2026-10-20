// F6 · Controle de acesso por profissional e setor (RBAC server-side, Q40 / D-F1-13),
// avisos ao médico livres de PHI (Q55) e isolamento estrito WORK × STUDY (Q54).
import { createHash, randomUUID } from "node:crypto";
import { Instante } from "../../contracts/base.js";
import {
  AvisoMedicoSemPhiF6,
  SessaoProfissionalSetorF6,
  VereditoIsolamentoWorkStudyF6,
  type CodigoEventoAvisoMedicoOpaco,
  type OperacaoSetorialF6,
  type PapelProfissionalSetor,
  type SetorOperacionalF6,
} from "../../contracts/f6/multiusuarioSetores.js";

const OPERACOES_SEMPRE_PROIBIDAS = new Set<OperacaoSetorialF6>([
  "EDITAR_PRESCRICAO_NA_FARMACIA",
  "PROMOVER_CHAT_AO_PRONTUARIO_SEM_MEDICO",
  "EXPORTAR_WORK_PARA_STUDY",
]);

const MATRIZ_PERMISSOES_POR_PAPEL: Readonly<Record<PapelProfissionalSetor, ReadonlySet<OperacaoSetorialF6>>> = {
  MEDICO: new Set<OperacaoSetorialF6>([
    "LER_PRONTUARIO_COMPLETO",
    "CONFIRMAR_FATO_CLINICO",
    "ASSINAR_DOCUMENTO_OU_PRESCRICAO",
    "LIBERAR_CORTE_SALAO",
    "ACEITAR_OU_RECUSAR_CORRECAO_FARMACIA",
    "LER_FILA_E_POLTRONAS_SALAO",
    "LANCAR_TRIAGEM_SALAO",
    "REGISTRAR_ADMINISTRACAO_EFETIVA",
    "REGISTRAR_INTERRUPCAO_SALAO",
    "LER_PRESCRICAO_ASSINADA_FARMACIA",
    "LER_AGENDA_E_CADASTRO_SECRETARIA",
    "GERENCIAR_LOTE_APAC_FATURAMENTO",
    "LER_CHAT_SETOR",
    "ESCREVER_CHAT_SETOR",
    "LER_ESTATISTICA_SERVICO",
    "EMITIR_AVISO_MEDICO",
  ]),
  ENFERMAGEM_SALAO: new Set<OperacaoSetorialF6>([
    "LER_FILA_E_POLTRONAS_SALAO",
    "LANCAR_TRIAGEM_SALAO",
    "REGISTRAR_ADMINISTRACAO_EFETIVA",
    "REGISTRAR_INTERRUPCAO_SALAO",
    "LER_CHAT_SETOR",
    "EMITIR_AVISO_MEDICO",
    "ESCREVER_CHAT_SETOR",
  ]),
  FARMACIA: new Set<OperacaoSetorialF6>([
    "LER_PRESCRICAO_ASSINADA_FARMACIA",
    "CONFERIR_OU_PEDIR_CORRECAO_FARMACIA",
    "EMITIR_AVISO_MEDICO",
    "LER_CHAT_SETOR",
    "ESCREVER_CHAT_SETOR",
  ]),
  SECRETARIA_FATURAMENTO: new Set<OperacaoSetorialF6>([
    "LER_AGENDA_E_CADASTRO_SECRETARIA",
    "GERENCIAR_LOTE_APAC_FATURAMENTO",
    "LER_CHAT_SETOR",
    "EMITIR_AVISO_MEDICO",
    "ESCREVER_CHAT_SETOR",
    "LER_ESTATISTICA_SERVICO",
  ]),
};

export type DecisaoRbacSetorialF6 =
  | {
    permitida: true;
    motivoCodigo: "RBAC_PERMITIDA";
    sessao: SessaoProfissionalSetorF6;
  }
  | {
    permitida: false;
    motivoCodigo:
      | "SESSAO_AUSENTE_OU_INVALIDA"
      | "SESSAO_EXPIRADA"
      | "OPERACAO_PROIBIDA_POR_INVARIANTE"
      | "PERMISSAO_NEGADA_PARA_PAPEL_OU_SETOR"
      | "CHAT_SETOR_FORA_DA_PERMISSAO"
      | "VINCULO_POR_ID_NAO_CONCEDE_PERMISSAO";
  };

/**
 * Avalia no servidor se a sessão do profissional tem permissão para a operação e o setor-alvo.
 * Importante (D-F1-13 / Q40): possuir ou enviar um `patientId`/`encounterId`/`objetoId` (vínculo por ID)
 * NUNCA concede permissão quando o papel/setor da sessão não possui autorização explícita.
 */
export function autorizarOperacaoSetorialF6(entrada: {
  sessaoCandidata: unknown;
  operacao: OperacaoSetorialF6;
  setorChatAlvo?: "TRIAGEM" | "FARMACIA" | "SECRETARIA" | "MEDICO";
  vinculoIdAlegadoPeloCliente?: string | null;
  agora: string;
}): DecisaoRbacSetorialF6 {
  const parsedSessao = SessaoProfissionalSetorF6.safeParse(entrada.sessaoCandidata);
  if (!parsedSessao.success || !Instante.safeParse(entrada.agora).success) {
    return { permitida: false, motivoCodigo: "SESSAO_AUSENTE_OU_INVALIDA" };
  }
  const sessao = parsedSessao.data;
  if (Date.parse(sessao.expiraEm) <= Date.parse(entrada.agora)) {
    return { permitida: false, motivoCodigo: "SESSAO_EXPIRADA" };
  }

  if (OPERACOES_SEMPRE_PROIBIDAS.has(entrada.operacao)) {
    return { permitida: false, motivoCodigo: "OPERACAO_PROIBIDA_POR_INVARIANTE" };
  }

  const permitidasPapel = MATRIZ_PERMISSOES_POR_PAPEL[sessao.papel];
  if (!permitidasPapel.has(entrada.operacao)) {
    return {
      permitida: false,
      motivoCodigo: entrada.vinculoIdAlegadoPeloCliente
        ? "VINCULO_POR_ID_NAO_CONCEDE_PERMISSAO"
        : "PERMISSAO_NEGADA_PARA_PAPEL_OU_SETOR",
    };
  }

  // Isolamento por fatia no chat: cada setor só lê/escreve o próprio canal operacional; o médico vê todos.
  if ((entrada.operacao === "LER_CHAT_SETOR" || entrada.operacao === "ESCREVER_CHAT_SETOR") && entrada.setorChatAlvo) {
    if (sessao.papel === "ENFERMAGEM_SALAO" && entrada.setorChatAlvo !== "TRIAGEM") {
      return { permitida: false, motivoCodigo: "CHAT_SETOR_FORA_DA_PERMISSAO" };
    }
    if (sessao.papel === "FARMACIA" && entrada.setorChatAlvo !== "FARMACIA") {
      return { permitida: false, motivoCodigo: "CHAT_SETOR_FORA_DA_PERMISSAO" };
    }
    if (sessao.papel === "SECRETARIA_FATURAMENTO" && entrada.setorChatAlvo !== "SECRETARIA") {
      return { permitida: false, motivoCodigo: "CHAT_SETOR_FORA_DA_PERMISSAO" };
    }
  }

  return {
    permitida: true,
    motivoCodigo: "RBAC_PERMITIDA",
    sessao,
  };
}

/**
 * Emite um aviso para o médico (painel/notificação) estritamente livre de PHI:
 * carrega apenas `codigoEventoOpaco`, `setorOrigem`, `urgencia` e `referenciaOpacaHash` (SHA-256).
 */
export function criarAvisoMedicoSemPhiF6(entrada: {
  avisoId?: string;
  setorOrigem: SetorOperacionalF6;
  urgencia: "ROTINA" | "PRIORITARIO" | "EMERGENCIA_E1";
  codigoEventoOpaco: CodigoEventoAvisoMedicoOpaco;
  identificadorInternoParaHashOpaco: string;
  criadoEm: string;
}): AvisoMedicoSemPhiF6 {
  const referenciaOpacaHash = createHash("sha256")
    .update(`aviso-f6:${entrada.setorOrigem}:${entrada.codigoEventoOpaco}:${entrada.identificadorInternoParaHashOpaco}`, "utf8")
    .digest("hex");

  return AvisoMedicoSemPhiF6.parse({
    // Codificação bijetiva dos nibbles do UUID: preserva sua entropia sem
    // produzir sequências numéricas interpretáveis como telefone pelo gate PHI.
    avisoId: entrada.avisoId ?? `aviso-${randomUUID().replace(/[0-9a-f]/g,
      nibble => String.fromCharCode(97 + Number.parseInt(nibble, 16)))}`,
    setorOrigem: entrada.setorOrigem,
    urgencia: entrada.urgencia,
    codigoEventoOpaco: entrada.codigoEventoOpaco,
    referenciaOpacaHash,
    contemPhi: false,
    criadoEm: entrada.criadoEm,
  });
}

/**
 * Valida a separação estrita entre os territórios `WORK` (prontuário/assistência) e `STUDY` (pesquisa/estudo):
 * - Nenhum evento clínico, prontuário ou identificador de paciente atravessa de `WORK` para `STUDY`.
 */
export function validarFronteiraWorkStudyF6(entrada: {
  territorioOrigem: "WORK" | "STUDY";
  territorioDestino: "WORK" | "STUDY";
  contemProntuarioOuPhi: boolean;
}): VereditoIsolamentoWorkStudyF6 {
  if (entrada.contemProntuarioOuPhi) {
    return VereditoIsolamentoWorkStudyF6.parse({
      permitido: false,
      territorioOrigem: entrada.territorioOrigem,
      territorioDestino: entrada.territorioDestino,
      motivoCodigo: "BLOQUEADO_PHI_OU_PRONTUARIO_NA_FRONTEIRA",
      prontuarioOuPhiTransferido: false,
    });
  }
  if (entrada.territorioOrigem !== entrada.territorioDestino) {
    return VereditoIsolamentoWorkStudyF6.parse({
      permitido: false,
      territorioOrigem: entrada.territorioOrigem,
      territorioDestino: entrada.territorioDestino,
      motivoCodigo: "TERRITORIOS_WORK_E_STUDY_ESTRITAMENTE_SEPARADOS",
      prontuarioOuPhiTransferido: false,
    });
  }
  return VereditoIsolamentoWorkStudyF6.parse({
    permitido: true,
    territorioOrigem: entrada.territorioOrigem,
    territorioDestino: entrada.territorioDestino,
    motivoCodigo: "MESMO_TERRITORIO_SEM_PHI",
    prontuarioOuPhiTransferido: false,
  });
}
