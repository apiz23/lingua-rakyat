"use client"

import { useCallback, useEffect, useState } from "react"
import { Document, listDocuments } from "@/lib/api"
import { createIdentityLifecycle } from "@/lib/identity-lifecycle"

export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [lifetime] = useState(createIdentityLifecycle)

  const reload = useCallback(async () => {
    lifetime.invalidate()
    const request = lifetime.begin()
    try {
      const docs = await listDocuments(request.signal)
      if (request.current()) setDocuments(docs)
      return docs
    } catch {
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

  return { documents, readyDocs, loading, reload }
}
