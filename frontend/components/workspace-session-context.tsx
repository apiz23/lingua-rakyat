"use client"

import { createContext, useContext, useMemo, useState } from "react"
import { useUser } from "@clerk/nextjs"

interface WorkspaceSessionContextValue {
  userId: string
  activeSessionId: string | null
  setActiveSessionId: (sessionId: string | null) => void
}

const WorkspaceSessionContext =
  createContext<WorkspaceSessionContextValue | null>(null)

function readAnonId(): string {
  if (typeof window === "undefined") return ""
  let id = localStorage.getItem("lr-user-id")
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem("lr-user-id", id)
  }
  return id
}

// Shared across the sidebar (recent chats list) and the workspace page (chat
// panel) so switching a conversation from either place stays in sync without
// routing through the URL.
export function WorkspaceSessionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = useUser()
  const [anonId] = useState(readAnonId)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  const userId = user?.id ?? anonId

  const value = useMemo(
    () => ({ userId, activeSessionId, setActiveSessionId }),
    [userId, activeSessionId]
  )

  return (
    <WorkspaceSessionContext.Provider value={value}>
      {children}
    </WorkspaceSessionContext.Provider>
  )
}

export function useWorkspaceSession() {
  const ctx = useContext(WorkspaceSessionContext)
  if (!ctx) {
    throw new Error(
      "useWorkspaceSession must be used within WorkspaceSessionProvider"
    )
  }
  return ctx
}
