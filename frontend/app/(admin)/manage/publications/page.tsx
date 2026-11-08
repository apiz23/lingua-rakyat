"use client"

import { UiText, useTranslations } from "@/components/i18n"
import { Suspense, useState } from "react"
import { LocalizedLink as Link } from "@/components/i18n"
import { useSearchParams } from "next/navigation"

import { AdminPageHeader } from "@/components/admin/admin-shell"
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoading,
} from "@/components/admin/admin-state"
import { StatusBadge } from "@/components/admin/status-badge"
import { Button } from "@/components/ui/button"
import { listAdminDocuments } from "@/lib/admin-api"
import { useAdminResource } from "@/hooks/useAdminResource"

const FILTERS = [
  "published",
  "approved",
  "suspended",
  "expired",
  "archived",
] as const

export default function AdminPublicationsPage() {
  const t = useTranslations()

  return (
    <Suspense
      fallback={<AdminLoading label={t("Loading publication filters?")} />}
    >
      <PublicationsView />
    </Suspense>
  )
}

function PublicationsView() {
  const t = useTranslations()

  const params = useSearchParams()
  const initialStatus = params.get("publication_status")
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<(typeof FILTERS)[number]>(
    FILTERS.find((value) => value === initialStatus) ?? "published"
  )
  const { data, error, loading, reload } = useAdminResource(
    () =>
      listAdminDocuments({ publication_status: status, page, page_size: 20 }),
    [status, page]
  )

  return (
    <div>
      <AdminPageHeader
        kicker={t("Lifecycle / 06")}
        title={t("Publications")}
        description={t(
          "Approval and publication are separate decisions. Browse published, approved, suspended, expired and withdrawn documents. Suspension and withdrawal take effect on the next eligibility check."
        )}
      />

      <div className="mb-3 flex flex-wrap gap-1 border-b border-border pb-3">
        {FILTERS.map((value, index) => (
          <Button
            key={value}
            size="sm"
            variant={status === value ? "default" : "ghost"}
            aria-pressed={status === value}
            onClick={() => {
              setStatus(value)
              setPage(1)
            }}
          >
            <span className="admin-index mr-1">
              {String(index + 1).padStart(2, "0")}
            </span>
            {t(value)}
          </Button>
        ))}
      </div>

      {loading ? <AdminLoading label={t("Loading publications…")} /> : null}
      {error ? <AdminErrorState error={error} onRetry={reload} /> : null}

      {data ? (
        data.items.length === 0 ? (
          <AdminEmptyState
            message={t("No {value0} documents.", { value0: t(status) })}
          />
        ) : (
          <div>
            {data.items.map((doc, index) => (
              <article key={doc.id} className="admin-record">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="admin-index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <Link
                        href={`/manage/documents/${encodeURIComponent(doc.id)}`}
                        className="font-heading text-lg font-semibold tracking-tight text-primary hover:underline"
                      >
                        {doc.name}
                      </Link>
                      <StatusBadge value={doc.publication_status} />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
                      <span>
                        <UiText text="rev" /> {doc.current_revision}
                      </span>
                      <span>
                        <UiText text="source" /> {doc.source_id ?? t("none")}
                      </span>
                      {doc.expires_at ? (
                        <span>
                          <UiText text="expires" />{" "}
                          {new Date(doc.expires_at).toLocaleDateString(
                            t.locale
                          )}
                        </span>
                      ) : (
                        <span>
                          <UiText text="no expiry" />
                        </span>
                      )}
                      {doc.published_at ? (
                        <span>
                          <UiText text="published" />{" "}
                          {new Date(doc.published_at).toLocaleDateString(
                            t.locale
                          )}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={`/manage/documents/${encodeURIComponent(doc.id)}`}
                    >
                      <UiText text="Inspect" />
                    </Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )
      ) : null}
      {data && data.total > data.page_size ? (
        <nav
          aria-label={t("Publication pages")}
          className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"
        >
          <p className="text-sm text-muted-foreground">
            {data.total} <UiText text="documents ? page" /> {data.page}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((value) => value - 1)}
            >
              <UiText text="Previous" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page * data.page_size >= data.total || loading}
              onClick={() => setPage((value) => value + 1)}
            >
              <UiText text="Next" />
            </Button>
          </div>
        </nav>
      ) : null}
    </div>
  )
}
