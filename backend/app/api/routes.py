import logging
from fastapi import APIRouter, HTTPException
from typing import List
from app.schemas.circuit import (
    CircuitRequestSchema, 
    SimulationResultSchema,
    DecomposeRequestSchema,
    DecomposeResultSchema,
    CUDecomposeRequestSchema,
    CUDecomposeResultSchema,
    OptimizeGateRequestSchema,
    OptimizeGateResultSchema,
    ComplexNumberSchema,
    QUACompileRequestSchema,
    QUACompileResultSchema,
)
from app.services.simulation import SimulationService
from app.services.decomposition import DecompositionService
from app.services.cu_decomposition import CUDecompositionService
from app.services.optimization import OptimizationService
from app.services.validation import validate_unitarity
from app.serializers.qua import QUASerializer

import logging
logger = logging.getLogger(__name__)

router = APIRouter()
simulation_service = SimulationService()
decomposition_service = DecompositionService()
cu_decomposition_service = CUDecompositionService()
optimization_service = OptimizationService()
qua_serializer = QUASerializer()

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

@router.post("/optimize-gate", response_model=OptimizeGateResultSchema)
async def optimize_gate(request: OptimizeGateRequestSchema):
    """
    Unified gate optimization endpoint.
    """
    logger.info(f"Received optimization request for gate_type {request.gate_type}")
    try:
        # CU gate — delegate to the existing CU decomposition service
        if request.gate_type == 'CU':
            if request.matrix is None:
                return OptimizeGateResultSchema(
                    success=False,
                    error_message="CU gate requires a matrix."
                )
            if request.control_qubit is None:
                return OptimizeGateResultSchema(
                    success=False,
                    error_message="CU gate requires a control_qubit."
                )

            is_valid, msg = validate_unitarity(request.matrix)
            if not is_valid:
                return OptimizeGateResultSchema(
                    success=False,
                    error_message=msg
                )

            result = cu_decomposition_service.decompose_controlled_unitary(
                request.matrix,
                request.control_qubit,
                request.target_qubit,
                request.column,
            )
            return OptimizeGateResultSchema(
                success=True,
                cu_gates=result["gates"],
                is_cu=True,
            )

        # Single-qubit gate — validate matrix if provided
        if request.matrix is not None:
            is_valid, msg = validate_unitarity(request.matrix)
            if not is_valid:
                return OptimizeGateResultSchema(success=False, error_message=msg)

        gates = optimization_service.optimize_single_qubit(
            gate_type=request.gate_type,
            start_column=request.column,
            matrix=request.matrix,
            params=request.params,
        )
        return OptimizeGateResultSchema(success=True, gates=gates)
    except Exception as e:
        return OptimizeGateResultSchema(success=False, error_message=str(e))

@router.post("/validate-matrix")
async def validate_matrix(matrix: List[List[ComplexNumberSchema]]):
    try:
        is_valid, msg = validate_unitarity(matrix)
        return {"valid": is_valid, "reason": msg if not is_valid else None}
    except Exception as e:
        return {"valid": False, "reason": str(e)}

@router.post("/compile-qua", response_model=QUACompileResultSchema)
async def compile_qua(request: QUACompileRequestSchema):
    """
    Compile a circuit into a runnable QUA (Quantum Machines) Python program.

    Accepts the circuit IR (qubits, operations, numColumns) and a QUA config
    (config_variant, n_avg), and returns the compiled QUA code along with any
    warnings and placeholder gate identifiers.
    """
    logger.info(f"Received QUA compilation request for variant {request.config.config_variant} with {len(request.operations)} operations")
    result = qua_serializer.serialize(request)
    
    if result.success:
        logger.info(f"QUA compilation successful. Generated {len(result.code)} chars of code. Warnings: {len(result.warnings)}, Placeholders: {len(result.placeholder_gates)}")
    else:
        logger.error(f"QUA compilation failed: {result.error_message}")
        
    return result


