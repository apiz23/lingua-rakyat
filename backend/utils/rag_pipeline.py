"""
rag_pipeline.py - Lightweight multilingual RAG pipeline.
"""

import logging
import os
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
GROQ_MODEL = os.getenv("GROQ_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")
GROQ_MODEL_FAST = os.getenv("GROQ_MODEL_FAST", "qwen/qwen3-32b")

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
CONFIDENCE_THRESHOLD = 0.50
OCR_MIN_CHARS = 50

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


def _cache_key(question: str, document_id: str) -> tuple[str, str]:
    return (question.strip().lower(), document_id)


def cache_get(question: str, document_id: str) -> dict[str, Any] | None:
    entry = _query_cache.get(_cache_key(question, document_id))
    if entry:
        logger.info("[Cache] HIT for question: %s", question[:60])
    return entry


def cache_set(question: str, document_id: str, result: dict[str, Any]) -> None:
    global _query_cache
    if len(_query_cache) >= CACHE_MAX_SIZE:
        evict_n = max(1, CACHE_MAX_SIZE // 5)
        for key in list(_query_cache.keys())[:evict_n]:
            del _query_cache[key]
    _query_cache[_cache_key(question, document_id)] = result


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


def _ocr_is_available() -> bool:
    return fitz is not None and pytesseract is not None and Image is not None


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
        return "", {"method": "none", "pages_ocrd": 0, "char_count": 0}

    _configure_tesseract()
    doc = fitz.open(pdf_path)
    extracted_pages: list[str] = []

    try:
        indices = page_numbers if page_numbers is not None else list(range(len(doc)))
        for page_number in indices:
            page = doc.load_page(page_number)
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
            text = pytesseract.image_to_string(
                _pixmap_to_image(pix),
                lang=os.getenv("TESSERACT_LANGS", "eng+msa+chi_sim"),
            ).strip()
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
        return {}, {"method": "none", "pages_ocrd": 0, "char_count": 0}

    _configure_tesseract()
    doc = fitz.open(pdf_path)
    page_map: dict[int, str] = {}

    try:
        for page_number in page_numbers:
            page = doc.load_page(page_number)
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
            text = pytesseract.image_to_string(
                _pixmap_to_image(pix),
                lang=os.getenv("TESSERACT_LANGS", "eng+msa+chi_sim"),
            ).strip()
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


def extract_text_from_pdf(pdf_path: str) -> tuple[str, dict[str, Any]]:
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
        return text, merged_quality

    if not quality["valid"]:
        raise PDFValidationError(quality["error"])

    raise PDFValidationError("No text extracted from PDF.")


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> list[str]:
    chunks = []
    words = text.split()
    for index in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[index:index + chunk_size])
        if len(chunk.split()) >= MIN_CHUNK_WORDS:
            chunks.append(chunk)
    logger.info("[Chunk] %d words -> %d chunks", len(words), len(chunks))
    return chunks


def ingest_document(
    pdf_path: str,
    document_id: str,
    document_name: str | None = None,
) -> tuple[int, dict[str, Any]]:
    logger.info("[Ingest] Starting: document_id=%s name=%s", document_id, document_name or "unknown")
    text, quality = extract_text_from_pdf(pdf_path)
    if not text:
        raise ValueError("No text extracted from PDF.")

    chunks = chunk_text(text)
    if not chunks:
        raise ValueError("No valid chunks after filtering.")

    t0 = time.time()
    embeddings = get_embeddings_cohere(chunks)
    logger.info("[Ingest] Embedded %d chunks in %dms", len(chunks), round((time.time() - t0) * 1000))

    index = Pinecone(api_key=PINECONE_API_KEY).Index(PINECONE_INDEX)
    vectors = [
        (
            f"{document_id}_{i}",
            embedding,
            {
                "text": chunk,
                "doc_id": document_id,
                "chunk_index": i,
                "doc_name": document_name or "",
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


def _build_query_variants(question: str, detected_lang: str, enable_query_augmentation: bool = True) -> list[dict[str, str]]:
    variants = [{
        "key": detected_lang,
        "text": question,
        "variant_type": "original",
    }]

    if not ENABLE_QUERY_AUGMENTATION or not enable_query_augmentation:
        return variants

    try:
        augmenter = QueryAugmenter()
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
            if not text or text.strip() == question.strip():
                continue
            variant_type = "paraphrase" if key.startswith("paraphrase_") else "translation"
            variants.append({
                "key": key,
                "text": text,
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
    return reranked


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
    return "\n".join(match["metadata"]["text"][:chunk_limit] for match in matches)


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
    prompt_text = _summary_prompt(context, lang) if is_summary else _qa_prompt(context, question, lang)
    query_variants_used = [variant["text"] for variant in query_variants]
    top_query_variant = filtered_matches[0]["variant_text"]
    sufficient_evidence = _has_sufficient_evidence(filtered_matches, is_summary=is_summary)

    logger.info(
        "[Chat] lang=%s retrieval=%s variants=%d matches=%d retrieve_ms=%d sufficient=%s",
        lang, retrieval_mode, len(query_variants), len(filtered_matches), retrieve_ms, sufficient_evidence,
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
        "started_at": t_start,
    }


def _build_result(prepared: dict[str, Any], answer_text: str, model_used: str) -> dict[str, Any]:
    total_ms = round((time.time() - prepared["started_at"]) * 1000)
    top_score = prepared["filtered_matches"][0]["reranked_score"] if prepared["filtered_matches"] else 0.0
    result = {
        "answer": answer_text.strip(),
        "language": prepared["language"],
        "sources": [
            {
                "text": match["metadata"]["text"][:200],
                "document_id": prepared["document_id"],
                "score": round(match["reranked_score"], 4),
            }
            for match in prepared["filtered_matches"]
        ],
        "confidence": round(top_score, 4),
        "latency_ms": total_ms,
        "cached": False,
        "model_used": model_used,
        "retrieval_mode": prepared["retrieval_mode"],
        "query_variants_used": prepared["query_variants_used"],
        "top_query_variant": prepared["top_query_variant"],
        "sufficient_evidence": prepared["sufficient_evidence"],
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

        fallback = _fallback_model(model_name)
        logger.warning("[Chat] Retrying buffered completion with fallback model %s", fallback)
        response = _create_completion(prompt_text, fallback, stream=False)
        return response.choices[0].message.content or "", fallback


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
            answer, used_model = _generate_completion(prompt_text, fallback)
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
) -> dict[str, Any]:
    cached = cache_get(question, document_id)
    if cached:
        return {**cached, "cached": True}

    prepared = _prepare_pipeline(
        question,
        document_id,
        model_override=model_override,
        enable_query_augmentation=enable_query_augmentation,
    )
    if prepared["sufficient_evidence"]:
        answer_text, model_used = _generate_completion(prepared["prompt_text"], prepared["model_name"])
    else:
        answer_text, model_used = _insufficient_evidence_answer(prepared["language"]), "evidence-guard"
    result = _build_result(prepared, answer_text, model_used)
    cache_set(question, document_id, result)
    return result


def stream_answer_question(
    question: str,
    document_id: str,
    model_override: str | None = None,
    enable_query_augmentation: bool = True,
) -> Generator[dict[str, Any], None, None]:
    cached = cache_get(question, document_id)
    if cached:
        yield {
            "type": "retrieval",
            "language": cached["language"],
            "retrieval_mode": cached.get("retrieval_mode", "single_query"),
            "query_variants_used": cached.get("query_variants_used", [question]),
            "top_query_variant": cached.get("top_query_variant", question),
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
    }

    pieces: list[str] = []
    if prepared["sufficient_evidence"]:
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
    cache_set(question, document_id, result)
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
