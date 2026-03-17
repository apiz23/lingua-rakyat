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

# Load environment variables from .env file
# This must be called before importing anything that reads env vars
load_dotenv()

# Import our routers (defined in the routers/ folder)
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
# running on localhost:3000 to make requests to this backend on localhost:8000.
# Without this, the browser will block all requests.

# Get allowed origins from environment or use defaults
allowed_origins = os.getenv("ALLOWED_ORIGINS", "").split(",") if os.getenv("ALLOWED_ORIGINS") else [
    "http://localhost:3000",      # Next.js dev server
    "http://localhost:3001",      # Alternative port
    "http://localhost:3000/",
    "http://localhost:3001/",
]

# Add Vercel frontend URL if deployed
vercel_url = os.getenv("VERCEL_URL")
if vercel_url:
    allowed_origins.append(f"https://{vercel_url}")
    allowed_origins.append(f"http://{vercel_url}")

# Add any custom frontend URLs
custom_frontend_url = os.getenv("FRONTEND_URL")
if custom_frontend_url:
    allowed_origins.append(custom_frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],           # Allow GET, POST, DELETE, etc.
    allow_headers=["*"],           # Allow all headers
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
        "message": "Civic Assist AI backend is running",
        "docs": "Visit /docs for the interactive API documentation",
    }
