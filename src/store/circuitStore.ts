import { create } from 'zustand';
import type { CircuitState, CircuitActions, GateType, QubitState, GateInstance } from '@/types/circuit';
import { GATE_MAP } from '@/constants/gates';
import { simulateCircuit, type SimulationResult } from '@/services/api';
import { validatePlacement } from '@/utils/validation';
import { toast } from 'sonner';

/** Bridge operation types used as scheduling placeholders */
const BRIDGE_TYPES: GateType[] = ['B1', 'B2'];

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
      
      const lastQubitRow = state.qubits.length - 1;
      const isOccupied = state.operations.some(op => 
        op.targets.some(t => t.row === lastQubitRow) || 
        op.controls.some(c => c.row === lastQubitRow)
      );

      if (isOccupied) {
        toast.error('Cannot remove qubit wire', {
          description: 'The bottom qubit wire contains operations. Remove them first.',
          duration: 3000,
        });
        return state;
      }

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
    set((state) => {
      const newNumColumns = Math.max(1, n);
      
      if (newNumColumns < state.numColumns) {
        const isOccupied = state.operations.some(op => 
          op.targets.some(t => t.col >= newNumColumns) || 
          op.controls.some(c => c.col >= newNumColumns)
        );

        if (isOccupied) {
          toast.error('Cannot reduce circuit depth', {
            description: 'There are operations in the columns you are trying to remove. Remove them first.',
            duration: 3000,
          });
          return state;
        }
      }

      return {
        numColumns: newNumColumns,
      };
    }),

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

  insertBridges: () => {
    const state = get();
    
    // 1. Strip existing bridges (idempotent pass)
    let ops = state.operations.filter(op => !BRIDGE_TYPES.includes(op.type as GateType)).map(op => ({
      ...op,
      targets: op.targets.map(t => ({ ...t })),
      controls: op.controls.map(c => ({ ...c })),
    }));
    let numCols = state.numColumns;

    if (ops.length === 0) {
      toast.info('No gates found', {
        description: 'Add some gates to the circuit first.',
        duration: 3000,
      });
      return;
    }

    let c = 0;
    let bridgesInserted = 0;

    while (true) {
      // Find all gates at column c
      const gatesAtC = ops.filter(op => op.targets.some(t => t.col === c) || op.controls.some(ctrl => ctrl.col === c));
      
      if (gatesAtC.length === 0) {
        const maxCol = ops.reduce((max, op) => Math.max(max, ...op.targets.map(t => t.col), ...op.controls.map(ctrl => ctrl.col)), -1);
        if (c > maxCol) break;
        c++;
        continue;
      }
      
      // For each gate at column c, does it need a bridge?
      const requiredBridges: { row: number, type: GateType }[] = [];
      const processedRows = new Set<number>();
      
      for (const gate of gatesAtC) {
        const rows = [...gate.targets, ...gate.controls].map(n => n.row);
        for (const r of rows) {
          if (processedRows.has(r)) continue;
          
          // Is there a preceding gate on row r?
          const hasPreceding = ops.some(op => 
            op.id !== gate.id &&
            [...op.targets, ...op.controls].some(n => n.row === r && n.col < c)
          );
          
          if (hasPreceding) {
            requiredBridges.push({
              row: r,
              type: gate.type === 'Measure' ? 'B2' : 'B1'
            });
            processedRows.add(r);
          }
        }
      }
      
      if (requiredBridges.length > 0) {
        let needsShift = false;
        if (c === 0) {
          needsShift = true;
        } else {
          for (const b of requiredBridges) {
            const isOccupied = ops.some(op => 
              [...op.targets, ...op.controls].some(n => n.row === b.row && n.col === c - 1)
            );
            if (isOccupied) {
              needsShift = true;
              break;
            }
          }
        }
        
        if (needsShift) {
          // Shift column c and all subsequent columns to the right by 1
          ops = ops.map(op => {
            const inShiftZone = [...op.targets, ...op.controls].some(n => n.col >= c);
            if (inShiftZone) {
              return {
                ...op,
                targets: op.targets.map(t => t.col >= c ? { ...t, col: t.col + 1 } : t),
                controls: op.controls.map(ctrl => ctrl.col >= c ? { ...ctrl, col: ctrl.col + 1 } : ctrl)
              };
            }
            return op;
          });
          
          for (const b of requiredBridges) {
            ops.push({
              id: `bridge-${Date.now()}-${bridgesInserted}`,
              type: b.type,
              targets: [{ row: b.row, col: c }],
              controls: []
            });
            bridgesInserted++;
          }
          c += 2; // skip the column of gates we just shifted
        } else {
          for (const b of requiredBridges) {
            ops.push({
              id: `bridge-${Date.now()}-${bridgesInserted}`,
              type: b.type,
              targets: [{ row: b.row, col: c - 1 }],
              controls: []
            });
            bridgesInserted++;
          }
          c += 1;
        }
      } else {
        c++;
      }
    }

    if (bridgesInserted === 0) {
      toast.info('No delays needed', {
        description: 'Circuit is already correctly scheduled.',
        duration: 3000,
      });
      return;
    }

    // Update numColumns if needed
    const maxCol = ops.reduce((max, op) => Math.max(max, ...op.targets.map(t => t.col), ...op.controls.map(c => c.col), 0), 0);
    if (maxCol >= numCols) {
      numCols = maxCol + 1;
    }

    set({ numColumns: numCols });
    get()._pushHistory(ops);

    toast.success(`Inserted ${bridgesInserted} delay${bridgesInserted > 1 ? 's' : ''}`, {
      duration: 3000,
    });
  },

  optimizeCircuit: async () => {
    const state = get();

    // Gate types eligible for decomposition via the unified endpoint
    const DECOMPOSABLE_SINGLE: GateType[] = ['H', 'X', 'Y', 'Z', 'S', 'T', 'U'];
    const DECOMPOSABLE_CU: GateType[] = ['CU'];
    const ALL_DECOMPOSABLE = [...DECOMPOSABLE_SINGLE, ...DECOMPOSABLE_CU];

    // Step 1: Strip existing bridges for idempotency
    let ops = state.operations
      .filter(op => !BRIDGE_TYPES.includes(op.type as GateType))
      .map(op => ({
        ...op,
        targets: op.targets.map(t => ({ ...t })),
        controls: op.controls.map(c => ({ ...c })),
      }));

    if (ops.length === 0) {
      toast.info('Nothing to optimise', {
        description: 'Add some gates to the circuit first.',
        duration: 3000,
      });
      return;
    }

    // Step 2: Find gates that still need decomposition (skip Rx, Ry, Rz, CX, CCX, Measure)
    const toDecompose = ops.filter(op => ALL_DECOMPOSABLE.includes(op.type));

    // If nothing to decompose, just re-run delay insertion
    if (toDecompose.length === 0) {
      // Still need to commit stripped bridges + re-insert delays
      let numCols = state.numColumns;
      const maxCol = ops.reduce((max, op) =>
        Math.max(max, ...op.targets.map(t => t.col), ...op.controls.map(c => c.col), 0), 0);
      if (maxCol >= numCols) numCols = maxCol + 1;

      set({ numColumns: numCols });
      get()._pushHistory(ops);
      get().insertBridges();

      toast.success('Circuit optimised!', {
        description: 'Delays re-inserted.',
        duration: 3000,
      });
      return;
    }

    set({ isSimulating: true });

    try {
      const { optimizeGate } = await import('@/services/api');

      let numCols = state.numColumns;

      // Process gates from right to left (descending column) so that
      // column-shifting doesn't invalidate positions of gates we haven't
      // processed yet.
      const sortedToDecompose = [...toDecompose].sort((a, b) => {
        const colA = Math.min(...a.targets.map(t => t.col));
        const colB = Math.min(...b.targets.map(t => t.col));
        return colB - colA;
      });

      for (const gate of sortedToDecompose) {
        // Re-find gate in (possibly shifted) ops array
        const currentGate = ops.find(op => op.id === gate.id);
        if (!currentGate) continue;

        const targetQubit = currentGate.targets[0].row;
        const startCol = currentGate.targets[0].col;
        const isCU = currentGate.type === 'CU';
        const controlQubit = isCU && currentGate.controls.length > 0
          ? currentGate.controls[0].row : undefined;

        // Call unified endpoint
        const res = await optimizeGate({
          gate_type: currentGate.type,
          column: startCol,
          target_qubit: targetQubit,
          control_qubit: controlQubit,
          matrix: currentGate.matrix,
          params: currentGate.params,
        });

        if (!res.success) {
          toast.error(`Failed to optimise ${currentGate.type}`, {
            description: res.error_message || 'Unknown error',
            duration: 4000,
          });
          continue;
        }

        // Build decomposed GateInstances
        let decomposedInstances: GateInstance[];
        let numDecomposedCols: number;

        if (res.is_cu) {
          numDecomposedCols = 7;
          decomposedInstances = res.cu_gates.map((g, i) => ({
            id: `${currentGate.id}-opt-${i}-${Date.now()}`,
            type: g.type as GateType,
            targets: [{ row: g.target_qubit, col: g.column }],
            controls: g.control_qubit !== undefined && g.control_qubit !== null
              ? [{ row: g.control_qubit, col: g.column }]
              : [],
            params: g.params,
          }));
        } else {
          numDecomposedCols = 3;
          decomposedInstances = res.gates.map((g, i) => ({
            id: `${currentGate.id}-opt-${i}-${Date.now()}`,
            type: g.type as GateType,
            targets: [{ row: targetQubit, col: g.column }],
            controls: [],
            params: g.params,
          }));
        }

        // Shift conflicting gates to the right
        const affectedRows = isCU && controlQubit !== undefined
          ? new Set([targetQubit, controlQubit])
          : new Set([targetQubit]);

        const shift = numDecomposedCols - 1; // Original gate occupies 1 col
        ops = ops.map(op => {
          if (op.id === currentGate.id) return op;
          const hasConflict = [...op.targets, ...op.controls].some(
            n => affectedRows.has(n.row) && n.col >= startCol && n.col < startCol + numDecomposedCols
          );
          if (!hasConflict) return op;
          return {
            ...op,
            targets: op.targets.map(t => ({ ...t, col: t.col + shift })),
            controls: op.controls.map(c => ({ ...c, col: c.col + shift })),
          };
        });

        // Remove the original gate, add decomposed instances
        ops = ops.filter(op => op.id !== currentGate.id);
        ops.push(...decomposedInstances);

        // Update numColumns if needed
        const maxCol = ops.reduce((max, op) =>
          Math.max(max, ...op.targets.map(t => t.col), ...op.controls.map(c => c.col), 0),
        0);
        if (maxCol >= numCols) {
          numCols = maxCol + 1;
        }
      }

      // Commit the decomposed circuit (before delay insertion)
      set({ numColumns: numCols });
      get()._pushHistory(ops);

      // Now insert delays on top of the decomposed circuit
      get().insertBridges();

      toast.success('Circuit optimised!', {
        description: `Decomposed ${sortedToDecompose.length} gate${sortedToDecompose.length > 1 ? 's' : ''} and inserted delays.`,
        duration: 4000,
      });
    } catch (e: any) {
      toast.error('Optimisation failed', {
        description: e.message,
        duration: 4000,
      });
    } finally {
      set({ isSimulating: false });
    }
  },

  dumpQUA: () => {
    const { operations, numColumns } = get();
    
    let quaCode = `# ----------------------------------------------------
# Quantum Circuit Composer
# Temporary QUA Preview Export
#
# This file is intended as an intermediate preview.
#
# Scheduling placeholders (B1/B2) are intentionally
# emitted as comments because they do not yet map to
# concrete QUA timing instructions.
#
# A future QUA adapter will translate these editor
# operations into align()/wait() logic.
# ----------------------------------------------------

from qm.qua import *

with program() as quantum_circuit:
`;
    let hasOperations = false;

    // Filter to only single-qubit operations
    const singleQubitOps = operations.filter(op => op.controls.length === 0);

    for (let c = 0; c < numColumns; c++) {
      // Find operations in this column
      const opsInCol = singleQubitOps.filter(op => op.targets.some(t => t.col === c));
      
      if (opsInCol.length > 0) {
        if (hasOperations) {
          quaCode += "\n";
        }
        quaCode += `    # Column ${c}\n\n`;
        for (const op of opsInCol) {
          const row = op.targets[0].row;
          const element = `q${row}`;
          
          if (op.type === 'Measure') {
            quaCode += `    # Placeholder measurement.
    # Integration weights, outputs and processing
    # will be supplied by the future QUA adapter.
    measure("readout", "${element}", None)\n`;
          } else if (op.type === 'B1') {
            quaCode += `    # B1 Bridge (Scheduling Placeholder)\n`;
          } else if (op.type === 'B2') {
            quaCode += `    # B2 Bridge (Scheduling Placeholder)\n`;
          } else {
            quaCode += `    play("${op.type}", "${element}")\n`;
          }
          hasOperations = true;
        }
      }
    }

    if (!hasOperations) {
      quaCode += "    pass\n";
    }

    // Create a Blob and trigger download
    const blob = new Blob([quaCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "qua_dump.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("QUA dump generated!", {
      description: "qua_dump.txt has been downloaded.",
      duration: 3000,
    });
  },
}));
