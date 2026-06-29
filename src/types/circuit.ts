/** Supported quantum gate types */
export type GateType = 'H' | 'X' | 'Y' | 'Z' | 'S' | 'T' | 'CX' | 'CCX' | 'Measure';

/** Gate category for organizing in the palette */
export type GateCategory = 'single-qubit' | 'multi-qubit' | 'measurement';

import type { SimulationResult } from '@/services/api';

/** Position on the circuit grid */
export interface GridPosition {
  row: number;
  col: number;
}

/** A gate instance placed on the circuit */
export interface GateInstance {
  id: string;
  type: GateType;
  targets: GridPosition[];
  controls: GridPosition[];
}



/** A qubit in the circuit */
export interface QubitState {
  id: string;
  label: string;
}

/** Metadata about a gate type for rendering */
export interface GateDefinition {
  type: GateType;
  name: string;
  abbreviation: string;
  category: GateCategory;
  description: string;
  color: string;
  numTargets: number;
  numControls: number;
}

/** The complete circuit state (Zustand store shape) */
export interface CircuitState {
  qubits: QubitState[];
  operations: GateInstance[];
  numColumns: number;
  selectedGateType: GateType | null;
  zoom: number;
  history: GateInstance[][];
  historyIndex: number;
  isSimulating: boolean;
  simulationResult: SimulationResult | null;
}

/** Actions available on the circuit store */
export interface CircuitActions {
  addQubit: () => void;
  removeQubit: () => void;
  setSelectedGateType: (type: GateType | null) => void;
  setNumColumns: (n: number) => void;
  setZoom: (z: number) => void;
  placeGate: (gate: GateInstance) => void;
  removeGate: (id: string) => void;
  moveGate: (id: string, newPosition: GridPosition) => void;
  
  // Generic Placement Logic
  handleGridClick: (row: number, col: number) => void;
  cancelPlacement: () => void;
  
  resetCircuit: () => void;
  undo: () => void;
  redo: () => void;
  _pushHistory: (newOperations: GateInstance[]) => void;
  runSimulation: () => Promise<void>;
}
