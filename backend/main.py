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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",   # Next.js dev server
        "http://localhost:3001",   # Alternative port
        "https://*.vercel.app",    # Vercel deployment
    ],
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
