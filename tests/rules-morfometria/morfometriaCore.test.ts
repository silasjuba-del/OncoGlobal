// Porte dos 36 casos de docs/specs/skill-morfometria-snc/tests/test_morfometria_core.py (somente dados sintéticos).
import { describe, expect, it } from "vitest";
import {
  GeometryError, dicomPointsMm, distanceMm, sliceGeometry, farthestPairMm, rulerScaleMmPerPx, maskAreaMm2, maskVolume,
  trapezoidVolumeMm3, propagatedStandardUncertainty, diameterStandardUncertainty, observedSpread, type NdLike,
} from "../../src/rules/morfometria/morfometriaCore.js";

const IOP = [1, 0, 0, 0, 1, 0];
const close = (a: number, b: number, d = 9) => expect(Math.abs(a - b)).toBeLessThan(10 ** -d);
const closeVec = (a: readonly number[], b: readonly number[]) => {
  expect(a).toHaveLength(b.length);
  a.forEach((v, i) => close(v, b[i] ?? NaN, 9));
};
const full = (shape: [number, number, number], v: number): number[][][] =>
  Array.from({ length: shape[0] }, () => Array.from({ length: shape[1] }, () => Array.from({ length: shape[2] }, () => v)));
const diag = (a: number, b: number, c: number): number[][] => [[a, 0, 0, 0], [0, b, 0, 0], [0, 0, c, 0], [0, 0, 0, 1]];
const mask120 = (): number[][][] => {
  const m = full([6, 7, 8], 0);
  for (let i = 1; i < 5; i++) for (let j = 1; j < 6; j++) for (let k = 1; k < 7; k++) (m[i] as number[][])[j]![k] = 1; // 120 células; borda externa vazia
  return m;
};
const volume = (o: { mask?: NdLike; affine?: NdLike; spatialUnit?: string; geometryVerified?: boolean; coverageComplete?: boolean } = {}) =>
  maskVolume(o.mask ?? mask120(), o.affine ?? diag(0.5, 0.75, 2.0), {
    spatialUnit: o.spatialUnit ?? "mm", geometryVerified: o.geometryVerified ?? true,
    coverageComplete: o.coverageComplete ?? true, maskDefinition: "sintetica_binaria",
  });

describe("W10-INT-PRESC-07 · morfometria (36 casos portados)", () => {
  it("01 row_column_spacing", () => {
    const p = dicomPointsMm([[2, 3]], [10, 20, 30], IOP, [2, 0.5]);
    closeVec(p[0] ?? [], [11.5, 24, 30]);
  });
  it("02 anisotropic_distance", () => {
    const p = dicomPointsMm([[0, 0], [4, 6]], [0, 0, 0], IOP, [2, 0.5]);
    close(distanceMm(p[0] ?? [], p[1] ?? []), Math.sqrt(73));
  });
  it("03 oblique_rotation_invariance", () => {
    const c = Math.cos(0.7), s = Math.sin(0.7);
    const p = dicomPointsMm([[0, 0], [4, 6]], [7, -4, 3], [c, 0, -s, 0, 1, 0], [2, 0.5]);
    close(distanceMm(p[0] ?? [], p[1] ?? []), Math.sqrt(73));
  });
  it("04 invalid_orientation", () => {
    expect(() => dicomPointsMm([[0, 0]], [0, 0, 0], [2, 0, 0, 0, 1, 0], [1, 1])).toThrow(GeometryError);
  });
  it("05 invalid_spacing", () => {
    expect(() => dicomPointsMm([[0, 0]], [0, 0, 0], IOP, [0, 1])).toThrow(GeometryError);
  });
  it("06 native_positions_not_thickness_or_order", () => {
    const g = sliceGeometry([[0, 0, 4], [0, 0, 0], [0, 0, 2]], [IOP, IOP, IOP]);
    expect(g.order).toEqual([1, 2, 0]);
    expect(g.spacingsMm).toEqual([2, 2]);
    expect(g.regularNormalSpacing).toBe(true);
  });
  it("07 irregular_slice_spacing", () => {
    const g = sliceGeometry([[0, 0, 0], [0, 0, 2], [0, 0, 5]], [IOP, IOP, IOP]);
    expect(g.spacingsMm).toEqual([2, 3]);
    expect(g.regularNormalSpacing).toBe(false);
  });
  it("08 duplicate_positions", () => {
    expect(() => sliceGeometry([[0, 0, 0], [0, 0, 0]], [IOP, IOP])).toThrow(GeometryError);
  });
  it("09 mixed_orientations", () => {
    expect(() => sliceGeometry([[0, 0, 0], [0, 0, 2]], [IOP, [0, 1, 0, -1, 0, 0]])).toThrow(GeometryError);
  });
  it("10 feret_not_bbox_axis", () => {
    const r = farthestPairMm([[0, 0], [6, 0], [6, 8], [0, 8], [3, 4]]);
    expect(r.diameterMm).toBe(10);
    expect(r.evaluatedPointCount).toBe(4);
  });
  it("11 3d_diameter", () => {
    expect(farthestPairMm([[0, 0, 0], [2, 3, 6], [1, 1, 1]]).diameterMm).toBe(7);
  });
  it("12 same_points", () => {
    expect(farthestPairMm([[1, 1], [1, 1]]).diameterMm).toBe(0);
  });
  it("13 no_silent_sampling", () => {
    expect(() => farthestPairMm([[0, 0, 0], [1, 2, 3], [2, 4, 5]], { maxEvaluatedPoints: 2 })).toThrow(GeometryError);
  });
  it("14 resize_invariance_with_ruler", () => {
    const d1 = 47 * rulerScaleMmPerPx(20, 100);
    const d2 = 47 * 3 * rulerScaleMmPerPx(20, 100 * 3);
    close(d1, d2);
  });
  it("15 ruler_zero_refused", () => {
    expect(() => rulerScaleMmPerPx(20, 0)).toThrow(GeometryError);
  });
  it("16 mask_area", () => {
    close(maskAreaMm2([[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]], [0.5, 2]), 12);
  });
  it("17 nonbinary_mask_rejected", () => {
    expect(() => maskAreaMm2([[0, 0.5], [1, 0]], [1, 1])).toThrow(GeometryError);
  });
  it("18 volume_anisotropic", () => {
    const r = volume();
    expect(r.voxelCount).toBe(120);
    close(r.volumeMm3, 90);
    close(r.volumeMl, 0.09);
  });
  it("19 volume_shear_determinant", () => {
    const a = diag(1, 1, 1);
    a[0] = [0.5, 0, 0.4, 0]; a[1] = [0, 0.75, 0, 0]; a[2] = [0, 0, 2, 0];
    close(volume({ affine: a }).volumeMm3, 90);
  });
  it("20 volume_rotation", () => {
    const t = 0.9, c = Math.cos(t), s = Math.sin(t);
    const d = [0.5, 0.75, 2.0];
    const rot = [[c, -s, 0], [s, c, 0], [0, 0, 1]];
    const a = rot.map((row, i) => [...row.map((v, j) => v * (d[j] ?? 0)), 0]);
    a.push([0, 0, 0, 1]);
    close(volume({ affine: a }).volumeMm3, 90);
  });
  it("21 volume_scale_cubed", () => {
    close(volume({ affine: diag(1.0, 1.5, 4.0) }).volumeMm3, 8 * 90);
  });
  it("22 unknown_unit_rejected", () => {
    expect(() => volume({ spatialUnit: "unknown" })).toThrow(GeometryError);
  });
  it("23 incomplete_coverage_rejected", () => {
    expect(() => volume({ coverageComplete: false })).toThrow(GeometryError);
  });
  it("24 unverified_geometry_rejected", () => {
    expect(() => volume({ geometryVerified: false })).toThrow(GeometryError);
  });
  it("25 boundary_mask_rejected", () => {
    expect(() => volume({ mask: full([3, 4, 5], 1) })).toThrow(GeometryError);
    expect(() => volume({ mask: full([3, 4, 5], 1).map((p) => p.map((r) => r.map(() => true))) })).toThrow(GeometryError);
  });
  it("26 singular_affine_rejected", () => {
    expect(() => volume({ affine: diag(1, 1, 0) })).toThrow(GeometryError);
  });
  it("27 empty_mask_is_zero_not_diagnostic_exclusion", () => {
    expect(volume({ mask: full([5, 5, 5], 0) }).volumeMm3).toBe(0);
  });
  it("28 irregular_trapezoid_integration", () => {
    expect(trapezoidVolumeMm3([0, 10, 20, 0], [0, 1, 3, 6], { coverageComplete: true, samplingVerified: true })).toBe(65);
  });
  it("29 truncated_pole_rejected", () => {
    expect(() => trapezoidVolumeMm3([1, 10, 0], [0, 1, 2], { coverageComplete: true, samplingVerified: true })).toThrow(GeometryError);
  });
  it("30 uncertainty_independent", () => {
    close(diameterStandardUncertainty(40, 0.5, 2, 0.01), Math.sqrt(1.16));
  });
  it("31 uncertainty_covariance_changes_result", () => {
    close(diameterStandardUncertainty(40, 0.5, 2, 0.01, 0.01), Math.sqrt(1.56));
  });
  it("32 invalid_covariance_rejected", () => {
    expect(() => propagatedStandardUncertainty([1, 1], [[1, 2], [2, 1]])).toThrow(GeometryError);
  });
  it("33 common_bias_not_proof_of_accuracy", () => {
    const wrong = observedSpread([25, 25, 25]);
    expect(wrong.rangeMm).toBe(0);
    expect(wrong.medianMm).not.toBe(20);
    expect(wrong).not.toHaveProperty("approved");
  });
  it("34 zero_median_no_relative_division", () => {
    expect(observedSpread([0, 0, 0]).rangeOverMedian).toBeNull();
  });
  it("35 nan_rejected", () => {
    expect(() => distanceMm([0, Number.NaN], [0, 1])).toThrow(GeometryError);
  });
  it("36 sampled_ellipsoid_contour", () => {
    const pts = Array.from({ length: 720 }, (_, i) => { const t = (i * 2 * Math.PI) / 720; return [13 * Math.cos(t), 7 * Math.sin(t)]; });
    close(farthestPairMm(pts).diameterMm, 26, 12);
  });
});
