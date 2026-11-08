"use client"

import { UiText, useTranslations } from "@/components/i18n"
import { AlertCircle, Ban, Loader2, RefreshCw, WifiOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { AdminApiError } from "@/lib/admin-api"

export function AdminLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/30 px-3 py-6 text-sm text-muted-foreground"
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      {<UiText text={label} />}
    </div>
  )
}

export function AdminErrorState({
  error,
  onRetry,
}: {
  error: unknown
  onRetry?: () => void
}) {
  const t = useTranslations()

  const apiError = error instanceof AdminApiError ? error : null

  const content =
    apiError?.code === "forbidden" ? (
      <>
        <Ban className="h-4 w-4" />
        <span>
          <UiText text="Permission denied. Your account is signed in but has no admin role for this page." />
        </span>
      </>
    ) : apiError?.code === "unavailable" ? (
      <>
        <WifiOff className="h-4 w-4" />
        <span>
          {apiError.message ===
          "Admin services are unavailable. The role provider or admin tables may not be configured."
            ? t(
                "Administration is unavailable. The trusted role store or admin tables are not provisioned yet."
              )
            : t(apiError.message)}
        </span>
      </>
    ) : apiError?.code === "unauthorized" ? (
      <>
        <AlertCircle className="h-4 w-4" />
        <span>
          <UiText text="Sign in with an account that has an admin role." />
        </span>
      </>
    ) : (
      <>
        <AlertCircle className="h-4 w-4" />
        <span>
          {error instanceof Error
            ? t(error.message)
            : t("Admin request failed.")}
        </span>
      </>
    )

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
    >
      <span className="flex items-center gap-2">{content}</span>
      {onRetry && apiError?.code !== "forbidden" ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" /> <UiText text="Retry" />{" "}
        </Button>
      ) : null}
    </div>
  )
}

export function AdminEmptyState({
  message,
  hint,
}: {
  message: string
  hint?: string
}) {
  return (
    <div className="rounded-md border border-dashed border-border/80 px-4 py-10 text-center">
      <p className="text-sm font-medium">{<UiText text={message} />}</p>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {<UiText text={hint} />}
        </p>
      ) : null}
    </div>
  )
}
