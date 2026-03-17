"""
utils/rag_pipeline.py — The Core RAG Pipeline
===============================================
This file contains ALL the AI logic for the application.

The RAG (Retrieval-Augmented Generation) pipeline has two phases:

PHASE 1 — INGESTION (when user uploads a document):
  PDF → Extract Text → Split into Chunks → Generate Embeddings → Store in Pinecone

PHASE 2 — RETRIEVAL + GENERATION (when user asks a question):
  Question → Embed Question → Search Pinecone → Get Top Chunks → Send to LLM → Answer

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LLM PROVIDER SWITCHING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Set LLM_PROVIDER in your .env file to switch between providers:

  LLM_PROVIDER=ollama   → uses your local Ollama (phi3:mini or any pulled model)
  LLM_PROVIDER=groq     → uses Groq cloud API (fast, free, works on deployment)

That is the ONLY change needed to switch. Everything else stays the same.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VECTOR STORE — PINECONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All document chunks are stored in Pinecone (cloud vector database).
Each chunk is stored with a metadata filter { document_id: "<uuid>" } so
that queries are scoped to a single document at retrieval time.

Required .env keys:
  PINECONE_API_KEY   → your Pinecone API key (https://app.pinecone.io)
  PINECONE_INDEX     → name of your Pinecone index (e.g. "docuquery")

Pinecone index settings (create once in the Pinecone dashboard):
  Dimensions : 1024   (matches BAAI/bge-m3 output size)
  Metric     : cosine
  Cloud      : aws / gcp / azure (any free tier)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RESPONSE DESIGN (Case Study 4 — Inclusive Citizen):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
All responses follow these rules to serve citizens with low digital literacy:
  1. SHORT — maximum 5 bullet points, no long paragraphs
  2. SIMPLE — no jargon, 5th-grade reading level
  3. GROUNDED — only from the document (no hallucination)
  4. MULTILINGUAL — auto-detects Malay, English, Chinese, Arabic, Thai, Japanese
  5. ACTIONABLE — tells the citizen what they can do next
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import os
from typing import Optional, Union
from langdetect import detect, LangDetectException

# ─── PDF Loading ──────────────────────────────────────────────────────────────
from pypdf import PdfReader

# ─── LangChain Text Splitter ──────────────────────────────────────────────────
from langchain_text_splitters import RecursiveCharacterTextSplitter

# ─── Embeddings ───────────────────────────────────────────────────────────────
from langchain_community.embeddings import HuggingFaceEmbeddings

# ─── Vector Database — Pinecone ───────────────────────────────────────────────
from pinecone import Pinecone, ServerlessSpec
from langchain_pinecone import PineconeVectorStore

# ─── LLM Providers ────────────────────────────────────────────────────────────
from langchain_community.chat_models import ChatOllama   # Local Ollama
from langchain_groq import ChatGroq                       # Groq cloud API

# ─── LangChain Chain Components ───────────────────────────────────────────────
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser


# ─── Singleton: Embedding Model ───────────────────────────────────────────────
_embedding_model: Optional[HuggingFaceEmbeddings] = None

def get_embedding_model() -> HuggingFaceEmbeddings:
    """
    Returns the HuggingFace embedding model, loading it on first call.
    Model is set via EMBEDDING_MODEL in .env.
    Default: BAAI/bge-m3 (1024 dimensions, multilingual)
    """
    global _embedding_model
    if _embedding_model is None:
        model_name = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")
        print(f"[RAG] Loading embedding model: {model_name}")
        print("[RAG] This may take 30–60 seconds on first run (downloading model)...")
        _embedding_model = HuggingFaceEmbeddings(
            model_name=model_name,
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
        print("[RAG] Embedding model loaded successfully.")
    return _embedding_model


# ─── Singleton: Pinecone Client ───────────────────────────────────────────────
_pinecone_client: Optional[Pinecone] = None

def get_pinecone_client() -> Pinecone:
    """
    Returns the Pinecone client, initialising it on first call.
    Requires PINECONE_API_KEY in .env.
    """
    global _pinecone_client
    if _pinecone_client is None:
        api_key = os.getenv("PINECONE_API_KEY")
        if not api_key:
            raise ValueError(
                "PINECONE_API_KEY is not set.\n"
                "Get your free key at https://app.pinecone.io"
            )
        _pinecone_client = Pinecone(api_key=api_key)
        print("[RAG] Pinecone client initialised.")
    return _pinecone_client


def get_pinecone_index():
    """
    Returns the Pinecone index, creating it if it does not exist.
    Index name is set via PINECONE_INDEX in .env (default: 'docuquery').

    Index spec:
      - Dimensions: 1024  (matches BAAI/bge-m3)
      - Metric    : cosine
      - Cloud     : aws (free serverless tier)
      - Region    : us-east-1
    """
    pc = get_pinecone_client()
    index_name = os.getenv("PINECONE_INDEX", "docuquery")

    existing_indexes = [idx.name for idx in pc.list_indexes()]
    if index_name not in existing_indexes:
        print(f"[RAG] Creating Pinecone index '{index_name}'...")
        pc.create_index(
            name=index_name,
            dimension=1024,          # BAAI/bge-m3 output size
            metric="cosine",
            spec=ServerlessSpec(
                cloud=os.getenv("PINECONE_CLOUD", "aws"),
                region=os.getenv("PINECONE_REGION", "us-east-1"),
            ),
        )
        print(f"[RAG] Pinecone index '{index_name}' created.")
    else:
        print(f"[RAG] Using existing Pinecone index '{index_name}'.")

    return pc.Index(index_name)


# ─── Singleton: LLM ───────────────────────────────────────────────────────────
_llm: Optional[Union[ChatOllama, ChatGroq]] = None

def get_llm() -> Union[ChatOllama, ChatGroq]:
    """
    Returns the LLM client based on LLM_PROVIDER in .env.

    LOCAL DEVELOPMENT  → LLM_PROVIDER=ollama
    DEPLOYMENT         → LLM_PROVIDER=groq
    """
    global _llm
    if _llm is None:
        provider = os.getenv("LLM_PROVIDER", "ollama").lower().strip()

        if provider == "ollama":
            model = os.getenv("OLLAMA_MODEL", "phi3:mini")
            base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
            print(f"[RAG] Using LOCAL Ollama LLM: {model} at {base_url}")
            _llm = ChatOllama(
                model=model,
                base_url=base_url,
                temperature=0.1,
            )

        elif provider == "groq":
            api_key = os.getenv("GROQ_API_KEY")
            if not api_key:
                raise ValueError(
                    "LLM_PROVIDER=groq but GROQ_API_KEY is not set.\n"
                    "Get your free key at https://console.groq.com"
                )
            model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
            print(f"[RAG] Using GROQ cloud LLM: {model}")
            _llm = ChatGroq(
                api_key=api_key,
                model_name=model,
                temperature=0.1,
                max_tokens=512,   # Keep responses short and focused
            )

        else:
            raise ValueError(
                f"Unknown LLM_PROVIDER: '{provider}'. "
                "Set LLM_PROVIDER=ollama or LLM_PROVIDER=groq in your .env file."
            )

    return _llm


def reset_llm() -> None:
    """Force the LLM singleton to reload on next call."""
    global _llm
    _llm = None


# ─── PHASE 1: Document Ingestion ─────────────────────────────────────────────

def extract_text_from_pdf(pdf_path: str) -> str:
    """
    Step 1 of ingestion: Read all text from a PDF file.
    Returns a single string containing all the text from all pages.
    """
    reader = PdfReader(pdf_path)
    pages_text = []

    for page_num, page in enumerate(reader.pages):
        text = page.extract_text()
        if text and text.strip():
            pages_text.append(text)

    full_text = "\n\n".join(pages_text)
    print(f"[RAG] Extracted {len(full_text)} characters from {len(reader.pages)} pages")
    return full_text


def split_text_into_chunks(text: str) -> list[str]:
    """
    Step 2 of ingestion: Split the full document text into smaller overlapping chunks.
    Returns a list of text strings, each ~800 characters long with 150-char overlap.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=150,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
    )

    chunks = splitter.split_text(text)
    print(f"[RAG] Split document into {len(chunks)} chunks")
    return chunks


def ingest_document(pdf_path: str, document_id: str, document_name: str) -> int:
    """
    Full ingestion pipeline: PDF → Text → Chunks → Embeddings → Pinecone.

    Each chunk is stored with metadata:
      { document_id, document_name, chunk_index }

    The document_id is used as a namespace filter at query time so that
    searches are scoped to a single document.

    Returns number of chunks stored in Pinecone.
    """
    text = extract_text_from_pdf(pdf_path)
    if not text.strip():
        raise ValueError("Could not extract any text from this PDF. It may be scanned or image-based.")

    chunks = split_text_into_chunks(text)
    if not chunks:
        raise ValueError("Document was too short to process.")

    index_name = os.getenv("PINECONE_INDEX", "docuquery")

    # Ensure the index exists before upserting
    get_pinecone_index()

    metadatas = [
        {
            "document_id": document_id,
            "document_name": document_name,
            "chunk_index": i,
        }
        for i in range(len(chunks))
    ]

    # Use document_id as the Pinecone namespace so each document is isolated
    PineconeVectorStore.from_texts(
        texts=chunks,
        embedding=get_embedding_model(),
        index_name=index_name,
        namespace=document_id,
        metadatas=metadatas,
    )

    print(f"[RAG] Stored {len(chunks)} chunks in Pinecone index '{index_name}' namespace '{document_id}'")
    return len(chunks)


def delete_document_from_vectorstore(document_id: str) -> None:
    """
    Delete all vectors for a document from Pinecone.
    Uses the document_id namespace to delete all chunks at once.
    """
    try:
        index = get_pinecone_index()
        # Deleting an entire namespace removes all vectors in it
        index.delete(delete_all=True, namespace=document_id)
        print(f"[RAG] Deleted all vectors in Pinecone namespace '{document_id}'")
    except Exception as e:
        print(f"[RAG] Warning: Could not delete Pinecone namespace '{document_id}': {e}")


# ─── PHASE 2: Question Answering ─────────────────────────────────────────────

def detect_language(text: str) -> str:
    """
    Detect the language of a text string.

    Uses a Unicode script check FIRST to reliably catch:
      - Chinese (Simplified/Traditional) → "zh-cn"
      - Arabic → "ar"
      - Thai → "th"
      - Japanese (Hiragana/Katakana) → "ja"

    Then falls back to langdetect for Latin-script languages (Malay, English, etc.).
    Returns "ms" for Malay, "en" for English (default fallback).

    Why: langdetect is unreliable for short texts and frequently misidentifies
    Chinese/Mandarin as Bahasa Indonesia ('id') or Malay ('ms') because they
    share probabilistic patterns in its model. A Unicode range check is
    deterministic and 100% accurate for CJK and other non-Latin scripts.
    """
    # ── Step 1: Unicode script detection (fast, deterministic, 100% accurate) ──
    cjk_count = sum(
        1 for ch in text
        if (
            '\u4e00' <= ch <= '\u9fff'    # CJK Unified Ideographs (core)
            or '\u3400' <= ch <= '\u4dbf'  # CJK Extension A
            or '\u20000' <= ch <= '\u2a6df' # CJK Extension B
            or '\uf900' <= ch <= '\ufaff'  # CJK Compatibility Ideographs
            or '\u3000' <= ch <= '\u303f'  # CJK Symbols and Punctuation
        )
    )
    hiragana_katakana_count = sum(
        1 for ch in text
        if '\u3040' <= ch <= '\u30ff'  # Hiragana + Katakana
    )
    arabic_count = sum(
        1 for ch in text
        if '\u0600' <= ch <= '\u06ff'  # Arabic
    )
    thai_count = sum(
        1 for ch in text
        if '\u0e00' <= ch <= '\u0e7f'  # Thai
    )

    total_chars = max(len(text.strip()), 1)

    if cjk_count / total_chars > 0.1:
        return "zh-cn"  # Chinese (Simplified/Traditional / Mandarin)
    if hiragana_katakana_count / total_chars > 0.1:
        return "ja"     # Japanese
    if arabic_count / total_chars > 0.1:
        return "ar"     # Arabic
    if thai_count / total_chars > 0.1:
        return "th"     # Thai

    # ── Step 2: langdetect for Latin-script languages (Malay, English, etc.) ──
    try:
        lang = detect(text)
        # Normalise: langdetect returns 'id' (Indonesian) for Malay sometimes
        if lang in ("ms", "id"):
            return "ms"
        return lang
    except LangDetectException:
        return "en"


def build_rag_prompt(language: str) -> ChatPromptTemplate:
    """
    Build a citizen-friendly prompt for the LLM based on detected language.

    Design principles (Case Study 4 — Inclusive Citizen):
    - SHORT: max 3–5 bullet points, no long paragraphs
    - SIMPLE: plain everyday language, no jargon
    - GROUNDED: only from the document (no hallucination)
    - ACTIONABLE: tells the citizen what they can do

    Supports:
      "ms"    → Bahasa Melayu (for Malaysian citizens)
      "zh-cn" → Chinese Mandarin (Simplified)
      "en"    → English (default)
    """

    if language == "ms":  # ── Bahasa Melayu ──────────────────────────────────
        system_message = (
            "Anda adalah pembantu AI kerajaan yang membantu rakyat Malaysia.\n"
            "Tugas anda: Terangkan maklumat daripada dokumen dengan cara yang MUDAH dan RINGKAS.\n\n"
            "PERATURAN WAJIB:\n"
            "1. Jawab dalam 3 hingga 5 poin sahaja — JANGAN tulis perenggan panjang\n"
            "2. Gunakan bahasa harian yang mudah — ELAK istilah teknikal atau undang-undang\n"
            "3. Setiap poin mesti bermula dengan '•'\n"
            "4. Jika maklumat tidak ada dalam dokumen, tulis: 'Maklumat ini tidak terdapat dalam dokumen.'\n"
            "5. Akhiri dengan satu ayat tindakan ringkas jika berkaitan (contoh: 'Hubungi pejabat terdekat untuk maklumat lanjut.')\n"
            "6. JANGAN tambah maklumat luar dokumen"
        )
        human_message = (
            "Petikan dokumen:\n"
            "{context}\n\n"
            "---\n\n"
            "Soalan: {question}\n\n"
            "Berikan jawapan RINGKAS dalam 3–5 poin mudah faham:"
        )

    elif language == "zh-cn":  # ── Chinese Mandarin (Simplified) ──────────────
        system_message = (
            "您是一位帮助公民了解公共服务的政府AI助手。\n"
            "您的任务：以简短、简单的方式解释文件中的信息。\n\n"
            "严格规则：\n"
            "1. 仅用3至5个要点回答 — 不要写长段落\n"
            "2. 使用简单的日常语言 — 避免法律、医疗或技术术语\n"
            "3. 每个要点必须以'•'开头\n"
            "4. 如果文件中没有相关答案，请写：'此信息在文件中未找到。'\n"
            "5. 如有需要，以一句简短的行动建议结尾（例如：'请联系最近的办公室获取更多信息。'）\n"
            "6. 不要添加文件以外的信息"
        )
        human_message = (
            "文件摘录：\n"
            "{context}\n\n"
            "---\n\n"
            "问题：{question}\n\n"
            "请用3至5个简单要点给出简短回答："
        )

    else:  # ── English (default) ───────────────────────────────────────────────
        system_message = (
            "You are a government AI assistant helping citizens understand public services.\n"
            "Your job: Explain information from the document in a SHORT and SIMPLE way.\n\n"
            "STRICT RULES:\n"
            "1. Answer in 3 to 5 bullet points ONLY — do NOT write long paragraphs\n"
            "2. Use plain everyday language — AVOID legal, medical, or technical jargon\n"
            "3. Every point must start with '•'\n"
            "4. If the answer is not in the document, write: 'This information is not available in the document.'\n"
            "5. End with one short action sentence if relevant (e.g., 'Contact your nearest office for more details.')\n"
            "6. Do NOT add information from outside the document"
        )
        human_message = (
            "Document excerpts:\n"
            "{context}\n\n"
            "---\n\n"
            "Question: {question}\n\n"
            "Give a SHORT answer in 3–5 simple bullet points:"
        )

    return ChatPromptTemplate.from_messages([
        ("system", system_message),
        ("human", human_message),
    ])


def answer_question(
    document_id: str,
    question: str,
    document_name: str,
) -> dict:
    """
    Full Q&A pipeline: Question → Retrieve Chunks from Pinecone → Generate Answer.

    Returns:
        - answer:   Short, simple AI-generated answer (3–5 bullet points)
        - sources:  List of document excerpts used
        - language: Detected language ("en", "ms", "zh-cn", etc.)
    """
    index_name = os.getenv("PINECONE_INDEX", "docuquery")
    top_k = int(os.getenv("TOP_K_CHUNKS", "4"))

    # Step 1: Load the Pinecone vectorstore scoped to this document's namespace
    vectorstore = PineconeVectorStore(
        index_name=index_name,
        embedding=get_embedding_model(),
        namespace=document_id,
    )

    # Step 2 + 3: Embed the question and retrieve the most relevant chunks
    relevant_docs = vectorstore.similarity_search(question, k=top_k)

    if not relevant_docs:
        lang = detect_language(question)
        if lang == "ms":
            return {
                "answer": "Maklumat berkaitan soalan anda tidak dijumpai dalam dokumen ini.",
                "sources": [],
                "language": lang,
            }
        return {
            "answer": "No relevant information found in the document for your question.",
            "sources": [],
            "language": "en",
        }

    # Step 4: Format retrieved chunks as context
    # Detect language once here to avoid repeated calls
    lang = detect_language(question)

    if lang == "ms":
        chunk_label = lambda i: f"[Petikan {i+1}]"
    elif lang == "zh-cn":
        chunk_label = lambda i: f"[摘录 {i+1}]"
    else:
        chunk_label = lambda i: f"[Excerpt {i+1}]"

    context = "\n\n---\n\n".join([
        f"{chunk_label(i)}\n{doc.page_content}"
        for i, doc in enumerate(relevant_docs)
    ])

    # Step 5: Build the citizen-friendly prompt using already-detected language
    prompt = build_rag_prompt(lang)

    # Step 6: Run the LangChain chain
    chain = (
        {"context": lambda _: context, "question": RunnablePassthrough()}
        | prompt
        | get_llm()
        | StrOutputParser()
    )

    answer = chain.invoke(question)

    # Return answer + source excerpts
    sources = [
        {
            "content": doc.page_content,
            "chunk_index": doc.metadata.get("chunk_index", i),
        }
        for i, doc in enumerate(relevant_docs)
    ]

    return {
        "answer": answer,
        "sources": sources,
        "language": lang,
    }
