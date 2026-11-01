"use client"

import { createContext, useContext, useMemo, useState } from "react"
import { useUser } from "@clerk/nextjs"
import { resolveIdentity } from "@/lib/identity-lifecycle"

interface WorkspaceSessionContextValue {
  userId: string
  identityState: "signed_in" | "signed_out"
  actorGeneration: string
  sessionGeneration: number
  activeSessionId: string | null
  setActiveSessionId: (sessionId: string | null) => void
}

const WorkspaceSessionContext =
  createContext<WorkspaceSessionContextValue | null>(null)

function uuidFallback(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `lr-anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function readAnonId(): string {
  if (typeof window === "undefined") return ""
  let id = localStorage.getItem("lr-user-id")
  if (!id) {
    id = uuidFallback()
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
  const { user, isLoaded, isSignedIn } = useUser()
  const identity = resolveIdentity(isLoaded, isSignedIn, user?.id)
  // An unresolved or changing identity never renders the previous actor's tree.
  if (!identity.key) return null
  return <ActorWorkspace key={identity.key} actor={{ key: identity.key, userId: user?.id ?? "", state: identity.state }}>{children}</ActorWorkspace>
}

function ActorWorkspace({ children, actor }: {
  children: React.ReactNode
  actor: { key: string; userId: string; state: "signed_in" | "signed_out" }
}) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [anonymousId] = useState(() => actor.state === "signed_out" ? readAnonId() : "")
  const [sessionGeneration, setSessionGeneration] = useState(0)
  const [actorGeneration] = useState(uuidFallback)

  const value = useMemo(
    () => ({ userId: actor.state === "signed_in" ? actor.userId : anonymousId, identityState: actor.state, actorGeneration, sessionGeneration, activeSessionId,
      setActiveSessionId: (id: string | null) => { setSessionGeneration((n) => n + 1); setActiveSessionId(id) } }),
    [actor, anonymousId, actorGeneration, sessionGeneration, activeSessionId]
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
