"use client"

import { UiText, useTranslations } from "@/components/i18n"
import { useState } from "react"
import { LocalizedLink as Link } from "@/components/i18n"
import { RefreshCw, Search } from "lucide-react"
import { toast } from "sonner"

import { ActionDialog } from "@/components/admin/action-dialog"
import { AdminPageHeader } from "@/components/admin/admin-shell"
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoading,
} from "@/components/admin/admin-state"
import { MetricCell } from "@/components/admin/metric-card"
import { StatusBadge } from "@/components/admin/status-badge"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  const t = useTranslations()

  const canIngest = [
    "discovered",
    "failed",
    "duplicate_review",
    "ocr_required",
  ].includes(candidate.status)
  return (
    <article className="mb-3 grid min-w-0 gap-3 rounded-lg border border-border bg-card p-4 [overflow-wrap:anywhere] text-card-foreground shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="font-heading text-base font-semibold tracking-tight">
              {candidate.title || candidate.source_url}
            </h3>
            <StatusBadge value={candidate.status} />
            {candidate.duplicate_class ? (
              <StatusBadge
                value="pending"
                label={candidate.duplicate_class.replaceAll("_", " ")}
              />
            ) : null}
            {candidate.ocr_required ? (
              <StatusBadge value="warning" label={t("OCR required")} />
            ) : null}
          </div>
          <p className="mt-1 font-mono text-[11px] break-all text-muted-foreground">
            {candidate.source_id} · {candidate.canonical_url}
          </p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              {candidate.issuing_organization ?? t("Unknown organisation")}
            </span>
            <span>
              {candidate.page_count} <UiText text="pages" />
            </span>
            {candidate.publication_date ? (
              <span>
                <UiText text="published" />{" "}
                {new Date(candidate.publication_date).toLocaleDateString(
                  t.locale
                )}
              </span>
            ) : null}
            {candidate.document_id ? (
              <Link
                href={`/manage/documents/${encodeURIComponent(candidate.document_id)}`}
                className="text-primary hover:underline"
              >
                {" "}
                <UiText text="Open document" />{" "}
              </Link>
            ) : null}
          </div>
          {candidate.error_message ? (
            <p className="mt-1 text-xs text-destructive">
              {candidate.error_message}
            </p>
          ) : null}
          {candidate.skip_reason ? (
            <p className="mt-1 text-xs text-muted-foreground">
              <UiText text="Skipped:" /> {candidate.skip_reason}
            </p>
          ) : null}
          <Collapsible className="mt-2 text-xs text-muted-foreground">
            <CollapsibleTrigger className="cursor-pointer text-left underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              <UiText text="Source evidence" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="mt-1 max-w-xl overflow-x-auto text-[11px] whitespace-pre-wrap">
                {JSON.stringify(candidate.metadata, null, 2)}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        </div>
        <div className="flex flex-wrap gap-2">
          {canIngest ? (
            <Button size="sm" onClick={() => onIngest(candidate)}>
              {candidate.status === "ocr_required"
                ? t("Re-ingest")
                : t("Ingest")}
            </Button>
          ) : null}
          {!["ingested", "ingesting", "skipped"].includes(candidate.status) ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSkip(candidate)}
            >
              {" "}
              <UiText text="Skip" />{" "}
            </Button>
          ) : null}
          <Button asChild size="sm" variant="ghost">
            <a
              href={candidate.source_url}
              target="_blank"
              rel="noreferrer noopener"
            >
              {" "}
              <UiText text="Source" />{" "}
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
  const t = useTranslations()

  if (jobs.length === 0)
    return <AdminEmptyState message={t("No ingestion jobs yet.")} />
  return (
    <Card className="gap-0 py-0">
      <Table className="min-w-[760px]">
        <TableCaption className="sr-only">
          <UiText text="Candidate documents and ingestion processing status." />
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">
              <UiText text="Job" />
            </TableHead>
            <TableHead scope="col">
              <UiText text="Type" />
            </TableHead>
            <TableHead scope="col">
              <UiText text="Status" />
            </TableHead>
            <TableHead scope="col">
              <UiText text="Stage" />
            </TableHead>
            <TableHead className="text-right">
              <UiText text="Progress" />
            </TableHead>
            <TableHead className="text-right">
              <UiText text="Attempts" />
            </TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow key={job.id}>
              <TableCell className="font-mono text-[11px]">
                {job.id.slice(0, 8)}
              </TableCell>
              <TableCell className="text-xs">{t(job.job_type)}</TableCell>
              <TableCell>
                <StatusBadge value={job.status} />
              </TableCell>
              <TableCell className="text-xs">
                {job.stage ? t(job.stage) : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {job.progress}%
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {job.attempts}/{job.max_attempts}
              </TableCell>
              <TableCell className="text-right">
                <span className="flex justify-end gap-1">
                  {job.status === "failed" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onRetry(job)}
                    >
                      <UiText text="Retry" />
                    </Button>
                  ) : null}
                  {job.status === "queued" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onCancel(job)}
                    >
                      <UiText text="Cancel" />
                    </Button>
                  ) : null}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

export default function AdminIngestionPage() {
  const t = useTranslations()

  const [sourceId, setSourceId] = useState("")
  const [status, setStatus] = useState("")
  const [query, setQuery] = useState("")
  const [skipping, setSkipping] = useState<IngestionCandidate | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const overview = useAdminResource(getIngestionOverview, [])
  const candidates = useAdminResource(
    () =>
      listIngestionCandidates({
        source_id: sourceId,
        status,
        q: query,
        page_size: 50,
      }),
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
      toast.success(t("Discovery queued"))
      refreshAll()
    } catch (cause) {
      toast.error(
        cause instanceof AdminApiError
          ? t(cause.message)
          : t("Discovery failed")
      )
    } finally {
      setBusyId(null)
    }
  }

  const ingest = async (candidate: IngestionCandidate) => {
    setBusyId(candidate.id)
    try {
      await ingestCandidate(candidate.id)
      toast.success(t("Ingestion queued"))
      refreshAll()
    } catch (cause) {
      toast.error(
        cause instanceof AdminApiError
          ? t(cause.message)
          : t("Ingestion failed")
      )
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <AdminPageHeader
        kicker={t("Pipeline / 08")}
        title={t("Ingestion")}
        description={t(
          "Discover, fetch, validate and process official documents. The pipeline never approves or publishes; completed documents stop at the review queue."
        )}
        actions={
          <Button variant="outline" size="sm" onClick={refreshAll}>
            <RefreshCw className="size-3.5" /> <UiText text="Refresh" />{" "}
          </Button>
        }
      />

      {overview.loading ? (
        <AdminLoading label={t("Reading ingestion state…")} />
      ) : null}
      {overview.error ? (
        <AdminErrorState error={overview.error} onRetry={overview.reload} />
      ) : null}

      {overview.data ? (
        <>
          <section
            className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            aria-label={t("Ingestion metrics")}
          >
            <MetricCell
              index={1}
              label={t("Discovered")}
              value={overview.data.candidates.total ?? 0}
              href="/manage/ingestion"
              span="lead"
              hint={t("Candidates awaiting a decision")}
            />
            <MetricCell
              index={2}
              label={t("Queued jobs")}
              value={overview.data.jobs.queued ?? 0}
              href="/manage/ingestion"
              tone="warning"
            />
            <MetricCell
              index={3}
              label={t("Running")}
              value={overview.data.jobs.running ?? 0}
              href="/manage/ingestion"
              tone="warning"
            />
            <MetricCell
              index={4}
              label={t("Ingested")}
              value={overview.data.candidates.ingested ?? 0}
              href="/manage/review"
              tone="success"
            />
            <MetricCell
              index={5}
              label={t("Duplicate review")}
              value={overview.data.candidates.duplicate_review ?? 0}
              href="/manage/ingestion"
              tone="warning"
            />
            <MetricCell
              index={6}
              label={t("OCR required")}
              value={overview.data.documents.ocr_required ?? 0}
              href="/manage/ingestion"
              tone="warning"
            />
            <MetricCell
              index={7}
              label={t("Failed jobs")}
              value={overview.data.jobs.failed ?? 0}
              href="/manage/ingestion"
              tone="danger"
            />
            <MetricCell
              index={8}
              label={t("Awaiting review")}
              value={overview.data.documents.awaiting_review ?? 0}
              href="/manage/review"
              tone="success"
            />
          </section>

          <section className="mb-8">
            <div className="mb-3 flex items-end justify-between gap-2">
              <div>
                <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                  <UiText text="Sources / verified only" />
                </p>
                <h2 className="mt-1 font-heading text-xl font-bold tracking-tight">
                  <UiText text="Discovery" />
                </h2>
              </div>
            </div>
            {overview.data.sources.length === 0 ? (
              <AdminEmptyState
                message={t("No verified sources available.")}
                hint={t(
                  "Register and verify an official source before discovery."
                )}
              />
            ) : (
              <div>
                {overview.data.sources.map((source, index) => (
                  <article
                    key={source.source_id}
                    className="mb-3 grid min-w-0 gap-3 rounded-lg border border-border bg-card p-4 [overflow-wrap:anywhere] text-card-foreground shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 flex-1 basis-64">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="font-heading text-base font-semibold">
                            {source.issuing_organization}
                          </span>
                          <StatusBadge value={source.verification_status} />
                        </div>
                        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                          {source.source_id} · {source.source_type}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {" "}
                          <UiText text="Last discovery:" />{" "}
                          {source.last_discovered_at
                            ? new Date(
                                source.last_discovered_at
                              ).toLocaleString(t.locale)
                            : t("never")}
                        </p>
                        {source.last_error ? (
                          <p className="mt-1 text-xs text-destructive">
                            {source.last_error}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => void discover(source.source_id)}
                        disabled={busyId === source.source_id}
                      >
                        {busyId === source.source_id
                          ? t("Queuing…")
                          : t("Start discovery")}
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
            <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              <UiText text="Candidates" />
            </p>
            <h2 className="mt-1 font-heading text-xl font-bold tracking-tight">
              <UiText text="Discovered documents" />
            </h2>
          </div>
          <Badge variant="secondary">
            {candidates.data?.total ?? 0} <UiText text="total" />
          </Badge>
        </div>

        <div className="mb-3 grid min-w-0 gap-4 rounded-lg border border-border bg-card p-4 md:grid-cols-2 xl:grid-cols-3">
          <Field className="md:col-span-2 xl:col-span-1">
            <FieldLabel htmlFor="candidate-search" className="sr-only">
              <UiText text="Search candidates" />
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                id="candidate-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("Search title, URL, external id")}
              />
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor="candidate-source-filter">
              <UiText text="Source" />
            </FieldLabel>
            <Select
              value={sourceId || "all"}
              onValueChange={(value) =>
                setSourceId(value === "all" ? "" : value)
              }
            >
              <SelectTrigger id="candidate-source-filter" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">
                    <UiText text="All verified sources" />
                  </SelectItem>
                  {(overview.data?.sources ?? []).map((source) => (
                    <SelectItem key={source.source_id} value={source.source_id}>
                      {source.source_id}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="candidate-status-filter">
              <UiText text="Candidate status" />
            </FieldLabel>
            <Select
              value={status || "all"}
              onValueChange={(value) => setStatus(value === "all" ? "" : value)}
            >
              <SelectTrigger id="candidate-status-filter" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">
                    <UiText text="All statuses" />
                  </SelectItem>
                  {[
                    "discovered",
                    "ingested",
                    "unchanged",
                    "duplicate_review",
                    "ocr_required",
                    "skipped",
                    "failed",
                  ].map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(value)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </div>

        {candidates.loading ? (
          <AdminLoading label={t("Loading candidates…")} />
        ) : null}
        {candidates.error ? (
          <AdminErrorState
            error={candidates.error}
            onRetry={candidates.reload}
          />
        ) : null}
        {candidates.data ? (
          candidates.data.items.length === 0 ? (
            <AdminEmptyState
              message={t("No candidates yet.")}
              hint={t("Run discovery on a verified source.")}
            />
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

      <section className="flex flex-col gap-6">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              <UiText text="Jobs" />
            </p>
            <h2 className="mt-1 font-heading text-xl font-bold tracking-tight">
              <UiText text="Execution history" />
            </h2>
          </div>
        </div>
        {jobs.loading ? <AdminLoading label={t("Loading jobs…")} /> : null}
        {jobs.error ? (
          <AdminErrorState error={jobs.error} onRetry={jobs.reload} />
        ) : null}
        {jobs.data ? (
          <JobsTable
            jobs={jobs.data.items}
            onRetry={async (job) => {
              try {
                await retryIngestionJob(job.id)
                toast.success(t("Job queued for retry"))
                refreshAll()
              } catch (cause) {
                toast.error(
                  cause instanceof AdminApiError
                    ? t(cause.message)
                    : t("Retry failed")
                )
              }
            }}
            onCancel={async (job) => {
              try {
                await cancelIngestionJob(job.id)
                toast.success(t("Job cancelled"))
                refreshAll()
              } catch (cause) {
                toast.error(
                  cause instanceof AdminApiError
                    ? t(cause.message)
                    : t("Cancel failed")
                )
              }
            }}
          />
        ) : null}
      </section>

      <div className="mt-8 rounded-lg border border-border bg-muted/50 p-4">
        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          <UiText text="Review handoff" />
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {" "}
          <UiText text="Processed documents stay private and unpublished. Approve and publish them through the existing review queue." />{" "}
        </p>
        <Button asChild size="sm" className="mt-3">
          <Link href="/manage/review">
            <UiText text="Open review queue" />
          </Link>
        </Button>
      </div>

      <ActionDialog
        open={Boolean(skipping)}
        onOpenChange={(open) => !open && setSkipping(null)}
        title={t("Skip discovered candidate")}
        description={t(
          "The reason is recorded in the audit log. Discovery may surface it again later."
        )}
        confirmLabel={t("Skip candidate")}
        requireReason
        onConfirm={async (reason) => {
          if (!skipping) return
          try {
            await skipCandidate(skipping.id, reason)
            toast.success(t("Candidate skipped"))
            setSkipping(null)
            refreshAll()
          } catch (cause) {
            toast.error(
              cause instanceof AdminApiError
                ? t(cause.message)
                : t("Skip failed")
            )
          }
        }}
      />
    </div>
  )
}
