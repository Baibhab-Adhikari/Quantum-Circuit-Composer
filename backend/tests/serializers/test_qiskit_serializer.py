import pytest
from app.serializers.qiskit_code import QiskitCodeSerializer

@pytest.fixture
def qiskit_serializer():
    return QiskitCodeSerializer()

def test_qiskit_empty_circuit(qiskit_serializer, empty_circuit):
    code = qiskit_serializer.serialize(empty_circuit)
    assert "qc = QuantumCircuit(2, 0)" in code
    assert "qc.save_statevector()" in code

def test_qiskit_single_qubit_gates(qiskit_serializer, single_qubit_circuit):
    code = qiskit_serializer.serialize(single_qubit_circuit)
    assert "qc.h(0)" in code
    assert "qc.x(0)" in code

def test_qiskit_bell_state_circuit(qiskit_serializer, bell_state_circuit):
    code = qiskit_serializer.serialize(bell_state_circuit)
    assert "qc.h(0)" in code
    assert "qc.cx(0, 1)" in code

def test_qiskit_ccx_circuit(qiskit_serializer, ccx_circuit):
    code = qiskit_serializer.serialize(ccx_circuit)
    assert "qc.ccx(0, 1, 2)" in code

def test_qiskit_measurement_circuit(qiskit_serializer, measurement_circuit):
    code = qiskit_serializer.serialize(measurement_circuit)
    assert "qc = QuantumCircuit(2, 2)" in code
    assert "qc.measure(0, 0)" in code
    assert "qc.measure(1, 1)" in code
    assert "counts = result.get_counts(compiled_circuit)" in code
