"""
routers/documents.py - Document upload and management endpoints.
"""

import io
import hashlib
import logging
import os
import tempfile
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Optional
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from pypdf import PdfReader
from slowapi import Limiter

from rate_limits import DOC_LIMIT, PDF_URL_LIMIT, SEED_LIMIT, get_proxy_aware_remote_address
from utils.auth import get_supabase
from utils.chat_history import delete_chat_messages_for_document
from utils.rag_pipeline import (
    delete_document_from_vectorstore,
    ingest_document,
    rename_document_in_vectorstore,
)

limiter = Limiter(key_func=get_proxy_aware_remote_address)
logger = logging.getLogger("documents_router")
router = APIRouter()

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
PDF_MAGIC = b"%PDF-"
MAX_UPLOAD_PAGES = 200

SAMPLE_DOCS_DIR = os.path.join(os.path.dirname(__file__), "..", "sample_docs")

# Pre-loaded government document library. Entries with a source_url are
# downloaded into sample_docs on first seed if the file is not shipped in the
# repo, so the library can grow without committing every PDF. Official URLs
# rot — when a download 404s the seed just skips that doc and logs it.
FEATURED_DOCS = [
    {
        "doc_id": "jpn-mykad-faq",
        "name": "MyKad FAQ (JPN)",
        "agency": "JPN",
        "filename": "MyKad_FAQ.pdf",
    },
    {
        "doc_id": "imigresen-passport",
        "name": "Malaysian Passport Guidelines",
        "agency": "IMIGRESEN",
        "filename": "malaysian_passport_guidelines.pdf",
    },
    {
        "doc_id": "imigresen-pasport-faq",
        "name": "Soalan Lazim Pasport (Imigresen)",
        "agency": "IMIGRESEN",
        "filename": "Imigresen_Pasport_FAQ.pdf",
        "source_url": "https://www.imi.gov.my/wp-content/uploads/2021/08/FAQ_H_19072021.pdf",
    },
    {
        "doc_id": "kwsp-ecaruman-faq",
        "name": "KWSP e-Caruman FAQ",
        "agency": "KWSP",
        "filename": "KWSP_eCaruman_FAQ.pdf",
        "source_url": "https://secure.kwsp.gov.my/e-caruman/download/SOALAN_LAZIM_e-Caruman_EN_as_at_19052017.pdf",
    },
    {
        "doc_id": "ptptn-mywaqaf-faq",
        "name": "Soalan Lazim myWaqafPTPTN",
        "agency": "PTPTN",
        "filename": "PTPTN_myWaqaf_FAQ.pdf",
        "source_url": "https://www.ptptn.gov.my/wp-content/uploads/2024/12/FINAL-SOALAN-LAZIM-FAQ-MYWAQAFPTPTN-_kemaskini-9-dis.pdf",
    },
]


def get_bucket() -> str:
    return os.getenv("SUPABASE_BUCKET", "documents")


def get_documents_table() -> str:
    return os.getenv("DOCUMENTS_TABLE", "lr_documents")


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class DocumentCatalogueUnavailable(RuntimeError):
    """The public document catalogue cannot be read right now."""


def _parse_iso_timestamp(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str) and value.strip():
        normalized = value.strip()
        if normalized.endswith("Z"):
            normalized = f"{normalized[:-1]}+00:00"
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError:
            return None
    else:
        return None
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        return None
    return parsed.astimezone(timezone.utc)


def is_catalogue_visible(row: dict[str, Any]) -> bool:
    """Whether a document row may appear in the public catalogue.

    Legacy rows predate the publication columns and carry no scope or
    publication status. They remain part of the public catalogue, preserving
    the deployed contract. Once a row carries the newer markers it must be
    explicitly public, published, ready and unexpired; anything else is hidden.
    This keeps private/draft revisions unreachable without requiring the
    unapplied publication migration.
    """
    if not isinstance(row, dict):
        return False

    scope = row.get("visibility_scope")
    if scope is not None and scope != "public":
        return False

    publication_status = row.get("publication_status")
    if publication_status is not None and publication_status != "published":
        return False

    status = row.get("status")
    if status is not None and status != "ready":
        return False

    if row.get("revoked_at") or row.get("superseded_by"):
        return False

    expires_at = row.get("expires_at")
    if expires_at is not None:
        parsed = _parse_iso_timestamp(expires_at)
        if parsed is None or parsed <= datetime.now(timezone.utc):
            return False

    return True


# Cache for list_storage_documents() — avoids repeated storage API calls.
# TTL: 60 seconds. Fresh enough to detect new uploads, cheap enough to skip
# redundant Supabase storage list() calls on every request.
_storage_cache: list[dict[str, Any]] | None = None
_storage_cache_at: datetime | None = None
_STORAGE_CACHE_TTL = timedelta(seconds=60)


def _invalidate_storage_cache() -> None:
    """Clear the storage listing cache after mutations."""
    global _storage_cache, _storage_cache_at
    _storage_cache = None
    _storage_cache_at = None


def validate_uploaded_pdf_bytes(file_content: bytes) -> None:
    if not file_content.startswith(PDF_MAGIC):
        raise HTTPException(status_code=400, detail="Invalid PDF file.")

    try:
        reader = PdfReader(io.BytesIO(file_content))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Unreadable PDF file. The file may be corrupted.") from exc

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
        "is_featured": bool(row.get("is_featured", False)),
        "agency": row.get("agency"),
    }


def load_documents(*, strict: bool = False) -> list[dict[str, Any]]:
    try:
        response = (
            get_supabase()
            .table(get_documents_table())
            .select("*")
            .order("uploaded_at", desc=True)
            .execute()
        )
        rows = [row for row in (response.data or []) if is_catalogue_visible(row)]
        logger.info("[Documents] Loaded %d rows from %s", len(rows), get_documents_table())
        return [normalize_document_row(row) for row in rows]
    except Exception as exc:
        # Public reads must distinguish "empty catalogue" from "catalogue
        # unreachable". The non-strict form keeps maintenance callers working;
        # the HTTP read path passes strict=True and returns 503.
        logger.error("[Documents] Failed to load %s: %s", get_documents_table(), exc)
        if strict:
            raise DocumentCatalogueUnavailable("Document catalogue unavailable") from exc
        return []


def upsert_documents(documents: list[dict[str, Any]]) -> None:
    if not documents:
        return
    payload = [normalize_document_row(doc) for doc in documents]
    get_supabase(admin=True).table(get_documents_table()).upsert(payload).execute()
    logger.info("[Documents] Upserted %d rows into %s", len(payload), get_documents_table())


def delete_document_record(document_id: str) -> None:
    get_supabase(admin=True).table(get_documents_table()).delete().eq("id", document_id).execute()


def list_storage_documents() -> list[dict[str, Any]]:
    global _storage_cache, _storage_cache_at

    now = datetime.now(timezone.utc)
    if _storage_cache is not None and _storage_cache_at is not None:
        if now - _storage_cache_at < _STORAGE_CACHE_TTL:
            return _storage_cache

    # Storage object listing is restricted to the service role when the bucket
    # is private (Supabase applies RLS to storage.objects). The public anon key
    # then returns an empty list even though the files exist. Listing metadata
    # here is safe: only the backend uses it to reconcile the public document
    # catalogue, and file contents are never read in this path.
    sb = get_supabase(admin=True)
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

    _storage_cache = docs
    _storage_cache_at = now
    return docs


def sync_documents_with_storage(documents: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Reconcile the lr_documents table against storage.

    This helper performs privileged writes and is intentionally not called by
    public catalogue reads. It must only be used by an explicitly authorized
    maintenance workflow; no such HTTP workflow is currently enabled.
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
                    # Featured docs keep their curated display name ("MyKad FAQ
                    # (JPN)") instead of the raw storage filename.
                    if not doc.get("is_featured"):
                        doc["name"] = storage_match["name"]
                    doc["size_bytes"] = storage_match["size_bytes"]
                    doc["storage_path"] = storage_match["storage_path"]
                    doc["public_url"] = storage_match["public_url"]
                valid_documents.append(normalize_document_row(doc))
            elif storage_path is None:
                # Seeded doc — no storage backing by design, keep it
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
            get_supabase(admin=True).table(get_documents_table()).delete().in_("id", removed_ids).execute()

        merged = valid_documents + new_entries
        if new_entries or removed_ids:
            upsert_documents(merged)
            _invalidate_storage_cache()

        return sorted(merged, key=lambda doc: doc["uploaded_at"], reverse=True)
    except Exception as exc:
        logger.warning("[Sync] Storage sync warning: %s", exc)
        return documents


def _validate_upload_token(token: str) -> None:
    if not token or not verify_upload_token(token):
        raise HTTPException(status_code=401, detail="Valid upload token required.")


def _require_admin_authorization() -> None:
    """Fail closed until a trusted server-side operator role is configured."""
    raise HTTPException(
        status_code=503,
        detail="Document administration is temporarily unavailable.",
    )


def verify_upload_token(token: str) -> bool:
    try:
        now = utc_now_iso()
        result = (
            get_supabase(admin=True)
            .table("token")
            .select("id")
            .eq("value", token)
            .eq("active", True)
            .or_(f"expires_at.is.null,expires_at.gte.{now}")
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
    is_featured: bool = False
    agency: Optional[str] = None


class UploadResponse(BaseModel):
    success: bool
    document: DocumentResponse
    message: str


class RenameDocumentRequest(BaseModel):
    name: str
    upload_token: str


@router.post("/verify-token")
@limiter.limit(DOC_LIMIT)
async def verify_token(request: Request, token: str):
    _ = request
    _ = token
    _require_admin_authorization()


def ingest_uploaded_document(document_id: str, file_content: bytes, safe_filename: str) -> None:
    """
    Background ingestion: chunk + embed the PDF, then flip the Supabase row to
    ready/error. Runs after the upload response has been sent, so large PDFs
    no longer time out the upload request. Frontend polls /{id}/status.
    """
    from routers.eval import log_data_quality

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(file_content)
            tmp_path = tmp.name

        chunk_count, ingest_quality = ingest_document(
            pdf_path=tmp_path,
            document_id=document_id,
            document_name=safe_filename,
        )
        get_supabase(admin=True).table(get_documents_table()).update({
            "chunk_count": chunk_count,
            "status": "ready",
            "error_message": None,
        }).eq("id", document_id).execute()
        # Feed the /api/eval/data-quality dashboard with this document's metrics.
        log_data_quality({**ingest_quality, "document_id": document_id, "doc_name": safe_filename})
        logger.info(
            "[Upload] Ingestion complete for %s: %d chunks via %s",
            document_id,
            chunk_count,
            str(ingest_quality.get("extraction_method", "text")),
        )
    except Exception as exc:
        try:
            get_supabase(admin=True).table(get_documents_table()).update({
                "status": "error",
                "error_message": str(exc),
            }).eq("id", document_id).execute()
        except Exception as db_exc:
            logger.error("[Upload] Failed to record error state for %s: %s", document_id, db_exc)
        log_data_quality({"valid": False, "error": str(exc), "document_id": document_id, "doc_name": safe_filename})
        logger.warning("[Upload] Ingestion failed for %s: %s", document_id, exc)
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


@router.post("/upload", response_model=UploadResponse)
@limiter.limit(DOC_LIMIT)
async def upload_document(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    upload_token: str = "",
):
    _ = request, background_tasks, file, upload_token
    _require_admin_authorization()

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
        get_supabase(admin=True).storage.from_(get_bucket()).upload(
            storage_path,
            file_content,
            {"content-type": "application/pdf"},
        )
        logger.info("[Upload] Uploaded %s", storage_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to upload document to storage. Please try again.") from exc

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
    upsert_documents([doc_record])
    _invalidate_storage_cache()

    background_tasks.add_task(ingest_uploaded_document, document_id, file_content, safe_filename)

    return UploadResponse(
        success=True,
        document=DocumentResponse(**normalize_document_row(doc_record)),
        message="Document uploaded — processing in background.",
    )


class DocumentStatusResponse(BaseModel):
    id: str
    status: str
    chunk_count: int
    error_message: Optional[str] = None


@router.get("/{document_id}/status", response_model=DocumentStatusResponse)
async def get_document_status(document_id: str):
    """Lightweight status poll for the upload flow — no storage sync, one row read."""
    try:
        rows = (
            get_supabase()
            .table(get_documents_table())
            .select("id, status, chunk_count, error_message")
            .eq("id", document_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        logger.error("[Documents] Status read failed for %s: %s", document_id, exc)
        raise HTTPException(
            status_code=503,
            detail="Document service is temporarily unavailable.",
        ) from exc
    if not rows.data:
        raise HTTPException(status_code=404, detail="Document not found")
    row = rows.data[0]
    return DocumentStatusResponse(
        id=str(row.get("id", document_id)),
        status=row.get("status", "processing"),
        chunk_count=int(row.get("chunk_count", 0) or 0),
        error_message=row.get("error_message"),
    )


@router.get("/", response_model=list[DocumentResponse])
async def list_documents():
    # Public read path: use only the registered catalogue. Storage
    # reconciliation can write/delete rows with the service role and belongs
    # in a separately authorized maintenance workflow.
    try:
        documents = load_documents(strict=True)
    except DocumentCatalogueUnavailable as exc:
        raise HTTPException(
            status_code=503,
            detail="Document catalogue is temporarily unavailable.",
        ) from exc
    return [DocumentResponse(**doc) for doc in documents]


@router.patch("/{document_id}/rename", response_model=DocumentResponse)
@limiter.limit(DOC_LIMIT)
async def rename_document(request: Request, document_id: str, body: RenameDocumentRequest):
    _ = request, document_id, body
    _require_admin_authorization()

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
            get_supabase(admin=True).storage.from_(get_bucket()).move(storage_path, new_storage_path)
            doc_to_rename["storage_path"] = new_storage_path
            doc_to_rename["public_url"] = build_public_url(new_storage_path)
            logger.info("[Rename] Moved storage object %s -> %s", storage_path, new_storage_path)
        except Exception as exc:
            logger.warning("[Rename] Storage move failed for %s: %s", storage_path, exc)

    doc_to_rename["name"] = new_name
    get_supabase(admin=True).table(get_documents_table()).update({
        "name": new_name,
        "storage_path": doc_to_rename.get("storage_path"),
        "public_url": doc_to_rename.get("public_url"),
    }).eq("id", document_id).execute()
    rename_document_in_vectorstore(
        document_id=document_id,
        document_name=new_name,
        chunk_count=int(doc_to_rename.get("chunk_count", 0) or 0),
    )
    _invalidate_storage_cache()

    return DocumentResponse(**normalize_document_row(doc_to_rename))


@router.post("/register")
async def register_document(
    id: str,
    name: str,
    size_bytes: int = 0,
    chunk_count: int = 0,
    storage_path: Optional[str] = None,
    public_url: Optional[str] = None,
    upload_token: str = "",
):
    _ = id, name, size_bytes, chunk_count, storage_path, public_url, upload_token
    _require_admin_authorization()
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
    _invalidate_storage_cache()

    return {
        "success": True,
        "message": f"Document '{name}' registered successfully",
        "document": normalize_document_row(new_doc),
    }


@router.post("/refresh-chunks")
async def refresh_chunk_counts():
    _require_admin_authorization()


@router.delete("/{document_id}")
async def delete_document(document_id: str, upload_token: str = ""):
    _ = document_id, upload_token
    _require_admin_authorization()
    documents = load_documents()
    doc_to_delete = next((doc for doc in documents if doc["id"] == document_id), None)
    if not doc_to_delete:
        raise HTTPException(status_code=404, detail="Document not found")

    storage_path = doc_to_delete.get("storage_path")
    if storage_path:
        try:
            get_supabase(admin=True).storage.from_(get_bucket()).remove([storage_path])
            logger.info("[Delete] Removed %s from storage", storage_path)
        except Exception as exc:
            logger.warning("[Delete] Could not remove %s from storage: %s", storage_path, exc)

    delete_document_from_vectorstore(document_id)
    delete_chat_messages_for_document(document_id, admin_authorized=True)
    delete_document_record(document_id)
    _invalidate_storage_cache()

    return {"success": True, "message": f"Document '{doc_to_delete['name']}' deleted"}


def _read_catalogue_row(document_id: str) -> dict[str, Any]:
    """Read one publicly servable catalogue row, or raise a safe HTTP error."""
    try:
        rows = (
            get_supabase()
            .table(get_documents_table())
            .select("*")
            .eq("id", document_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        logger.error("[Documents] Catalogue read failed for %s: %s", document_id, exc)
        raise HTTPException(
            status_code=503,
            detail="Document service is temporarily unavailable.",
        ) from exc
    if not rows.data:
        raise HTTPException(status_code=404, detail="Document not found")
    row = rows.data[0]
    if not is_catalogue_visible(row):
        # Do not reveal whether a private/draft document exists.
        raise HTTPException(status_code=404, detail="Document not found")
    return row


@router.get("/{document_id}/pdf-url")
@limiter.limit(PDF_URL_LIMIT)
def get_pdf_signed_url(request: Request, document_id: str):
    """Return a 1-hour signed URL for a publicly servable document PDF."""
    _ = request
    row = _read_catalogue_row(document_id)
    storage_path = row.get("storage_path")
    if not storage_path:
        raise HTTPException(status_code=404, detail="No storage path for this document")
    try:
        # The documents bucket is private. The backend has already checked the
        # catalogue visibility above, so it is the trusted mediator that mints
        # the short-lived URL.
        result = (
            get_supabase(admin=True)
            .storage.from_(get_bucket())
            .create_signed_url(storage_path, 3600)
        )
    except Exception as exc:
        logger.error("[PDF] Signed URL failed for %s (%s): %s", document_id, storage_path, exc)
        raise HTTPException(
            status_code=503,
            detail="Document storage is temporarily unavailable.",
        ) from exc
    return {"url": result["signedURL"], "expires_in": 3600}


@router.get("/{document_id}/pdf")
@limiter.limit(PDF_URL_LIMIT)
def proxy_pdf(request: Request, document_id: str, download: bool = False):
    """Stream PDF bytes through backend — avoids CORS and private-bucket 400s."""
    _ = request
    row = _read_catalogue_row(document_id)
    storage_path = row.get("storage_path")
    if not storage_path:
        raise HTTPException(status_code=404, detail="No storage path for this document")
    try:
        # The bucket is private: anon storage reads are denied by storage RLS.
        # Catalogue visibility was enforced above, so the service client is
        # only used to fetch bytes for an already-authorized document.
        data: bytes = (
            get_supabase(admin=True).storage.from_(get_bucket()).download(storage_path)
        )
    except Exception as exc:
        # Raise HTTPException instead of letting the storage error bubble up:
        # an unhandled exception bypasses CORSMiddleware, so the browser sees
        # a CORS failure ("Failed to fetch") instead of a useful status.
        logger.warning("[PDF] Storage download failed for %s (%s): %s", document_id, storage_path, exc)
        raise HTTPException(status_code=404, detail="PDF file not found in storage") from exc
    safe_name = (row.get("name") or "document").replace('"', "").replace("\\", "")
    if not safe_name.lower().endswith(".pdf"):
        safe_name = f"{safe_name}.pdf"
    etag = hashlib.md5(data).hexdigest()
    disposition = "attachment" if download else "inline"
    return Response(
        content=data,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'{disposition}; filename="{safe_name}"; '
                f"filename*=UTF-8''{quote(safe_name)}"
            ),
            "Cache-Control": "no-store",
            "ETag": f'"{etag}"',
        },
    )


class ReindexResponse(BaseModel):
    success: bool
    chunk_count: int
    message: str


@router.post("/{document_id}/reindex", response_model=ReindexResponse)
@limiter.limit(DOC_LIMIT)
async def reindex_document(request: Request, document_id: str, upload_token: str = ""):
    """Re-ingest an existing document to refresh Pinecone vectors (e.g. pick up page_start metadata)."""
    _ = request, document_id, upload_token
    _require_admin_authorization()

    sb = get_supabase(admin=True)
    rows = (
        sb.table(get_documents_table())
        .select("storage_path, name, status")
        .eq("id", document_id)
        .limit(1)
        .execute()
    )
    if not rows.data:
        raise HTTPException(status_code=404, detail="Document not found")
    row = rows.data[0]
    storage_path = row.get("storage_path")
    if not storage_path:
        raise HTTPException(status_code=400, detail="No storage path — cannot re-index.")

    pdf_bytes: bytes = sb.storage.from_(get_bucket()).download(storage_path)

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(pdf_bytes)
            tmp_path = tmp.name

        chunk_count, ingest_quality = ingest_document(
            pdf_path=tmp_path,
            document_id=document_id,
            document_name=row.get("name") or "",
        )
        sb.table(get_documents_table()).update(
            {"chunk_count": chunk_count, "status": "ready", "error_message": None}
        ).eq("id", document_id).execute()
        from routers.eval import log_data_quality
        log_data_quality({**ingest_quality, "document_id": document_id, "doc_name": row.get("name") or ""})
        return ReindexResponse(
            success=True,
            chunk_count=chunk_count,
            message=f"Re-indexed into {chunk_count} chunks.",
        )
    except Exception as exc:
        logger.warning("[Reindex] Failed for %s: %s", document_id, exc)
        raise HTTPException(status_code=500, detail="Re-index failed. Please try again.") from exc
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


_DEFAULT_PREWARM = [
    "Summarize this document",
    "Siapa yang layak memohon?",
    "What documents do I need?",
]

PREWARM_QUESTIONS: dict[str, list[str]] = {
    doc["doc_id"]: _DEFAULT_PREWARM for doc in FEATURED_DOCS
}


def _download_seed_pdf(featured: dict, dest_path: str) -> bool:
    """Fetch a featured PDF from its official source_url into sample_docs."""
    source_url = featured.get("source_url")
    if not source_url:
        return False
    try:
        import httpx

        resp = httpx.get(source_url, timeout=30.0, follow_redirects=True)
        resp.raise_for_status()
        content = resp.content
        if not content.startswith(PDF_MAGIC):
            logger.warning("[Seed] Not a PDF: %s", source_url)
            return False
        if len(content) > MAX_UPLOAD_BYTES:
            logger.warning("[Seed] Too large (%d bytes): %s", len(content), source_url)
            return False
        with open(dest_path, "wb") as fh:
            fh.write(content)
        logger.info("[Seed] Downloaded %s (%d bytes)", featured["doc_id"], len(content))
        return True
    except Exception as exc:
        logger.warning("[Seed] Download failed for %s: %s", source_url, exc)
        return False


def _upload_seed_pdf_to_storage(supabase_id: str, filename: str, pdf_path: str) -> Optional[str]:
    """Put the seeded PDF into the storage bucket so the /pdf proxy and viewer work."""
    storage_path = f"{supabase_id}/{filename}"
    try:
        with open(pdf_path, "rb") as fh:
            data = fh.read()
        get_supabase(admin=True).storage.from_(get_bucket()).upload(
            storage_path,
            data,
            {"content-type": "application/pdf", "x-upsert": "true"},
        )
        return storage_path
    except Exception as exc:
        if "exist" in str(exc).lower() or "duplicate" in str(exc).lower():
            return storage_path
        logger.warning("[Seed] Storage upload failed for %s: %s", storage_path, exc)
        return None


async def _do_seed() -> dict:
    """
    Seed logic decoupled from FastAPI request — callable from startup and the HTTP route.
    Uses uuid5 for deterministic Supabase IDs. Pinecone namespace = supabase_id so the
    chat API (which receives doc.id from the frontend) hits the correct namespace.
    """
    existing_docs = load_documents()
    existing_by_name = {doc["name"]: doc for doc in existing_docs}

    seeded = 0
    already_present = 0
    repaired = 0

    for featured in FEATURED_DOCS:
        doc_id = featured["doc_id"]
        doc_name = featured["name"]

        pdf_path = os.path.join(SAMPLE_DOCS_DIR, featured["filename"])
        if not os.path.exists(pdf_path) and not _download_seed_pdf(featured, pdf_path):
            logger.warning("[Seed] PDF not found, skipping: %s", pdf_path)
            continue

        # Deterministic UUID — used for BOTH Supabase row id and Pinecone namespace
        supabase_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, doc_id))

        existing = existing_by_name.get(doc_name)
        if existing:
            already_present += 1
            # Older seeds never uploaded the file to storage, so the PDF viewer
            # 404s on these docs. Backfill storage for them once.
            if not existing.get("storage_path"):
                storage_path = _upload_seed_pdf_to_storage(
                    str(existing["id"]), featured["filename"], pdf_path
                )
                if storage_path:
                    get_supabase(admin=True).table(get_documents_table()).update({
                        "storage_path": storage_path,
                        "public_url": build_public_url(storage_path),
                        "size_bytes": os.path.getsize(pdf_path),
                    }).eq("id", existing["id"]).execute()
                    repaired += 1
                    logger.info("[Seed] Backfilled storage for %s", doc_id)
            continue

        try:
            chunk_count, _ = ingest_document(
                pdf_path=pdf_path,
                document_id=supabase_id,
                document_name=doc_name,
            )
            storage_path = _upload_seed_pdf_to_storage(
                supabase_id, featured["filename"], pdf_path
            )
            base_payload = {
                "id": supabase_id,
                "name": doc_name,
                "size_bytes": os.path.getsize(pdf_path),
                "chunk_count": chunk_count,
                "status": "ready",
                "uploaded_at": utc_now_iso(),
                "storage_path": storage_path,
                "public_url": build_public_url(storage_path),
                "error_message": None,
            }
            # Attempt with optional columns first; fall back to base if Supabase rejects
            for payload in [
                {**base_payload, "is_featured": True, "agency": featured["agency"]},
                base_payload,
            ]:
                resp = get_supabase(admin=True).table(get_documents_table()).upsert(payload).execute()
                if getattr(resp, "data", None) is not None:
                    logger.info("[Seed] Upserted %s (payload keys: %s)", doc_id, list(payload.keys()))
                    break
                logger.warning("[Seed] Upsert failed for %s, retrying without optional cols", doc_id)
            logger.info("[Seed] Seeded %s as %s (%d chunks)", doc_id, supabase_id, chunk_count)
            seeded += 1
        except Exception as exc:
            logger.error("[Seed] Failed to ingest %s: %s", doc_id, exc)

    return {"seeded": seeded, "already_present": already_present, "repaired": repaired}


@router.post("/seed")
@limiter.limit(SEED_LIMIT)
async def seed_featured_documents(request: Request, upload_token: str = ""):
    _ = request, upload_token
    _require_admin_authorization()


async def _prewarm_featured_docs():
    """
    After seeding completes, silently fire 3 pre-warm questions per featured doc.
    Populates _query_cache so first judge query returns in ~200ms instead of ~2s.
    """
    from utils.rag_pipeline import answer_question

    existing_ids = {doc["id"] for doc in load_documents()}
    for featured in FEATURED_DOCS:
        doc_id = featured["doc_id"]
        supabase_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, doc_id))
        if supabase_id not in existing_ids:
            continue
        for question in PREWARM_QUESTIONS.get(doc_id, []):
            try:
                answer_question(
                    question=question,
                    document_id=supabase_id,
                    enable_query_augmentation=False,
                )
                logger.info("[Prewarm] Cached: %s / %s", doc_id, question[:40])
            except Exception as exc:
                logger.warning("[Prewarm] Failed: %s / %s — %s", doc_id, question[:40], exc)
