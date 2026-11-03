"use client"

import { useEffect, useState } from "react"
import { Document } from "@/lib/api"
import ChatPanel from "@/components/chat-panel"
import { useWorkspaceSession } from "@/components/workspace-session-context"
import { useDocuments } from "@/hooks/useDocuments"
import { useLanguage } from "@/components/language-provider"

export default function WorkSpacePage() {
  const { userId, activeSessionId, actorGeneration, sessionGeneration } = useWorkspaceSession()
  const { documents, loading, error, reload } = useDocuments()
  const { language } = useLanguage()
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  useEffect(() => {
    // Preserve the selected anchor when the catalogue refreshes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedDoc((previous) => documents.find((d) => d.id === previous?.id) ?? documents.find((d) => d.status === "ready") ?? null)
  }, [documents])

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {error ? (
          <div
            role="alert"
            className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            <span>
              {language === "ms"
                ? "Dokumen tidak dapat dimuatkan. Perkhidmatan dokumen tidak tersedia."
                : language === "zh"
                  ? "无法加载文件。文件服务当前不可用。"
                  : "Documents could not be loaded. The document service is unavailable."}
            </span>
            <button
              type="button"
              onClick={() => void reload()}
              className="border border-destructive/40 px-3 py-1 text-xs font-medium hover:bg-destructive/10"
            >
              {language === "ms" ? "Cuba lagi" : language === "zh" ? "重试" : "Retry"}
            </button>
          </div>
        ) : null}
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
