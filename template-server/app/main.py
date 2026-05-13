# main.py — FastAPI application entry point
# Sets up logging, verifies Supabase connection on startup, registers all routes

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import supabase
from app.routers import webhook, api


# --- Logging setup ---
# DEBUG in development so we can see all webhook payloads; INFO in production
log_level = logging.DEBUG if settings.environment == "development" else logging.INFO
logging.basicConfig(
    level=log_level,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# --- Lifespan: runs once on startup and shutdown ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: verify Supabase is reachable
    logger.info("[OK] Starting AI Receptionist server...")
    if supabase is not None:
        try:
            # A lightweight query to confirm the connection works
            supabase.table("call_logs").select("id").limit(1).execute()
            logger.info("[OK] Supabase connection verified")
        except Exception as e:
            logger.warning("[WARN] Supabase connection check failed: %s", str(e))
            logger.warning("[WARN] Check SUPABASE_URL and SUPABASE_KEY in .env")
    else:
        logger.warning("[WARN] Supabase not configured — add credentials to .env")

    yield  # Server runs here

    # Shutdown
    logger.info("[OK] Server shutting down")


# --- App ---
app = FastAPI(
    title="AI Receptionist",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow all origins in development (restrict in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Routes ---
app.include_router(webhook.router)
app.include_router(api.router, prefix="/api")


# --- Health check ---
@app.get("/health")
async def health():
    return {"status": "ok", "environment": settings.environment}
