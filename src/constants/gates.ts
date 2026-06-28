import type { GateDefinition, GateCategory } from '@/types/circuit';

/**
 * All supported gate definitions with metadata for rendering.
 * Colors use oklch for perceptual uniformity across light/dark themes.
 */
export const GATE_DEFINITIONS: GateDefinition[] = [
  // Single-qubit gates
  {
    type: 'H',
    name: 'Hadamard',
    abbreviation: 'H',
    category: 'single-qubit',
    description: 'Creates superposition — maps |0⟩ to (|0⟩+|1⟩)/√2',
    color: 'oklch(0.65 0.2 250)',   // Blue
    numTargets: 1,
    numControls: 0,
  },
  {
    type: 'X',
    name: 'Pauli-X',
    abbreviation: 'X',
    category: 'single-qubit',
    description: 'Bit-flip gate — equivalent to classical NOT',
    color: 'oklch(0.65 0.22 25)',   // Red-orange
    numTargets: 1,
    numControls: 0,
  },
  {
    type: 'Y',
    name: 'Pauli-Y',
    abbreviation: 'Y',
    category: 'single-qubit',
    description: 'Rotation around Y-axis — combines X and Z',
    color: 'oklch(0.7 0.18 145)',   // Green
    numTargets: 1,
    numControls: 0,
  },
  {
    type: 'Z',
    name: 'Pauli-Z',
    abbreviation: 'Z',
    category: 'single-qubit',
    description: 'Phase-flip gate — flips sign of |1⟩',
    color: 'oklch(0.6 0.22 300)',   // Purple
    numTargets: 1,
    numControls: 0,
  },
  {
    type: 'S',
    name: 'S Gate',
    abbreviation: 'S',
    category: 'single-qubit',
    description: 'Phase gate — applies π/2 phase shift',
    color: 'oklch(0.7 0.15 200)',   // Teal
    numTargets: 1,
    numControls: 0,
  },
  {
    type: 'T',
    name: 'T Gate',
    abbreviation: 'T',
    category: 'single-qubit',
    description: 'π/8 gate — applies π/4 phase shift',
    color: 'oklch(0.65 0.18 65)',   // Amber
    numTargets: 1,
    numControls: 0,
  },
  // Multi-qubit gates
  {
    type: 'CX',
    name: 'CNOT',
    abbreviation: 'CX',
    category: 'multi-qubit',
    description: 'Controlled-NOT — entangles two qubits',
    color: 'oklch(0.6 0.2 340)',    // Magenta
    numTargets: 1,
    numControls: 1,
  },
  {
    type: 'CCX',
    name: 'Toffoli',
    abbreviation: 'CCX',
    category: 'multi-qubit',
    description: 'Controlled-Controlled-NOT gate',
    color: 'oklch(0.55 0.22 340)',  // Deeper Magenta
    numTargets: 1,
    numControls: 2,
  },
  // Measurement
  {
    type: 'Measure',
    name: 'Measurement',
    abbreviation: 'M',
    category: 'measurement',
    description: 'Measures qubit in the computational basis',
    color: 'oklch(0.7 0.12 90)',    // Yellow-green
    numTargets: 1,
    numControls: 0,
  },
];

/** Gate definitions grouped by category */
export const GATE_CATEGORIES: { label: string; category: GateCategory }[] = [
  { label: 'Single Qubit', category: 'single-qubit' },
  { label: 'Multi Qubit', category: 'multi-qubit' },
  { label: 'Measurement', category: 'measurement' },
];

/** Quick lookup: gate type → definition */
export const GATE_MAP = new Map(
  GATE_DEFINITIONS.map((g) => [g.type, g])
);
