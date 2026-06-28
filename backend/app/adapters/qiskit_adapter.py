import qiskit
from qiskit import QuantumCircuit
from qiskit_aer import AerSimulator
import time
from typing import Dict, Any, Tuple
from app.schemas.circuit import CircuitRequestSchema

class QiskitAdapter:
    def __init__(self):
        self.simulator = AerSimulator()
        
    def build_circuit(self, request: CircuitRequestSchema) -> QuantumCircuit:
        num_qubits = len(request.qubits)
        # We need classical bits only if there are measurements
        has_measurements = any(op.type == 'Measure' for op in request.operations)
        num_cbits = num_qubits if has_measurements else 0
        
        qc = QuantumCircuit(num_qubits, num_cbits)
        
        # Sort operations by column to ensure correct temporal order
        sorted_ops = sorted(request.operations, key=lambda op: min(t.col for t in op.targets))
        
        for op in sorted_ops:
            target_indices = [t.row for t in op.targets]
            control_indices = [c.row for c in op.controls]
            
            # Map frontend GateType to Qiskit gates
            if op.type == 'H':
                for t in target_indices:
                    qc.h(t)
            elif op.type == 'X':
                for t in target_indices:
                    qc.x(t)
            elif op.type == 'Y':
                for t in target_indices:
                    qc.y(t)
            elif op.type == 'Z':
                for t in target_indices:
                    qc.z(t)
            elif op.type == 'S':
                for t in target_indices:
                    qc.s(t)
            elif op.type == 'T':
                for t in target_indices:
                    qc.t(t)
            elif op.type == 'CX':
                if len(control_indices) == 1 and len(target_indices) == 1:
                    qc.cx(control_indices[0], target_indices[0])
            elif op.type == 'CCX':
                if len(control_indices) == 2 and len(target_indices) == 1:
                    qc.ccx(control_indices[0], control_indices[1], target_indices[0])
            elif op.type == 'Measure':
                for t in target_indices:
                    qc.measure(t, t)
                    
        return qc

    def execute(self, qc: QuantumCircuit) -> Tuple[Dict[str, Any], float]:
        start_time = time.time()
        
        # Determine simulation method based on measurements
        # If measurements exist, run shots to get counts
        # If no measurements, save statevector
        has_measurements = len(qc.cregs) > 0 and qc.cregs[0].size > 0
        
        result_data = {}
        
        if has_measurements:
            # Run simulation with 1024 shots
            job = self.simulator.run(qc, shots=1024)
            result = job.result()
            counts = result.get_counts(qc)
            result_data['counts'] = counts
        else:
            # Append statevector saving instruction
            qc.save_statevector()
            job = self.simulator.run(qc)
            result = job.result()
            statevector = result.get_statevector(qc)
            result_data['statevector'] = statevector.data.tolist()
            
        execution_time = (time.time() - start_time) * 1000  # ms
        
        return result_data, execution_time
