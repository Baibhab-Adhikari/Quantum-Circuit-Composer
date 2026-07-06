from app.schemas.circuit import CircuitRequestSchema
from app.serializers.base import BaseSerializer

class QiskitCodeSerializer(BaseSerializer[CircuitRequestSchema, str]):
    """
    Serializes a CircuitRequestSchema into a runnable Python script using Qiskit.
    """
    
    # Map frontend gate types to Qiskit QuantumCircuit methods
    SINGLE_QUBIT_GATE_MAP = {
        'H': 'h',
        'X': 'x',
        'Y': 'y',
        'Z': 'z',
        'S': 's',
        'T': 't'
    }

    def serialize(self, data: CircuitRequestSchema, **kwargs) -> str:
        num_qubits = len(data.qubits)
        has_measurements = any(op.type == 'Measure' for op in data.operations)
        num_cbits = num_qubits if has_measurements else 0
        
        lines = [
            "from qiskit import QuantumCircuit, transpile",
            "from qiskit_aer import AerSimulator",
        ]
        
        has_u = any(op.type == 'U' for op in data.operations)
        if has_u:
            lines.append("from qiskit.quantum_info import Operator")
            
        lines.extend([
            "",
            f"# Initialize circuit with {num_qubits} qubits and {num_cbits} classical bits",
            f"qc = QuantumCircuit({num_qubits}, {num_cbits})"
        ])
        
        if data.operations:
            lines.append("")
            lines.append("# Apply gates")
            
            # Sort operations by column
            sorted_ops = sorted(data.operations, key=lambda op: min(t.col for t in op.targets))
            
            for op in sorted_ops:
                target_indices = [t.row for t in op.targets]
                control_indices = [c.row for c in op.controls]
                
                if op.type in self.SINGLE_QUBIT_GATE_MAP:
                    qiskit_method = self.SINGLE_QUBIT_GATE_MAP[op.type]
                    for t in target_indices:
                        lines.append(f"qc.{qiskit_method}({t})")
                elif op.type in ['Rx', 'Ry', 'Rz']:
                    qiskit_method = op.type.lower()
                    for t in target_indices:
                        if op.params and 'theta' in op.params:
                            theta = op.params['theta']
                            lines.append(f"qc.{qiskit_method}({theta}, {t})")
                elif op.type == 'U':
                    has_u = True
                    for t in target_indices:
                        if op.matrix:
                            # format matrix string
                            mat_str = "["
                            for r in op.matrix:
                                mat_str += "[" + ", ".join([f"complex({c.real}, {c.imag})" for c in r]) + "], "
                            mat_str = mat_str.rstrip(", ") + "]"
                            lines.append(f"qc.unitary(Operator({mat_str}), {t}, label='U')")
                elif op.type == 'CX':
                    if len(control_indices) == 1 and len(target_indices) == 1:
                        lines.append(f"qc.cx({control_indices[0]}, {target_indices[0]})")
                elif op.type == 'CCX':
                    if len(control_indices) == 2 and len(target_indices) == 1:
                        lines.append(f"qc.ccx({control_indices[0]}, {control_indices[1]}, {target_indices[0]})")
                elif op.type == 'Measure':
                    for t in target_indices:
                        lines.append(f"qc.measure({t}, {t})")

        lines.extend([
            "",
            "# Execution",
            "simulator = AerSimulator()",
        ])
        
        if has_measurements:
            lines.extend([
                "compiled_circuit = transpile(qc, simulator)",
                "job = simulator.run(compiled_circuit, shots=1024)",
                "result = job.result()",
                "counts = result.get_counts(compiled_circuit)",
                "print('Measurement Counts:', counts)"
            ])
        else:
            lines.extend([
                "qc.save_statevector()",
                "compiled_circuit = transpile(qc, simulator)",
                "job = simulator.run(compiled_circuit)",
                "result = job.result()",
                "statevector = result.get_statevector(compiled_circuit)",
                "print('Statevector:', statevector.data)"
            ])
            
        return "\n".join(lines)
