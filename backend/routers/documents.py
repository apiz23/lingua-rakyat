"""
routers/documents.py - Document catalogue reads and PDF delivery endpoints.
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

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel
from pypdf import PdfReader
from slowapi import Limiter

from rate_limits import PDF_URL_LIMIT, get_proxy_aware_remote_address
from utils import catalogue_cache, eligibility
from utils.auth import get_supabase
from utils.rag_pipeline import ingest_document

limiter = Limiter(key_func=get_proxy_aware_remote_address)
logger = logging.getLogger("documents_router")
router = APIRouter()

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
PDF_MAGIC = b"%PDF-"
MAX_UPLOAD_PAGES = 200

SAMPLE_DOCS_DIR = os.path.join(os.path.dirname(__file__), "..", "sample_docs")





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


def normalize_document_row(row: dict[str, Any], *, build_urls: bool = True) -> dict[str, Any]:
    """Internal row shape used for persistence and maintenance flows."""
    uploaded_at = row.get("uploaded_at")
    if isinstance(uploaded_at, datetime):
        uploaded_at = uploaded_at.isoformat()
    elif uploaded_at is None:
        uploaded_at = utc_now_iso()
    else:
        uploaded_at = str(uploaded_at)

    storage_path = row.get("storage_path")
    public_url = None
    if build_urls:
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


def to_public_document(row: dict[str, Any]) -> dict[str, Any]:
    """Public catalogue shape: no storage paths, signed URLs or service detail."""
    document = normalize_document_row(row, build_urls=False)
    document_id = document["id"]
    document["storage_path"] = None
    document["public_url"] = None
    document["pdf_url"] = f"/api/documents/{quote(document_id, safe='')}/pdf"
    return document


def _query_catalogue(client: Any, document_id: Optional[str] = None):
    query = client.table(get_documents_table()).select("*")
    if document_id is None:
        query = query.order("uploaded_at", desc=True)
    else:
        query = query.eq("id", document_id).limit(1)
    return query.execute()


def _snapshot_for_rows(rows: list[dict[str, Any]]) -> eligibility.EligibilitySnapshot:
    try:
        return eligibility.snapshot_for_rows(get_supabase(admin=True), rows)
    except eligibility.EligibilityUnavailable as exc:
        raise DocumentCatalogueUnavailable("Publication registry unavailable") from exc


def load_documents(*, strict: bool = False) -> list[dict[str, Any]]:
    last_error: Optional[Exception] = None

    cached = catalogue_cache.get_documents()
    if cached is not None:
        return cached

    for admin in (False, True):
        try:
            response = _query_catalogue(get_supabase(admin=admin))
            rows = [row for row in (response.data or []) if isinstance(row, dict)]
            snapshot = _snapshot_for_rows(rows)
            visible = eligibility.filter_public_rows(rows, snapshot)
            if admin:
                logger.warning(
                    "[Documents] Public catalogue served via service-role fallback; "
                    "set a valid SUPABASE_ANON_KEY to restore least-privilege reads."
                )
            logger.info(
                "[Documents] Loaded %d eligible rows from %s",
                len(visible),
                get_documents_table(),
            )
            documents = [to_public_document(row) for row in visible]
            catalogue_cache.set_documents(documents)
            return documents
        except Exception as exc:
            last_error = exc
            logger.error(
                "[Documents] Catalogue read failed (service_client=%s): %s", admin, exc
            )

    if strict:
        raise DocumentCatalogueUnavailable("Document catalogue unavailable") from last_error
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


                    if not doc.get("is_featured"):
                        doc["name"] = storage_match["name"]
                    doc["size_bytes"] = storage_match["size_bytes"]
                    doc["storage_path"] = storage_match["storage_path"]
                    doc["public_url"] = storage_match["public_url"]
                valid_documents.append(normalize_document_row(doc))
            elif storage_path is None:

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
    pdf_url: Optional[str] = None
    error_message: Optional[str] = None
    is_featured: bool = False
    agency: Optional[str] = None


def ingest_uploaded_document(document_id: str, file_content: bytes, safe_filename: str) -> None:
    """
    Background ingestion: chunk + embed the PDF, then flip the Supabase row to
    ready/error. Runs after the upload response has been sent, so large PDFs
    no longer time out the upload request. Frontend polls /{id}/status.
    """
    from routers.eval import log_data_quality
    from utils.rag_pipeline import ingest_revision

    client = get_supabase(admin=True)
    revision_no = 1
    tmp_path = None
    try:
        rows = (
            client.table(get_documents_table())
            .select("*")
            .eq("id", document_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        row = rows[0] if rows else {}
        revision_no = int(row.get("current_revision") or row.get("document_version") or 1)
        storage_path = row.get("storage_path") or f"{document_id}/{safe_filename}"
        checksum = hashlib.sha256(file_content).hexdigest()
        existing = (
            client.table("document_revisions")
            .select("*")
            .eq("document_id", document_id)
            .eq("revision", revision_no)
            .limit(1)
            .execute()
            .data
            or []
        )
        if not existing:
            client.table("document_revisions").insert(
                {
                    "id": str(uuid.uuid4()),
                    "document_id": document_id,
                    "revision": revision_no,
                    "source_id": row.get("source_id"),
                    "source_type": row.get("source_type"),
                    "storage_path": storage_path,
                    "checksum": checksum,
                    "approved_by": None,
                    "approved_at": None,
                    "created_at": utc_now_iso(),
                    "indexing_status": "indexing",
                    "review_status": "pending",
                    "metadata": {"requires_review": True},
                }
            ).execute()
        else:
            client.table("document_revisions").update(
                {"indexing_status": "indexing", "checksum": checksum, "index_error": None}
            ).eq("document_id", document_id).eq("revision", revision_no).execute()

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(file_content)
            tmp_path = tmp.name

        indexed = ingest_revision(
            pdf_path=tmp_path,
            document_id=document_id,
            revision=revision_no,
            source_id=str(row.get("source_id") or ""),
            document_name=safe_filename,
        )
        chunk_count = int(indexed.get("chunk_count") or 0)
        client.table("document_revisions").update(
            {
                "indexing_status": "indexed",
                "indexed_at": indexed.get("indexed_at"),
                "chunk_count": chunk_count,
                "index_namespace": indexed.get("namespace"),
                "verification_chunk_ids": list(indexed.get("sample_chunk_ids") or []),
                "index_error": None,
            }
        ).eq("document_id", document_id).eq("revision", revision_no).execute()
        client.table(get_documents_table()).update({
            "chunk_count": chunk_count,
            "status": "ready",
            "error_message": None,
        }).eq("id", document_id).execute()

        log_data_quality({**indexed.get("quality", {}), "document_id": document_id, "doc_name": safe_filename})
        logger.info(
            "[Upload] Revision %s ingestion complete for %s: %d chunks",
            revision_no,
            document_id,
            chunk_count,
        )
    except Exception as exc:
        try:
            get_supabase(admin=True).table(get_documents_table()).update({
                "status": "error",
                "error_message": str(exc),
            }).eq("id", document_id).execute()
            get_supabase(admin=True).table("document_revisions").update(
                {"indexing_status": "failed", "index_error": str(exc)[:500]}
            ).eq("document_id", document_id).eq("revision", revision_no).execute()
        except Exception as db_exc:
            logger.error("[Upload] Failed to record error state for %s: %s", document_id, db_exc)
        log_data_quality({"valid": False, "error": str(exc), "document_id": document_id, "doc_name": safe_filename})
        logger.warning("[Upload] Ingestion failed for %s: %s", document_id, exc)
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


class DocumentStatusResponse(BaseModel):
    id: str
    status: str
    chunk_count: int
    error_message: Optional[str] = None


@router.get("/{document_id}/status", response_model=DocumentStatusResponse)
def get_document_status(document_id: str):
    """Lightweight status poll for the upload flow — no storage sync, one row read."""
    row, _snapshot = _read_catalogue_row(document_id)
    return DocumentStatusResponse(
        id=str(row.get("id", document_id)),
        status=row.get("status", "processing"),
        chunk_count=int(row.get("chunk_count", 0) or 0),
        error_message=row.get("error_message"),
    )


@router.get("/", response_model=list[DocumentResponse])
def list_documents():

    try:
        documents = load_documents(strict=True)
    except DocumentCatalogueUnavailable as exc:
        raise HTTPException(
            status_code=503,
            detail="Document catalogue is temporarily unavailable.",
        ) from exc
    return [DocumentResponse(**doc) for doc in documents]


def _read_catalogue_row(
    document_id: str,
) -> tuple[dict[str, Any], eligibility.EligibilitySnapshot]:
    """Read one publicly eligible catalogue row plus its eligibility snapshot."""
    last_error: Optional[Exception] = None
    for admin in (False, True):
        try:
            rows = _query_catalogue(get_supabase(admin=admin), document_id)
        except Exception as exc:
            last_error = exc
            logger.error(
                "[Documents] Catalogue row read failed for %s (service_client=%s): %s",
                document_id,
                admin,
                exc,
            )
            continue

        if not rows.data:


            raise HTTPException(status_code=404, detail="Document not found")
        row = rows.data[0]
        if not isinstance(row, dict):
            raise HTTPException(status_code=404, detail="Document not found")
        snapshot = _snapshot_for_rows([row])
        if not eligibility.is_document_public(row, snapshot):

            raise HTTPException(status_code=404, detail="Document not found")
        if admin:
            logger.warning(
                "[Documents] Catalogue row %s served via service-role fallback; "
                "set a valid SUPABASE_ANON_KEY to restore least-privilege reads.",
                document_id,
            )
        return row, snapshot

    raise HTTPException(
        status_code=503,
        detail="Document service is temporarily unavailable.",
    ) from last_error


@router.get("/{document_id}/pdf-url")
@limiter.limit(PDF_URL_LIMIT)
def get_pdf_signed_url(request: Request, document_id: str):
    """Signed storage URLs are disabled; bytes are served by the PDF proxy."""
    _ = request
    _read_catalogue_row(document_id)
    raise HTTPException(
        status_code=410,
        detail="Direct storage URLs are no longer issued. Use the PDF proxy.",
    )


@router.get("/{document_id}/pdf")
@limiter.limit(PDF_URL_LIMIT)
def proxy_pdf(request: Request, document_id: str, download: bool = False):
    """Stream PDF bytes through backend — avoids CORS and private-bucket 400s."""
    _ = request
    row, snapshot = _read_catalogue_row(document_id)
    storage_path = eligibility.public_pdf_storage_path(row, snapshot)
    if not storage_path:
        raise HTTPException(status_code=404, detail="No storage path for this document")
    try:
        # The bucket is private: anon storage reads are denied by storage RLS.
        # Eligibility and the current approved revision were resolved above, so
        # the service client is only used to fetch bytes for that revision.
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
