"use client"

import { useState } from "react"
import Link from "next/link"

import { AdminPageHeader } from "@/components/admin/admin-shell"
import { AdminEmptyState, AdminErrorState, AdminLoading } from "@/components/admin/admin-state"
import { StatusBadge } from "@/components/admin/status-badge"
import { Button } from "@/components/ui/button"
import { listAdminDocuments } from "@/lib/admin-api"
import { useAdminResource } from "@/hooks/useAdminResource"

const FILTERS = ["published", "approved", "suspended", "expired", "archived"] as const

export default function AdminPublicationsPage() {
  const [status, setStatus] = useState<(typeof FILTERS)[number]>("published")
  const { data, error, loading, reload } = useAdminResource(
    () => listAdminDocuments({ publication_status: status, page_size: 100 }),
    [status]
  )

  return (
    <div>
      <AdminPageHeader
        kicker="Lifecycle / 06"
        title="Publications"
        description="Approval and publication are separate decisions. Browse published, approved, suspended, expired and withdrawn documents. Suspension and withdrawal take effect on the next eligibility check."
      />

      <div className="mb-3 flex flex-wrap gap-1 border-b border-border pb-3">
        {FILTERS.map((value, index) => (
          <Button
            key={value}
            size="sm"
            variant={status === value ? "default" : "ghost"}
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
          >
            <span className="admin-index mr-1">{String(index + 1).padStart(2, "0")}</span>
            {value}
          </Button>
        ))}
      </div>

      {loading ? <AdminLoading label="Loading publications…" /> : null}
      {error ? <AdminErrorState error={error} onRetry={reload} /> : null}

      {data ? (
        data.items.length === 0 ? (
          <AdminEmptyState message={`No ${status} documents.`} />
        ) : (
          <div>
            {data.items.map((doc, index) => (
              <article key={doc.id} className="admin-record">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="admin-index">{String(index + 1).padStart(2, "0")}</span>
                      <Link href={`/manage/documents/${encodeURIComponent(doc.id)}`} className="font-heading text-lg font-semibold tracking-tight text-primary hover:underline">
                        {doc.name}
                      </Link>
                      <StatusBadge value={doc.publication_status} />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                      <span>rev {doc.current_revision}</span>
                      <span>source {doc.source_id ?? "none"}</span>
                      {doc.expires_at ? <span>expires {new Date(doc.expires_at).toLocaleDateString()}</span> : <span>no expiry</span>}
                      {doc.published_at ? <span>published {new Date(doc.published_at).toLocaleDateString()}</span> : null}
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/manage/documents/${encodeURIComponent(doc.id)}`}>Inspect</Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )
      ) : null}
    </div>
  )
}
