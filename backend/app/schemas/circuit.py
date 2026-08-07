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

# --- Controlled-U Decomposition Schemas ---

class CUDecomposeRequestSchema(BaseModel):
    gate_id: str
    matrix: List[List[ComplexNumberSchema]]
    control_qubit: int
    target_qubit: int
    column: int

class CUDecomposedGateSchema(BaseModel):
    """A gate in the CU decomposition output. May be single-qubit or CX."""
    type: str
    params: Optional[Dict[str, float]] = None
    column: int
    target_qubit: int
    control_qubit: Optional[int] = None  # Only set for CX gates

class CUDecomposeResultSchema(BaseModel):
    success: bool
    gates: List[CUDecomposedGateSchema] = Field(default_factory=list)
    euler_angles: Optional[Dict[str, float]] = None
    global_phase: Optional[float] = None
    abc_identity_error: Optional[float] = None
    axbxc_unitary_error: Optional[float] = None
    error_message: Optional[str] = None

# --- Unified Optimization Schemas ---

class OptimizeGateRequestSchema(BaseModel):
    """Request to decompose a single gate for circuit optimization."""
    gate_type: str
    column: int
    target_qubit: int
    control_qubit: Optional[int] = None
    matrix: Optional[List[List[ComplexNumberSchema]]] = None
    params: Optional[Dict[str, float]] = None

class OptimizeGateResultSchema(BaseModel):
    """Result of a single-gate optimization / decomposition."""
    success: bool
    gates: List[DecomposedGateSchema] = Field(default_factory=list)
    cu_gates: List[CUDecomposedGateSchema] = Field(default_factory=list)
    is_cu: bool = False
    error_message: Optional[str] = None

