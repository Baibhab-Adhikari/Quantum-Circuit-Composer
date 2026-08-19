/**
 * QUA Compiler — Compiles circuit IR into runnable QUA (Quantum Machines) Python code.
 *
 * Pipeline (from the spec §6):
 *   1. Column/layer pass — group gates by timestep column
 *   2. Per-gate compilation — gate→QUA mapping, ZYZ decomposition, placeholders
 *   3. Alignment insertion — align() before measurement / multi-qubit blocks
 *   4. Boilerplate wrapping — imports, declare, for_, measure, stream_processing, QMM footer
 *   5. Emit .py file
 *
 * All compilation is client-side — no backend calls needed.
 */

import type { GateInstance, QubitState, ComplexNumber, GateType } from '@/types/circuit';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type QUAConfigVariant = 'standard' | 'octave' | 'lf-fem' | 'lf-fem-mw-fem';

export interface QUAConfig {
  configVariant: QUAConfigVariant;
  nAvg: number;
}

export interface QUAWarning {
  gateId: string;
  gateType: string;
  type: 'decomposed' | 'unsupported-multi-qubit';
  message: string;
}

export interface QUACompilationResult {
  code: string;
  warnings: QUAWarning[];
  placeholderGates: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TWO_PI = 2 * Math.PI;
const EPSILON = 1e-9;

/** Config variant → import line mapping */
const CONFIG_IMPORTS: Record<QUAConfigVariant, string> = {
  'standard': 'from configuration import *',
  'octave': 'from configuration_with_octave import *',
  'lf-fem': 'from configuration_lf_fem import *',
  'lf-fem-mw-fem': 'from configuration_lf_fem_mw_fem import *',
};

/** Bridge types that are scheduling placeholders — skip in QUA output */
const BRIDGE_TYPES: GateType[] = ['B1', 'B2'];

// ---------------------------------------------------------------------------
// ZYZ Euler Decomposition
// ---------------------------------------------------------------------------

/**
 * Decompose a 2×2 unitary matrix into ZYZ Euler angles.
 *
 *   U = e^(iα) · Rz(φ) · Ry(θ) · Rz(λ)
 *
 * Returns { phi, theta, lambda } in radians.
 * The global phase α is discarded (unobservable).
 *
 * Reference: Nielsen & Chuang §4.2
 */
export function zyzDecompose(matrix: ComplexNumber[][]): { phi: number; theta: number; lambda: number } {
  // Extract complex entries
  const a = { re: matrix[0][0].real, im: matrix[0][0].imag }; // U[0][0]
  const b = { re: matrix[0][1].real, im: matrix[0][1].imag }; // U[0][1]
  const c = { re: matrix[1][0].real, im: matrix[1][0].imag }; // U[1][0]
  const d = { re: matrix[1][1].real, im: matrix[1][1].imag }; // U[1][1]

  // |U[0][0]| = cos(θ/2), |U[1][0]| = sin(θ/2)
  const absA = Math.sqrt(a.re * a.re + a.im * a.im);
  const absC = Math.sqrt(c.re * c.re + c.im * c.im);

  // θ = 2 * atan2(|c|, |a|)
  const theta = 2 * Math.atan2(absC, absA);

  if (absA < EPSILON && absC < EPSILON) {
    // Degenerate — zero matrix (shouldn't happen for a valid unitary)
    return { phi: 0, theta: 0, lambda: 0 };
  }

  if (absC < EPSILON) {
    // Pure diagonal: U = diag(e^(iα), e^(iβ))
    // θ ≈ 0, so U ≈ e^(iα) · Rz(φ+λ)
    // phase of a = α + (φ+λ)/2, phase of d = α - (φ+λ)/2
    const phaseA = Math.atan2(a.im, a.re);
    const phaseD = Math.atan2(d.im, d.re);
    // φ + λ = phaseA - phaseD (mod 2π — but we use raw difference)
    const phiPlusLambda = phaseA - phaseD;
    return { phi: phiPlusLambda / 2, theta: 0, lambda: phiPlusLambda / 2 };
  }

  if (absA < EPSILON) {
    // Anti-diagonal: θ = π
    const phaseC = Math.atan2(c.im, c.re);
    const phaseB = Math.atan2(b.im, b.re);
    // For θ=π: U[1][0] = e^(i(α+(φ-λ)/2)), U[0][1] = -e^(i(α-(φ-λ)/2))
    // φ - λ = phaseC + phaseB + π  (roughly)
    const phiMinusLambda = phaseC + phaseB + Math.PI;
    return { phi: phiMinusLambda / 2, theta: Math.PI, lambda: -phiMinusLambda / 2 };
  }

  // General case
  // U[0][0] = e^(i(α - (φ+λ)/2)) · cos(θ/2)   →  phase(U[0][0]) = α - (φ+λ)/2
  // U[1][0] = e^(i(α + (φ-λ)/2)) · sin(θ/2)   →  phase(U[1][0]) = α + (φ-λ)/2
  const phaseA = Math.atan2(a.im, a.re);
  const phaseC = Math.atan2(c.im, c.re);

  // From the two phases:
  //   phaseA = α - (φ+λ)/2
  //   phaseC = α + (φ-λ)/2
  //
  // Adding:  phaseA + phaseC = 2α - λ
  // Subtracting: phaseC - phaseA = φ
  //
  // More carefully:
  //   α = (phaseA + phaseC + λ) / 2  ... but we don't need α.
  //   φ = phaseC - phaseA + λ  ... hmm, let's use the standard derivation:
  //
  // Let's define:
  //   s = phaseA + phaseC   (= 2α - λ ... but let's not use α)
  //   t = phaseC - phaseA   (= φ)
  //
  // Actually, more directly:
  //   (φ+λ)/2 = -(phaseA - α)  ... we need to eliminate α.
  //
  // Standard formula (from Qiskit's OneQubitEulerDecomposer):
  //   φ = phaseC - phaseA
  //   λ = -(phaseC + phaseA)  ... wait, let's verify.
  //
  // Using U[0][1] = -e^(i(α + (φ-λ)/2-π)) * sin(θ/2)? No, let me be more careful.
  //
  // The standard ZYZ decomposition:
  //   U = e^(iα) Rz(φ) Ry(θ) Rz(λ)
  //
  //   Rz(φ) = [[e^(-iφ/2), 0], [0, e^(iφ/2)]]
  //   Ry(θ) = [[cos(θ/2), -sin(θ/2)], [sin(θ/2), cos(θ/2)]]
  //   Rz(λ) = [[e^(-iλ/2), 0], [0, e^(iλ/2)]]
  //
  // Product:
  //   U[0][0] = e^(iα) * e^(-i(φ+λ)/2) * cos(θ/2)
  //   U[0][1] = e^(iα) * e^(-i(φ-λ)/2) * (-sin(θ/2))
  //   U[1][0] = e^(iα) * e^(i(φ-λ)/2) * sin(θ/2)
  //   U[1][1] = e^(iα) * e^(i(φ+λ)/2) * cos(θ/2)
  //
  // So:
  //   phase(U[0][0]) = α - (φ+λ)/2
  //   phase(U[1][0]) = α + (φ-λ)/2
  //
  // From these:
  //   phase(U[1][0]) - phase(U[0][0]) = φ
  //   phase(U[1][0]) + phase(U[0][0]) = 2α - λ

  const phi = phaseC - phaseA;

  // To get λ, use U[1][1]:
  //   phase(U[1][1]) = α + (φ+λ)/2
  //   phase(U[0][0]) = α - (φ+λ)/2
  //   phase(U[1][1]) - phase(U[0][0]) = φ + λ
  //   λ = (phase(U[1][1]) - phase(U[0][0])) - φ
  const phaseD = Math.atan2(d.im, d.re);
  const lambda = (phaseD - phaseA) - phi;

  return { phi, theta, lambda };
}

// ---------------------------------------------------------------------------
// Known gate matrices (for gates that need ZYZ decomposition)
// ---------------------------------------------------------------------------

const SQRT2_INV = 1 / Math.sqrt(2);

/** Hardcoded 2×2 matrices for fixed gates that need decomposition */
const KNOWN_MATRICES: Partial<Record<GateType, ComplexNumber[][]>> = {
  H: [
    [{ real: SQRT2_INV, imag: 0 }, { real: SQRT2_INV, imag: 0 }],
    [{ real: SQRT2_INV, imag: 0 }, { real: -SQRT2_INV, imag: 0 }],
  ],
};

// ---------------------------------------------------------------------------
// Per-gate compilation
// ---------------------------------------------------------------------------

/**
 * Compile a single gate into one or more QUA statement lines.
 * Returns an array of indented Python lines (without leading spaces — caller adds indent).
 */
function compileGate(
  gate: GateInstance,
  qubitElement: string,
  warnings: QUAWarning[],
  placeholders: string[],
  allQubitElements: string[],
): string[] {
  const lines: string[] = [];
  const q = `"${qubitElement}"`;
  const gt = gate.type;

  switch (gt) {
    // ---------------------------------------------------------------
    // Native physical pulses
    // ---------------------------------------------------------------
    case 'X':
      lines.push(`play("x180", ${q})`);
      break;

    case 'Y':
      lines.push(`play("y180", ${q})`);
      break;

    // ---------------------------------------------------------------
    // Virtual Z rotations (frame_rotation_2pi — zero duration)
    // ---------------------------------------------------------------
    case 'Z':
      // Z = Rz(π)  →  frame_rotation_2pi(0.5, q)
      lines.push(`frame_rotation_2pi(0.5, ${q})`);
      break;

    case 'S':
      // S = Rz(π/2)  →  frame_rotation_2pi(0.25, q)
      lines.push(`frame_rotation_2pi(0.25, ${q})`);
      break;

    case 'T':
      // T = Rz(π/4)  →  frame_rotation_2pi(0.125, q)
      lines.push(`frame_rotation_2pi(0.125, ${q})`);
      break;

    // ---------------------------------------------------------------
    // Parameterized rotations
    // ---------------------------------------------------------------
    case 'Rz': {
      const theta = gate.params?.theta ?? 0;
      const fraction = theta / TWO_PI;
      lines.push(`frame_rotation_2pi(${formatFloat(fraction)}, ${q})`);
      break;
    }

    case 'Rx': {
      const theta = gate.params?.theta ?? 0;
      const ampFactor = theta / Math.PI;
      lines.push(`play("x180" * amp(${formatFloat(ampFactor)}), ${q})`);
      break;
    }

    case 'Ry': {
      const theta = gate.params?.theta ?? 0;
      const ampFactor = theta / Math.PI;
      lines.push(`play("y180" * amp(${formatFloat(ampFactor)}), ${q})`);
      break;
    }

    // ---------------------------------------------------------------
    // Hadamard — ZYZ decomposition
    // ---------------------------------------------------------------
    case 'H': {
      const decomposed = decomposeToQUA(KNOWN_MATRICES.H!, q);
      lines.push(...decomposed);
      warnings.push({
        gateId: gate.id,
        gateType: 'H',
        type: 'decomposed',
        message: 'H gate decomposed into Rz–Ry–Rz native pulses',
      });
      break;
    }

    // ---------------------------------------------------------------
    // Custom unitary — ZYZ decomposition
    // ---------------------------------------------------------------
    case 'U': {
      if (gate.matrix) {
        const decomposed = decomposeToQUA(gate.matrix, q);
        lines.push(...decomposed);
        warnings.push({
          gateId: gate.id,
          gateType: 'U',
          type: 'decomposed',
          message: 'Custom unitary decomposed into Rz–Ry–Rz native pulses',
        });
      } else {
        lines.push(`# WARNING: U gate without matrix data — cannot compile`);
      }
      break;
    }

    // ---------------------------------------------------------------
    // Measurement — emitted inline when user places a Measure gate
    // ---------------------------------------------------------------
    case 'Measure': {
      const resElement = qubitElement === 'qubit' ? 'resonator' : `resonator${qubitElement.replace('qubit', '')}`;
      lines.push(`# --- Measurement on ${qubitElement} ---`);
      lines.push(`align(${q}, "${resElement}")`);
      lines.push(`measure(`);
      lines.push(`    "readout", "${resElement}", None,`);
      lines.push(`    dual_demod.full("rotated_cos", "rotated_sin", I),`);
      lines.push(`    dual_demod.full("rotated_minus_sin", "rotated_cos", Q),`);
      lines.push(`)`);
      lines.push(`assign(state, I > ge_threshold)`);
      lines.push(`wait(thermalization_time * u.ns, "${resElement}")`);
      break;
    }

    // ---------------------------------------------------------------
    // Multi-qubit gates — placeholder (no native QUA primitive)
    // ---------------------------------------------------------------
    case 'CX': {
      const controlRow = gate.controls[0]?.row ?? 0;
      const targetRow = gate.targets[0]?.row ?? 1;
      const controlEl = getQubitElement(controlRow);
      const targetEl = getQubitElement(targetRow);
      lines.push(`# TODO: CX(${controlEl}, ${targetEl}) has no native calibrated pulse in this configuration.`);
      lines.push(`# Implement a calibrated two-qubit gate (e.g. CZ via flux pulse, or cross-resonance)`);
      lines.push(`# and expose it as a macro in macros.py, e.g.:`);
      lines.push(`#   cz_gate("${controlEl}", "${targetEl}")`);
      lines.push(`cz_gate("${controlEl}", "${targetEl}")  # <-- placeholder, must be defined by the user`);
      placeholders.push(`CX(${controlEl}, ${targetEl})`);
      warnings.push({
        gateId: gate.id,
        gateType: 'CX',
        type: 'unsupported-multi-qubit',
        message: `CX requires custom calibration — no native QUA primitive`,
      });
      break;
    }

    case 'CCX': {
      const c0Row = gate.controls[0]?.row ?? 0;
      const c1Row = gate.controls[1]?.row ?? 1;
      const tRow = gate.targets[0]?.row ?? 2;
      const c0El = getQubitElement(c0Row);
      const c1El = getQubitElement(c1Row);
      const tEl = getQubitElement(tRow);
      lines.push(`# TODO: CCX(${c0El}, ${c1El}, ${tEl}) — Toffoli gate.`);
      lines.push(`# No native 3-qubit gate exists in standard QUA configurations.`);
      lines.push(`# Decompose into single- and two-qubit gates, or implement a custom macro.`);
      lines.push(`ccx_gate("${c0El}", "${c1El}", "${tEl}")  # <-- placeholder, must be defined by the user`);
      placeholders.push(`CCX(${c0El}, ${c1El}, ${tEl})`);
      warnings.push({
        gateId: gate.id,
        gateType: 'CCX',
        type: 'unsupported-multi-qubit',
        message: `CCX (Toffoli) requires custom calibration — no native QUA primitive`,
      });
      break;
    }

    case 'CU': {
      const controlRow = gate.controls[0]?.row ?? 0;
      const targetRow = gate.targets[0]?.row ?? 1;
      const controlEl = getQubitElement(controlRow);
      const targetEl = getQubitElement(targetRow);
      lines.push(`# TODO: CU(${controlEl}, ${targetEl}) — Controlled-Unitary gate.`);
      lines.push(`# Requires calibrated two-qubit interaction + single-qubit decomposition.`);
      lines.push(`cu_gate("${controlEl}", "${targetEl}")  # <-- placeholder, must be defined by the user`);
      placeholders.push(`CU(${controlEl}, ${targetEl})`);
      warnings.push({
        gateId: gate.id,
        gateType: 'CU',
        type: 'unsupported-multi-qubit',
        message: `CU requires custom calibration — no native QUA primitive`,
      });
      break;
    }

    // ---------------------------------------------------------------
    // Bridge operations — scheduling placeholders, skip
    // ---------------------------------------------------------------
    case 'B1':
    case 'B2':
      // Bridges are scheduling placeholders in the editor — emit as wait
      lines.push(`# Scheduling delay (${gt} bridge)`);
      lines.push(`wait(x180_len // 4, ${q})`);
      break;

    default:
      lines.push(`# Unknown gate type: ${gt}`);
      break;
  }

  return lines;
}

/**
 * Decompose a 2×2 unitary matrix into QUA statements via ZYZ Euler angles.
 * Applies the optimization from §4: skip Ry(0) for pure-Z gates.
 */
function decomposeToQUA(matrix: ComplexNumber[][], qubitArg: string): string[] {
  const { phi, theta, lambda } = zyzDecompose(matrix);
  const lines: string[] = [];

  const thetaNearZero = Math.abs(theta) < EPSILON;

  if (thetaNearZero) {
    // Pure Rz gate — combine φ and λ into a single frame rotation
    const combined = (phi + lambda) / TWO_PI;
    if (Math.abs(combined) > EPSILON) {
      lines.push(`frame_rotation_2pi(${formatFloat(combined)}, ${qubitArg})`);
    }
    // If combined ≈ 0, it's effectively identity — emit nothing
  } else {
    // Full ZYZ: Rz(λ) then Ry(θ) then Rz(φ)
    // Emission order: λ first (rightmost applied first)
    const lambdaFrac = lambda / TWO_PI;
    const phiFrac = phi / TWO_PI;
    const ampFactor = theta / Math.PI;

    if (Math.abs(lambdaFrac) > EPSILON) {
      lines.push(`frame_rotation_2pi(${formatFloat(lambdaFrac)}, ${qubitArg})`);
    }
    lines.push(`play("y180" * amp(${formatFloat(ampFactor)}), ${qubitArg})`);
    if (Math.abs(phiFrac) > EPSILON) {
      lines.push(`frame_rotation_2pi(${formatFloat(phiFrac)}, ${qubitArg})`);
    }
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Element name helpers
// ---------------------------------------------------------------------------

/**
 * Map qubit row index to QUA element name.
 * Single-qubit circuits use "qubit", multi-qubit use "qubit0", "qubit1", etc.
 */
function getQubitElement(row: number, totalQubits: number = 1): string {
  if (totalQubits === 1) return 'qubit';
  return `qubit${row}`;
}

function getResonatorElement(row: number, totalQubits: number = 1): string {
  if (totalQubits === 1) return 'resonator';
  return `resonator${row}`;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Format a float to a reasonable precision, avoiding scientific notation */
function formatFloat(n: number): string {
  if (Math.abs(n - Math.round(n)) < EPSILON) {
    return Math.round(n).toString();
  }
  // Up to 6 decimal places, strip trailing zeros
  return parseFloat(n.toFixed(6)).toString();
}

// ---------------------------------------------------------------------------
// Main compiler entry point
// ---------------------------------------------------------------------------

/**
 * Compile the entire circuit into a runnable QUA Python program.
 *
 * This is the single entry point called by the store/UI. It implements
 * the full pipeline: column grouping → per-gate compilation → alignment
 * insertion → boilerplate wrapping.
 */
export function compileToQUA(
  operations: GateInstance[],
  qubits: QubitState[],
  numColumns: number,
  config: QUAConfig,
): QUACompilationResult {
  const warnings: QUAWarning[] = [];
  const placeholderGates: string[] = [];
  const totalQubits = qubits.length;

  // Filter out bridges for the main pass (they'll be handled inline)
  const allOps = operations;

  // -----------------------------------------------------------------------
  // Step 1 — Column/layer pass: group gates by column
  // -----------------------------------------------------------------------
  const columnMap = new Map<number, GateInstance[]>();
  for (const op of allOps) {
    const col = op.targets[0]?.col ?? 0;
    if (!columnMap.has(col)) columnMap.set(col, []);
    columnMap.get(col)!.push(op);
  }

  // Sort columns
  const sortedCols = Array.from(columnMap.keys()).sort((a, b) => a - b);

  // -----------------------------------------------------------------------
  // Step 2 & 3 — Per-qubit timeline compilation + inter-gate alignment
  //
  // For each qubit, operations are sorted by column (timestep). Between
  // every consecutive pair of operations on the same qubit, an align()
  // is inserted:
  //   • gate → gate:    align("qubitN")
  //   • gate → Measure: align("qubitN", "resonatorN")  (emitted inside compileGate)
  //   • Measure → gate: align("resonatorN", "qubitN")
  //
  // Multi-qubit gates (CX, CCX, CU) that span multiple qubits get a
  // cross-qubit align() emitted before them.
  // -----------------------------------------------------------------------
  const circuitBodyLines: string[] = [];
  let hasMeasurement = false;

  // Collect all qubit elements used
  const usedQubitElements = new Set<string>();
  for (const op of allOps) {
    for (const t of op.targets) {
      usedQubitElements.add(getQubitElement(t.row, totalQubits));
    }
    for (const c of op.controls) {
      usedQubitElements.add(getQubitElement(c.row, totalQubits));
    }
  }
  const allQubitElements = Array.from(usedQubitElements).sort();

  // -----------------------------------------------------------------------
  // Build per-qubit timelines: for each qubit row, collect all ops that
  // touch it (as target), sorted by column. Multi-qubit gates appear in
  // the timeline of their target qubit only (controls are handled via
  // cross-qubit align).
  // -----------------------------------------------------------------------
  const qubitTimelines = new Map<number, GateInstance[]>();
  for (const op of allOps) {
    // Skip bridge types entirely
    if (BRIDGE_TYPES.includes(op.type as GateType)) continue;

    const targetRow = op.targets[0]?.row ?? 0;
    if (!qubitTimelines.has(targetRow)) qubitTimelines.set(targetRow, []);
    qubitTimelines.get(targetRow)!.push(op);
  }
  // Sort each timeline by column
  for (const [, ops] of qubitTimelines) {
    ops.sort((a, b) => (a.targets[0]?.col ?? 0) - (b.targets[0]?.col ?? 0));
  }

  // Set of ops already emitted (to avoid double-emission for multi-qubit gates
  // that might appear in multiple qubit timelines)
  const emittedOps = new Set<string>();

  // Process qubit rows in ascending order
  const sortedQubitRows = Array.from(qubitTimelines.keys()).sort((a, b) => a - b);

  for (const qubitRow of sortedQubitRows) {
    const timeline = qubitTimelines.get(qubitRow)!;
    if (timeline.length === 0) continue;

    const qubitEl = getQubitElement(qubitRow, totalQubits);
    const resEl = qubitEl === 'qubit' ? 'resonator' : `resonator${qubitEl.replace('qubit', '')}`;

    for (let i = 0; i < timeline.length; i++) {
      const op = timeline[i];
      if (emittedOps.has(op.id)) continue;

      const prevOp = i > 0 ? timeline[i - 1] : null;
      const prevWasMeasure = prevOp?.type === 'Measure';
      const currentIsMeasure = op.type === 'Measure';

      // --- Inter-gate alignment ---
      // Only insert align() if there is a previous gate on this qubit's timeline.
      if (prevOp !== null) {
        if (prevWasMeasure && !currentIsMeasure) {
          // Measure → gate: align(resonator, qubit) to re-synchronize
          circuitBodyLines.push(`align("${resEl}", "${qubitEl}")`);
        } else if (!prevWasMeasure && currentIsMeasure) {
          // gate → Measure: the align(qubit, resonator) is emitted inside
          // compileGate's Measure case, so do NOT emit a redundant one here.
          // (no-op — compileGate handles it)
        } else if (!prevWasMeasure && !currentIsMeasure) {
          // gate → gate: plain qubit-only align
          circuitBodyLines.push(`align("${qubitEl}")`);
        }
        // Measure → Measure: unusual but treat like gate→Measure
        // (the compileGate Measure case emits its own align(qubit, resonator))
      }

      // --- Multi-qubit cross-qubit alignment ---
      // For CX/CCX/CU, align all involved qubits before the gate
      if (op.controls.length > 0 && allQubitElements.length > 1) {
        const involvedElements = new Set<string>();
        for (const t of op.targets) involvedElements.add(getQubitElement(t.row, totalQubits));
        for (const c of op.controls) involvedElements.add(getQubitElement(c.row, totalQubits));
        const elementsStr = Array.from(involvedElements).sort().map(e => `"${e}"`).join(', ');
        circuitBodyLines.push(`align(${elementsStr})`);
      }

      // --- Emit the gate ---
      if (op.type === 'Measure') {
        hasMeasurement = true;
      }

      const gateLines = compileGate(op, qubitEl, warnings, placeholderGates, allQubitElements);
      circuitBodyLines.push(...gateLines);
      emittedOps.add(op.id);
    }
  }

  // -----------------------------------------------------------------------
  // Step 4 — Wrap boilerplate
  // -----------------------------------------------------------------------
  const lines: string[] = [];

  // --- Header comment block ---
  lines.push(`# ${'='.repeat(68)}`);
  lines.push(`# QUA Program — Generated by Quantum Circuit Composer`);
  lines.push(`#`);
  lines.push(`# Config variant: ${config.configVariant}`);
  lines.push(`# Qubits: ${totalQubits}`);
  lines.push(`# Averaging shots (n_avg): ${config.nAvg}`);

  if (placeholderGates.length > 0) {
    lines.push(`#`);
    lines.push(`# ⚠ PLACEHOLDER GATES (require user-supplied macros):`);
    for (const pg of placeholderGates) {
      lines.push(`#   - ${pg}`);
    }
    lines.push(`#`);
    lines.push(`# These gates have no native QUA implementation. You must provide`);
    lines.push(`# calibrated macro functions (e.g. in macros.py) before this program`);
    lines.push(`# can run on real hardware.`);
  }

  if (!hasMeasurement) {
    lines.push(`#`);
    lines.push(`# NOTE: No Measure gate was placed in the circuit.`);
    lines.push(`#   No readout / stream_processing is generated.`);
  }

  lines.push(`# ${'='.repeat(68)}`);
  lines.push(``);

  // --- Imports ---
  lines.push(`from qm.qua import *`);
  lines.push(`from qm import QuantumMachinesManager, SimulationConfig`);
  lines.push(`${CONFIG_IMPORTS[config.configVariant]}`);
  lines.push(``);

  // --- n_avg ---
  lines.push(`n_avg = ${config.nAvg}  # Number of averaging shots`);
  lines.push(``);

  // --- Program block ---
  lines.push(`with program() as generated_circuit:`);

  // --- Variable declarations (conditional on measurement) ---
  lines.push(`    n = declare(int)`);
  if (hasMeasurement) {
    lines.push(`    I = declare(fixed)`);
    lines.push(`    Q = declare(fixed)`);
    lines.push(`    state = declare(bool)`);
    lines.push(`    I_st = declare_stream()`);
    lines.push(`    Q_st = declare_stream()`);
    lines.push(`    state_st = declare_stream()`);
  }
  lines.push(``);

  // --- Averaging loop ---
  lines.push(`    with for_(n, 0, n < n_avg, n + 1):`);

  // --- Circuit body ---
  if (circuitBodyLines.length > 0) {
    lines.push(`        # --- Circuit body ---`);
    for (const line of circuitBodyLines) {
      lines.push(`        ${line}`);
    }
  } else {
    lines.push(`        # (empty circuit)`);
    lines.push(`        pass`);
  }

  lines.push(``);

  // --- Save measurement results at end of each shot ---
  if (hasMeasurement) {
    lines.push(`        # --- Save measurement results ---`);
    lines.push(`        save(I, I_st)`);
    lines.push(`        save(Q, Q_st)`);
    lines.push(`        save(state, state_st)`);
  }

  lines.push(``);

  // --- Stream processing (only if measurement was placed) ---
  if (hasMeasurement) {
    lines.push(`    with stream_processing():`);
    lines.push(`        I_st.average().save("I")`);
    lines.push(`        Q_st.average().save("Q")`);
    lines.push(`        state_st.boolean_to_int().average().save("state")`);
    lines.push(``);
  }

  // --- QMM footer ---
  lines.push(`# --- Execute ---`);
  lines.push(`qmm = QuantumMachinesManager(host=qop_ip, port=qop_port, cluster_name=cluster_name)`);
  lines.push(`qm = qmm.open_qm(config)`);
  lines.push(`job = qm.execute(generated_circuit)`);
  lines.push(``);

  return {
    code: lines.join('\n'),
    warnings,
    placeholderGates,
  };
}

// ---------------------------------------------------------------------------
// Gate classification helpers (exported for UI badge logic)
// ---------------------------------------------------------------------------

/** Gates that will be decomposed via ZYZ into native pulses */
export const DECOMPOSED_GATE_TYPES: GateType[] = ['H', 'U'];

/** Gates that are pure virtual-Z and emit only frame_rotation_2pi */
export const VIRTUAL_Z_GATE_TYPES: GateType[] = ['Z', 'S', 'T', 'Rz'];

/** Multi-qubit gates that require custom calibration (no native QUA support) */
export const UNSUPPORTED_MULTI_QUBIT_TYPES: GateType[] = ['CX', 'CCX', 'CU'];

/** Check if a gate type requires ZYZ decomposition for QUA */
export function isDecomposedForQUA(gateType: GateType): boolean {
  return DECOMPOSED_GATE_TYPES.includes(gateType);
}

/** Check if a gate is unsupported multi-qubit in QUA */
export function isUnsupportedMultiQubit(gateType: GateType): boolean {
  return UNSUPPORTED_MULTI_QUBIT_TYPES.includes(gateType);
}
