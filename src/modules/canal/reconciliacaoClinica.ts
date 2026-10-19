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

// Cobertura integral dos 25 sinais de alarme do corpus (D-W9-28 / D-W9-38 / D-W9-75)
const TERMOS_CLINICOS_BASE: ReadonlyArray<{ termo: string; padroes: readonly string[]; temTemperatura?: boolean }> = [
  { termo: "febre", padroes: ["febre", "estado febril", "temperatura"], temTemperatura: true },
  { termo: "falta de ar", padroes: ["falta de ar", "dificuldade respiratoria", "dispneia"] },
  { termo: "alteracao urinaria", padroes: ["parar de urinar", "perder o controle da urina", "ardencia ao urinar"] },
  { termo: "alteracao visual", padroes: ["visao dupla", "visao borrada"] },
  { termo: "dor", padroes: ["dor toracica", "dor no peito", "dor forte", "dor"] },
  { termo: "sangramento", padroes: ["sangramento", "sangue nas fezes", "sangue na urina"] },
  { termo: "confusao mental", padroes: ["confusao mental", "convulsao", "desorientado", "desorientada"] },
  { termo: "fraqueza nas pernas", padroes: ["fraqueza nas pernas", "perda de forca"] },
  { termo: "vomito", padroes: ["vomito", "vomitos", "nausea", "enjoo"] },
  { termo: "diarreia", padroes: ["diarreia", "evacuacoes liquidas"] },
  { termo: "constipacao", padroes: ["constipacao", "prisao de ventre"] },
  { termo: "inchaco", padroes: ["inchaco"] },
  { termo: "mucosite", padroes: ["mucosite", "afta", "aftas", "ferida na boca", "sapinho", "placas brancas"] },
  { termo: "ferida", padroes: ["ferida"] },
  { termo: "picc", padroes: ["picc"] },
  { termo: "local da infusao", padroes: ["local da infusao"] },
  { termo: "neuropatia", padroes: ["neuropatia", "formigamento"] },
  { termo: "atraso menstrual", padroes: ["atraso menstrual"] },
  { termo: "cefaleia", padroes: ["cefaleia", "dor de cabeca"] },
  { termo: "tosse", padroes: ["tosse"] },
  { termo: "cansaco extremo", padroes: ["cansaco extremo", "intolerancia a calor", "intolerancia a frio"] },
  { termo: "ictericia", padroes: ["hipocondrio", "ictericia"] },
  { termo: "artralgia", padroes: ["artralgia"] },
  { termo: "resfriado", padroes: ["resfriado"] },
];

function semAcento(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/**
 * Encontra todas as posições de `padrao` em `norm` respeitando fronteira de palavra alfanumérica.
 * Não para na primeira ocorrência se ela estiver dentro de outra palavra (ex.: "dor" dentro de "cuidador").
 */
function encontrarOcorrenciasComFronteira(norm: string, padrao: string): number[] {
  const alvo = semAcento(padrao).trim();
  if (!alvo) return [];
  const indices: number[] = [];
  let from = 0;
  while (from <= norm.length - alvo.length) {
    const idx = norm.indexOf(alvo, from);
    if (idx < 0) break;
    const charAntes = idx === 0 ? " " : norm[idx - 1]!;
    const charDepois = idx + alvo.length >= norm.length ? " " : norm[idx + alvo.length]!;
    if (!/[a-z0-9]/.test(charAntes) && !/[a-z0-9]/.test(charDepois)) {
      indices.push(idx);
    }
    from = idx + 1;
  }
  return indices;
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

  if (base.classe === "CANDIDATO" || base.patientIds.length > 0 || /compartilhado|mais de um cadastro/.test(base.motivo)) {
    const porId = entrada.cadastros
      .filter((c) => c.identificadores.some((id) => id.tipo === entrada.tipo && id.valor.trim() === entrada.endereco.trim()))
      .map((c) => c.patientId);
    const chaveDemo = entrada.chaveDemografica?.trim() ?? "";
    const porDemo = chaveDemo.length > 0
      ? entrada.cadastros.filter((c) => (c.chaveDemografica?.trim() ?? "") === chaveDemo).map((c) => c.patientId)
      : [];
    const candidatos = [...new Set([...base.patientIds, ...porId, ...porDemo])];
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
  const passadoMatch = /\b(?:ontem|anteontem|semana passada|mes passado|ha \d+ dias)\b/i.exec(norm);
  const atualMatch = /\b(?:agora|hoje|neste momento|atualmente|desde cedo)\b/i.exec(norm);
  if (passadoMatch && !atualMatch) {
    return {
      temporalidade: "PASSADO",
      trechoTemporal: textoOriginal.slice(passadoMatch.index, passadoMatch.index + passadoMatch[0].length),
    };
  }
  if (atualMatch) {
    return {
      temporalidade: "ATUAL",
      trechoTemporal: textoOriginal.slice(atualMatch.index, atualMatch.index + atualMatch[0].length),
    };
  }
  return { temporalidade: "NAO_INFORMADO", trechoTemporal: null };
}

/**
 * Extrai temperaturas em décimos (350..430) evitando falsos positivos com idade ("38 anos"),
 * horário ("14:38"), peso ("42 kg") ou contagens ("40 mil").
 * Exige unidade explícita (°C / graus) OU contexto explícito de febre/temperatura na cláusula.
 */
function extrairTemperaturasDecimos(
  clausulaNorm: string,
  temContextoFebreNaClausula: boolean,
): Array<{ decimos: number; index: number }> {
  const valores: Array<{ decimos: number; index: number }> = [];
  const re = /(?:^|[^a-z0-9:])(3[5-9]|4[0-2])(?:[.,](\d))?(?:\s*(°\s*c|graus?|c\b))?/g;
  let m = re.exec(clausulaNorm);
  while (m !== null) {
    const matchStart = m.index + (m[0].startsWith(m[1]!) ? 0 : 1);
    const depois = clausulaNorm.slice(m.index + m[0].length, m.index + m[0].length + 18);
    // Ignora números seguidos por unidades não térmicas (anos, kg, mg, ml, dias, mil, h, horas, min)
    if (!/^\s*(?:anos?|kg|mg|mcg|ml|dias?|mil|horas?|h\b|min|cp|comprimidos?)\b/.test(depois)) {
      const temDecimal = m[2] !== undefined;
      const temUnidade = m[3] !== undefined;
      if (temUnidade || (temContextoFebreNaClausula && (temDecimal || /\b(?:febre|temperatura|estado febril)\b/.test(clausulaNorm)))) {
        const intPart = Number(m[1]);
        const decPart = m[2] !== undefined ? Number(m[2]) : 0;
        const decimos = intPart * 10 + decPart;
        if (decimos >= 350 && decimos <= 430) {
          valores.push({ decimos, index: matchStart });
        }
      }
    }
    m = re.exec(clausulaNorm);
  }
  return valores;
}

/**
 * Preserva negação direta e coordenada ("sem febre ou sangramento", "não tenho febre nem vômito",
 * "nega febre, náusea e diarreia", "nunca tive febre") e hipótese/dúvida.
 */
function classificarPolaridadeClausula(clausulaNorm: string, indiceTermo: number): PolaridadeMencaoCanal {
  const antes = clausulaNorm.slice(Math.max(0, indiceTermo - 80), indiceTermo);
  const depois = clausulaNorm.slice(indiceTermo, Math.min(clausulaNorm.length, indiceTermo + 45));

  // Se houver operador de negação antes na mesma cláusula (incluindo listas coordenadas com vírgula/e/ou/nem)
  const padraoNegacao = /\b(?:sem|nega|negou|nunca(?:\s+tive|\s+teve|\s+apresentei|\s+apresentou)?|ausencia\s+de|nao\s+(?:estou|esta|tenho|tem|tive|teve|apresento|apresenta|sinto|sente)(?:\s+com)?)\s+(?:[a-z0-9,\s]+?\s+(?:ou|nem|e)\s+|[a-z0-9,\s]{0,35})?$/;
  if (padraoNegacao.test(antes) || /\b(?:ausente|negad[oa])\b/.test(depois)) {
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
  if (/\b(?:ontem|anteontem|semana passada|mes passado|ha \d+ dias|tive ontem|teve ontem)\b/.test(clausulaNorm)) return "PASSADO";
  if (/\b(?:agora|hoje|neste momento|atualmente)\b/.test(clausulaNorm)) return "ATUAL";
  return global;
}

function dividirEmClausulas(textoOriginal: string): string[] {
  return textoOriginal
    .split(/(?:[.!?\n;]+|\b(?:mas|porém|porem|contudo|entretanto)\b)/i)
    .map((c, idx, arr) => {
      // Preserva ponto de interrogação se a cláusula original era uma pergunta
      const posFim = textoOriginal.indexOf(c) + c.length;
      const pontuacao = textoOriginal[posFim] === "?" ? "?" : "";
      void idx; void arr;
      return (c.trim() + pontuacao).trim();
    })
    .filter((c) => c.length > 0 && c !== "?");
}

export function extrairMencoesClinicasCanal(textoOriginal: string): MencaoClinicaCanal[] {
  const momentoGlobal = extrairMomentoClinico(textoOriginal);
  const clausulas = dividirEmClausulas(textoOriginal);

  const mencoes: MencaoClinicaCanal[] = [];
  for (const clausula of clausulas) {
    const norm = semAcento(clausula);

    for (const def of TERMOS_CLINICOS_BASE) {
      let indicesMatch: number[] = [];
      for (const padrao of def.padroes) {
        const encontrados = encontrarOcorrenciasComFronteira(norm, padrao);
        if (encontrados.length > 0) {
          indicesMatch = encontrados;
          break;
        }
      }

      const temps = def.temTemperatura ? extrairTemperaturasDecimos(norm, indicesMatch.length > 0) : [];
      if (indicesMatch.length === 0 && def.temTemperatura && temps.length > 0) {
        indicesMatch = [temps[0]!.index];
      }
      if (indicesMatch.length === 0) continue;

      const posMatch = indicesMatch[0]!;
      const polaridade = classificarPolaridadeClausula(norm, posMatch);
      const temporalidade = classificarTemporalidadeClausula(norm, momentoGlobal.temporalidade);
      const temperaturaDecimos = def.temTemperatura && temps.length > 0
        ? Math.max(...temps.map((t) => t.decimos))
        : null;

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
 * Valida qualquer menção proposta pela LLM contra o texto original:
 * - Impede menção alucinada (termo/trecho deve existir no texto original).
 * - Recalcula polaridade e temporalidade na cláusula para impedir que a LLM converta negação/dúvida/passado em AFIRMADO+ATUAL.
 */
function reconciliarMencoesLlmComDeterministicas(
  textoOriginal: string,
  mencoesDeterministicas: readonly MencaoClinicaCanal[],
  mencoesLlm: readonly MencaoClinicaCanal[],
  momentoGlobal: TemporalidadeRelatoCanal,
): MencaoClinicaCanal[] {
  const resultado = [...mencoesDeterministicas];
  const normOriginal = semAcento(textoOriginal);

  for (const mLlm of mencoesLlm) {
    const jaExiste = resultado.some((d) => semAcento(d.termo) === semAcento(mLlm.termo));
    if (jaExiste) continue;

    const termoNorm = semAcento(mLlm.termo).trim();
    const ocorrencias = encontrarOcorrenciasComFronteira(normOriginal, termoNorm);
    if (ocorrencias.length === 0) {
      // Menção não encontrada no texto original -> descartada como alucinação
      continue;
    }

    const pos = ocorrencias[0]!;
    const polDeterministica = classificarPolaridadeClausula(normOriginal, pos);
    const tempDeterministica = classificarTemporalidadeClausula(normOriginal, momentoGlobal);

    resultado.push({
      ...mLlm,
      polaridade: polDeterministica !== "AFIRMADO" ? polDeterministica : mLlm.polaridade,
      temporalidade:
        tempDeterministica === "PASSADO" || tempDeterministica === "FUTURO_DUVIDA"
          ? tempDeterministica
          : mLlm.temporalidade,
    });
  }

  return resultado;
}

/**
 * Classifica o contato conforme contrato explícito, sem inventar categorias.
 * Se uma proposta de LLM (gerada apenas sobre texto desidentificado) for fornecida,
 * valida seu schema estritamente por código e preserva negações/temporalidade/autoria verificadas pelo código.
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
      const mencoesReconciliadas = reconciliarMencoesLlmComDeterministicas(
        entrada.textoOriginal,
        mencoesDeterministicas,
        parsedLlm.data.mencoes,
        momentoDeterministico.temporalidade,
      );

      // A LLM nunca pode promover FAMILIAR/CUIDADOR ou contato não vinculado a PACIENTE
      const autorReconciliado: AutorRelatoCanal =
        autorDeterministico === "FAMILIAR" || autorDeterministico === "CUIDADOR" || !entrada.vinculado
          ? autorDeterministico
          : parsedLlm.data.autorRelato;

      // A LLM nunca pode sobrescrever PASSADO ou FUTURO_DUVIDA determinístico para ATUAL
      const momentoReconciliado =
        momentoDeterministico.temporalidade === "PASSADO" || momentoDeterministico.temporalidade === "FUTURO_DUVIDA"
          ? momentoDeterministico
          : parsedLlm.data.momentoClinicoRelatado;

      return PropostaClassificacaoCanal.parse({
        schema: "PropostaClassificacaoCanal@1",
        modoClassificacao: "LLM_DESIDENTIFICADO_VALIDADO",
        categoria: parsedLlm.data.categoria,
        autorRelato: autorReconciliado,
        origemCanal: entrada.origemCanal,
        instanteMensagem: {
          providerSentAt: entrada.providerSentAt,
          ingestedAt: entrada.ingestedAt,
        },
        momentoClinicoRelatado: momentoReconciliado,
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
    if (sinalCasaAfirmadoAtual(entrada.textoOriginal, entrada.mencoes, rascunho)) {
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
    if (!sinalCasaAfirmadoAtual(entrada.textoOriginal, entrada.mencoes, regra)) continue;
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
  textoOriginal: string,
  mencoes: readonly MencaoClinicaCanal[],
  regra: RegraAlarmeCanalEntrada,
): boolean {
  const termosNorm = regra.termos.map((t) => semAcento(t).trim()).filter(Boolean);
  const mencoesDoSinal = mencoes.filter((m) => {
    const mNorm = semAcento(m.termo);
    return termosNorm.some((t) => t === mNorm || encontrarOcorrenciasComFronteira(semAcento(m.trechoOriginal), t).length > 0);
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

  // Fallback por cláusula (nunca sobre a mensagem inteira concatenada)
  const clausulas = dividirEmClausulas(textoOriginal);
  const momentoGlobal = extrairMomentoClinico(textoOriginal).temporalidade;
  for (const clausula of clausulas) {
    const normClausula = semAcento(clausula);
    for (const t of termosNorm) {
      const ocorrencias = encontrarOcorrenciasComFronteira(normClausula, t);
      for (const idx of ocorrencias) {
        const pol = classificarPolaridadeClausula(normClausula, idx);
        const temp = classificarTemporalidadeClausula(normClausula, momentoGlobal);
        if (pol !== "AFIRMADO" || temp === "PASSADO" || temp === "FUTURO_DUVIDA") continue;
        if (regra.limiarDecimosExclusivo !== null) {
          const temps = extrairTemperaturasDecimos(normClausula, true);
          if (temps.length > 0) {
            if (temps.some((v) => v.decimos > regra.limiarDecimosExclusivo!)) return true;
            continue;
          }
        }
        return true;
      }
    }
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
