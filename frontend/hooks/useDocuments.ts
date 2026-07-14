"use client"

import { useCallback, useEffect, useState } from "react"
import { Document, listDocuments } from "@/lib/api"

export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const docs = await listDocuments()
      setDocuments(docs)
      return docs
    } catch {
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const readyDocs = documents.filter((d) => d.status === "ready")

  return { documents, readyDocs, loading, reload }
}
