"""
Unified Gate Optimization Service

Provides a single decomposition entrypoint that handles both standard named gates
(H, X, Y, Z, S, T, Rx, Ry, Rz, U) and controlled-unitary (CU) gates.

For standard gates, the backend maps the gate name to its canonical 2×2 unitary matrix
before invoking the existing OneQubitEulerDecomposer (ZYZ basis). For U and CU gates,
the user-provided matrix is used directly.

This keeps the frontend lightweight and makes the backend the single source of truth
for gate definitions.
"""

from typing import List, Dict, Optional
import numpy as np
from qiskit.synthesis import OneQubitEulerDecomposer
from app.schemas.circuit import (
    DecomposedGateSchema,
    CUDecomposedGateSchema,
    ComplexNumberSchema,
)
from app.services.validation import to_numpy_matrix
from app.services.decomposition import format_angle
import logging

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Canonical unitary matrices for standard single-qubit gates
# ---------------------------------------------------------------------------

_STANDARD_GATE_MATRICES: Dict[str, np.ndarray] = {
    'H': (1 / np.sqrt(2)) * np.array([[1, 1], [1, -1]], dtype=complex),
    'X': np.array([[0, 1], [1, 0]], dtype=complex),
    'Y': np.array([[0, -1j], [1j, 0]], dtype=complex),
    'Z': np.array([[1, 0], [0, -1]], dtype=complex),
    'S': np.array([[1, 0], [0, 1j]], dtype=complex),
    'T': np.array([[1, 0], [0, np.exp(1j * np.pi / 4)]], dtype=complex),
}

# Gates that are already in Rz/Ry/Rx form — no decomposition needed
_ALREADY_DECOMPOSED = {'Rx', 'Ry', 'Rz'}

# Gates that can be decomposed via euler (single-qubit)
_DECOMPOSABLE_SINGLE_QUBIT = set(_STANDARD_GATE_MATRICES.keys()) | {'U'}


def _rx(theta: float) -> np.ndarray:
    c, s = np.cos(theta / 2), np.sin(theta / 2)
    return np.array([[c, -1j * s], [-1j * s, c]], dtype=complex)


def _ry(theta: float) -> np.ndarray:
    c, s = np.cos(theta / 2), np.sin(theta / 2)
    return np.array([[c, -s], [s, c]], dtype=complex)


def _rz(theta: float) -> np.ndarray:
    return np.array([
        [np.exp(-1j * theta / 2), 0],
        [0, np.exp(1j * theta / 2)]
    ], dtype=complex)


class OptimizationService:
    """Unified service for gate-level optimization (Euler decomposition)."""

    def __init__(self):
        self.decomposer = OneQubitEulerDecomposer(basis='ZYZ')

    # ---- public API -------------------------------------------------------

    def can_optimize(self, gate_type: str) -> bool:
        """Return True if this gate type can be optimised/decomposed."""
        return gate_type in _DECOMPOSABLE_SINGLE_QUBIT or gate_type == 'CU'

    def optimize_single_qubit(
        self,
        gate_type: str,
        start_column: int,
        matrix: Optional[List[List[ComplexNumberSchema]]] = None,
        params: Optional[Dict[str, float]] = None,
    ) -> List[DecomposedGateSchema]:
        """
        Decompose a single-qubit gate into Rz → Ry → Rz.

        For standard gates (H, X, …) the canonical matrix is looked up internally.
        For 'U' gates the user-supplied *matrix* is used.
        For parameterized rotations (Rx, Ry, Rz) with *params*, the matrix is
        computed from the angle.
        """
        np_mat = self._resolve_matrix(gate_type, matrix, params)

        theta, phi, lam, phase = self.decomposer.angles_and_phase(np_mat)

        logger.info(
            f"\nOptimize {gate_type} → ZYZ Euler\n"
            f"  Global Phase : {format_angle(phase)}\n"
            f"  Rz(phi)      : {format_angle(phi)}\n"
            f"  Ry(theta)    : {format_angle(theta)}\n"
            f"  Rz(lambda)   : {format_angle(lam)}"
        )

        col = start_column
        return [
            DecomposedGateSchema(type="Rz", params={"theta": lam}, column=col),
            DecomposedGateSchema(type="Ry", params={"theta": theta}, column=col + 1),
            DecomposedGateSchema(type="Rz", params={"theta": phi}, column=col + 2),
        ]

    # ---- helpers ----------------------------------------------------------

    def _resolve_matrix(
        self,
        gate_type: str,
        matrix: Optional[List[List[ComplexNumberSchema]]],
        params: Optional[Dict[str, float]],
    ) -> np.ndarray:
        """Resolve a gate type + optional matrix/params to a numpy unitary."""
        # 1. User-provided matrix (U gate)
        if matrix is not None:
            return to_numpy_matrix(matrix)

        # 2. Standard named gate
        if gate_type in _STANDARD_GATE_MATRICES:
            return _STANDARD_GATE_MATRICES[gate_type]

        # 3. Parameterized rotation gates
        if gate_type in ('Rx', 'Ry', 'Rz') and params and 'theta' in params:
            theta = params['theta']
            if gate_type == 'Rx':
                return _rx(theta)
            elif gate_type == 'Ry':
                return _ry(theta)
            else:
                return _rz(theta)

        raise ValueError(
            f"Cannot resolve matrix for gate type '{gate_type}'. "
            "Provide a matrix for custom unitary gates."
        )
