import { create } from 'zustand';
import type { CircuitState, CircuitActions, GateType, QubitState } from '@/types/circuit';
import { GATE_MAP } from '@/constants/gates';
import { simulateCircuit, type SimulationResult } from '@/services/api';

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
  placementSession: null,
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
    if (type) {
      get().startPlacement(type);
    } else {
      get().cancelPlacement();
    }
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

  startPlacement: (type) =>
    set(() => ({
      placementSession: {
        gateType: type,
        controlsPlaced: [],
        targetsPlaced: [],
      },
    })),

  cancelPlacement: () =>
    set(() => ({ placementSession: null, selectedGateType: null })),

  handleGridClick: (row, col) => {
    const state = get();
    const session = state.placementSession;
    if (!session) return;

    const def = GATE_MAP.get(session.gateType);
    if (!def) return;

    const isOccupied = state.operations.some(op => 
      op.targets.some(t => t.row === row && t.col === col) ||
      op.controls.some(c => c.row === row && c.col === col)
    ) || session.controlsPlaced.some(c => c.row === row && c.col === col)
      || session.targetsPlaced.some(t => t.row === row && t.col === col);
    
    if (isOccupied) return;

    const newSession = {
      ...session,
      controlsPlaced: [...session.controlsPlaced],
      targetsPlaced: [...session.targetsPlaced],
    };

    if (newSession.controlsPlaced.length < def.numControls) {
      newSession.controlsPlaced.push({ row, col });
    } else if (newSession.targetsPlaced.length < def.numTargets) {
      newSession.targetsPlaced.push({ row, col });
    }

    if (
      newSession.controlsPlaced.length === def.numControls &&
      newSession.targetsPlaced.length === def.numTargets
    ) {
      get().placeGate({
        id: `gate-${Date.now()}`,
        type: session.gateType,
        targets: newSession.targetsPlaced,
        controls: newSession.controlsPlaced,
      });
      set({ placementSession: null });
      
      if (get().selectedGateType) {
        get().startPlacement(get().selectedGateType!);
      }
    } else {
      set({ placementSession: newSession });
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
      placementSession: null,
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
          placementSession: null,
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
          placementSession: null,
        };
      }
      return state;
    }),
}));
