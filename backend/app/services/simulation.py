from app.schemas.circuit import CircuitRequestSchema, SimulationResultSchema
from app.adapters.qiskit_adapter import QiskitAdapter
import logging

logger = logging.getLogger(__name__)

class SimulationService:
    def __init__(self):
        self.adapter = QiskitAdapter()
        
    def simulate_circuit(self, request: CircuitRequestSchema) -> SimulationResultSchema:
        try:
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
            
            return SimulationResultSchema(
                success=True,
                execution_time_ms=execution_time,
                counts=counts,
                statevector=formatted_statevector,
                depth=depth,
                gate_count=gate_count
            )
        except Exception as e:
            logger.error(f"Simulation failed: {str(e)}")
            return SimulationResultSchema(
                success=False,
                execution_time_ms=0.0,
                depth=0,
                gate_count=0,
                error_message=str(e)
            )
