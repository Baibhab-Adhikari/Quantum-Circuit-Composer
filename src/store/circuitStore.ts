import { create } from 'zustand';
import type { CircuitState, CircuitActions, GateType, QubitState } from '@/types/circuit';
import { GATE_MAP } from '@/constants/gates';
import { simulateCircuit, type SimulationResult } from '@/services/api';
import { validatePlacement } from '@/utils/validation';
import { toast } from 'sonner';

/** Default number of qubits and columns */
const DEFAULT_NUM_QUBITS = 2;
const DEFAULT_NUM_COLUMNS = 10;

/** Create a qubit with a sequential label */
function createQubit(index: number): QubitState {
  return {
    id: `q-${index}`,
    label: `q${index}`,
  };
}

/** Generate the initial set of qubits */
function createInitialQubits(count: number): QubitState[] {
  return Array.from({ length: count }, (_, i) => createQubit(i));
}

/**
 * Circuit store — the single source of truth.
 *
 * The UI must always render from this store.
 * Never derive circuit state from rendered DOM.
 */
export const useCircuitStore = create<CircuitState & CircuitActions>((set, get) => ({
  // State
  qubits: createInitialQubits(DEFAULT_NUM_QUBITS),
  operations: [],
  numColumns: DEFAULT_NUM_COLUMNS,
  selectedGateType: null,
  zoom: 100,
  history: [[]],
  historyIndex: 0,
  isSimulating: false,
  simulationResult: null,

  // Actions
  addQubit: () =>
    set((state) => ({
      qubits: [...state.qubits, createQubit(state.qubits.length)],
    })),

  removeQubit: () =>
    set((state) => {
      if (state.qubits.length <= 1) return state; // minimum 1 qubit
      return {
        qubits: state.qubits.slice(0, -1),
      };
    }),

  setSelectedGateType: (type) => {
    set({ selectedGateType: type });
  },

  setNumColumns: (n: number) =>
    set(() => ({
      numColumns: Math.max(1, n),
    })),

  setZoom: (z: number) =>
    set(() => ({
      zoom: Math.max(50, Math.min(200, z)),
    })),

  placeGate: (gate) => {
    const { operations, _pushHistory } = get();
    _pushHistory([...operations, gate]);
  },

  removeGate: (id) => {
    const { operations, _pushHistory } = get();
    _pushHistory(operations.filter((op) => op.id !== id));
  },

  moveGate: (id, newPosition) => {
    const { operations, _pushHistory } = get();
    const gateIndex = operations.findIndex((op) => op.id === id);
    if (gateIndex === -1) return;

    const gate = operations[gateIndex];
    const rowOffset = newPosition.row - gate.targets[0].row;

    const newGate = { 
      ...gate,
      targets: gate.targets.map(t => ({ row: t.row + rowOffset, col: newPosition.col })),
      controls: gate.controls.map(c => ({ row: c.row + rowOffset, col: newPosition.col }))
    };

    const newOperations = [...operations];
    newOperations[gateIndex] = newGate;

    _pushHistory(newOperations);
  },

  cancelPlacement: () =>
    set(() => ({ selectedGateType: null })),

  handleGridClick: (row, col) => {
    const state = get();
    const type = state.selectedGateType;
    if (!type) return;

    const def = GATE_MAP.get(type);
    if (!def) return;

    const newControls: {row: number, col: number}[] = [];
    const newTargets: {row: number, col: number}[] = [];
    
    let currentRow = row;
    for (let i = 0; i < def.numControls; i++) {
      newControls.push({ row: currentRow++, col });
    }
    for (let i = 0; i < def.numTargets; i++) {
      newTargets.push({ row: currentRow++, col });
    }

    const proposedGate = {
      id: `gate-${Date.now()}`,
      type: type,
      targets: newTargets,
      controls: newControls,
    };

    const result = validatePlacement(proposedGate, state);

    if (result.valid) {
      get().placeGate(proposedGate);
      // Keep selectedGateType active for rapid placement!
    } else {
      toast.error('Invalid Placement', {
        description: result.reason,
        duration: 3000,
      });
    }
  },

  runSimulation: async () => {
    set({ isSimulating: true, simulationResult: null });
    try {
      const result = await simulateCircuit({
        qubits: get().qubits,
        operations: get().operations,
        numColumns: get().numColumns,
      });
      set({ simulationResult: result });
    } finally {
      set({ isSimulating: false });
    }
  },

  resetCircuit: () =>
    set(() => ({
      qubits: createInitialQubits(DEFAULT_NUM_QUBITS),
      operations: [],
      numColumns: DEFAULT_NUM_COLUMNS,
      selectedGateType: null,
      zoom: 100,
      history: [[]],
      historyIndex: 0,
      isSimulating: false,
      simulationResult: null,
    })),

  _pushHistory: (newOperations) =>
    set((state) => {
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(newOperations);
      if (newHistory.length > 50) {
        newHistory.shift();
      }
      return {
        history: newHistory,
        historyIndex: newHistory.length - 1,
        operations: newOperations,
      };
    }),

  undo: () =>
    set((state) => {
      if (state.historyIndex > 0) {
        const newIndex = state.historyIndex - 1;
        return {
          historyIndex: newIndex,
          operations: state.history[newIndex],
        };
      }
      return state;
    }),

  redo: () =>
    set((state) => {
      if (state.historyIndex < state.history.length - 1) {
        const newIndex = state.historyIndex + 1;
        return {
          historyIndex: newIndex,
          operations: state.history[newIndex],
        };
      }
      return state;
    }),
}));
