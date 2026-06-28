import pytest
from app.schemas.circuit import CircuitRequestSchema, GateInstanceSchema, GridPositionSchema, QubitSchema

@pytest.fixture
def empty_circuit() -> CircuitRequestSchema:
    return CircuitRequestSchema(
        qubits=[QubitSchema(id="q0", label="q0"), QubitSchema(id="q1", label="q1")],
        numColumns=5,
        operations=[]
    )

@pytest.fixture
def single_qubit_circuit() -> CircuitRequestSchema:
    return CircuitRequestSchema(
        qubits=[QubitSchema(id="q0", label="q0")],
        numColumns=3,
        operations=[
            GateInstanceSchema(
                id="g1",
                type="H",
                targets=[GridPositionSchema(row=0, col=0)],
                controls=[]
            ),
            GateInstanceSchema(
                id="g2",
                type="X",
                targets=[GridPositionSchema(row=0, col=1)],
                controls=[]
            )
        ]
    )

@pytest.fixture
def bell_state_circuit() -> CircuitRequestSchema:
    return CircuitRequestSchema(
        qubits=[QubitSchema(id="q0", label="q0"), QubitSchema(id="q1", label="q1")],
        numColumns=3,
        operations=[
            GateInstanceSchema(
                id="g1",
                type="H",
                targets=[GridPositionSchema(row=0, col=0)],
                controls=[]
            ),
            GateInstanceSchema(
                id="g2",
                type="CX",
                targets=[GridPositionSchema(row=1, col=1)],
                controls=[GridPositionSchema(row=0, col=1)]
            )
        ]
    )

@pytest.fixture
def ccx_circuit() -> CircuitRequestSchema:
    return CircuitRequestSchema(
        qubits=[QubitSchema(id="q0", label="q0"), QubitSchema(id="q1", label="q1"), QubitSchema(id="q2", label="q2")],
        numColumns=3,
        operations=[
            GateInstanceSchema(
                id="g1",
                type="CCX",
                targets=[GridPositionSchema(row=2, col=0)],
                controls=[GridPositionSchema(row=0, col=0), GridPositionSchema(row=1, col=0)]
            )
        ]
    )

@pytest.fixture
def measurement_circuit(bell_state_circuit) -> CircuitRequestSchema:
    # Copy Bell state and add measurements
    ops = bell_state_circuit.operations.copy()
    ops.append(
        GateInstanceSchema(
            id="g3",
            type="Measure",
            targets=[GridPositionSchema(row=0, col=2)],
            controls=[]
        )
    )
    ops.append(
        GateInstanceSchema(
            id="g4",
            type="Measure",
            targets=[GridPositionSchema(row=1, col=2)],
            controls=[]
        )
    )
    return CircuitRequestSchema(
        qubits=bell_state_circuit.qubits,
        numColumns=3,
        operations=ops
    )
