"""
rag_pipeline.py — Lightweight RAG Pipeline
"""

import os
import re
import time
import logging
import requests
import langdetect
from typing import Optional
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from pypdf import PdfReader
from pinecone import Pinecone

load_dotenv()

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("rag_pipeline")

# ─── Configuration ────────────────────────────────────────────────────────────
GROQ_API_KEY    = os.getenv("GROQ_API_KEY")
GROQ_MODEL      = os.getenv("GROQ_MODEL",      "meta-llama/llama-4-scout-17b-16e-instruct")
GROQ_MODEL_FAST = os.getenv("GROQ_MODEL_FAST", "qwen/qwen3-32b")
LLM_PROVIDER    = os.getenv("LLM_PROVIDER", "groq")

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX   = os.getenv("PINECONE_INDEX", "docuquery")

# ─── Thresholds ───────────────────────────────────────────────────────────────
MIN_TEXT_LENGTH      = 50
MIN_PAGES            = 1
MAX_PAGES            = 500
MIN_CHUNK_WORDS      = 20
CONFIDENCE_THRESHOLD = 0.50

# Context budget — keeps requests under TPM limits
CONTEXT_CHAR_LIMIT_LARGE = 4000
CONTEXT_CHAR_LIMIT_SMALL = 1800
TOP_K_LARGE = 5
TOP_K_SMALL = 3

# ─── Summarise intent keywords ────────────────────────────────────────────────
SUMMARIZE_KEYWORDS: list[str] = [
    "summarize","summarise","summary","overview","what is this document",
    "what does this document","what is this about","explain this document",
    "key takeaways","main points","give me an overview","what should i know",
    "tell me about this","describe this document","ringkaskan","ringkasan",
    "rumusan","apa isi","apakah dokumen","ceritakan","terangkan dokumen",
    "apa yang penting","kandungan dokumen","huraikan","jelaskan dokumen",
    "apa dokumen ini","总结","概述","摘要","这个文件","主要内容",
]

def is_summarize_intent(question: str) -> bool:
    q = question.lower().strip()
    return any(kw in q for kw in SUMMARIZE_KEYWORDS)

# ─── Model helpers ────────────────────────────────────────────────────────────
def _is_small_model(model_name: str) -> bool:
    return any(p in model_name.lower() for p in ["8b","gemma","7b","9b","mixtral"])

# ─── Dialect & Language Detection ────────────────────────────────────────────
DIALECT_MAP: dict[str, str] = {
    "ms": "ms", "id": "ms", "zsm": "ms",
    "zh-cn": "zh-cn", "zh-tw": "zh-cn", "zh": "zh-cn", "yue": "zh-cn",
    "tl": "en", "fil": "en", "th": "en", "vi": "en",
    "km": "en", "lo": "en", "my": "en",
    "jv": "ms", "su": "ms", "ceb": "en", "ilo": "en",
}

DIALECT_KEYWORDS: dict[str, list[str]] = {
    "ms": ["nak","boleh","pergi","saya","awak","kamu","dia","kami",
           "mereka","ini","itu","dengan","untuk","tidak","ada","kalau",
           "mohon","bantuan","kerajaan","permohonan","kelayakan"],
    "zh-cn": ["的","是","了","在","我","你","他","她","们","申请",
              "政府","帮助","如何","怎么"],
}

def detect_language(text: str) -> str:
    text_lower = text.lower()
    for lang, keywords in DIALECT_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            return lang
    cjk_count = sum(1 for c in text if "\u4E00" <= c <= "\u9FFF" or "\u3040" <= c <= "\u309F")
    if len(text) > 0 and cjk_count / len(text) > 0.15:
        return "zh-cn"
    try:
        detected = langdetect.detect(text)
        return DIALECT_MAP.get(detected, "en")
    except Exception:
        return "en"

# ─── Query Cache ──────────────────────────────────────────────────────────────
_query_cache: dict[tuple, dict] = {}
CACHE_MAX_SIZE = 200

def _cache_key(question: str, document_id: str) -> tuple:
    return (question.strip().lower(), document_id)

def cache_get(question: str, document_id: str) -> dict | None:
    key = _cache_key(question, document_id)
    entry = _query_cache.get(key)
    if entry:
        logger.info("[Cache] HIT for question: %s", question[:60])
    return entry

def cache_set(question: str, document_id: str, result: dict) -> None:
    global _query_cache
    if len(_query_cache) >= CACHE_MAX_SIZE:
        evict_n = CACHE_MAX_SIZE // 5
        for k in list(_query_cache.keys())[:evict_n]:
            del _query_cache[k]
    _query_cache[_cache_key(question, document_id)] = result

def cache_invalidate_document(document_id: str) -> int:
    global _query_cache
    before = len(_query_cache)
    _query_cache = {k: v for k, v in _query_cache.items() if k[1] != document_id}
    removed = before - len(_query_cache)
    if removed:
        logger.info("[Cache] Invalidated %d entries for document_id=%s", removed, document_id)
    return removed

# ─── Embeddings ───────────────────────────────────────────────────────────────
def get_embeddings_cohere(texts: list[str], input_type: str = "search_document") -> list[list[float]]:
    cohere_key = os.getenv("COHERE_API_KEY")
    if not cohere_key:
        raise ValueError("COHERE_API_KEY not set.")
    url = "https://api.cohere.ai/v1/embed"
    headers = {"Authorization": f"Bearer {cohere_key}", "Content-Type": "application/json"}
    payload = {"texts": texts, "model": "embed-multilingual-v3.0", "input_type": input_type}
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        response.raise_for_status()
        embeddings = response.json().get("embeddings", [])
        if not embeddings:
            logger.warning("[Embed] Empty response — returning zero vectors")
            return [[0.0] * 1024 for _ in texts]
        return embeddings
    except Exception as e:
        logger.error("[Embed] Cohere API error: %s", e)
        # Return zero vectors — caller must handle gracefully
        return [[0.0] * 1024 for _ in texts]

def _is_zero_vector(vec: list[float]) -> bool:
    return all(v == 0.0 for v in vec)

# ─── PDF Processing ───────────────────────────────────────────────────────────
class PDFValidationError(ValueError):
    pass

def validate_pdf(pdf_path: str) -> dict:
    metrics = {"valid": False, "page_count": 0, "char_count": 0,
               "empty_pages": 0, "avg_chars_per_page": 0.0, "error": None}
    try:
        reader = PdfReader(pdf_path)
    except Exception as e:
        metrics["error"] = f"Cannot open PDF: {e}"
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
        metrics["error"] = "PDF has no extractable text (may be scanned/image-based)."
        return metrics
    if empty_pages / max(page_count, 1) > 0.8:
        metrics["error"] = f"Over 80% of pages ({empty_pages}/{page_count}) have no text."
        return metrics
    metrics["valid"] = True
    return metrics

def extract_text_from_pdf(pdf_path: str) -> tuple[str, dict]:
    quality = validate_pdf(pdf_path)
    if not quality["valid"]:
        raise PDFValidationError(quality["error"])
    text = ""
    reader = PdfReader(pdf_path)
    for page in reader.pages:
        try:
            text += (page.extract_text() or "") + "\n"
        except Exception:
            pass
    return text.strip(), quality

def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> list[str]:
    chunks = []
    words = text.split()
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i + chunk_size])
        if len(chunk.split()) >= MIN_CHUNK_WORDS:
            chunks.append(chunk)
    logger.info("[Chunk] %d words → %d chunks", len(words), len(chunks))
    return chunks

def ingest_document(pdf_path: str, document_id: str, document_name: str = None) -> int:
    logger.info("[Ingest] Starting: document_id=%s name=%s", document_id, document_name or "unknown")
    text, quality = extract_text_from_pdf(pdf_path)
    if not text:
        raise ValueError("No text extracted from PDF.")
    chunks = chunk_text(text)
    if not chunks:
        raise ValueError("No valid chunks after filtering.")
    logger.info("[Ingest] Embedding %d chunks…", len(chunks))
    t0 = time.time()
    embeddings = get_embeddings_cohere(chunks)
    logger.info("[Ingest] Embeddings in %dms", round((time.time() - t0) * 1000))
    pc = Pinecone(api_key=PINECONE_API_KEY)
    index = pc.Index(PINECONE_INDEX)
    vectors = [
        (f"{document_id}_{i}", emb, {"text": chunk, "doc_id": document_id,
                                     "chunk_index": i, "doc_name": document_name or ""})
        for i, (chunk, emb) in enumerate(zip(chunks, embeddings))
    ]
    t1 = time.time()
    index.upsert(vectors=vectors, namespace=document_id)
    logger.info("[Ingest] Upserted %d vectors in %dms", len(chunks), round((time.time() - t1) * 1000))
    return len(chunks)

# ─── Answer Question ──────────────────────────────────────────────────────────
def answer_question(question: str, document_id: str, model_override: str | None = None) -> dict:
    t_start = time.time()

    lang = detect_language(question)
    logger.info("[Chat] lang=%s question=%s", lang, question[:80])

    # Cache check
    cached = cache_get(question, document_id)
    if cached:
        return {**cached, "cached": True}

    # ── Determine model FIRST (needed for _is_small_model check below) ────────
    _model = model_override or GROQ_MODEL
    _small = _is_small_model(_model)
    logger.info("[Chat] model=%s small=%s", _model, _small)

    # ── Detect summary intent ─────────────────────────────────────────────────
    _is_summary = is_summarize_intent(question)
    if _is_summary:
        logger.info("[Chat] Summary intent — broad retrieval mode")

    # ── Embed query ───────────────────────────────────────────────────────────
    t_embed = time.time()
    embed_text = "document overview summary key points" if _is_summary else question
    question_embedding = get_embeddings_cohere([embed_text], input_type="search_query")[0]
    embed_ms = round((time.time() - t_embed) * 1000)
    logger.info("[Chat] Embedded in %dms", embed_ms)

    # Guard: if Cohere returned zero vector (401/error), fail cleanly
    if _is_zero_vector(question_embedding):
        raise RuntimeError(
            "Embedding failed — COHERE_API_KEY may be invalid or rate-limited. "
            "Please check your Cohere API key."
        )

    # ── Retrieve from Pinecone ────────────────────────────────────────────────
    pc = Pinecone(api_key=PINECONE_API_KEY)
    index = pc.Index(PINECONE_INDEX)

    _top_k = ((TOP_K_SMALL + 2) if _small else (TOP_K_LARGE + 3)) if _is_summary \
              else (TOP_K_SMALL if _small else TOP_K_LARGE)

    t_retrieve = time.time()
    results = index.query(
        vector=question_embedding,
        top_k=_top_k,
        namespace=document_id,
        include_metadata=True,
    )
    retrieve_ms = round((time.time() - t_retrieve) * 1000)
    logger.info("[Chat] Pinecone: %d matches in %dms", len(results["matches"]), retrieve_ms)

    # ── Filter matches ────────────────────────────────────────────────────────
    if _is_summary:
        # Use all chunks for summary — confidence filter not appropriate here
        filtered_matches = results["matches"]
        logger.info("[Chat] Summary mode — using all %d chunks", len(filtered_matches))
    else:
        filtered_matches = [m for m in results["matches"] if m.get("score", 0) >= CONFIDENCE_THRESHOLD]
        if not filtered_matches:
            logger.warning("[Chat] No matches above threshold — using top 1")
            filtered_matches = results["matches"][:1]

    # Guard: if no matches at all
    if not filtered_matches:
        raise RuntimeError(
            "No document chunks found. The document may not be ingested yet, "
            "or the document ID is incorrect."
        )

    # ── Build context ─────────────────────────────────────────────────────────
    _char_limit  = CONTEXT_CHAR_LIMIT_SMALL if _small else CONTEXT_CHAR_LIMIT_LARGE
    _chunk_limit = _char_limit // max(len(filtered_matches), 1)
    context = "\n".join([m["metadata"]["text"][:_chunk_limit] for m in filtered_matches])
    logger.info("[Chat] ctx=%d chars, %d chunks", len(context), len(filtered_matches))

    # ── Build prompt ──────────────────────────────────────────────────────────
    if _is_summary:
        prompts = {
            "en": (
                "You are a helpful government services assistant.\n"
                "Read the following excerpts from an official document and write a clear summary.\n\n"
                "Document excerpts:\n{context}\n\n"
                "INSTRUCTIONS:\n"
                "1. Write 3-5 bullet points summarising what this document is about.\n"
                "2. Each bullet must be one short simple sentence (5th-grade reading level).\n"
                "3. Mention the document purpose, who it is for, and the main points.\n"
                "4. Do NOT make up anything not in the excerpts.\n"
                "5. End with: Source: Based on official documents provided."
            ),
            "ms": (
                "Anda adalah pembantu perkhidmatan kerajaan yang membantu.\n"
                "Baca petikan daripada dokumen rasmi dan tulis ringkasan yang jelas.\n\n"
                "Petikan dokumen:\n{context}\n\n"
                "ARAHAN:\n"
                "1. Tulis 3-5 mata peluru meringkaskan apa yang dokumen ini mengenai.\n"
                "2. Setiap mata peluru mestilah satu ayat pendek dan mudah (tahap darjah 5).\n"
                "3. Nyatakan tujuan dokumen, untuk siapa, dan perkara utama.\n"
                "4. JANGAN reka maklumat yang tidak ada dalam petikan.\n"
                "5. Akhiri dengan: Sumber: Berdasarkan dokumen rasmi yang disediakan."
            ),
            "zh-cn": (
                "您是一位有帮助的政府服务助理。\n"
                "请阅读以下官方文件摘录并写一份清晰的摘要。\n\n"
                "文件摘录：\n{context}\n\n"
                "说明：\n"
                "1. 用3-5个要点总结这份文件的内容。\n"
                "2. 每个要点应为一个简短易懂的句子（五年级阅读水平）。\n"
                "3. 说明文件的目的、适用对象和主要内容。\n"
                "4. 不要编造摘录中没有的信息。\n"
                "5. 以来源：基于所提供的官方文件结尾"
            ),
        }
        prompt_text = prompts.get(lang, prompts["en"]).format(context=context)
    else:
        prompts = {
            "en": (
                "You are a helpful government services assistant.\n"
                "Your job: read official documents and give simple, clear answers.\n\n"
                "RULES:\n"
                "1. Answer ONLY from the context — never make up information.\n"
                "2. Use simple, everyday words (5th-grade reading level).\n"
                "3. Replace legal/technical jargon with plain language.\n"
                "4. Format as 3-5 short bullet points — each one is one short sentence.\n"
                "5. End every answer with: Source: Based on official documents provided.\n\n"
                "--- EXAMPLE 1 ---\n"
                "Question: Who can apply for housing aid?\n"
                "Answer:\n"
                "• Malaysian citizens with a monthly income below RM3,000 can apply.\n"
                "• You must be a first-time home buyer with no other property.\n"
                "• You need to be at least 18 years old.\n"
                "Source: Based on official documents provided.\n\n"
                "--- EXAMPLE 2 ---\n"
                "Question: What documents do I need?\n"
                "Answer:\n"
                "• Bring your identity card (MyKad).\n"
                "• Prepare your latest payslip or income proof.\n"
                "• You also need a utility bill to show your address.\n"
                "Source: Based on official documents provided.\n\n"
                "--- NOW ANSWER THIS ---\n"
                "Context from official documents:\n{context}\n\n"
                "Question: {question}\n"
                "Answer:"
            ),
            "ms": (
                "Anda adalah pembantu perkhidmatan kerajaan yang membantu.\n"
                "Tugas anda: baca dokumen rasmi dan berikan jawapan yang mudah dan jelas.\n\n"
                "PERATURAN:\n"
                "1. Jawab HANYA dari konteks — jangan reka maklumat.\n"
                "2. Gunakan perkataan mudah, harian (tahap pembacaan darjah 5).\n"
                "3. Gantikan jargon undang-undang/teknikal dengan bahasa biasa.\n"
                "4. Format sebagai 3-5 mata peluru pendek — setiap satu ialah satu ayat pendek.\n"
                "5. Akhiri setiap jawapan dengan: Sumber: Berdasarkan dokumen rasmi yang disediakan.\n\n"
                "--- CONTOH 1 ---\n"
                "Soalan: Siapa yang boleh mohon bantuan perumahan?\n"
                "Jawapan:\n"
                "• Warganegara Malaysia dengan pendapatan bulanan di bawah RM3,000 boleh memohon.\n"
                "• Anda mestilah pembeli rumah pertama yang tidak memiliki harta lain.\n"
                "• Anda perlu berumur sekurang-kurangnya 18 tahun.\n"
                "Sumber: Berdasarkan dokumen rasmi yang disediakan.\n\n"
                "--- CONTOH 2 ---\n"
                "Soalan: Apakah dokumen yang diperlukan?\n"
                "Jawapan:\n"
                "• Bawa kad pengenalan anda (MyKad).\n"
                "• Sediakan slip gaji atau bukti pendapatan terkini.\n"
                "• Anda juga perlukan bil utiliti untuk tunjukkan alamat anda.\n"
                "Sumber: Berdasarkan dokumen rasmi yang disediakan.\n\n"
                "--- JAWAB SOALAN INI ---\n"
                "Konteks daripada dokumen rasmi:\n{context}\n\n"
                "Soalan: {question}\n"
                "Jawapan:"
            ),
            "zh-cn": (
                "您是一位有帮助的政府服务助理。\n"
                "您的工作：阅读官方文件，提供简单清晰的答案。\n\n"
                "规则：\n"
                "1. 只从背景回答——不要编造信息。\n"
                "2. 使用简单的日常用语（五年级阅读水平）。\n"
                "3. 用通俗语言替换法律/技术术语。\n"
                "4. 格式为3-5个简短要点——每个要点是一个简短句子。\n"
                "5. 每个答案以此结尾：来源：基于所提供的官方文件。\n\n"
                "--- 示例1 ---\n"
                "问题：谁可以申请住房援助？\n"
                "答案：\n"
                "• 月收入低于3000令吉的马来西亚公民可以申请。\n"
                "• 您必须是第一次购房且没有其他房产。\n"
                "• 您需要年满18岁。\n"
                "来源：基于所提供的官方文件。\n\n"
                "--- 示例2 ---\n"
                "问题：我需要什么文件？\n"
                "答案：\n"
                "• 携带您的身份证（MyKad）。\n"
                "• 准备最新的工资单或收入证明。\n"
                "• 您还需要水电费账单来证明您的地址。\n"
                "来源：基于所提供的官方文件。\n\n"
                "--- 现在回答这个问题 ---\n"
                "来自官方文件的背景：\n{context}\n\n"
                "问题：{question}\n"
                "答案："
            ),
        }
        prompt_text = prompts.get(lang, prompts["en"]).format(context=context, question=question)

    # ── Generate answer (with 429 auto-fallback) ──────────────────────────────
    t_llm = time.time()

    def _call_llm(model: str) -> object:
        llm = ChatGroq(api_key=GROQ_API_KEY, model_name=model, temperature=0.3)
        return llm.invoke(prompt_text)

    try:
        response = _call_llm(_model)
    except Exception as e:
        err_str = str(e).lower()
        if "429" in err_str or "rate limit" in err_str or "too many" in err_str or "413" in err_str:
            fallback = GROQ_MODEL_FAST if _model != GROQ_MODEL_FAST else "gemma2-9b-it"
            logger.warning("[Chat] %s on %s — retrying with %s", "429/413", _model, fallback)
            response = _call_llm(fallback)
            _model = fallback  # update so model_used reflects actual model
        else:
            raise

    llm_ms    = round((time.time() - t_llm) * 1000)
    total_ms  = round((time.time() - t_start) * 1000)
    top_score = filtered_matches[0].get("score", 0) if filtered_matches else 0

    logger.info("[Chat] Done — lang=%s conf=%.3f latency=%dms (embed=%dms retrieve=%dms llm=%dms)",
                lang, top_score, total_ms, embed_ms, retrieve_ms, llm_ms)

    result = {
        "answer":     response.content,
        "language":   lang,
        "sources": [
            {"text": m["metadata"]["text"][:200], "document_id": document_id,
             "score": round(m.get("score", 0), 4)}
            for m in filtered_matches
        ],
        "confidence": round(top_score, 4),
        "latency_ms": total_ms,
        "cached":     False,
        "model_used": _model,
    }

    cache_set(question, document_id, result)
    return result


# ─── Delete Document ──────────────────────────────────────────────────────────
def delete_document_from_vectorstore(document_id: str) -> None:
    try:
        pc = Pinecone(api_key=PINECONE_API_KEY)
        index = pc.Index(PINECONE_INDEX)
        index.delete(delete_all=True, namespace=document_id)
        cache_invalidate_document(document_id)
        logger.info("[RAG] Deleted document_id=%s", document_id)
    except Exception as e:
        logger.error("[RAG] Error deleting document_id=%s: %s", document_id, e)
