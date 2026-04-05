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
import io
import tempfile
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from pypdf import PdfReader
from supabase import create_client, Client

from utils.chat_history import delete_chat_messages_for_document
from utils.rag_pipeline import ingest_document, delete_document_from_vectorstore
from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request

limiter = Limiter(key_func=get_remote_address)

# ─── Router ───────────────────────────────────────────────────────────────────
router = APIRouter()

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
PDF_MAGIC = b"%PDF-"
MAX_UPLOAD_PAGES = 200

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


def validate_uploaded_pdf_bytes(file_content: bytes) -> None:
    if not file_content.startswith(PDF_MAGIC):
        raise HTTPException(status_code=400, detail="Invalid PDF file.")

    try:
        reader = PdfReader(io.BytesIO(file_content))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unreadable PDF file: {exc}") from exc

    if reader.is_encrypted:
        raise HTTPException(status_code=400, detail="Encrypted PDF files are not supported.")

    page_count = len(reader.pages)
    if page_count < 1:
        raise HTTPException(status_code=400, detail="PDF has no pages.")
    if page_count > MAX_UPLOAD_PAGES:
        raise HTTPException(
            status_code=400,
            detail=f"PDF has too many pages. Maximum allowed is {MAX_UPLOAD_PAGES}.",
        )


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
    Auto-discover any PDFs in Supabase Storage that are NOT yet in metadata.json
    and register them automatically with status 'ready'.

    This fixes the issue where manually uploaded PDFs don't appear in the list.
    Returns the updated (possibly extended) documents list.
    """
    try:
        sb = get_supabase()
        bucket = get_bucket()
        files = sb.storage.from_(bucket).list()

        # Build set of paths AND ids already registered
        # Use BOTH to avoid re-registering a doc that changed path format
        registered_paths = {d.get("storage_path", f"{d['id']}.pdf") for d in documents}
        registered_ids   = {d["id"] for d in documents}

        # ── REMOVE orphaned entries ──────────────────────────────────────────
        # Build the full set of paths actually in Supabase right now
        existing_paths: set[str] = set()
        for f in files:
            fname = f.get("name", "")
            if not fname or fname == METADATA_PATH:
                continue
            existing_paths.add(fname)
            # Check inside folder entries for uuid/filename.pdf format
            if f.get("id") is None:
                try:
                    sub = sb.storage.from_(bucket).list(fname)
                    for sf in sub:
                        sname = sf.get("name", "")
                        if sname.lower().endswith(".pdf"):
                            existing_paths.add(f"{fname}/{sname}")
                except Exception:
                    pass

        before = len(documents)
        valid_documents = []
        for doc in documents:
            sp = doc.get("storage_path", f"{doc['id']}.pdf")
            if sp in existing_paths:
                valid_documents.append(doc)
            else:
                print(f"[Sync] Removing orphaned entry: {doc.get('name')} "
                      f"(storage_path={sp} not in Supabase)")
        removed = before - len(valid_documents)

        # Rebuild registered sets from the cleaned list
        registered_paths = {d.get("storage_path", f"{d['id']}.pdf") for d in valid_documents}
        registered_ids   = {d["id"] for d in valid_documents}

        # ── ADD new files from Supabase not yet in metadata ──────────────────
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
                    pdfs = [sf for sf in sub if sf.get("name","").lower().endswith(".pdf")]
                    if not pdfs:
                        continue
                    pdf_file  = pdfs[0]
                    real_name = pdf_file.get("name", fname + ".pdf")
                    full_path = f"{fname}/{real_name}"
                    doc_id    = fname
                    size_bytes = int((pdf_file.get("metadata") or {}).get("size", 0))
                except Exception:
                    continue
            elif fname.lower().endswith(".pdf"):
                # Legacy flat format: uuid.pdf
                full_path  = fname
                doc_id     = fname.replace(".pdf", "")
                real_name  = fname
                size_bytes = int((f.get("metadata") or {}).get("size", 0))
            else:
                continue

            # Skip if already registered by path OR by document ID
            if full_path in registered_paths or doc_id in registered_ids:
                continue

            new_doc = {
                "id":           doc_id,
                "name":         real_name,
                "size_bytes":   size_bytes,
                "chunk_count":  0,
                "status":       "ready",
                "uploaded_at":  datetime.now().isoformat(),
                "storage_path": full_path,
                "public_url":   None,
                "error_message": None,
            }
            new_entries.append(new_doc)
            print(f"[Sync] Auto-registered: {full_path} as {real_name!r}")

        if new_entries:
            valid_documents = valid_documents + new_entries

        # Save only if something changed
        if removed or new_entries:
            save_metadata(valid_documents)
            print(f"[Sync] Done — removed {removed}, added {len(new_entries)}")

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
    if file.content_type and file.content_type not in {"application/pdf", "application/x-pdf"}:
        raise HTTPException(status_code=400, detail="Uploaded file must be a PDF.")

    file_content = await file.read()
    file_size = len(file_content)
    if file_size > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum upload size is 5 MB.")
    validate_uploaded_pdf_bytes(file_content)

    document_id = str(uuid.uuid4())
    safe_filename = os.path.basename(file.filename)  # strip path traversal
    storage_path = f"{document_id}/{safe_filename}"  # uuid/name.pdf keeps real name in Supabase

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

    doc_record = {
        "id": document_id,
        "name": safe_filename,
        "size_bytes": file_size,
        "chunk_count": 0,
        "status": "processing",
        "uploaded_at": datetime.now().isoformat(),
        "storage_path": storage_path,
        "public_url": None,
        "error_message": None,
    }

    # Run RAG ingestion via temp file BEFORE saving metadata.
    # This ensures we save the real chunk_count in one atomic write,
    # instead of saving chunk_count=0 first and updating later.
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(file_content)
            tmp_path = tmp.name

        chunk_count = ingest_document(
            pdf_path=tmp_path,
            document_id=document_id,
            document_name=safe_filename,
        )
        doc_record["chunk_count"] = chunk_count
        doc_record["status"] = "ready"
        print(f"[Upload] Ingestion complete: {chunk_count} chunks")

    except Exception as e:
        error_msg = str(e)
        print(f"[Upload] Ingestion failed: {error_msg}")
        doc_record["status"] = "error"
        doc_record["error_message"] = error_msg

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)

    # Save metadata ONCE with the final status and real chunk_count
    documents = load_metadata()
    # Remove any partial entry for this doc (in case of retry)
    documents = [d for d in documents if d["id"] != document_id]
    documents.append(doc_record)
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


@router.post("/refresh-chunks")
async def refresh_chunk_counts():
    """
    Refresh chunk counts for all documents by querying Pinecone.
    Fixes documents that show chunk_count=0 because they were auto-discovered
    from Supabase Storage but never had their vectors counted.
    
    Returns: {updated: int, total: int, message: str}
    """
    from pinecone import Pinecone
    
    try:
        # Initialize Pinecone
        pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
        index = pc.Index(os.getenv("PINECONE_INDEX", "docuquery"))
        
        documents = load_metadata()
        updated = 0
        
        for doc in documents:
            doc_id = doc["id"]
            try:
                # Query Pinecone for vector count in this document's namespace
                # Use a dummy query to get stats about the namespace
                results = index.query(
                    vector=[0] * 384,  # dummy vector (Cohere embeddings are 384-dim)
                    top_k=10000,  # get max results to count
                    namespace=doc_id,
                    include_metadata=False
                )
                
                actual_chunk_count = len(results.get("matches", []))
                
                # Only update if the count changed and is non-zero
                if actual_chunk_count > 0 and doc["chunk_count"] != actual_chunk_count:
                    doc["chunk_count"] = actual_chunk_count
                    updated += 1
                    print(f"[Refresh] Updated {doc['name']}: {actual_chunk_count} chunks")
            except Exception as e:
                print(f"[Refresh] Warning querying {doc['id']}: {e}")
                # Continue with next document
        
        # Save updated metadata
        if updated > 0:
            save_metadata(documents)
            print(f"[Refresh] Saved {updated} updated documents")
        
        return {
            "updated": updated,
            "total": len(documents),
            "message": f"Updated chunk counts for {updated}/{len(documents)} documents"
        }
    
    except Exception as e:
        print(f"[Refresh] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to refresh chunk counts: {str(e)}")


@router.delete("/{document_id}")
async def delete_document(document_id: str):
    """Delete a document from Supabase Storage, Pinecone, and metadata."""
    documents = load_metadata()
    doc_to_delete = next((d for d in documents if d["id"] == document_id), None)

    if not doc_to_delete:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete PDF from Supabase Storage
    storage_path = doc_to_delete.get("storage_path")
    if storage_path:
        try:
            sb = get_supabase()
            sb.storage.from_(get_bucket()).remove([storage_path])
            print(f"[Delete] Removed from Supabase Storage: {storage_path}")
        except Exception as e:
            print(f"[Delete] Warning: Could not remove from Supabase Storage: {e}")

    # Delete vectors from Pinecone
    delete_document_from_vectorstore(document_id)
    delete_chat_messages_for_document(document_id)

    # Remove from metadata
    documents = [d for d in documents if d["id"] != document_id]
    save_metadata(documents)

    return {"success": True, "message": f"Document '{doc_to_delete['name']}' deleted"}
