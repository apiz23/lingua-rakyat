"""
main.py — FastAPI Application Entry Point
==========================================
Run with:  uvicorn main:app --reload --port 8000

Improvements in this version:
  - Structured logging (replaces bare print statements)
  - Global exception handler (returns clean JSON errors, never crashes)
  - Request/response logging middleware (latency per endpoint)
  - Cache stats exposed in health check
  - Startup banner with config summary
"""

import logging
import sys
import time
import os
import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

load_dotenv()

# ─── Rate Limiter ────────────────────────────────────────────────────────────
# Per-IP limits prevent abuse and show production-readiness to judges.
# Values are env-gated (see rate_limits.py): set BOOTH_MODE=true at a demo booth
# where all visitors share one public IP, otherwise buckets fill and judges 429.
from rate_limits import BOOTH_MODE, GLOBAL_DEFAULT

limiter = Limiter(key_func=get_remote_address, default_limits=[GLOBAL_DEFAULT])

# ─── Logging Setup ───────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stderr,
)
logger = logging.getLogger("main")
logger.info("Starting Lingua Rakyat backend (lightweight mode — Cohere + Groq)")
if BOOTH_MODE:
    logger.warning("[RateLimit] BOOTH_MODE=true — using generous demo limits (global=%s)", GLOBAL_DEFAULT)

# ─── Router imports ───────────────────────────────────────────────────────────
from routers.documents import router as documents_router
from routers.chat import router as chat_router
from routers.eval import router as eval_router
from routers.voice import router as voice_router
from routers.whatsapp import router as whatsapp_router
from routers.telegram import router as telegram_router
from routers.feedback import router as feedback_router
from routers.share import router as share_router

# ─── App instance ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="Lingua Rakyat — Multilingual RAG Backend",
    description=(
        "GovAssist AI: Upload government PDF documents and ask questions "
        "in Malay, English, or Chinese. Powered by RAG + Cohere multilingual embeddings."
    ),
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Attach rate limiter state and error handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# ─── CORS Configuration ───────────────────────────────────────────────────────
allowed_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "https://lingua-rakyat.vercel.app",
    "https://www.lingua-rakyat.vercel.app",
    "https://lingua-rakyat.my",
    "https://www.lingua-rakyat.my",
]

for env_key in ("VERCEL_URL", "FRONTEND_URL", "BACKEND_URL"):
    val = os.getenv(env_key)
    if val:
        allowed_origins.extend([f"https://{val}", f"http://{val}"])
        logger.info("[CORS] Added from env %s: %s", env_key, val)

allowed_origins = list(set(allowed_origins))
logger.info("[CORS] Allowed origins: %s", allowed_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# ─── Request Logging Middleware ───────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log every request with method, path, status code, and latency."""
    t0 = time.time()
    try:
        response = await call_next(request)
        latency_ms = round((time.time() - t0) * 1000)
        logger.info(
            "%s %s -> %d (%dms)",
            request.method, request.url.path, response.status_code, latency_ms,
        )
        return response
    except Exception as exc:
        latency_ms = round((time.time() - t0) * 1000)
        logger.error(
            "%s %s -> 500 (%dms) UNHANDLED: %s",
            request.method, request.url.path, latency_ms, exc,
        )
        raise

# ─── Global Exception Handler ─────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Catch any unhandled exception and return a clean JSON error response.
    Never exposes raw tracebacks to clients in production.
    """
    tb = traceback.format_exc()
    logger.error("[GlobalHandler] Unhandled exception on %s:\n%s", request.url.path, tb)

    debug_mode = os.getenv("DEBUG", "false").lower() == "true"
    detail = str(exc) if debug_mode else "An internal server error occurred."

    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_server_error",
            "detail": detail,
            "path": str(request.url.path),
        },
    )

# ─── Routers ─────────────────────────────────────────────────────────────────
app.include_router(documents_router, prefix="/api/documents", tags=["Documents"])
app.include_router(chat_router,      prefix="/api/chat",      tags=["Chat"])
app.include_router(eval_router,      prefix="/api/eval",      tags=["Evaluation"])
app.include_router(voice_router,     prefix="/api/voice",     tags=["Voice"])
app.include_router(whatsapp_router,  prefix="/api/whatsapp",  tags=["WhatsApp"])
app.include_router(telegram_router,  prefix="/api/telegram",  tags=["Telegram"])
app.include_router(feedback_router,  prefix="/api/feedback",  tags=["Feedback"])
app.include_router(share_router,     prefix="/api/share",     tags=["Share"])

# ─── Startup: Seed + Prewarm ──────────────────────────────────────────────────
# ─── Health Check ─────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
async def health_check():
    """Health check — returns server status, config summary, cache and eval stats."""
    from utils.rag_pipeline import _query_cache, CACHE_MAX_SIZE
    from routers.eval import _evaluator

    return {
        "status": "ok",
        "version": "2.0.0",
        "message": "Lingua Rakyat AI backend is running",
        "docs": "/docs",
        "config": {
            "llm_model":  os.getenv("GROQ_MODEL", "groq/compound"),
            "embeddings": "cohere/embed-multilingual-v3.0",
            "vector_db":  "pinecone/" + os.getenv("PINECONE_INDEX", "docuquery"),
            "booth_mode": BOOTH_MODE,
        },
        "cache": {
            "entries":  len(_query_cache),
            "max_size": CACHE_MAX_SIZE,
        },
        "evaluation": {
            "records": len(_evaluator),
        },
    }

# ─── CORS Preflight ───────────────────────────────────────────────────────────
@app.options("/{full_path:path}", tags=["Health"])
async def preflight_handler(full_path: str):
    return {"status": "ok"}
