from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field

class ComplexNumberSchema(BaseModel):
    real: float
    imag: float = 0.0

class GridPositionSchema(BaseModel):
    row: int
    col: int

class GateInstanceSchema(BaseModel):
    id: str
    type: str
    targets: List[GridPositionSchema]
    controls: List[GridPositionSchema] = Field(default_factory=list)
    params: Optional[Dict[str, float]] = None
    matrix: Optional[List[List[ComplexNumberSchema]]] = None

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

class DecomposeRequestSchema(BaseModel):
    gate_id: str
    matrix: List[List[ComplexNumberSchema]]
    target_qubit: int
    column: int

class DecomposedGateSchema(BaseModel):
    type: str
    params: Dict[str, float]
    column: int

class DecomposeResultSchema(BaseModel):
    success: bool
    gates: List[DecomposedGateSchema] = Field(default_factory=list)
    error_message: Optional[str] = None
