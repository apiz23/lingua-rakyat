"""
startup.py — Preload models on server start
============================================
This script runs before the FastAPI app starts to preload embedding models
and other heavy dependencies, preventing timeouts on first request.
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

print("[Startup] Loading embedding model...")
try:
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer("BAAI/bge-m3")
    print("[Startup] ✓ Embedding model loaded successfully")
except Exception as e:
    print(f"[Startup] ✗ Failed to load embedding model: {e}", file=sys.stderr)
    sys.exit(1)

print("[Startup] Initializing Pinecone...")
try:
    from pinecone import Pinecone
    api_key = os.getenv("PINECONE_API_KEY")
    if api_key:
        pc = Pinecone(api_key=api_key)
        print("[Startup] ✓ Pinecone initialized successfully")
    else:
        print("[Startup] ⚠ PINECONE_API_KEY not set, skipping Pinecone init")
except Exception as e:
    print(f"[Startup] ✗ Failed to initialize Pinecone: {e}", file=sys.stderr)
    # Don't exit — Pinecone is optional for startup

print("[Startup] Initializing Supabase...")
try:
    from supabase import create_client
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if url and key:
        supabase = create_client(url, key)
        print("[Startup] ✓ Supabase initialized successfully")
    else:
        print("[Startup] ⚠ SUPABASE_URL or SUPABASE_KEY not set, skipping Supabase init")
except Exception as e:
    print(f"[Startup] ✗ Failed to initialize Supabase: {e}", file=sys.stderr)
    # Don't exit — Supabase is optional for startup

print("[Startup] ✓ All models preloaded successfully!")
print("[Startup] Starting FastAPI server...")
