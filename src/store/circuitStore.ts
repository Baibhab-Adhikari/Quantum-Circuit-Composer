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
  pendingMultiQubitGate: null,
  pendingCUGate: null,

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
      } else if (def.category === 'controlled-unitary') {
        // CU gate: two-phase flow — first qubit selection, then matrix input
        set({
          pendingCUGate: {
            phase: 'qubit-selection',
            gate: proposedGate,
            resolve: (gate) => get().confirmCUGateMatrix(gate.matrix!),
            reject: () => get().cancelCUGate(),
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
      } else if (def.category === 'multi-qubit') {
        set({
          pendingMultiQubitGate: {
            gate: proposedGate,
            resolve: (gate) => get().confirmMultiQubitGate(gate),
            reject: () => get().cancelMultiQubitGate(),
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

  confirmMultiQubitGate: (gate) => {
    const { pendingMultiQubitGate, placeGate } = get();
    if (!pendingMultiQubitGate) return;
    
    const result = validatePlacement(gate, get(), gate.id);
    if (!result.valid) {
      toast.error('Invalid Placement', {
        description: result.reason,
        duration: 3000,
      });
      return;
    }

    placeGate(gate);
    set({ pendingMultiQubitGate: null });
  },

  cancelMultiQubitGate: () => {
    set({ pendingMultiQubitGate: null });
  },

  confirmCUGateQubits: (gate) => {
    const { pendingCUGate } = get();
    if (!pendingCUGate) return;

    const result = validatePlacement(gate, get(), gate.id);
    if (!result.valid) {
      toast.error('Invalid Placement', {
        description: result.reason,
        duration: 3000,
      });
      return;
    }

    // Advance to matrix-input phase with updated qubit positions
    set({
      pendingCUGate: {
        ...pendingCUGate,
        phase: 'matrix-input',
        gate,
      }
    });
  },

  confirmCUGateMatrix: (matrix) => {
    const { pendingCUGate, placeGate } = get();
    if (!pendingCUGate) return;

    const gate = { ...pendingCUGate.gate, matrix };
    placeGate(gate);
    set({ pendingCUGate: null });
  },

  cancelCUGate: () => {
    set({ pendingCUGate: null });
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
    } else if (def.category === 'controlled-unitary') {
      // Re-open the two-phase CU dialog for editing
      set({
        pendingCUGate: {
          phase: 'qubit-selection',
          gate,
          resolve: (g) => get().confirmCUGateMatrix(g.matrix!),
          reject: () => get().cancelCUGate(),
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
    } else if (def.category === 'multi-qubit') {
      set({
        pendingMultiQubitGate: {
          gate,
          resolve: (newGate) => get().confirmMultiQubitGate(newGate),
          reject: () => get().cancelMultiQubitGate(),
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
    const numDecomposedCols = 3;
    
    // Auto-expand: shift conflicting gates to the right
    const colsNeeded = Array.from({ length: numDecomposedCols }, (_, i) => startCol + i);
    
    // Make sure we have enough columns overall
    if (state.numColumns < startCol + numDecomposedCols) {
       get().setNumColumns(startCol + numDecomposedCols);
    }
    
    // Find operations that conflict and shift them right
    let opsToShift = state.operations.filter(op => {
      if (op.id === gateId) return false;
      return op.targets.some(t => t.row === targetQubit && colsNeeded.includes(t.col)) ||
             op.controls.some(c => c.row === targetQubit && colsNeeded.includes(c.col));
    });

    // Calculate how many columns to shift: find min conflicting col and shift everything from there
    let shiftedOps = state.operations.map(op => {
      if (op.id === gateId) return op;
      // Check if any of this op's nodes are on the target row at or after startCol
      const hasConflict = [...op.targets, ...op.controls].some(
        n => n.row === targetQubit && n.col >= startCol && n.col < startCol + numDecomposedCols
      );
      if (!hasConflict) return op;
      // Shift all nodes of this operation by numDecomposedCols - 1 (the original gate occupies 1 col already)
      const shift = numDecomposedCols - 1;
      return {
        ...op,
        targets: op.targets.map(t => ({ ...t, col: t.col + shift })),
        controls: op.controls.map(c => ({ ...c, col: c.col + shift })),
      };
    });

    // Update numColumns if shifted gates exceed current depth
    const maxCol = shiftedOps.reduce((max, op) => {
      const opMaxCol = Math.max(
        ...op.targets.map(t => t.col),
        ...op.controls.map(c => c.col),
        0
      );
      return Math.max(max, opMaxCol);
    }, 0);
    if (maxCol >= get().numColumns) {
      get().setNumColumns(maxCol + 1);
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
      const newOps = shiftedOps.filter(op => op.id !== gateId);
      
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

  decomposeCU: async (gateId: string) => {
    const state = get();
    const gate = state.operations.find(op => op.id === gateId);
    
    if (!gate || gate.type !== 'CU' || !gate.matrix) return;
    
    const targetQubit = gate.targets[0].row;
    const controlQubit = gate.controls[0].row;
    const startCol = gate.targets[0].col;
    const numDecomposedCols = 7;
    
    // Make sure we have enough columns
    if (state.numColumns < startCol + numDecomposedCols) {
      get().setNumColumns(startCol + numDecomposedCols);
    }
    
    // Auto-expand: shift conflicting gates on BOTH control and target rows
    const affectedRows = new Set([targetQubit, controlQubit]);
    const shiftedOps = state.operations.map(op => {
      if (op.id === gateId) return op;
      const hasConflict = [...op.targets, ...op.controls].some(
        n => affectedRows.has(n.row) && n.col >= startCol && n.col < startCol + numDecomposedCols
      );
      if (!hasConflict) return op;
      const shift = numDecomposedCols - 1;
      return {
        ...op,
        targets: op.targets.map(t => ({ ...t, col: t.col + shift })),
        controls: op.controls.map(c => ({ ...c, col: c.col + shift })),
      };
    });

    // Update numColumns if shifted gates exceed current depth
    const maxCol = shiftedOps.reduce((max, op) => {
      const opMaxCol = Math.max(
        ...op.targets.map(t => t.col),
        ...op.controls.map(c => c.col),
        0
      );
      return Math.max(max, opMaxCol);
    }, 0);
    if (maxCol >= get().numColumns) {
      get().setNumColumns(maxCol + 1);
    }

    try {
      const { decomposeControlledUnitary } = await import('@/services/api');
      
      const res = await decomposeControlledUnitary({
        gate_id: gateId,
        matrix: gate.matrix,
        control_qubit: controlQubit,
        target_qubit: targetQubit,
        column: startCol
      });

      if (!res.success) {
        toast.error('CU Decomposition Failed', {
          description: res.error_message || 'Unknown error',
          duration: 4000,
        });
        return;
      }

      const newOps = shiftedOps.filter(op => op.id !== gateId);
      
      const decomposedInstances: GateInstance[] = res.gates.map((g, i) => ({
        id: `${gateId}-cu-dec-${i}-${Date.now()}`,
        type: g.type as GateType,
        targets: [{ row: g.target_qubit, col: g.column }],
        controls: g.control_qubit !== undefined && g.control_qubit !== null
          ? [{ row: g.control_qubit, col: g.column }]
          : [],
        params: g.params
      }));

      get()._pushHistory([...newOps, ...decomposedInstances]);
      
      toast.success('CU decomposed into A→CX→B→CX→C!');
    } catch (e: any) {
      toast.error('Error during CU decomposition', {
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
      pendingMultiQubitGate: null,
      pendingCUGate: null,
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
