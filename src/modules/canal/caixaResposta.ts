// S-F2-03 · Regras puras para orientação geral por cenário (D-W9-75),
// validação de resposta médica, estados de recibo técnico × conversa,
// e integração de ContactSummary à pré-consulta/cabeçalho sem apagar histórico.
import { createHash } from "node:crypto";
import {
  EstadoOperacionalMensagemCanal,
  FRASE_FINAL_D_W9_75,
  ResumoContatoIntegradoPreConsulta,
  type MensagemOriginalResumoCanal,
} from "../../contracts/f2/caixaRespostaCanal.js";
import type { CanalFonte, EstadoReciboCanal, EstadoVinculoContatoEntrada } from "../../contracts/f2/canalEntrada.js";
import type { EstadoConversa } from "../../contracts/estados.js";
import { hashCanonico } from "../hash.js";

// Proibições estritas da D-W9-75b em orientações gerais por cenário:
// nunca prescrever dose, posologia, início de medicamento ou diagnóstico.
const PADROES_PROIBIDOS_ORIENTACAO_GERAL: ReadonlyArray<{ codigo: string; regex: RegExp }> = [
  { codigo: "DOSE_NUMERICA_PROIBIDA", regex: /\b\d+\s*(?:mg|mcg|ug|g|ml|ui|cp|comprimidos?|capsulas?|gotas?)\b/i },
  { codigo: "POSOLOGIA_PROIBIDA", regex: /\b(?:de\s+\d+\s+em\s+\d+\s*h(?:oras)?|\d+\s*x\s*ao\s*dia|a\s+cada\s+\d+\s*h(?:oras)?)\b/i },
  { codigo: "INICIO_MEDICAMENTO_PROIBIDO", regex: /\b(?:inicie|iniciar|comece\s+a\s+tomar|tome|prescrevo)\s+[a-záàâãéêíóôõúç]{3,}/i },
  { codigo: "DIAGNOSTICO_DEFINITIVO_PROIBIDO", regex: /\b(?:seu\s+diagnostico\s+e|confirmo\s+diagnostico\s+de|voce\s+esta\s+com\s+progressao\s+tumoral)\b/i },
];

export type ValidacaoOrientacaoCenario =
  | { ok: true; textoValidado: string; conteudoSha256: string }
  | {
    ok: false;
    codigo:
      | "CENARIO_NAO_CURADO_PELO_MEDICO"
      | "ORIENTACAO_VAZIA"
      | "FALTA_FRASE_FINAL_D_W9_75"
      | "DOSE_NUMERICA_PROIBIDA"
      | "POSOLOGIA_PROIBIDA"
      | "INICIO_MEDICAMENTO_PROIBIDO"
      | "DIAGNOSTICO_DEFINITIVO_PROIBIDO";
  };

/**
 * D-W9-75b · Valida orientação geral por cenário:
 * - Exige curadoria médica explícita (`status === "CONFERIDA_MEDICO"`).
 * - Proíbe dose, posologia, início de medicamento e diagnóstico.
 * - Exige encerramento literal com "Nada substitui a avaliação presencial do seu médico."
 */
export function validarOrientacaoGeralPorCenario(entrada: {
  cenarioId: string;
  statusCuradoria: "CONFERIDA_MEDICO" | "RASCUNHO" | string;
  textoOrientacao: string;
}): ValidacaoOrientacaoCenario {
  if (entrada.statusCuradoria !== "CONFERIDA_MEDICO") {
    return { ok: false, codigo: "CENARIO_NAO_CURADO_PELO_MEDICO" };
  }
  const limpo = entrada.textoOrientacao.trim();
  if (!limpo) return { ok: false, codigo: "ORIENTACAO_VAZIA" };

  for (const regra of PADROES_PROIBIDOS_ORIENTACAO_GERAL) {
    if (regra.regex.test(limpo)) {
      return { ok: false, codigo: regra.codigo as Extract<ValidacaoOrientacaoCenario, { ok: false }>["codigo"] };
    }
  }

  if (!limpo.endsWith(FRASE_FINAL_D_W9_75)) {
    return { ok: false, codigo: "FALTA_FRASE_FINAL_D_W9_75" };
  }

  return {
    ok: true,
    textoValidado: limpo,
    conteudoSha256: createHash("sha256").update(limpo, "utf8").digest("hex"),
  };
}

/**
 * Calcula o estado operacional da conversa garantindo que:
 * - Acuso de recebimento ou recibo técnico (RECEBIDA/PROCESSADA/ENVIADA/ENTREGUE) nunca encerra a conversa;
 * - Recibo técnico nunca comprova atendimento clínico;
 * - Mensagem enviada nunca significa conduta clínica executada.
 */
export function projetarEstadoOperacionalMensagem(entrada: {
  mensagemId: string;
  reciboTecnico: EstadoReciboCanal;
  triada: boolean;
  aguardaMedico: boolean;
  respostaMedicaEnviada: boolean;
  encerradaExplicitamentePeloMedico: boolean;
  acusoRecebimentoEnviado: boolean;
}): EstadoOperacionalMensagemCanal {
  let estadoConversa: EstadoConversa = "NOVA";
  if (entrada.encerradaExplicitamentePeloMedico) {
    estadoConversa = "ENCERRADA";
  } else if (entrada.respostaMedicaEnviada) {
    estadoConversa = "RESPONDIDA";
  } else if (entrada.aguardaMedico) {
    estadoConversa = "AGUARDA_MEDICO";
  } else if (entrada.triada) {
    estadoConversa = "TRIADA";
  }

  return EstadoOperacionalMensagemCanal.parse({
    mensagemId: entrada.mensagemId,
    reciboTecnico: entrada.reciboTecnico,
    estadoConversa,
    acusoRecebimentoEnviado: entrada.acusoRecebimentoEnviado,
    conversaEncerradaPorAcuso: false,
    atendimentoClinicoComprovadoPorRecibo: false,
    condutaClinicaExecutadaPorEnvio: false,
  });
}

export interface MensagemEntradaResumo {
  mensagemId: string;
  providerMessageId: string;
  canal: CanalFonte;
  contatoId: string;
  patientId: string | null;
  estadoVinculo: EstadoVinculoContatoEntrada;
  senderRef: string;
  providerSentAt: string | null;
  ingestedAt: string;
  reciboTecnico: EstadoReciboCanal;
  conteudo:
    | { tipo: "TEXT"; texto: string }
    | {
      tipo: "MEDIA_UNPROCESSED";
      providerMediaId: string;
      mimeType: string | null;
      processamento: "NAO_PROCESSADA" | "LIDA_LOCALMENTE";
      sha256LocalComprovado: string | null;
    };
}

/**
 * Monta o ContactSummary integrado à pré-consulta e ao cabeçalho, preservando todo o histórico,
 * destacando o que aconteceu desde a consulta anterior e mantendo acesso às mensagens originais.
 * Recalcula apenas quando a revisão de entrada (`revisaoEntradaHash`) muda.
 */
export function montarResumosContatoPreConsulta(entrada: {
  mensagens: readonly MensagemEntradaResumo[];
  ultimaConsultaConfirmadaEm: string | null;
  cacheAnterior?: ReadonlyMap<string, ResumoContatoIntegradoPreConsulta>;
}): {
  resumosPorContato: ResumoContatoIntegradoPreConsulta[];
  recalculados: number;
  reutilizadosDoCache: number;
} {
  const porContato = new Map<string, MensagemEntradaResumo[]>();
  for (const msg of entrada.mensagens) {
    const chave = `${msg.canal}:${msg.contatoId}`;
    const lista = porContato.get(chave) ?? [];
    lista.push(msg);
    porContato.set(chave, lista);
  }

  const corteMs = entrada.ultimaConsultaConfirmadaEm ? Date.parse(entrada.ultimaConsultaConfirmadaEm) : null;
  const resumosPorContato: ResumoContatoIntegradoPreConsulta[] = [];
  let recalculados = 0;
  let reutilizadosDoCache = 0;

  for (const [chave, lista] of porContato.entries()) {
    const ordenadas = [...lista].sort((a, b) => {
      const tA = a.providerSentAt ?? a.ingestedAt;
      const tB = b.providerSentAt ?? b.ingestedAt;
      return tA.localeCompare(tB) || a.mensagemId.localeCompare(b.mensagemId);
    });

    const revisaoEntradaHash = hashCanonico({
      ultimaConsultaConfirmadaEm: entrada.ultimaConsultaConfirmadaEm,
      itens: ordenadas.map((m) => ({
        mensagemId: m.mensagemId,
        patientId: m.patientId,
        estadoVinculo: m.estadoVinculo,
        reciboTecnico: m.reciboTecnico,
        conteudo: m.conteudo,
      })),
    });

    const emCache = entrada.cacheAnterior?.get(chave);
    if (emCache && emCache.revisaoEntradaHash === revisaoEntradaHash) {
      resumosPorContato.push(emCache);
      reutilizadosDoCache += 1;
      continue;
    }

    recalculados += 1;
    const primeira = ordenadas[0]!;
    const ultima = ordenadas.at(-1)!;
    const ultimaEm = ultima.providerSentAt ?? ultima.ingestedAt;

    const mensagensOriginais: MensagemOriginalResumoCanal[] = ordenadas.map((m) => {
      const instante = m.providerSentAt ?? m.ingestedAt;
      const novaDesdeUltimaConsulta = corteMs === null || Date.parse(instante) > corteMs;
      return {
        mensagemId: m.mensagemId,
        providerMessageId: m.providerMessageId,
        canal: m.canal,
        senderRef: m.senderRef,
        providerSentAt: m.providerSentAt,
        ingestedAt: m.ingestedAt,
        novaDesdeUltimaConsulta,
        reciboTecnico: m.reciboTecnico,
        conteudoResumo: m.conteudo.tipo === "TEXT"
          ? m.conteudo.texto.slice(0, 280)
          : `[Mídia ${m.conteudo.processamento === "LIDA_LOCALMENTE" ? "lida localmente" : "não processada"}: ${m.conteudo.mimeType ?? "arquivo"}]`,
        midia: m.conteudo.tipo === "TEXT"
          ? null
          : {
            providerMediaId: m.conteudo.providerMediaId,
            mimeType: m.conteudo.mimeType,
            processamento: m.conteudo.processamento,
            sha256LocalComprovado: m.conteudo.sha256LocalComprovado,
          },
      };
    });

    const novas = mensagensOriginais.filter((m) => m.novaDesdeUltimaConsulta);
    const resumoTexto = novas.length > 0
      ? `${novas.length} mensagem(ns) desde a última consulta · última: ${novas.at(-1)!.conteudoResumo}`.slice(0, 500)
      : `Sem mensagens novas desde a última consulta (${ordenadas.length} no histórico preservado)`.slice(0, 500);

    resumosPorContato.push(
      ResumoContatoIntegradoPreConsulta.parse({
        contatoId: primeira.contatoId,
        patientId: primeira.patientId,
        canal: primeira.canal,
        estadoVinculo: primeira.estadoVinculo,
        quantidadeTotalMensagens: ordenadas.length,
        quantidadeNovasDesdeUltimaConsulta: novas.length,
        ultimaMensagemEm: ultimaEm,
        resumoTexto,
        mensagensOriginaisIds: mensagensOriginais.map((m) => m.mensagemId),
        mensagensOriginais,
        revisaoEntradaHash,
      }),
    );
  }

  return { resumosPorContato, recalculados, reutilizadosDoCache };
}
