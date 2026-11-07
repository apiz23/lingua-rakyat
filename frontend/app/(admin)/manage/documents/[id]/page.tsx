"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { ActionDialog } from "@/components/admin/action-dialog"
import { AdminPageHeader } from "@/components/admin/admin-shell"
import { AdminEmptyState, AdminErrorState, AdminLoading } from "@/components/admin/admin-state"
import { StatusBadge } from "@/components/admin/status-badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  AdminApiError,
  getAdminDocument,
  getDocumentProcessing,
  listAdminSources,
  promoteAdminRevision,
  publishAdminDocument,
  reprocessAdminDocument,
  reviewAdminRevision,
  rollbackAdminRevision,
  reviewAdminDocument,
  suspendAdminDocument,
  updateAdminDocument,
  withdrawAdminDocument,
  type AdminRevision,
} from "@/lib/admin-api"
import { useAdminResource } from "@/hooks/useAdminResource"

type ActionKind =
  | "approve"
  | "reject"
  | "request_changes"
  | "publish"
  | "suspend"
  | "withdraw"
  | null

const ACTION_COPY: Record<Exclude<ActionKind, null>, { title: string; label: string; destructive?: boolean; requireReason?: boolean }> = {
  approve: { title: "Approve for publication", label: "Approve" },
  reject: { title: "Reject document", label: "Reject", destructive: true, requireReason: true },
  request_changes: {
    title: "Request changes",
    label: "Request changes",
    requireReason: true,
  },
  publish: { title: "Publish document", label: "Publish", destructive: false, requireReason: true },
  suspend: { title: "Suspend publication", label: "Suspend", destructive: true, requireReason: true },
  withdraw: { title: "Withdraw document", label: "Withdraw", destructive: true, requireReason: true },
}

export default function AdminDocumentDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const { data, error, loading, reload, setData } = useAdminResource(
    () => getAdminDocument(id),
    [id]
  )
  const [action, setAction] = useState<ActionKind>(null)
  const [revisionAction, setRevisionAction] = useState<{
    revision: AdminRevision
    action: "approve" | "reject" | "request_changes" | "promote" | "rollback"
  } | null>(null)
  const [revisionBusy, setRevisionBusy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState("")
  const [agency, setAgency] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [sourceId, setSourceId] = useState("")
  const [saving, setSaving] = useState(false)
  const { data: sources } = useAdminResource(listAdminSources, [])
  const processing = useAdminResource(() => getDocumentProcessing(id), [id])

  const runAction = async (reason: string) => {
    if (!action) return
    setBusy(true)
    try {
      const updated =
        action === "approve" || action === "reject" || action === "request_changes"
          ? await reviewAdminDocument(id, action, reason)
          : action === "publish"
            ? await publishAdminDocument(id, reason)
            : action === "suspend"
              ? await suspendAdminDocument(id, reason)
              : await withdrawAdminDocument(id, reason)
      setData(updated)
      setAction(null)
      toast.success("Document updated")
    } catch (cause) {
      toast.error(cause instanceof AdminApiError ? cause.message : "Action failed")
    } finally {
      setBusy(false)
    }
  }

  const runRevisionAction = async (reason: string) => {
    if (!revisionAction) return
    setRevisionBusy(true)
    try {
      const { revision, action: kind } = revisionAction
      if (kind === "promote") {
        await promoteAdminRevision(id, revision.revision, reason || undefined)
      } else if (kind === "rollback") {
        await rollbackAdminRevision(id, revision.revision, reason)
      } else {
        await reviewAdminRevision(id, revision.revision, kind, reason || undefined)
      }
      setRevisionAction(null)
      toast.success("Revision updated")
      reload()
      processing.reload()
    } catch (cause) {
      toast.error(cause instanceof AdminApiError ? cause.message : "Revision action failed")
    } finally {
      setRevisionBusy(false)
    }
  }

  const saveMetadata = async () => {    setSaving(true)
    try {
      const updated = await updateAdminDocument(id, {
        name: name.trim(),
        agency: agency.trim() || undefined,
        expires_at: expiresAt || undefined,
        source_id: sourceId || null,
      })
      setData(updated)
      setEditing(false)
      toast.success("Metadata saved")
    } catch (cause) {
      toast.error(cause instanceof AdminApiError ? cause.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <AdminLoading label="Loading document…" />
  if (error) return <AdminErrorState error={error} onRetry={reload} />
  if (!data) return null

  const canReview = ["draft", "review", "approved"].includes(data.publication_status)
  const canPublish = data.publication_status === "approved"
  const canSuspend = ["approved", "published"].includes(data.publication_status)
  const canWithdraw = ["approved", "published", "suspended"].includes(data.publication_status)

  return (
    <div>
      <Link href="/manage/documents" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to documents
      </Link>

      <AdminPageHeader
        kicker="Document / 03"
        title={data.name}
        description={`${data.id} · stored file ${data.has_storage ? "present" : "missing"}`}
        actions={
          <span className="flex flex-wrap gap-2">
            {canReview ? (
              <>
                <Button onClick={() => setAction("approve")}>Approve</Button>
                <Button variant="outline" onClick={() => setAction("request_changes")}>
                  Request changes
                </Button>
                <Button variant="destructive" onClick={() => setAction("reject")}>
                  Reject
                </Button>
              </>
            ) : null}
            {canPublish ? (
              <Button onClick={() => setAction("publish")}>Publish</Button>
            ) : null}
            {canSuspend ? (
              <Button variant="destructive" onClick={() => setAction("suspend")}>
                Suspend
              </Button>
            ) : null}
            {canWithdraw ? (
              <Button variant="outline" onClick={() => setAction("withdraw")}>
                Withdraw
              </Button>
            ) : null}
          </span>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="space-y-6 px-4">
<h2 className="font-heading text-lg font-semibold">Document and processing</h2>
            <div className="flex flex-wrap gap-2">
              <StatusBadge value={data.status} label={`processing: ${data.status}`} />
              <StatusBadge value={data.publication_status} />
              <StatusBadge value={data.visibility_scope} />
            </div>

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">Current revision</dt><dd>{data.current_revision}</dd></div>
              <div><dt className="text-muted-foreground">Chunks</dt><dd>{data.chunk_count}</dd></div>
              <div><dt className="text-muted-foreground">Size</dt><dd>{(data.size_bytes / 1024).toFixed(1)} KB</dd></div>
              <div><dt className="text-muted-foreground">Uploaded</dt><dd>{data.uploaded_at ? new Date(data.uploaded_at).toLocaleString() : "—"}</dd></div>
              <div><dt className="text-muted-foreground">Approved</dt><dd>{data.approved_by ?? "—"} {data.approved_at ? `· ${new Date(data.approved_at).toLocaleString()}` : ""}</dd></div>
              <div><dt className="text-muted-foreground">Published</dt><dd>{data.published_at ? new Date(data.published_at).toLocaleString() : "—"}</dd></div>
              <div><dt className="text-muted-foreground">Expires</dt><dd>{data.expires_at ? new Date(data.expires_at).toLocaleString() : "No expiry"}</dd></div>
              <div><dt className="text-muted-foreground">Agency</dt><dd>{data.agency ?? "—"}</dd></div>
            </dl>

            {data.status === "error" && data.error_message ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <p className="font-medium">Processing failed</p>
                <p className="mt-1 break-words">{data.error_message}</p>
              </div>
            ) : null}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-heading text-lg font-semibold">Metadata</h2>
                <Button variant="outline" size="sm" onClick={() => {
                  setEditing((value) => !value)
                  setName(data.name)
                  setAgency(data.agency ?? "")
                  setExpiresAt(data.expires_at ? data.expires_at.slice(0, 10) : "")
                  setSourceId(data.source_id ?? "")
                }}>
                  {editing ? "Cancel" : "Edit"}
                </Button>
              </div>
              {editing ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input value={name} onChange={(event) => setName(event.target.value)} aria-label="Document name" />
                  <Input value={agency} onChange={(event) => setAgency(event.target.value)} placeholder="Agency" aria-label="Agency" />
                  <select
                    className="neo-input h-9 rounded-md px-2 text-sm"
                    aria-label="Official source"
                    value={sourceId}
                    onChange={(event) => setSourceId(event.target.value)}
                  >
                    <option value="">No source</option>
                    {(sources ?? []).map((source) => (
                      <option key={source.source_id} value={source.source_id}>
                        {source.source_id} · {source.verification_status}
                      </option>
                    ))}
                  </select>
                  <Input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} aria-label="Expiry date" />
                  <Button onClick={() => void saveMetadata()} disabled={saving || !name.trim()}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save metadata
                  </Button>
                </div>
              ) : null}
            </div>

            <div>
              <h2 className="font-heading text-lg font-semibold">Publication blockers</h2>
              {data.blockers && data.blockers.length > 0 ? (
                <ul className="mt-2 list-inside list-disc text-sm text-destructive">
                  {data.blockers.map((blocker) => <li key={blocker}>{blocker.replaceAll("_", " ")}</li>)}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-primary">No blocking requirements detected.</p>
              )}
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card size="sm">
            <div className="px-4">
              <h2 className="font-heading text-base font-semibold">Official source</h2>
              {data.source ? (
                <dl className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between gap-2"><dt className="text-muted-foreground">ID</dt><dd className="text-right">{data.source.source_id}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Organisation</dt><dd className="text-right">{data.source.issuing_organization}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Verification</dt><dd><StatusBadge value={data.source.verification_status} /></dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Usage permitted</dt><dd>{data.source.usage_permitted ? "Yes" : "No"}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Freshness</dt><dd>{data.source.freshness_days ?? "—"} days</dd></div>
                </dl>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No source associated.</p>
              )}
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href="/manage/sources">Manage sources</Link>
              </Button>
            </div>
          </Card>

          <Card size="sm">
            <div className="px-4">
              <h2 className="font-heading text-base font-semibold">Revisions</h2>
              {data.revisions && data.revisions.length > 0 ? (
                <ul className="mt-2 space-y-3 text-sm">
                  {data.revisions.map((rev) => {
                    const isCurrent = rev.revision === data.current_revision
                    const approved = rev.review_status === "approved"
                    const indexed = rev.indexing_status === "indexed"
                    return (
                      <li key={rev.revision} className="border-b border-border/50 pb-3 last:border-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">rev {rev.revision}</span>
                          {isCurrent ? <StatusBadge value="published" label="current" /> : null}
                          <StatusBadge value={rev.indexing_status ?? "pending"} label={`index: ${rev.indexing_status ?? "pending"}`} />
                          <StatusBadge value={rev.review_status ?? "pending"} />
                          {rev.revision > data.current_revision && !approved ? (
                            <StatusBadge value="warning" label="pending review" />
                          ) : null}
                        </div>
                        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                          {rev.chunk_count ?? 0} chunks · {rev.checksum ? rev.checksum.slice(0, 12) : "no checksum"} ·{" "}
                          {rev.approved_by ?? "not approved"}
                        </p>
                        {rev.index_error ? <p className="mt-1 text-xs text-destructive">{rev.index_error}</p> : null}
                        {rev.review_reason ? <p className="mt-1 text-xs text-muted-foreground">{rev.review_reason}</p> : null}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {!isCurrent && indexed && !approved ? (
                            <>
                              <Button size="xs" onClick={() => setRevisionAction({ revision: rev, action: "approve" })}>Approve revision</Button>
                              <Button size="xs" variant="outline" onClick={() => setRevisionAction({ revision: rev, action: "request_changes" })}>Request changes</Button>
                              <Button size="xs" variant="destructive" onClick={() => setRevisionAction({ revision: rev, action: "reject" })}>Reject</Button>
                            </>
                          ) : null}
                          {!isCurrent && approved ? (
                            rev.revision > data.current_revision ? (
                              <Button size="xs" onClick={() => setRevisionAction({ revision: rev, action: "promote" })}>Promote</Button>
                            ) : (
                              <Button size="xs" variant="outline" onClick={() => setRevisionAction({ revision: rev, action: "rollback" })}>Roll back</Button>
                            )
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No revisions recorded.</p>
              )}
            </div>
          </Card>

          <Card size="sm">
            <div className="px-4">
              <h2 className="font-heading text-base font-semibold">Processing &amp; indexing</h2>
              {processing.data ? (
                <>
                  <dl className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Extraction</dt><dd><StatusBadge value={processing.data.extraction_status ?? "pending"} /></dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Pages</dt><dd className="tabular-nums">{processing.data.page_count}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Chunks</dt><dd className="tabular-nums">{processing.data.chunk_count}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">OCR</dt><dd>{processing.data.ocr_required ? "Required" : "Not required"}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Pending revisions</dt><dd className="tabular-nums">{processing.data.revisions.filter((rev) => rev.requires_review && !rev.approved).length}</dd></div>
                  </dl>
                  {processing.data.error_message ? (
                    <p className="mt-2 text-xs text-destructive">{processing.data.error_message}</p>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    disabled={data.publication_status === "published"}
                    onClick={async () => {
                      try {
                        await reprocessAdminDocument(id)
                        toast.success("Reprocessing queued")
                        processing.reload()
                      } catch (cause) {
                        toast.error(cause instanceof AdminApiError ? cause.message : "Reprocess failed")
                      }
                    }}
                  >
                    Reprocess document
                  </Button>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Processing details unavailable.</p>
              )}
            </div>
          </Card>

          <Card size="sm">
            <div className="px-4">
              <h2 className="font-heading text-base font-semibold">Publication events</h2>
              {data.events && data.events.length > 0 ? (
                <ul className="mt-2 space-y-2 text-sm">
                  {data.events.map((event, index) => (
                    <li key={`${event.id ?? index}`} className="border-b border-border/40 pb-1 last:border-0">
                      <div className="font-medium capitalize">{event.event_type}</div>
                      <div className="text-xs text-muted-foreground">
                        {event.actor} · {event.occurred_at ? new Date(event.occurred_at).toLocaleString() : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <AdminEmptyState message="No publication events yet." />
              )}
            </div>
          </Card>
        </div>
      </div>

      {action ? (
        <ActionDialog
          open={Boolean(action)}
          onOpenChange={(open) => !open && setAction(null)}
          title={ACTION_COPY[action].title}
          description="This decision is recorded in the append-only audit log."
          confirmLabel={ACTION_COPY[action].label}
          destructive={ACTION_COPY[action].destructive}
          requireReason={ACTION_COPY[action].requireReason}
          busy={busy}
          onConfirm={runAction}
        />
      ) : null}
      {revisionAction ? (
        <ActionDialog
          open
          onOpenChange={(open) => !open && setRevisionAction(null)}
          title={
            revisionAction.action === "approve"
              ? `Approve revision ${revisionAction.revision.revision}`
              : revisionAction.action === "promote"
                ? `Promote revision ${revisionAction.revision.revision}`
                : revisionAction.action === "rollback"
                  ? `Roll back to revision ${revisionAction.revision.revision}`
                  : revisionAction.action === "reject"
                    ? `Reject revision ${revisionAction.revision.revision}`
                    : `Request changes to revision ${revisionAction.revision.revision}`
          }
          description={
            revisionAction.action === "promote" || revisionAction.action === "rollback"
              ? "The current published revision remains authoritative until this succeeds. The switch is audited."
              : "The decision is attributed to your account and recorded in the audit log."
          }
          confirmLabel={
            revisionAction.action === "rollback"
              ? "Roll back"
              : revisionAction.action === "promote"
                ? "Promote"
                : "Record decision"
          }
          destructive={["reject", "rollback"].includes(revisionAction.action)}
          requireReason={["reject", "request_changes", "rollback"].includes(revisionAction.action)}
          busy={revisionBusy}
          onConfirm={runRevisionAction}
        />
      ) : null}
    </div>
  )
}
