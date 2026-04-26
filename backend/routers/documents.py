"""
routers/documents.py - Document upload and management endpoints.
"""

import io
import logging
import os
import tempfile
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from pydantic import BaseModel
from pypdf import PdfReader
from slowapi import Limiter
from slowapi.util import get_remote_address
from supabase import Client, create_client
from pinecone import Pinecone

from utils.chat_history import delete_chat_messages_for_document
from utils.rag_pipeline import (
    delete_document_from_vectorstore,
    ingest_document,
    rename_document_in_vectorstore,
)

limiter = Limiter(key_func=get_remote_address)
logger = logging.getLogger("documents_router")
router = APIRouter()

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
PDF_MAGIC = b"%PDF-"
MAX_UPLOAD_PAGES = 200

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


def get_documents_table() -> str:
    return os.getenv("DOCUMENTS_TABLE", "lr_documents")


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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


def build_public_url(storage_path: Optional[str]) -> Optional[str]:
    if not storage_path:
        return None
    try:
        return get_supabase().storage.from_(get_bucket()).get_public_url(storage_path)
    except Exception as exc:
        logger.warning("[Documents] Failed to build public URL for %s: %s", storage_path, exc)
        return None


def normalize_document_row(row: dict[str, Any]) -> dict[str, Any]:
    uploaded_at = row.get("uploaded_at")
    if isinstance(uploaded_at, datetime):
        uploaded_at = uploaded_at.isoformat()
    elif uploaded_at is None:
        uploaded_at = utc_now_iso()
    else:
        uploaded_at = str(uploaded_at)

    storage_path = row.get("storage_path")
    public_url = row.get("public_url") or build_public_url(storage_path)

    return {
        "id": str(row.get("id", "")),
        "name": row.get("name", ""),
        "size_bytes": int(row.get("size_bytes", 0) or 0),
        "chunk_count": int(row.get("chunk_count", 0) or 0),
        "status": row.get("status", "ready"),
        "uploaded_at": uploaded_at,
        "storage_path": storage_path,
        "public_url": public_url,
        "error_message": row.get("error_message"),
    }


def load_documents() -> list[dict[str, Any]]:
    try:
        response = (
            get_supabase()
            .table(get_documents_table())
            .select("*")
            .order("uploaded_at", desc=True)
            .execute()
        )
        rows = response.data or []
        logger.info("[Documents] Loaded %d rows from %s", len(rows), get_documents_table())
        return [normalize_document_row(row) for row in rows]
    except Exception as exc:
        logger.warning("[Documents] Failed to load %s: %s", get_documents_table(), exc)
        return []


def upsert_documents(documents: list[dict[str, Any]]) -> None:
    if not documents:
        return
    payload = [normalize_document_row(doc) for doc in documents]
    get_supabase().table(get_documents_table()).upsert(payload).execute()
    logger.info("[Documents] Upserted %d rows into %s", len(payload), get_documents_table())


def delete_document_record(document_id: str) -> None:
    get_supabase().table(get_documents_table()).delete().eq("id", document_id).execute()


def list_storage_documents() -> list[dict[str, Any]]:
    sb = get_supabase()
    bucket = get_bucket()
    entries = sb.storage.from_(bucket).list()
    docs: list[dict[str, Any]] = []

    for entry in entries:
        name = entry.get("name", "")
        if not name:
            continue

        is_folder = entry.get("id") is None
        if is_folder:
            try:
                nested_entries = sb.storage.from_(bucket).list(name)
            except Exception as exc:
                logger.warning("[Documents] Failed to list nested path %s: %s", name, exc)
                continue

            pdf_entry = next(
                (item for item in nested_entries if item.get("name", "").lower().endswith(".pdf")),
                None,
            )
            if pdf_entry is None:
                continue

            real_name = pdf_entry.get("name", f"{name}.pdf")
            storage_path = f"{name}/{real_name}"
            size_bytes = int((pdf_entry.get("metadata") or {}).get("size", 0) or 0)
            document_id = name
        elif name.lower().endswith(".pdf"):
            real_name = name
            storage_path = name
            size_bytes = int((entry.get("metadata") or {}).get("size", 0) or 0)
            document_id = name[:-4]
        else:
            continue

        docs.append({
            "id": document_id,
            "name": real_name,
            "size_bytes": size_bytes,
            "storage_path": storage_path,
            "public_url": build_public_url(storage_path),
        })

    return docs


def sync_documents_with_storage(documents: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Reconcile the lr_documents table against the storage bucket.
    This keeps manual bucket uploads visible in the API.
    """
    try:
        storage_docs = list_storage_documents()
        storage_by_id = {doc["id"]: doc for doc in storage_docs}
        storage_paths = {doc["storage_path"] for doc in storage_docs}

        valid_documents: list[dict[str, Any]] = []
        removed_ids: list[str] = []

        for doc in documents:
            storage_match = storage_by_id.get(doc["id"])
            storage_path = doc.get("storage_path")

            if storage_match or storage_path in storage_paths:
                if storage_match:
                    doc["name"] = storage_match["name"]
                    doc["size_bytes"] = storage_match["size_bytes"]
                    doc["storage_path"] = storage_match["storage_path"]
                    doc["public_url"] = storage_match["public_url"]
                valid_documents.append(normalize_document_row(doc))
            else:
                removed_ids.append(doc["id"])
                logger.info("[Sync] Removing orphaned row for %s", doc["id"])

        registered_ids = {doc["id"] for doc in valid_documents}
        new_entries: list[dict[str, Any]] = []

        for storage_doc in storage_docs:
            if storage_doc["id"] in registered_ids:
                continue
            new_entries.append({
                "id": storage_doc["id"],
                "name": storage_doc["name"],
                "size_bytes": storage_doc["size_bytes"],
                "chunk_count": 0,
                "status": "ready",
                "uploaded_at": utc_now_iso(),
                "storage_path": storage_doc["storage_path"],
                "public_url": storage_doc["public_url"],
                "error_message": None,
            })
            logger.info("[Sync] Auto-registered %s", storage_doc["storage_path"])

        if removed_ids:
            get_supabase().table(get_documents_table()).delete().in_("id", removed_ids).execute()

        merged = valid_documents + new_entries
        if new_entries or removed_ids:
            upsert_documents(merged)

        return sorted(merged, key=lambda doc: doc["uploaded_at"], reverse=True)
    except Exception as exc:
        logger.warning("[Sync] Storage sync warning: %s", exc)
        return documents


def verify_upload_token(token: str) -> bool:
    try:
        result = (
            get_supabase()
            .table("token")
            .select("id")
            .eq("value", token)
            .eq("active", True)
            .limit(1)
            .execute()
        )
        return bool(result.data)
    except Exception as exc:
        logger.error("[Token] Verification error: %s", exc)
        return False


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


class RenameDocumentRequest(BaseModel):
    name: str
    upload_token: str


@router.post("/verify-token")
@limiter.limit("10/minute")
async def verify_token(request: Request, token: str):
    _ = request
    if not token or len(token) > 256:
        raise HTTPException(status_code=400, detail="Invalid token.")
    valid = verify_upload_token(token)
    if not valid:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    return {"valid": True}


@router.post("/upload", response_model=UploadResponse)
@limiter.limit("10/minute")
async def upload_document(request: Request, file: UploadFile = File(...), upload_token: str = ""):
    _ = request

    if not upload_token or not verify_upload_token(upload_token):
        raise HTTPException(status_code=401, detail="Valid upload token required.")

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
    safe_filename = os.path.basename(file.filename)
    storage_path = f"{document_id}/{safe_filename}"

    try:
        get_supabase().storage.from_(get_bucket()).upload(
            storage_path,
            file_content,
            {"content-type": "application/pdf"},
        )
        logger.info("[Upload] Uploaded %s", storage_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to upload to Supabase: {exc}") from exc

    doc_record = {
        "id": document_id,
        "name": safe_filename,
        "size_bytes": file_size,
        "chunk_count": 0,
        "status": "processing",
        "uploaded_at": utc_now_iso(),
        "storage_path": storage_path,
        "public_url": build_public_url(storage_path),
        "error_message": None,
    }

    tmp_path = None
    extraction_method = "text"
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(file_content)
            tmp_path = tmp.name

        chunk_count, ingest_quality = ingest_document(
            pdf_path=tmp_path,
            document_id=document_id,
            document_name=safe_filename,
        )
        extraction_method = str(ingest_quality.get("extraction_method", "text"))
        doc_record["chunk_count"] = chunk_count
        doc_record["status"] = "ready"
        logger.info(
            "[Upload] Ingestion complete for %s: %d chunks via %s",
            document_id,
            chunk_count,
            extraction_method,
        )
    except Exception as exc:
        doc_record["status"] = "error"
        doc_record["error_message"] = str(exc)
        logger.warning("[Upload] Ingestion failed for %s: %s", document_id, exc)
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)

    upsert_documents([doc_record])

    return UploadResponse(
        success=doc_record["status"] == "ready",
        document=DocumentResponse(**normalize_document_row(doc_record)),
        message=(
            f"Document processed into {doc_record['chunk_count']} chunks via {extraction_method}"
            if doc_record["status"] == "ready"
            else f"Processing failed: {doc_record['error_message']}"
        ),
    )


@router.get("/", response_model=list[DocumentResponse])
async def list_documents():
    documents = load_documents()
    documents = sync_documents_with_storage(documents)
    return [DocumentResponse(**doc) for doc in documents]


@router.patch("/{document_id}/rename", response_model=DocumentResponse)
@limiter.limit("10/minute")
async def rename_document(request: Request, document_id: str, body: RenameDocumentRequest):
    _ = request

    if not body.upload_token or not verify_upload_token(body.upload_token):
        raise HTTPException(status_code=401, detail="Valid upload token required.")

    new_name = os.path.basename(body.name.strip())
    if not new_name:
        raise HTTPException(status_code=400, detail="Document name cannot be empty.")
    if len(new_name) > 180:
        raise HTTPException(status_code=400, detail="Document name is too long.")
    if not new_name.lower().endswith(".pdf"):
        new_name = f"{new_name}.pdf"

    documents = load_documents()
    doc_to_rename = next((doc for doc in documents if doc["id"] == document_id), None)
    if not doc_to_rename:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc_to_rename["name"] == new_name:
        return DocumentResponse(**normalize_document_row(doc_to_rename))

    storage_path = doc_to_rename.get("storage_path")
    if storage_path:
        new_storage_path = f"{document_id}/{new_name}"
        try:
            get_supabase().storage.from_(get_bucket()).move(storage_path, new_storage_path)
            doc_to_rename["storage_path"] = new_storage_path
            doc_to_rename["public_url"] = build_public_url(new_storage_path)
            logger.info("[Rename] Moved storage object %s -> %s", storage_path, new_storage_path)
        except Exception as exc:
            logger.warning("[Rename] Storage move failed for %s: %s", storage_path, exc)

    doc_to_rename["name"] = new_name
    get_supabase().table(get_documents_table()).update({
        "name": new_name,
        "storage_path": doc_to_rename.get("storage_path"),
        "public_url": doc_to_rename.get("public_url"),
    }).eq("id", document_id).execute()
    rename_document_in_vectorstore(
        document_id=document_id,
        document_name=new_name,
        chunk_count=int(doc_to_rename.get("chunk_count", 0) or 0),
    )

    return DocumentResponse(**normalize_document_row(doc_to_rename))


@router.post("/register")
async def register_document(
    id: str,
    name: str,
    size_bytes: int = 0,
    chunk_count: int = 0,
    storage_path: Optional[str] = None,
    public_url: Optional[str] = None,
):
    documents = load_documents()
    if any(doc["id"] == id for doc in documents):
        raise HTTPException(status_code=409, detail=f"Document '{id}' is already registered.")

    new_doc = {
        "id": id,
        "name": name,
        "size_bytes": size_bytes,
        "chunk_count": chunk_count,
        "status": "ready",
        "uploaded_at": utc_now_iso(),
        "storage_path": storage_path or f"{id}.pdf",
        "public_url": public_url or build_public_url(storage_path or f"{id}.pdf"),
        "error_message": None,
    }
    upsert_documents([new_doc])

    return {
        "success": True,
        "message": f"Document '{name}' registered successfully",
        "document": normalize_document_row(new_doc),
    }


@router.post("/refresh-chunks")
async def refresh_chunk_counts():

    try:
        pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
        index = pc.Index(os.getenv("PINECONE_INDEX", "docuquery"))

        documents = load_documents()
        updated = 0

        for doc in documents:
            try:
                results = index.query(
                    vector=[0] * 384,
                    top_k=10000,
                    namespace=doc["id"],
                    include_metadata=False,
                )
                actual_chunk_count = len(results.get("matches", []))
                if actual_chunk_count > 0 and doc["chunk_count"] != actual_chunk_count:
                    doc["chunk_count"] = actual_chunk_count
                    updated += 1
                    logger.info("[Refresh] Updated %s: %d chunks", doc["name"], actual_chunk_count)
            except Exception as exc:
                logger.warning("[Refresh] Warning querying %s: %s", doc["id"], exc)

        if updated > 0:
            upsert_documents(documents)

        return {
            "updated": updated,
            "total": len(documents),
            "message": f"Updated chunk counts for {updated}/{len(documents)} documents",
        }
    except Exception as exc:
        logger.error("[Refresh] Error: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to refresh chunk counts: {exc}") from exc


@router.delete("/{document_id}")
async def delete_document(document_id: str):
    documents = load_documents()
    doc_to_delete = next((doc for doc in documents if doc["id"] == document_id), None)
    if not doc_to_delete:
        raise HTTPException(status_code=404, detail="Document not found")

    storage_path = doc_to_delete.get("storage_path")
    if storage_path:
        try:
            get_supabase().storage.from_(get_bucket()).remove([storage_path])
            logger.info("[Delete] Removed %s from storage", storage_path)
        except Exception as exc:
            logger.warning("[Delete] Could not remove %s from storage: %s", storage_path, exc)

    delete_document_from_vectorstore(document_id)
    delete_chat_messages_for_document(document_id)
    delete_document_record(document_id)

    return {"success": True, "message": f"Document '{doc_to_delete['name']}' deleted"}
