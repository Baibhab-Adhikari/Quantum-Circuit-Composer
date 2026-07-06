import { create } from 'zustand';
import type { CircuitState, CircuitActions, GateType, QubitState, GateInstance } from '@/types/circuit';
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

  // Pending states
  pendingParameterGate: null,
  pendingUnitaryGate: null,

  // UI state
  activeActionMenuId: null,

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

  setActiveActionMenu: (id) => {
    set({ activeActionMenuId: id });
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
    // Overwrite if it exists, otherwise add
    const exists = operations.some(op => op.id === gate.id);
    if (exists) {
      _pushHistory(operations.map(op => op.id === gate.id ? gate : op));
    } else {
      _pushHistory([...operations, gate]);
    }
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

    const proposedGate: GateInstance = {
      id: `gate-${Date.now()}`,
      type: type,
      targets: newTargets,
      controls: newControls,
    };

    const result = validatePlacement(proposedGate, state);

    if (result.valid) {
      if (def.isParameterized) {
        // Trigger parameter dialog instead of placing directly
        set({
          pendingParameterGate: {
            gate: proposedGate,
            resolve: (params) => get().confirmParameterGate(params),
            reject: () => get().cancelParameterGate(),
          }
        });
      } else if (def.isCustomUnitary) {
        // Trigger matrix dialog
        set({
          pendingUnitaryGate: {
            gate: proposedGate,
            resolve: (matrix) => get().confirmUnitaryGate(matrix),
            reject: () => get().cancelUnitaryGate(),
          }
        });
      } else {
        get().placeGate(proposedGate);
      }
      // Keep selectedGateType active for rapid placement!
    } else {
      toast.error('Invalid Placement', {
        description: result.reason,
        duration: 3000,
      });
    }
  },

  confirmParameterGate: (params) => {
    const { pendingParameterGate, placeGate } = get();
    if (!pendingParameterGate) return;
    
    const gate = { ...pendingParameterGate.gate, params };
    placeGate(gate);
    set({ pendingParameterGate: null });
  },

  cancelParameterGate: () => {
    set({ pendingParameterGate: null });
  },

  confirmUnitaryGate: (matrix) => {
    const { pendingUnitaryGate, placeGate } = get();
    if (!pendingUnitaryGate) return;
    
    const gate = { ...pendingUnitaryGate.gate, matrix };
    placeGate(gate);
    set({ pendingUnitaryGate: null });
  },

  cancelUnitaryGate: () => {
    set({ pendingUnitaryGate: null });
  },

  editGateParams: (id) => {
    const gate = get().operations.find((op) => op.id === id);
    if (!gate) return;
    
    const def = GATE_MAP.get(gate.type);
    if (!def) return;

    if (def.isParameterized) {
      set({
        pendingParameterGate: {
          gate,
          resolve: (params) => get().confirmParameterGate(params),
          reject: () => get().cancelParameterGate(),
        }
      });
    } else if (def.isCustomUnitary) {
      set({
        pendingUnitaryGate: {
          gate,
          resolve: (matrix) => get().confirmUnitaryGate(matrix),
          reject: () => get().cancelUnitaryGate(),
        }
      });
    }
  },

  decompose: async (gateId: string) => {
    const state = get();
    const gate = state.operations.find(op => op.id === gateId);
    
    if (!gate || gate.type !== 'U' || !gate.matrix) return;
    
    const targetQubit = gate.targets[0].row;
    const startCol = gate.targets[0].col;
    
    // As per user instructions: The decomposed gate should occupy the original column plus the next two columns.
    // If those columns are already occupied, simply shift the conflicting gates to the right starting from the conflict onward.
    // However, the user also noted: "If the implementation becomes overly complex for this milestone, it is acceptable to require that the two subsequent columns be available and display a clear message if there is insufficient space."
    // Let's implement the simpler check-availability first.
    
    // Check if the next two columns (startCol+1, startCol+2) are available on this row
    const colsNeeded = [startCol, startCol + 1, startCol + 2];
    
    // Make sure we have enough columns overall
    if (state.numColumns < startCol + 3) {
       get().setNumColumns(startCol + 3);
    }
    
    // Check for collisions
    const hasCollision = state.operations.some(op => {
      if (op.id === gateId) return false;
      return op.targets.some(t => t.row === targetQubit && colsNeeded.includes(t.col)) ||
             op.controls.some(c => c.row === targetQubit && colsNeeded.includes(c.col));
    });

    if (hasCollision) {
      toast.error('Insufficient Space', {
        description: 'Decomposing requires 3 empty consecutive columns. Please clear space to the right of the U gate.',
        duration: 4000,
      });
      return;
    }

    try {
      // Use dynamic import or direct fetch to avoid circular deps if needed, but we can use our api directly
      const { decomposeGate } = await import('@/services/api');
      
      const res = await decomposeGate({
        gate_id: gateId,
        matrix: gate.matrix,
        target_qubit: targetQubit,
        column: startCol
      });

      if (!res.success) {
        toast.error('Decomposition Failed', {
          description: res.error_message || 'Unknown error',
          duration: 4000,
        });
        return;
      }

      // We have the new gates, replace the old U gate
      const newOps = state.operations.filter(op => op.id !== gateId);
      
      // Convert backend format to frontend GateInstance
      const decomposedInstances: GateInstance[] = res.gates.map((g, i) => ({
        id: `${gateId}-dec-${i}-${Date.now()}`,
        type: g.type as GateType,
        targets: [{ row: targetQubit, col: g.column }],
        controls: [],
        params: g.params
      }));

      get()._pushHistory([...newOps, ...decomposedInstances]);
      
      toast.success('Decomposed successfully!');
    } catch (e: any) {
      toast.error('Error during decomposition', {
        description: e.message,
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
      pendingParameterGate: null,
      pendingUnitaryGate: null,
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
