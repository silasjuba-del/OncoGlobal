import { z } from "zod";
import type { ClinicalEvent } from "../../contracts/operacao.js";
import type { InstrumentoId, RegraInstrumento, ResultadoInstrumento } from "../../contracts/f0c/instrumentos.js";
import { projetarSnapshot } from "../../kernel/projections/snapshot.js";
import { calcularAlbi, calcularChildPugh, calcularG8, calcularKhorana, registrarKps } from "../../rules/f0c/instrumentos.js";

const numero = z.number().finite().nullable();
const texto = z.string().trim().min(1).nullable();
const medida = z.object({ valor: numero, unidade: texto, fonte: texto }).strict();
const contexto = { aplicavel: z.boolean().nullable(), fonteDados: texto };
const kps = z.object({ ...contexto, kpsDocumentado: numero }).strict();
const child = z.object({ ...contexto, bilirrubina: medida, albumina: medida, inr: medida,
  ascite: z.enum(["AUSENTE", "RESPONSIVA_DIURETICO", "REFRATARIA"]).nullable(),
  encefalopatia: z.enum(["AUSENTE", "GRAU_1_2", "GRAU_3_4"]).nullable() }).strict();
const albi = z.object({ ...contexto, bilirrubina: medida, albumina: medida }).strict();
const khorana = z.object({ ...contexto, sitio: z.enum(["ESTOMAGO", "PANCREAS", "PULMAO", "LINFOMA", "GINECOLOGICO", "BEXIGA", "TESTICULO", "OUTRO"]).nullable(),
  plaquetas: medida, hemoglobina: medida, leucocitos: medida, imc: medida, usaEstimulanteEritropoiese: z.boolean().nullable() }).strict();
const g8 = z.object({ ...contexto,
  ingestao3Meses: z.enum(["REDUCAO_GRAVE", "REDUCAO_MODERADA", "SEM_REDUCAO"]).nullable(),
  perdaPeso3Meses: z.enum(["MAIS_3_KG", "NAO_SABE", "ENTRE_1_3_KG", "SEM_PERDA"]).nullable(),
  mobilidade: z.enum(["LEITO_CADEIRA", "SAI_LEITO_NAO_CASA", "SAI_CASA"]).nullable(),
  neuropsicologico: z.enum(["DEMENCIA_OU_DEPRESSAO_GRAVE", "LEVE", "AUSENTE"]).nullable(),
  imc: medida, medicamentosPorDia: numero, autoavaliacaoSaude: z.enum(["PIOR", "NAO_SABE", "IGUAL", "MELHOR"]).nullable(), idadeAnos: numero }).strict();

/** Também utilizável em endpoint dirigido. Sem coerção, defaults clínicos ou perguntas inferidas. */
export const AvaliacaoInstrumentoRequest = z.discriminatedUnion("instrumento", [
  z.object({ instrumento: z.literal("KPS"), dados: kps }).strict(),
  z.object({ instrumento: z.literal("CHILD_PUGH"), dados: child }).strict(),
  z.object({ instrumento: z.literal("ALBI"), dados: albi }).strict(),
  z.object({ instrumento: z.literal("KHORANA"), dados: khorana }).strict(),
  z.object({ instrumento: z.literal("G8"), dados: g8 }).strict(),
]);
export type AvaliacaoInstrumentoRequest = z.infer<typeof AvaliacaoInstrumentoRequest>;

export function avaliarInstrumentoEstruturado(pedido: AvaliacaoInstrumentoRequest, regra: RegraInstrumento | null): ResultadoInstrumento {
  switch (pedido.instrumento) {
    case "KPS": return registrarKps(pedido.dados, regra);
    case "CHILD_PUGH": return calcularChildPugh(pedido.dados, regra);
    case "ALBI": return calcularAlbi(pedido.dados, regra);
    case "KHORANA": return calcularKhorana(pedido.dados, regra);
    case "G8": return calcularG8(pedido.dados, regra);
  }
}

export interface EntradaInstrumentosClinicos {
  eventos: readonly ClinicalEvent[];
  patientId: string;
  tumorLotId: string | null;
  encounterId: string;
  agora: string;
  regras: readonly RegraInstrumento[];
}
export interface InstrumentoClinicoProjetado {
  instrumento: InstrumentoId;
  campo: string;
  aplicavel: boolean | null;
  avaliacao: ResultadoInstrumento;
  eventIds: string[];
  sourceIds: string[];
}
export interface ResultadoInstrumentosClinicos {
  avaliacoes: InstrumentoClinicoProjetado[];
  pendencias: string[];
}
const ids: readonly InstrumentoId[] = ["KPS", "CHILD_PUGH", "ALBI", "KHORANA", "G8"];

/** Lê somente FATO instrumento.<ID> confirmado da consulta atual. Ausência não solicita instrumento. */
export function projetarInstrumentosClinicos(i: EntradaInstrumentosClinicos): ResultadoInstrumentosClinicos {
  const instante = Date.parse(i.agora);
  if (!Number.isFinite(instante) || !i.patientId.trim() || !i.encounterId.trim()) return { avaliacoes: [], pendencias: ["ESCOPO_OU_AGORA_INVALIDO"] };
  const eventos = i.eventos.filter((e) => e.tipo === "FATO" && e.patientId === i.patientId && e.encounterId === i.encounterId
    && e.tumorLotId === i.tumorLotId && (e.revisao === "CONFIRMADO" || e.revisao === "ASSINADO")
    && Number.isFinite(Date.parse(e.criadoEm)) && Date.parse(e.criadoEm) <= instante);
  const snapshot = projetarSnapshot(eventos, i.patientId, i.tumorLotId, i.encounterId, "f0c-instrumentos-v1");
  const avaliacoes: InstrumentoClinicoProjetado[] = [];
  const pendencias: string[] = [];
  for (const instrumento of ids) {
    const campo = `instrumento.${instrumento}`;
    const valor = snapshot.campos[campo];
    if (!valor) continue;
    const fontes = eventos.filter((e) => valor.eventIds.includes(e.eventId)).flatMap((e) => e.fontes.map((f) => f.sourceId)).filter((s) => s.trim());
    const sourceIds = [...new Set(fontes)].sort();
    const candidatas = i.regras.filter((r) => r.id === instrumento);
    const regra = candidatas.length === 1 ? candidatas[0]! : null;
    const parsed = AvaliacaoInstrumentoRequest.safeParse({ instrumento, dados: valor.valor });
    let avaliacao: ResultadoInstrumento;
    if (valor.estado === "VERDE" && parsed.success && sourceIds.length && candidatas.length <= 1) {
      avaliacao = avaliarInstrumentoEstruturado(parsed.data, regra);
    } else {
      const motivos = [
        ...(valor.estado !== "VERDE" ? [valor.estado === "VERMELHO" ? "FATOS_DIVERGENTES" : "FATO_PENDENTE"] : []),
        ...(!parsed.success ? ["DADOS_ESTRUTURADOS_INVALIDOS"] : []),
        ...(!sourceIds.length ? ["FONTE_EVENTO_AUSENTE"] : []),
        ...(candidatas.length > 1 ? ["REGRA_AMBIGUA"] : []),
      ];
      avaliacao = { instrumento, estado: "PENDENTE", escore: null, classificacao: null, parcelas: {}, pendencias: motivos,
        regraVersao: regra?.versao ?? null, fonteRegra: regra?.fonte.referencia ?? null,
        fonteDados: parsed.success ? parsed.data.dados.fonteDados : null, condutaAutomatica: false, consultaSegue: true };
    }
    avaliacoes.push({ instrumento, campo, aplicavel: parsed.success ? parsed.data.dados.aplicavel : null,
      avaliacao, eventIds: [...valor.eventIds], sourceIds });
    pendencias.push(...avaliacao.pendencias.map((p) => `${instrumento}:${p}`));
  }
  return { avaliacoes, pendencias: [...new Set(pendencias)] };
}
