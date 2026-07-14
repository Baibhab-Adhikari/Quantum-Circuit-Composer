"""
Controlled-U Gate Decomposition Service

Decomposes a 2×2 unitary U into A, B, C such that:
  A·B·C = I          (control=0: target unchanged)
  e^(iδ)·A·X·B·X·C = U  (control=1: U applied to target)

Uses ZYZ Euler decomposition: U = e^(iδ) · Rz(α) · Ry(β) · Rz(γ)
  A = Rz(α) · Ry(β/2)
  B = Ry(−β/2) · Rz(−(α+γ)/2)
  C = Rz((γ−α)/2)

The resulting circuit on the target qubit is:
  C → CX → B_ry → B_rz → CX → A_rz → A_ry
"""

from typing import List, Dict, Optional
import numpy as np
from qiskit.synthesis import OneQubitEulerDecomposer
from app.schemas.circuit import CUDecomposedGateSchema, ComplexNumberSchema
from app.services.validation import to_numpy_matrix
from app.services.decomposition import format_angle
import logging

logger = logging.getLogger(__name__)

# --- Gate matrix helpers ---

def _Ry(theta: float) -> np.ndarray:
    c, s = np.cos(theta / 2), np.sin(theta / 2)
    return np.array([[c, s], [-s, c]], dtype=complex)

def _Rz(theta: float) -> np.ndarray:
    return np.array([
        [np.exp(-1j * theta / 2), 0],
        [0, np.exp(1j * theta / 2)]
    ], dtype=complex)

_X = np.array([[0, 1], [1, 0]], dtype=complex)
_I = np.eye(2, dtype=complex)

def _normalize_angle(a: float) -> float:
    return float((a + np.pi) % (2 * np.pi) - np.pi)


class CUDecompositionService:
    def __init__(self):
        self.decomposer = OneQubitEulerDecomposer(basis='ZYZ')

    def decompose_controlled_unitary(
        self,
        matrix: List[List[ComplexNumberSchema]],
        control_qubit: int,
        target_qubit: int,
        start_column: int,
    ) -> dict:
        """
        Decomposes a 2×2 unitary into the A→CX→B→CX→C construction.
        Returns a dict with gates, euler_angles, global_phase, and verification metrics.
        """
        np_mat = to_numpy_matrix(matrix)

        # Step 1: ZYZ Euler decomposition using Qiskit
        # Returns theta, phi, lam, phase where:
        # U = e^(i*phase) * Rz(phi) * Ry(theta) * Rz(lam)
        theta, phi, lam, phase = self.decomposer.angles_and_phase(np_mat)

        # Map to α, β, γ convention from the script:
        # U = e^(iδ) · Rz(α) · Ry(β) · Rz(γ)
        alpha = phi      # Rz outer
        beta = theta     # Ry middle
        gamma = lam      # Rz inner
        delta = phase    # global phase

        logger.info(
            f"\nCU ZYZ Euler Decomposition\n"
            f"  Global Phase δ : {format_angle(delta)}\n"
            f"  α (Rz outer)   : {format_angle(alpha)}\n"
            f"  β (Ry middle)  : {format_angle(beta)}\n"
            f"  γ (Rz inner)   : {format_angle(gamma)}"
        )

        # Step 2: Branch search for best A, B, C
        best_err = None
        best_alpha_b = alpha
        best_gamma_b = gamma

        for kb in range(-2, 3):
            for kd in range(-2, 3):
                a = alpha + 2 * np.pi * kb
                g = gamma + 2 * np.pi * kd
                At = _Rz(a) @ _Ry(beta / 2)
                Bt = _Ry(-beta / 2) @ _Rz(-(a + g) / 2)
                Ct = _Rz((g - a) / 2)
                err = float(np.max(np.abs(np.exp(1j * delta) * (At @ _X @ Bt @ _X @ Ct) - np_mat)))
                if best_err is None or err < best_err:
                    best_err = err
                    best_alpha_b = a
                    best_gamma_b = g

        # Step 3: Build final A, B, C
        A = _Rz(best_alpha_b) @ _Ry(beta / 2)
        B = _Ry(-beta / 2) @ _Rz(-(best_alpha_b + best_gamma_b) / 2)
        C = _Rz((best_gamma_b - best_alpha_b) / 2)

        # Rotation angles for individual gates
        a_rz = _normalize_angle(best_alpha_b)
        a_ry = _normalize_angle(beta / 2)
        b_ry = _normalize_angle(-beta / 2)
        b_rz = _normalize_angle(-(best_alpha_b + best_gamma_b) / 2)
        c_rz = _normalize_angle((best_gamma_b - best_alpha_b) / 2)

        logger.info(
            f"\nCU ABC Decomposition\n"
            f"  C: Rz({format_angle(c_rz)})\n"
            f"  B: Ry({format_angle(b_ry)}) · Rz({format_angle(b_rz)})\n"
            f"  A: Rz({format_angle(a_rz)}) · Ry({format_angle(a_ry)})"
        )

        # Step 4: Verification
        ABC = A @ B @ C
        AXBXC = A @ _X @ B @ _X @ C
        recon = np.exp(1j * delta) * AXBXC
        abc_err = float(np.max(np.abs(ABC - _I)))
        u_err = float(np.max(np.abs(recon - np_mat)))

        logger.info(
            f"\nCU Verification\n"
            f"  A·B·C ≈ I ?  max error = {abc_err:.3e}  {'✓' if abc_err < 1e-6 else '✗'}\n"
            f"  e^(iδ)·A·X·B·X·C ≈ U ?  max error = {u_err:.3e}  {'✓' if u_err < 1e-4 else '✗'}"
        )

        # Step 5: Build gate sequence — 7 gates across 7 columns
        # Order: C → CX → B(Ry, Rz) → CX → A(Rz, Ry)
        col = start_column
        gates: List[CUDecomposedGateSchema] = []

        # Gate 1: C = Rz on target
        gates.append(CUDecomposedGateSchema(
            type="Rz", params={"theta": c_rz},
            column=col, target_qubit=target_qubit
        ))

        # Gate 2: CX (control → target)
        gates.append(CUDecomposedGateSchema(
            type="CX", column=col + 1,
            target_qubit=target_qubit, control_qubit=control_qubit
        ))

        # Gate 3: B part 1 = Rz on target (must apply Rz first for B = Ry * Rz)
        gates.append(CUDecomposedGateSchema(
            type="Rz", params={"theta": b_rz},
            column=col + 2, target_qubit=target_qubit
        ))

        # Gate 4: B part 2 = Ry on target
        gates.append(CUDecomposedGateSchema(
            type="Ry", params={"theta": b_ry},
            column=col + 3, target_qubit=target_qubit
        ))

        # Gate 5: CX (control → target)
        gates.append(CUDecomposedGateSchema(
            type="CX", column=col + 4,
            target_qubit=target_qubit, control_qubit=control_qubit
        ))

        # Gate 6: A part 1 = Ry on target (must apply Ry first for A = Rz * Ry)
        gates.append(CUDecomposedGateSchema(
            type="Ry", params={"theta": a_ry},
            column=col + 5, target_qubit=target_qubit
        ))

        # Gate 7: A part 2 = Rz on target
        gates.append(CUDecomposedGateSchema(
            type="Rz", params={"theta": a_rz},
            column=col + 6, target_qubit=target_qubit
        ))

        return {
            "gates": gates,
            "euler_angles": {
                "alpha": float(alpha),
                "beta": float(beta),
                "gamma": float(gamma),
            },
            "global_phase": float(delta),
            "abc_identity_error": abc_err,
            "axbxc_unitary_error": u_err,
        }
