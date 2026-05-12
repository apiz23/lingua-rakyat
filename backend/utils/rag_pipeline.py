"""
rag_pipeline.py - Lightweight multilingual RAG pipeline.
"""

import logging
import os
import re
import time
from collections.abc import Generator
from typing import Any, Optional

import langdetect
import requests
from dotenv import load_dotenv
from groq import Groq
from pinecone import Pinecone
from pypdf import PdfReader

try:
    import fitz  # PyMuPDF
except Exception:
    fitz = None

try:
    from PIL import Image
except Exception:
    Image = None

try:
    import pytesseract
except Exception:
    pytesseract = None

from utils.data_augmentation import QueryAugmenter

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("rag_pipeline")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "groq/compound")
GROQ_MODEL_FAST = os.getenv("GROQ_MODEL_FAST", "llama-3.1-8b-instant")

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX = os.getenv("PINECONE_INDEX", "docuquery")

ENABLE_QUERY_AUGMENTATION = os.getenv("ENABLE_QUERY_AUGMENTATION", "true").lower() == "true"
AUGMENTATION_MAX_VARIANTS = max(1, int(os.getenv("AUGMENTATION_MAX_VARIANTS", "4")))
AUGMENTATION_INCLUDE_PARAPHRASE = (
    os.getenv("AUGMENTATION_INCLUDE_PARAPHRASE", "true").lower() == "true"
)

MIN_TEXT_LENGTH = 50
MIN_PAGES = 1
MAX_PAGES = 500
MIN_CHUNK_WORDS = 20
CHUNK_TARGET_WORDS = 360
CHUNK_MAX_WORDS = 520
CHUNK_OVERLAP_WORDS = 45
CONFIDENCE_THRESHOLD = 0.50
MIN_USABLE_CONFIDENCE = 0.25
OCR_MIN_CHARS = 50
PROMPT_RETRY_CHAR_LIMITS = [2500, 1200]
ENABLE_COHERE_RERANK = os.getenv("ENABLE_COHERE_RERANK", "true").lower() == "true"

CONTEXT_CHAR_LIMIT_LARGE = 4000
CONTEXT_CHAR_LIMIT_SMALL = 1800
TOP_K_LARGE = 5
TOP_K_SMALL = 3

SUMMARIZE_KEYWORDS: list[str] = [
    "summarize", "summarise", "summary", "overview", "what is this document",
    "what does this document", "what is this about", "explain this document",
    "key takeaways", "main points", "give me an overview", "what should i know",
    "tell me about this", "describe this document", "ringkaskan", "ringkasan",
    "rumusan", "apa isi", "apakah dokumen", "ceritakan", "terangkan dokumen",
    "apa yang penting", "kandungan dokumen", "huraikan", "jelaskan dokumen",
    "apa dokumen ini", "总结", "概述", "摘要", "这个文件", "主要内容",
]


def is_summarize_intent(question: str) -> bool:
    q = question.lower().strip()
    return any(keyword in q for keyword in SUMMARIZE_KEYWORDS)


def _is_small_model(model_name: str) -> bool:
    return any(piece in model_name.lower() for piece in ["8b", "gemma", "7b", "9b", "mixtral"])


DIALECT_MAP: dict[str, str] = {
    "ms": "ms", "id": "ms", "zsm": "ms",
    "zh-cn": "zh-cn", "zh-tw": "zh-cn", "zh": "zh-cn", "yue": "zh-cn",
    "tl": "en", "fil": "en", "th": "en", "vi": "en",
    "km": "en", "lo": "en", "my": "en",
    "jv": "ms", "su": "ms", "ceb": "en", "ilo": "en",
}

DIALECT_KEYWORDS: dict[str, list[str]] = {
    "ms": [
        "nak", "boleh", "pergi", "saya", "awak", "kamu", "dia", "kami",
        "mereka", "ini", "itu", "dengan", "untuk", "tidak", "ada", "kalau",
        "mohon", "bantuan", "kerajaan", "permohonan", "kelayakan",
    ],
    "zh-cn": ["的", "是", "了", "在", "我", "你", "他", "她", "们", "申请", "政府", "帮助", "如何", "怎么"],
}


def detect_language(text: str) -> str:
    text_lower = text.lower()
    for lang, keywords in DIALECT_KEYWORDS.items():
        if any(keyword in text_lower for keyword in keywords):
            return lang

    cjk_count = sum(1 for char in text if "\u4E00" <= char <= "\u9FFF" or "\u3040" <= char <= "\u309F")
    if text and cjk_count / len(text) > 0.15:
        return "zh-cn"

    try:
        detected = langdetect.detect(text)
        return DIALECT_MAP.get(detected, "en")
    except Exception:
        return "en"


_query_cache: dict[tuple, dict[str, Any]] = {}
CACHE_MAX_SIZE = 200

_augmenter: Optional[QueryAugmenter] = None


def _get_augmenter() -> QueryAugmenter:
    global _augmenter
    if _augmenter is None:
        _augmenter = QueryAugmenter()
    return _augmenter


def _sanitize_question(question: str) -> str:
    question = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", " ", question)
    question = question.replace("{", "{{").replace("}", "}}")
    return question[:500].strip()


def _normalize_model_name(model_override: str | None) -> str:
    return (model_override or GROQ_MODEL).strip().lower()


def _cache_key(
    question: str,
    document_id: str,
    *,
    model_override: str | None = None,
    enable_query_augmentation: bool = True,
) -> tuple[str, str, str, bool]:
    return (
        question.strip().lower(),
        document_id,
        _normalize_model_name(model_override),
        bool(enable_query_augmentation),
    )


def cache_get(
    question: str,
    document_id: str,
    *,
    model_override: str | None = None,
    enable_query_augmentation: bool = True,
) -> dict[str, Any] | None:
    entry = _query_cache.get(
        _cache_key(
            question,
            document_id,
            model_override=model_override,
            enable_query_augmentation=enable_query_augmentation,
        )
    )
    if entry:
        logger.info("[Cache] HIT for question: %s", question[:60])
    return entry


def cache_set(
    question: str,
    document_id: str,
    result: dict[str, Any],
    *,
    model_override: str | None = None,
    enable_query_augmentation: bool = True,
) -> None:
    global _query_cache
    if len(_query_cache) >= CACHE_MAX_SIZE:
        evict_n = max(1, CACHE_MAX_SIZE // 5)
        for key in list(_query_cache.keys())[:evict_n]:
            del _query_cache[key]
    _query_cache[
        _cache_key(
            question,
            document_id,
            model_override=model_override,
            enable_query_augmentation=enable_query_augmentation,
        )
    ] = result


def cache_invalidate_document(document_id: str) -> int:
    global _query_cache
    before = len(_query_cache)
    _query_cache = {key: value for key, value in _query_cache.items() if key[1] != document_id}
    removed = before - len(_query_cache)
    if removed:
        logger.info("[Cache] Invalidated %d entries for document_id=%s", removed, document_id)
    return removed


def get_embeddings_cohere(texts: list[str], input_type: str = "search_document") -> list[list[float]]:
    cohere_key = os.getenv("COHERE_API_KEY")
    if not cohere_key:
        raise ValueError("COHERE_API_KEY not set.")

    response = requests.post(
        "https://api.cohere.ai/v1/embed",
        json={
            "texts": texts,
            "model": "embed-multilingual-v3.0",
            "input_type": input_type,
        },
        headers={
            "Authorization": f"Bearer {cohere_key}",
            "Content-Type": "application/json",
        },
        timeout=30,
    )
    response.raise_for_status()
    embeddings = response.json().get("embeddings", [])
    if not embeddings:
        raise RuntimeError("Cohere returned an empty embeddings response.")
    return embeddings


class PDFValidationError(ValueError):
    pass


OCR_UNAVAILABLE_MESSAGE = (
    "OCR is not available because Tesseract is not installed or is not configured. "
    "Install Tesseract OCR, or set TESSERACT_CMD in backend/.env to the full path of tesseract.exe."
)
_ocr_runtime_available: Optional[bool] = None


def _ocr_is_available() -> bool:
    global _ocr_runtime_available

    if fitz is None or pytesseract is None or Image is None:
        return False

    if _ocr_runtime_available is not None:
        return _ocr_runtime_available

    _configure_tesseract()
    try:
        pytesseract.get_tesseract_version()
        _ocr_runtime_available = True
    except Exception as exc:
        logger.warning("[OCR] %s Details: %s", OCR_UNAVAILABLE_MESSAGE, exc)
        _ocr_runtime_available = False

    return _ocr_runtime_available


def _configure_tesseract() -> None:
    if pytesseract is None:
        return
    tesseract_cmd = os.getenv("TESSERACT_CMD", "").strip()
    if tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = tesseract_cmd


def _pixmap_to_image(pixmap) -> Image.Image:
    mode = "RGBA" if pixmap.alpha else "RGB"
    return Image.frombytes(mode, [pixmap.width, pixmap.height], pixmap.samples)


def _ocr_pdf_pages(pdf_path: str, page_numbers: Optional[list[int]] = None) -> tuple[str, dict[str, Any]]:
    if not _ocr_is_available():
        return "", {
            "method": "none",
            "pages_ocrd": 0,
            "char_count": 0,
            "ocr_error": OCR_UNAVAILABLE_MESSAGE,
        }

    _configure_tesseract()
    doc = fitz.open(pdf_path)
    extracted_pages: list[str] = []

    try:
        indices = page_numbers if page_numbers is not None else list(range(len(doc)))
        for page_number in indices:
            page = doc.load_page(page_number)
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
            try:
                text = pytesseract.image_to_string(
                    _pixmap_to_image(pix),
                    lang=os.getenv("TESSERACT_LANGS", "eng+msa+chi_sim"),
                ).strip()
            except Exception as exc:
                logger.warning("[OCR] Failed on page %d: %s", page_number + 1, exc)
                text = ""
            extracted_pages.append(text)
    finally:
        doc.close()

    text = "\n".join(page for page in extracted_pages if page).strip()
    return text, {
        "method": "ocr",
        "pages_ocrd": len(extracted_pages),
        "char_count": len(text),
    }


def _ocr_pdf_page_map(pdf_path: str, page_numbers: list[int]) -> tuple[dict[int, str], dict[str, Any]]:
    if not _ocr_is_available() or not page_numbers:
        return {}, {
            "method": "none",
            "pages_ocrd": 0,
            "char_count": 0,
            "ocr_error": OCR_UNAVAILABLE_MESSAGE if page_numbers else None,
        }

    _configure_tesseract()
    doc = fitz.open(pdf_path)
    page_map: dict[int, str] = {}

    try:
        for page_number in page_numbers:
            page = doc.load_page(page_number)
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
            try:
                text = pytesseract.image_to_string(
                    _pixmap_to_image(pix),
                    lang=os.getenv("TESSERACT_LANGS", "eng+msa+chi_sim"),
                ).strip()
            except Exception as exc:
                logger.warning("[OCR] Failed on page %d: %s", page_number + 1, exc)
                text = ""
            if text:
                page_map[page_number] = text
    finally:
        doc.close()

    joined_text = "\n".join(page_map.values()).strip()
    return page_map, {
        "method": "ocr",
        "pages_ocrd": len(page_map),
        "char_count": len(joined_text),
    }


def validate_pdf(pdf_path: str) -> dict[str, Any]:
    metrics = {
        "valid": False,
        "page_count": 0,
        "char_count": 0,
        "empty_pages": 0,
        "avg_chars_per_page": 0.0,
        "error": None,
    }

    try:
        reader = PdfReader(pdf_path)
    except Exception as exc:
        metrics["error"] = f"Cannot open PDF: {exc}"
        return metrics

    page_count = len(reader.pages)
    metrics["page_count"] = page_count
    if page_count < MIN_PAGES:
        metrics["error"] = "PDF has no pages."
        return metrics
    if page_count > MAX_PAGES:
        metrics["error"] = f"PDF too large ({page_count} pages; max {MAX_PAGES})."
        return metrics

    total_chars = 0
    empty_pages = 0
    for page in reader.pages:
        try:
            text = (page.extract_text() or "").strip()
            total_chars += len(text)
            if len(text) < MIN_TEXT_LENGTH:
                empty_pages += 1
        except Exception:
            empty_pages += 1

    metrics["char_count"] = total_chars
    metrics["empty_pages"] = empty_pages
    metrics["avg_chars_per_page"] = round(total_chars / max(page_count, 1), 1)

    if total_chars < MIN_TEXT_LENGTH:
        metrics["error"] = (
            "PDF has no extractable text."
            + (" OCR fallback will be attempted." if _ocr_is_available() else " It may be scanned/image-based.")
        )
        return metrics
    if empty_pages / max(page_count, 1) > 0.8:
        metrics["error"] = f"Over 80% of pages ({empty_pages}/{page_count}) have no text."
        return metrics

    metrics["valid"] = True
    return metrics


def extract_pages_from_pdf(pdf_path: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    quality = validate_pdf(pdf_path)
    page_texts: list[str] = []
    pages_needing_ocr: list[int] = []

    try:
        reader = PdfReader(pdf_path)
    except Exception as exc:
        raise PDFValidationError(f"Cannot open PDF: {exc}") from exc

    for page_index, page in enumerate(reader.pages):
        try:
            text = (page.extract_text() or "").strip()
        except Exception:
            text = ""

        if len(text) >= MIN_TEXT_LENGTH:
            page_texts.append(text)
            continue

        page_texts.append("")
        pages_needing_ocr.append(page_index)

    ocr_metrics = {"method": "none", "pages_ocrd": 0, "char_count": 0}
    if pages_needing_ocr and _ocr_is_available():
        ocr_page_map, ocr_metrics = _ocr_pdf_page_map(pdf_path, pages_needing_ocr)
        for page_index, page_text in ocr_page_map.items():
            page_texts[page_index] = page_text

    text = "\n".join(page_text for page_text in page_texts if page_text).strip()
    if text:
        ocr_pages_used = sum(1 for page_index in pages_needing_ocr if page_texts[page_index])
        extraction_method = "ocr" if ocr_pages_used == len(page_texts) else "hybrid" if ocr_pages_used else "text"
        merged_quality = {
            **quality,
            **ocr_metrics,
            "valid": True,
            "char_count": len(text),
            "empty_pages": sum(1 for page_text in page_texts if len(page_text) < MIN_TEXT_LENGTH),
            "avg_chars_per_page": round(len(text) / max(len(page_texts), 1), 1),
            "extraction_method": extraction_method,
            "pages_ocrd": ocr_pages_used,
        }
        if ocr_pages_used:
            logger.info(
                "[OCR] Filled %d/%d low-text pages for PDF",
                ocr_pages_used,
                len(page_texts),
            )
        pages = [
            {"page_number": page_index + 1, "text": page_text.strip()}
            for page_index, page_text in enumerate(page_texts)
            if page_text.strip()
        ]
        return pages, merged_quality

    if not quality["valid"]:
        raise PDFValidationError(quality["error"])

    raise PDFValidationError("No text extracted from PDF.")


def extract_text_from_pdf(pdf_path: str) -> tuple[str, dict[str, Any]]:
    pages, quality = extract_pages_from_pdf(pdf_path)
    return "\n".join(page["text"] for page in pages).strip(), quality


SECTION_HEADER_RE = re.compile(
    r"^\s*((?:bab|bahagian|seksyen|section|part|chapter|article|perkara)\s+\w+|"
    r"\d+(?:\.\d+){0,4}\s+.{3,}|[A-Z][A-Z0-9\s,()/-]{8,})\s*$",
    re.IGNORECASE,
)


def _word_count(text: str) -> int:
    return len(text.split())


def _is_section_header(line: str) -> bool:
    stripped = line.strip()
    if len(stripped) < 4 or len(stripped) > 140:
        return False
    if stripped.endswith(".") and not re.match(r"^\d+(?:\.\d+)*\s+", stripped):
        return False
    return bool(SECTION_HEADER_RE.match(stripped))


def _split_page_sections(text: str, fallback_title: str) -> list[dict[str, str]]:
    sections: list[dict[str, str]] = []
    current_title = fallback_title
    current_lines: list[str] = []

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            if current_lines:
                current_lines.append("")
            continue

        if _is_section_header(line) and current_lines:
            body = "\n".join(current_lines).strip()
            if body:
                sections.append({"title": current_title, "text": body})
            current_title = line
            current_lines = [line]
            continue

        if _is_section_header(line) and not current_lines:
            current_title = line
        current_lines.append(line)

    body = "\n".join(current_lines).strip()
    if body:
        sections.append({"title": current_title, "text": body})
    return sections


def _split_long_section(text: str) -> list[str]:
    paragraphs = [para.strip() for para in re.split(r"\n\s*\n", text) if para.strip()]
    if len(paragraphs) <= 1:
        words = text.split()
        chunks: list[str] = []
        step = max(1, CHUNK_MAX_WORDS - CHUNK_OVERLAP_WORDS)
        for index in range(0, len(words), step):
            chunk = " ".join(words[index:index + CHUNK_MAX_WORDS]).strip()
            if _word_count(chunk) >= MIN_CHUNK_WORDS:
                chunks.append(chunk)
        return chunks

    chunks: list[str] = []
    current: list[str] = []
    current_words = 0

    for paragraph in paragraphs:
        paragraph_words = _word_count(paragraph)
        if current and current_words + paragraph_words > CHUNK_MAX_WORDS:
            chunks.append("\n\n".join(current).strip())
            overlap_words = " ".join(" ".join(current).split()[-CHUNK_OVERLAP_WORDS:])
            current = [overlap_words, paragraph] if overlap_words else [paragraph]
            current_words = _word_count(" ".join(current))
        else:
            current.append(paragraph)
            current_words += paragraph_words

    if current:
        chunks.append("\n\n".join(current).strip())
    return [chunk for chunk in chunks if _word_count(chunk) >= MIN_CHUNK_WORDS]


def chunk_pages(pages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []
    last_section_title = "Document"

    for page in pages:
        page_number = int(page["page_number"])
        sections = _split_page_sections(page["text"], last_section_title)
        for section in sections:
            section_title = section["title"] or last_section_title
            last_section_title = section_title
            section_text = section["text"].strip()
            if _word_count(section_text) < MIN_CHUNK_WORDS:
                continue

            pieces = (
                [section_text]
                if _word_count(section_text) <= CHUNK_TARGET_WORDS
                else _split_long_section(section_text)
            )
            for piece in pieces:
                chunks.append({
                    "text": piece,
                    "page_start": page_number,
                    "page_end": page_number,
                    "section_title": section_title,
                })

    logger.info(
        "[Chunk] %d pages -> %d section-aware chunks",
        len(pages),
        len(chunks),
    )
    return chunks


def ingest_document(
    pdf_path: str,
    document_id: str,
    document_name: str | None = None,
) -> tuple[int, dict[str, Any]]:
    logger.info("[Ingest] Starting: document_id=%s name=%s", document_id, document_name or "unknown")
    pages, quality = extract_pages_from_pdf(pdf_path)
    if not pages:
        raise ValueError("No text extracted from PDF.")

    chunks = chunk_pages(pages)
    if not chunks:
        raise ValueError("No valid chunks after filtering.")

    chunk_texts = [chunk["text"] for chunk in chunks]
    t0 = time.time()
    embeddings = get_embeddings_cohere(chunk_texts)
    logger.info("[Ingest] Embedded %d chunks in %dms", len(chunks), round((time.time() - t0) * 1000))

    index = Pinecone(api_key=PINECONE_API_KEY).Index(PINECONE_INDEX)
    vectors = [
        (
            f"{document_id}_{i}",
            embedding,
            {
                "text": chunk["text"],
                "doc_id": document_id,
                "chunk_index": i,
                "doc_name": document_name or "",
                "page_start": chunk["page_start"],
                "page_end": chunk["page_end"],
                "section_title": chunk["section_title"],
            },
        )
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings))
    ]
    index.upsert(vectors=vectors, namespace=document_id)
    return len(chunks), quality


def _get_index():
    return Pinecone(api_key=PINECONE_API_KEY).Index(PINECONE_INDEX)


def _query_variant_weight(variant_type: str) -> float:
    if variant_type == "original":
        return 0.03
    if variant_type == "translation":
        return 0.015
    return 0.0


def _clean_augmented_query_text(text: str, fallback: str) -> str:
    cleaned = text.strip()
    if not cleaned:
        return ""

    fenced_match = re.search(r"```(?:\w+)?\s*([\s\S]*?)```", cleaned)
    if fenced_match:
        cleaned = fenced_match.group(1).strip()

    # Drop common label / explanation lines the model sometimes adds.
    lines = [line.strip() for line in cleaned.splitlines() if line.strip()]
    filtered_lines: list[str] = []
    for line in lines:
        lowered = line.lower()
        if lowered.startswith(("translated question:", "translation:", "reason:", "explanation:")):
            continue
        if lowered.startswith(("soalan diterjemah:", "soalan:", "terjemahan:", "alasan:")):
            continue
        if lowered.startswith(("问题翻译：", "翻译：", "原因：", "说明：")):
            continue
        filtered_lines.append(line)

    if filtered_lines:
        cleaned = " ".join(filtered_lines).strip()

    cleaned = re.sub(r"[*_`#>\-]{1,}", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" :;-")

    fallback_normalized = fallback.strip().lower()
    cleaned_normalized = cleaned.lower()
    if not cleaned:
        return ""
    if cleaned_normalized == fallback_normalized:
        return ""
    if len(cleaned) > 240:
        return ""
    if any(marker in cleaned_normalized for marker in ["because", "reason", "penjelasan", "explanation"]):
        return ""

    return cleaned


def _build_query_variants(question: str, detected_lang: str, enable_query_augmentation: bool = True) -> list[dict[str, str]]:
    variants = [{
        "key": detected_lang,
        "text": question,
        "variant_type": "original",
    }]

    if not ENABLE_QUERY_AUGMENTATION or not enable_query_augmentation:
        return variants

    try:
        augmenter = _get_augmenter()
        translation_slots = max(
            0,
            AUGMENTATION_MAX_VARIANTS - 1 - (1 if AUGMENTATION_INCLUDE_PARAPHRASE else 0),
        )
        target_langs = [
            lang for lang in ["en", "ms", "zh-cn"]
            if lang != detected_lang
        ][:translation_slots]
        expanded = augmenter.expand_query(
            query=question,
            source_lang=detected_lang,
            target_langs=target_langs,
            include_paraphrase=AUGMENTATION_INCLUDE_PARAPHRASE,
        )

        for key, text in expanded.items():
            cleaned_text = _clean_augmented_query_text(text, question)
            if not cleaned_text:
                continue
            variant_type = "paraphrase" if key.startswith("paraphrase_") else "translation"
            variants.append({
                "key": key,
                "text": cleaned_text,
                "variant_type": variant_type,
            })
    except Exception as exc:
        logger.warning("[Augment] Falling back to original query only: %s", exc)

    deduped: list[dict[str, str]] = []
    seen = set()
    for variant in variants:
        normalized = variant["text"].strip().lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(variant)
        if len(deduped) >= AUGMENTATION_MAX_VARIANTS:
            break
    return deduped


def _call_cohere_rerank(query: str, documents: list[str], top_n: int) -> list[dict] | None:
    """Low-level Cohere rerank call. Returns raw results list or None on failure."""
    cohere_key = os.getenv("COHERE_API_KEY")
    if not cohere_key:
        return None
    try:
        response = requests.post(
            "https://api.cohere.ai/v1/rerank",
            json={
                "query": query,
                "documents": documents,
                "model": "rerank-multilingual-v3.0",
                "top_n": top_n,
            },
            headers={
                "Authorization": f"Bearer {cohere_key}",
                "Content-Type": "application/json",
            },
            timeout=10,
        )
        response.raise_for_status()
        return response.json().get("results", [])
    except Exception as exc:
        logger.warning("[CohereRerank] Call failed: %s", exc)
        return None


def _cohere_rerank(question: str, matches: list[dict[str, Any]], top_n: int) -> list[dict[str, Any]]:
    cohere_key = os.getenv("COHERE_API_KEY")
    if not ENABLE_COHERE_RERANK or not cohere_key or len(matches) <= 1:
        return matches[:top_n]

    documents = [match["metadata"].get("text", "") for match in matches]
    results = _call_cohere_rerank(question, documents, top_n=min(top_n, len(documents)))
    if results is None:
        logger.warning("[Rerank] Cohere rerank failed, using vector order")
        return matches[:top_n]

    reranked: list[dict[str, Any]] = []
    for result in results:
        index = result.get("index")
        if index is None or index >= len(matches):
            continue
        relevance = float(result.get("relevance_score", 0.0) or 0.0)
        match = {**matches[index]}
        match["cohere_rerank_score"] = relevance
        match["reranked_score"] = min(
            1.0,
            (match.get("reranked_score", 0.0) * 0.35) + (relevance * 0.65),
        )
        reranked.append(match)

    return reranked or matches[:top_n]


def _compute_faithfulness(answer: str, source_chunks: list[str]) -> Optional[float]:
    """
    Compute faithfulness: how grounded the answer is in the retrieved chunks.
    Uses the Cohere reranker with the answer as query and chunks as documents.
    Highest relevance_score = faithfulness for this query.
    Returns None if reranking is disabled or answer/chunks are empty.
    """
    cohere_key = os.getenv("COHERE_API_KEY")
    if not ENABLE_COHERE_RERANK or not cohere_key or not source_chunks or not answer.strip():
        return None
    documents = [chunk for chunk in source_chunks if chunk.strip()]
    if not documents:
        return None
    results = _call_cohere_rerank(answer, documents, top_n=len(documents))
    if not results:
        return None
    return round(max(r.get("relevance_score", 0.0) for r in results), 4)


def _retrieve_matches(
    document_id: str,
    query_variants: list[dict[str, str]],
    top_k: int,
) -> list[dict[str, Any]]:
    index = _get_index()
    all_matches: list[dict[str, Any]] = []

    for variant in query_variants:
        embedding = get_embeddings_cohere([variant["text"]], input_type="search_query")[0]
        results = index.query(
            vector=embedding,
            top_k=top_k,
            namespace=document_id,
            include_metadata=True,
        )

        for match in results["matches"]:
            metadata = match.get("metadata", {})
            reranked_score = min(1.0, match.get("score", 0.0) + _query_variant_weight(variant["variant_type"]))
            all_matches.append({
                "id": match.get("id"),
                "score": match.get("score", 0.0),
                "reranked_score": reranked_score,
                "metadata": metadata,
                "variant_key": variant["key"],
                "variant_text": variant["text"],
                "variant_type": variant["variant_type"],
            })

    deduped_by_chunk: dict[str, dict[str, Any]] = {}
    for match in all_matches:
        chunk_identity = match["id"] or match["metadata"].get("text", "")[:200]
        current = deduped_by_chunk.get(chunk_identity)
        if current is None or match["reranked_score"] > current["reranked_score"]:
            deduped_by_chunk[chunk_identity] = match

    reranked = sorted(
        deduped_by_chunk.values(),
        key=lambda item: (item["reranked_score"], item["score"]),
        reverse=True,
    )
    primary_question = query_variants[0]["text"] if query_variants else ""
    return _cohere_rerank(primary_question, reranked, top_k)


def _filter_matches(matches: list[dict[str, Any]], is_summary: bool) -> list[dict[str, Any]]:
    if is_summary:
        return matches

    filtered = [match for match in matches if match["reranked_score"] >= CONFIDENCE_THRESHOLD]
    return filtered or matches[:1]


def _has_sufficient_evidence(matches: list[dict[str, Any]], is_summary: bool) -> bool:
    if is_summary:
        return True
    if not matches:
        return False
    return matches[0]["reranked_score"] >= CONFIDENCE_THRESHOLD


def _build_context(matches: list[dict[str, Any]], small_model: bool) -> str:
    char_limit = CONTEXT_CHAR_LIMIT_SMALL if small_model else CONTEXT_CHAR_LIMIT_LARGE
    chunk_limit = max(200, char_limit // max(len(matches), 1))
    context_blocks: list[str] = []
    for index, match in enumerate(matches, start=1):
        metadata = match["metadata"]
        page_start = metadata.get("page_start")
        page_end = metadata.get("page_end")
        page_label = (
            f"pages {page_start}-{page_end}"
            if page_start and page_end and page_start != page_end
            else f"page {page_start}"
            if page_start
            else "page unknown"
        )
        section = metadata.get("section_title") or "Untitled section"
        context_blocks.append(
            f"[Source {index}: {metadata.get('doc_name') or 'Document'}, {page_label}, section: {section}]\n"
            f"{metadata['text'][:chunk_limit]}"
        )
    return "\n\n".join(context_blocks)


def _summary_prompt(context: str, lang: str) -> str:
    prompts = {
        "en": (
            "You are a helpful government services assistant.\n"
            "Read the following excerpts from an official document and write a clear summary.\n\n"
            "Document excerpts:\n{context}\n\n"
            "INSTRUCTIONS:\n"
            "1. Write 3-5 bullet points summarising what this document is about.\n"
            "2. Each bullet must be one short simple sentence.\n"
            "3. Mention the document purpose, who it is for, and the main points.\n"
            "4. Do not invent facts not in the excerpts.\n"
            "5. End with: Source: Based on official documents provided."
        ),
        "ms": (
            "Anda ialah pembantu perkhidmatan kerajaan.\n"
            "Baca petikan dokumen rasmi berikut dan tulis ringkasan yang jelas.\n\n"
            "Petikan dokumen:\n{context}\n\n"
            "ARAHAN:\n"
            "1. Tulis 3-5 mata peluru tentang dokumen ini.\n"
            "2. Setiap mata peluru mesti satu ayat pendek dan mudah.\n"
            "3. Nyatakan tujuan dokumen, untuk siapa, dan perkara utama.\n"
            "4. Jangan reka maklumat yang tiada dalam petikan.\n"
            "5. Akhiri dengan: Sumber: Berdasarkan dokumen rasmi yang disediakan."
        ),
        "zh-cn": (
            "你是一位政府服务助手。\n"
            "请阅读以下官方文件摘录并写出清楚的摘要。\n\n"
            "文件摘录:\n{context}\n\n"
            "要求:\n"
            "1. 用3到5个要点总结文件内容。\n"
            "2. 每个要点都要短而易懂。\n"
            "3. 说明文件目的、适用对象和重点。\n"
            "4. 不要编造摘录里没有的信息。\n"
            "5. 结尾写: 来源: Based on official documents provided."
        ),
    }
    return prompts.get(lang, prompts["en"]).format(context=context)


def _qa_prompt(context: str, question: str, lang: str) -> str:
    prompts = {
        "en": (
            "You are a helpful government services assistant.\n"
            "Answer only from the context.\n"
            "Use simple everyday language.\n"
            "Format the answer as 3-5 short bullet points.\n"
            "End with: Source: Based on official documents provided.\n\n"
            "Context:\n{context}\n\n"
            "Question: {question}\n"
            "Answer:"
        ),
        "ms": (
            "Anda ialah pembantu perkhidmatan kerajaan.\n"
            "Jawab hanya daripada konteks.\n"
            "Gunakan bahasa yang mudah.\n"
            "Format jawapan sebagai 3-5 mata peluru pendek.\n"
            "Akhiri dengan: Sumber: Berdasarkan dokumen rasmi yang disediakan.\n\n"
            "Konteks:\n{context}\n\n"
            "Soalan: {question}\n"
            "Jawapan:"
        ),
        "zh-cn": (
            "你是一位政府服务助手。\n"
            "只能根据上下文回答。\n"
            "使用简单易懂的语言。\n"
            "把答案写成3到5个简短要点。\n"
            "结尾写: 来源: Based on official documents provided.\n\n"
            "上下文:\n{context}\n\n"
            "问题: {question}\n"
            "答案:"
        ),
    }
    return prompts.get(lang, prompts["en"]).format(context=context, question=question)


def _cautious_qa_prompt(context: str, question: str, lang: str) -> str:
    prompts = {
        "en": (
            "You are a careful government services assistant.\n"
            "The retrieved excerpts may only partially match the user's question.\n"
            "Use only the context below. Do not use outside knowledge.\n"
            "If the context contains useful information, answer cautiously and mention any limits.\n"
            "If the context truly does not answer the question, say that clearly.\n"
            "Format the answer as 3-5 short bullet points.\n"
            "End with: Source: Based on official documents provided.\n\n"
            "Context:\n{context}\n\n"
            "Question: {question}\n"
            "Answer:"
        ),
        "ms": (
            "Anda ialah pembantu perkhidmatan kerajaan yang berhati-hati.\n"
            "Petikan yang ditemui mungkin hanya sebahagiannya sepadan dengan soalan pengguna.\n"
            "Gunakan konteks di bawah sahaja. Jangan guna pengetahuan luar.\n"
            "Jika konteks mengandungi maklumat berguna, jawab dengan berhati-hati dan nyatakan hadnya.\n"
            "Jika konteks memang tidak menjawab soalan, nyatakan perkara itu dengan jelas.\n"
            "Format jawapan sebagai 3-5 mata peluru pendek.\n"
            "Akhiri dengan: Sumber: Berdasarkan dokumen rasmi yang disediakan.\n\n"
            "Konteks:\n{context}\n\n"
            "Soalan: {question}\n"
            "Jawapan:"
        ),
        "zh-cn": (
            "你是一位谨慎的政府服务助手。\n"
            "检索到的摘录可能只是部分匹配用户的问题。\n"
            "只能使用下方上下文，不要使用外部知识。\n"
            "如果上下文有有用信息，请谨慎回答并说明限制。\n"
            "如果上下文确实无法回答问题，请清楚说明。\n"
            "把答案写成3到5个简短要点。\n"
            "结尾写: 来源: Based on official documents provided.\n\n"
            "上下文:\n{context}\n\n"
            "问题: {question}\n"
            "答案:"
        ),
    }
    return prompts.get(lang, prompts["en"]).format(context=context, question=question)


def _insufficient_evidence_answer(lang: str) -> str:
    answers = {
        "en": (
            "- I cannot answer this confidently from the uploaded document.\n"
            "- The retrieved evidence is too weak or does not directly address your question.\n"
            "- Try asking with more specific terms, or upload a document that contains this information.\n"
            "- You can also open the source excerpt below to check the closest matching passage.\n\n"
            "Source: Based on official documents provided."
        ),
        "ms": (
            "- Saya tidak dapat menjawab dengan yakin berdasarkan dokumen yang dimuat naik.\n"
            "- Bukti yang ditemui terlalu lemah atau tidak menjawab soalan anda secara langsung.\n"
            "- Cuba tanya dengan istilah yang lebih khusus, atau muat naik dokumen yang mengandungi maklumat ini.\n"
            "- Anda juga boleh buka petikan sumber di bawah untuk semak padanan terdekat.\n\n"
            "Sumber: Berdasarkan dokumen rasmi yang disediakan."
        ),
        "zh-cn": (
            "- 我无法仅根据已上传的文件自信地回答这个问题。\n"
            "- 检索到的证据较弱，或没有直接回答你的问题。\n"
            "- 请尝试使用更具体的关键词，或上传包含该信息的文件。\n"
            "- 你也可以展开下方来源，查看最接近的原文片段。\n\n"
            "来源: Based on official documents provided."
        ),
    }
    return answers.get(lang, answers["en"])


def _confidence_label(score: float, sufficient_evidence: bool) -> str:
    if not sufficient_evidence or score < 0.5:
        return "low"
    if score < 0.75:
        return "medium"
    return "high"


def _prepare_pipeline(
    question: str,
    document_id: str,
    model_override: str | None = None,
    enable_query_augmentation: bool = True,
) -> dict[str, Any]:
    t_start = time.time()
    lang = detect_language(question)
    model_name = model_override or GROQ_MODEL
    small_model = _is_small_model(model_name)
    is_summary = is_summarize_intent(question)

    query_variants = _build_query_variants(question, lang, enable_query_augmentation=enable_query_augmentation)
    retrieval_mode = "augmented" if len(query_variants) > 1 else "single_query"
    top_k = ((TOP_K_SMALL + 2) if small_model else (TOP_K_LARGE + 3)) if is_summary else (TOP_K_SMALL if small_model else TOP_K_LARGE)

    t_retrieve = time.time()
    matches = _retrieve_matches(document_id=document_id, query_variants=query_variants, top_k=top_k)
    retrieve_ms = round((time.time() - t_retrieve) * 1000)
    filtered_matches = _filter_matches(matches, is_summary=is_summary)
    if not filtered_matches:
        raise RuntimeError(
            "No document chunks found. The document may not be ingested yet, or the document ID is incorrect."
        )

    context = _build_context(filtered_matches, small_model)
    query_variants_used = [variant["text"] for variant in query_variants]
    top_query_variant = filtered_matches[0]["variant_text"]
    sufficient_evidence = _has_sufficient_evidence(filtered_matches, is_summary=is_summary)
    top_score = filtered_matches[0]["reranked_score"] if filtered_matches else 0.0
    usable_evidence = bool(filtered_matches) and top_score >= MIN_USABLE_CONFIDENCE
    if is_summary:
        evidence_mode = "summary"
        prompt_text = _summary_prompt(context, lang)
    elif sufficient_evidence:
        evidence_mode = "strong"
        prompt_text = _qa_prompt(context, question, lang)
    elif usable_evidence:
        evidence_mode = "cautious"
        prompt_text = _cautious_qa_prompt(context, question, lang)
    else:
        evidence_mode = "insufficient"
        prompt_text = _qa_prompt(context, question, lang)

    logger.info(
        "[Chat] lang=%s retrieval=%s variants=%d matches=%d retrieve_ms=%d evidence=%s score=%.4f",
        lang, retrieval_mode, len(query_variants), len(filtered_matches), retrieve_ms, evidence_mode, top_score,
    )

    return {
        "question": question,
        "document_id": document_id,
        "language": lang,
        "model_name": model_name,
        "small_model": small_model,
        "is_summary": is_summary,
        "prompt_text": prompt_text,
        "filtered_matches": filtered_matches,
        "retrieve_ms": retrieve_ms,
        "retrieval_mode": retrieval_mode,
        "query_variants_used": query_variants_used,
        "top_query_variant": top_query_variant,
        "sufficient_evidence": sufficient_evidence,
        "usable_evidence": usable_evidence,
        "evidence_mode": evidence_mode,
        "started_at": t_start,
    }


def _build_result(prepared: dict[str, Any], answer_text: str, model_used: str) -> dict[str, Any]:
    total_ms = round((time.time() - prepared["started_at"]) * 1000)
    top_score = prepared["filtered_matches"][0]["reranked_score"] if prepared["filtered_matches"] else 0.0
    confidence_label = _confidence_label(top_score, prepared["sufficient_evidence"])
    result = {
        "answer": answer_text.strip(),
        "language": prepared["language"],
        "sources": [
            {
                "text": match["metadata"]["text"][:360],
                "document_id": prepared["document_id"],
                "doc_name": match["metadata"].get("doc_name", ""),
                "page_start": match["metadata"].get("page_start"),
                "page_end": match["metadata"].get("page_end"),
                "section_title": match["metadata"].get("section_title", ""),
                "score": round(match["reranked_score"], 4),
                "vector_score": round(match.get("score", 0.0), 4),
                "rerank_score": round(match.get("cohere_rerank_score", 0.0), 4),
                "confidence_label": _confidence_label(
                    float(match.get("reranked_score", 0.0) or 0.0),
                    prepared["sufficient_evidence"],
                ),
            }
            for match in prepared["filtered_matches"]
        ],
        "confidence": round(top_score, 4),
        "confidence_label": confidence_label,
        "latency_ms": total_ms,
        "cached": False,
        "model_used": model_used,
        "retrieval_mode": prepared["retrieval_mode"],
        "query_variants_used": prepared["query_variants_used"],
        "top_query_variant": prepared["top_query_variant"],
        "sufficient_evidence": prepared["sufficient_evidence"],
        "evidence_mode": prepared.get("evidence_mode", "strong"),
    }
    return result


def _get_client() -> Groq:
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY not set.")
    return Groq(api_key=GROQ_API_KEY)


def _fallback_model(current_model: str) -> str:
    return GROQ_MODEL_FAST if current_model != GROQ_MODEL_FAST else "gemma2-9b-it"


def _is_retryable_llm_error(exc: Exception) -> bool:
    err = str(exc).lower()
    return any(piece in err for piece in ["429", "rate limit", "too many", "413"])


def _is_request_too_large_error(exc: Exception) -> bool:
    err = str(exc).lower()
    return any(piece in err for piece in ["413", "request entity too large", "too large"])


def _truncate_middle(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    if limit <= 120:
        return text[:limit]

    head_len = max(60, int(limit * 0.7))
    tail_len = max(40, limit - head_len - 40)
    return (
        text[:head_len].rstrip()
        + "\n\n[Context shortened because the model request was too large.]\n\n"
        + text[-tail_len:].lstrip()
    )


def _compact_prompt(prompt_text: str, limit: int) -> str:
    if len(prompt_text) <= limit:
        return prompt_text

    context_markers = [
        ("Context:\n", "\n\nQuestion:"),
        ("Konteks:\n", "\n\nSoalan:"),
        ("Document excerpts:\n", "\n\nINSTRUCTIONS:"),
        ("Petikan dokumen:\n", "\n\nARAHAN:"),
    ]
    for start_marker, end_marker in context_markers:
        start = prompt_text.find(start_marker)
        end = prompt_text.find(end_marker, start + len(start_marker))
        if start == -1 or end == -1:
            continue

        prefix = prompt_text[: start + len(start_marker)]
        context = prompt_text[start + len(start_marker):end]
        suffix = prompt_text[end:]
        available = limit - len(prefix) - len(suffix)
        if available <= 200:
            break
        return prefix + _truncate_middle(context, available) + suffix

    return _truncate_middle(prompt_text, limit)


def _create_completion(prompt_text: str, model_name: str, stream: bool):
    return _get_client().chat.completions.create(
        model=model_name,
        messages=[{"role": "user", "content": prompt_text}],
        temperature=0.3,
        stream=stream,
    )


def _generate_completion(prompt_text: str, model_name: str) -> tuple[str, str]:
    try:
        response = _create_completion(prompt_text, model_name, stream=False)
        return response.choices[0].message.content or "", model_name
    except Exception as exc:
        if not _is_retryable_llm_error(exc):
            raise

        if _is_request_too_large_error(exc):
            for limit in PROMPT_RETRY_CHAR_LIMITS:
                compact_prompt = _compact_prompt(prompt_text, limit)
                try:
                    logger.warning("[Chat] Retrying buffered completion with compact prompt (%d chars)", limit)
                    response = _create_completion(compact_prompt, model_name, stream=False)
                    return response.choices[0].message.content or "", model_name
                except Exception as compact_exc:
                    if not _is_request_too_large_error(compact_exc):
                        raise

        fallback = _fallback_model(model_name)
        logger.warning("[Chat] Retrying buffered completion with fallback model %s", fallback)
        try:
            response = _create_completion(prompt_text, fallback, stream=False)
            return response.choices[0].message.content or "", fallback
        except Exception as fallback_exc:
            if not _is_request_too_large_error(fallback_exc):
                raise

            for limit in PROMPT_RETRY_CHAR_LIMITS:
                compact_prompt = _compact_prompt(prompt_text, limit)
                try:
                    logger.warning(
                        "[Chat] Retrying buffered fallback with compact prompt (%d chars)",
                        limit,
                    )
                    response = _create_completion(compact_prompt, fallback, stream=False)
                    return response.choices[0].message.content or "", fallback
                except Exception as compact_fallback_exc:
                    if not _is_request_too_large_error(compact_fallback_exc):
                        raise

            raise


def _token_chunks(text: str, size: int = 40) -> Generator[str, None, None]:
    words = text.split()
    if not words:
        return
    for index in range(0, len(words), size):
        yield " ".join(words[index:index + size]) + " "


def _stream_completion(prompt_text: str, model_name: str) -> tuple[Generator[str, None, None], str]:
    try:
        stream = _create_completion(prompt_text, model_name, stream=True)
        return _read_stream(stream), model_name
    except Exception as exc:
        if not _is_retryable_llm_error(exc):
            logger.warning("[Chat] Streaming unavailable, falling back to buffered completion: %s", exc)
            answer, used_model = _generate_completion(prompt_text, model_name)
            return _token_chunks(answer), used_model

        fallback = _fallback_model(model_name)
        logger.warning("[Chat] Retrying streaming completion with fallback model %s", fallback)
        try:
            stream = _create_completion(prompt_text, fallback, stream=True)
            return _read_stream(stream), fallback
        except Exception as stream_exc:
            logger.warning("[Chat] Streaming fallback failed, using buffered completion: %s", stream_exc)
            compact_prompt = (
                _compact_prompt(prompt_text, PROMPT_RETRY_CHAR_LIMITS[0])
                if _is_request_too_large_error(stream_exc)
                else prompt_text
            )
            answer, used_model = _generate_completion(compact_prompt, fallback)
            return _token_chunks(answer), used_model


def _read_stream(stream) -> Generator[str, None, None]:
    for chunk in stream:
        delta = chunk.choices[0].delta.content or ""
        if delta:
            yield delta


def answer_question(
    question: str,
    document_id: str,
    model_override: str | None = None,
    enable_query_augmentation: bool = True,
    bypass_cache: bool = False,
) -> dict[str, Any]:
    question = _sanitize_question(question)
    cached = None if bypass_cache else cache_get(
        question,
        document_id,
        model_override=model_override,
        enable_query_augmentation=enable_query_augmentation,
    )
    if cached:
        return {**cached, "cached": True}

    prepared = _prepare_pipeline(
        question,
        document_id,
        model_override=model_override,
        enable_query_augmentation=enable_query_augmentation,
    )
    if prepared["sufficient_evidence"] or prepared.get("usable_evidence", False):
        answer_text, model_used = _generate_completion(prepared["prompt_text"], prepared["model_name"])
    else:
        answer_text, model_used = _insufficient_evidence_answer(prepared["language"]), "evidence-guard"
    result = _build_result(prepared, answer_text, model_used)
    cache_set(
        question,
        document_id,
        result,
        model_override=model_override,
        enable_query_augmentation=enable_query_augmentation,
    )
    return result


def stream_answer_question(
    question: str,
    document_id: str,
    model_override: str | None = None,
    enable_query_augmentation: bool = True,
    bypass_cache: bool = False,
) -> Generator[dict[str, Any], None, None]:
    question = _sanitize_question(question)
    cached = None if bypass_cache else cache_get(
        question,
        document_id,
        model_override=model_override,
        enable_query_augmentation=enable_query_augmentation,
    )
    if cached:
        yield {
            "type": "retrieval",
            "language": cached["language"],
            "retrieval_mode": cached.get("retrieval_mode", "single_query"),
            "query_variants_used": cached.get("query_variants_used", [question]),
            "top_query_variant": cached.get("top_query_variant", question),
            "sufficient_evidence": cached.get("sufficient_evidence", True),
            "evidence_mode": cached.get("evidence_mode", "strong"),
        }
        for text in _token_chunks(cached["answer"]):
            yield {"type": "token", "text": text}
        yield {"type": "sources", "sources": cached["sources"]}
        yield {"type": "complete", **{**cached, "cached": True}}
        return

    prepared = _prepare_pipeline(
        question,
        document_id,
        model_override=model_override,
        enable_query_augmentation=enable_query_augmentation,
    )
    yield {
        "type": "retrieval",
        "language": prepared["language"],
        "retrieval_mode": prepared["retrieval_mode"],
        "query_variants_used": prepared["query_variants_used"],
        "top_query_variant": prepared["top_query_variant"],
        "sufficient_evidence": prepared["sufficient_evidence"],
        "evidence_mode": prepared["evidence_mode"],
    }

    pieces: list[str] = []
    if prepared["sufficient_evidence"] or prepared.get("usable_evidence", False):
        token_stream, model_used = _stream_completion(prepared["prompt_text"], prepared["model_name"])
        for piece in token_stream:
            pieces.append(piece)
            yield {"type": "token", "text": piece}
    else:
        model_used = "evidence-guard"
        for piece in _token_chunks(_insufficient_evidence_answer(prepared["language"])):
            pieces.append(piece)
            yield {"type": "token", "text": piece}

    answer_text = "".join(pieces).strip()
    result = _build_result(prepared, answer_text, model_used)
    cache_set(
        question,
        document_id,
        result,
        model_override=model_override,
        enable_query_augmentation=enable_query_augmentation,
    )
    yield {"type": "sources", "sources": result["sources"]}
    yield {"type": "complete", **result}


def delete_document_from_vectorstore(document_id: str) -> None:
    try:
        index = _get_index()
        index.delete(delete_all=True, namespace=document_id)
        cache_invalidate_document(document_id)
        logger.info("[RAG] Deleted document_id=%s", document_id)
    except Exception as exc:
        logger.error("[RAG] Error deleting document_id=%s: %s", document_id, exc)


def rename_document_in_vectorstore(document_id: str, document_name: str, chunk_count: int) -> None:
    if chunk_count <= 0:
        cache_invalidate_document(document_id)
        return

    try:
        index = _get_index()
        updated = 0
        for chunk_index in range(chunk_count):
            index.update(
                id=f"{document_id}_{chunk_index}",
                namespace=document_id,
                set_metadata={"doc_name": document_name},
            )
            updated += 1
        cache_invalidate_document(document_id)
        logger.info("[RAG] Renamed %d vector chunks for document_id=%s", updated, document_id)
    except Exception as exc:
        logger.warning("[RAG] Could not update vector doc_name for %s: %s", document_id, exc)
