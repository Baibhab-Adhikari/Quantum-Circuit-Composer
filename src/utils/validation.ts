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

// Math Validation Utilities

import type { ComplexNumber } from '@/types/circuit';

const EPSILON = 1e-6;

export function complexAdd(a: ComplexNumber, b: ComplexNumber): ComplexNumber {
  return { real: a.real + b.real, imag: a.imag + b.imag };
}

export function complexMultiply(a: ComplexNumber, b: ComplexNumber): ComplexNumber {
  return {
    real: a.real * b.real - a.imag * b.imag,
    imag: a.real * b.imag + a.imag * b.real,
  };
}

export function complexConjugate(a: ComplexNumber): ComplexNumber {
  return { real: a.real, imag: -a.imag };
}

export function complexAbsSq(a: ComplexNumber): number {
  return a.real * a.real + a.imag * a.imag;
}

export function parseAngleInput(input: string): number | null {
  const normalized = input.trim().toLowerCase();
  
  if (normalized === '') return null;

  // Check if it's just a number
  if (!isNaN(Number(normalized))) {
    return Number(normalized);
  }

  // Handle multiples of pi, e.g., pi, -pi, 2pi, 2*pi, pi/2, -pi/4
  // Let's use a regex
  const piMatch = normalized.match(/^([-+]?)(\d*(?:\.\d+)?)?\*?(?:pi|π)(?:\/(\d+(?:\.\d+)?))?$/);
  
  if (piMatch) {
    const sign = piMatch[1] === '-' ? -1 : 1;
    let multiplier = 1;
    if (piMatch[2]) {
      multiplier = Number(piMatch[2]);
    }
    let divisor = 1;
    if (piMatch[3]) {
      divisor = Number(piMatch[3]);
    }
    return sign * multiplier * Math.PI / divisor;
  }

  // Try evaluating simple math if it has no pi but has /
  const fracMatch = normalized.match(/^([-+]?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (fracMatch) {
    return Number(fracMatch[1]) / Number(fracMatch[2]);
  }

  return null;
}

export function parseComplexNumber(input: string): ComplexNumber | null {
  let normalized = input.trim().replace(/\s+/g, '').toLowerCase();
  
  if (normalized === '') return null;

  // Handle special case 1/sqrt(2) or 1/√2
  if (normalized === '1/sqrt(2)' || normalized === '1/√2') {
    return { real: 1 / Math.sqrt(2), imag: 0 };
  }
  if (normalized === '-1/sqrt(2)' || normalized === '-1/√2') {
    return { real: -1 / Math.sqrt(2), imag: 0 };
  }

  let real = 0;
  let imag = 0;

  // Extract the imaginary part if it exists
  let imagSign = 1;
  const imagIndex = normalized.lastIndexOf('i');
  
  if (imagIndex !== -1) {
    // There is an imaginary part
    const imagPartStr = normalized.substring(0, imagIndex);
    
    // Find where the real part ends and imaginary part begins
    // Look for the last '+' or '-' that is not at index 0 (which would be the sign of the real part)
    let splitIndex = -1;
    for (let i = imagPartStr.length - 1; i > 0; i--) {
      if (imagPartStr[i] === '+' || imagPartStr[i] === '-') {
        // Make sure it's not part of an exponent like e-5, though we don't officially support sci notation here
        splitIndex = i;
        break;
      }
    }

    let imagNumStr = '';
    
    if (splitIndex !== -1) {
      // We have both real and imaginary parts
      const realPartStr = imagPartStr.substring(0, splitIndex);
      imagNumStr = imagPartStr.substring(splitIndex);
      
      const parsedReal = Number(realPartStr);
      if (isNaN(parsedReal)) return null;
      real = parsedReal;
    } else {
      // Only imaginary part
      imagNumStr = imagPartStr;
    }

    if (imagNumStr === '' || imagNumStr === '+') imag = 1;
    else if (imagNumStr === '-') imag = -1;
    else {
      const parsedImag = Number(imagNumStr);
      if (isNaN(parsedImag)) return null;
      imag = parsedImag;
    }
    
  } else {
    // Only real part
    const parsedReal = Number(normalized);
    if (isNaN(parsedReal)) return null;
    real = parsedReal;
  }

  return { real, imag };
}

export function isUnitary(matrix: ComplexNumber[][]): boolean {
  if (matrix.length !== 2 || matrix[0].length !== 2 || matrix[1].length !== 2) return false;

  // Compute U† U = I
  // U† is the conjugate transpose
  const U = matrix;
  const U_dag: ComplexNumber[][] = [
    [complexConjugate(U[0][0]), complexConjugate(U[1][0])],
    [complexConjugate(U[0][1]), complexConjugate(U[1][1])]
  ];

  // Matrix multiplication: U† * U
  const C: ComplexNumber[][] = [
    [
      complexAdd(complexMultiply(U_dag[0][0], U[0][0]), complexMultiply(U_dag[0][1], U[1][0])),
      complexAdd(complexMultiply(U_dag[0][0], U[0][1]), complexMultiply(U_dag[0][1], U[1][1]))
    ],
    [
      complexAdd(complexMultiply(U_dag[1][0], U[0][0]), complexMultiply(U_dag[1][1], U[1][0])),
      complexAdd(complexMultiply(U_dag[1][0], U[0][1]), complexMultiply(U_dag[1][1], U[1][1]))
    ]
  ];

  // Check if C is approximately identity
  const isI00 = Math.abs(C[0][0].real - 1) < EPSILON && Math.abs(C[0][0].imag) < EPSILON;
  const isI11 = Math.abs(C[1][1].real - 1) < EPSILON && Math.abs(C[1][1].imag) < EPSILON;
  const isI01 = Math.abs(C[0][1].real) < EPSILON && Math.abs(C[0][1].imag) < EPSILON;
  const isI10 = Math.abs(C[1][0].real) < EPSILON && Math.abs(C[1][0].imag) < EPSILON;

  return isI00 && isI11 && isI01 && isI10;
}

export function validateUnitaryMatrix(matrix: ComplexNumber[][]): ValidationResult {
  if (matrix.length !== 2 || matrix[0].length !== 2 || matrix[1].length !== 2) {
    return { valid: false, reason: 'Matrix must be exactly 2x2.' };
  }

  if (!isUnitary(matrix)) {
    return { valid: false, reason: 'Matrix is not unitary (U†U ≠ I).' };
  }

  return { valid: true };
}

/**
 * Formats a radian angle into a conventional quantum notation string.
 * Examples: 0 -> "0", Math.PI -> "π", -Math.PI / 2 -> "-π/2", 1.047 -> "1.047 rad"
 */
export function formatAngle(radians: number): string {
  const EPSILON = 1e-5;
  if (Math.abs(radians) < EPSILON) return '0';

  const piRatio = radians / Math.PI;

  // Check for exact integer multiples of pi
  if (Math.abs(Math.round(piRatio) - piRatio) < EPSILON) {
    const n = Math.round(piRatio);
    if (n === 1) return 'π';
    if (n === -1) return '-π';
    return `${n}π`;
  }

  // Check for half, quarter, etc multiples of pi
  // We'll check up to denominator 8
  for (const den of [2, 3, 4, 6, 8]) {
    const num = Math.round(piRatio * den);
    if (Math.abs(num / den - piRatio) < EPSILON) {
      if (num === 1) return `π/${den}`;
      if (num === -1) return `-π/${den}`;
      return `${num}π/${den}`;
    }
  }

  // Fallback to decimal rad
  return `${radians.toFixed(3)} rad`;
}
