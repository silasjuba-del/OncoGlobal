import { z } from "zod";
import type { ClinicalEvent } from "../../contracts/operacao.js";
import type { RegraCondicional, RegraTermoComplementar } from "../../contracts/f0c/condicionais.js";
import { projetarSnapshot } from "../../kernel/projections/snapshot.js";
import { avaliarCondicionais, registrarTermosComplementares } from "../../rules/f0c/condicionais.js";
import { dataCivilNoOffset } from "../../rules/intervaloQt.js";

const texto = z.string().trim().min(1).nullable();
const numero = z.number().finite().nullable();
const booleano = z.object({ valor: z.boolean().nullable(), fonte: texto }).strict();
const medida = z.object({ valor: numero, unidade: texto, fonte: texto, coletadoEm: texto.optional() }).strict();
const hepatico = medida.extend({ limiteSuperiorNormal: numero }).strict();
const termo = z.object({ termo: z.enum(["MAO_PE", "REACAO_INFUSIONAL"]), presente: z.boolean().nullable(),
  evidencia: texto, fonte: texto, ctcaeVersao: texto, grauDocumentado: numero.optional() }).strict();

/** Conteúdo do FATO condicionaisCiclo. Campos não fornecidos continuam desconhecidos; não há defaults clínicos. */
export const CondicionaisCicloDados = z.object({
  dpyd: z.object({ valor: z.enum(["SEM_DEFICIENCIA_IDENTIFICADA", "DEFICIENCIA_PARCIAL", "DEFICIENCIA_COMPLETA", "DESCONHECIDO"]).nullable(), fonte: texto }).strict().optional(),
  alergias: z.object({ lista: z.array(z.object({ agente: z.string().trim().min(1), presente: z.boolean().nullable(), fonte: texto }).strict()),
    historicoConferido: z.boolean().nullable(), fonte: texto }).strict().optional(),
  gestacao: z.object({ aplicavel: z.boolean().nullable(), resultado: booleano }).strict().optional(),
  hepaticos: z.object({ bilirrubina: hepatico, ast: hepatico, alt: hepatico, fosfataseAlcalina: hepatico, metastaseHepatica: booleano }).strict().optional(),
  hipertensaoGraveNaoControlada: booleano.optional(), proteinuria: medida.optional(), sindromeNefrotica: booleano.optional(),
  cirurgia: z.object({ historicoEAgendaConferidos: z.boolean().nullable(), ultimaCirurgiaMaior: texto,
    proximaCirurgiaEletiva: texto, cicatrizacaoAdequada: z.boolean().nullable(), fonte: texto }).strict().optional(),
  termos: z.array(termo).optional(),
}).strict();
export type CondicionaisCicloDados = z.infer<typeof CondicionaisCicloDados>;

export interface EntradaCondicionaisClinicas {
  eventos: readonly ClinicalEvent[];
  patientId: string;
  tumorLotId: string | null;
  encounterId: string;
  agora: string;
  offsetServico?: string;
  /** Vem dos itens do ciclo, nunca do payload condicionaisCiclo. */
  programados: readonly string[] | null;
  regras: readonly RegraCondicional[];
  regrasTermos?: readonly RegraTermoComplementar[];
}

export function projetarCondicionaisClinicas(i: EntradaCondicionaisClinicas) {
  const instante = Date.parse(i.agora), hoje = dataCivilNoOffset(i.agora, i.offsetServico ?? "-03:00");
  const eventos = i.eventos.filter((e) => e.tipo === "FATO" && e.patientId === i.patientId && e.tumorLotId === i.tumorLotId
    && e.encounterId === i.encounterId && (e.revisao === "CONFIRMADO" || e.revisao === "ASSINADO")
    && Number.isFinite(Date.parse(e.criadoEm)) && Date.parse(e.criadoEm) <= instante);
  const snapshot = projetarSnapshot(eventos, i.patientId, i.tumorLotId, i.encounterId, "f0c-condicionais-v1");
  const campo = snapshot.campos.condicionaisCiclo;
  const eventIds = campo?.eventIds ?? [];
  const sourceIds = [...new Set(eventos.filter((e) => eventIds.includes(e.eventId)).flatMap((e) => e.fontes.map((f) => f.sourceId)).filter((id) => id.trim()))].sort();
  const pendencias: string[] = [];
  if (!Number.isFinite(instante) || !hoje || !i.patientId.trim() || !i.encounterId.trim()) pendencias.push("ESCOPO_OU_AGORA_INVALIDO");
  if (!campo) pendencias.push("DADOS_CONDICIONAIS_AUSENTES");
  else if (campo.estado !== "VERDE") pendencias.push(campo.estado === "VERMELHO" ? "DADOS_CONDICIONAIS_DIVERGENTES" : "DADOS_CONDICIONAIS_PENDENTES");
  if (campo && !sourceIds.length) pendencias.push("FONTE_EVENTO_AUSENTE");
  const parsed = CondicionaisCicloDados.safeParse(campo?.valor);
  if (campo && !parsed.success) pendencias.push("DADOS_CONDICIONAIS_INVALIDOS");
  const dados: CondicionaisCicloDados = !pendencias.length && parsed.success ? parsed.data : {};
  const { termos: evidencias, ...clinicos } = dados;
  // Schema optional produz undefined; retirar chaves ausentes mantém o contrato exactOptionalPropertyTypes.
  const semUndefined = Object.fromEntries(Object.entries(clinicos).filter(([, v]) => v !== undefined));
  const avaliacoes = avaliarCondicionais({ ...semUndefined, programados: i.programados, hoje: hoje ?? "", agora: i.agora }, i.regras);
  const termos = registrarTermosComplementares((evidencias ?? []).map((e) => ({ termo: e.termo, presente: e.presente,
    evidencia: e.evidencia, fonte: e.fonte, ctcaeVersao: e.ctcaeVersao,
    ...(e.grauDocumentado === undefined ? {} : { grauDocumentado: e.grauDocumentado }) })), i.regrasTermos ?? []);
  return { avaliacoes, termos, eventIds: [...eventIds], sourceIds,
    pendencias: [...new Set([...pendencias, ...avaliacoes.filter((a) => a.estado !== "NAO_APLICAVEL").flatMap((a) => a.pendencias.map((p) => `${a.regraId}:${p}`)),
      ...termos.flatMap((t) => t.pendencias.map((p) => `${t.termo}:${p}`))])] };
}
