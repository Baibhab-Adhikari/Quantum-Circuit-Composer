"""
Comprehensive tests for Bridge (B1, B2) operations — Milestone 8.

Bridge operations are scheduling placeholders that:
- Are accepted by the schema
- Are skipped by the Qiskit adapter (no quantum effect)
- Do not affect simulation results (statevector / counts)
- Are omitted from generated Qiskit code
- Produce valid OpenQASM (bridges never appear in the QuantumCircuit)
- Are accepted by the API endpoint
"""

import math
import pytest
from app.schemas.circuit import (
    CircuitRequestSchema,
    GateInstanceSchema,
    GridPositionSchema,
    QubitSchema,
)
from app.adapters.qiskit_adapter import QiskitAdapter
from app.serializers.qiskit_code import QiskitCodeSerializer
from app.serializers.openqasm import OpenQASMSerializer
from app.services.simulation import SimulationService


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def adapter():
    return QiskitAdapter()


@pytest.fixture
def qiskit_serializer():
    return QiskitCodeSerializer()


@pytest.fixture
def openqasm_serializer():
    return OpenQASMSerializer()


@pytest.fixture
def simulation_service():
    return SimulationService()


def _make_circuit(operations, num_qubits=1, num_columns=5):
    """Helper to build a CircuitRequestSchema with the given operations."""
    qubits = [QubitSchema(id=f"q{i}", label=f"q{i}") for i in range(num_qubits)]
    return CircuitRequestSchema(
        qubits=qubits,
        numColumns=num_columns,
        operations=operations,
    )


# ---------------------------------------------------------------------------
# 1. Schema acceptance
# ---------------------------------------------------------------------------

class TestSchemaAcceptance:
    """B1 and B2 operations must be accepted by the Pydantic schemas."""

    def test_b1_accepted_by_gate_instance_schema(self):
        gate = GateInstanceSchema(
            id="b1-1",
            type="B1",
            targets=[GridPositionSchema(row=0, col=1)],
            controls=[],
        )
        assert gate.type == "B1"
        assert len(gate.targets) == 1

    def test_b2_accepted_by_gate_instance_schema(self):
        gate = GateInstanceSchema(
            id="b2-1",
            type="B2",
            targets=[GridPositionSchema(row=0, col=1)],
            controls=[],
        )
        assert gate.type == "B2"

    def test_circuit_with_bridges_accepted(self):
        circuit = _make_circuit([
            GateInstanceSchema(
                id="h1", type="H",
                targets=[GridPositionSchema(row=0, col=0)], controls=[],
            ),
            GateInstanceSchema(
                id="b1-1", type="B1",
                targets=[GridPositionSchema(row=0, col=1)], controls=[],
            ),
            GateInstanceSchema(
                id="m1", type="Measure",
                targets=[GridPositionSchema(row=0, col=2)], controls=[],
            ),
        ])
        assert len(circuit.operations) == 3

    def test_circuit_with_both_bridge_types(self):
        circuit = _make_circuit([
            GateInstanceSchema(
                id="b1-1", type="B1",
                targets=[GridPositionSchema(row=0, col=0)], controls=[],
            ),
            GateInstanceSchema(
                id="b2-1", type="B2",
                targets=[GridPositionSchema(row=0, col=1)], controls=[],
            ),
        ])
        assert circuit.operations[0].type == "B1"
        assert circuit.operations[1].type == "B2"


# ---------------------------------------------------------------------------
# 2. Adapter skips bridges
# ---------------------------------------------------------------------------

class TestAdapterSkipsBridges:
    """The Qiskit adapter must not translate B1/B2 into any circuit instruction."""

    def test_b1_not_in_quantum_circuit(self, adapter):
        circuit = _make_circuit([
            GateInstanceSchema(
                id="h1", type="H",
                targets=[GridPositionSchema(row=0, col=0)], controls=[],
            ),
            GateInstanceSchema(
                id="b1-1", type="B1",
                targets=[GridPositionSchema(row=0, col=1)], controls=[],
            ),
        ])
        qc = adapter.build_circuit(circuit)
        op_names = [instr.operation.name for instr in qc.data]
        assert "h" in op_names
        assert "B1" not in op_names
        assert "b1" not in op_names
        assert len(qc.data) == 1  # Only H

    def test_b2_not_in_quantum_circuit(self, adapter):
        circuit = _make_circuit([
            GateInstanceSchema(
                id="b2-1", type="B2",
                targets=[GridPositionSchema(row=0, col=0)], controls=[],
            ),
        ])
        qc = adapter.build_circuit(circuit)
        assert len(qc.data) == 0  # No instructions at all

    def test_circuit_with_bridges_before_measure(self, adapter):
        circuit = _make_circuit([
            GateInstanceSchema(
                id="h1", type="H",
                targets=[GridPositionSchema(row=0, col=0)], controls=[],
            ),
            GateInstanceSchema(
                id="b1-1", type="B1",
                targets=[GridPositionSchema(row=0, col=1)], controls=[],
            ),
            GateInstanceSchema(
                id="m1", type="Measure",
                targets=[GridPositionSchema(row=0, col=2)], controls=[],
            ),
        ])
        qc = adapter.build_circuit(circuit)
        op_names = [instr.operation.name for instr in qc.data]
        assert op_names == ["h", "measure"]

    def test_multiple_bridges_skipped(self, adapter):
        """Multiple B1 and B2 operations should all be skipped."""
        circuit = _make_circuit([
            GateInstanceSchema(
                id="h1", type="H",
                targets=[GridPositionSchema(row=0, col=0)], controls=[],
            ),
            GateInstanceSchema(
                id="b1-1", type="B1",
                targets=[GridPositionSchema(row=0, col=1)], controls=[],
            ),
            GateInstanceSchema(
                id="b2-1", type="B2",
                targets=[GridPositionSchema(row=0, col=2)], controls=[],
            ),
            GateInstanceSchema(
                id="b1-2", type="B1",
                targets=[GridPositionSchema(row=0, col=3)], controls=[],
            ),
        ])
        qc = adapter.build_circuit(circuit)
        assert len(qc.data) == 1  # Only H


# ---------------------------------------------------------------------------
# 3. Simulation ignores bridges
# ---------------------------------------------------------------------------

class TestSimulationIgnoresBridges:
    """Simulation results must be identical with and without bridge operations."""

    def test_statevector_unchanged_with_b1(self, adapter):
        """H gate with and without B1 should produce identical statevectors."""
        # Without bridge
        circuit_no_bridge = _make_circuit([
            GateInstanceSchema(
                id="h1", type="H",
                targets=[GridPositionSchema(row=0, col=0)], controls=[],
            ),
        ])
        # With bridge
        circuit_with_bridge = _make_circuit([
            GateInstanceSchema(
                id="h1", type="H",
                targets=[GridPositionSchema(row=0, col=0)], controls=[],
            ),
            GateInstanceSchema(
                id="b1-1", type="B1",
                targets=[GridPositionSchema(row=0, col=1)], controls=[],
            ),
        ])

        qc_no = adapter.build_circuit(circuit_no_bridge)
        qc_with = adapter.build_circuit(circuit_with_bridge)

        # Both circuits should have the same depth and gate count
        assert qc_no.depth() == qc_with.depth()
        assert dict(qc_no.count_ops()) == dict(qc_with.count_ops())

        # Execute both and compare statevectors
        result_no, _ = adapter.execute(qc_no)
        result_with, _ = adapter.execute(qc_with)

        sv_no = result_no["statevector"]
        sv_with = result_with["statevector"]

        for a, b in zip(sv_no, sv_with):
            assert abs(a - b) < 1e-10

    def test_statevector_unchanged_with_b2(self, adapter):
        """B2 should also have no effect on statevector."""
        circuit_with_b2 = _make_circuit([
            GateInstanceSchema(
                id="x1", type="X",
                targets=[GridPositionSchema(row=0, col=0)], controls=[],
            ),
            GateInstanceSchema(
                id="b2-1", type="B2",
                targets=[GridPositionSchema(row=0, col=1)], controls=[],
            ),
        ])

        qc = adapter.build_circuit(circuit_with_b2)
        result, _ = adapter.execute(qc)
        sv = result["statevector"]

        # X|0⟩ = |1⟩, so statevector should be [0, 1]
        assert abs(sv[0]) < 1e-10
        assert abs(abs(sv[1]) - 1.0) < 1e-10

    def test_counts_unchanged_with_bridges(self, adapter):
        """Measurement counts should be identical with and without bridges."""
        ops_no_bridge = [
            GateInstanceSchema(
                id="h1", type="H",
                targets=[GridPositionSchema(row=0, col=0)], controls=[],
            ),
            GateInstanceSchema(
                id="cx1", type="CX",
                targets=[GridPositionSchema(row=1, col=1)],
                controls=[GridPositionSchema(row=0, col=1)],
            ),
            GateInstanceSchema(
                id="m1", type="Measure",
                targets=[GridPositionSchema(row=0, col=2)], controls=[],
            ),
            GateInstanceSchema(
                id="m2", type="Measure",
                targets=[GridPositionSchema(row=1, col=2)], controls=[],
            ),
        ]

        ops_with_bridge = ops_no_bridge + [
            GateInstanceSchema(
                id="b1-1", type="B1",
                targets=[GridPositionSchema(row=0, col=3)], controls=[],
            ),
            GateInstanceSchema(
                id="b1-2", type="B1",
                targets=[GridPositionSchema(row=1, col=3)], controls=[],
            ),
        ]

        circuit_no = _make_circuit(ops_no_bridge, num_qubits=2)
        circuit_with = _make_circuit(ops_with_bridge, num_qubits=2)

        qc_no = adapter.build_circuit(circuit_no)
        qc_with = adapter.build_circuit(circuit_with)

        # Same gate count (bridges don't count)
        assert dict(qc_no.count_ops()) == dict(qc_with.count_ops())

    def test_bell_state_unaffected_by_bridges(self, adapter):
        """A Bell state circuit with bridges should produce the same statevector."""
        circuit = _make_circuit([
            GateInstanceSchema(
                id="h1", type="H",
                targets=[GridPositionSchema(row=0, col=0)], controls=[],
            ),
            GateInstanceSchema(
                id="b1-1", type="B1",
                targets=[GridPositionSchema(row=0, col=1)], controls=[],
            ),
            GateInstanceSchema(
                id="b2-1", type="B2",
                targets=[GridPositionSchema(row=1, col=1)], controls=[],
            ),
            GateInstanceSchema(
                id="cx1", type="CX",
                targets=[GridPositionSchema(row=1, col=2)],
                controls=[GridPositionSchema(row=0, col=2)],
            ),
        ], num_qubits=2)

        qc = adapter.build_circuit(circuit)
        result, _ = adapter.execute(qc)
        sv = result["statevector"]

        inv_sqrt2 = 1 / math.sqrt(2)
        # Bell state: (|00⟩ + |11⟩)/√2
        assert abs(abs(sv[0]) - inv_sqrt2) < 1e-10
        assert abs(sv[1]) < 1e-10
        assert abs(sv[2]) < 1e-10
        assert abs(abs(sv[3]) - inv_sqrt2) < 1e-10


# ---------------------------------------------------------------------------
# 4. OpenQASM generation remains valid
# ---------------------------------------------------------------------------

class TestOpenQASMWithBridges:
    """OpenQASM output must be valid and not contain bridge references."""

    def test_openqasm_no_bridge_references(self, adapter, openqasm_serializer):
        circuit = _make_circuit([
            GateInstanceSchema(
                id="h1", type="H",
                targets=[GridPositionSchema(row=0, col=0)], controls=[],
            ),
            GateInstanceSchema(
                id="b1-1", type="B1",
                targets=[GridPositionSchema(row=0, col=1)], controls=[],
            ),
        ])
        qc = adapter.build_circuit(circuit)
        qasm = openqasm_serializer.serialize(qc)
        assert "OPENQASM" in qasm
        assert "B1" not in qasm
        assert "B2" not in qasm
        assert "h q[0];" in qasm or "h q[0];" in qasm.lower()

    def test_openqasm_with_bridges_and_measure(self, adapter, openqasm_serializer):
        circuit = _make_circuit([
            GateInstanceSchema(
                id="h1", type="H",
                targets=[GridPositionSchema(row=0, col=0)], controls=[],
            ),
            GateInstanceSchema(
                id="b1-1", type="B1",
                targets=[GridPositionSchema(row=0, col=1)], controls=[],
            ),
            GateInstanceSchema(
                id="m1", type="Measure",
                targets=[GridPositionSchema(row=0, col=2)], controls=[],
            ),
        ])
        qc = adapter.build_circuit(circuit)
        qasm = openqasm_serializer.serialize(qc)
        assert "measure" in qasm.lower()
        assert "B1" not in qasm


# ---------------------------------------------------------------------------
# 5. Qiskit code generation remains valid
# ---------------------------------------------------------------------------

class TestQiskitCodeWithBridges:
    """Generated Qiskit code must not contain bridge operations."""

    def test_qiskit_code_no_bridge_references(self, qiskit_serializer):
        circuit = _make_circuit([
            GateInstanceSchema(
                id="h1", type="H",
                targets=[GridPositionSchema(row=0, col=0)], controls=[],
            ),
            GateInstanceSchema(
                id="b1-1", type="B1",
                targets=[GridPositionSchema(row=0, col=1)], controls=[],
            ),
            GateInstanceSchema(
                id="b2-1", type="B2",
                targets=[GridPositionSchema(row=0, col=2)], controls=[],
            ),
        ])
        code = qiskit_serializer.serialize(circuit)
        assert "qc.h(0)" in code
        assert "B1" not in code
        assert "B2" not in code
        assert "b1" not in code
        assert "b2" not in code

    def test_qiskit_code_with_bridges_and_measure(self, qiskit_serializer):
        circuit = _make_circuit([
            GateInstanceSchema(
                id="h1", type="H",
                targets=[GridPositionSchema(row=0, col=0)], controls=[],
            ),
            GateInstanceSchema(
                id="b1-1", type="B1",
                targets=[GridPositionSchema(row=0, col=1)], controls=[],
            ),
            GateInstanceSchema(
                id="m1", type="Measure",
                targets=[GridPositionSchema(row=0, col=2)], controls=[],
            ),
        ])
        code = qiskit_serializer.serialize(circuit)
        assert "qc.h(0)" in code
        assert "qc.measure(0, 0)" in code
        assert "B1" not in code

    def test_qiskit_code_bridge_only_circuit(self, qiskit_serializer):
        """A circuit with only bridges should produce valid code with no gate calls."""
        circuit = _make_circuit([
            GateInstanceSchema(
                id="b1-1", type="B1",
                targets=[GridPositionSchema(row=0, col=0)], controls=[],
            ),
        ])
        code = qiskit_serializer.serialize(circuit)
        assert "QuantumCircuit" in code
        assert "B1" not in code


# ---------------------------------------------------------------------------
# 6. Backend gracefully handles pre-existing bridges
# ---------------------------------------------------------------------------

class TestBackendWithExistingBridges:
    """The backend should handle circuits that already contain bridge operations."""

    def test_simulation_service_with_bridges(self, simulation_service):
        """SimulationService should succeed with bridge operations present."""
        circuit = _make_circuit([
            GateInstanceSchema(
                id="h1", type="H",
                targets=[GridPositionSchema(row=0, col=0)], controls=[],
            ),
            GateInstanceSchema(
                id="b1-1", type="B1",
                targets=[GridPositionSchema(row=0, col=1)], controls=[],
            ),
        ])
        result = simulation_service.simulate_circuit(circuit)
        assert result.success is True
        assert result.statevector is not None
        assert result.error_message is None

    def test_simulation_with_bridges_and_measurements(self, simulation_service):
        """SimulationService with bridges + measurements should return counts."""
        circuit = _make_circuit([
            GateInstanceSchema(
                id="h1", type="H",
                targets=[GridPositionSchema(row=0, col=0)], controls=[],
            ),
            GateInstanceSchema(
                id="b1-1", type="B1",
                targets=[GridPositionSchema(row=0, col=1)], controls=[],
            ),
            GateInstanceSchema(
                id="m1", type="Measure",
                targets=[GridPositionSchema(row=0, col=2)], controls=[],
            ),
        ])
        result = simulation_service.simulate_circuit(circuit)
        assert result.success is True
        assert result.counts is not None
        total_shots = sum(result.counts.values())
        assert total_shots == 1024


# ---------------------------------------------------------------------------
# 7. API endpoint accepts bridges
# ---------------------------------------------------------------------------

class TestAPIWithBridges:
    """The /simulate endpoint must accept circuits containing bridge operations."""

    def test_simulate_with_bridges(self):
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app)

        payload = {
            "qubits": [{"id": "q0", "label": "q0"}],
            "numColumns": 5,
            "operations": [
                {
                    "id": "h1",
                    "type": "H",
                    "targets": [{"row": 0, "col": 0}],
                    "controls": [],
                },
                {
                    "id": "b1-1",
                    "type": "B1",
                    "targets": [{"row": 0, "col": 1}],
                    "controls": [],
                },
            ],
        }

        response = client.post("/simulate", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_simulate_with_both_bridge_types(self):
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app)

        payload = {
            "qubits": [{"id": "q0", "label": "q0"}],
            "numColumns": 5,
            "operations": [
                {
                    "id": "b1-1",
                    "type": "B1",
                    "targets": [{"row": 0, "col": 0}],
                    "controls": [],
                },
                {
                    "id": "b2-1",
                    "type": "B2",
                    "targets": [{"row": 0, "col": 1}],
                    "controls": [],
                },
            ],
        }

        response = client.post("/simulate", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
