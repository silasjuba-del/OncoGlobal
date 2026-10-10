import { RulesetHeader } from "./rulesetHeader.mjs";
// Assinaturas das funções puras FN-01…FN-09 e schemas dos rulesets (W0 · contrato-primeiro).
// Implementação: src/rules/** (E3 Grok). Testes: tests/rules/** (E5 Kimi). Ninguém muda este arquivo sem o tech lead.
import { z } from "zod";
import { DataCivil, Instante } from "./base.js";
import type { ResultadoTriagem, Triagem } from "./clinico.js";
import { Destino, Semaforo } from "./estados.js";

// ── Rulesets (espelham corpus/rulesets/*.v1.json; o teste carrega o JSON e faz parse) ──
export const SalaoRuleset = z.object({
  header: RulesetHeader.and(z.object({ id: z.literal("salao-triagem") })),
  cortes: z.object({
    pasMax: z.number().int(), pasMin: z.number().int(),
    fcMax: z.number().int(), fcMin: z.number().int(),
    spo2Min: z.number().int(), tempDecimosMax: z.number().int(), hbDgDlMin: z.number().int(),
    ancMin: z.number().int(), plqMin: z.number().int(),
    grauCtcaeCorta: z.number().int(), grauCtcaeEmergencia: z.number().int(),
    ecogCorta: z.array(z.number().int()),
  }),
  hemogramaValidadeDias: z.number().int(),
  frente: z.object({ recursos: z.array(z.string()), idadeAcimaDe: z.number().int() }).passthrough(),
  filaOrdem: z.array(z.string()),
  pesoVermelho: z.object({ perdaKgAcimaDe: z.number(), janelaDias: z.number().int() }).passthrough(),
}).passthrough();
export type SalaoRuleset = z.infer<typeof SalaoRuleset>;

export const DoseRuleset = z.object({
  header: RulesetHeader.and(z.object({ id: z.literal("dose") })),
  reducoesPct: z.array(z.number().int()),
  semPesoConsecutivosVermelho: z.number().int(),
  AC: z.object({ ciclosComMedico: z.array(z.number().int()) }).passthrough(),
}).passthrough();
export type DoseRuleset = z.infer<typeof DoseRuleset>;

export const PrazosRuleset = z.object({
  header: RulesetHeader.and(z.object({ id: z.literal("prazos") })),
  intervaloPosQtDias: z.number().int(),
}).passthrough();
export type PrazosRuleset = z.infer<typeof PrazosRuleset>;

// ── Tipos de entrada/saída ──────────────────────────────────────────────────
/** "hoje" é SEMPRE injetado (função pura não lê relógio). Datas = "YYYY-MM-DD", dias civis. */
export const ContextoTriagem = z.object({
  hoje: DataCivil,
  prescricaoVigente: z.object({ documentId: z.string(), ciclosCobertos: z.number().int(), validaAte: DataCivil }).strict().nullable(),
  /** requisitos aplicáveis (K-10): só eles geram pendência quando ausentes */
  requisitosAplicaveis: z.array(z.enum(["pas", "fc", "spo2", "tempDecimos", "hbDgDl", "anc", "plq", "coletaHemograma", "ecog", "grauCtcae"])),
}).strict();
export type ContextoTriagem = z.infer<typeof ContextoTriagem>;

export const EntradaFila = z.object({
  patientId: z.string(),
  ecog: z.number().int().min(0).max(4).nullable(),
  recurso: z.enum(["AMBULATORIAL", "CADEIRA", "CAMA"]),
  idadeAnos: z.number().int().nullable(), // D-W9-03 · null = PENDENTE
  chegadaEm: Instante,
}).strict();
export type EntradaFila = z.infer<typeof EntradaFila>;

export type ReducaoPct = 0 | 20 | 30 | 40;
export interface EntradaDose {
  /** dose EFETIVAMENTE administrada no ciclo anterior (K-06/Q29); null = sem base */
  doseAdministradaAnteriorMg: number | null;
  reducaoPct: ReducaoPct;
  pesoKg: number | null;
  origemPeso: "MEDIDO" | "ANTERIOR" | "INFORMADO_PACIENTE" | null;
  /** quantos ciclos imediatamente anteriores ficaram sem peso */
  ciclosSemPesoAnteriores: number;
}
export interface SaidaDose {
  doseMg: number | null; // inteiro, meio para cima, arredondado uma vez após a redução
  estado: Semaforo;
  motivo: string;
  ciclosSemPesoConsecutivos: number;
  rulesetVersao: string;
}

export interface Pesagem { data: string; kg: number; origem: "MEDIDO" | "INFORMADO_PACIENTE" }
export interface SaidaPeso {
  estado: Semaforo; // VERMELHO = perda > limiar só com pesos MEDIDOS; envolve informado ⇒ PENDENTE (incerta, A2)
  perdaKg: number | null;
  motivo: string;
  acao: string[]; // ["NUTRICAO","QT_ADIADA","CONSULTA_MEDICA"] quando VERMELHO
  rulesetVersao: string;
}

export type AlvoIntervalo = "CIRURGIA" | "RT_SEQUENCIAL" | "RT_CONCOMITANTE";
export interface SaidaIntervalo { estado: Semaforo; dias: number | null; motivo: string; rulesetVersao: string }

// ── Assinaturas (a implementação deve exportar exatamente estes nomes) ──────
export interface FuncoesF0 {
  /** FN-01+FN-02 · src/rules/triagem.ts */
  avaliarTriagem(t: Triagem, ctx: ContextoTriagem, rs: SalaoRuleset): ResultadoTriagem;
  /** FN-02 · src/rules/destino.ts */
  decidirDestino(input: { temCorte: boolean; temPendencia: boolean; recurso: "AMBULATORIAL" | "CADEIRA" | "CAMA"; idadeAnos: number | null }, rs: SalaoRuleset): z.infer<typeof Destino>;
  /** FN-03 · src/rules/fila.ts — estável; não muta a entrada */
  ordenarFila(entradas: readonly EntradaFila[], rs: SalaoRuleset): EntradaFila[];
  /** FN-04 · src/rules/dose.ts */
  calcularDose(e: EntradaDose, rs: DoseRuleset): SaidaDose;
  /** FN-05 · src/rules/validade.ts — >validade ou ausente ou futura ⇒ PENDENTE; ≤validade ⇒ VERDE */
  validadeHemograma(coleta: string | null, hoje: string, rs: SalaoRuleset): { estado: z.infer<typeof Semaforo>; dias: number | null; motivo: string };
  /** FN-06 · src/rules/peso.ts */
  avaliarPeso(serie: readonly Pesagem[], hoje: string, rs: SalaoRuleset): SaidaPeso;
  /** FN-07 · src/rules/prazos.ts — RT_CONCOMITANTE nunca avisa; ≥ intervalo ⇒ VERDE (igual passa); < ⇒ VERMELHO (aviso); sem data ⇒ PENDENTE */
  avisoIntervaloPosQt(ultimaAdministracaoQt: string | null, dataAlvo: string, alvo: AlvoIntervalo, rs: PrazosRuleset): SaidaIntervalo;
  /** FN-08 · src/rules/concomitancia.ts — sobreposição de períodos (fim null = em curso até 'hoje') */
  ehConcomitante(qt: { inicio: string; fim: string | null }, rt: { inicio: string; fim: string | null }, hoje: string): boolean;
  /** FN-09 · src/rules/cicloComMedico.ts — AC: ciclos em rs.AC.ciclosComMedico vão ao médico; os demais só pulam se sem corte e sem pendência; outros esquemas: vai ao médico se !qtPodeIniciarSemMedico */
  cicloVaiAoMedico(esquemaId: string, numeroCiclo: number, r: ResultadoTriagem, rs: DoseRuleset): boolean;
}
