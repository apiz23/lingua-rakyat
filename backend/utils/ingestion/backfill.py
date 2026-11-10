"""Safe, resumable backfill for documents that predate revision records.

Dry-run by default. Backfilled revisions are created as private/pending
revisions: no approval, no publication, no visibility change. A backfill can
therefore never make a document public.
"""

from __future__ import annotations

import hashlib
import logging
import os
import tempfile
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Mapping, Optional

from utils import admin_service
from utils.ingestion.extraction import ExtractionError, extract_pdf
from utils.publication_store import fetch_documents, fetch_revisions, revisions_table

logger = logging.getLogger("ingestion.backfill")


@dataclass
class BackfillResult:
    document_id: str
    status: str
    revision: int
    checksum: str = ""
    indexed: bool = False
    error: str = ""


@dataclass
class BackfillSummary:
    scanned: int = 0
    planned: int = 0
    created: int = 0
    indexed: int = 0
    skipped: int = 0
    failed: int = 0
    results: list[BackfillResult] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "scanned": self.scanned,
            "planned": self.planned,
            "created": self.created,
            "indexed": self.indexed,
            "skipped": self.skipped,
            "failed": self.failed,
            "results": [result.__dict__ for result in self.results],
        }


class _BackfillActor:
    kind = "system"
    subject = "system:backfill"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _bucket() -> str:
    return os.getenv("SUPABASE_BUCKET", "documents")


def _download(client: Any, storage_path: str) -> bytes:
    try:
        return client.storage.from_(_bucket()).download(storage_path)
    except Exception as exc:
        raise RuntimeError("Could not download the stored document") from exc


def _current_revision(document: Mapping[str, Any]) -> int:
    value = document.get("current_revision") or document.get("document_version") or 1
    return int(value)


def _existing_revision(
    revisions: list[Mapping[str, Any]], document_id: str, revision: int
) -> Optional[Mapping[str, Any]]:
    return next(
        (
            row
            for row in revisions
            if str(row.get("document_id")) == document_id
            and int(row.get("revision") or 0) == revision
        ),
        None,
    )


def _insert_revision(client: Any, payload: Mapping[str, Any]) -> dict[str, Any]:
    result = client.table(revisions_table()).insert(dict(payload)).execute()
    rows = getattr(result, "data", None) or []
    return rows[0] if rows and isinstance(rows[0], dict) else dict(payload)


def _update_revision(client: Any, document_id: str, revision: int, payload: Mapping[str, Any]) -> None:
    client.table(revisions_table()).update(dict(payload)).eq("document_id", document_id).eq("revision", revision).execute()


def backfill_document(
    client: Any,
    document: Mapping[str, Any],
    *,
    dry_run: bool,
    index: bool = True,
    indexer: Optional[Callable[..., Mapping[str, Any]]] = None,
) -> BackfillResult:
    document_id = str(document.get("id") or "")
    revision_no = _current_revision(document)
    revisions = [
        row for row in fetch_revisions(client) if str(row.get("document_id")) == document_id
    ]
    existing = _existing_revision(revisions, document_id, revision_no)
    if existing and (
        existing.get("review_status") == "approved" or existing.get("approved_by")
    ):

        return BackfillResult(document_id, "skipped", revision_no, str(existing.get("checksum") or ""))
    if existing and existing.get("indexing_status") == "indexed":
        return BackfillResult(document_id, "skipped", revision_no, str(existing.get("checksum") or ""))
    storage_path = document.get("storage_path")
    if not storage_path:
        return BackfillResult(document_id, "failed", revision_no, error="no storage path")

    content = _download(client, str(storage_path))
    if not content.startswith(b"%PDF-"):
        return BackfillResult(document_id, "failed", revision_no, error="stored file is not a PDF")
    checksum = hashlib.sha256(content).hexdigest()
    recorded_checksum = document.get("checksum")
    if recorded_checksum and recorded_checksum != checksum:
        return BackfillResult(
            document_id,
            "failed",
            revision_no,
            checksum=checksum,
            error="stored file checksum does not match the recorded document checksum",
        )
    try:
        extraction = extract_pdf(content)
    except ExtractionError as exc:
        return BackfillResult(document_id, "failed", revision_no, checksum=checksum, error=str(exc))

    metadata = {
        **(existing.get("metadata") if existing else {}),
        "source_url": document.get("source_url"),
        "external_id": document.get("external_id"),
        "retrieved_at": _now(),
        "requires_review": True,
        "extraction_status": extraction.extraction_status,
        "page_count": extraction.page_count,
        "backfilled": True,
    }

    if dry_run:
        return BackfillResult(
            document_id,
            "planned",
            revision_no,
            checksum=checksum,
            error="OCR required" if extraction.ocr_required else "",
        )

    payload = {
        "document_id": document_id,
        "revision": revision_no,
        "source_id": document.get("source_id"),
        "source_type": document.get("source_type"),
        "storage_path": storage_path,
        "checksum": checksum,
        "approved_by": None,
        "approved_at": None,
        "created_at": existing.get("created_at") if existing else _now(),
        "indexing_status": "pending" if extraction.ocr_required else "indexing",
        "review_status": "pending",
        "chunk_count": 0,
        "index_namespace": None,
        "index_error": "OCR required before indexing" if extraction.ocr_required else None,
        "metadata": metadata,
    }
    if existing:
        _update_revision(client, document_id, revision_no, payload)
    else:
        _insert_revision(client, {"id": str(uuid.uuid4()), **payload})

    indexed = False
    if index and not extraction.ocr_required:
        from utils.rag_pipeline import ingest_revision

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as handle:
            handle.write(content)
            path = handle.name
        try:
            result = (indexer or ingest_revision)(
                pdf_path=path,
                document_id=document_id,
                revision=revision_no,
                source_id=str(document.get("source_id") or ""),
                document_name=str(document.get("name") or "document"),
            )
            _update_revision(
                client,
                document_id,
                revision_no,
                {
                    "indexing_status": "indexed",
                    "indexed_at": result.get("indexed_at") or _now(),
                    "chunk_count": int(result.get("chunk_count") or 0),
                    "index_namespace": result.get("namespace"),
                    "index_error": None,
                    "verification_chunk_ids": list(result.get("sample_chunk_ids") or []),
                    "metadata": {
                        **metadata,
                        "verification_chunk_ids": list(result.get("sample_chunk_ids") or []),
                    },
                },
            )
            indexed = True
        except Exception as exc:
            _update_revision(
                client,
                document_id,
                revision_no,
                {"indexing_status": "failed", "index_error": str(exc)[:500]},
            )
            admin_service.audit(
                client,
                _BackfillActor(),
                action="revision.backfill_index_failed",
                target_type="document_revision",
                target_id=f"{document_id}:{revision_no}",
                details={"error": type(exc).__name__},
            )
            return BackfillResult(document_id, "failed", revision_no, checksum, error=str(exc))
        finally:
            try:
                os.remove(path)
            except OSError:
                pass

    admin_service.audit(
        client,
        _BackfillActor(),
        action="revision.backfill",
        target_type="document_revision",
        target_id=f"{document_id}:{revision_no}",
        details={
            "checksum": checksum,
            "page_count": extraction.page_count,
            "ocr_required": extraction.ocr_required,
            "indexed": indexed,
        },
    )
    return BackfillResult(
        document_id,
        "indexed" if indexed else ("ocr_required" if extraction.ocr_required else "pending"),
        revision_no,
        checksum,
        indexed=indexed,
    )


def run_backfill(
    client: Any,
    *,
    dry_run: bool = True,
    limit: int = 50,
    after: Optional[str] = None,
    index: bool = True,
    indexer: Optional[Callable[..., Mapping[str, Any]]] = None,
    progress: Optional[Callable[[BackfillResult], None]] = None,
) -> BackfillSummary:
    documents = sorted(fetch_documents(client), key=lambda row: str(row.get("id") or ""))
    summary = BackfillSummary()
    for document in documents:
        document_id = str(document.get("id") or "")
        if after and document_id <= after:
            continue
        if summary.scanned >= max(1, limit):
            break
        summary.scanned += 1
        try:
            result = backfill_document(
                client, document, dry_run=dry_run, index=index, indexer=indexer
            )
        except Exception as exc:
            result = BackfillResult(document_id, "failed", _current_revision(document), error=str(exc))
        summary.results.append(result)
        if result.status == "planned":
            summary.planned += 1
        elif result.status == "skipped":
            summary.skipped += 1
        elif result.status == "failed":
            summary.failed += 1
        else:
            summary.created += 1
            if result.indexed:
                summary.indexed += 1
        if progress:
            progress(result)
    return summary
