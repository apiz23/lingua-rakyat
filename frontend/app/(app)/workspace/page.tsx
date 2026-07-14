"use client"

import { useEffect, useState } from "react"
import { Document, listDocuments } from "@/lib/api"
import ChatPanel from "@/components/chat-panel"
import { useWorkspaceSession } from "@/components/workspace-session-context"

export default function WorkSpacePage() {
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [, setDocuments] = useState<Document[]>([])
  const [initialQuestion, setInitialQuestion] = useState<string | undefined>()
  const { userId, activeSessionId } = useWorkspaceSession()

  const loadDocuments = async () => {
    try {
      const docs = await listDocuments()
      setDocuments(docs)
      // Keep the current doc if it still exists; otherwise auto-anchor on the
      // first ready doc so the citizen lands in a working multi-doc chat with
      // no file picking. selectedDoc is only the session/history anchor — every
      // question still spans the whole ready library (ChatPanel askAllDocs).
      setSelectedDoc(
        (prev) =>
          docs.find((d) => d.id === prev?.id) ??
          docs.find((d) => d.status === "ready") ??
          null
      )
      return docs
    } catch {
      return []
    }
  }

  useEffect(() => {
    loadDocuments()
  }, [])

  useEffect(() => {
    setInitialQuestion(undefined)
  }, [selectedDoc?.id])

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <ChatPanel
          selectedDoc={selectedDoc}
          sessionId={activeSessionId}
          userId={userId}
          initialQuestion={initialQuestion}
          composerTop={null}
        />
      </div>
    </div>
  )
}
