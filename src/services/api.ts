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
