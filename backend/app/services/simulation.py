from app.schemas.circuit import CircuitRequestSchema, SimulationResultSchema
from app.adapters.qiskit_adapter import QiskitAdapter
from app.serializers.dirac import DiracSerializer
from app.serializers.qiskit_code import QiskitCodeSerializer
from app.serializers.openqasm import OpenQASMSerializer
import logging

logger = logging.getLogger(__name__)

class SimulationService:
    def __init__(self):
        self.adapter = QiskitAdapter()
        self.dirac_serializer = DiracSerializer()
        self.qiskit_serializer = QiskitCodeSerializer()
        self.openqasm_serializer = OpenQASMSerializer()
        
    def simulate_circuit(self, request: CircuitRequestSchema) -> SimulationResultSchema:
        try:
            logger.info(f"Received simulation request for {len(request.qubits)} qubits, {len(request.operations)} operations")
            # Build quantum circuit via adapter
            qc = self.adapter.build_circuit(request)
            
            # Execute circuit
            result_data, execution_time = self.adapter.execute(qc)
            
            # Extract basic stats
            depth = qc.depth()
            
            # Filter out save_statevector and measure from gate_count to just count actual gates
            # Or just use the raw count
            operations = dict(qc.count_ops())
            gate_count = sum(count for name, count in operations.items() if name not in ['measure', 'save_statevector'])

            # Complex numbers in statevector need to be formatted nicely, but for now Pydantic can handle standard complex types
            # Wait, standard JSON doesn't support Python complex type natively!
            # We must convert them to [real, imag] or strings. 
            # We'll convert to dict {"real": float, "imag": float}
            statevector = result_data.get('statevector')
            formatted_statevector = None
            if statevector:
                # statevector is a list of complex
                formatted_statevector = [{"real": c.real, "imag": c.imag} for c in statevector]
            
            # counts dictionary has keys like '00', '11'
            counts = result_data.get('counts')
            
            # Generate representations
            logger.info("Generating representations (Qiskit Code, OpenQASM)")
            qiskit_code = self.qiskit_serializer.serialize(request)
            openqasm_code = self.openqasm_serializer.serialize(qc)
            
            dirac_notation = None
            if statevector:
                logger.info("Generating Dirac notation from statevector")
                dirac_notation = self.dirac_serializer.serialize(statevector, len(request.qubits))
            
            return SimulationResultSchema(
                success=True,
                execution_time_ms=execution_time,
                counts=counts,
                statevector=formatted_statevector,
                depth=depth,
                gate_count=gate_count,
                dirac_notation=dirac_notation,
                qiskit_code=qiskit_code,
                openqasm=openqasm_code
            )
        except Exception as e:
            logger.error(f"Simulation failed: {str(e)}", exc_info=True)
            return SimulationResultSchema(
                success=False,
                execution_time_ms=0.0,
                depth=0,
                gate_count=0,
                error_message=str(e)
            )
