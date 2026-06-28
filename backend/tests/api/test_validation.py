import pytest
from pydantic import ValidationError
from app.schemas.circuit import CircuitRequestSchema, GateInstanceSchema, GridPositionSchema

def test_valid_circuit_schema(bell_state_circuit):
    # Should not raise exception
    assert len(bell_state_circuit.qubits) == 2
    assert len(bell_state_circuit.operations) == 2

def test_invalid_circuit_missing_qubits():
    with pytest.raises(ValidationError):
        CircuitRequestSchema(
            numColumns=3,
            operations=[]
        )

def test_invalid_operation_missing_targets():
    with pytest.raises(ValidationError):
        GateInstanceSchema(
            id="g1",
            type="H",
            controls=[]
        )

def test_invalid_operation_missing_type():
    with pytest.raises(ValidationError):
        GateInstanceSchema(
            id="g1",
            targets=[GridPositionSchema(row=0, col=0)],
            controls=[]
        )

def test_coordinate_validation():
    # Should not raise exception
    coord = GridPositionSchema(row=0, col=0)
    assert coord.row == 0
    assert coord.col == 0
    
    with pytest.raises(ValidationError):
        GridPositionSchema(col=0) # missing row
        
    with pytest.raises(ValidationError):
        GridPositionSchema(row=0) # missing col
