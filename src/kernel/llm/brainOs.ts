import { createHash } from "node:crypto";
import {
  PropostaBrainOsSchema,
  type AmbiguidadeBrain,
  type ExclusaoReferenciaBrain,
  type InclusaoMesaBrain,
  type ItemPropostoBrain,
  type LacunaBrain,
  type PropostaBrainOs,
} from "../../contracts/brainOs.js";

const sha256 = (texto: string): string => createHash("sha256").update(texto, "utf8").digest("hex");

const CHAVES_PROIBIDAS_CREDENCIAIS = /^(?:api[_-]?key|secret|token|senha|password|authorization|bearer|credential|private[_-]?key)$/i;
const CHAVES_PROIBIDAS_ESCRITA = /^(?:db|database|sqlite|write|writer|salvar|confirmar|executar|persist|persistir|gateway)$/i;

export interface FonteEntradaBrainOs {
  sourceId: string;
  versao: string;
  conteudo: string;
  localizadorPadrao?: string | null;
}

export interface ReferenciaCandidataBrainOs {
  referenciaId: string;
  versao: string;
  status: "CONSULTAVEL" | "RASCUNHO" | "OBSOLETO" | "ALERTA";
  escopoCompativel: boolean;
  provenienciaCompleta: boolean;
  termosChave: readonly string[];
  motivoInclusaoSeAplicavel: string;
}

export interface CandidatoExtracaoBrainOs {
  campo: string;
  valor: string | number;
  unidade?: string | null;
  qualificador?: "AFIRMADO" | "NEGADO" | "INCERTO" | "HISTORICO" | "TERCEIRO";
  criticoNumero?: boolean;
  sourceId: string;
  trecho: string;
  localizador?: string | null;
}

export interface EntradaBrainOs {
  propostaId: string;
  patientId?: string | null;
  encounterId?: string | null;
  agora: string;
  fontes: readonly FonteEntradaBrainOs[];
  referenciasCandidatas?: readonly ReferenciaCandidataBrainOs[];
  candidatos?: readonly CandidatoExtracaoBrainOs[];
  camposObrigatorios?: readonly { campo: string; obrigatoriedade: "CRITICA" | "RELEVANTE"; motivo: string }[];
}

function inspecionarProibicoes(valor: unknown, visitados = new Set<unknown>()): void {
  if (!valor || typeof valor !== "object") return;
  if (visitados.has(valor)) return;
  visitados.add(valor);
  for (const [chave, filho] of Object.entries(valor as Record<string, unknown>)) {
    if (CHAVES_PROIBIDAS_CREDENCIAIS.test(chave)) {
      throw new Error("BRAIN_OS_CREDENCIAIS_PROIBIDAS");
    }
    if (CHAVES_PROIBIDAS_ESCRITA.test(chave) || typeof filho === "function") {
      throw new Error("BRAIN_OS_ESCRITA_PROIBIDA");
    }
    inspecionarProibicoes(filho, visitados);
  }
}

function inferirQualificadorNoTrecho(
  trecho: string,
  declarado?: "AFIRMADO" | "NEGADO" | "INCERTO" | "HISTORICO" | "TERCEIRO",
): "AFIRMADO" | "NEGADO" | "INCERTO" | "HISTORICO" | "TERCEIRO" {
  if (declarado) return declarado;
  if (/\b(?:mae|mãe|pai|irm[aã]o?|tia|av[oó]|familiar)\b/iu.test(trecho)) return "TERCEIRO";
  if (/\b(?:nega|sem\s+evid[eê]ncia|aus[eê]ncia\s+de|negativo\s+para|nao\s+apresenta|não\s+apresenta)\b/iu.test(trecho)) return "NEGADO";
  if (/\b(?:hip[oó]tese|suspeita|poss[ií]vel|duvidoso|interrogad[oa]|a\s+esclarecer)\b/iu.test(trecho)) return "INCERTO";
  if (/\b(?:hist[oó]rico\s+pr[eé]vio|previamente|em\s+201\d|passado)\b/iu.test(trecho)) return "HISTORICO";
  return "AFIRMADO";
}

/**
 * BRAIN_OS:
 * - Produz propostas com citações e proveniência; não possui credenciais nem escrita.
 * - Registra motivo de inclusão na mesa e referências excluídas.
 * - Expõe ambiguidades e lacunas sem escolher silenciosamente um valor.
 */
export function produzirPropostaBrainOs(entrada: unknown): PropostaBrainOs {
  inspecionarProibicoes(entrada);
  const raw = entrada as EntradaBrainOs;
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.fontes) || raw.fontes.length === 0) {
    throw new Error("BRAIN_OS_FONTES_OBRIGATORIAS");
  }

  const mapaFontes = new Map<string, { sourceId: string; versao: string; conteudo: string; contentHash: string; localizadorPadrao: string | null }>();
  for (const fonte of raw.fontes) {
    if (!fonte.sourceId || !fonte.versao || typeof fonte.conteudo !== "string" || !fonte.conteudo.trim()) {
      throw new Error("BRAIN_OS_FONTE_INVALIDA");
    }
    mapaFontes.set(fonte.sourceId, {
      sourceId: fonte.sourceId,
      versao: fonte.versao,
      conteudo: fonte.conteudo,
      contentHash: sha256(fonte.conteudo),
      localizadorPadrao: fonte.localizadorPadrao ?? null,
    });
  }

  const inclusoesMesa: InclusaoMesaBrain[] = [];
  const referenciasExcluidas: ExclusaoReferenciaBrain[] = [];
  const textoCombinado = raw.fontes.map((f) => f.conteudo.toLocaleLowerCase("pt-BR")).join("\n");
  const versoesConsultaveisPorId = new Map<string, string>();
  for (const ref of raw.referenciasCandidatas ?? []) {
    if (ref.status === "CONSULTAVEL" && ref.provenienciaCompleta && ref.escopoCompativel) {
      const atual = versoesConsultaveisPorId.get(ref.referenciaId);
      if (!atual || ref.versao.localeCompare(atual, undefined, { numeric: true }) > 0) {
        versoesConsultaveisPorId.set(ref.referenciaId, ref.versao);
      }
    }
  }

  for (const ref of raw.referenciasCandidatas ?? []) {
    if (!ref.provenienciaCompleta) {
      referenciasExcluidas.push({
        referenciaId: ref.referenciaId,
        versao: ref.versao,
        motivoCodigo: "PROVENIENCIA_INCOMPLETA",
        detalhe: "Referência sem publicação ou proveniência documental completa.",
      });
      continue;
    }
    if (ref.status !== "CONSULTAVEL") {
      referenciasExcluidas.push({
        referenciaId: ref.referenciaId,
        versao: ref.versao,
        motivoCodigo: "STATUS_NAO_CONSULTAVEL",
        detalhe: `Referência em estado ${ref.status} não entra na mesa clínica.`,
      });
      continue;
    }
    if (!ref.escopoCompativel) {
      referenciasExcluidas.push({
        referenciaId: ref.referenciaId,
        versao: ref.versao,
        motivoCodigo: "FORA_DO_ESCOPO_CLINICO",
        detalhe: "Aplicabilidade tumoral ou linha clínica incompatível com o caso em análise.",
      });
      continue;
    }
    const versaoMaisRecente = versoesConsultaveisPorId.get(ref.referenciaId);
    if (versaoMaisRecente && versaoMaisRecente !== ref.versao) {
      referenciasExcluidas.push({
        referenciaId: ref.referenciaId,
        versao: ref.versao,
        motivoCodigo: "DUPLICADA_POR_VERSAO_SUPERIOR",
        detalhe: `Substituída na mesa pela versão superior ${versaoMaisRecente}.`,
      });
      continue;
    }
    const termoEncontrado = ref.termosChave.find((t) => t.trim().length > 0 && textoCombinado.includes(t.toLocaleLowerCase("pt-BR")));
    if (!termoEncontrado) {
      referenciasExcluidas.push({
        referenciaId: ref.referenciaId,
        versao: ref.versao,
        motivoCodigo: "SEM_CORRESPONDENCIA_NA_FONTE",
        detalhe: "Nenhum termo clínico da referência foi sustentado pelas fontes do caso.",
      });
      continue;
    }
    const fonteMatch = raw.fontes.find((f) => f.conteudo.toLocaleLowerCase("pt-BR").includes(termoEncontrado.toLocaleLowerCase("pt-BR"))) ?? raw.fontes[0]!;
    const indiceTermo = fonteMatch.conteudo.toLocaleLowerCase("pt-BR").indexOf(termoEncontrado.toLocaleLowerCase("pt-BR"));
    const inicioTrecho = Math.max(0, indiceTermo - 80);
    const fimTrecho = Math.min(fonteMatch.conteudo.length, Math.max(inicioTrecho + 240, indiceTermo + termoEncontrado.length));
    inclusoesMesa.push({
      referenciaId: ref.referenciaId,
      versao: ref.versao,
      motivoInclusao: ref.motivoInclusaoSeAplicavel,
      trechoCitado: fonteMatch.conteudo.slice(inicioTrecho, fimTrecho),
    });
  }

  // Agrupamento por campo para detectar ambiguidades/conflitos sem escolher silenciosamente
  const porCampo = new Map<string, CandidatoExtracaoBrainOs[]>();
  for (const candidato of raw.candidatos ?? []) {
    const fonte = mapaFontes.get(candidato.sourceId);
    if (!fonte) throw new Error("BRAIN_OS_CITACAO_FONTE_DESCONHECIDA");
    if (!candidato.trecho.trim() || !fonte.conteudo.includes(candidato.trecho)) {
      throw new Error("BRAIN_OS_CITACAO_NAO_LITERAL");
    }
    const lista = porCampo.get(candidato.campo) ?? [];
    lista.push(candidato);
    porCampo.set(candidato.campo, lista);
  }

  const itensPropostos: ItemPropostoBrain[] = [];
  const ambiguidades: AmbiguidadeBrain[] = [];

  for (const [campo, lista] of porCampo.entries()) {
    const assinaturasDistintas = new Set(
      lista.map((c) => JSON.stringify([
        String(c.valor).trim().toLocaleLowerCase("pt-BR"),
        c.unidade ?? null,
        inferirQualificadorNoTrecho(c.trecho, c.qualificador),
      ])),
    );
    if (assinaturasDistintas.size > 1) {
      // Múltiplos valores ou qualificadores conflitantes para o mesmo campo:
      // expõe a ambiguidade sem escolher silenciosamente nenhum valor!
      ambiguidades.push({
        campo,
        motivo: `Múltiplos valores ou qualificadores encontrados para '${campo}'; revisão médica obrigatória sem eleição automática.`,
        candidatos: lista.map((c) => {
          const fonte = mapaFontes.get(c.sourceId)!;
          return {
            valor: c.valor,
            unidade: c.unidade ?? null,
            qualificador: inferirQualificadorNoTrecho(c.trecho, c.qualificador),
            citacao: {
              sourceId: fonte.sourceId,
              versao: fonte.versao,
              contentHash: fonte.contentHash,
              trecho: c.trecho,
              localizador: c.localizador ?? fonte.localizadorPadrao,
            },
          };
        }),
        valorEscolhido: null,
        escolhaSilenciosa: false,
      });
      continue;
    }

    const primeiro = lista[0]!;
    const qualificador = inferirQualificadorNoTrecho(primeiro.trecho, primeiro.qualificador);
    const criticoNumero = primeiro.criticoNumero ?? (typeof primeiro.valor === "number" || /\d/.test(String(primeiro.valor)));
    const citacoes = lista.map((c) => {
      const fonte = mapaFontes.get(c.sourceId)!;
      return {
        sourceId: fonte.sourceId,
        versao: fonte.versao,
        contentHash: fonte.contentHash,
        trecho: c.trecho,
        localizador: c.localizador ?? fonte.localizadorPadrao,
      };
    });
    const itemId = `item-${sha256(JSON.stringify([raw.propostaId, campo, primeiro.valor])).slice(0, 24)}`;
    itensPropostos.push({
      itemId,
      campo,
      valorProposto: primeiro.valor,
      unidade: primeiro.unidade ?? null,
      qualificador,
      criticoNumero,
      validado: false,
      requerConfirmacaoMedica: true,
      citacoes,
    });
  }

  const camposPresentesOuAmbiguos = new Set([...porCampo.keys()]);
  const lacunas: LacunaBrain[] = [];
  for (const req of raw.camposObrigatorios ?? []) {
    if (!camposPresentesOuAmbiguos.has(req.campo)) {
      lacunas.push({
        campo: req.campo,
        obrigatoriedade: req.obrigatoriedade,
        motivo: req.motivo,
        valorPreenchido: null,
      });
    }
  }

  return PropostaBrainOsSchema.parse({
    schema: "BrainOsProposta@1",
    propostaId: raw.propostaId,
    patientId: raw.patientId ?? null,
    encounterId: raw.encounterId ?? null,
    geradoEm: raw.agora,
    possuiCredenciais: false,
    possuiEscritaClinica: false,
    itensPropostos,
    inclusoesMesa,
    referenciasExcluidas,
    ambiguidades,
    lacunas,
  });
}
