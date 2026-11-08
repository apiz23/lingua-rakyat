"use client"

import { UiText } from "@/components/i18n"
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs"
import { Loader2 } from "lucide-react"

export default function SSOCallbackPage() {
  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center gap-3 px-4 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      <p role="status" aria-live="polite" className="text-sm">
        <UiText text="Finishing sign-in…" />
      </p>
      <AuthenticateWithRedirectCallback />
    </div>
  )
}
