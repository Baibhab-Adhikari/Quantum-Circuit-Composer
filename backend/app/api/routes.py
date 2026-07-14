from fastapi import APIRouter, HTTPException
from typing import List
from app.schemas.circuit import (
    CircuitRequestSchema, 
    SimulationResultSchema,
    DecomposeRequestSchema,
    DecomposeResultSchema,
    CUDecomposeRequestSchema,
    CUDecomposeResultSchema,
    ComplexNumberSchema
)
from app.services.simulation import SimulationService
from app.services.decomposition import DecompositionService
from app.services.cu_decomposition import CUDecompositionService
from app.services.validation import validate_unitarity

router = APIRouter()
simulation_service = SimulationService()
decomposition_service = DecompositionService()
cu_decomposition_service = CUDecompositionService()

@router.get("/health")
async def health_check():
    return {"status": "healthy"}

@router.post("/simulate", response_model=SimulationResultSchema)
async def simulate_circuit(request: CircuitRequestSchema):
    result = simulation_service.simulate_circuit(request)
    return result

@router.post("/decompose", response_model=DecomposeResultSchema)
async def decompose_gate(request: DecomposeRequestSchema):
    try:
        is_valid, msg = validate_unitarity(request.matrix)
        if not is_valid:
            return DecomposeResultSchema(success=False, error_message=msg)
            
        gates = decomposition_service.decompose_unitary(request.matrix, request.column)
        return DecomposeResultSchema(success=True, gates=gates)
    except Exception as e:
        return DecomposeResultSchema(success=False, error_message=str(e))

@router.post("/decompose-cu", response_model=CUDecomposeResultSchema)
async def decompose_cu_gate(request: CUDecomposeRequestSchema):
    try:
        is_valid, msg = validate_unitarity(request.matrix)
        if not is_valid:
            return CUDecomposeResultSchema(success=False, error_message=msg)

        result = cu_decomposition_service.decompose_controlled_unitary(
            request.matrix,
            request.control_qubit,
            request.target_qubit,
            request.column,
        )
        return CUDecomposeResultSchema(success=True, **result)
    except Exception as e:
        return CUDecomposeResultSchema(success=False, error_message=str(e))

@router.post("/validate-matrix")
async def validate_matrix(matrix: List[List[ComplexNumberSchema]]):
    try:
        is_valid, msg = validate_unitarity(matrix)
        return {"valid": is_valid, "reason": msg if not is_valid else None}
    except Exception as e:
        return {"valid": False, "reason": str(e)}
