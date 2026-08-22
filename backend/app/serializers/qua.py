"""
QUA Serializer — Compiles circuit IR into runnable QUA (Quantum Machines) Python code.

Pipeline (from the spec §6):
  1. Column/layer pass — group gates by timestep column
  2. Per-gate compilation — gate→QUA mapping, ZYZ decomposition, placeholders
  3. Alignment insertion — align() before measurement / multi-qubit blocks
  4. Boilerplate wrapping — imports, declare, for_, measure, stream_processing, QMM footer
  5. Emit .py file

This is a 1:1 faithful port of the frontend quaCompiler.ts into a backend
serializer that follows the BaseSerializer pattern.
"""

from __future__ import annotations

import math
import logging
from dataclasses import dataclass, field
from typing import List, Optional, Dict

from app.serializers.base import BaseSerializer
from app.schemas.circuit import (
    QUACompileRequestSchema,
    QUACompileResultSchema,
    QUAWarningSchema,
    GateInstanceSchema,
    ComplexNumberSchema,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

TWO_PI = 2 * math.pi
EPSILON = 1e-9

SQRT2_INV = 1 / math.sqrt(2)

CONFIG_IMPORTS: dict[str, str] = {
    "standard": "from configuration import *",
    "octave": "from configuration_with_octave import *",
    "lf-fem": "from configuration_lf_fem import *",
    "lf-fem-mw-fem": "from configuration_lf_fem_mw_fem import *",
}

BRIDGE_TYPES: list[str] = ["B1", "B2"]

# Gate classification helpers (exported for potential use by other backend code)
DECOMPOSED_GATE_TYPES: list[str] = ["H", "U"]
VIRTUAL_Z_GATE_TYPES: list[str] = ["Z", "S", "T", "Rz"]
UNSUPPORTED_MULTI_QUBIT_TYPES: list[str] = ["CX", "CCX", "CU"]

# Hardcoded 2×2 matrices for fixed gates that need ZYZ decomposition
KNOWN_MATRICES: dict[str, list[list[ComplexNumberSchema]]] = {
    "H": [
        [ComplexNumberSchema(real=SQRT2_INV, imag=0), ComplexNumberSchema(real=SQRT2_INV, imag=0)],
        [ComplexNumberSchema(real=SQRT2_INV, imag=0), ComplexNumberSchema(real=-SQRT2_INV, imag=0)],
    ],
}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

@dataclass
class _CompilationContext:
    """Accumulator for warnings and placeholder gates during compilation."""
    warnings: list[QUAWarningSchema] = field(default_factory=list)
    placeholders: list[str] = field(default_factory=list)


def _format_float(n: float) -> str:
    """Format a float to reasonable precision, avoiding scientific notation."""
    if abs(n - round(n)) < EPSILON:
        return str(int(round(n)))
    # Up to 6 decimal places, strip trailing zeros
    formatted = f"{n:.6f}".rstrip("0").rstrip(".")
    return formatted


def _get_qubit_element(row: int, total_qubits: int = 1) -> str:
    """Map qubit row index to QUA element name."""
    if total_qubits == 1:
        return "qubit"
    return f"qubit{row}"


def _get_resonator_element(row: int, total_qubits: int = 1) -> str:
    """Map qubit row index to resonator element name."""
    if total_qubits == 1:
        return "resonator"
    return f"resonator{row}"


# ---------------------------------------------------------------------------
# ZYZ Euler Decomposition
# ---------------------------------------------------------------------------

def _zyz_decompose(matrix: list[list[ComplexNumberSchema]]) -> dict[str, float]:
    """
    Decompose a 2×2 unitary matrix into ZYZ Euler angles.

      U = e^(iα) · Rz(φ) · Ry(θ) · Rz(λ)

    Returns { phi, theta, lambda_ } in radians.
    The global phase α is discarded (unobservable).

    Reference: Nielsen & Chuang §4.2
    """
    # Extract complex entries
    a_re, a_im = matrix[0][0].real, matrix[0][0].imag
    b_re, b_im = matrix[0][1].real, matrix[0][1].imag
    c_re, c_im = matrix[1][0].real, matrix[1][0].imag
    d_re, d_im = matrix[1][1].real, matrix[1][1].imag

    abs_a = math.sqrt(a_re * a_re + a_im * a_im)
    abs_c = math.sqrt(c_re * c_re + c_im * c_im)

    theta = 2 * math.atan2(abs_c, abs_a)

    if abs_a < EPSILON and abs_c < EPSILON:
        # Degenerate — zero matrix (shouldn't happen for a valid unitary)
        return {"phi": 0, "theta": 0, "lambda_": 0}

    if abs_c < EPSILON:
        # Pure diagonal: θ ≈ 0
        phase_a = math.atan2(a_im, a_re)
        phase_d = math.atan2(d_im, d_re)
        phi_plus_lambda = phase_a - phase_d
        return {"phi": phi_plus_lambda / 2, "theta": 0, "lambda_": phi_plus_lambda / 2}

    if abs_a < EPSILON:
        # Anti-diagonal: θ = π
        phase_c = math.atan2(c_im, c_re)
        phase_b = math.atan2(b_im, b_re)
        phi_minus_lambda = phase_c + phase_b + math.pi
        return {"phi": phi_minus_lambda / 2, "theta": math.pi, "lambda_": -phi_minus_lambda / 2}

    # General case
    phase_a = math.atan2(a_im, a_re)
    phase_c = math.atan2(c_im, c_re)

    phi = phase_c - phase_a

    phase_d = math.atan2(d_im, d_re)
    lambda_ = (phase_d - phase_a) - phi

    return {"phi": phi, "theta": theta, "lambda_": lambda_}


def _decompose_to_qua(matrix: list[list[ComplexNumberSchema]], qubit_arg: str) -> list[str]:
    """
    Decompose a 2×2 unitary matrix into QUA statements via ZYZ Euler angles.
    Applies the optimization: skip Ry(0) for pure-Z gates.
    """
    angles = _zyz_decompose(matrix)
    phi = angles["phi"]
    theta = angles["theta"]
    lambda_ = angles["lambda_"]
    lines: list[str] = []

    theta_near_zero = abs(theta) < EPSILON

    if theta_near_zero:
        # Pure Rz gate — combine φ and λ into a single frame rotation
        combined = (phi + lambda_) / TWO_PI
        if abs(combined) > EPSILON:
            lines.append(f"frame_rotation_2pi({_format_float(combined)}, {qubit_arg})")
        # If combined ≈ 0, it's effectively identity — emit nothing
    else:
        # Full ZYZ: Rz(λ) then Ry(θ) then Rz(φ)
        lambda_frac = lambda_ / TWO_PI
        phi_frac = phi / TWO_PI
        amp_factor = theta / math.pi

        if abs(lambda_frac) > EPSILON:
            lines.append(f"frame_rotation_2pi({_format_float(lambda_frac)}, {qubit_arg})")
        lines.append(f'play("y180" * amp({_format_float(amp_factor)}), {qubit_arg})')
        if abs(phi_frac) > EPSILON:
            lines.append(f"frame_rotation_2pi({_format_float(phi_frac)}, {qubit_arg})")

    return lines


# ---------------------------------------------------------------------------
# Per-gate compilation
# ---------------------------------------------------------------------------

def _compile_gate(
    gate: GateInstanceSchema,
    qubit_element: str,
    ctx: _CompilationContext,
    all_qubit_elements: list[str],
    total_qubits: int,
) -> list[str]:
    """
    Compile a single gate into one or more QUA statement lines.
    Returns an array of Python lines (without leading spaces — caller adds indent).
    """
    lines: list[str] = []
    q = f'"{qubit_element}"'
    gt = gate.type

    # ---------------------------------------------------------------
    # Native physical pulses
    # ---------------------------------------------------------------
    if gt == "X":
        lines.append(f'play("x180", {q})')

    elif gt == "Y":
        lines.append(f'play("y180", {q})')

    # ---------------------------------------------------------------
    # Virtual Z rotations (frame_rotation_2pi — zero duration)
    # ---------------------------------------------------------------
    elif gt == "Z":
        lines.append(f"frame_rotation_2pi(0.5, {q})")

    elif gt == "S":
        lines.append(f"frame_rotation_2pi(0.25, {q})")

    elif gt == "T":
        lines.append(f"frame_rotation_2pi(0.125, {q})")

    # ---------------------------------------------------------------
    # Parameterized rotations
    # ---------------------------------------------------------------
    elif gt == "Rz":
        theta = (gate.params or {}).get("theta", 0)
        fraction = theta / TWO_PI
        lines.append(f"frame_rotation_2pi({_format_float(fraction)}, {q})")

    elif gt == "Rx":
        theta = (gate.params or {}).get("theta", 0)
        amp_factor = theta / math.pi
        lines.append(f'play("x180" * amp({_format_float(amp_factor)}), {q})')

    elif gt == "Ry":
        theta = (gate.params or {}).get("theta", 0)
        amp_factor = theta / math.pi
        lines.append(f'play("y180" * amp({_format_float(amp_factor)}), {q})')

    # ---------------------------------------------------------------
    # Hadamard — ZYZ decomposition
    # ---------------------------------------------------------------
    elif gt == "H":
        decomposed = _decompose_to_qua(KNOWN_MATRICES["H"], q)
        lines.extend(decomposed)
        ctx.warnings.append(QUAWarningSchema(
            gate_id=gate.id,
            gate_type="H",
            type="decomposed",
            message="H gate decomposed into Rz–Ry–Rz native pulses",
        ))

    # ---------------------------------------------------------------
    # Custom unitary — ZYZ decomposition
    # ---------------------------------------------------------------
    elif gt == "U":
        if gate.matrix:
            decomposed = _decompose_to_qua(gate.matrix, q)
            lines.extend(decomposed)
            ctx.warnings.append(QUAWarningSchema(
                gate_id=gate.id,
                gate_type="U",
                type="decomposed",
                message="Custom unitary decomposed into Rz–Ry–Rz native pulses",
            ))
        else:
            lines.append("# WARNING: U gate without matrix data — cannot compile")

    # ---------------------------------------------------------------
    # Measurement
    # ---------------------------------------------------------------
    elif gt == "Measure":
        res_element = "resonator" if qubit_element == "qubit" else f"resonator{qubit_element.replace('qubit', '')}"
        lines.append(f"# --- Measurement on {qubit_element} ---")
        lines.append(f'align({q}, "{res_element}")')
        lines.append("measure(")
        lines.append(f'    "readout", "{res_element}", None,')
        lines.append(f'    dual_demod.full("rotated_cos", "rotated_sin", I),')
        lines.append(f'    dual_demod.full("rotated_minus_sin", "rotated_cos", Q),')
        lines.append(")")
        # lines.append("assign(state, I > ge_threshold)")  # Commented out — not needed as of now
        lines.append(f'wait(thermalization_time * u.ns, "{res_element}")')

    # ---------------------------------------------------------------
    # Multi-qubit gates — placeholder
    # ---------------------------------------------------------------
    elif gt == "CX":
        control_row = gate.controls[0].row if gate.controls else 0
        target_row = gate.targets[0].row if gate.targets else 1
        control_el = _get_qubit_element(control_row, total_qubits)
        target_el = _get_qubit_element(target_row, total_qubits)
        lines.append(f'# TODO: CX({control_el}, {target_el}) has no native calibrated pulse in this configuration.')
        lines.append(f"# Implement a calibrated two-qubit gate (e.g. CZ via flux pulse, or cross-resonance)")
        lines.append(f"# and expose it as a macro in macros.py, e.g.:")
        lines.append(f'#   cz_gate("{control_el}", "{target_el}")')
        lines.append(f'cz_gate("{control_el}", "{target_el}")  # <-- placeholder, must be defined by the user')
        ctx.placeholders.append(f"CX({control_el}, {target_el})")
        ctx.warnings.append(QUAWarningSchema(
            gate_id=gate.id,
            gate_type="CX",
            type="unsupported-multi-qubit",
            message="CX requires custom calibration — no native QUA primitive",
        ))

    elif gt == "CCX":
        c0_row = gate.controls[0].row if len(gate.controls) > 0 else 0
        c1_row = gate.controls[1].row if len(gate.controls) > 1 else 1
        t_row = gate.targets[0].row if gate.targets else 2
        c0_el = _get_qubit_element(c0_row, total_qubits)
        c1_el = _get_qubit_element(c1_row, total_qubits)
        t_el = _get_qubit_element(t_row, total_qubits)
        lines.append(f"# TODO: CCX({c0_el}, {c1_el}, {t_el}) — Toffoli gate.")
        lines.append(f"# No native 3-qubit gate exists in standard QUA configurations.")
        lines.append(f"# Decompose into single- and two-qubit gates, or implement a custom macro.")
        lines.append(f'ccx_gate("{c0_el}", "{c1_el}", "{t_el}")  # <-- placeholder, must be defined by the user')
        ctx.placeholders.append(f"CCX({c0_el}, {c1_el}, {t_el})")
        ctx.warnings.append(QUAWarningSchema(
            gate_id=gate.id,
            gate_type="CCX",
            type="unsupported-multi-qubit",
            message="CCX (Toffoli) requires custom calibration — no native QUA primitive",
        ))

    elif gt == "CU":
        control_row = gate.controls[0].row if gate.controls else 0
        target_row = gate.targets[0].row if gate.targets else 1
        control_el = _get_qubit_element(control_row, total_qubits)
        target_el = _get_qubit_element(target_row, total_qubits)
        lines.append(f"# TODO: CU({control_el}, {target_el}) — Controlled-Unitary gate.")
        lines.append(f"# Requires calibrated two-qubit interaction + single-qubit decomposition.")
        lines.append(f'cu_gate("{control_el}", "{target_el}")  # <-- placeholder, must be defined by the user')
        ctx.placeholders.append(f"CU({control_el}, {target_el})")
        ctx.warnings.append(QUAWarningSchema(
            gate_id=gate.id,
            gate_type="CU",
            type="unsupported-multi-qubit",
            message="CU requires custom calibration — no native QUA primitive",
        ))

    # ---------------------------------------------------------------
    # Bridge operations — scheduling placeholders
    # ---------------------------------------------------------------
    elif gt in ("B1", "B2"):
        lines.append(f"# Scheduling delay ({gt} bridge)")
        lines.append(f"wait(x180_len // 4, {q})")

    else:
        lines.append(f"# Unknown gate type: {gt}")

    return lines


# ---------------------------------------------------------------------------
# QUA Serializer
# ---------------------------------------------------------------------------

class QUASerializer(BaseSerializer[QUACompileRequestSchema, QUACompileResultSchema]):
    """
    Serializes a circuit IR into a runnable QUA (Quantum Machines) Python program.

    This is the single entry point for QUA compilation. It implements the full
    pipeline: column grouping → per-gate compilation → alignment insertion →
    boilerplate wrapping.
    """

    def serialize(self, data: QUACompileRequestSchema, **kwargs) -> QUACompileResultSchema:
        try:
            result = self._compile(data)
            return result
        except Exception as e:
            logger.error(f"QUA compilation failed: {e}", exc_info=True)
            return QUACompileResultSchema(
                success=False,
                error_message=str(e),
            )

    def _compile(self, data: QUACompileRequestSchema) -> QUACompileResultSchema:
        ctx = _CompilationContext()
        total_qubits = len(data.qubits)
        all_ops = data.operations
        config_variant = data.config.config_variant
        n_avg = data.config.n_avg

        # -------------------------------------------------------------------
        # Step 1 — Column/layer pass: group gates by column
        # -------------------------------------------------------------------
        column_map: dict[int, list[GateInstanceSchema]] = {}
        for op in all_ops:
            col = op.targets[0].col if op.targets else 0
            column_map.setdefault(col, []).append(op)

        # -------------------------------------------------------------------
        # Step 2 & 3 — Per-qubit timeline compilation + inter-gate alignment
        # -------------------------------------------------------------------
        circuit_body_lines: list[str] = []
        has_measurement = False

        # Collect all qubit elements used
        used_qubit_elements: set[str] = set()
        for op in all_ops:
            for t in op.targets:
                used_qubit_elements.add(_get_qubit_element(t.row, total_qubits))
            for c in op.controls:
                used_qubit_elements.add(_get_qubit_element(c.row, total_qubits))
        all_qubit_elements = sorted(used_qubit_elements)

        # Build per-qubit timelines
        qubit_timelines: dict[int, list[GateInstanceSchema]] = {}
        for op in all_ops:
            if op.type in BRIDGE_TYPES:
                continue
            target_row = op.targets[0].row if op.targets else 0
            qubit_timelines.setdefault(target_row, []).append(op)

        # Sort each timeline by column
        for row in qubit_timelines:
            qubit_timelines[row].sort(key=lambda op: op.targets[0].col if op.targets else 0)

        # Track emitted ops to avoid duplicates for multi-qubit gates
        emitted_ops: set[str] = set()

        # Process qubit rows in ascending order
        sorted_qubit_rows = sorted(qubit_timelines.keys())

        for qubit_row in sorted_qubit_rows:
            timeline = qubit_timelines[qubit_row]
            if not timeline:
                continue

            qubit_el = _get_qubit_element(qubit_row, total_qubits)
            res_el = "resonator" if qubit_el == "qubit" else f"resonator{qubit_el.replace('qubit', '')}"

            for i, op in enumerate(timeline):
                if op.id in emitted_ops:
                    continue

                prev_op = timeline[i - 1] if i > 0 else None
                prev_was_measure = prev_op is not None and prev_op.type == "Measure"
                current_is_measure = op.type == "Measure"

                # --- Inter-gate alignment ---
                if prev_op is not None:
                    if prev_was_measure and not current_is_measure:
                        circuit_body_lines.append(f'align("{res_el}", "{qubit_el}")')
                    elif not prev_was_measure and current_is_measure:
                        # gate → Measure: align is emitted inside _compile_gate
                        pass
                    elif not prev_was_measure and not current_is_measure:
                        circuit_body_lines.append(f'align("{qubit_el}")')

                # --- Multi-qubit cross-qubit alignment ---
                if op.controls and len(all_qubit_elements) > 1:
                    involved_elements: set[str] = set()
                    for t in op.targets:
                        involved_elements.add(_get_qubit_element(t.row, total_qubits))
                    for c in op.controls:
                        involved_elements.add(_get_qubit_element(c.row, total_qubits))
                    elements_str = ", ".join(f'"{e}"' for e in sorted(involved_elements))
                    circuit_body_lines.append(f"align({elements_str})")

                # --- Emit the gate ---
                if op.type == "Measure":
                    has_measurement = True

                gate_lines = _compile_gate(op, qubit_el, ctx, all_qubit_elements, total_qubits)
                circuit_body_lines.extend(gate_lines)
                emitted_ops.add(op.id)

        # -------------------------------------------------------------------
        # Step 4 — Wrap boilerplate
        # -------------------------------------------------------------------
        lines: list[str] = []

        # --- Header comment block ---
        lines.append(f"# {'=' * 68}")
        lines.append("# QUA Program — Generated by Quantum Circuit Composer")
        lines.append("#")
        lines.append(f"# Config variant: {config_variant}")
        lines.append(f"# Qubits: {total_qubits}")
        lines.append(f"# Averaging shots (n_avg): {n_avg}")

        if ctx.placeholders:
            lines.append("#")
            lines.append("# ⚠ PLACEHOLDER GATES (require user-supplied macros):")
            for pg in ctx.placeholders:
                lines.append(f"#   - {pg}")
            lines.append("#")
            lines.append("# These gates have no native QUA implementation. You must provide")
            lines.append("# calibrated macro functions (e.g. in macros.py) before this program")
            lines.append("# can run on real hardware.")

        if not has_measurement:
            lines.append("#")
            lines.append("# NOTE: No Measure gate was placed in the circuit.")
            lines.append("#   No readout / stream_processing is generated.")

        lines.append(f"# {'=' * 68}")
        lines.append("")

        # --- Imports ---
        lines.append("from qm.qua import *")
        lines.append("from qm import QuantumMachinesManager, SimulationConfig")
        config_import = CONFIG_IMPORTS.get(config_variant, CONFIG_IMPORTS["standard"])
        lines.append(config_import)
        lines.append("")

        # --- n_avg ---
        lines.append(f"n_avg = {n_avg}  # Number of averaging shots")
        lines.append("")

        # --- Program block ---
        lines.append("with program() as generated_circuit:")

        # --- Variable declarations ---
        lines.append("    n = declare(int)")
        if has_measurement:
            lines.append("    I = declare(fixed)")
            lines.append("    Q = declare(fixed)")
            lines.append("    state = declare(bool)")
            lines.append("    I_st = declare_stream()")
            lines.append("    Q_st = declare_stream()")
            lines.append("    state_st = declare_stream()")
        lines.append("")

        # --- Averaging loop ---
        lines.append("    with for_(n, 0, n < n_avg, n + 1):")

        # --- Circuit body ---
        if circuit_body_lines:
            lines.append("        # --- Circuit body ---")
            for line in circuit_body_lines:
                lines.append(f"        {line}")
        else:
            lines.append("        # (empty circuit)")
            lines.append("        pass")

        lines.append("")

        # --- Save measurement results ---
        if has_measurement:
            lines.append("        # --- Save measurement results ---")
            lines.append("        save(I, I_st)")
            lines.append("        save(Q, Q_st)")
            lines.append("        save(state, state_st)")

        lines.append("")

        # --- Stream processing ---
        if has_measurement:
            lines.append("    with stream_processing():")
            lines.append('        I_st.average().save("I")')
            lines.append('        Q_st.average().save("Q")')
            lines.append('        state_st.boolean_to_int().average().save("state")')
            lines.append("")

        # --- QMM footer ---
        lines.append("# --- Execute ---")
        lines.append("qmm = QuantumMachinesManager(host=qop_ip, port=qop_port, cluster_name=cluster_name)")
        lines.append("qm = qmm.open_qm(config)")
        lines.append("job = qm.execute(generated_circuit)")
        lines.append("")

        return QUACompileResultSchema(
            success=True,
            code="\n".join(lines),
            warnings=ctx.warnings,
            placeholder_gates=ctx.placeholders,
        )
