import pytest
from qiskit import QuantumCircuit
from app.serializers.openqasm import OpenQASMSerializer

@pytest.fixture
def openqasm_serializer():
    return OpenQASMSerializer()

def test_openqasm_empty_circuit(openqasm_serializer):
    qc = QuantumCircuit(2)
    qasm_str = openqasm_serializer.serialize(qc)
    assert "OPENQASM" in qasm_str
    assert "qreg" in qasm_str

def test_openqasm_single_gates(openqasm_serializer):
    qc = QuantumCircuit(1)
    qc.h(0)
    qc.x(0)
    qasm_str = openqasm_serializer.serialize(qc)
    assert "h q[0];" in qasm_str or "h q[0];" in qasm_str.lower()
    assert "x q[0];" in qasm_str or "x q[0];" in qasm_str.lower()

def test_openqasm_multi_qubit_gates(openqasm_serializer):
    qc = QuantumCircuit(2)
    qc.cx(0, 1)
    qasm_str = openqasm_serializer.serialize(qc)
    assert "cx" in qasm_str.lower()

def test_openqasm_measurements(openqasm_serializer):
    qc = QuantumCircuit(1, 1)
    qc.measure(0, 0)
    qasm_str = openqasm_serializer.serialize(qc)
    assert "measure q[0] -> c[0];" in qasm_str or "measure q[0] -> c[0];" in qasm_str.lower()
