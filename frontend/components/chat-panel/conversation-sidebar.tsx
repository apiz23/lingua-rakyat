"use client"

import { useEffect, useState } from "react"
import { ConversationSummary, Document, listConversations } from "@/lib/api"
import { cn } from "@/lib/utils"
import { AuthControls } from "@/components/auth-controls"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  MessageSquare,
  Plus,
  Upload,
  CheckCircle,
  Loader2,
  Clock,
  CircleAlert,
} from "lucide-react"

interface ConversationSidebarProps {
  userId: string
  activeSessionId: string | null
  documents: Document[]
  docsLoading: boolean
  onNewChat: () => void
  onSelectConversation: (sessionId: string) => void
  onUpload: () => void
  className?: string
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function docStatusIcon(status: Document["status"]) {
  switch (status) {
    case "ready": return <CheckCircle className="h-3.5 w-3.5 shrink-0 text-success" />
    case "processing": return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-warning" />
    case "error": return <CircleAlert className="h-3.5 w-3.5 shrink-0 text-destructive" />
    default: return <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
  }
}

export function ConversationSidebar({
  userId,
  activeSessionId,
  documents,
  docsLoading,
  onNewChat,
  onSelectConversation,
  onUpload,
  className,
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [convsLoading, setConvsLoading] = useState(false)

  useEffect(() => {
    if (!userId) return
    setConvsLoading(true)
    listConversations(userId)
      .then(setConversations)
      .finally(() => setConvsLoading(false))
  }, [userId, activeSessionId])

  return (
    <aside
      className={cn(
        "flex h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        className
      )}
    >
      <div className="p-3">
        <Button
          onClick={onNewChat}
          className="w-full justify-start gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          New chat
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2">
        {/* Conversations */}
        <div className="mb-1 px-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Recent chats
        </div>

        {convsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="mx-1 my-1 h-8 bg-muted/40" />
          ))
        ) : conversations.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            No chats yet — start one above
          </p>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.session_id}
              onClick={() => onSelectConversation(conv.session_id)}
              className={cn(
                "flex w-full flex-col gap-0.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-sidebar-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                activeSessionId === conv.session_id &&
                  "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
              )}
            >
              <span className="flex items-center gap-1.5 truncate">
                <MessageSquare className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate">{conv.title}</span>
              </span>
              <span className="pl-4 text-[10px] text-muted-foreground">
                {relativeTime(conv.last_at)} · {conv.count} msg
              </span>
            </button>
          ))
        )}

        {/* Documents */}
        <div className="mb-1 mt-4 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Your documents
        </div>

        {docsLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="mx-1 my-1 h-8 bg-muted/40" />
          ))
        ) : documents.length === 0 ? (
          <p className="px-2 pb-2 text-center text-xs text-muted-foreground">
            No documents yet
          </p>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs"
            >
              {docStatusIcon(doc.status)}
              <span className="truncate text-foreground">{doc.name}</span>
            </div>
          ))
        )}

        <button
          type="button"
          onClick={onUpload}
          className="mt-2 mb-3 flex w-full items-center gap-2 rounded-lg border-[1.5px] border-dashed border-border px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload PDF
        </button>
      </ScrollArea>

      <AuthControls />
    </aside>
  )
}
