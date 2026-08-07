from qiskit import QuantumCircuit
from app.serializers.base import BaseSerializer
import logging

logger = logging.getLogger(__name__)

class OpenQASMSerializer(BaseSerializer[QuantumCircuit, str]):
    """
    Serializes a Qiskit QuantumCircuit into an OpenQASM string.
    
    Note: Bridge operations (B1, B2) are scheduling placeholders that do not
    correspond to quantum gates. They are excluded upstream by the QiskitAdapter
    when building the QuantumCircuit, so they never appear in the circuit object
    passed to this serializer. No explicit filtering is needed here.
    """
    def serialize(self, data: QuantumCircuit, **kwargs) -> str:
        """
        Generates OpenQASM 2.0 or 3.0 representation of the circuit.
        Falls back gracefully if qasm2/qasm3 modules are not present in older/newer qiskit versions.
        """
        try:
            try:
                from qiskit import qasm2
                return qasm2.dumps(data)
            except ImportError:
                # Fallback for Qiskit < 1.0
                return data.qasm()
        except Exception as e:
            logger.error(f"Failed to generate OpenQASM: {e}")
            return "// OpenQASM generation failed."
