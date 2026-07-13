"use client"

import { useEffect, useMemo, useState } from "react"
import { useUser } from "@clerk/nextjs"
import { Document, listDocuments } from "@/lib/api"
import ChatPanel from "@/components/chat-panel"
import { ConversationSidebar } from "@/components/chat-panel/conversation-sidebar"
import UploadModal from "@/components/upload-modal"

export default function WorkSpacePage() {
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [initialQuestion, setInitialQuestion] = useState<string | undefined>()
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const { user } = useUser()
  const [anonId] = useState<string>(() => {
    if (typeof window === "undefined") return ""
    let id = localStorage.getItem("lr-user-id")
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem("lr-user-id", id)
    }
    return id
  })
  // Signed in → Clerk identity (backend verifies the token anyway);
  // signed out → the device's anonymous ID, exactly as before.
  const userId = user?.id ?? anonId

  const loadDocuments = async () => {
    setDocsLoading(true)
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
    } finally {
      setDocsLoading(false)
    }
  }

  useEffect(() => {
    loadDocuments()
  }, [])

  useEffect(() => {
    setInitialQuestion(undefined)
  }, [selectedDoc?.id])

  const sortedDocs = useMemo(() => {
    return [...documents].sort((a, b) =>
      a.uploaded_at < b.uploaded_at ? 1 : -1
    )
  }, [documents])

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      <ConversationSidebar
        userId={userId}
        activeSessionId={activeSessionId}
        documents={sortedDocs}
        docsLoading={docsLoading}
        onNewChat={() => {
          setActiveSessionId(null)
          setInitialQuestion(undefined)
        }}
        onSelectConversation={(sid) => setActiveSessionId(sid)}
        onUpload={() => setIsUploadOpen(true)}
        className="hidden sm:flex"
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <ChatPanel
          selectedDoc={selectedDoc}
          sessionId={activeSessionId}
          userId={userId}
          initialQuestion={initialQuestion}
          composerTop={null}
        />
      </div>

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadComplete={async () => {
          const docs = await loadDocuments()
          const latest = docs?.sort((a, b) =>
            a.uploaded_at < b.uploaded_at ? 1 : -1
          )[0]
          if (latest) {
            setSelectedDoc(latest)
            setInitialQuestion("Summarize this document")
          }
        }}
      />
    </div>
  )
}
