"use client"

import { UiText, useTranslations } from "@/components/i18n"
import { useEffect, useState } from "react"
import { LocalizedLink as Link } from "@/components/i18n"
import { Show, useUser } from "@clerk/nextjs"
import { Copy, Share2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { listMyShares, revokeShare, type MyShare } from "@/lib/api"

const CHIP_STYLES: Record<string, string> = {
  high: "bg-primary/10 text-primary",
  medium: "bg-muted text-muted-foreground",
  low: "bg-warning/15 text-warning",
}

export default function MySharesPage() {
  const t = useTranslations()

  const { isSignedIn } = useUser()
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [shares, setShares] = useState<MyShare[]>([])
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [confirmSlug, setConfirmSlug] = useState<string | null>(null)

  useEffect(() => {
    if (!isSignedIn) {
      setLoading(false)
      return
    }
    setLoadError(false)
    setLoading(true)
    listMyShares()
      .then(setShares)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }, [isSignedIn, attempt])

  const copyLink = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(
        window.location.origin + "/share/" + slug
      )
      toast.success(t("Link copied"))
    } catch {
      toast.error(
        t("Could not copy the link. Open the share and copy its address.")
      )
    }
  }

  const onRevoke = async (slug: string) => {
    if (revoking) return
    setRevoking(slug)
    try {
      const ok = await revokeShare(slug)
      if (!ok) throw new Error("Revoke failed")
      setShares((previous) => previous.filter((share) => share.slug !== slug))
      toast.success(t("Share revoked. The public link no longer works."))
      setConfirmSlug(null)
    } catch {
      toast.error(t("Could not revoke this share. Please try again."))
    } finally {
      setRevoking(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="font-heading text-2xl font-bold">
        <UiText text="My shares" />
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {" "}
        <UiText text="Answers you have shared publicly. Revoking a share makes its link stop working." />{" "}
      </p>

      <Show when="signed-out">
        <div className="mt-8 border border-dashed border-border p-8 text-center">
          <Share2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            {" "}
            <UiText text="Sign in to see and manage the answers you have shared." />{" "}
          </p>
          <Button className="mt-4" size="sm" asChild>
            <Link href="/sign-in">
              <UiText text="Sign in" />
            </Link>
          </Button>
        </div>
      </Show>

      <Show when="signed-in">
        <div aria-busy={loading} className="mt-6 flex flex-col gap-3">
          {loadError ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 p-4"
            >
              <p className="text-sm">
                <UiText text="Your shares could not load." />
              </p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => setAttempt((value) => value + 1)}
              >
                <UiText text="Try again" />
              </Button>
            </div>
          ) : loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 bg-muted/40" />
            ))
          ) : shares.length === 0 ? (
            <p className="border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {" "}
              <UiText text="No shares yet — use the share button on any answer." />{" "}
            </p>
          ) : (
            shares.map((share) => (
              <div
                key={share.slug}
                className="border border-border bg-background p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/share/${share.slug}`}
                    className="min-w-0 flex-1 text-base font-medium break-words hover:text-primary"
                  >
                    {share.question}
                  </Link>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyLink(share.slug)}
                      aria-label={t("Copy link")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirmSlug(share.slug)}
                      aria-label={t("Revoke share")}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {share.confidence_label && (
                    <span
                      className={`px-2 py-0.5 font-medium ${CHIP_STYLES[share.confidence_label] ?? CHIP_STYLES.medium}`}
                    >
                      {share.confidence_label}
                    </span>
                  )}
                  {share.agency && <span>{share.agency}</span>}
                  {share.created_at && (
                    <span>
                      {new Date(share.created_at).toLocaleDateString(t.locale)}
                    </span>
                  )}
                </div>
                {confirmSlug === share.slug && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 bg-destructive/10 p-2 text-xs">
                    <span className="flex-1">
                      {" "}
                      <UiText text="Revoke this share? The public link stops working." />{" "}
                    </span>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={revoking !== null}
                      onClick={() => void onRevoke(share.slug)}
                    >
                      {" "}
                      <UiText text="Revoke" />{" "}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={revoking !== null}
                      onClick={() => setConfirmSlug(null)}
                    >
                      {" "}
                      <UiText text="Cancel" />{" "}
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Show>
    </div>
  )
}
