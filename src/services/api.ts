import type { GateInstance, QubitState } from '@/types/circuit';

export interface SimulationResult {
  success: boolean;
  execution_time_ms: number;
  counts?: Record<string, number>;
  statevector?: { real: number; imag: number }[];
  depth: number;
  gate_count: number;
  error_message?: string;
  dirac_notation?: string;
  qiskit_code?: string;
  openqasm?: string;
}

export interface CircuitPayload {
  qubits: QubitState[];
  operations: GateInstance[];
  numColumns: number;
}

const API_BASE_URL = 'http://localhost:8000';

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function simulateCircuit(payload: CircuitPayload): Promise<SimulationResult> {
  try {
    const res = await fetch(`${API_BASE_URL}/simulate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!res.ok) {
      throw new Error(`API error: ${res.statusText}`);
    }
    
    return await res.json();
} catch (error: any) {
    return {
      success: false,
      execution_time_ms: 0,
      depth: 0,
      gate_count: 0,
      error_message: error.message || 'Unknown error occurred',
    };
  }
}

export interface DecomposeRequest {
  gate_id: string;
  matrix: { real: number; imag: number }[][];
  target_qubit: number;
  column: number;
}

export interface DecomposedGate {
  type: string;
  params: Record<string, number>;
  column: number;
}

export interface DecomposeResult {
  success: boolean;
  gates: DecomposedGate[];
  error_message?: string;
}

export async function decomposeGate(request: DecomposeRequest): Promise<DecomposeResult> {
  try {
    const res = await fetch(`${API_BASE_URL}/decompose`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    
    if (!res.ok) {
      throw new Error(`API error: ${res.statusText}`);
    }
    
    return await res.json();
  } catch (error: any) {
    return {
      success: false,
      gates: [],
      error_message: error.message || 'Unknown error occurred',
    };
  }
}

// --- Controlled-U Decomposition ---

export interface CUDecomposeRequest {
  gate_id: string;
  matrix: { real: number; imag: number }[][];
  control_qubit: number;
  target_qubit: number;
  column: number;
}

export interface CUDecomposedGate {
  type: string;
  params?: Record<string, number>;
  column: number;
  target_qubit: number;
  control_qubit?: number;
}

export interface CUDecomposeResult {
  success: boolean;
  gates: CUDecomposedGate[];
  euler_angles?: Record<string, number>;
  global_phase?: number;
  abc_identity_error?: number;
  axbxc_unitary_error?: number;
  error_message?: string;
}

export async function decomposeControlledUnitary(request: CUDecomposeRequest): Promise<CUDecomposeResult> {
  try {
    const res = await fetch(`${API_BASE_URL}/decompose-cu`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      throw new Error(`API error: ${res.statusText}`);
    }

    return await res.json();
  } catch (error: any) {
    return {
      success: false,
      gates: [],
      error_message: error.message || 'Unknown error occurred',
    };
  }
}

// --- Unified Gate Optimization ---

export interface OptimizeGateRequest {
  gate_type: string;
  column: number;
  target_qubit: number;
  control_qubit?: number;
  matrix?: { real: number; imag: number }[][];
  params?: Record<string, number>;
}

export interface OptimizeGateResult {
  success: boolean;
  gates: DecomposedGate[];
  cu_gates: CUDecomposedGate[];
  is_cu: boolean;
  error_message?: string;
}

export async function optimizeGate(request: OptimizeGateRequest): Promise<OptimizeGateResult> {
  try {
    const res = await fetch(`${API_BASE_URL}/optimize-gate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      throw new Error(`API error: ${res.statusText}`);
    }

    return await res.json();
  } catch (error: any) {
    return {
      success: false,
      gates: [],
      cu_gates: [],
      is_cu: false,
      error_message: error.message || 'Unknown error occurred',
    };
  }
}

