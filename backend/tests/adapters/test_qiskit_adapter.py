import pytest
from app.adapters.qiskit_adapter import QiskitAdapter

@pytest.fixture
def adapter():
    return QiskitAdapter()

def test_build_empty_circuit(adapter, empty_circuit):
    qc = adapter.build_circuit(empty_circuit)
    assert qc.num_qubits == 2
    assert qc.num_clbits == 0
    assert len(qc.data) == 0

def test_build_single_qubit_circuit(adapter, single_qubit_circuit):
    qc = adapter.build_circuit(single_qubit_circuit)
    assert len(qc.data) == 2
    assert qc.data[0].operation.name == 'h'
    assert qc.data[1].operation.name == 'x'

def test_build_bell_state_circuit(adapter, bell_state_circuit):
    qc = adapter.build_circuit(bell_state_circuit)
    assert qc.num_qubits == 2
    assert qc.data[0].operation.name == 'h'
    assert qc.data[1].operation.name == 'cx'

def test_build_ccx_circuit(adapter, ccx_circuit):
    qc = adapter.build_circuit(ccx_circuit)
    assert qc.num_qubits == 3
    assert qc.data[0].operation.name == 'ccx'

def test_build_measurement_circuit(adapter, measurement_circuit):
    qc = adapter.build_circuit(measurement_circuit)
    assert qc.num_qubits == 2
    assert qc.num_clbits == 2
    ops = [instr.operation.name for instr in qc.data]
    assert 'measure' in ops

def test_execute_statevector(adapter, bell_state_circuit):
    qc = adapter.build_circuit(bell_state_circuit)
    result_data, exec_time = adapter.execute(qc)
    assert 'statevector' in result_data
    assert len(result_data['statevector']) == 4
    assert 'counts' not in result_data
    assert exec_time >= 0

def test_execute_measurements(adapter, measurement_circuit):
    qc = adapter.build_circuit(measurement_circuit)
    result_data, exec_time = adapter.execute(qc)
    assert 'counts' in result_data
    assert 'statevector' not in result_data
    # 1024 shots
    assert sum(result_data['counts'].values()) == 1024
