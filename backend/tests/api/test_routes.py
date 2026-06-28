import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

def test_simulate_valid_circuit_success(bell_state_circuit, mocker):
    # Mock SimulationService to avoid actual Qiskit execution in API tests
    from app.schemas.circuit import SimulationResultSchema
    mock_result = SimulationResultSchema(
        success=True,
        execution_time_ms=10.0,
        depth=2,
        gate_count=2,
        statevector=[{"real": 0.707, "imag": 0.0}, {"real": 0.0, "imag": 0.0}, {"real": 0.0, "imag": 0.0}, {"real": 0.707, "imag": 0.0}],
        dirac_notation="(|00⟩ + |11⟩)/√2"
    )
    mocker.patch('app.api.routes.simulation_service.simulate_circuit', return_value=mock_result)

    response = client.post("/simulate", json=bell_state_circuit.model_dump())
    
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["execution_time_ms"] == 10.0
    assert data["dirac_notation"] == "(|00⟩ + |11⟩)/√2"

def test_simulate_invalid_payload():
    # Missing required 'operations' field
    payload = {
        "qubits": 2,
        "columns": 3
    }
    response = client.post("/simulate", json=payload)
    assert response.status_code == 422 # Unprocessable Entity (Validation Error)
