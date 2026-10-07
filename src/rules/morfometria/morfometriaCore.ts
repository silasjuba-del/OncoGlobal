// W10-INT-PRESC-07 · porte para TypeScript puro de docs/specs/skill-morfometria-snc/scripts/morfometria_core.py (D-W9-57).
// Geometria de referência: NÃO é software validado para uso clínico; NÃO lê DICOM, NÃO segmenta lesão,
// NÃO decide RANO-BM. Recebe pontos, máscaras e geometria de origem externa. Unidades explícitas: mm, mm², mm³;
// índices de centro de pixel começam em zero. Sem NumPy (álgebra linear mínima própria), sem I/O, sem rede.
// Mesmas recusas do original: toda entrada insuficiente/inconsistente lança GeometryError.

export class GeometryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeometryError";
  }
}

/** Equivalente a ArrayLike do NumPy: número, ou lista (aninhada) de números; booleanos só em máscaras. */
export type NdLike = number | boolean | readonly NdLike[];

interface Nd { data: number[]; shape: number[] }

function toNd(value: unknown, name: string, allowBool: boolean): Nd {
  const rec = (v: unknown): Nd => {
    if (typeof v === "number") return { data: [v], shape: [] };
    if (typeof v === "boolean" && allowBool) return { data: [v ? 1 : 0], shape: [] };
    if (Array.isArray(v)) {
      const kids = (v as unknown[]).map(rec);
      const first = kids[0];
      if (!first) return { data: [], shape: [0] };
      for (const k of kids) {
        if (k.shape.length !== first.shape.length || k.shape.some((d, i) => d !== first.shape[i]))
          throw new GeometryError(`${name}: esperado array numérico`);
      }
      return { data: kids.flatMap((k) => k.data), shape: [kids.length, ...first.shape] };
    }
    throw new GeometryError(`${name}: esperado array numérico`);
  };
  return rec(value);
}

function array(value: unknown, name: string): Nd {
  const out = toNd(value, name, false);
  if (out.data.length === 0 || !out.data.every(Number.isFinite)) throw new GeometryError(`${name}: vazio, NaN ou infinito`);
  return out;
}

function positive(value: number, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw new GeometryError(`${name}: deve ser finito e positivo`);
  return value;
}

const sameShape = (a: readonly number[], b: readonly number[]): boolean => a.length === b.length && a.every((d, i) => d === b[i]);
const norm = (v: readonly number[]): number => Math.sqrt(v.reduce((s, x) => s + x * x, 0));
const dot = (a: readonly number[], b: readonly number[]): number => a.reduce((s, x, i) => s + x * (b[i] ?? 0), 0);
const at = (a: readonly number[], i: number): number => a[i] ?? 0;
const cross = (a: readonly number[], b: readonly number[]): number[] => [
  at(a, 1) * at(b, 2) - at(a, 2) * at(b, 1),
  at(a, 2) * at(b, 0) - at(a, 0) * at(b, 2),
  at(a, 0) * at(b, 1) - at(a, 1) * at(b, 0),
];

/** atol é tolerância NUMÉRICA dos cossenos, não limiar clínico. */
function iop(orientation: unknown, atol = 1e-4): [number[], number[]] {
  const a = array(orientation, "orientation");
  if (!sameShape(a.shape, [6])) throw new GeometryError("orientation: esperado vetor com seis cossenos");
  const x = a.data.slice(0, 3);
  const y = a.data.slice(3);
  if (Math.abs(norm(x) - 1) > atol || Math.abs(norm(y) - 1) > atol || Math.abs(dot(x, y)) > atol)
    throw new GeometryError("orientation: vetores não unitários/ortogonais");
  // Não normalizar silenciosamente: preservar a geometria fornecida.
  return [x, y];
}

/**
 * Converte centros (r,c) base zero para posições físicas (x,y,z).
 * PixelSpacing=(row_spacing,column_spacing). Os três primeiros valores de orientation
 * indicam a direção ao aumentar c, NÃO ao aumentar r.
 */
export function dicomPointsMm(
  pointsRc: NdLike, originMm: NdLike, orientation: NdLike, pixelSpacingRcMm: NdLike,
): number[][] {
  const rc = array(pointsRc, "points_rc");
  const origin = array(originMm, "origin_mm");
  const spacing = array(pixelSpacingRcMm, "pixel_spacing_rc_mm");
  const [x, y] = iop(orientation);
  if (rc.shape.length !== 2 || rc.shape[1] !== 2 || !sameShape(origin.shape, [3]))
    throw new GeometryError("esperados pontos Nx2 e origem com três componentes");
  if (!sameShape(spacing.shape, [2]) || spacing.data.some((s) => s <= 0))
    throw new GeometryError("PixelSpacing: dois valores estritamente positivos");
  const n = rc.shape[0] ?? 0;
  const out: number[][] = [];
  for (let i = 0; i < n; i++) {
    const r = at(rc.data, i * 2);
    const c = at(rc.data, i * 2 + 1);
    out.push([0, 1, 2].map((k) => at(origin.data, k) + c * at(spacing.data, 1) * at(x, k) + r * at(spacing.data, 0) * at(y, k)));
  }
  return out;
}

/** Distância entre dois pontos já expressos em mm, não em pixels. */
export function distanceMm(p: NdLike, q: NdLike): number {
  const p1 = array(p, "p");
  const p2 = array(q, "q");
  if (!sameShape(p1.shape, p2.shape) || !(sameShape(p1.shape, [2]) || sameShape(p1.shape, [3])))
    throw new GeometryError("p e q devem ser vetores de 2 ou 3 componentes");
  return norm(p1.data.map((v, i) => v - at(p2.data, i)));
}

export interface SliceGeometry {
  order: number[];
  positionsMm: number[];
  spacingsMm: number[];
  normal: number[];
  regularNormalSpacing: boolean;
  regularPositionStep: boolean;
}

/**
 * Ordena planos paralelos usando a projeção da origem na normal.
 * Exige um IOP por frame. Não usa SliceThickness, SliceLocation nem InstanceNumber.
 * Posições regulares não provam cobertura do alvo, ausência de cortes omitidos nem série única.
 */
export function sliceGeometry(
  originsMm: NdLike, orientations: NdLike,
  opts: { directionAtol?: number; positionAtolMm?: number } = {},
): SliceGeometry {
  const directionAtol = opts.directionAtol ?? 1e-4;
  const positionAtolMm = opts.positionAtolMm ?? 1e-5;
  const o = array(originsMm, "origins_mm");
  const iops = array(orientations, "orientations");
  if (o.shape.length !== 2 || o.shape[1] !== 3 || (o.shape[0] ?? 0) < 2) throw new GeometryError("origins_mm: esperado Nx3, N>=2");
  const n = o.shape[0] ?? 0;
  if (!sameShape(iops.shape, [n, 6])) throw new GeometryError("orientations: exige um vetor IOP de seis valores por frame");
  positive(directionAtol, "direction_atol");
  positive(positionAtolMm, "position_atol_mm");
  const row = (k: number): number[] => iops.data.slice(k * 6, k * 6 + 6);
  const [x, y] = iop(row(0), directionAtol);
  for (let k = 0; k < n; k++) {
    iop(row(k), directionAtol);
    if (row(k).some((v, i) => Math.abs(v - at(row(0), i)) > directionAtol))
      throw new GeometryError("orientação variável: não empilhar como planos paralelos");
  }
  const raw = cross(x, y);
  const len = norm(raw);
  const normal = raw.map((v) => v / len); // normalizar só a normal usada para projeção de distâncias
  const origin = (k: number): number[] => o.data.slice(k * 3, k * 3 + 3);
  const z = Array.from({ length: n }, (_, k) => dot(origin(k), normal));
  const order = z.map((_, i) => i).sort((a, b) => (at(z, a) - at(z, b)) || (a - b)); // estável
  const zs = order.map((i) => at(z, i));
  const dz = zs.slice(1).map((v, i) => v - at(zs, i));
  if (dz.some((d) => d <= positionAtolMm)) throw new GeometryError("posições repetidas/quase repetidas: verificar frames");
  const steps = order.slice(1).map((idx, i) => origin(idx).map((v, c) => v - at(origin(at(order, i)), c)));
  return {
    order,
    positionsMm: zs,
    spacingsMm: dz,
    normal,
    regularNormalSpacing: dz.every((d) => Math.abs(d - at(dz, 0)) <= positionAtolMm),
    regularPositionStep: steps.every((s) => s.every((v, c) => Math.abs(v - at(steps[0] ?? [], c)) <= positionAtolMm)),
  };
}

/** Casco convexo exato (cadeia monótona), sem descarte aleatório de pontos. */
function convexHull2d(points: number[][]): number[][] {
  const sorted = [...points].sort((a, b) => (at(a, 0) - at(b, 0)) || (at(a, 1) - at(b, 1)));
  const pts = sorted.filter((p, i) => i === 0 || at(p, 0) !== at(sorted[i - 1] ?? [], 0) || at(p, 1) !== at(sorted[i - 1] ?? [], 1));
  if (pts.length <= 2) return pts;
  const cr = (o: number[], a: number[], b: number[]): number =>
    (at(a, 0) - at(o, 0)) * (at(b, 1) - at(o, 1)) - (at(a, 1) - at(o, 1)) * (at(b, 0) - at(o, 0));
  const build = (seq: number[][]): number[][] => {
    const h: number[][] = [];
    for (const p of seq) {
      while (h.length >= 2 && cr(h[h.length - 2] ?? [], h[h.length - 1] ?? [], p) <= 0) h.pop();
      h.push(p);
    }
    return h;
  };
  const low = build(pts);
  const high = build([...pts].reverse());
  return [...low.slice(0, -1), ...high.slice(0, -1)];
}

export interface Diameter {
  diameterMm: number;
  endpoint1Mm: number[];
  endpoint2Mm: number[];
  inputPointCount: number;
  evaluatedPointCount: number;
}

/**
 * Feret/distância máxima dos pontos de BORDA fornecidos em mm.
 * 2D: casco convexo (não muda o máximo). 3D: varredura exata dos pontos, em blocos; sem reconstruir superfície.
 * Limite computacional explícito: não alega máximo se excedido. NÃO é caliper clinicamente válido/RANO-BM.
 */
export function farthestPairMm(
  boundaryPointsMm: NdLike, opts: { blockSize?: number; maxEvaluatedPoints?: number } = {},
): Diameter {
  const blockSize = opts.blockSize ?? 256;
  const maxEvaluated = opts.maxEvaluatedPoints ?? 12000;
  const a = array(boundaryPointsMm, "boundary_points_mm");
  const dim = a.shape[1] ?? 0;
  const nInput = a.shape[0] ?? 0;
  if (a.shape.length !== 2 || (dim !== 2 && dim !== 3) || nInput < 2) throw new GeometryError("boundary_points_mm: esperado Nx2 ou Nx3, N>=2");
  if (!Number.isInteger(blockSize) || blockSize < 1) throw new GeometryError("block_size: inteiro positivo");
  let points = Array.from({ length: nInput }, (_, i) => a.data.slice(i * dim, i * dim + dim));
  if (dim === 2) points = convexHull2d(points);
  else {
    points = [...points].sort((p, q) => (at(p, 0) - at(q, 0)) || (at(p, 1) - at(q, 1)) || (at(p, 2) - at(q, 2)));
    points = points.filter((p, i) => i === 0 || p.some((v, c) => v !== at(points[i - 1] ?? [], c)));
  }
  if (points.length > maxEvaluated) throw new GeometryError("limite computacional: usar casco convexo 3D verificado; não amostrar");
  let best = -1, ia = 0, ib = 0;
  for (let start = 0; start < points.length; start += blockSize) {
    const end = Math.min(start + blockSize, points.length);
    let value = -1, ba = 0, bb = 0;
    for (let i = start; i < end; i++) {
      for (let j = 0; j < points.length; j++) {
        let d2 = 0;
        for (let c = 0; c < dim; c++) { const d = at(points[i] ?? [], c) - at(points[j] ?? [], c); d2 += d * d; }
        if (d2 > value) { value = d2; ba = i; bb = j; }
      }
    }
    if (value > best) { best = value; ia = ba; ib = bb; }
  }
  return { diameterMm: Math.sqrt(best), endpoint1Mm: points[ia] ?? [], endpoint2Mm: points[ib] ?? [], inputPointCount: nInput, evaluatedPointCount: points.length };
}

/** Somente razão de comprimentos. NÃO verifica régua, isotropia ou perspectiva. */
export function rulerScaleMmPerPx(lengthMm: number, lengthPx: number): number {
  return positive(lengthMm, "length_mm") / positive(lengthPx, "length_px");
}

function binaryMask(mask: unknown, ndim: number): Nd {
  const a = toNd(mask, "mask", true);
  if (a.shape.length !== ndim || a.data.length === 0) throw new GeometryError(`mask: esperado array ${ndim}D não vazio`);
  if (!a.data.every(Number.isFinite)) throw new GeometryError("mask: esperado array numérico/binário finito");
  if (!a.data.every((v) => v === 0 || v === 1)) throw new GeometryError("mask: somente 0/1; probabilidades não são frações de volume");
  return a;
}

export function maskAreaMm2(mask: NdLike, pixelSpacingRcMm: NdLike): number {
  const m = binaryMask(mask, 2);
  const s = array(pixelSpacingRcMm, "pixel_spacing_rc_mm");
  if (!sameShape(s.shape, [2]) || s.data.some((v) => v <= 0)) throw new GeometryError("espaçamento deve ter dois valores positivos em mm");
  return m.data.reduce((acc, v) => acc + v, 0) * at(s.data, 0) * at(s.data, 1);
}

export interface Volume {
  voxelCount: number;
  voxelVolumeMm3: number;
  volumeMm3: number;
  volumeMl: number;
  maskDefinition: string;
}

/** Valores singulares de uma matriz 3x3 (SVD de Jacobi unilateral: precisa em quase-singulares), em ordem decrescente. */
function singularValues(m: number[][]): number[] {
  const cols = [0, 1, 2].map((j) => [0, 1, 2].map((i) => at(m[i] ?? [], j)));
  for (let sweep = 0; sweep < 60; sweep++) {
    let rotated = false;
    for (let p = 0; p < 2; p++) {
      for (let q = p + 1; q < 3; q++) {
        const cp = cols[p] ?? [], cq = cols[q] ?? [];
        const alpha = dot(cp, cp), beta = dot(cq, cq), gamma = dot(cp, cq);
        if (gamma === 0 || Math.abs(gamma) <= 1e-15 * Math.sqrt(alpha * beta)) continue;
        rotated = true;
        const zeta = (beta - alpha) / (2 * gamma);
        const t = Math.sign(zeta || 1) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta));
        const c = 1 / Math.sqrt(1 + t * t), s = c * t;
        const np = cp.map((v, i) => c * v - s * at(cq, i));
        const nq = cp.map((v, i) => s * v + c * at(cq, i));
        cols[p] = np; cols[q] = nq;
      }
    }
    if (!rotated) break;
  }
  return cols.map(norm).sort((a, b) => b - a);
}

/**
 * Volume da máscara em grade REGULAR, inclusive affine com cisalhamento.
 * As colunas de affine_mm[:3,:3] correspondem aos incrementos dos índices do array.
 * Verificação de origem/affine/cobertura é externa e obrigatória. Guarda conservadora:
 * máscara encostando em qualquer borda é rejeitada; não repara cobertura por padding fictício.
 */
export function maskVolume(
  mask: NdLike, affineMm: NdLike,
  opts: { spatialUnit: string; geometryVerified: boolean; coverageComplete: boolean; maskDefinition: string },
): Volume {
  if (opts.spatialUnit !== "mm") throw new GeometryError("unidade deve estar verificada como mm; não presumir");
  if (opts.geometryVerified !== true || opts.coverageComplete !== true) throw new GeometryError("geometria/cobertura não confirmadas");
  if (typeof opts.maskDefinition !== "string" || opts.maskDefinition.trim() === "") throw new GeometryError("declarar compartimento/definição da máscara");
  const m = binaryMask(mask, 3);
  const a = array(affineMm, "affine_mm");
  if (!sameShape(a.shape, [4, 4]) || [0, 0, 0, 1].some((v, i) => Math.abs(at(a.data, 12 + i) - v) > 1e-12))
    throw new GeometryError("affine deve ser matriz homogênea 4x4 válida");
  const b = [0, 1, 2].map((i) => [0, 1, 2].map((j) => at(a.data, i * 4 + j)));
  const sv = singularValues(b);
  if (at(sv, 2) <= Number.EPSILON * at(sv, 0) * 10) throw new GeometryError("affine singular/numericamente degenerado");
  const r = (i: number): number[] => b[i] ?? [];
  const cell = Math.abs(
    at(r(0), 0) * (at(r(1), 1) * at(r(2), 2) - at(r(1), 2) * at(r(2), 1))
    - at(r(0), 1) * (at(r(1), 0) * at(r(2), 2) - at(r(1), 2) * at(r(2), 0))
    + at(r(0), 2) * (at(r(1), 0) * at(r(2), 1) - at(r(1), 1) * at(r(2), 0)),
  );
  if (!Number.isFinite(cell) || cell <= 0) throw new GeometryError("volume de voxel inválido");
  const [d0, d1, d2] = [m.shape[0] ?? 0, m.shape[1] ?? 0, m.shape[2] ?? 0];
  let n = 0;
  let toca = false;
  for (let i = 0; i < d0; i++) {
    for (let j = 0; j < d1; j++) {
      for (let k = 0; k < d2; k++) {
        if (at(m.data, (i * d1 + j) * d2 + k) === 0) continue;
        n++;
        if (i === 0 || i === d0 - 1 || j === 0 || j === d1 - 1 || k === 0 || k === d2 - 1) toca = true;
      }
    }
  }
  if (toca) throw new GeometryError("máscara toca limite: cobertura total não demonstrada");
  const value = n * cell;
  return { voxelCount: n, voxelVolumeMm3: cell, volumeMm3: value, volumeMl: value / 1000, maskDefinition: opts.maskDefinition.trim() };
}

/**
 * Integral trapezoidal entre posições observadas, com áreas terminais zero.
 * Não cria zeros: o chamador fornece cortes realmente observados nos extremos.
 * É aproximação de integração, não recuperação de cortes não adquiridos.
 */
export function trapezoidVolumeMm3(
  areasMm2: NdLike, positionsMm: NdLike, opts: { coverageComplete: boolean; samplingVerified: boolean },
): number {
  if (opts.coverageComplete !== true || opts.samplingVerified !== true) throw new GeometryError("cobertura/amostragem precisam estar verificadas");
  const a = array(areasMm2, "areas_mm2");
  const z = array(positionsMm, "positions_mm");
  if (a.shape.length !== 1 || !sameShape(z.shape, a.shape) || a.data.length < 3) throw new GeometryError("esperados vetores iguais com pelo menos três cortes");
  if (a.data.some((v) => v < 0) || z.data.slice(1).some((v, i) => v - at(z.data, i) <= 0))
    throw new GeometryError("áreas não negativas; posições estritamente crescentes");
  if (at(a.data, 0) !== 0 || at(a.data, a.data.length - 1) !== 0) throw new GeometryError("extremos sem área zero observada: polos incompletos");
  let s = 0;
  for (let i = 0; i < a.data.length - 1; i++) s += 0.5 * (at(a.data, i) + at(a.data, i + 1)) * (at(z.data, i + 1) - at(z.data, i));
  return s;
}

/** Menor autovalor de matriz simétrica (Jacobi cíclico). */
function minEigenvalueSym(m: number[][]): number {
  const n = m.length;
  const a = m.map((r) => [...r]);
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += at(a[p] ?? [], q) ** 2;
    if (off < 1e-30) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = at(a[p] ?? [], q);
        if (apq === 0) continue;
        const theta = (at(a[q] ?? [], q) - at(a[p] ?? [], p)) / (2 * apq);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(1 + theta * theta));
        const c = 1 / Math.sqrt(1 + t * t), s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = at(a[k] ?? [], p), akq = at(a[k] ?? [], q);
          (a[k] as number[])[p] = c * akp - s * akq;
          (a[k] as number[])[q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = at(a[p] ?? [], k), aqk = at(a[q] ?? [], k);
          (a[p] as number[])[k] = c * apk - s * aqk;
          (a[q] as number[])[k] = s * apk + c * aqk;
        }
      }
    }
  }
  return Math.min(...a.map((r, i) => at(r, i)));
}

/**
 * Propagação linear de primeira ordem, com covariâncias em unidades coerentes.
 * Não estima componentes ausentes e não é automaticamente IC95%.
 */
export function propagatedStandardUncertainty(jacobian: NdLike, covariance: NdLike): number {
  const j = array(jacobian, "jacobian");
  const cov = array(covariance, "covariance");
  const n = j.data.length;
  if (j.shape.length !== 1 || !sameShape(cov.shape, [n, n])) throw new GeometryError("dimensões de Jacobiano/covariância incompatíveis");
  const scale = Math.max(Math.max(...cov.data.map(Math.abs)), 2.2250738585072014e-308);
  const tol = 1e-10 * scale;
  const M = Array.from({ length: n }, (_, r) => cov.data.slice(r * n, r * n + n));
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
    if (Math.abs(at(M[r] ?? [], c) - at(M[c] ?? [], r)) > tol) throw new GeometryError("covariância não simétrica");
  if (minEigenvalueSym(M) < -tol) throw new GeometryError("covariância não positiva semidefinida");
  let q = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) q += at(j.data, r) * at(M[r] ?? [], c) * at(j.data, c);
  return Math.sqrt(Math.max(0, q));
}

/** D=kL; ordem de variáveis x=[k,L]. Covariância zero é hipótese do chamador. */
export function diameterStandardUncertainty(
  lengthPx: number, scaleMmPerPx: number, uLengthPx: number, uScaleMmPerPx: number, covarianceScaleLength = 0,
): number {
  const length = positive(lengthPx, "length_px");
  const scale = positive(scaleMmPerPx, "scale_mm_per_px");
  const values = array([uLengthPx, uScaleMmPerPx], "incertezas");
  if (values.data.some((v) => v < 0)) throw new GeometryError("incertezas-padrão não podem ser negativas");
  return propagatedStandardUncertainty(
    [length, scale],
    [[uScaleMmPerPx ** 2, covarianceScaleLength], [covarianceScaleLength, uLengthPx ** 2]],
  );
}

export interface ObservedSpread { n: number; medianMm: number; rangeMm: number; rangeOverMedian: number | null }

/** Dispersão DESCRITIVA; não gera APROVADO, acurácia ou estabilidade clínica. */
export function observedSpread(valuesMm: readonly number[]): ObservedSpread {
  const a = array(valuesMm, "values_mm");
  if (a.shape.length !== 1 || a.data.some((v) => v < 0)) throw new GeometryError("medidas devem ser vetor não negativo");
  const s = [...a.data].sort((x, y) => x - y);
  const h = s.length >> 1;
  const median = s.length % 2 ? at(s, h) : (at(s, h - 1) + at(s, h)) / 2;
  const spread = at(s, s.length - 1) - at(s, 0);
  return { n: s.length, medianMm: median, rangeMm: spread, rangeOverMedian: median > 0 ? spread / median : null };
}
