"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Show, SignInButton, useUser } from "@clerk/nextjs"
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
  const { isSignedIn } = useUser()
  const [shares, setShares] = useState<MyShare[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmSlug, setConfirmSlug] = useState<string | null>(null)

  useEffect(() => {
    if (!isSignedIn) {
      setLoading(false)
      return
    }
    setLoading(true)
    listMyShares()
      .then(setShares)
      .finally(() => setLoading(false))
  }, [isSignedIn])

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/share/${slug}`)
    toast.success("Link copied")
  }

  const onRevoke = async (slug: string) => {
    const ok = await revokeShare(slug)
    if (ok) {
      setShares((prev) => prev.filter((s) => s.slug !== slug))
      toast.success("Share revoked — the public link no longer works")
    } else {
      toast.error("Could not revoke this share")
    }
    setConfirmSlug(null)
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="font-heading text-2xl font-bold">My shares</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Answers you have shared publicly. Revoking a share makes its link stop
        working.
      </p>

      <Show when="signed-out">
        <div className="mt-8 rounded-lg border border-dashed border-border p-8 text-center">
          <Share2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            Sign in to see and manage the answers you have shared.
          </p>
          <SignInButton mode="modal">
            <Button className="mt-4" size="sm">
              Sign in
            </Button>
          </SignInButton>
        </div>
      </Show>

      <Show when="signed-in">
        <div className="mt-6 flex flex-col gap-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 bg-muted/40" />
            ))
          ) : shares.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No shares yet — use the share button on any answer.
            </p>
          ) : (
            shares.map((share) => (
              <div
                key={share.slug}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/share/${share.slug}`}
                    className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary"
                  >
                    {share.question}
                  </Link>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyLink(share.slug)}
                      aria-label="Copy link"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirmSlug(share.slug)}
                      aria-label="Revoke share"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  {share.confidence_label && (
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium ${CHIP_STYLES[share.confidence_label] ?? CHIP_STYLES.medium}`}
                    >
                      {share.confidence_label}
                    </span>
                  )}
                  {share.agency && <span>{share.agency}</span>}
                  {share.created_at && (
                    <span>{new Date(share.created_at).toLocaleDateString()}</span>
                  )}
                </div>
                {confirmSlug === share.slug && (
                  <div className="mt-3 flex items-center gap-2 rounded-md bg-destructive/10 p-2 text-xs">
                    <span className="flex-1">
                      Revoke this share? The public link stops working.
                    </span>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onRevoke(share.slug)}
                    >
                      Revoke
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmSlug(null)}
                    >
                      Cancel
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
