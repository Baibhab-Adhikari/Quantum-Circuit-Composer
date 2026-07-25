from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router as api_router
import logging
import sys
import os

# Store logs in a hidden directory under backend/.logs/ so that watchfiles
# (used by `fastapi dev`) ignores it. Placing the log file inside the watched
# directory causes an infinite reload loop.
_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_logs_dir = os.path.join(_backend_dir, ".logs")
os.makedirs(_logs_dir, exist_ok=True)
log_file_path = os.path.join(_logs_dir, "app.log")

# Configure a file handler scoped to the 'app' namespace only.
# This prevents third-party libraries (watchfiles, uvicorn) from writing
# to app.log, which would cause an infinite change-detection loop
# during development with `fastapi dev`.
_file_handler = logging.FileHandler(log_file_path, mode="a")
_file_handler.setLevel(logging.INFO)
_file_handler.setFormatter(
    logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
)

_app_root_logger = logging.getLogger("app")
_app_root_logger.setLevel(logging.INFO)
_app_root_logger.addHandler(_file_handler)

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
