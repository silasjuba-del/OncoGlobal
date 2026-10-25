// F5 · Anamnese guiada por roteiro aprovado (AG-19), guarda adversarial A13 (paciente pede dose/conduta),
// compilação de resumo estruturado com fontes/lacunas/incertezas e bloqueio de ato médico de teleconsulta sem CFM/LGPD.
import { FRASE_FINAL_D_W9_75 } from "../../contracts/f2/caixaRespostaCanal.js";
import {
  ResumoEstruturadoAnamnese,
  RoteiroAnamneseTumor,
  type PassoRoteiroAnamnese,
  type RespostaPassoAnamnese,
} from "../../contracts/f5/anamneseEOncoChief.js";

const PADROES_PEDIDO_TERAPEUTICO_PACIENTE = [
  /\b(?:qual\s+a\s+dose|quantos?\s+mg|quantos?\s+comprimidos?|posso\s+aumentar\s+a\s+dose|posso\s+dobrar\s+a\s+dose|qual\s+remedio\s+tomo|me\s+receita|me\s+prescreve|qual\s+meu\s+diagnostico)\b/i,
];

const PADROES_PROIBIDOS_REFORMULACAO_BOT = [
  /\b(?:\d+\s*(?:mg|mcg|ug|g|ml|cp|comprimidos?|capsulas?)|tome|inicie|prescrevo|receito|seu\s+diagnostico\s+e)\b/i,
];

function semAcento(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/**
 * Valida se o roteiro de anamnese está aprovado pelo médico (`CONFERIDA_MEDICO`) antes de permitir uso no canal.
 */
export function admitirRoteiroAnamneseAprovado(candidato: unknown):
  | { ok: true; roteiro: RoteiroAnamneseTumor }
  | { ok: false; codigo: "ROTEIRO_INVALIDO" | "ROTEIRO_EM_RASCUNHO_NAO_AUTORIZADO" } {
  const parsed = RoteiroAnamneseTumor.safeParse(candidato);
  if (!parsed.success) return { ok: false, codigo: "ROTEIRO_INVALIDO" };
  if (parsed.data.statusCuradoria !== "CONFERIDA_MEDICO") {
    return { ok: false, codigo: "ROTEIRO_EM_RASCUNHO_NAO_AUTORIZADO" };
  }
  return { ok: true, roteiro: parsed.data };
}

/**
 * AG-19 · Prepara a pergunta de um passo do roteiro aprovado:
 * - Se houver reformulação por LLM (sem PHI), verifica que a reformulação não prescreve, não sugere dose e não diagnostica.
 * - Caso a reformulação viole qualquer regra, usa a `perguntaCanonica` aprovada no roteiro.
 */
export function obterPerguntaPassoRoteiro(
  passo: PassoRoteiroAnamnese,
  reformulacaoCandidataLlmSemPhi?: string | null,
): {
  passoId: string;
  textoPergunta: string;
  usouReformulacaoLlm: boolean;
} {
  if (reformulacaoCandidataLlmSemPhi && reformulacaoCandidataLlmSemPhi.trim()) {
    const candidata = reformulacaoCandidataLlmSemPhi.trim();
    const norm = semAcento(candidata);
    if (!PADROES_PROIBIDOS_REFORMULACAO_BOT.some((re) => re.test(norm)) && candidata.length <= 1000) {
      return {
        passoId: passo.passoId,
        textoPergunta: candidata,
        usouReformulacaoLlm: true,
      };
    }
  }
  return {
    passoId: passo.passoId,
    textoPergunta: passo.perguntaCanonica,
    usouReformulacaoLlm: false,
  };
}

/**
 * Ataque adversarial A13 (F5): se o paciente pedir dose, prescrição, ajuste de medicamento ou diagnóstico pelo canal,
 * o assistente NUNCA orienta tratamento/dose/diagnóstico — devolve resposta fixa de segurança e escalona ao médico.
 */
export function verificarPedidoTerapeuticoNaAnamnese(mensagemPaciente: string): {
  pediuCondutaOuDose: boolean;
  respostaFixaSeguranca: string | null;
  escalonarAoMedico: boolean;
} {
  const norm = semAcento(mensagemPaciente);
  if (PADROES_PEDIDO_TERAPEUTICO_PACIENTE.some((re) => re.test(norm))) {
    return {
      pediuCondutaOuDose: true,
      respostaFixaSeguranca:
        `O canal automático coleta apenas informações de anamnese e não indica doses, medicamentos ou diagnósticos. Sua dúvida foi encaminhada ao médico assistente. ${FRASE_FINAL_D_W9_75}`,
      escalonarAoMedico: true,
    };
  }
  return {
    pediuCondutaOuDose: false,
    respostaFixaSeguranca: null,
    escalonarAoMedico: false,
  };
}

/** Partes ordenadas, sem truncamento nem separação de pares UTF-16. */
function dividirTexto(texto: string, limite: number): string[] {
  const partes: string[] = [];
  let inicio = 0;
  while (inicio < texto.length) {
    let fim = Math.min(inicio + limite, texto.length);
    const ultimo = texto.charCodeAt(fim - 1);
    if (fim < texto.length && ultimo >= 0xD800 && ultimo <= 0xDBFF
      && texto.charCodeAt(fim) >= 0xDC00 && texto.charCodeAt(fim) <= 0xDFFF) fim--;
    partes.push(texto.slice(inicio, fim));
    inicio = fim;
  }
  return partes;
}

/**
 * Compila o resumo estruturado da anamnese guiada (F5):
 * - Preserva fontes, lacunas (passos obrigatórios não respondidos ou documentos faltantes), incertezas e negações;
 * - Mantém `avaliacaoMedicaConcluida: false`, `defineDiagnostico: false`, `defineDoseOuPrescricao: false`, `revisao: "REVISAR"`.
 */
export function compilarResumoEstruturadoAnamnese(entrada: {
  sessaoAnamneseId: string;
  patientId: string;
  contatoId: string;
  roteiro: RoteiroAnamneseTumor;
  respostas: readonly RespostaPassoAnamnese[];
  alertasRedFlag?: readonly string[];
  geradoEm: string;
}): ResumoEstruturadoAnamnese {
  const respostasPorPasso = new Map<string, RespostaPassoAnamnese[]>();
  for (const r of entrada.respostas) {
    const respostas = respostasPorPasso.get(r.passoId) ?? [];
    respostas.push(r);
    respostasPorPasso.set(r.passoId, respostas);
  }

  const itensColetados: ResumoEstruturadoAnamnese["itensColetados"] = [];
  const documentosSolicitadosPendentes: string[] = [];
  const lacunasExplicitas: string[] = [];
  const incertezasExplicitas: string[] = [];
  const negacoesPreservadas: string[] = [];
  const alertasEscalonamentoMedico: string[] = [];

  for (const passo of entrada.roteiro.passos) {
    const respostas = respostasPorPasso.get(passo.passoId) ?? [];
    if (respostas.length > 1) {
      incertezasExplicitas.push(`A CONFERIR: múltiplas respostas para o passo "${passo.passoId}"; nenhum relato substitui outro.`);
    }
    for (const resp of respostas.length ? respostas : [undefined]) {
      if (!resp || resp.polaridade === "NAO_RESPONDIDO") {
        if (passo.obrigatorioParaResumo) {
          lacunasExplicitas.push(`${passo.dominioClinico}: passo obrigatório "${passo.passoId}" não respondido`);
        }
        if (passo.tipo === "SOLICITACAO_DOCUMENTO_EXAME" || passo.tipo === "SOLICITACAO_FOTO_LESAO_OU_RECEITA") {
          documentosSolicitadosPendentes.push(passo.passoId);
        }
        continue;
      }

      if ((passo.tipo === "SOLICITACAO_DOCUMENTO_EXAME" || passo.tipo === "SOLICITACAO_FOTO_LESAO_OU_RECEITA")
        && !resp.documentoOuFotoRef) {
        documentosSolicitadosPendentes.push(passo.passoId);
        lacunasExplicitas.push(`${passo.dominioClinico}: documento/foto solicitado em "${passo.passoId}" ainda não anexado`);
      }

      if (resp.polaridade === "INCERTO_DUVIDA") {
        incertezasExplicitas.push(`${passo.dominioClinico}: relato com incerteza/dúvida ("${resp.respostaLiteral}")`);
      }
      if (resp.polaridade === "NEGADO") {
        negacoesPreservadas.push(`${passo.dominioClinico}: negado pelo relato ("${resp.respostaLiteral}")`);
      }

      const pedidoTerapeutico = verificarPedidoTerapeuticoNaAnamnese(resp.respostaLiteral);
      if (pedidoTerapeutico.pediuCondutaOuDose) {
        alertasEscalonamentoMedico.push(`Solicitação de dose/conduta detectada no passo ${passo.passoId}: requer resposta médica.`);
      }

      for (const parte of dividirTexto(resp.respostaLiteral, 1000)) {
        itensColetados.push({
          passoId: passo.passoId,
          dominioClinico: passo.dominioClinico,
          resumoItem: parte,
          polaridade: resp.polaridade,
          fonte: resp.fonte,
        });
      }
    }
  }

  const passosConhecidos = new Set(entrada.roteiro.passos.map(p => p.passoId));
  for (const resposta of entrada.respostas) {
    if (!passosConhecidos.has(resposta.passoId)) {
      lacunasExplicitas.push(`A CONFERIR: resposta do passo "${resposta.passoId}" ausente do roteiro; registro integral em respostasOriginais.`);
    }
  }

  return ResumoEstruturadoAnamnese.parse({
    schema: "ResumoEstruturadoAnamnese@1",
    sessaoAnamneseId: entrada.sessaoAnamneseId,
    patientId: entrada.patientId,
    contatoId: entrada.contatoId,
    roteiroId: entrada.roteiro.roteiroId,
    roteiroVersao: entrada.roteiro.versao,
    tumorPackId: entrada.roteiro.tumorPackId,
    respostasOriginais: [...entrada.respostas],
    itensColetados,
    documentosSolicitadosPendentes,
    lacunasExplicitas: lacunasExplicitas.flatMap(texto => dividirTexto(texto, 500)),
    incertezasExplicitas: incertezasExplicitas.flatMap(texto => dividirTexto(texto, 500)),
    negacoesPreservadas: negacoesPreservadas.flatMap(texto => dividirTexto(texto, 500)),
    alertasEscalonamentoMedico: alertasEscalonamentoMedico.flatMap(texto => dividirTexto(texto, 500)),
    alertasInformadosNaoVerificados:(entrada.alertasRedFlag??[]).filter(t=>t.trim().length>0).flatMap(t=>dividirTexto(t,500)),
    // Curadoria não comprova entrega ao paciente.
    orientacoesFixasEntreguesIds: [],
    avaliacaoMedicaConcluida: false,
    defineDiagnostico: false,
    defineDoseOuPrescricao: false,
    revisao: "REVISAR",
    geradoEm: entrada.geradoEm,
  });
}

/**
 * Gate regulatório F5 (CFM 2.314/2022 + LGPD / Q41 / R-21):
 * Teleconsulta assíncrona com ato médico exige enquadramento normativo e autorização explícita;
 * a anamnese guiada pelo canal NUNCA constitui ato médico nem teleconsulta concluída.
 */
export function autorizarTeleconsultaComAtoMedicoF5(entrada: {
  enquadramentoCfmLgpdAprovado: boolean;
  termoConsentimentoTelemedicinaRef: string | null;
  medicoComCrmNaSessao: boolean;
}):
  | { ok: false; codigo: "TELECONSULTA_ATO_MEDICO_NAO_HABILITADO_CFM_LGPD" | "CONSENTIMENTO_TELEMEDICINA_AUSENTE" | "ATO_MEDICO_EXIGE_MEDICO_NA_SESSAO" }
  | { ok: true; autorizado: true } {
  if (!entrada.enquadramentoCfmLgpdAprovado) {
    return { ok: false, codigo: "TELECONSULTA_ATO_MEDICO_NAO_HABILITADO_CFM_LGPD" };
  }
  if (!entrada.termoConsentimentoTelemedicinaRef || !entrada.termoConsentimentoTelemedicinaRef.trim()) {
    return { ok: false, codigo: "CONSENTIMENTO_TELEMEDICINA_AUSENTE" };
  }
  if (!entrada.medicoComCrmNaSessao) {
    return { ok: false, codigo: "ATO_MEDICO_EXIGE_MEDICO_NA_SESSAO" };
  }
  return { ok: true, autorizado: true };
}
