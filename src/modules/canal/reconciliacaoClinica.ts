// S-F2-02 · Vínculo, classificação e reconciliação clínica do canal.
// Função pura: sem I/O, sem promover relato a fato confirmado, sem ativar regras em RASCUNHO.
import {
  AvaliacaoAlarmeCanal,
  PropostaClassificacaoCanal,
  PropostaClassificacaoLlmBrutaSchema,
  VinculoReconciliadoCanal,
  type AlarmeConferidoAtivo,
  type AutorRelatoCanal,
  type CategoriaContatoCanal,
  type ConflitoRelatoCanal,
  type MencaoClinicaCanal,
  type PolaridadeMencaoCanal,
  type TemporalidadeRelatoCanal,
} from "../../contracts/f2/reconciliacaoCanal.js";
import type { CanalFonte } from "../../contracts/f2/canalEntrada.js";
import { resolverVinculo, type CadastroVinculo, type TipoIdentificador } from "./vinculo.js";

export interface RegraAlarmeCanalEntrada {
  id: string;
  termo: string;
  termos: readonly string[];
  orientacao: string;
  status: string; // "RASCUNHO" | "CONFERIDA_MEDICO" | "APROVADO"
  fonte: string;
  limiarDecimosExclusivo: number | null;
}

export interface RulesetAlarmeCanalEntrada {
  rulesetId: string;
  rulesetVersao: string;
  fraseFinal: string;
  sinais: readonly RegraAlarmeCanalEntrada[];
}

export interface ContatoExistenteStatus {
  contatoId: string;
  endereco: string;
  canal: string;
  relacao?: "PACIENTE" | "FAMILIAR" | "CUIDADOR" | "DESCONHECIDO";
  revogadoEm: string | null;
  patientIdVinculadoManual?: string | null;
  conflitoVinculoManual?: boolean;
  candidatosConflitoManual?: readonly string[];
}

const TERMOS_CLINICOS_BASE: ReadonlyArray<{ termo: string; padroes: readonly string[]; temTemperatura?: boolean }> = [
  { termo: "febre", padroes: ["febre", "estado febril", "temperatura"], temTemperatura: true },
  { termo: "falta de ar", padroes: ["falta de ar", "dificuldade respiratoria", "dispneia"] },
  { termo: "sangramento", padroes: ["sangramento", "sangue nas fezes", "sangue na urina"] },
  { termo: "vomito", padroes: ["vomito", "vomitos", "nausea", "enjoo"] },
  { termo: "diarreia", padroes: ["diarreia", "evacuacoes liquidas"] },
  { termo: "dor", padroes: ["dor toracica", "dor no peito", "dor forte", "dor"] },
  { termo: "confusao mental", padroes: ["confusao mental", "convulsao", "desorientado", "desorientada"] },
  { termo: "mucosite", padroes: ["mucosite", "afta", "aftas", "ferida na boca"] },
  { termo: "constipacao", padroes: ["constipacao", "prisao de ventre"] },
];

function semAcento(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/**
 * 1. Resolve vínculo por identificadores exatos.
 * Nome semelhante ou idêntico nunca vincula paciente.
 * Contato desconhecido, compartilhado ou ambíguo permanece em fila de revisão (patientId: null).
 */
export function resolverVinculoReconciliadoCanal(entrada: {
  endereco: string;
  tipo: TipoIdentificador;
  nomeDeclaradoNoRemetente?: string | null;
  chaveDemografica?: string | null;
  cadastros: readonly CadastroVinculo[];
  statusContatoExistente?: ContatoExistenteStatus | null;
}): VinculoReconciliadoCanal {
  if (entrada.statusContatoExistente?.revogadoEm) {
    return VinculoReconciliadoCanal.parse({
      estado: "REVOGADO",
      patientId: null,
      candidatosPatientId: [],
      motivo: "contato revogado; não vincula automaticamente nem permite uso sem nova decisão",
    });
  }
  if (entrada.statusContatoExistente?.conflitoVinculoManual) {
    return VinculoReconciliadoCanal.parse({
      estado: "AMBIGUO",
      patientId: null,
      candidatosPatientId: [...(entrada.statusContatoExistente.candidatosConflitoManual ?? [])],
      motivo: "conflito de decisões anteriores sobre o contato; aguarda revisão médica",
    });
  }
  if (entrada.statusContatoExistente?.patientIdVinculadoManual) {
    return VinculoReconciliadoCanal.parse({
      estado: "VINCULADO",
      patientId: entrada.statusContatoExistente.patientIdVinculadoManual,
      candidatosPatientId: [entrada.statusContatoExistente.patientIdVinculadoManual],
      motivo: "vínculo confirmado por decisão explícita no prontuário",
    });
  }

  // Importante: nomeInformado é explicitamente ignorado por resolverVinculo para impedir vínculo por nome.
  const base = resolverVinculo({
    contatoId: entrada.endereco,
    tipo: entrada.tipo,
    endereco: entrada.endereco,
    nomeInformado: entrada.nomeDeclaradoNoRemetente ?? null,
    chaveDemografica: entrada.chaveDemografica ?? null,
    consentimentoRegistrado: false,
  }, entrada.cadastros);

  if (base.classe === "VINCULO" && base.patientId) {
    return VinculoReconciliadoCanal.parse({
      estado: "VINCULADO",
      patientId: base.patientId,
      candidatosPatientId: [base.patientId],
      motivo: "identificador exato único no cadastro; nome não foi utilizado",
    });
  }

  if (base.classe === "CANDIDATO" || base.patientIds.length > 1 || /compartilhado|mais de um cadastro/.test(base.motivo)) {
    const porId = entrada.cadastros
      .filter((c) => c.identificadores.some((id) => id.tipo === entrada.tipo && id.valor.trim() === entrada.endereco.trim()))
      .map((c) => c.patientId);
    const candidatos = [...new Set([...base.patientIds, ...porId])];
    return VinculoReconciliadoCanal.parse({
      estado: "AMBIGUO",
      patientId: null,
      candidatosPatientId: candidatos,
      motivo: base.motivo,
    });
  }

  return VinculoReconciliadoCanal.parse({
    estado: "FILA_REVISAO",
    patientId: null,
    candidatosPatientId: [],
    motivo: "contato sem identificador exato único; permanece na fila de revisão sem vincular por nome",
  });
}

function detectarAutorRelato(
  textoOriginal: string,
  relacaoCadastrada?: "PACIENTE" | "FAMILIAR" | "CUIDADOR" | "DESCONHECIDO",
  vinculado?: boolean,
): AutorRelatoCanal {
  const norm = semAcento(textoOriginal);
  if (/\b(?:sou cuidador|sou a cuidadora|cuidador d[oa])\b/.test(norm)) return "CUIDADOR";
  if (/\b(?:minha mae|meu pai|minha esposa|meu esposo|meu marido|minha filha|meu filho|minha irma|meu irmao|meu familiar|ela esta|ele esta)\b/.test(norm)) {
    return "FAMILIAR";
  }
  if (relacaoCadastrada && relacaoCadastrada !== "DESCONHECIDO") return relacaoCadastrada;
  if (vinculado) return "PACIENTE";
  return "DESCONHECIDO";
}

function extrairMomentoClinico(textoOriginal: string): {
  temporalidade: TemporalidadeRelatoCanal;
  trechoTemporal: string | null;
} {
  const norm = semAcento(textoOriginal);
  const futuroMatch = /\b(?:se eu tiver|caso eu tenha|caso apareca|se acontecer|o que faco se|duvida se)\b/i.exec(norm);
  if (futuroMatch) {
    return {
      temporalidade: "FUTURO_DUVIDA",
      trechoTemporal: textoOriginal.slice(futuroMatch.index, futuroMatch.index + futuroMatch[0].length),
    };
  }
  const atualMatch = /\b(?:agora|hoje|neste momento|atualmente|desde cedo)\b/i.exec(norm);
  if (atualMatch) {
    return {
      temporalidade: "ATUAL",
      trechoTemporal: textoOriginal.slice(atualMatch.index, atualMatch.index + atualMatch[0].length),
    };
  }
  const passadoMatch = /\b(?:ontem|anteontem|semana passada|mes passado|ha \d+ dias)\b/i.exec(norm);
  if (passadoMatch) {
    return {
      temporalidade: "PASSADO",
      trechoTemporal: textoOriginal.slice(passadoMatch.index, passadoMatch.index + passadoMatch[0].length),
    };
  }
  return { temporalidade: "NAO_INFORMADO", trechoTemporal: null };
}

function extrairTemperaturasDecimos(clausulaNorm: string): number[] {
  const valores: number[] = [];
  const re = /(?:^|[^a-z0-9])(3[5-9]|4[0-2])(?:[.,](\d))?(?:\s*(?:°\s*c|graus|c\b))?/g;
  let m = re.exec(clausulaNorm);
  while (m !== null) {
    const intPart = Number(m[1]);
    const decPart = m[2] !== undefined ? Number(m[2]) : 0;
    const decimos = intPart * 10 + decPart;
    if (decimos >= 350 && decimos <= 430) valores.push(decimos);
    m = re.exec(clausulaNorm);
  }
  return valores;
}

function classificarPolaridadeClausula(clausulaNorm: string, indiceTermo: number): PolaridadeMencaoCanal {
  const antes = clausulaNorm.slice(Math.max(0, indiceTermo - 45), indiceTermo);
  const depois = clausulaNorm.slice(indiceTermo, Math.min(clausulaNorm.length, indiceTermo + 45));
  if (/\b(?:sem|nega|negou|ausencia de|nao\s+(?:estou|esta|tenho|tem|tive|teve|apresento|apresenta|sinto|sente)(?:\s+com)?)\s+(?:(?:qualquer|sinais?\s+de|nenhuma?)\s+)?$/.test(antes)
    || /\b(?:ausente|negad[oa])\b/.test(depois)) {
    return "NEGADO";
  }
  if (/\b(?:sera que|se eu tiver|caso tenha|caso apareca|pode dar|tenho duvida|duvida sobre|hipotese de|suspeita de)\b/.test(clausulaNorm)
    || clausulaNorm.trim().endsWith("?")) {
    return "HIPOTESE_DUVIDA";
  }
  return "AFIRMADO";
}

function classificarTemporalidadeClausula(clausulaNorm: string, global: TemporalidadeRelatoCanal): TemporalidadeRelatoCanal {
  if (/\b(?:se eu tiver|caso tenha|caso apareca|se acontecer)\b/.test(clausulaNorm)) return "FUTURO_DUVIDA";
  if (/\b(?:agora|hoje|neste momento|atualmente)\b/.test(clausulaNorm)) return "ATUAL";
  if (/\b(?:ontem|anteontem|semana passada|mes passado|ha \d+ dias|tive ontem|teve ontem)\b/.test(clausulaNorm)) return "PASSADO";
  return global;
}

export function extrairMencoesClinicasCanal(textoOriginal: string): MencaoClinicaCanal[] {
  const momentoGlobal = extrairMomentoClinico(textoOriginal);
  const clausulas = textoOriginal
    .split(/(?:[.!?\n;]+|\b(?:mas|porém|porem|contudo|entretanto)\b)/i)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  const mencoes: MencaoClinicaCanal[] = [];
  for (const clausula of clausulas) {
    const norm = semAcento(clausula);
    const temps = extrairTemperaturasDecimos(norm);

    for (const def of TERMOS_CLINICOS_BASE) {
      let posMatch = -1;
      for (const padrao of def.padroes) {
        const idx = norm.indexOf(padrao);
        if (idx >= 0) {
          const charAntes = idx === 0 ? " " : norm[idx - 1]!;
          const charDepois = idx + padrao.length >= norm.length ? " " : norm[idx + padrao.length]!;
          if (!/[a-z0-9]/.test(charAntes) && !/[a-z0-9]/.test(charDepois)) {
            posMatch = idx;
            break;
          }
        }
      }
      if (posMatch < 0 && def.temTemperatura && temps.length > 0) {
        posMatch = 0;
      }
      if (posMatch < 0) continue;

      const polaridade = classificarPolaridadeClausula(norm, posMatch);
      const temporalidade = classificarTemporalidadeClausula(norm, momentoGlobal.temporalidade);
      const temperaturaDecimos = def.temTemperatura && temps.length > 0 ? Math.max(...temps) : null;

      mencoes.push({
        termo: def.termo,
        polaridade,
        temporalidade,
        trechoOriginal: clausula.slice(0, 1000),
        temperaturaDecimos,
      });
    }
  }
  return mencoes;
}

function classificarCategoriaDeterministica(
  textoOriginal: string,
  mencoes: readonly MencaoClinicaCanal[],
  ehMidia: boolean,
): CategoriaContatoCanal {
  if (ehMidia) return "ENVIO_EXAME_DOCUMENTO";
  const norm = semAcento(textoOriginal);
  if (mencoes.some((m) => m.polaridade === "AFIRMADO" && m.temporalidade !== "FUTURO_DUVIDA")) {
    return "SINTOMA_INTERCORRENCIA";
  }
  if (/\b(?:anexo|exame|resultado|hemograma|tomografia|ressonancia|laudo|pdf|foto)\b/.test(norm)) {
    return "ENVIO_EXAME_DOCUMENTO";
  }
  if (/\b(?:retorno|consulta|agendar|remarcar|data da consulta|receita|atestado|apac)\b/.test(norm)) {
    return "ADMINISTRATIVO_RETORNO";
  }
  if (/\b(?:duvida|posso comer|posso tomar|orientacao|como tomar|o que fazer)\b/.test(norm) || norm.includes("?")) {
    return "DUVIDA_ORIENTACAO";
  }
  if (mencoes.length > 0) return "SINTOMA_INTERCORRENCIA";
  return "INDEFINIDO";
}

/**
 * Classifica o contato conforme contrato explícito, sem inventar categorias.
 * Se uma proposta de LLM (gerada apenas sobre texto desidentificado) for fornecida,
 * valida seu schema estritamente por código e preserva negações/temporalidade verificadas pelo código.
 */
export function classificarRelatoCanal(entrada: {
  textoOriginal: string;
  ehMidia?: boolean;
  origemCanal: CanalFonte;
  providerSentAt: string | null;
  ingestedAt: string;
  relacaoCadastrada?: "PACIENTE" | "FAMILIAR" | "CUIDADOR" | "DESCONHECIDO";
  vinculado: boolean;
  propostaLlm?: {
    textoDesidentificadoEnviado: string;
    phiEgressPassou: boolean;
    saidaBrutaLlm: unknown;
  } | null;
}): PropostaClassificacaoCanal {
  const mencoesDeterministicas = entrada.ehMidia ? [] : extrairMencoesClinicasCanal(entrada.textoOriginal);
  const momentoDeterministico = entrada.ehMidia
    ? { temporalidade: "NAO_INFORMADO" as const, trechoTemporal: null }
    : extrairMomentoClinico(entrada.textoOriginal);
  const autorDeterministico = detectarAutorRelato(entrada.textoOriginal, entrada.relacaoCadastrada, entrada.vinculado);
  const categoriaDeterministica = classificarCategoriaDeterministica(
    entrada.textoOriginal,
    mencoesDeterministicas,
    entrada.ehMidia === true,
  );

  if (entrada.propostaLlm && entrada.propostaLlm.phiEgressPassou === true) {
    const parsedLlm = PropostaClassificacaoLlmBrutaSchema.safeParse(entrada.propostaLlm.saidaBrutaLlm);
    if (parsedLlm.success) {
      // Assimetria de segurança: a LLM nunca pode converter uma negação ou dúvida determinística em sintoma afirmado.
      const mencoesReconciliadas = mencoesDeterministicas.length > 0
        ? mencoesDeterministicas
        : parsedLlm.data.mencoes;
      return PropostaClassificacaoCanal.parse({
        schema: "PropostaClassificacaoCanal@1",
        modoClassificacao: "LLM_DESIDENTIFICADO_VALIDADO",
        categoria: parsedLlm.data.categoria,
        autorRelato: parsedLlm.data.autorRelato,
        origemCanal: entrada.origemCanal,
        instanteMensagem: {
          providerSentAt: entrada.providerSentAt,
          ingestedAt: entrada.ingestedAt,
        },
        momentoClinicoRelatado: parsedLlm.data.momentoClinicoRelatado,
        mencoes: mencoesReconciliadas,
        textoDesidentificadoEnviadoLlm: entrada.propostaLlm.textoDesidentificadoEnviado,
        phiEgressPassou: true,
      });
    }
  }

  return PropostaClassificacaoCanal.parse({
    schema: "PropostaClassificacaoCanal@1",
    modoClassificacao: "DETERMINISTICO_LOCAL",
    categoria: categoriaDeterministica,
    autorRelato: autorDeterministico,
    origemCanal: entrada.origemCanal,
    instanteMensagem: {
      providerSentAt: entrada.providerSentAt,
      ingestedAt: entrada.ingestedAt,
    },
    momentoClinicoRelatado: momentoDeterministico,
    mencoes: mencoesDeterministicas,
    textoDesidentificadoEnviadoLlm: null,
    phiEgressPassou: true,
  });
}

function regraEstaConferida(regra: RegraAlarmeCanalEntrada): boolean {
  const status = regra.status.trim().toUpperCase();
  const fonteValida = regra.fonte.trim().length > 0 && !regra.fonte.includes("[VERIFICAR]");
  return (status === "CONFERIDA_MEDICO" || status === "APROVADO" || status === "ATIVO") && fonteValida;
}

/**
 * S-F2-02 · Avalia apenas regras de alarme conferidas e versionadas.
 * Regras em RASCUNHO ou ausentes NUNCA são ativadas automaticamente (nem por testes verdes).
 * Negações, relatos no passado e dúvidas hipotéticas não disparam alarme ativo.
 */
export function avaliarAlarmesCanalConferidos(entrada: {
  textoOriginal: string;
  mencoes: readonly MencaoClinicaCanal[];
  patientIdVinculado: string | null;
  autorRelato: AutorRelatoCanal;
  ruleset: RulesetAlarmeCanalEntrada | null | undefined;
}): AvaliacaoAlarmeCanal {
  if (!entrada.ruleset || !entrada.ruleset.rulesetVersao.trim() || entrada.ruleset.sinais.length === 0) {
    return AvaliacaoAlarmeCanal.parse({
      estadoRegras: "RULESET_INDISPONIVEL",
      rulesetVersao: entrada.ruleset?.rulesetVersao?.trim() || "INDISPONIVEL",
      alarmesAtivos: [],
      candidatosRascunhoNaoAtivados: [],
      negadosOuPassadoOuDuvidaNaoDisparam: [],
    });
  }

  const rs = entrada.ruleset;
  const normTexto = semAcento(entrada.textoOriginal);
  const conferidas = rs.sinais.filter(regraEstaConferida);
  const rascunhos = rs.sinais.filter((r) => !regraEstaConferida(r));

  const negadosOuPassadoOuDuvidaNaoDisparam = [
    ...new Set(
      entrada.mencoes
        .filter((m) => m.polaridade !== "AFIRMADO" || m.temporalidade === "PASSADO" || m.temporalidade === "FUTURO_DUVIDA")
        .map((m) => `${m.termo}:${m.polaridade}:${m.temporalidade}`),
    ),
  ];

  const candidatosRascunhoNaoAtivados: string[] = [];
  for (const rascunho of rascunhos) {
    if (sinalCasaAfirmadoAtual(normTexto, entrada.mencoes, rascunho)) {
      candidatosRascunhoNaoAtivados.push(rascunho.id);
    }
  }

  if (conferidas.length === 0) {
    return AvaliacaoAlarmeCanal.parse({
      estadoRegras: "PENDENTE_CURADORIA_MEDICA",
      rulesetVersao: rs.rulesetVersao,
      alarmesAtivos: [],
      candidatosRascunhoNaoAtivados,
      negadosOuPassadoOuDuvidaNaoDisparam,
    });
  }

  const alvo: "PACIENTE" | "CONTATO_NAO_VINCULADO" =
    entrada.patientIdVinculado && entrada.autorRelato === "PACIENTE"
      ? "PACIENTE"
      : "CONTATO_NAO_VINCULADO";

  const alarmesAtivos: AlarmeConferidoAtivo[] = [];
  for (const regra of conferidas) {
    if (!sinalCasaAfirmadoAtual(normTexto, entrada.mencoes, regra)) continue;
    const orientacao = regra.orientacao.endsWith(rs.fraseFinal)
      ? regra.orientacao
      : `${regra.orientacao} ${rs.fraseFinal}`.trim();
    alarmesAtivos.push({
      regraId: regra.id,
      codigo: regra.id,
      termo: regra.termo,
      alvo,
      orientacaoGeral: orientacao,
      exigeAvaliacaoPresencial: true,
      rulesetVersao: rs.rulesetVersao,
    });
  }

  return AvaliacaoAlarmeCanal.parse({
    estadoRegras: "CONFERIDA_ATIVA",
    rulesetVersao: rs.rulesetVersao,
    alarmesAtivos,
    candidatosRascunhoNaoAtivados,
    negadosOuPassadoOuDuvidaNaoDisparam,
  });
}

function sinalCasaAfirmadoAtual(
  normTexto: string,
  mencoes: readonly MencaoClinicaCanal[],
  regra: RegraAlarmeCanalEntrada,
): boolean {
  const termosNorm = regra.termos.map((t) => semAcento(t).trim()).filter(Boolean);
  // Verifica nas menções extraídas primeiro
  const mencoesDoSinal = mencoes.filter((m) => {
    const mNorm = semAcento(m.termo);
    return termosNorm.some((t) => t === mNorm || semAcento(m.trechoOriginal).includes(t));
  });

  if (mencoesDoSinal.length > 0) {
    const afirmadasAtuais = mencoesDoSinal.filter(
      (m) => m.polaridade === "AFIRMADO" && m.temporalidade !== "PASSADO" && m.temporalidade !== "FUTURO_DUVIDA",
    );
    if (afirmadasAtuais.length === 0) return false;
    if (regra.limiarDecimosExclusivo !== null) {
      const comTemp = afirmadasAtuais.filter((m) => m.temperaturaDecimos !== null);
      if (comTemp.length > 0) {
        return comTemp.some((m) => m.temperaturaDecimos! > regra.limiarDecimosExclusivo!);
      }
    }
    return true;
  }

  // Fallback para termos do ruleset que não estão na tabela base de menções
  for (const t of termosNorm) {
    const idx = normTexto.indexOf(t);
    if (idx < 0) continue;
    const antes = idx === 0 ? " " : normTexto[idx - 1]!;
    const depois = idx + t.length >= normTexto.length ? " " : normTexto[idx + t.length]!;
    if (/[a-z0-9]/.test(antes) || /[a-z0-9]/.test(depois)) continue;
    const pol = classificarPolaridadeClausula(normTexto, idx);
    const temp = classificarTemporalidadeClausula(normTexto, "NAO_INFORMADO");
    if (pol !== "AFIRMADO" || temp === "PASSADO" || temp === "FUTURO_DUVIDA") continue;
    if (regra.limiarDecimosExclusivo !== null) {
      const temps = extrairTemperaturasDecimos(normTexto);
      if (temps.length > 0) return temps.some((v) => v > regra.limiarDecimosExclusivo!);
    }
    return true;
  }
  return false;
}

/**
 * Reconcilia menções entre mensagens do mesmo contato/paciente ou contra fatos confirmados anteriores,
 * preservando conflitos explicitamente sem last-write-wins.
 */
export function detectarConflitosRelatoCanal(
  atual: { mensagemId: string; mencoes: readonly MencaoClinicaCanal[] },
  anteriores: ReadonlyArray<{ mensagemId: string; mencoes: readonly MencaoClinicaCanal[] }>,
): ConflitoRelatoCanal[] {
  const conflitos: ConflitoRelatoCanal[] = [];
  const todas = [...anteriores, atual];
  const porTermo = new Map<string, Array<{ mensagemId: string; mencao: MencaoClinicaCanal }>>();

  for (const msg of todas) {
    for (const mencao of msg.mencoes) {
      if (mencao.temporalidade === "PASSADO" || mencao.temporalidade === "FUTURO_DUVIDA") continue;
      if (mencao.polaridade === "HIPOTESE_DUVIDA") continue;
      const lista = porTermo.get(mencao.termo) ?? [];
      lista.push({ mensagemId: msg.mensagemId, mencao });
      porTermo.set(mencao.termo, lista);
    }
  }

  for (const [termo, ocorrencias] of porTermo.entries()) {
    const temAfirmado = ocorrencias.some((o) => o.mencao.polaridade === "AFIRMADO");
    const temNegado = ocorrencias.some((o) => o.mencao.polaridade === "NEGADO");
    const tempsDistintas = [...new Set(ocorrencias.map((o) => o.mencao.temperaturaDecimos).filter((t): t is number => t !== null))];

    if ((temAfirmado && temNegado) || tempsDistintas.length > 1) {
      conflitos.push({
        termo,
        motivo: temAfirmado && temNegado
          ? `relatos conflitantes sobre ${termo} (afirmado × negado no mesmo horizonte temporal)`
          : `temperaturas divergentes relatadas para ${termo} (${tempsDistintas.map((t) => (t / 10).toFixed(1)).join(" °C × ")} °C)`,
        mensagensEnvolvidasIds: [...new Set(ocorrencias.map((o) => o.mensagemId))],
        trechos: ocorrencias.map((o) => o.mencao.trechoOriginal),
      });
    }
  }

  return conflitos;
}
