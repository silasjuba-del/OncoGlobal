"""Somente testes sintéticos; nenhum caso clínico é usado como padrão."""
from __future__ import annotations
import math
import sys
import unittest
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from morfometria_core import (
    GeometryError, dicom_points_mm, distance_mm, slice_geometry,
    farthest_pair_mm, ruler_scale_mm_per_px, mask_area_mm2, mask_volume,
    trapezoid_volume_mm3, propagated_standard_uncertainty,
    diameter_standard_uncertainty, observed_spread,
)


class GeometryTests(unittest.TestCase):
    def setUp(self):
        self.iop = [1, 0, 0, 0, 1, 0]

    def test_row_column_spacing(self):
        p = dicom_points_mm([[2, 3]], [10, 20, 30], self.iop, [2, 0.5])
        np.testing.assert_allclose(p, [[11.5, 24, 30]])

    def test_anisotropic_distance(self):
        p = dicom_points_mm([[0, 0], [4, 6]], [0, 0, 0], self.iop, [2, 0.5])
        self.assertAlmostEqual(distance_mm(*p), math.sqrt(73))

    def test_oblique_rotation_invariance(self):
        c, s = math.cos(0.7), math.sin(0.7)
        q = [c, 0, -s, 0, 1, 0]
        p = dicom_points_mm([[0, 0], [4, 6]], [7, -4, 3], q, [2, 0.5])
        self.assertAlmostEqual(distance_mm(*p), math.sqrt(73))

    def test_invalid_orientation(self):
        with self.assertRaises(GeometryError):
            dicom_points_mm([[0, 0]], [0, 0, 0], [2, 0, 0, 0, 1, 0], [1, 1])

    def test_invalid_spacing(self):
        with self.assertRaises(GeometryError):
            dicom_points_mm([[0, 0]], [0, 0, 0], self.iop, [0, 1])

    def test_native_positions_not_thickness_or_order(self):
        # Centros a cada 2 mm; a espessura hipotética de 4 mm não participa.
        g = slice_geometry([[0, 0, 4], [0, 0, 0], [0, 0, 2]], [self.iop]*3)
        self.assertEqual(g.order, (1, 2, 0))
        self.assertEqual(g.spacings_mm, (2, 2))
        self.assertTrue(g.regular_normal_spacing)

    def test_irregular_slice_spacing(self):
        g = slice_geometry([[0, 0, 0], [0, 0, 2], [0, 0, 5]], [self.iop]*3)
        self.assertEqual(g.spacings_mm, (2, 3))
        self.assertFalse(g.regular_normal_spacing)

    def test_duplicate_positions(self):
        with self.assertRaises(GeometryError):
            slice_geometry([[0, 0, 0], [0, 0, 0]], [self.iop]*2)

    def test_mixed_orientations(self):
        with self.assertRaises(GeometryError):
            slice_geometry([[0, 0, 0], [0, 0, 2]],
                           [self.iop, [0, 1, 0, -1, 0, 0]])

    def test_feret_not_bbox_axis(self):
        result = farthest_pair_mm([[0, 0], [6, 0], [6, 8], [0, 8], [3, 4]])
        self.assertEqual(result.diameter_mm, 10)
        self.assertEqual(result.evaluated_point_count, 4)

    def test_3d_diameter(self):
        result = farthest_pair_mm([[0, 0, 0], [2, 3, 6], [1, 1, 1]])
        self.assertEqual(result.diameter_mm, 7)

    def test_same_points(self):
        self.assertEqual(farthest_pair_mm([[1, 1], [1, 1]]).diameter_mm, 0)

    def test_no_silent_sampling(self):
        with self.assertRaises(GeometryError):
            farthest_pair_mm([[0, 0, 0], [1, 2, 3], [2, 4, 5]], max_evaluated_points=2)

    def test_resize_invariance_with_ruler(self):
        # Régua clínica e alvo redimensionados juntos.
        d1 = 47 * ruler_scale_mm_per_px(20, 100)
        d2 = (47*3) * ruler_scale_mm_per_px(20, 100*3)
        self.assertAlmostEqual(d1, d2)

    def test_ruler_zero_refused(self):
        with self.assertRaises(GeometryError):
            ruler_scale_mm_per_px(20, 0)

    def test_mask_area(self):
        self.assertAlmostEqual(mask_area_mm2(np.ones((3, 4)), [0.5, 2]), 12)

    def test_nonbinary_mask_rejected(self):
        with self.assertRaises(GeometryError):
            mask_area_mm2([[0, 0.5], [1, 0]], [1, 1])

    def _volume(self, mask=None, affine=None, **kwargs):
        if mask is None:
            mask = np.zeros((6, 7, 8), dtype=bool)
            mask[1:5, 1:6, 1:7] = True  # 120 células; borda externa observada vazia.
        if affine is None:
            affine = np.diag([0.5, 0.75, 2.0, 1.0])
        args = dict(spatial_unit="mm", geometry_verified=True,
                    coverage_complete=True, mask_definition="sintetica_binaria")
        args.update(kwargs)
        return mask_volume(mask, affine, **args)

    def test_volume_anisotropic(self):
        r = self._volume()
        self.assertEqual(r.voxel_count, 120)
        self.assertAlmostEqual(r.volume_mm3, 90)
        self.assertAlmostEqual(r.volume_ml, 0.09)

    def test_volume_shear_determinant(self):
        a = np.eye(4)
        a[:3, :3] = [[0.5, 0, 0.4], [0, 0.75, 0], [0, 0, 2]]
        self.assertAlmostEqual(self._volume(affine=a).volume_mm3, 90)

    def test_volume_rotation(self):
        a = np.diag([0.5, 0.75, 2.0, 1.0])
        t = 0.9
        rot = np.array([[math.cos(t), -math.sin(t), 0],
                        [math.sin(t), math.cos(t), 0], [0, 0, 1]])
        a[:3, :3] = rot @ a[:3, :3]
        self.assertAlmostEqual(self._volume(affine=a).volume_mm3, 90)

    def test_volume_scale_cubed(self):
        a = np.diag([1.0, 1.5, 4.0, 1.0])
        self.assertAlmostEqual(self._volume(affine=a).volume_mm3, 8*90)

    def test_unknown_unit_rejected(self):
        with self.assertRaises(GeometryError):
            self._volume(spatial_unit="unknown")

    def test_incomplete_coverage_rejected(self):
        with self.assertRaises(GeometryError):
            self._volume(coverage_complete=False)

    def test_unverified_geometry_rejected(self):
        with self.assertRaises(GeometryError):
            self._volume(geometry_verified=False)

    def test_boundary_mask_rejected(self):
        with self.assertRaises(GeometryError):
            self._volume(mask=np.ones((3, 4, 5), dtype=bool))

    def test_singular_affine_rejected(self):
        with self.assertRaises(GeometryError):
            self._volume(affine=np.diag([1, 1, 0, 1]))

    def test_empty_mask_is_zero_not_diagnostic_exclusion(self):
        self.assertEqual(self._volume(mask=np.zeros((5, 5, 5))).volume_mm3, 0)

    def test_irregular_trapezoid_integration(self):
        v = trapezoid_volume_mm3([0, 10, 20, 0], [0, 1, 3, 6],
                                coverage_complete=True, sampling_verified=True)
        self.assertEqual(v, 65)

    def test_truncated_pole_rejected(self):
        with self.assertRaises(GeometryError):
            trapezoid_volume_mm3([1, 10, 0], [0, 1, 2],
                                 coverage_complete=True, sampling_verified=True)

    def test_uncertainty_independent(self):
        u = diameter_standard_uncertainty(40, 0.5, 2, 0.01)
        self.assertAlmostEqual(u, math.sqrt(1.16))

    def test_uncertainty_covariance_changes_result(self):
        u = diameter_standard_uncertainty(40, 0.5, 2, 0.01, 0.01)
        self.assertAlmostEqual(u, math.sqrt(1.56))

    def test_invalid_covariance_rejected(self):
        with self.assertRaises(GeometryError):
            propagated_standard_uncertainty([1, 1], [[1, 2], [2, 1]])

    def test_common_bias_not_proof_of_accuracy(self):
        truth_mm = 20
        wrong = observed_spread([25, 25, 25])
        self.assertEqual(wrong["range_mm"], 0)
        self.assertNotEqual(wrong["median_mm"], truth_mm)
        self.assertNotIn("approved", wrong)

    def test_zero_median_no_relative_division(self):
        self.assertIsNone(observed_spread([0, 0, 0])["range_over_median"])

    def test_nan_rejected(self):
        with self.assertRaises(GeometryError):
            distance_mm([0, float("nan")], [0, 1])

    def test_sampled_ellipsoid_contour(self):
        t = np.linspace(0, 2*np.pi, 720, endpoint=False)
        # Contorno matemático, sem erro de segmentação/rasterização.
        p = np.column_stack([13*np.cos(t), 7*np.sin(t)])
        r = farthest_pair_mm(p)
        self.assertAlmostEqual(r.diameter_mm, 26, places=12)


if __name__ == "__main__":
    unittest.main(verbosity=2)
