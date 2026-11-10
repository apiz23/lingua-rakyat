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

export default function AuthSync() {
  const { getToken, isSignedIn, isLoaded } = useAuth()

  useEffect(() => {
    setAuthTokenGetter(isSignedIn ? () => getToken() : null)
    return () => setAuthTokenGetter(null)
  }, [isSignedIn, getToken])

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn && !localStorage.getItem("lr-user-id")) {
      localStorage.setItem("lr-user-id", uuidFallback())
    }
  }, [isLoaded, isSignedIn])

  return null
}
