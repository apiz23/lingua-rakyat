"use client"

import { UiText, useTranslations } from "@/components/i18n"
import { Suspense, useState } from "react"
import { LocalizedLink as Link } from "@/components/i18n"
import { useSearchParams } from "next/navigation"
import { Search } from "lucide-react"

import { AdminPageHeader } from "@/components/admin/admin-shell"
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoading,
} from "@/components/admin/admin-state"
import { StatusBadge } from "@/components/admin/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  listAdminDocuments,
  listAdminSources,
  type DocumentFilters,
} from "@/lib/admin-api"
import { useAdminResource } from "@/hooks/useAdminResource"

function DocumentsView() {
  const t = useTranslations()

  const params = useSearchParams()
  const [filters, setFilters] = useState<DocumentFilters>({
    q: "",
    processing_status: "",
    publication_status: params.get("publication_status") ?? "",
    visibility: "",
    source_id: params.get("source_id") ?? "",
    uploaded_from: "",
    uploaded_to: "",
    sort: "uploaded_at",
    order: "desc",
    page: 1,
    page_size: 20,
  })
  const { data, error, loading, reload } = useAdminResource(
    () => listAdminDocuments(filters),
    [filters]
  )
  const { data: sources } = useAdminResource(listAdminSources, [])

  const update = (patch: Partial<DocumentFilters>) =>
    setFilters((current) => ({ ...current, page: 1, ...patch }))

  return (
    <div>
      <AdminPageHeader
        kicker={t("Catalogue / 02")}
        title={t("Documents")}
        description={t(
          "Search the full catalogue. Processing, visibility and publication are separate states; nothing becomes public without an approved source and explicit publication."
        )}
        actions={
          <Button asChild>
            <Link href="/manage/ingestion">
              {" "}
              <UiText text="Open ingestion" />{" "}
            </Link>
          </Button>
        }
      />

      <div className="admin-filterbar items-end rounded-lg border border-border bg-card p-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="relative xl:col-span-2">
          <span className="mb-2 block text-xs font-medium">
            <UiText text="Search catalogue" />
          </span>
          <Search className="absolute bottom-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={t("Title, id, agency, source")}
            value={filters.q}
            onChange={(event) => update({ q: event.target.value })}
          />
        </label>
        <select
          className="neo-input h-9 rounded-md px-2 text-sm"
          aria-label={t("Processing status")}
          value={filters.processing_status}
          onChange={(event) =>
            update({ processing_status: event.target.value })
          }
        >
          <option value="">
            <UiText text="All processing states" />
          </option>
          <option value="ready">
            <UiText text="Ready" />
          </option>
          <option value="processing">
            <UiText text="Processing" />
          </option>
          <option value="error">
            <UiText text="Error" />
          </option>
        </select>
        <select
          className="neo-input h-9 rounded-md px-2 text-sm"
          aria-label={t("Publication status")}
          value={filters.publication_status}
          onChange={(event) =>
            update({ publication_status: event.target.value })
          }
        >
          <option value="">
            <UiText text="All publication states" />
          </option>
          {[
            "draft",
            "review",
            "approved",
            "published",
            "suspended",
            "expired",
            "archived",
          ].map((status) => (
            <option key={status} value={status}>
              {t(status)}
            </option>
          ))}
        </select>
        <select
          className="neo-input h-9 rounded-md px-2 text-sm"
          aria-label={t("Official source")}
          value={filters.source_id}
          onChange={(event) => update({ source_id: event.target.value })}
        >
          <option value="">
            <UiText text="All sources" />
          </option>
          {(sources ?? []).map((source) => (
            <option key={source.source_id} value={source.source_id}>
              {source.source_id} · {t(source.verification_status)}
            </option>
          ))}
        </select>
        <select
          className="neo-input h-9 rounded-md px-2 text-sm"
          aria-label={t("Visibility")}
          value={filters.visibility}
          onChange={(event) => update({ visibility: event.target.value })}
        >
          <option value="">
            <UiText text="All visibility" />
          </option>
          <option value="unclassified">
            <UiText text="Unclassified" />
          </option>
          <option value="private">
            <UiText text="Private" />
          </option>
          <option value="public">
            <UiText text="Public" />
          </option>
        </select>
        <label className="text-xs text-muted-foreground">
          {" "}
          <UiText text="Uploaded from" />{" "}
          <Input
            type="date"
            className="mt-1 h-9"
            value={filters.uploaded_from}
            onChange={(event) => update({ uploaded_from: event.target.value })}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          {" "}
          <UiText text="Uploaded to" />{" "}
          <Input
            type="date"
            className="mt-1 h-9"
            value={filters.uploaded_to}
            onChange={(event) => update({ uploaded_to: event.target.value })}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          {" "}
          <UiText text="Sort" />{" "}
          <select
            className="neo-input mt-1 h-9 w-full rounded-md px-2 text-sm"
            value={`${filters.sort}:${filters.order}`}
            onChange={(event) => {
              const [sort, order] = event.target.value.split(":")
              update({ sort, order })
            }}
          >
            <option value="uploaded_at:desc">
              <UiText text="Newest first" />
            </option>
            <option value="uploaded_at:asc">
              <UiText text="Oldest first" />
            </option>
            <option value="name:asc">
              <UiText text="Name A–Z" />
            </option>
            <option value="name:desc">
              <UiText text="Name Z–A" />
            </option>
            <option value="publication_status:asc">
              <UiText text="Publication status" />
            </option>
            <option value="status:asc">
              <UiText text="Processing status" />
            </option>
          </select>
        </label>
        <div className="flex items-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setFilters({
                q: "",
                processing_status: "",
                publication_status: "",
                visibility: "",
                source_id: "",
                uploaded_from: "",
                uploaded_to: "",
                sort: "uploaded_at",
                order: "desc",
                page: 1,
                page_size: 20,
              })
            }
          >
            {" "}
            <UiText text="Clear filters" />{" "}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="pt-4">
          <AdminLoading label={t("Reading catalogue…")} />
        </div>
      ) : null}
      {error ? (
        <div className="pt-4">
          <AdminErrorState error={error} onRetry={reload} />
        </div>
      ) : null}

      {data ? (
        data.items.length === 0 ? (
          <div className="pt-4">
            <AdminEmptyState
              message={t("No documents match these filters.")}
              hint={t(
                "Clear the search or upload a document from the Ingestion page."
              )}
            />
          </div>
        ) : (
          <div className="admin-surface overflow-x-auto pt-2">
            <table className="admin-table min-w-[820px]">
              <caption className="sr-only">
                <UiText text="Document catalogue: processing and publication are independent states." />
              </caption>
              <thead>
                <tr>
                  <th className="w-8">#</th>
                  <th scope="col">
                    <UiText text="Document" />
                  </th>
                  <th scope="col">
                    <UiText text="Processing" />
                  </th>
                  <th scope="col">
                    <UiText text="Publication" />
                  </th>
                  <th scope="col">
                    <UiText text="Source" />
                  </th>
                  <th className="text-right">
                    <UiText text="Rev" />
                  </th>
                  <th scope="col">
                    <UiText text="Uploaded" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((doc, index) => (
                  <tr key={doc.id}>
                    <td className="admin-index">
                      {String(
                        (data.page - 1) * data.page_size + index + 1
                      ).padStart(2, "0")}
                    </td>
                    <td>
                      <Link
                        href={`/manage/documents/${encodeURIComponent(doc.id)}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {doc.name}
                      </Link>
                      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {doc.id}
                      </div>
                    </td>
                    <td>
                      <StatusBadge value={doc.status} />
                    </td>
                    <td>
                      <StatusBadge value={doc.publication_status} />
                    </td>
                    <td className="text-xs">{doc.source_id ?? "—"}</td>
                    <td className="text-right tabular-nums">
                      {doc.current_revision}
                    </td>
                    <td className="text-xs whitespace-nowrap text-muted-foreground">
                      {doc.uploaded_at
                        ? new Date(doc.uploaded_at).toLocaleDateString(t.locale)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex items-center justify-between border-t border-border py-3 text-sm">
              <span className="admin-kicker">
                {data.total} {t(data.total === 1 ? "document" : "documents")}{" "}
                <UiText text="· page" /> {data.page}
              </span>
              <span className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page <= 1}
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      page: (current.page ?? 1) - 1,
                    }))
                  }
                >
                  {" "}
                  <UiText text="Previous" />{" "}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page * data.page_size >= data.total}
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      page: (current.page ?? 1) + 1,
                    }))
                  }
                >
                  {" "}
                  <UiText text="Next" />{" "}
                </Button>
              </span>
            </div>
          </div>
        )
      ) : null}
    </div>
  )
}

export default function AdminDocumentsPage() {
  const t = useTranslations()

  return (
    <Suspense fallback={<AdminLoading label={t("Loading documents…")} />}>
      <DocumentsView />
    </Suspense>
  )
}
