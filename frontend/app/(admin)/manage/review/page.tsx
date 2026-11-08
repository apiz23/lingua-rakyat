"use client"

import { UiText, useTranslations } from "@/components/i18n"
import { useState } from "react"
import { LocalizedLink as Link } from "@/components/i18n"
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
import {
  AdminApiError,
  getReviewQueue,
  reviewAdminDocument,
  type AdminDocument,
} from "@/lib/admin-api"
import { useAdminResource } from "@/hooks/useAdminResource"

type Decision = {
  doc: AdminDocument
  action: "approve" | "reject" | "request_changes"
}

export default function AdminReviewPage() {
  const t = useTranslations()

  const { data, error, loading, reload } = useAdminResource(getReviewQueue, [])
  const [decision, setDecision] = useState<Decision | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (reason: string) => {
    if (!decision) return
    setBusy(true)
    try {
      await reviewAdminDocument(decision.doc.id, decision.action, reason)
      toast.success(t("Review decision recorded"))
      setDecision(null)
      reload()
    } catch (cause) {
      toast.error(
        cause instanceof AdminApiError ? t(cause.message) : t("Review failed")
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <AdminPageHeader
        kicker={t("Review / 05")}
        title={t("Review queue")}
        description={t(
          "Documents awaiting a recorded decision. Approval records the actor, timestamp and source, but never publishes automatically."
        )}
      />

      {loading ? <AdminLoading label={t("Loading review queue…")} /> : null}
      {error ? <AdminErrorState error={error} onRetry={reload} /> : null}

      {data ? (
        data.length === 0 ? (
          <AdminEmptyState
            message={t("Nothing is waiting for review.")}
            hint={t("Approved documents appear under Publications.")}
          />
        ) : (
          <div>
            {data.map((doc, index) => (
              <article key={doc.id} className="admin-record">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="admin-index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <Link
                        href={`/manage/documents/${encodeURIComponent(doc.id)}`}
                        className="font-heading text-lg font-semibold tracking-tight text-primary hover:underline"
                      >
                        {doc.name}
                      </Link>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <StatusBadge
                        value={doc.status}
                        label={t("processing: {value0}", {
                          value0: t(doc.status),
                        })}
                      />
                      <StatusBadge value={doc.publication_status} />
                      <span className="admin-stamp">
                        <UiText text="source" /> {doc.source_id ?? t("none")}
                      </span>
                    </div>
                    {doc.blockers && doc.blockers.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {doc.blockers.map((blocker) => (
                          <span
                            key={blocker}
                            className="border border-destructive/40 bg-destructive/5 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-destructive uppercase"
                          >
                            {t(blocker.replaceAll("_", " "))}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs font-medium text-primary">
                        <UiText text="No additional blockers reported. Approval and publication are separate steps." />
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => setDecision({ doc, action: "approve" })}
                      disabled={(doc.blockers ?? []).some(
                        (blocker) =>
                          ![
                            "missing_approval",
                            "missing_current_revision",
                          ].includes(blocker)
                      )}
                    >
                      {" "}
                      <UiText text="Approve" />{" "}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setDecision({ doc, action: "request_changes" })
                      }
                    >
                      {" "}
                      <UiText text="Request changes" />{" "}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setDecision({ doc, action: "reject" })}
                    >
                      {" "}
                      <UiText text="Reject" />{" "}
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )
      ) : null}

      {decision ? (
        <ActionDialog
          open
          onOpenChange={(open) => !open && setDecision(null)}
          title={
            decision.action === "approve"
              ? t("Record document approval")
              : decision.action === "reject"
                ? t("Reject document")
                : t("Request changes")
          }
          description={t(
            "This records a review decision only. It does not publish the document. The decision, actor and reason are recorded in the audit log."
          )}
          confirmLabel={
            decision.action === "approve" ? t("Approve") : t("Record decision")
          }
          destructive={decision.action === "reject"}
          requireReason={decision.action !== "approve"}
          busy={busy}
          onConfirm={submit}
        />
      ) : null}
    </div>
  )
}
