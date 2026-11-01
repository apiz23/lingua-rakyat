"use client"

import { useEffect, useState } from "react"
import { Document } from "@/lib/api"
import ChatPanel from "@/components/chat-panel"
import { useWorkspaceSession } from "@/components/workspace-session-context"
import { useDocuments } from "@/hooks/useDocuments"

export default function WorkSpacePage() {
  const { userId, activeSessionId, actorGeneration, sessionGeneration } = useWorkspaceSession()
  const { documents, loading } = useDocuments()
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  useEffect(() => {
    // Preserve the selected anchor when the catalogue refreshes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedDoc((previous) => documents.find((d) => d.id === previous?.id) ?? documents.find((d) => d.status === "ready") ?? null)
  }, [documents])

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <ChatPanel
          key={`${actorGeneration}:${sessionGeneration}`}
          selectedDoc={selectedDoc}
          sessionId={activeSessionId}
          userId={userId}
          composerTop={null}
          documents={documents}
          docsLoading={loading}
        />
      </div>
    </div>
  )
}
