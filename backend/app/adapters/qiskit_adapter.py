import qiskit
from qiskit import QuantumCircuit
from qiskit_aer import AerSimulator
import time
from typing import Dict, Any, Tuple
from app.schemas.circuit import CircuitRequestSchema
import logging

logger = logging.getLogger(__name__)

class QiskitAdapter:
    def __init__(self):
        self.simulator = AerSimulator()
        
    def build_circuit(self, request: CircuitRequestSchema) -> QuantumCircuit:
        num_qubits = len(request.qubits)
        has_measurements = any(op.type == 'Measure' for op in request.operations)
        num_cbits = num_qubits if has_measurements else 0
        
        logger.info(f"Building QuantumCircuit with {num_qubits} qubits and {num_cbits} cbits")
        
        qc = QuantumCircuit(num_qubits, num_cbits)
        
        # Sort operations by column to ensure correct temporal order
        sorted_ops = sorted(request.operations, key=lambda op: min(t.col for t in op.targets))
        
        for op in sorted_ops:
            target_indices = [t.row for t in op.targets]
            control_indices = [c.row for c in op.controls]
            
            # Bridge operations (B1, B2) are scheduling placeholders
            # and do not correspond to any quantum gate — skip them.
            if op.type in ('B1', 'B2'):
                continue

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
            elif op.type == 'Rx':
                for t in target_indices:
                    if op.params and 'theta' in op.params:
                        qc.rx(op.params['theta'], t)
            elif op.type == 'Ry':
                for t in target_indices:
                    if op.params and 'theta' in op.params:
                        qc.ry(op.params['theta'], t)
            elif op.type == 'Rz':
                for t in target_indices:
                    if op.params and 'theta' in op.params:
                        qc.rz(op.params['theta'], t)
            elif op.type == 'U':
                from qiskit.quantum_info import Operator
                for t in target_indices:
                    if op.matrix:
                        # Convert matrix to complex array
                        mat = [[complex(c.real, c.imag) for c in row] for row in op.matrix]
                        qc.unitary(Operator(mat), t, label='U')
            elif op.type == 'CU':
                from qiskit.quantum_info import Operator
                from qiskit.circuit.library import UnitaryGate
                if len(control_indices) == 1 and len(target_indices) == 1 and op.matrix:
                    mat = [[complex(c.real, c.imag) for c in row] for row in op.matrix]
                    cu_gate = UnitaryGate(mat, label='U').control(1)
                    qc.append(cu_gate, [control_indices[0], target_indices[0]])
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
        logger.info(f"Starting execution on AerSimulator (depth={qc.depth()})")
        
        # Determine simulation method based on measurements
        # If measurements exist, run shots to get counts
        # If no measurements, save statevector
        has_measurements = len(qc.cregs) > 0 and qc.cregs[0].size > 0
        
        result_data = {}
        
        if has_measurements:
            from qiskit import transpile
            qc_transpiled = transpile(qc, self.simulator)
            # Run simulation with 1024 shots
            job = self.simulator.run(qc_transpiled, shots=1024)
            result = job.result()
            counts = result.get_counts(qc_transpiled)
            result_data['counts'] = counts
        else:
            # Append statevector saving instruction
            qc.save_statevector()
            from qiskit import transpile
            qc_transpiled = transpile(qc, self.simulator)
            job = self.simulator.run(qc_transpiled)
            result = job.result()
            statevector = result.get_statevector(qc_transpiled)
            result_data['statevector'] = statevector.data.tolist()
            
        execution_time = (time.time() - start_time) * 1000  # ms
        logger.info(f"Execution completed in {execution_time:.2f} ms")
        
        return result_data, execution_time
