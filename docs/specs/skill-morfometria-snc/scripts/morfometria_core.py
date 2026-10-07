"""Geometria de referência para a skill v4.0.0.

NÃO é software validado para uso clínico. NÃO lê DICOM, não identifica/segmenta
lesões e não decide RANO-BM. Recebe pontos, máscaras e geometria de origem externa.
Unidades explícitas: mm, mm², mm³; índices de centro de pixel começam em zero.
Dependência: NumPy. Nenhum acesso à rede, instalação ou escrita automática.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence
import numpy as np
from numpy.typing import ArrayLike, NDArray


class GeometryError(ValueError):
    """Entrada insuficiente, inconsistente ou fora do contrato matemático."""


def _array(value: ArrayLike, name: str) -> NDArray[np.float64]:
    try:
        out = np.asarray(value, dtype=np.float64)
    except (TypeError, ValueError) as exc:
        raise GeometryError(f"{name}: esperado array numérico") from exc
    if out.size == 0 or not np.all(np.isfinite(out)):
        raise GeometryError(f"{name}: vazio, NaN ou infinito")
    return out


def _positive(value: float, name: str) -> float:
    val = float(value)
    if not np.isfinite(val) or val <= 0:
        raise GeometryError(f"{name}: deve ser finito e positivo")
    return val


def _iop(orientation: ArrayLike, atol: float = 1e-4) -> tuple[NDArray, NDArray]:
    """atol é tolerância NUMÉRICA dos cossenos, não limiar clínico."""
    a = _array(orientation, "orientation")
    if a.shape != (6,):
        raise GeometryError("orientation: esperado vetor com seis cossenos")
    x, y = a[:3], a[3:]
    if (abs(np.linalg.norm(x) - 1) > atol
            or abs(np.linalg.norm(y) - 1) > atol
            or abs(float(x @ y)) > atol):
        raise GeometryError("orientation: vetores não unitários/ortogonais")
    # Não normalizar silenciosamente: preservar a geometria fornecida.
    return x, y


def dicom_points_mm(
    points_rc: ArrayLike,
    origin_mm: ArrayLike,
    orientation: ArrayLike,
    pixel_spacing_rc_mm: ArrayLike,
) -> NDArray[np.float64]:
    """Converte centros (r,c) base zero para posições físicas (x,y,z).

    PixelSpacing=(row_spacing,column_spacing). Os primeiros três valores de
    orientation indicam a direção ao aumentar c, NÃO ao aumentar r.
    """
    rc = _array(points_rc, "points_rc")
    origin = _array(origin_mm, "origin_mm")
    spacing = _array(pixel_spacing_rc_mm, "pixel_spacing_rc_mm")
    x, y = _iop(orientation)
    if rc.ndim != 2 or rc.shape[1] != 2 or origin.shape != (3,):
        raise GeometryError("esperados pontos Nx2 e origem com três componentes")
    if spacing.shape != (2,) or np.any(spacing <= 0):
        raise GeometryError("PixelSpacing: dois valores estritamente positivos")
    return (origin + rc[:, 1, None] * spacing[1] * x
            + rc[:, 0, None] * spacing[0] * y)


def distance_mm(p: ArrayLike, q: ArrayLike) -> float:
    """Distância entre dois pontos já expressos em mm, não em pixels."""
    p1, p2 = _array(p, "p"), _array(q, "q")
    if p1.shape != p2.shape or p1.shape not in ((2,), (3,)):
        raise GeometryError("p e q devem ser vetores de 2 ou 3 componentes")
    return float(np.linalg.norm(p1 - p2))


@dataclass(frozen=True)
class SliceGeometry:
    order: tuple[int, ...]
    positions_mm: tuple[float, ...]
    spacings_mm: tuple[float, ...]
    normal: tuple[float, ...]
    regular_normal_spacing: bool
    regular_position_step: bool


def slice_geometry(
    origins_mm: ArrayLike,
    orientations: ArrayLike,
    *,
    direction_atol: float = 1e-4,
    position_atol_mm: float = 1e-5,
) -> SliceGeometry:
    """Ordena planos paralelos usando projeção da origem na normal.

    Exige um IOP por frame. Não usa SliceThickness, SliceLocation ou InstanceNumber.
    Uma sequência regular de posições não prova que o alvo foi coberto, que não
    houve omissão sistemática de cortes, ou que os frames pertencem à mesma série.
    Tolerâncias são apenas numéricas; devem ser documentadas pelo chamador.
    """
    o = _array(origins_mm, "origins_mm")
    iops = _array(orientations, "orientations")
    if o.ndim != 2 or o.shape[1] != 3 or len(o) < 2:
        raise GeometryError("origins_mm: esperado Nx3, N>=2")
    if iops.shape != (len(o), 6):
        raise GeometryError("orientations: exige um vetor IOP de seis valores por frame")
    _positive(direction_atol, "direction_atol")
    _positive(position_atol_mm, "position_atol_mm")
    x, y = _iop(iops[0], direction_atol)
    for row in iops:
        _iop(row, direction_atol)
        if not np.allclose(row, iops[0], rtol=0, atol=direction_atol):
            raise GeometryError("orientação variável: não empilhar como planos paralelos")
    normal = np.cross(x, y)
    # Normalizar explicitamente só a normal usada para projeção de distâncias.
    normal = normal / np.linalg.norm(normal)
    z = o @ normal
    order = np.argsort(z, kind="stable")
    zs = z[order]
    dz = np.diff(zs)
    if np.any(dz <= position_atol_mm):
        raise GeometryError("posições repetidas/quase repetidas: verificar frames")
    step = np.diff(o[order], axis=0)
    return SliceGeometry(
        tuple(map(int, order)), tuple(map(float, zs)), tuple(map(float, dz)),
        tuple(map(float, normal)),
        bool(np.allclose(dz, dz[0], atol=position_atol_mm, rtol=0)),
        bool(np.allclose(step, step[0], atol=position_atol_mm, rtol=0)),
    )


def _convex_hull_2d(points: NDArray) -> NDArray:
    """Casco convexo exato (na aritmética float), sem descarte aleatório de pontos."""
    pts = sorted(set(map(tuple, points.tolist())))
    if len(pts) <= 2:
        return np.asarray(pts, dtype=np.float64)

    def cross(o: tuple, a: tuple, b: tuple) -> float:
        return (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])

    low: list[tuple] = []
    for p in pts:
        while len(low) >= 2 and cross(low[-2], low[-1], p) <= 0:
            low.pop()
        low.append(p)
    high: list[tuple] = []
    for p in reversed(pts):
        while len(high) >= 2 and cross(high[-2], high[-1], p) <= 0:
            high.pop()
        high.append(p)
    return np.asarray(low[:-1] + high[:-1], dtype=np.float64)


@dataclass(frozen=True)
class Diameter:
    diameter_mm: float
    endpoint_1_mm: tuple[float, ...]
    endpoint_2_mm: tuple[float, ...]
    input_point_count: int
    evaluated_point_count: int


def farthest_pair_mm(
    boundary_points_mm: ArrayLike, *, block_size: int = 256,
    max_evaluated_points: int = 12000,
) -> Diameter:
    """Feret/distância máxima dos pontos de BORDA fornecidos em mm.

    2D: usa casco convexo sem mudar o máximo. 3D: varredura exata dos pontos
    fornecidos, em blocos; não reconstrói superfície nem faz simplificação.
    Limite computacional explícito: não alegar máximo se o limite foi excedido.
    O resultado NÃO é automaticamente um caliper clinicamente válido/RANO-BM.
    """
    points = _array(boundary_points_mm, "boundary_points_mm")
    if points.ndim != 2 or points.shape[1] not in (2, 3) or len(points) < 2:
        raise GeometryError("boundary_points_mm: esperado Nx2 ou Nx3, N>=2")
    if not isinstance(block_size, int) or block_size < 1:
        raise GeometryError("block_size: inteiro positivo")
    n_input = len(points)
    if points.shape[1] == 2:
        points = _convex_hull_2d(points)
    else:
        points = np.unique(points, axis=0)
    if len(points) > max_evaluated_points:
        raise GeometryError("limite computacional: usar casco convexo 3D verificado; não amostrar")
    best, ia, ib = -1.0, 0, 0
    for start in range(0, len(points), block_size):
        diff = points[start:start+block_size, None, :] - points[None, :, :]
        d2 = np.einsum("ijk,ijk->ij", diff, diff)
        flat = int(np.argmax(d2))
        a, b = np.unravel_index(flat, d2.shape)
        value = float(d2[a, b])
        if value > best:
            best, ia, ib = value, start+int(a), int(b)
    return Diameter(float(np.sqrt(best)), tuple(map(float, points[ia])),
                    tuple(map(float, points[ib])), n_input, len(points))


def ruler_scale_mm_per_px(length_mm: float, length_px: float) -> float:
    """Somente razão de comprimentos. NÃO verifica régua, isotropia ou perspectiva."""
    return _positive(length_mm, "length_mm") / _positive(length_px, "length_px")


def _binary_mask(mask: ArrayLike, ndim: int) -> NDArray[np.bool_]:
    a = np.asarray(mask)
    if a.ndim != ndim or a.size == 0:
        raise GeometryError(f"mask: esperado array {ndim}D não vazio")
    if a.dtype.kind not in "bufi" or not np.all(np.isfinite(a)):
        raise GeometryError("mask: esperado array numérico/binário finito")
    if not np.all((a == 0) | (a == 1)):
        raise GeometryError("mask: somente 0/1; probabilidades não são frações de volume")
    return a.astype(bool, copy=False)


def mask_area_mm2(mask: ArrayLike, pixel_spacing_rc_mm: ArrayLike) -> float:
    m = _binary_mask(mask, 2)
    s = _array(pixel_spacing_rc_mm, "pixel_spacing_rc_mm")
    if s.shape != (2,) or np.any(s <= 0):
        raise GeometryError("espaçamento deve ter dois valores positivos em mm")
    return float(np.count_nonzero(m) * s[0] * s[1])


@dataclass(frozen=True)
class Volume:
    voxel_count: int
    voxel_volume_mm3: float
    volume_mm3: float
    volume_ml: float
    mask_definition: str


def mask_volume(
    mask: ArrayLike,
    affine_mm: ArrayLike,
    *,
    spatial_unit: str,
    geometry_verified: bool,
    coverage_complete: bool,
    mask_definition: str,
) -> Volume:
    """Volume da máscara em grade REGULAR, inclusive affine com cisalhamento.

    As colunas de affine_mm[:3,:3] devem corresponder aos incrementos dos índices
    do array. A verificação de origem/affine/cobertura é externa e obrigatória.
    Guarda conservadora: máscara encostando em qualquer borda é rejeitada.
    Não reparar cobertura por padding fictício. Não substitui auditoria da série.
    """
    if spatial_unit != "mm":
        raise GeometryError("unidade deve estar verificada como mm; não presumir")
    if geometry_verified is not True or coverage_complete is not True:
        raise GeometryError("geometria/cobertura não confirmadas")
    if not isinstance(mask_definition, str) or not mask_definition.strip():
        raise GeometryError("declarar compartimento/definição da máscara")
    m = _binary_mask(mask, 3)
    a = _array(affine_mm, "affine_mm")
    if a.shape != (4, 4) or not np.allclose(a[3], [0, 0, 0, 1], atol=1e-12, rtol=0):
        raise GeometryError("affine deve ser matriz homogênea 4x4 válida")
    b = a[:3, :3]
    singular = np.linalg.svd(b, compute_uv=False)
    if singular[-1] <= np.finfo(float).eps * singular[0] * 10:
        raise GeometryError("affine singular/numericamente degenerado")
    cell = abs(float(np.linalg.det(b)))
    if not np.isfinite(cell) or cell <= 0:
        raise GeometryError("volume de voxel inválido")
    for axis in range(3):
        if np.take(m, 0, axis=axis).any() or np.take(m, -1, axis=axis).any():
            raise GeometryError("máscara toca limite: cobertura total não demonstrada")
    n = int(np.count_nonzero(m))
    value = n * cell
    return Volume(n, cell, value, value/1000, mask_definition.strip())


def trapezoid_volume_mm3(
    areas_mm2: ArrayLike, positions_mm: ArrayLike, *,
    coverage_complete: bool, sampling_verified: bool,
) -> float:
    """Integral trapezoidal entre posições observadas, com áreas terminais zero.

    Não cria zeros. O chamador deve fornecer cortes realmente observados nos
    extremos, confirmar amostragem e documentar interpolação entre planos.
    É aproximação de integração, não recuperação dos cortes não adquiridos.
    """
    if coverage_complete is not True or sampling_verified is not True:
        raise GeometryError("cobertura/amostragem precisam estar verificadas")
    a, z = _array(areas_mm2, "areas_mm2"), _array(positions_mm, "positions_mm")
    if a.ndim != 1 or z.shape != a.shape or len(a) < 3:
        raise GeometryError("esperados vetores iguais com pelo menos três cortes")
    if np.any(a < 0) or np.any(np.diff(z) <= 0):
        raise GeometryError("áreas não negativas; posições estritamente crescentes")
    if a[0] != 0 or a[-1] != 0:
        raise GeometryError("extremos sem área zero observada: polos incompletos")
    return float(np.sum(0.5*(a[:-1]+a[1:])*np.diff(z)))


def propagated_standard_uncertainty(jacobian: ArrayLike, covariance: ArrayLike) -> float:
    """Propagação linear de primeira ordem, com covariâncias em unidades coerentes.

    Não estima componentes ausentes e não é automaticamente IC95%.
    """
    j = _array(jacobian, "jacobian")
    cov = _array(covariance, "covariance")
    if j.ndim != 1 or cov.shape != (len(j), len(j)):
        raise GeometryError("dimensões de Jacobiano/covariância incompatíveis")
    scale = max(float(np.max(np.abs(cov))), np.finfo(float).tiny)
    tol = 1e-10*scale
    if not np.allclose(cov, cov.T, rtol=0, atol=tol):
        raise GeometryError("covariância não simétrica")
    if np.linalg.eigvalsh(cov).min() < -tol:
        raise GeometryError("covariância não positiva semidefinida")
    return float(np.sqrt(max(0.0, float(j @ cov @ j))))


def diameter_standard_uncertainty(
    length_px: float, scale_mm_per_px: float,
    u_length_px: float, u_scale_mm_per_px: float,
    covariance_scale_length: float = 0.0,
) -> float:
    """D=kL; ordem de variáveis x=[k,L]. Covariância zero é hipótese do chamador."""
    length = _positive(length_px, "length_px")
    scale = _positive(scale_mm_per_px, "scale_mm_per_px")
    values = _array([u_length_px, u_scale_mm_per_px], "incertezas")
    if np.any(values < 0):
        raise GeometryError("incertezas-padrão não podem ser negativas")
    return propagated_standard_uncertainty(
        [length, scale],
        [[u_scale_mm_per_px**2, covariance_scale_length],
         [covariance_scale_length, u_length_px**2]],
    )


def observed_spread(values_mm: Sequence[float]) -> dict[str, float | int | None]:
    """Dispersão DESCRITIVA; não gera APROVADO, acurácia ou estabilidade clínica."""
    a = _array(values_mm, "values_mm")
    if a.ndim != 1 or np.any(a < 0):
        raise GeometryError("medidas devem ser vetor não negativo")
    median = float(np.median(a))
    spread = float(np.max(a)-np.min(a))
    return {"n": len(a), "median_mm": median, "range_mm": spread,
            "range_over_median": spread/median if median > 0 else None}
