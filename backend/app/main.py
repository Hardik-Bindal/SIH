import os
os.environ["OMP_NUM_THREADS"] = "1"

import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from app.routers import (  # noqa: E402
    health, incidents, search, analytics, forecast, recommendations, copilot, graph, bulletin, memory,
)

app = FastAPI(
    title="SIF Sentinel AI",
    description="AI-Powered Safety Intelligence Platform for SIF Prevention — Smart India Hackathon 2026",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (health, incidents, search, analytics, forecast, recommendations, copilot, graph, bulletin, memory):
    app.include_router(r.router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc):
    # NFR-06: a failure in one AI service must never blanket-fail the app;
    # surface a scoped error instead of a bare 500 traceback.
    return JSONResponse(status_code=500, content={"error": {"code": "INTERNAL_ERROR", "message": str(exc)}})


@app.on_event("startup")
def warm_up():
    from app.store import get_store
    from ml.pipeline.inference import get_engine
    get_store()
    get_engine()
    print("SIF Sentinel AI backend ready.")
