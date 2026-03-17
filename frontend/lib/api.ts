// src/lib/api.ts
// All API calls to the FastAPI backend go through this file

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// ── Types ──────────────────────────────────────────────────────────────────

export type Document = {
  id: string
  name: string
  size_bytes: number
  chunk_count: number
  status: "processing" | "ready" | "error"
  uploaded_at: string
  error_message?: string
}

export type SourceChunk = {
  content: string
  chunk_index: number
}

export type AskResponse = {
  answer: string
  sources: SourceChunk[]
  language: string
  question: string
  timestamp: string
}

// ── API Functions ──────────────────────────────────────────────────────────

// Upload a PDF document
export async function uploadDocument(file: File): Promise<Document> {
  const formData = new FormData()
  formData.append("file", file)

  const res = await fetch(`${API_URL}/api/documents/upload`, {
    method: "POST",
    body: formData,
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.detail || "Upload failed")
  }

  const data = await res.json()
  return data.document
}

// Get list of all uploaded documents
export async function listDocuments(): Promise<Document[]> {
  const res = await fetch(`${API_URL}/api/documents/`)
  if (!res.ok) throw new Error("Failed to fetch documents")
  return res.json()
}

// Delete a document
export async function deleteDocument(documentId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/documents/${documentId}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to delete document")
}

// Ask a question about a document
export async function askQuestion(
  documentId: string,
  documentName: string,
  question: string
): Promise<AskResponse> {
  const res = await fetch(`${API_URL}/api/chat/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      document_id: documentId,
      document_name: documentName,
      question: question,
    }),
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.detail || "Failed to get answer")
  }

  return res.json()
}
