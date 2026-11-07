"use client"

import Link from "next/link"
import { RefreshCw } from "lucide-react"

import { AdminPageHeader } from "@/components/admin/admin-shell"
import { AdminEmptyState, AdminErrorState, AdminLoading } from "@/components/admin/admin-state"
import { MetricCell } from "@/components/admin/metric-card"
import { StatusBadge } from "@/components/admin/status-badge"
import { Button } from "@/components/ui/button"
import { getDashboard } from "@/lib/admin-api"
import { useAdminResource } from "@/hooks/useAdminResource"

export default function AdminOverviewPage() {
  const { data, error, loading, reload } = useAdminResource(getDashboard, [])

  return (
    <div>
      <AdminPageHeader
        kicker="Operations / 01"
        title="Control room"
        description="Live state of the document catalogue, trusted sources and publication lifecycle. Use the summaries below to prioritize reviews, source verification and processing failures."
        actions={
          <Button variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
        }
      />

      {loading ? <AdminLoading label="Reading operational state…" /> : null}
      {error ? <AdminErrorState error={error} onRetry={reload} /> : null}

      {data ? (
        <>
          <section aria-label="Operational metrics" className="admin-ledger">
            <MetricCell index={1} label="Published" value={data.metrics.published} href="/manage/publications" tone="success" span="lead" hint="Publicly eligible documents" />
            <MetricCell index={2} label="Awaiting review" value={data.metrics.awaiting_review} href="/manage/review" tone="warning" hint="Ready, unpublished" />
            <MetricCell index={3} label="Total documents" value={data.metrics.total_documents} href="/manage/documents" hint="All catalogue rows" />

            <MetricCell index={4} label="Approved" value={data.metrics.approved} href="/manage/documents?publication_status=approved" tone="warning" hint="Approved, not live" />
            <MetricCell index={5} label="Suspended" value={data.metrics.suspended} href="/manage/publications?publication_status=suspended" tone="danger" hint="Temporarily withdrawn" />
            <MetricCell index={6} label="Withdrawn" value={data.metrics.withdrawn} href="/manage/publications?publication_status=archived" hint="Archived lifecycle" />
            <MetricCell index={7} label="Expiring 30d" value={data.metrics.expiring} href="/manage/publications" tone="warning" hint="Review before expiry" />

            <MetricCell index={8} label="Rejected" value={data.metrics.rejected} href="/manage/audit?action=review.reject" tone="danger" hint="Latest review outcome" />
            <MetricCell index={9} label="Expired" value={data.metrics.expired} href="/manage/publications?publication_status=expired" tone="danger" hint="No longer public" />
            <MetricCell index={10} label="Unverified sources" value={data.metrics.unverified_sources} href="/manage/sources?verification_status=unverified" tone="warning" hint="Not usable for approval" />
            <MetricCell index={11} label="Failed ingestion" value={data.metrics.failed_ingestion} href="/manage/ingestion" tone="danger" hint="Requires operator action" />
          </section>

          <section className="mt-10" aria-label="Recent administrative activity">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="admin-kicker">Audit / latest 10</p>
                <h2 className="mt-1 font-heading text-xl font-bold tracking-tight">Recent activity</h2>
              </div>
              <Link href="/manage/audit" className="text-sm font-medium text-primary hover:underline">
                Full audit log →
              </Link>
            </div>

            {data.recent_activity.length === 0 ? (
              <AdminEmptyState
                message="No administrative activity recorded yet."
                hint="Source verification, reviews, publication and role changes appear here."
              />
            ) : (
              <ol className="border-t border-border">
                {data.recent_activity.map((entry, index) => (
                  <li
                    key={`${entry.id ?? index}`}
                    className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1 border-b border-border py-3 sm:grid-cols-[5.5rem_auto_minmax(0,1fr)_auto]"
                  >
                    <span className="admin-index tabular-nums">
                      {entry.created_at
                        ? new Date(entry.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : "—"}
                    </span>
                    <StatusBadge value={entry.action?.split(".")[0] ?? "action"} />
                    <span className="min-w-0 break-words text-sm">
                      <span className="font-medium">{entry.action}</span>
                      <span className="text-muted-foreground">
                        {" "}· {entry.target_type} {entry.target_id ?? ""}
                      </span>
                      {entry.reason ? (
                        <span className="block text-xs text-muted-foreground">{entry.reason}</span>
                      ) : null}
                    </span>
                    <span className="col-start-2 text-xs text-muted-foreground sm:col-start-auto">
                      {entry.actor_id}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
