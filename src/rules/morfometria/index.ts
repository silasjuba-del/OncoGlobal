// W10-INT-PRESC-05 · porta de entrada da morfometria (D-W9-57, skill SNC v4.0) + complementos do RECIST (RT-06a/b/c/d).
// Camada de RECUSA sobre o núcleo morfometriaCore.ts: a matemática fica lá; aqui ficam as barreiras que a skill proíbe
// (anatomia média, MF ausente = 1,0, régua de uma direção valendo para a outra, polo truncado, máscara probabilística).
// Toda saída termina REVIEW_REQUIRED e NUNCA classifica resposta (RANO/RECIST): categoria é candidata ao médico.
// src/rules só importa src/contracts (R-08): arquivo autossuficiente (equivalência com o núcleo provada em teste).

export type ModoMorfometria = "VISUAL" | "2D_CALIBRADO" | "3D_GEOMETRICO";
export type DirecaoMedida = "HORIZONTAL" | "VERTICAL" | "OBLIQUA";

export interface ReguaMorfometria {
  direcao: DirecaoMedida | "ISOTROPICA";
  comprimentoMm: number;
  comprimentoPx: number;
  /** escala isotrópica DEMONSTRADA (pixel quadrado, sem perspectiva): só então vale nas duas direções */
  isotropicaDemonstrada?: boolean;
}

export interface FatiaMorfometria { poloSuperior?: "OBSERVADO" | "TRUNCADO"; poloInferior?: "OBSERVADO" | "TRUNCADO" }

export interface EntradaMorfometria {
  modo: ModoMorfometria | string;
  /** tipo do insumo: "MASCARA_PROBABILISTICA" nunca serve para medida */
  entrada?: string;
  /** "ANATOMIA_MEDIA" é proibida */
  escala?: string;
  /** presente-e-null = MF ausente; ausente NÃO implica 1,0 */
  magnificacaoMF?: number | null;
  /** o significado/participação do MF na transformação está documentado */
  mfDocumentado?: boolean;
  medidasPx?: readonly number[];
  regua?: ReguaMorfometria;
  medida?: { direcao: DirecaoMedida; comprimentoPx: number };
  fatias?: readonly FatiaMorfometria[];
  /** áreas por corte (mm²) e posições (mm) para o trapézio; extremos com área 0 realmente observada */
  areasMm2?: readonly number[];
  posicoesMm?: readonly number[];
}

export interface SaidaMorfometria {
  recusado: boolean;
  motivo: string | null;
  /** sempre true: confirmar medida e contorno em DICOM nativo (skill §0) */
  reviewRequired: true;
  /** mm/px derivado da régua; null se não houve calibração válida. Nunca 1 por omissão. */
  fator: number | null;
  medidaMm: number | null;
  volumeMm3: number | null;
  nota: string | null;
}

const recusa = (motivo: string): SaidaMorfometria =>
  ({ recusado: true, motivo, reviewRequired: true, fator: null, medidaMm: null, volumeMm3: null, nota: null });
const ok = (p: Partial<SaidaMorfometria>): SaidaMorfometria =>
  ({ recusado: false, motivo: null, reviewRequired: true, fator: null, medidaMm: null, volumeMm3: null, nota: null, ...p });
const pos = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

/** Barreiras comuns a todos os modos. */
function barreiras(e: EntradaMorfometria): SaidaMorfometria | null {
  if (e.entrada === "MASCARA_PROBABILISTICA")
    return recusa("máscara probabilística não serve para medida: peso não é fração de volume sem modelo calibrado (skill §8)");
  if (e.escala === "ANATOMIA_MEDIA")
    return recusa("escala por anatomia média é proibida: largura média de crânio/ventrículo não é régua individual (skill §6.2)");
  if (e.modo !== "VISUAL" && e.modo !== "2D_CALIBRADO" && e.modo !== "3D_GEOMETRICO") return recusa(`modo desconhecido: ${String(e.modo)}`);
  return null;
}

function polosObservados(fatias: readonly FatiaMorfometria[] | undefined): string | null {
  if (!fatias || fatias.length === 0) return "volume exige cortes observados (fatias ausentes)";
  const t = fatias.findIndex((f) => f.poloSuperior === "TRUNCADO" || f.poloInferior === "TRUNCADO");
  if (t >= 0) return `polo truncado no corte #${t}: volume parcial não vira volume total (skill §8)`;
  if (!fatias.some((f) => f.poloSuperior === "OBSERVADO") || !fatias.some((f) => f.poloInferior === "OBSERVADO"))
    return "polos superior e inferior não observados: trapézio só com polos observados (skill §8)";
  return null;
}

/** Porta de medida: 2D calibrado por régua, 3D com polos observados, ou descrição VISUAL sem número. */
export function medirLesao(e: EntradaMorfometria): SaidaMorfometria {
  const b = barreiras(e);
  if (b) return b;
  if (e.modo === "VISUAL")
    return ok({ nota: "descrição visual: sem medida numérica; probabilidade visual não é diagnóstico" });
  if (e.modo === "3D_GEOMETRICO") {
    const p = polosObservados(e.fatias);
    return p ? recusa(p) : ok({ nota: "polos observados; volume calculado pelo núcleo (morfometriaCore) com geometria DICOM verificada" });
  }
  // 2D_CALIBRADO
  const r = e.regua;
  if (!r) {
    if ("magnificacaoMF" in e && (e.magnificacaoMF === null || e.magnificacaoMF === undefined))
      return recusa("MF ausente NÃO implica 1,0 (skill §6.2): sem régua e sem MF documentado não há calibração; sem correção automática");
    if (pos(e.magnificacaoMF) && e.mfDocumentado !== true)
      return recusa("MF informado sem documentar seu significado na transformação: não dividir por MF automaticamente");
    return recusa("sem régua clínica gravada no quadro nem geometria DICOM: medida em pixel não vira mm");
  }
  if (!pos(r.comprimentoMm) || !pos(r.comprimentoPx)) return recusa("régua inválida: comprimento em mm e em px devem ser positivos");
  const fator = r.comprimentoMm / r.comprimentoPx;
  if (!e.medida) return ok({ fator, nota: "régua válida; nenhuma medida a converter" });
  if (!pos(e.medida.comprimentoPx)) return recusa("medida inválida: comprimento em px deve ser positivo");
  const mesmaDirecao = r.direcao === e.medida.direcao;
  if (!mesmaDirecao && r.isotropicaDemonstrada !== true)
    return recusa(`régua ${r.direcao.toLowerCase()} isolada não calibra a direção ${e.medida.direcao.toLowerCase()}: sem escala isotrópica demonstrada, restringir à direção calibrada ou exigir calibração bidimensional (skill §6.2)`);
  return ok({ fator, medidaMm: e.medida.comprimentoPx * fator });
}
export const morfometria = medirLesao;

/** Volume 3D por trapézio: só com polos realmente observados (áreas terminais 0 observadas), nunca zeros artificiais. */
export function calcularVolume(e: EntradaMorfometria): SaidaMorfometria {
  const b = barreiras(e);
  if (b) return b;
  if (e.modo !== "3D_GEOMETRICO") return recusa("volume só no modo 3D_GEOMETRICO");
  const p = polosObservados(e.fatias);
  if (p) return recusa(p);
  const a = e.areasMm2, z = e.posicoesMm;
  if (!a || !z || a.length !== z.length || a.length < 3) return recusa("trapézio exige vetores iguais de áreas e posições com pelo menos três cortes");
  if (a.some((v) => !Number.isFinite(v) || v < 0) || z.some((v, i) => !Number.isFinite(v) || (i > 0 && v - z[i - 1]! <= 0)))
    return recusa("áreas não negativas e posições estritamente crescentes");
  if (a[0] !== 0 || a[a.length - 1] !== 0) return recusa("extremos sem área zero observada: polos incompletos");
  let v = 0;
  for (let i = 0; i < a.length - 1; i++) v += 0.5 * (a[i]! + a[i + 1]!) * (z[i + 1]! - z[i]!);
  return ok({ volumeMm3: v });
}

/* ───────────── RT-06a · PD por lesão nova ───────────── */

export type CandidatoRecist = "CR" | "PR" | "SD" | "PD";
export interface LesaoNova { codigo: string; localizacao?: string; diametroMm?: number; confirmadaPorMedico: boolean; inequivoca?: boolean }

export interface SaidaNovasLesoes {
  candidate_response: CandidatoRecist | null;
  origem: "ALVOS" | "NOVA_LESAO" | "PENDENTE_NOVA_LESAO";
  /** sempre PENDENTE: categoria é candidata, o médico decide */
  estado: "PENDENTE";
  motivo: string;
}

/**
 * Combina o candidato RECIST por lesões-alvo com lesões NOVAS (RECIST 1.1: lesão nova inequívoca ⇒ PD).
 * Nova lesão não confirmada pelo médico ⇒ nunca SD/PR/CR (candidato retido); se o alvo já é PD, mantém.
 */
export function avaliarRecistComNovasLesoes(
  candidatoAlvos: CandidatoRecist | null,
  novas: readonly LesaoNova[],
): SaidaNovasLesoes {
  if (novas.length === 0)
    return { candidate_response: candidatoAlvos, origem: "ALVOS", estado: "PENDENTE", motivo: "sem lesão nova informada: candidato pelos alvos, para revisão médica" };
  if (novas.some((n) => n.confirmadaPorMedico && n.inequivoca !== false))
    return { candidate_response: "PD", origem: "NOVA_LESAO", estado: "PENDENTE", motivo: `PD por nova lesão (${novas.filter((n) => n.confirmadaPorMedico).map((n) => n.codigo).join(", ")}): candidato para revisão médica` };
  if (candidatoAlvos === "PD")
    return { candidate_response: "PD", origem: "ALVOS", estado: "PENDENTE", motivo: "PD pelos alvos; nova lesão ainda sem confirmação médica" };
  return { candidate_response: null, origem: "PENDENTE_NOVA_LESAO", estado: "PENDENTE",
    motivo: "nova lesão sem confirmação médica ou não inequívoca: resposta retida (nunca SD/PR/CR)" };
}

/* ───────────── RT-06b · linfonodo por eixo curto ───────────── */

export type ClasseLinfonodo = "NORMAL_NAO_ALVO" | "PATOLOGICO_NAO_ALVO" | "ALVO_ELEGIVEL" | "PENDENTE";
export interface SaidaLinfonodo { classe: ClasseLinfonodo; contaNaSoma: boolean; motivo: string }

/** Eixo curto do nó (mm) — o que conta em linfonodo; nunca o eixo longo. */
export const eixoCurtoMm = (l: { eixoCurtoMm: number | null }): number | null =>
  l.eixoCurtoMm !== null && Number.isFinite(l.eixoCurtoMm) && l.eixoCurtoMm >= 0 ? l.eixoCurtoMm : null;

/**
 * RECIST 1.1 para linfonodo: < 10 mm normal (nunca alvo); 10 a < 15 mm patológico não-alvo; ≥ 15 mm elegível a alvo.
 * Cortes configuráveis (ruleset): defaults 10/15 mm (eixo curto: ≥15 alvo; 10–15 não-alvo; <10 normal) — confirmado pelo Dr. Silas (D-W9-63).
 */
export function avaliarLinfonodoAlvo(
  l: { codigo: string; eixoCurtoMm: number | null },
  cortes: { normalMenorQueMm: number; alvoMinMm: number } = { normalMenorQueMm: 10, alvoMinMm: 15 },
): SaidaLinfonodo {
  const e = eixoCurtoMm(l);
  if (e === null) return { classe: "PENDENTE", contaNaSoma: false, motivo: `linfonodo ${l.codigo} sem eixo curto: não classificável como alvo` };
  if (e < cortes.normalMenorQueMm)
    return { classe: "NORMAL_NAO_ALVO", contaNaSoma: false, motivo: `eixo curto ${e} mm < ${cortes.normalMenorQueMm} mm: não-alvo (normal)` };
  if (e < cortes.alvoMinMm)
    return { classe: "PATOLOGICO_NAO_ALVO", contaNaSoma: false, motivo: `eixo curto ${e} mm: patológico, mas < ${cortes.alvoMinMm} mm: não-alvo` };
  return { classe: "ALVO_ELEGIVEL", contaNaSoma: true, motivo: `eixo curto ${e} mm ≥ ${cortes.alvoMinMm} mm: elegível a lesão-alvo` };
}

/* ───────────── RT-06c · unidade e corte ───────────── */

export interface EntradaUnidade {
  valor: number | null;
  unidade: "mm" | "cm" | null;
  /** medida anterior da MESMA lesão, em mm: detecta troca cm×mm por fator ~10 */
  anteriorMm?: number | null;
  /** identificação do corte/série (ex.: "série 4, 3 mm") deste e do exame anterior */
  corte?: string | null;
  corteAnterior?: string | null;
}
export interface SaidaUnidade { estado: "OK" | "PENDENTE"; valorMm: number | null; convertido: boolean; motivos: string[] }

export function validarUnidadeMedida(e: EntradaUnidade): SaidaUnidade {
  const motivos: string[] = [];
  if (e.valor === null || !Number.isFinite(e.valor) || e.valor < 0) motivos.push("valor ausente ou inválido");
  if (e.unidade === null) motivos.push("unidade não declarada (cm ou mm): nunca presumida");
  const valorMm = motivos.length === 0 ? Math.round(e.valor! * (e.unidade === "cm" ? 10 : 1) * 1e6) / 1e6 : null;
  if (valorMm !== null && e.anteriorMm !== undefined && e.anteriorMm !== null && e.anteriorMm > 0 && valorMm > 0) {
    const r = valorMm / e.anteriorMm;
    if (r >= 8 || r <= 1 / 8) motivos.push(`variação de ${Math.round(r * 100) / 100}× sobre a medida anterior (${e.anteriorMm} mm): possível troca cm×mm`);
  }
  const c0 = e.corte ?? null, c1 = e.corteAnterior ?? null;
  if (c0 === null || c1 === null) { if (c0 !== c1) motivos.push("corte/série identificado só em um dos exames"); }
  else if (c0.trim().toLowerCase() !== c1.trim().toLowerCase()) motivos.push(`cortes diferentes entre exames (${c1} × ${c0}): medidas não comparáveis`);
  return { estado: motivos.length === 0 ? "OK" : "PENDENTE", valorMm: motivos.length === 0 ? valorMm : null, convertido: e.unidade === "cm" && motivos.length === 0, motivos };
}
