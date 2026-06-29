import { GateInstance, GateDefinition, CircuitState } from '@/types/circuit';
import { GATE_MAP } from '@/constants/gates';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export function validatePlacement(
  proposedGate: GateInstance,
  circuitState: Pick<CircuitState, 'qubits' | 'operations'>,
  ignoreGateId?: string
): ValidationResult {
  const def = GATE_MAP.get(proposedGate.type);
  if (!def) {
    return { valid: false, reason: `Unknown gate type: ${proposedGate.type}` };
  }

  const allNodes = [...proposedGate.targets, ...proposedGate.controls];

  // 1. Validate Boundaries
  for (const node of allNodes) {
    if (node.row < 0 || node.row >= circuitState.qubits.length) {
      return {
        valid: false,
        reason: `Not enough qubits for ${def.name} gate.`,
      };
    }
    // We assume column doesn't have a strict max since circuit can grow, 
    // or if we enforce numColumns, we check it here (but typically circuit auto-expands or we allow it).
    // The requirement only mentioned checking rows against totalCircuitQubits.
  }

  // 2. Validate Unique Qubit Usage
  const usedRows = new Set<number>();
  for (const node of allNodes) {
    if (usedRows.has(node.row)) {
      return {
        valid: false,
        reason: 'Controls and targets must occupy unique qubits.',
      };
    }
    usedRows.add(node.row);
  }

  // 3. Validate Collisions (with existing gates on grid)
  for (const node of allNodes) {
    // Check against committed operations
    for (const op of circuitState.operations) {
      if (op.id === ignoreGateId) continue;
      
      const isOccupiedByTarget = op.targets.some((t) => t.row === node.row && t.col === node.col);
      const isOccupiedByControl = op.controls.some((c) => c.row === node.row && c.col === node.col);
      
      if (isOccupiedByTarget || isOccupiedByControl) {
        return {
          valid: false,
          reason: 'Cannot place gate on an occupied cell.',
        };
      }
    }

  }

  return { valid: true };
}
