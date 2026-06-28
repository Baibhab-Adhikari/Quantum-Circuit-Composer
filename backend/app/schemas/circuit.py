from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field

class GridPositionSchema(BaseModel):
    row: int
    col: int

class GateInstanceSchema(BaseModel):
    id: str
    type: str
    targets: List[GridPositionSchema]
    controls: List[GridPositionSchema] = Field(default_factory=list)

class QubitSchema(BaseModel):
    id: str
    label: str

class CircuitRequestSchema(BaseModel):
    qubits: List[QubitSchema]
    operations: List[GateInstanceSchema]
    numColumns: int

class SimulationResultSchema(BaseModel):
    success: bool
    execution_time_ms: float
    counts: Optional[Dict[str, int]] = None
    statevector: Optional[List[Dict[str, float]]] = None
    depth: int
    gate_count: int
    error_message: Optional[str] = None
    dirac_notation: Optional[str] = None
    qiskit_code: str = ""
    openqasm: str = ""
