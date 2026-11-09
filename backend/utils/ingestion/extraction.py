"""PDF validation and extraction for ingestion.

Extraction is page-aware only for counting/quality; the existing RAG pipeline
performs the page-aware chunking used for citations.
"""

from __future__ import annotations

import io
import logging
from dataclasses import dataclass
from typing import Optional

from pypdf import PdfReader

logger = logging.getLogger("ingestion.extraction")

MAX_PAGES = 500
MIN_TEXT_CHARS = 80
MIN_CHARS_PER_PAGE = 20


class ExtractionError(RuntimeError):
    """The PDF could not be read/extracted."""


@dataclass(frozen=True)
class ExtractionResult:
    page_count: int
    text_chars: int
    title: str = ""
    author: str = ""
    creation_date: str = ""
    modification_date: str = ""
    language: str = ""
    ocr_required: bool = False
    extraction_status: str = "complete"
    extraction_method: str = "pypdf"
    sample_text: str = ""


def _metadata_value(metadata: object, key: str) -> str:
    try:
        value = getattr(metadata, key, None) if metadata else None
    except Exception:
        return ""
    return str(value).strip() if value else ""


def detect_language(text: str) -> str:
    if len(text.strip()) < 30:
        return ""
    try:
        from langdetect import DetectorFactory, detect

        DetectorFactory.seed = 0
        code = detect(text[:3000])
        return {"zh-cn": "zh-cn", "zh-tw": "zh-cn", "ms": "ms", "en": "en", "id": "ms"}.get(
            code, code
        )
    except Exception:
        return ""


def extract_pdf(content: bytes) -> ExtractionResult:
    if not content.startswith(b"%PDF-"):
        raise ExtractionError("Not a PDF file")
    try:
        reader = PdfReader(io.BytesIO(content))
    except Exception as exc:
        raise ExtractionError("Unreadable PDF") from exc
    if reader.is_encrypted:
        raise ExtractionError("Encrypted PDFs are not supported")
    try:
        page_count = len(reader.pages)
    except Exception as exc:
        raise ExtractionError("PDF page table is unreadable") from exc
    if page_count < 1:
        raise ExtractionError("PDF has no pages")
    if page_count > MAX_PAGES:
        raise ExtractionError("PDF exceeds the page limit")

    chunks: list[str] = []
    text_chars = 0
    failed_pages = 0
    for page in reader.pages:
        try:
            text = page.extract_text() or ""
        except Exception:
            failed_pages += 1
            continue
        text_chars += len(text)
        if len(chunks) < 3 and text.strip():
            chunks.append(text.strip()[:2000])

    sample = "\n".join(chunks)
    ocr_required = text_chars < MIN_TEXT_CHARS or (
        page_count > 0 and text_chars / page_count < MIN_CHARS_PER_PAGE
    )
    metadata = reader.metadata
    status = "ocr_required" if ocr_required else ("complete" if text_chars else "failed")

    return ExtractionResult(
        page_count=page_count,
        text_chars=text_chars,
        title=_metadata_value(metadata, "title"),
        author=_metadata_value(metadata, "author"),
        creation_date=_metadata_value(metadata, "creation_date"),
        modification_date=_metadata_value(metadata, "modification_date"),
        language=detect_language(sample),
        ocr_required=ocr_required,
        extraction_status=status if failed_pages == 0 or text_chars else "failed",
        extraction_method="pypdf",
        sample_text=sample,
    )
