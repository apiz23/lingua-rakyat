"use client"

import { useState } from "react"
import Link from "next/link"
import { RefreshCw, Search } from "lucide-react"
import { toast } from "sonner"

import { ActionDialog } from "@/components/admin/action-dialog"
import { AdminPageHeader } from "@/components/admin/admin-shell"
import { AdminEmptyState, AdminErrorState, AdminLoading } from "@/components/admin/admin-state"
import { MetricCell } from "@/components/admin/metric-card"
import { StatusBadge } from "@/components/admin/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AdminApiError,
  cancelIngestionJob,
  getIngestionOverview,
  ingestCandidate,
  listIngestionCandidates,
  listIngestionJobs,
  retryIngestionJob,
  skipCandidate,
  startAdminDiscovery,
  type IngestionCandidate,
  type IngestionJob,
} from "@/lib/admin-api"
import { useAdminResource } from "@/hooks/useAdminResource"

function CandidateRow({
  candidate,
  onIngest,
  onSkip,
}: {
  candidate: IngestionCandidate
  onIngest: (candidate: IngestionCandidate) => void
  onSkip: (candidate: IngestionCandidate) => void
}) {
  const canIngest = ["discovered", "failed", "duplicate_review", "ocr_required"].includes(candidate.status)
  return (
    <article className="admin-record">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="font-heading text-base font-semibold tracking-tight">
              {candidate.title || candidate.source_url}
            </h3>
            <StatusBadge value={candidate.status} />
            {candidate.duplicate_class ? (
              <StatusBadge value="pending" label={candidate.duplicate_class.replaceAll("_", " ")} />
            ) : null}
            {candidate.ocr_required ? <StatusBadge value="warning" label="OCR required" /> : null}
          </div>
          <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
            {candidate.source_id} · {candidate.canonical_url}
          </p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{candidate.issuing_organization ?? "Unknown organisation"}</span>
            <span>{candidate.page_count} pages</span>
            {candidate.publication_date ? (
              <span>published {new Date(candidate.publication_date).toLocaleDateString()}</span>
            ) : null}
            {candidate.document_id ? (
              <Link
                href={`/manage/documents/${encodeURIComponent(candidate.document_id)}`}
                className="text-primary hover:underline"
              >
                Open document
              </Link>
            ) : null}
          </div>
          {candidate.error_message ? (
            <p className="mt-1 text-xs text-destructive">{candidate.error_message}</p>
          ) : null}
          {candidate.skip_reason ? (
            <p className="mt-1 text-xs text-muted-foreground">Skipped: {candidate.skip_reason}</p>
          ) : null}
          <details className="mt-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer">Source evidence</summary>
            <pre className="mt-1 max-w-xl overflow-x-auto whitespace-pre-wrap text-[11px]">
              {JSON.stringify(candidate.metadata, null, 2)}
            </pre>
          </details>
        </div>
        <div className="flex flex-wrap gap-2">
          {canIngest ? (
            <Button size="sm" onClick={() => onIngest(candidate)}>
              {candidate.status === "ocr_required" ? "Re-ingest" : "Ingest"}
            </Button>
          ) : null}
          {!["ingested", "ingesting", "skipped"].includes(candidate.status) ? (
            <Button size="sm" variant="outline" onClick={() => onSkip(candidate)}>
              Skip
            </Button>
          ) : null}
          <Button asChild size="sm" variant="ghost">
            <a href={candidate.source_url} target="_blank" rel="noreferrer noopener">
              Source
            </a>
          </Button>
        </div>
      </div>
    </article>
  )
}

function JobsTable({
  jobs,
  onRetry,
  onCancel,
}: {
  jobs: IngestionJob[]
  onRetry: (job: IngestionJob) => void
  onCancel: (job: IngestionJob) => void
}) {
  if (jobs.length === 0) return <AdminEmptyState message="No ingestion jobs yet." />
  return (
    <div className="admin-surface overflow-x-auto">
      <table className="admin-table min-w-[760px]">
<caption className="sr-only">Candidate documents and ingestion processing status.</caption>
        <thead>
          <tr>
            <th scope="col">Job</th>
            <th scope="col">Type</th>
            <th scope="col">Status</th>
            <th scope="col">Stage</th>
            <th className="text-right">Progress</th>
            <th className="text-right">Attempts</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id}>
              <td className="font-mono text-[11px]">{job.id.slice(0, 8)}</td>
              <td className="text-xs">{job.job_type}</td>
              <td><StatusBadge value={job.status} /></td>
              <td className="text-xs">{job.stage ?? "—"}</td>
              <td className="text-right tabular-nums">{job.progress}%</td>
              <td className="text-right tabular-nums">{job.attempts}/{job.max_attempts}</td>
              <td className="text-right">
                <span className="flex justify-end gap-1">
                  {job.status === "failed" ? (
                    <Button size="sm" variant="outline" onClick={() => onRetry(job)}>Retry</Button>
                  ) : null}
                  {job.status === "queued" ? (
                    <Button size="sm" variant="ghost" onClick={() => onCancel(job)}>Cancel</Button>
                  ) : null}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AdminIngestionPage() {
  const [sourceId, setSourceId] = useState("")
  const [status, setStatus] = useState("")
  const [query, setQuery] = useState("")
  const [skipping, setSkipping] = useState<IngestionCandidate | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const overview = useAdminResource(getIngestionOverview, [])
  const candidates = useAdminResource(
    () => listIngestionCandidates({ source_id: sourceId, status, q: query, page_size: 50 }),
    [sourceId, status, query]
  )
  const jobs = useAdminResource(() => listIngestionJobs({ page_size: 20 }), [])

  const refreshAll = () => {
    void overview.reload()
    void candidates.reload()
    void jobs.reload()
  }

  const discover = async (id: string) => {
    setBusyId(id)
    try {
      await startAdminDiscovery(id)
      toast.success("Discovery queued")
      refreshAll()
    } catch (cause) {
      toast.error(cause instanceof AdminApiError ? cause.message : "Discovery failed")
    } finally {
      setBusyId(null)
    }
  }

  const ingest = async (candidate: IngestionCandidate) => {
    setBusyId(candidate.id)
    try {
      await ingestCandidate(candidate.id)
      toast.success("Ingestion queued")
      refreshAll()
    } catch (cause) {
      toast.error(cause instanceof AdminApiError ? cause.message : "Ingestion failed")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <AdminPageHeader
        kicker="Pipeline / 08"
        title="Ingestion"
        description="Discover, fetch, validate and process official documents. The pipeline never approves or publishes; completed documents stop at the review queue."
        actions={
          <Button variant="outline" size="sm" onClick={refreshAll}>
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
        }
      />

      {overview.loading ? <AdminLoading label="Reading ingestion state…" /> : null}
      {overview.error ? <AdminErrorState error={overview.error} onRetry={overview.reload} /> : null}

      {overview.data ? (
        <>
          <section className="admin-ledger mb-8" aria-label="Ingestion metrics">
            <MetricCell index={1} label="Discovered" value={overview.data.candidates.total ?? 0} href="/manage/ingestion" span="lead" hint="Candidates awaiting a decision" />
            <MetricCell index={2} label="Queued jobs" value={overview.data.jobs.queued ?? 0} href="/manage/ingestion" tone="warning" />
            <MetricCell index={3} label="Running" value={overview.data.jobs.running ?? 0} href="/manage/ingestion" tone="warning" />
            <MetricCell index={4} label="Ingested" value={overview.data.candidates.ingested ?? 0} href="/manage/review" tone="success" />
            <MetricCell index={5} label="Duplicate review" value={overview.data.candidates.duplicate_review ?? 0} href="/manage/ingestion" tone="warning" />
            <MetricCell index={6} label="OCR required" value={overview.data.documents.ocr_required ?? 0} href="/manage/ingestion" tone="warning" />
            <MetricCell index={7} label="Failed jobs" value={overview.data.jobs.failed ?? 0} href="/manage/ingestion" tone="danger" />
            <MetricCell index={8} label="Awaiting review" value={overview.data.documents.awaiting_review ?? 0} href="/manage/review" tone="success" />
          </section>

          <section className="mb-8">
            <div className="mb-3 flex items-end justify-between gap-2">
              <div>
                <p className="admin-kicker">Sources / verified only</p>
                <h2 className="mt-1 font-heading text-xl font-bold tracking-tight">Discovery</h2>
              </div>
            </div>
            {overview.data.sources.length === 0 ? (
              <AdminEmptyState
                message="No verified sources available."
                hint="Register and verify an official source before discovery."
              />
            ) : (
              <div>
                {overview.data.sources.map((source, index) => (
                  <article key={source.source_id} className="admin-record">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="admin-index">{String(index + 1).padStart(2, "0")}</span>
                          <span className="font-heading text-base font-semibold">{source.issuing_organization}</span>
                          <StatusBadge value={source.verification_status} />
                        </div>
                        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                          {source.source_id} · {source.source_type}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Last discovery:{" "}
                          {source.last_discovered_at ? new Date(source.last_discovered_at).toLocaleString() : "never"}
                        </p>
                        {source.last_error ? <p className="mt-1 text-xs text-destructive">{source.last_error}</p> : null}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => void discover(source.source_id)}
                        disabled={busyId === source.source_id}
                      >
                        {busyId === source.source_id ? "Queuing…" : "Start discovery"}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}

      <section className="mb-8">
        <div className="mb-3 flex items-end justify-between gap-2">
          <div>
            <p className="admin-kicker">Candidates</p>
            <h2 className="mt-1 font-heading text-xl font-bold tracking-tight">Discovered documents</h2>
          </div>
          <span className="admin-stamp">{candidates.data?.total ?? 0} total</span>
        </div>

        <div className="admin-filterbar mb-3 md:grid-cols-3">
          <label className="relative">
            <span className="sr-only">Search candidates</span>
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input className="pl-8" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, URL, external id" />
          </label>
          <select className="neo-input h-9 rounded-md px-2 text-sm" value={sourceId} onChange={(event) => setSourceId(event.target.value)} aria-label="Source">
            <option value="">All verified sources</option>
            {(overview.data?.sources ?? []).map((source) => (
              <option key={source.source_id} value={source.source_id}>{source.source_id}</option>
            ))}
          </select>
          <select className="neo-input h-9 rounded-md px-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Candidate status">
            <option value="">All statuses</option>
            {["discovered", "ingested", "unchanged", "duplicate_review", "ocr_required", "skipped", "failed"].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </div>

        {candidates.loading ? <AdminLoading label="Loading candidates…" /> : null}
        {candidates.error ? <AdminErrorState error={candidates.error} onRetry={candidates.reload} /> : null}
        {candidates.data ? (
          candidates.data.items.length === 0 ? (
            <AdminEmptyState message="No candidates yet." hint="Run discovery on a verified source." />
          ) : (
            <div>
              {candidates.data.items.map((candidate) => (
                <CandidateRow
                  key={candidate.id}
                  candidate={candidate}
                  onIngest={(item) => void ingest(item)}
                  onSkip={setSkipping}
                />
              ))}
            </div>
          )
        ) : null}
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-2">
          <div>
            <p className="admin-kicker">Jobs</p>
            <h2 className="mt-1 font-heading text-xl font-bold tracking-tight">Execution history</h2>
          </div>
        </div>
        {jobs.loading ? <AdminLoading label="Loading jobs…" /> : null}
        {jobs.error ? <AdminErrorState error={jobs.error} onRetry={jobs.reload} /> : null}
        {jobs.data ? (
          <JobsTable
            jobs={jobs.data.items}
            onRetry={async (job) => {
              try {
                await retryIngestionJob(job.id)
                toast.success("Job queued for retry")
                refreshAll()
              } catch (cause) {
                toast.error(cause instanceof AdminApiError ? cause.message : "Retry failed")
              }
            }}
            onCancel={async (job) => {
              try {
                await cancelIngestionJob(job.id)
                toast.success("Job cancelled")
                refreshAll()
              } catch (cause) {
                toast.error(cause instanceof AdminApiError ? cause.message : "Cancel failed")
              }
            }}
          />
        ) : null}
      </section>

      <div className="mt-8 admin-callout">
        <p className="admin-kicker">Review handoff</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Processed documents stay private and unpublished. Approve and publish them through the
          existing review queue.
        </p>
        <Button asChild size="sm" className="mt-3">
          <Link href="/manage/review">Open review queue</Link>
        </Button>
      </div>

      <ActionDialog
        open={Boolean(skipping)}
        onOpenChange={(open) => !open && setSkipping(null)}
        title="Skip discovered candidate"
        description="The reason is recorded in the audit log. Discovery may surface it again later."
        confirmLabel="Skip candidate"
        requireReason
        onConfirm={async (reason) => {
          if (!skipping) return
          try {
            await skipCandidate(skipping.id, reason)
            toast.success("Candidate skipped")
            setSkipping(null)
            refreshAll()
          } catch (cause) {
            toast.error(cause instanceof AdminApiError ? cause.message : "Skip failed")
          }
        }}
      />
    </div>
  )
}
