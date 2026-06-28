from qiskit import QuantumCircuit
from app.serializers.base import BaseSerializer
import logging

logger = logging.getLogger(__name__)

class OpenQASMSerializer(BaseSerializer[QuantumCircuit, str]):
    """
    Serializes a Qiskit QuantumCircuit into an OpenQASM string.
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
