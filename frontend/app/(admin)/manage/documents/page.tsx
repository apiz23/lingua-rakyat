"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Search } from "lucide-react"

import { AdminPageHeader } from "@/components/admin/admin-shell"
import { AdminEmptyState, AdminErrorState, AdminLoading } from "@/components/admin/admin-state"
import { StatusBadge } from "@/components/admin/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { listAdminDocuments, listAdminSources, type DocumentFilters } from "@/lib/admin-api"
import { useAdminResource } from "@/hooks/useAdminResource"

function DocumentsView() {
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
        kicker="Catalogue / 02"
        title="Documents"
        description="Search the full catalogue. Processing, visibility and publication are separate states; nothing becomes public without an approved source and explicit publication."
        actions={
          <Button asChild>
            <Link href="/manage/ingestion">Open ingestion</Link>
          </Button>
        }
      />

      <div className="admin-filterbar items-end rounded-lg border border-border bg-card p-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="relative xl:col-span-2">
          <span className="mb-2 block text-xs font-medium">Search catalogue</span>
          <Search className="absolute left-2.5 bottom-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Title, id, agency, source"
            value={filters.q}
            onChange={(event) => update({ q: event.target.value })}
          />
        </label>
        <select
          className="neo-input h-9 rounded-md px-2 text-sm"
          aria-label="Processing status"
          value={filters.processing_status}
          onChange={(event) => update({ processing_status: event.target.value })}
        >
          <option value="">All processing states</option>
          <option value="ready">Ready</option>
          <option value="processing">Processing</option>
          <option value="error">Error</option>
        </select>
        <select
          className="neo-input h-9 rounded-md px-2 text-sm"
          aria-label="Publication status"
          value={filters.publication_status}
          onChange={(event) => update({ publication_status: event.target.value })}
        >
          <option value="">All publication states</option>
          {["draft", "review", "approved", "published", "suspended", "expired", "archived"].map(
            (status) => (
              <option key={status} value={status}>
                {status}
              </option>
            )
          )}
        </select>
        <select
          className="neo-input h-9 rounded-md px-2 text-sm"
          aria-label="Official source"
          value={filters.source_id}
          onChange={(event) => update({ source_id: event.target.value })}
        >
          <option value="">All sources</option>
          {(sources ?? []).map((source) => (
            <option key={source.source_id} value={source.source_id}>
              {source.source_id} · {source.verification_status}
            </option>
          ))}
        </select>
        <select
          className="neo-input h-9 rounded-md px-2 text-sm"
          aria-label="Visibility"
          value={filters.visibility}
          onChange={(event) => update({ visibility: event.target.value })}
        >
          <option value="">All visibility</option>
          <option value="unclassified">Unclassified</option>
          <option value="private">Private</option>
          <option value="public">Public</option>
        </select>
        <label className="text-xs text-muted-foreground">
          Uploaded from
          <Input
            type="date"
            className="mt-1 h-9"
            value={filters.uploaded_from}
            onChange={(event) => update({ uploaded_from: event.target.value })}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Uploaded to
          <Input
            type="date"
            className="mt-1 h-9"
            value={filters.uploaded_to}
            onChange={(event) => update({ uploaded_to: event.target.value })}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Sort
          <select
            className="neo-input mt-1 h-9 w-full rounded-md px-2 text-sm"
            value={`${filters.sort}:${filters.order}`}
            onChange={(event) => {
              const [sort, order] = event.target.value.split(":")
              update({ sort, order })
            }}
          >
            <option value="uploaded_at:desc">Newest first</option>
            <option value="uploaded_at:asc">Oldest first</option>
            <option value="name:asc">Name A–Z</option>
            <option value="name:desc">Name Z–A</option>
            <option value="publication_status:asc">Publication status</option>
            <option value="status:asc">Processing status</option>
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
            Clear filters
          </Button>
        </div>
      </div>

      {loading ? <div className="pt-4"><AdminLoading label="Reading catalogue…" /></div> : null}
      {error ? <div className="pt-4"><AdminErrorState error={error} onRetry={reload} /></div> : null}

      {data ? (
        data.items.length === 0 ? (
          <div className="pt-4">
            <AdminEmptyState
              message="No documents match these filters."
              hint="Clear the search or upload a document from the Ingestion page."
            />
          </div>
        ) : (
          <div className="admin-surface overflow-x-auto pt-2">
            <table className="admin-table min-w-[820px]">
<caption className="sr-only">Document catalogue: processing and publication are independent states.</caption>
              <thead>
                <tr>
                  <th className="w-8">#</th>
                  <th scope="col">Document</th>
                  <th scope="col">Processing</th>
                  <th scope="col">Publication</th>
                  <th scope="col">Source</th>
                  <th className="text-right">Rev</th>
                  <th scope="col">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((doc, index) => (
                  <tr key={doc.id}>
                    <td className="admin-index">
                      {String((data.page - 1) * data.page_size + index + 1).padStart(2, "0")}
                    </td>
                    <td>
                      <Link
                        href={`/manage/documents/${encodeURIComponent(doc.id)}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {doc.name}
                      </Link>
                      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{doc.id}</div>
                    </td>
                    <td><StatusBadge value={doc.status} /></td>
                    <td><StatusBadge value={doc.publication_status} /></td>
                    <td className="text-xs">{doc.source_id ?? "—"}</td>
                    <td className="text-right tabular-nums">{doc.current_revision}</td>
                    <td className="whitespace-nowrap text-xs text-muted-foreground">
                      {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex items-center justify-between border-t border-border py-3 text-sm">
              <span className="admin-kicker">
                {data.total} document{data.total === 1 ? "" : "s"} · page {data.page}
              </span>
              <span className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page <= 1}
                  onClick={() => setFilters((current) => ({ ...current, page: (current.page ?? 1) - 1 }))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page * data.page_size >= data.total}
                  onClick={() => setFilters((current) => ({ ...current, page: (current.page ?? 1) + 1 }))}
                >
                  Next
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
  return (
    <Suspense fallback={<AdminLoading label="Loading documents…" />}>
      <DocumentsView />
    </Suspense>
  )
}
