import pytest
import numpy as np
from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector

from app.services.decomposition import DecompositionService
from app.schemas.circuit import ComplexNumberSchema

# Utility to convert a 2x2 complex numpy array to ComplexNumberSchema format
def to_complex_schema(matrix: np.ndarray):
    return [
        [ComplexNumberSchema(real=matrix[0, 0].real, imag=matrix[0, 0].imag), ComplexNumberSchema(real=matrix[0, 1].real, imag=matrix[0, 1].imag)],
        [ComplexNumberSchema(real=matrix[1, 0].real, imag=matrix[1, 0].imag), ComplexNumberSchema(real=matrix[1, 1].real, imag=matrix[1, 1].imag)]
    ]

# Native matrix definitions for standard gates
GATES = {
    "Identity": np.array([[1, 0], [0, 1]], dtype=complex),
    "X": np.array([[0, 1], [1, 0]], dtype=complex),
    "Y": np.array([[0, -1j], [1j, 0]], dtype=complex),
    "Z": np.array([[1, 0], [0, -1]], dtype=complex),
    "H": (1/np.sqrt(2)) * np.array([[1, 1], [1, -1]], dtype=complex),
    "S": np.array([[1, 0], [0, 1j]], dtype=complex),
    "T": np.array([[1, 0], [0, np.exp(1j * np.pi / 4)]], dtype=complex)
}

@pytest.mark.parametrize("gate_name, matrix", GATES.items())
def test_decomposition_equivalence(gate_name, matrix):
    """
    Tests that ZYZ decomposition of a standard gate results in a statevector
    that is equivalent (up to global phase) to applying the native matrix.
    """
    service = DecompositionService()
    matrix_schema = to_complex_schema(matrix)
    
    # 1. Native Statevector
    # Initialize a circuit and apply the native unitary
    qc_native = QuantumCircuit(1)
    qc_native.unitary(matrix, [0])
    sv_native = Statevector(qc_native)
    
    # 2. Decomposed Statevector
    gates = service.decompose_unitary(matrix_schema, start_column=0)
    assert len(gates) == 3
    
    qc_decomposed = QuantumCircuit(1)
    # The gates are returned in execution order (column 0, 1, 2)
    for gate in gates:
        theta = gate.params["theta"]
        if gate.type == "Rz":
            qc_decomposed.rz(theta, 0)
        elif gate.type == "Ry":
            qc_decomposed.ry(theta, 0)
            
    sv_decomposed = Statevector(qc_decomposed)
    
    # 3. Assert Equivalence
    # sv_native.equiv(sv_decomposed) checks equivalence up to global phase
    assert sv_native.equiv(sv_decomposed), f"Decomposition failed for {gate_name}"
