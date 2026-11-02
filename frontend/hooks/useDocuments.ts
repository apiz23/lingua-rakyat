"use client"

import { useCallback, useEffect, useState } from "react"
import { Document, listDocuments } from "@/lib/api"
import { createIdentityLifecycle } from "@/lib/identity-lifecycle"

export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lifetime] = useState(createIdentityLifecycle)

  const reload = useCallback(async () => {
    lifetime.invalidate()
    const request = lifetime.begin()
    try {
      const docs = await listDocuments(request.signal)
      if (request.current()) {
        setDocuments(docs)
        setError(null)
      }
      return docs
    } catch (err) {
      // A failed catalogue must be visible as an outage, not as an empty
      // library. The previous silent fallback made a backend configuration
      // failure look like "no documents uploaded yet".
      if (request.current()) {
        setError(err instanceof Error ? err.message : "Failed to load documents")
      }
      return []
    } finally {
      if (request.current()) setLoading(false)
      request.finish()
    }
  }, [lifetime])

  useEffect(() => {
    reload()
    return () => lifetime.invalidate()
  }, [reload, lifetime])

  const readyDocs = documents.filter((d) => d.status === "ready")

  return { documents, readyDocs, loading, error, reload }
}
