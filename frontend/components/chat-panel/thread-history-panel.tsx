"use client"

import { motion, useReducedMotion } from "framer-motion"
import { Clock3, Plus } from "lucide-react"
import type { ChatCopy } from "@/lib/i18n/chat"

export interface ChatThread {
  sessionId: string
  lastUpdated: string
  previewQuestion: string
  messageCount: number
}

export function ThreadHistoryPanel({
  threads,
  activeSessionId,
  copy,
  onSelectThread,
  onNewChat,
}: {
  threads: ChatThread[]
  activeSessionId: string
  copy: Pick<
    ChatCopy,
    "threadList" | "threadDesc" | "newChat" | "noSavedThreads" | "messages"
  >
  onSelectThread: (sessionId: string) => void
  onNewChat: () => void
}) {
  const shouldReduce = useReducedMotion()

  return (
    <motion.div
      key="history-panel"
      initial={{
        opacity: 0,
        height: 0,
        filter: shouldReduce ? "blur(0px)" : "blur(8px)",
      }}
      animate={{ opacity: 1, height: "auto", filter: "blur(0px)" }}
      exit={{
        opacity: 0,
        height: 0,
        filter: shouldReduce ? "blur(0px)" : "blur(8px)",
      }}
      transition={{
        duration: shouldReduce ? 0.01 : 0.3,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className="overflow-hidden"
    >
      <div className="mb-4 rounded-2xl border border-border/50 bg-card p-4 shadow-sm sm:mb-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">{copy.threadList}</h3>
            <p className="text-xs text-muted-foreground">{copy.threadDesc}</p>
          </div>

          <button
            type="button"
            onClick={onNewChat}
            className="inline-flex items-center gap-2 rounded-full border border-border/50 px-3 py-2 text-xs font-medium transition-colors hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" />
            {copy.newChat}
          </button>
        </div>

        {threads.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
            {copy.noSavedThreads}
          </div>
        ) : (
          <div className="space-y-2">
            {threads.map((thread) => {
              const isActive = thread.sessionId === activeSessionId

              return (
                <button
                  key={thread.sessionId}
                  type="button"
                  onClick={() => onSelectThread(thread.sessionId)}
                  className={[
                    "w-full rounded-xl border p-3 text-left transition-colors",
                    isActive
                      ? "border-primary/40 bg-secondary/60"
                      : "border-border/50 bg-background hover:bg-muted/40",
                  ].join(" ")}
                >
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-foreground">
                        {new Date(thread.lastUpdated).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <span className="text-[11px] text-muted-foreground">
                      {thread.messageCount} {copy.messages}
                    </span>
                  </div>

                  <p className="line-clamp-1 text-sm font-medium text-foreground">
                    {thread.previewQuestion}
                  </p>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </motion.div>
  )
}
