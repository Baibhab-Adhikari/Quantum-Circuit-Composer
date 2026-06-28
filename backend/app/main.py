from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router as api_router
import logging
import sys

# Configure root logger to write to a file to keep terminal clean
logging.basicConfig(
    filename="app.log",
    filemode="a",
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Quantum Circuit Composer API",
    description="Backend API for executing quantum circuits",
    version="1.0.0"
)

# Configure CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, this should be specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the router
app.include_router(api_router)

logger.info("Quantum Circuit Composer Backend Initialized")
