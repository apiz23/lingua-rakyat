"""
main.py — FastAPI Application Entry Point
==========================================
This is the starting point of the backend server.
Run it with:  uvicorn main:app --reload --port 8000

What this file does:
1. Creates the FastAPI app instance
2. Configures CORS so the Next.js frontend can talk to this backend
3. Registers all the API routers (document routes + chat routes)
4. Defines a simple health-check endpoint
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import sys

# Load environment variables from .env file
# This must be called before importing anything that reads env vars
load_dotenv()

# Lightweight version: no heavy model preloading needed
# Embeddings are handled by Groq API (no local models)
print("[Main] Lightweight mode: Using Groq API for embeddings", file=sys.stderr)

# Import our routers (defined in the routers/ folder)
# Use lightweight RAG pipeline
from routers.documents import router as documents_router
from routers.chat import router as chat_router

# ─── Create the FastAPI app ───────────────────────────────────────────────────

app = FastAPI(
    title="Civic AI — Multilingual RAG Backend",
    description="Upload government documents and ask questions in Malay or English.",
    version="1.0.0",
)

# ─── CORS Configuration ───────────────────────────────────────────────────────
# CORS (Cross-Origin Resource Sharing) allows the Next.js frontend
# to make requests to this backend without browser blocking.
# This configuration supports both local development and Vercel production.

# Start with local development URLs
allowed_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
]

# Add your Vercel frontend URL (MAIN FIX)
allowed_origins.extend([
    "https://lingua-rakyat.vercel.app",
    "https://www.lingua-rakyat.vercel.app",
])

# Add Vercel backend URL if deployed
vercel_url = os.getenv("VERCEL_URL")
if vercel_url:
    print(f"[CORS] Adding Vercel URL: {vercel_url}", file=sys.stderr)
    allowed_origins.extend([
        f"https://{vercel_url}",
        f"http://{vercel_url}",
    ])

# Add custom frontend URL from environment (if set)
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    print(f"[CORS] Adding custom frontend URL: {frontend_url}", file=sys.stderr)
    allowed_origins.append(frontend_url)

# Add custom backend URL from environment (if set)
backend_url = os.getenv("BACKEND_URL")
if backend_url:
    print(f"[CORS] Adding custom backend URL: {backend_url}", file=sys.stderr)
    allowed_origins.append(backend_url)

# Remove duplicates and log
allowed_origins = list(set(allowed_origins))
print(f"[CORS] Allowed origins: {allowed_origins}", file=sys.stderr)

# Apply CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],           # Allow GET, POST, DELETE, OPTIONS, etc.
    allow_headers=["*"],           # Allow all headers
    expose_headers=["*"],          # Expose all headers to frontend
    max_age=3600,                  # Cache preflight requests for 1 hour
)

# ─── Register Routers ─────────────────────────────────────────────────────────
# Each router handles a group of related endpoints.
# The prefix means all document endpoints start with /api/documents
# and all chat endpoints start with /api/chat.

app.include_router(documents_router, prefix="/api/documents", tags=["Documents"])
app.include_router(chat_router, prefix="/api/chat", tags=["Chat"])

# ─── Health Check ─────────────────────────────────────────────────────────────
# A simple endpoint to verify the server is running.
# Visit http://localhost:8000/ in your browser to check.

@app.get("/")
async def health_check():
    return {
        "status": "ok",
        "message": "Lingua Rakyat AI backend is running",
        "docs": "Visit /docs for the interactive API documentation",
    }

# ─── CORS Preflight Handler ───────────────────────────────────────────────────
# This handles OPTIONS requests that browsers send before actual requests
@app.options("/{full_path:path}")
async def preflight_handler(full_path: str):
    """Handle CORS preflight requests"""
    return {"status": "ok"}
