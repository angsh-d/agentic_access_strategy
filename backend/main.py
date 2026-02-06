"""FastAPI application entry point."""
from contextlib import asynccontextmanager
from datetime import datetime
import os
from pathlib import Path
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from backend.config.settings import get_settings
from backend.config.logging_config import setup_logging, get_logger
from backend.storage.database import init_db
from backend.api.routes import cases, strategies, policies, websocket, validation, activity, patients
from backend.mock_services.scenarios import get_scenario_manager

# Initialize logging
setup_logging(log_level="INFO")
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    logger.info("Starting Agentic Access Strategy Platform")

    # Initialize database
    await init_db()
    logger.info("Database initialized")

    # Initialize scenario manager
    get_scenario_manager()
    logger.info("Scenario manager initialized")

    yield

    # Cleanup resources
    logger.info("Shutting down Agentic Access Strategy Platform")

    # Close MCP client connections
    try:
        from backend.mcp.mcp_client import get_mcp_client
        mcp_client = get_mcp_client()
        await mcp_client.close()
        logger.info("MCP client closed")
    except Exception as e:
        logger.warning("Failed to close MCP client", error=str(e))


# Create FastAPI app
app = FastAPI(
    title="Agentic Access Strategy Platform",
    description="Autonomous prior authorization workflow orchestration",
    version="0.1.0",
    lifespan=lifespan
)

# Get settings
settings = get_settings()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handlers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler — logs details server-side, returns generic message to client."""
    error_id = str(uuid.uuid4())[:8]
    logger.error(
        "Unhandled exception",
        error_id=error_id,
        error=str(exc),
        path=request.url.path,
        exc_info=True
    )
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "error_id": error_id}
    )


# Include routers
app.include_router(cases.router, prefix="/api/v1")
app.include_router(strategies.router, prefix="/api/v1")
app.include_router(policies.router, prefix="/api/v1")
app.include_router(validation.router, prefix="/api/v1")
app.include_router(activity.router, prefix="/api/v1")
app.include_router(patients.router, prefix="/api/v1")
app.include_router(websocket.router)


# Health check and utility endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    from backend.reasoning.llm_gateway import get_llm_gateway

    # Check LLM availability
    llm_gateway = get_llm_gateway()
    llm_health = await llm_gateway.health_check()

    components = {
        "database": True,
        "claude": llm_health.get("claude", False),
        "gemini": llm_health.get("gemini", False),
        "azure_openai": llm_health.get("azure_openai", False)
    }
    all_healthy = all(components.values())

    return {
        "status": "healthy" if all_healthy else "degraded",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "0.1.0",
        "components": components
    }


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "Agentic Access Strategy Platform",
        "version": "0.1.0",
        "description": "Autonomous prior authorization workflow orchestration",
        "docs": "/docs",
        "health": "/health"
    }


@app.get("/api/v1/scenarios")
async def list_scenarios():
    """List available demo scenarios."""
    manager = get_scenario_manager()
    return {
        "scenarios": manager.list_scenarios(),
        "current": manager.current_scenario.value
    }


@app.post("/api/v1/scenarios/{scenario_id}")
async def set_scenario(scenario_id: str):
    """Set the active demo scenario."""
    from backend.mock_services.scenarios import Scenario

    try:
        scenario = Scenario(scenario_id)
        manager = get_scenario_manager()
        config = manager.set_scenario(scenario)
        return {
            "message": f"Scenario set to: {scenario_id}",
            "config": {
                "name": config.name,
                "description": config.description,
                "expected_outcome": config.expected_outcome
            }
        }
    except ValueError:
        return JSONResponse(
            status_code=400,
            content={"error": f"Invalid scenario: {scenario_id}"}
        )


FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="static-assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = FRONTEND_DIST / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_DIST / "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.app_env == "development"
    )
