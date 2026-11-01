"use client"

import { useEffect } from "react"
import { useAuth } from "@clerk/nextjs"
import { setAuthTokenGetter } from "@/lib/auth-token"

function uuidFallback(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `lr-anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

// Registers the Clerk token getter and mints a fresh anonymous ID after
// sign-out. Anonymous history linking is disabled until source ownership can
// be proven with a server-issued capability.
export default function AuthSync() {
  const { getToken, isSignedIn, isLoaded } = useAuth()

  useEffect(() => {
    setAuthTokenGetter(isSignedIn ? () => getToken() : null)
    return () => setAuthTokenGetter(null)
  }, [isSignedIn, getToken])

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn && !localStorage.getItem("lr-user-id")) {
      // Signed out: device starts a clean anonymous identity.
      localStorage.setItem("lr-user-id", uuidFallback())
    }
  }, [isLoaded, isSignedIn])

  return null
}
