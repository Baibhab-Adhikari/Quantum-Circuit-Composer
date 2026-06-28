import pytest
from app.services.simulation import SimulationService
from app.schemas.circuit import CircuitRequestSchema
from qiskit import QuantumCircuit

@pytest.fixture
def service():
    return SimulationService()

def test_simulate_circuit_success_statevector(service, bell_state_circuit, mocker):
    # Mock adapter
    mock_qc = QuantumCircuit(2)
    mock_build = mocker.patch.object(service.adapter, 'build_circuit', return_value=mock_qc)
    import math
    inv_sqrt2 = 1 / math.sqrt(2)
    mock_execute = mocker.patch.object(
        service.adapter, 
        'execute', 
        return_value=({'statevector': [inv_sqrt2, 0.0, 0.0, inv_sqrt2]}, 15.0)
    )
    
    result = service.simulate_circuit(bell_state_circuit)
    
    mock_build.assert_called_once_with(bell_state_circuit)
    mock_execute.assert_called_once_with(mock_qc)
    
    assert result.success is True
    assert result.execution_time_ms == 15.0
    assert result.statevector is not None
    assert result.counts is None
    assert result.error_message is None
    assert result.dirac_notation is not None
    assert result.qiskit_code is not None
    assert result.openqasm is not None

def test_simulate_circuit_success_counts(service, measurement_circuit, mocker):
    mock_qc = QuantumCircuit(2, 2)
    mocker.patch.object(service.adapter, 'build_circuit', return_value=mock_qc)
    mocker.patch.object(
        service.adapter, 
        'execute', 
        return_value=({'counts': {'00': 512, '11': 512}}, 20.0)
    )
    
    result = service.simulate_circuit(measurement_circuit)
    
    assert result.success is True
    assert result.counts == {'00': 512, '11': 512}
    assert result.statevector is None
    assert result.dirac_notation is None

def test_simulate_circuit_failure(service, empty_circuit, mocker):
    mocker.patch.object(
        service.adapter, 
        'build_circuit', 
        side_effect=ValueError("Invalid circuit definition")
    )
    
    result = service.simulate_circuit(empty_circuit)
    
    assert result.success is False
    assert result.error_message == "Invalid circuit definition"
    assert result.execution_time_ms == 0.0
