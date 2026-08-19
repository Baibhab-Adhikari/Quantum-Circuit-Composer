import pytest
from app.serializers.qua import QUASerializer
from app.schemas.circuit import (
    QUACompileRequestSchema,
    QUAConfigSchema,
    QubitSchema,
    GateInstanceSchema,
    GridPositionSchema,
    ComplexNumberSchema,
)
import math

@pytest.fixture
def serializer():
    return QUASerializer()

def create_base_request(operations=None, num_qubits=2, config_variant="standard"):
    qubits = [QubitSchema(id=f"q{i}", label=f"q{i}") for i in range(num_qubits)]
    return QUACompileRequestSchema(
        qubits=qubits,
        operations=operations or [],
        numColumns=5,
        config=QUAConfigSchema(config_variant=config_variant, n_avg=100)
    )

def test_empty_circuit(serializer):
    req = create_base_request()
    res = serializer.serialize(req)
    assert res.success
    assert "pass" in res.code
    assert "measure(" not in res.code
    assert not res.warnings
    assert not res.placeholder_gates

def test_single_qubit_gates(serializer):
    ops = [
        GateInstanceSchema(
            id="x1", type="X",
            targets=[GridPositionSchema(row=0, col=0)],
        ),
        GateInstanceSchema(
            id="y1", type="Y",
            targets=[GridPositionSchema(row=0, col=1)],
        ),
        GateInstanceSchema(
            id="z1", type="Z",
            targets=[GridPositionSchema(row=0, col=2)],
        ),
    ]
    req = create_base_request(operations=ops)
    res = serializer.serialize(req)
    assert res.success
    assert 'play("x180", "qubit0")' in res.code
    assert 'play("y180", "qubit0")' in res.code
    assert 'frame_rotation_2pi(0.5, "qubit0")' in res.code

def test_parameterized_gates(serializer):
    ops = [
        GateInstanceSchema(
            id="rx1", type="Rx",
            targets=[GridPositionSchema(row=1, col=0)],
            params={"theta": math.pi / 2}
        ),
    ]
    req = create_base_request(operations=ops)
    res = serializer.serialize(req)
    assert res.success
    assert 'play("x180" * amp(0.5), "qubit1")' in res.code

def test_measurement_block(serializer):
    ops = [
        GateInstanceSchema(
            id="m1", type="Measure",
            targets=[GridPositionSchema(row=0, col=0)],
        ),
    ]
    req = create_base_request(operations=ops)
    res = serializer.serialize(req)
    assert res.success
    assert 'align("qubit0", "resonator0")' in res.code
    assert 'measure(' in res.code
    assert 'save(I, I_st)' in res.code
    assert 'with stream_processing():' in res.code

def test_unsupported_multi_qubit_gates(serializer):
    ops = [
        GateInstanceSchema(
            id="cx1", type="CX",
            controls=[GridPositionSchema(row=0, col=0)],
            targets=[GridPositionSchema(row=1, col=0)],
        ),
    ]
    req = create_base_request(operations=ops)
    res = serializer.serialize(req)
    assert res.success
    assert 'cz_gate("qubit0", "qubit1")' in res.code
    assert len(res.warnings) == 1
    assert res.warnings[0].type == "unsupported-multi-qubit"
    assert len(res.placeholder_gates) == 1

def test_zyz_decomposition_h_gate(serializer):
    ops = [
        GateInstanceSchema(
            id="h1", type="H",
            targets=[GridPositionSchema(row=0, col=0)],
        ),
    ]
    req = create_base_request(operations=ops)
    res = serializer.serialize(req)
    assert res.success
    assert 'frame_rotation_2pi' in res.code  # Rz components
    assert 'play("y180"' in res.code         # Ry component
    assert len(res.warnings) == 1
    assert res.warnings[0].type == "decomposed"

def test_bridge_operations_skipped(serializer):
    ops = [
        GateInstanceSchema(
            id="b1", type="B1",
            targets=[GridPositionSchema(row=0, col=0)],
        ),
    ]
    req = create_base_request(operations=ops)
    res = serializer.serialize(req)
    assert res.success
    assert 'wait' not in res.code
