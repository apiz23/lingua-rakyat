"use client"

import { useEffect, useState } from "react"
import { Document } from "@/lib/api"
import ChatPanel from "@/components/chat-panel"
import WorkspaceDocRail from "@/components/workspace-doc-rail"
import { useWorkspaceSession } from "@/components/workspace-session-context"
import { useDocuments } from "@/hooks/useDocuments"

export default function WorkSpacePage() {
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [initialQuestion, setInitialQuestion] = useState<string | undefined>()
  const { userId, activeSessionId } = useWorkspaceSession()
  const { documents, readyDocs, loading, reload } = useDocuments()

  useEffect(() => {
    // Keep the current doc if it still exists; otherwise auto-anchor on the
    // first ready doc so the citizen lands in a working multi-doc chat with
    // no file picking. selectedDoc is only the session/history anchor — every
    // question still spans the whole ready library (ChatPanel askAllDocs).
    setSelectedDoc(
      (prev) =>
        documents.find((d) => d.id === prev?.id) ??
        documents.find((d) => d.status === "ready") ??
        null
    )
  }, [documents])

  useEffect(() => {
    setInitialQuestion(undefined)
  }, [selectedDoc?.id])

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      <WorkspaceDocRail
        documents={documents}
        loading={loading}
        selectedDoc={selectedDoc}
        onSelectDoc={setSelectedDoc}
        onReload={reload}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <ChatPanel
          selectedDoc={selectedDoc}
          sessionId={activeSessionId}
          userId={userId}
          initialQuestion={initialQuestion}
          composerTop={null}
          documents={documents}
          docsLoading={loading}
        />
      </div>
    </div>
  )
}
