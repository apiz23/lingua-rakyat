"use client"

import { UiText, useTranslations } from "@/components/i18n"
import { useState } from "react"
import { LocalizedLink as Link } from "@/components/i18n"
import { useParams } from "next/navigation"
import { ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { ActionDialog } from "@/components/admin/action-dialog"
import { AdminPageHeader } from "@/components/admin/admin-shell"
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoading,
} from "@/components/admin/admin-state"
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

const ACTION_COPY: Record<
  Exclude<ActionKind, null>,
  {
    title: string
    label: string
    destructive?: boolean
    requireReason?: boolean
  }
> = {
  approve: { title: "Record document approval", label: "Approve" },
  reject: {
    title: "Reject document",
    label: "Reject",
    destructive: true,
    requireReason: true,
  },
  request_changes: {
    title: "Request changes",
    label: "Request changes",
    requireReason: true,
  },
  publish: {
    title: "Publish document",
    label: "Publish",
    destructive: false,
    requireReason: true,
  },
  suspend: {
    title: "Suspend publication",
    label: "Suspend",
    destructive: true,
    requireReason: true,
  },
  withdraw: {
    title: "Withdraw document",
    label: "Withdraw",
    destructive: true,
    requireReason: true,
  },
}

export default function AdminDocumentDetailPage() {
  const t = useTranslations()

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
        action === "approve" ||
        action === "reject" ||
        action === "request_changes"
          ? await reviewAdminDocument(id, action, reason)
          : action === "publish"
            ? await publishAdminDocument(id, reason)
            : action === "suspend"
              ? await suspendAdminDocument(id, reason)
              : await withdrawAdminDocument(id, reason)
      setData(updated)
      setAction(null)
      toast.success(t("Document updated"))
    } catch (cause) {
      toast.error(
        cause instanceof AdminApiError ? t(cause.message) : t("Action failed")
      )
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
        await reviewAdminRevision(
          id,
          revision.revision,
          kind,
          reason || undefined
        )
      }
      setRevisionAction(null)
      toast.success(t("Revision updated"))
      reload()
      processing.reload()
    } catch (cause) {
      toast.error(
        cause instanceof AdminApiError
          ? t(cause.message)
          : t("Revision action failed")
      )
    } finally {
      setRevisionBusy(false)
    }
  }

  const saveMetadata = async () => {
    setSaving(true)
    try {
      const updated = await updateAdminDocument(id, {
        name: name.trim(),
        agency: agency.trim() || undefined,
        expires_at: expiresAt || undefined,
        source_id: sourceId || null,
      })
      setData(updated)
      setEditing(false)
      toast.success(t("Metadata saved"))
    } catch (cause) {
      toast.error(
        cause instanceof AdminApiError ? t(cause.message) : t("Save failed")
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <AdminLoading label={t("Loading document…")} />
  if (error) return <AdminErrorState error={error} onRetry={reload} />
  if (!data) return null

  const canReview = ["draft", "review", "approved"].includes(
    data.publication_status
  )
  const canPublish = data.publication_status === "approved"
  const canSuspend = ["approved", "published"].includes(data.publication_status)
  const canWithdraw = ["approved", "published", "suspended"].includes(
    data.publication_status
  )

  return (
    <div>
      <Link
        href="/manage/documents"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" />{" "}
        <UiText text="Back to documents" />{" "}
      </Link>

      <AdminPageHeader
        kicker={t("Document / 03")}
        title={data.name}
        description={t("{value0} · stored file {value1}", {
          value0: data.id,
          value1: t(data.has_storage ? "present" : "missing"),
        })}
        actions={
          <span className="flex flex-wrap gap-2">
            {canReview ? (
              <>
                <Button onClick={() => setAction("approve")}>
                  {" "}
                  <UiText text="Approve" />{" "}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setAction("request_changes")}
                >
                  {" "}
                  <UiText text="Request changes" />{" "}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setAction("reject")}
                >
                  {" "}
                  <UiText text="Reject" />{" "}
                </Button>
              </>
            ) : null}
            {canPublish ? (
              <Button onClick={() => setAction("publish")}>
                {" "}
                <UiText text="Publish" />{" "}
              </Button>
            ) : null}
            {canSuspend ? (
              <Button
                variant="destructive"
                onClick={() => setAction("suspend")}
              >
                {" "}
                <UiText text="Suspend" />{" "}
              </Button>
            ) : null}
            {canWithdraw ? (
              <Button variant="outline" onClick={() => setAction("withdraw")}>
                {" "}
                <UiText text="Withdraw" />{" "}
              </Button>
            ) : null}
          </span>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="space-y-6 px-4">
            <h2 className="font-heading text-lg font-semibold">
              <UiText text="Document and processing" />
            </h2>
            <div className="flex flex-wrap gap-2">
              <StatusBadge
                value={data.status}
                label={t("processing: {value0}", { value0: t(data.status) })}
              />
              <StatusBadge value={data.publication_status} />
              <StatusBadge value={data.visibility_scope} />
            </div>

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">
                  <UiText text="Current revision" />
                </dt>
                <dd>{data.current_revision}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  <UiText text="Chunks" />
                </dt>
                <dd>{data.chunk_count}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  <UiText text="Size" />
                </dt>
                <dd>
                  {(data.size_bytes / 1024).toFixed(1)} <UiText text="KB" />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  <UiText text="Uploaded" />
                </dt>
                <dd>
                  {data.uploaded_at
                    ? new Date(data.uploaded_at).toLocaleString(t.locale)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  <UiText text="Approved" />
                </dt>
                <dd>
                  {data.approved_by ?? "—"}{" "}
                  {data.approved_at
                    ? `· ${new Date(data.approved_at).toLocaleString(t.locale)}`
                    : ""}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  <UiText text="Published" />
                </dt>
                <dd>
                  {data.published_at
                    ? new Date(data.published_at).toLocaleString(t.locale)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  <UiText text="Expires" />
                </dt>
                <dd>
                  {data.expires_at
                    ? new Date(data.expires_at).toLocaleString(t.locale)
                    : t("No expiry")}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  <UiText text="Agency" />
                </dt>
                <dd>{data.agency ?? "—"}</dd>
              </div>
            </dl>

            {data.status === "error" && data.error_message ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <p className="font-medium">
                  <UiText text="Processing failed" />
                </p>
                <p className="mt-1 break-words">{data.error_message}</p>
              </div>
            ) : null}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-heading text-lg font-semibold">
                  <UiText text="Metadata" />
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing((value) => !value)
                    setName(data.name)
                    setAgency(data.agency ?? "")
                    setExpiresAt(
                      data.expires_at ? data.expires_at.slice(0, 10) : ""
                    )
                    setSourceId(data.source_id ?? "")
                  }}
                >
                  {editing ? t("Cancel") : t("Edit")}
                </Button>
              </div>
              {editing ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    aria-label={t("Document name")}
                  />
                  <Input
                    value={agency}
                    onChange={(event) => setAgency(event.target.value)}
                    placeholder={t("Agency")}
                    aria-label={t("Agency")}
                  />
                  <select
                    className="neo-input h-9 rounded-md px-2 text-sm"
                    aria-label={t("Official source")}
                    value={sourceId}
                    onChange={(event) => setSourceId(event.target.value)}
                  >
                    <option value="">
                      <UiText text="No source" />
                    </option>
                    {(sources ?? []).map((source) => (
                      <option key={source.source_id} value={source.source_id}>
                        {source.source_id} · {t(source.verification_status)}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="date"
                    value={expiresAt}
                    onChange={(event) => setExpiresAt(event.target.value)}
                    aria-label={t("Expiry date")}
                  />
                  <Button
                    onClick={() => void saveMetadata()}
                    disabled={saving || !name.trim()}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}{" "}
                    <UiText text="Save metadata" />{" "}
                  </Button>
                </div>
              ) : null}
            </div>

            <div>
              <h2 className="font-heading text-lg font-semibold">
                <UiText text="Publication blockers" />
              </h2>
              {data.blockers && data.blockers.length > 0 ? (
                <ul className="mt-2 list-inside list-disc text-sm text-destructive">
                  {data.blockers.map((blocker) => (
                    <li key={blocker}>{t(blocker.replaceAll("_", " "))}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-primary">
                  <UiText text="No blocking requirements detected." />
                </p>
              )}
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card size="sm">
            <div className="px-4">
              <h2 className="font-heading text-base font-semibold">
                <UiText text="Official source" />
              </h2>
              {data.source ? (
                <dl className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">
                      <UiText text="ID" />
                    </dt>
                    <dd className="min-w-0 text-right break-words">
                      {data.source.source_id}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">
                      <UiText text="Organisation" />
                    </dt>
                    <dd className="text-right">
                      {data.source.issuing_organization}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">
                      <UiText text="Verification" />
                    </dt>
                    <dd>
                      <StatusBadge value={data.source.verification_status} />
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">
                      <UiText text="Usage permitted" />
                    </dt>
                    <dd>{data.source.usage_permitted ? t("Yes") : t("No")}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">
                      <UiText text="Freshness" />
                    </dt>
                    <dd>
                      {data.source.freshness_days ?? "—"} <UiText text="days" />
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  <UiText text="No source associated." />
                </p>
              )}
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href="/manage/sources">
                  <UiText text="Manage sources" />
                </Link>
              </Button>
            </div>
          </Card>

          <Card size="sm">
            <div className="px-4">
              <h2 className="font-heading text-base font-semibold">
                <UiText text="Revision history" />
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                <UiText text="Indexing makes a revision ready for review. Approval does not publish it; promotion changes the current revision." />
              </p>
              {data.revisions && data.revisions.length > 0 ? (
                <ul className="mt-2 space-y-3 text-sm">
                  {data.revisions.map((rev) => {
                    const isCurrent = rev.revision === data.current_revision
                    const approved = rev.review_status === "approved"
                    const indexed = rev.indexing_status === "indexed"
                    return (
                      <li
                        key={rev.revision}
                        className="border-b border-border/50 pb-3 last:border-0"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">
                            <UiText text="rev" /> {rev.revision}
                          </span>
                          {isCurrent ? (
                            <StatusBadge
                              value={
                                data.publication_status === "published"
                                  ? "published"
                                  : "draft"
                              }
                              label={
                                data.publication_status === "published"
                                  ? t("current published revision")
                                  : t("current revision (not published)")
                              }
                            />
                          ) : null}
                          <StatusBadge
                            value={rev.indexing_status ?? "pending"}
                            label={t("index: {value0}", {
                              value0: t(rev.indexing_status ?? "pending"),
                            })}
                          />
                          <StatusBadge value={rev.review_status ?? "pending"} />
                          {rev.revision > data.current_revision && !approved ? (
                            <StatusBadge
                              value="warning"
                              label={t("pending review")}
                            />
                          ) : null}
                        </div>
                        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                          {rev.chunk_count ?? 0} <UiText text="chunks ·" />{" "}
                          {rev.checksum
                            ? rev.checksum.slice(0, 12)
                            : t("no checksum")}{" "}
                          · {rev.approved_by ?? t("not approved")}
                        </p>
                        {rev.index_error ? (
                          <p className="mt-1 text-xs text-destructive">
                            {rev.index_error}
                          </p>
                        ) : null}
                        {rev.review_reason ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {rev.review_reason}
                          </p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {!isCurrent && indexed && !approved ? (
                            <>
                              <Button
                                size="xs"
                                onClick={() =>
                                  setRevisionAction({
                                    revision: rev,
                                    action: "approve",
                                  })
                                }
                              >
                                <UiText text="Approve revision" />
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() =>
                                  setRevisionAction({
                                    revision: rev,
                                    action: "request_changes",
                                  })
                                }
                              >
                                <UiText text="Request changes" />
                              </Button>
                              <Button
                                size="xs"
                                variant="destructive"
                                onClick={() =>
                                  setRevisionAction({
                                    revision: rev,
                                    action: "reject",
                                  })
                                }
                              >
                                <UiText text="Reject" />
                              </Button>
                            </>
                          ) : null}
                          {!isCurrent && approved ? (
                            rev.revision > data.current_revision ? (
                              <Button
                                size="xs"
                                onClick={() =>
                                  setRevisionAction({
                                    revision: rev,
                                    action: "promote",
                                  })
                                }
                              >
                                <UiText text="Promote" />
                              </Button>
                            ) : (
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() =>
                                  setRevisionAction({
                                    revision: rev,
                                    action: "rollback",
                                  })
                                }
                              >
                                <UiText text="Roll back" />
                              </Button>
                            )
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  <UiText text="No revisions recorded." />
                </p>
              )}
            </div>
          </Card>

          <Card size="sm">
            <div className="px-4">
              <h2 className="font-heading text-base font-semibold">
                <UiText text="Processing & indexing" />
              </h2>
              {processing.data ? (
                <>
                  <dl className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">
                        <UiText text="Extraction" />
                      </dt>
                      <dd>
                        <StatusBadge
                          value={processing.data.extraction_status ?? "pending"}
                        />
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">
                        <UiText text="Pages" />
                      </dt>
                      <dd className="tabular-nums">
                        {processing.data.page_count}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">
                        <UiText text="Chunks" />
                      </dt>
                      <dd className="tabular-nums">
                        {processing.data.chunk_count}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">
                        <UiText text="OCR" />
                      </dt>
                      <dd>
                        {processing.data.ocr_required
                          ? t("Required")
                          : t("Not required")}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">
                        <UiText text="Pending revisions" />
                      </dt>
                      <dd className="tabular-nums">
                        {
                          processing.data.revisions.filter(
                            (rev) => rev.requires_review && !rev.approved
                          ).length
                        }
                      </dd>
                    </div>
                  </dl>
                  {processing.data.error_message ? (
                    <p className="mt-2 text-xs text-destructive">
                      {processing.data.error_message}
                    </p>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    disabled={data.publication_status === "published"}
                    onClick={async () => {
                      try {
                        await reprocessAdminDocument(id)
                        toast.success(t("Reprocessing queued"))
                        processing.reload()
                      } catch (cause) {
                        toast.error(
                          cause instanceof AdminApiError
                            ? t(cause.message)
                            : t("Reprocess failed")
                        )
                      }
                    }}
                  >
                    {" "}
                    <UiText text="Reprocess document" />{" "}
                  </Button>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  <UiText text="Processing details unavailable." />
                </p>
              )}
            </div>
          </Card>

          <Card size="sm">
            <div className="px-4">
              <h2 className="font-heading text-base font-semibold">
                <UiText text="Publication events" />
              </h2>
              {data.events && data.events.length > 0 ? (
                <ul className="mt-2 space-y-2 text-sm">
                  {data.events.map((event, index) => (
                    <li
                      key={`${event.id ?? index}`}
                      className="border-b border-border/40 pb-1 last:border-0"
                    >
                      <div className="font-medium capitalize">
                        {event.event_type}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {event.actor} ·{" "}
                        {event.occurred_at
                          ? new Date(event.occurred_at).toLocaleString(t.locale)
                          : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <AdminEmptyState message={t("No publication events yet.")} />
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
          description={t(
            "This decision is recorded in the append-only audit log."
          )}
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
              ? t("Approve revision {value0}", {
                  value0: revisionAction.revision.revision,
                })
              : revisionAction.action === "promote"
                ? t("Promote revision {value0}", {
                    value0: revisionAction.revision.revision,
                  })
                : revisionAction.action === "rollback"
                  ? t("Roll back to revision {value0}", {
                      value0: revisionAction.revision.revision,
                    })
                  : revisionAction.action === "reject"
                    ? t("Reject revision {value0}", {
                        value0: revisionAction.revision.revision,
                      })
                    : t("Request changes to revision {value0}", {
                        value0: revisionAction.revision.revision,
                      })
          }
          description={
            revisionAction.action === "promote" ||
            revisionAction.action === "rollback"
              ? t(
                  "The current published revision remains authoritative until this succeeds. The switch is audited."
                )
              : t(
                  "The decision is attributed to your account and recorded in the audit log."
                )
          }
          confirmLabel={
            revisionAction.action === "rollback"
              ? t("Roll back")
              : revisionAction.action === "promote"
                ? t("Promote")
                : t("Record decision")
          }
          destructive={["reject", "rollback"].includes(revisionAction.action)}
          requireReason={["reject", "request_changes", "rollback"].includes(
            revisionAction.action
          )}
          busy={revisionBusy}
          onConfirm={runRevisionAction}
        />
      ) : null}
    </div>
  )
}
