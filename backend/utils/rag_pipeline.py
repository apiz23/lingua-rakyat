"""
rag_pipeline.py — Lightweight RAG Pipeline for Render Free Tier
===========================================================================
This version removes heavy ML dependencies (torch, transformers, sentence-transformers)
and uses Groq API for embeddings instead of local models.
"""

import os
import requests
import langdetect
from typing import Optional
from dotenv import load_dotenv
from langchain_pinecone import PineconeVectorStore
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from langchain_groq import ChatGroq
from pypdf import PdfReader
from pinecone import Pinecone, ServerlessSpec

load_dotenv()

# ─── Configuration ────────────────────────────────────────────────────────

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "groq")

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX = os.getenv("PINECONE_INDEX", "docuquery")

# ─── Language Detection ───────────────────────────────────────────────────

def detect_language(text: str) -> str:
    """Detect language using Unicode script analysis + langdetect fallback."""
    
    # Count CJK characters
    cjk_count = sum(1 for c in text if '\u4E00' <= c <= '\u9FFF' or '\u3040' <= c <= '\u309F')
    
    if len(text) > 0 and cjk_count / len(text) > 0.2:
        return "zh-cn"
    
    try:
        lang = langdetect.detect(text)
        if lang in ["id", "ms"]:
            return "ms"
        return lang
    except:
        return "en"

# ─── Embedding via Cohere API ────────────────────────────────────────────────

def get_embeddings_cohere(texts: list[str]) -> list[list[float]]:
    """Get embeddings from Cohere API (free tier, 1024-dim)."""
    
    cohere_key = os.getenv("COHERE_API_KEY")
    if not cohere_key:
        raise ValueError("COHERE_API_KEY not set. Get free key at https://dashboard.cohere.com/api-keys")
    
    url = "https://api.cohere.ai/v1/embed"
    headers = {
        "Authorization": f"Bearer {cohere_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "texts": texts,
        "model": "embed-english-v3.0",
        "input_type": "search_document"
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        response.raise_for_status()
        data = response.json()
        embeddings = data.get("embeddings", [])
        if not embeddings:
            print(f"[Embeddings] No embeddings in response")
            embeddings = [[0.0] * 1024 for _ in texts]
        return embeddings
    except Exception as e:
        print(f"[Embeddings] Error: {e}")
        return [[0.0] * 1024 for _ in texts]

# ─── PDF Processing ──────────────────────────────────────────────────────

def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract text from PDF file."""
    text = ""
    try:
        reader = PdfReader(pdf_path)
        for page in reader.pages:
            text += page.extract_text()
    except Exception as e:
        print(f"[PDF] Error: {e}")
    return text

# ─── Chunk Text ──────────────────────────────────────────────────────────

def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> list[str]:
    """Split text into overlapping chunks."""
    chunks = []
    words = text.split()
    
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i + chunk_size])
        if chunk.strip():
            chunks.append(chunk)
    
    return chunks

# ─── Ingest Document ─────────────────────────────────────────────────────

def ingest_document(pdf_path: str, document_id: str, document_name: str = None) -> int:
    """Ingest a PDF document into Pinecone."""
    
    print(f"[Ingest] Processing: {document_id}")
    
    text = extract_text_from_pdf(pdf_path)
    if not text:
        raise ValueError("No text extracted from PDF")
    
    chunks = chunk_text(text)
    print(f"[Ingest] Created {len(chunks)} chunks")
    
    pc = Pinecone(api_key=PINECONE_API_KEY)
    index = pc.Index(PINECONE_INDEX)
    
    print(f"[Ingest] Getting embeddings...")
    embeddings = get_embeddings_cohere(chunks)
    
    print(f"[Ingest] Upserting to Pinecone...")
    vectors_to_upsert = [
        (f"{document_id}_{i}", embedding, {"text": chunk, "doc_id": document_id})
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings))
    ]
    
    index.upsert(vectors=vectors_to_upsert, namespace=document_id)
    
    print(f"[Ingest] Stored {len(chunks)} chunks")
    return len(chunks)

# ─── Query Document ──────────────────────────────────────────────────────

def answer_question(question: str, document_id: str) -> dict:
    """Answer a question about a document using RAG."""
    
    lang = detect_language(question)
    print(f"[Chat] Language: {lang}")
    
    question_embedding = get_embeddings_cohere([question])[0]
    
    pc = Pinecone(api_key=PINECONE_API_KEY)
    index = pc.Index(PINECONE_INDEX)
    
    results = index.query(
        vector=question_embedding,
        top_k=5,
        namespace=document_id,
        include_metadata=True
    )
    
    context = "\n".join([match["metadata"]["text"] for match in results["matches"]])
    
    prompts = {
        "en": "Answer based on context:\n\n{context}\n\nQuestion: {question}",
        "ms": "Jawab berdasarkan konteks:\n\n{context}\n\nSoalan: {question}",
        "zh-cn": "根据背景回答:\n\n{context}\n\n问题：{question}"
    }
    
    prompt_text = prompts.get(lang, prompts["en"]).format(context=context, question=question)
    
    llm = ChatGroq(api_key=GROQ_API_KEY, model_name=GROQ_MODEL, temperature=0.7)
    response = llm.invoke(prompt_text)
    
    return {
        "answer": response.content,
        "language": lang,
        "sources": [
            {
                "text": match["metadata"]["text"][:200],
                "document_id": document_id,
                "score": match.get("score", 0)
            }
            for match in results["matches"]
        ],
        "confidence": results["matches"][0]["score"] if results["matches"] else 0
    }

# ─── Delete Document ─────────────────────────────────────────────────────

def delete_document_from_vectorstore(document_id: str) -> None:
    """Delete a document from Pinecone."""
    
    try:
        pc = Pinecone(api_key=PINECONE_API_KEY)
        index = pc.Index(PINECONE_INDEX)
        index.delete(delete_all=True, namespace=document_id)
        print(f"[RAG] Deleted document {document_id}")
    except Exception as e:
        print(f"[RAG] Error deleting: {e}")
