"use client"

import { useEffect } from "react"
import { useAuth } from "@clerk/nextjs"
import { setAuthTokenGetter } from "@/lib/auth-token"
import { mergeAnonHistory } from "@/lib/api"

function uuidFallback(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `lr-anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

// Registers the Clerk token getter for API calls, adopts anonymous history
// into the account on first sign-in, and mints a fresh anonymous ID after
// sign-out.
export default function AuthSync() {
  const { getToken, isSignedIn, isLoaded } = useAuth()

  useEffect(() => {
    setAuthTokenGetter(isSignedIn ? () => getToken() : null)
    return () => setAuthTokenGetter(null)
  }, [isSignedIn, getToken])

  useEffect(() => {
    if (!isLoaded) return
    if (isSignedIn) {
      const anon = localStorage.getItem("lr-user-id")
      if (anon && !anon.startsWith("user_")) {
        mergeAnonHistory(anon).then((ok) => {
          if (ok) localStorage.removeItem("lr-user-id")
        })
      }
    } else if (!localStorage.getItem("lr-user-id")) {
      // Signed out: device starts a clean anonymous identity.
      localStorage.setItem("lr-user-id", uuidFallback())
    }
  }, [isLoaded, isSignedIn])

  return null
}
