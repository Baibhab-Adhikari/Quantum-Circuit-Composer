from fastapi import APIRouter
from app.schemas.circuit import CircuitRequestSchema, SimulationResultSchema
from app.services.simulation import SimulationService

router = APIRouter()
simulation_service = SimulationService()

@router.get("/health")
async def health_check():
    return {"status": "healthy"}

@router.post("/simulate", response_model=SimulationResultSchema)
async def simulate_circuit(request: CircuitRequestSchema):
    result = simulation_service.simulate_circuit(request)
    return result
