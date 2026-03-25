"""
routers/documents.py — Document Upload & Management Endpoints
==============================================================
This file defines the API endpoints for:
  POST   /api/documents/upload   — Upload a PDF and run ingestion
  GET    /api/documents/         — List all uploaded documents (auto-syncs with Supabase)
  DELETE /api/documents/{id}     — Delete a document

Storage:
  - PDF files  → Supabase Storage (bucket: SUPABASE_BUCKET, default: "documents")
  - Metadata   → Supabase Storage as metadata.json
  - Vectors    → Pinecone (handled by rag_pipeline.py)

KEY FIX:
  GET /api/documents/ now auto-discovers any PDF in Supabase Storage that is
  not yet registered in metadata.json and adds it automatically.
  This means manually uploaded PDFs will appear without any extra steps.
"""

import os
import uuid
import json
import tempfile
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from supabase import create_client, Client

from utils.rag_pipeline import ingest_document, delete_document_from_vectorstore
from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request

limiter = Limiter(key_func=get_remote_address)

# ─── Router ───────────────────────────────────────────────────────────────────
router = APIRouter()

# ─── Supabase Client (singleton) ─────────────────────────────────────────────
_supabase: Optional[Client] = None

def get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in your .env file.")
        _supabase = create_client(url, key)
    return _supabase


def get_bucket() -> str:
    return os.getenv("SUPABASE_BUCKET", "documents")


# ─── Metadata helpers ─────────────────────────────────────────────────────────
METADATA_PATH = "metadata.json"


def load_metadata() -> list[dict]:
    """
    Load metadata ONLY from Supabase Storage.
    No local fallback to ensure Vercel compatibility.
    """
    try:
        sb = get_supabase()
        response = sb.storage.from_(get_bucket()).download(METADATA_PATH)
        data = json.loads(response.decode("utf-8"))
        print(f"[Metadata] Loaded {len(data)} documents from Supabase Storage")
        return data
    except Exception as e:
        print(f"[Metadata] Could not load from Supabase (might be first run): {e}")
        return []


def save_metadata(documents: list[dict]) -> None:
    """
    Save metadata ONLY to Supabase Storage (upsert).
    No local files are created to ensure Vercel compatibility.
    """
    json_str = json.dumps(documents, indent=2, default=str)
    data_bytes = json_str.encode("utf-8")

    try:
        sb = get_supabase()
        sb.storage.from_(get_bucket()).upload(
            METADATA_PATH,
            data_bytes,
            {"content-type": "application/json", "upsert": "true"},
        )
        print(f"[Metadata] Saved {len(documents)} documents to Supabase Storage")
    except Exception as e:
        print(f"[Metadata] Supabase save error: {e}")


def sync_metadata_with_storage(documents: list[dict]) -> list[dict]:
    """
    Two-way sync between metadata.json and Supabase Storage:

    1. ADD — discover PDFs in Supabase not yet in metadata and register them.
    2. REMOVE — drop metadata entries whose file no longer exists in Supabase.

    This ensures the document panel always matches reality — no ghost entries
    from files deleted directly in Supabase or from failed/partial uploads.
    """
    try:
        sb = get_supabase()
        bucket = get_bucket()
        files = sb.storage.from_(bucket).list()

        # Build set of all storage paths actually present in Supabase right now
        existing_paths: set[str] = set()
        for f in files:
            fname = f.get("name", "")
            if fname and fname != METADATA_PATH:
                existing_paths.add(fname)
                # Also handle folder-style paths (uuid/filename.pdf)
                # by listing inside folder entries (id is None for folders)
                if f.get("id") is None:
                    try:
                        sub = sb.storage.from_(bucket).list(fname)
                        for sf in sub:
                            sname = sf.get("name", "")
                            if sname.lower().endswith(".pdf"):
                                existing_paths.add(f"{fname}/{sname}")
                    except Exception:
                        pass

        # ── REMOVE: drop metadata entries with no matching file in Supabase ──
        before = len(documents)
        valid_documents = []
        for doc in documents:
            storage_path = doc.get("storage_path", f"{doc['id']}.pdf")
            if storage_path in existing_paths:
                valid_documents.append(doc)
            else:
                print(f"[Sync] Removing orphaned entry: {doc.get('name')} "
                      f"(storage_path={storage_path} not found in Supabase)")
        removed = before - len(valid_documents)
        if removed:
            print(f"[Sync] Removed {removed} orphaned metadata entries")

        # ── ADD: discover PDFs in Supabase not yet in metadata ───────────────
        registered = {d.get("storage_path", f"{d['id']}.pdf") for d in valid_documents}
        new_entries = []

        for f in files:
            fname = f.get("name", "")
            if not fname or fname == METADATA_PATH:
                continue

            is_folder = f.get("id") is None

            if is_folder:
                # New format: uuid/filename.pdf
                try:
                    sub = sb.storage.from_(bucket).list(fname)
                    pdf_files = [sf for sf in sub if sf.get("name", "").lower().endswith(".pdf")]
                    if not pdf_files:
                        continue
                    pdf_file = pdf_files[0]
                    real_name = pdf_file.get("name", fname + ".pdf")
                    full_path = f"{fname}/{real_name}"
                    doc_id = fname
                    size_bytes = int((pdf_file.get("metadata") or {}).get("size", 0))
                except Exception:
                    continue
            elif fname.lower().endswith(".pdf"):
                # Legacy flat format: uuid.pdf
                full_path = fname
                doc_id = fname.replace(".pdf", "")
                real_name = fname
                size_bytes = int((f.get("metadata") or {}).get("size", 0))
            else:
                continue

            if full_path in registered:
                continue

            try:
                public_url = sb.storage.from_(bucket).get_public_url(full_path)
            except Exception:
                public_url = None

            new_doc = {
                "id": doc_id,
                "name": real_name,
                "size_bytes": size_bytes,
                "chunk_count": 0,
                "status": "ready",
                "uploaded_at": datetime.now().isoformat(),
                "storage_path": full_path,
                "public_url": public_url,
                "error_message": None,
            }
            new_entries.append(new_doc)
            print(f"[Sync] Auto-registered: {full_path}")

        if new_entries:
            valid_documents = valid_documents + new_entries
            print(f"[Sync] Added {len(new_entries)} previously unregistered document(s)")

        # Save if anything changed
        if removed or new_entries:
            save_metadata(valid_documents)

        return valid_documents

    except Exception as e:
        print(f"[Sync] Storage sync warning: {e}")
        return documents


# ─── Response Models ──────────────────────────────────────────────────────────
class DocumentResponse(BaseModel):
    id: str
    name: str
    size_bytes: int
    chunk_count: int
    status: str
    uploaded_at: str
    storage_path: Optional[str] = None
    public_url: Optional[str] = None
    error_message: Optional[str] = None


class UploadResponse(BaseModel):
    success: bool
    document: DocumentResponse
    message: str


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=UploadResponse)
@limiter.limit("10/minute")  # 10 uploads per minute per IP
async def upload_document(request: Request, file: UploadFile = File(...)):
    """Upload a PDF, ingest into Pinecone, and register in metadata."""

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    file_content = await file.read()
    file_size = len(file_content)
    document_id = str(uuid.uuid4())
    storage_path = f"{document_id}.pdf"

    safe_filename = os.path.basename(file.filename)
    storage_path = f"{document_id}/{safe_filename}"

    sb = get_supabase()
    bucket = get_bucket()

    # Upload PDF to Supabase Storage
    try:
        sb.storage.from_(bucket).upload(
            storage_path,
            file_content,
            {"content-type": "application/pdf"},
        )
        print(f"[Upload] PDF uploaded to Supabase Storage: {storage_path}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload to Supabase: {str(e)}")

    try:
        public_url = sb.storage.from_(bucket).get_public_url(storage_path)
    except Exception:
        public_url = None

    doc_record = {
        "id": document_id,
        "name": file.filename,
        "size_bytes": file_size,
        "chunk_count": 0,
        "status": "processing",
        "uploaded_at": datetime.now().isoformat(),
        "storage_path": storage_path,
        "public_url": public_url,
        "error_message": None,
    }

    documents = load_metadata()
    documents.append(doc_record)
    save_metadata(documents)

    # Run RAG ingestion via temp file
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(file_content)
            tmp_path = tmp.name

        chunk_count = ingest_document(
            pdf_path=tmp_path,
            document_id=document_id,
            document_name=file.filename,
        )
        doc_record["chunk_count"] = chunk_count
        doc_record["status"] = "ready"

    except Exception as e:
        error_msg = str(e)
        print(f"[Upload] Ingestion failed: {error_msg}")
        doc_record["status"] = "error"
        doc_record["error_message"] = error_msg

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)

    # Update metadata with final status
    documents = load_metadata()
    for i, doc in enumerate(documents):
        if doc["id"] == document_id:
            documents[i] = doc_record
            break
    save_metadata(documents)

    return UploadResponse(
        success=doc_record["status"] == "ready",
        document=DocumentResponse(**doc_record),
        message=(
            f"Document processed into {doc_record['chunk_count']} chunks"
            if doc_record["status"] == "ready"
            else f"Processing failed: {doc_record['error_message']}"
        ),
    )


@router.get("/", response_model=list[DocumentResponse])
async def list_documents():
    """
    Return all uploaded documents.

    KEY BEHAVIOUR: Automatically syncs with Supabase Storage to detect any
    PDFs that were uploaded manually (not through /upload). This means
    manually uploaded documents will appear here without any extra steps.
    """
    documents = load_metadata()
    documents = sync_metadata_with_storage(documents)
    return [DocumentResponse(**doc) for doc in documents]


@router.post("/register")
async def register_document(
    id: str,
    name: str,
    size_bytes: int = 0,
    chunk_count: int = 0,
    storage_path: Optional[str] = None,
    public_url: Optional[str] = None,
):
    """
    Manually register a document that exists in Supabase/Pinecone but is
    missing from metadata.json. Useful for documents uploaded outside the app.
    """
    documents = load_metadata()

    if any(d["id"] == id for d in documents):
        raise HTTPException(status_code=409, detail=f"Document '{id}' is already registered.")

    new_doc = {
        "id": id,
        "name": name,
        "size_bytes": size_bytes,
        "chunk_count": chunk_count,
        "status": "ready",
        "uploaded_at": datetime.now().isoformat(),
        "storage_path": storage_path or f"{id}.pdf",
        "public_url": public_url,
        "error_message": None,
    }

    documents.append(new_doc)
    save_metadata(documents)

    return {"success": True, "message": f"Document '{name}' registered successfully", "document": new_doc}


@router.delete("/{document_id}")
async def delete_document(document_id: str):
    """
    Delete a document from Supabase Storage, Pinecone, and metadata.

    Also handles ghost entries — documents still in metadata.json but whose
    file was already manually deleted from Supabase. These are cleaned up
    from metadata + Pinecone even if the Supabase file is already gone.
    """
    documents = load_metadata()
    doc_to_delete = next((d for d in documents if d["id"] == document_id), None)

    if not doc_to_delete:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete PDF from Supabase Storage (best-effort — file may already be gone)
    storage_path = doc_to_delete.get("storage_path")
    if storage_path:
        try:
            sb = get_supabase()
            sb.storage.from_(get_bucket()).remove([storage_path])
            print(f"[Delete] Removed from Supabase Storage: {storage_path}")
        except Exception as e:
            # File may already be manually deleted — that's fine, keep going
            print(f"[Delete] Supabase file already gone or error (continuing): {e}")

    # Delete vectors from Pinecone (best-effort)
    try:
        delete_document_from_vectorstore(document_id)
    except Exception as e:
        print(f"[Delete] Pinecone cleanup warning: {e}")

    # Always remove from metadata regardless of Supabase/Pinecone outcome
    documents = [d for d in documents if d["id"] != document_id]
    save_metadata(documents)

    return {"success": True, "message": f"Document '{doc_to_delete['name']}' deleted"}
