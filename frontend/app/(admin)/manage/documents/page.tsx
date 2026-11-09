"use client"

import { UiText, useTranslations } from "@/components/i18n"
import {
  Suspense,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react"
import { LocalizedLink as Link } from "@/components/i18n"
import { useSearchParams } from "next/navigation"
import { FileUp, Search } from "lucide-react"

import { AdminPageHeader } from "@/components/admin/admin-shell"
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoading,
} from "@/components/admin/admin-state"
import { StatusBadge } from "@/components/admin/status-badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
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
  listAdminDocuments,
  listAdminSources,
  uploadAdminDocument,
  type AdminSource,
  type DocumentFilters,
} from "@/lib/admin-api"
import { useAdminResource } from "@/hooks/useAdminResource"
import { toast } from "sonner"

function localDateStart(value: string | undefined) {
  if (!value) return ""
  return new Date(`${value}T00:00:00`).toISOString()
}

function localDateEnd(value: string | undefined) {
  if (!value) return ""
  const nextDay = new Date(`${value}T00:00:00`)
  nextDay.setDate(nextDay.getDate() + 1)
  return new Date(nextDay.getTime() - 1).toISOString()
}

function UploadDocumentDialog({
  open,
  onOpenChange,
  sources,
  sourcesLoading,
  sourcesError,
  onRetrySources,
  onUploaded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sources: AdminSource[] | null
  sourcesLoading: boolean
  sourcesError: Error | null
  onRetrySources: () => void
  onUploaded: () => void
}) {
  const t = useTranslations()
  const [file, setFile] = useState<File | null>(null)
  const [sourceId, setSourceId] = useState("")
  const [fileError, setFileError] = useState("")
  const [sourceError, setSourceError] = useState("")
  const [busy, setBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const now = Date.now()
  const eligibleSources = (sources ?? []).filter((source) => {
    const verifiedAt = source.last_verified_at
      ? Date.parse(source.last_verified_at)
      : Number.NaN
    return (
      source.verification_status === "verified" &&
      source.usage_permitted &&
      Boolean(source.usage_rights?.trim()) &&
      !source.revoked_at &&
      Number.isInteger(source.freshness_days) &&
      Number(source.freshness_days) > 0 &&
      Number.isFinite(verifiedAt) &&
      verifiedAt <= now &&
      now - verifiedAt <= Number(source.freshness_days) * 86_400_000
    )
  })

  const changeOpen = (next: boolean) => {
    if (!next && busy) return
    if (!next) {
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
      setSourceId("")
      setFileError("")
      setSourceError("")
    }
    onOpenChange(next)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFileError("")
    setSourceError("")

    if (!file) {
      setFileError(t("Choose a PDF file to upload."))
      return
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setFileError(t("Only PDF files are supported."))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setFileError(t("The PDF must be 5 MB or smaller."))
      return
    }
    if (!eligibleSources.some((source) => source.source_id === sourceId)) {
      setSourceError(
        t("Choose a current, verified source with permitted usage.")
      )
      return
    }

    const signature = await file.slice(0, 5).text()
    if (signature !== "%PDF-") {
      setFileError(t("This file does not have a valid PDF signature."))
      return
    }

    setBusy(true)
    try {
      await uploadAdminDocument(file, sourceId)
      toast.success(t("Upload accepted; processing has started."))
      changeOpen(false)
      onUploaded()
    } catch (cause) {
      toast.error(
        cause instanceof AdminApiError ? t(cause.message) : t("Upload failed")
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <UiText text="Upload official document" />
          </DialogTitle>
          <DialogDescription>
            <UiText text="The file is checked and processed as a private draft. Uploading does not approve or publish it." />
          </DialogDescription>
        </DialogHeader>
        <form
          id="admin-document-upload-form"
          onSubmit={submit}
          className="flex flex-col gap-5"
        >
          <FieldGroup className="gap-5">
            <Field data-invalid={Boolean(fileError)}>
              <FieldLabel htmlFor="admin-document-file">
                <UiText text="PDF file" />
              </FieldLabel>
              <Input
                ref={fileInputRef}
                id="admin-document-file"
                type="file"
                accept="application/pdf,.pdf"
                required
                disabled={busy}
                aria-invalid={Boolean(fileError)}
                aria-describedby={
                  fileError
                    ? "admin-document-file-error"
                    : "admin-document-file-help"
                }
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null)
                  setFileError("")
                }}
              />
              <FieldDescription id="admin-document-file-help">
                <UiText text="PDF only. Maximum file size is 5 MB." />
                {file
                  ? ` ${file.name} · ${(file.size / (1024 * 1024)).toFixed(2)} MB`
                  : ""}
              </FieldDescription>
              {fileError ? (
                <FieldError id="admin-document-file-error">
                  {fileError}
                </FieldError>
              ) : null}
            </Field>
            <Field data-invalid={Boolean(sourceError)}>
              <FieldLabel htmlFor="admin-document-source">
                <UiText text="Verified official source" />
              </FieldLabel>
              <Select
                value={sourceId}
                onValueChange={(value) => {
                  setSourceId(value)
                  setSourceError("")
                }}
                disabled={
                  busy || sourcesLoading || eligibleSources.length === 0
                }
              >
                <SelectTrigger
                  id="admin-document-source"
                  className="w-full"
                  aria-invalid={Boolean(sourceError)}
                  aria-describedby={
                    sourceError ? "admin-document-source-error" : undefined
                  }
                >
                  <SelectValue placeholder={t("Choose a verified source")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {eligibleSources.map((source) => (
                      <SelectItem
                        key={source.source_id}
                        value={source.source_id}
                      >
                        {source.issuing_organization} · {source.source_id}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {sourceError ? (
                <FieldError id="admin-document-source-error">
                  {sourceError}
                </FieldError>
              ) : (
                <FieldDescription>
                  {sourcesLoading ? (
                    <UiText text="Loading verified sources…" />
                  ) : sourcesError ? (
                    <span role="alert" className="grid gap-1">
                      <span className="text-destructive">
                        {t(sourcesError.message)}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="link"
                        className="h-auto px-0"
                        onClick={onRetrySources}
                      >
                        <UiText text="Retry loading sources" />
                      </Button>
                    </span>
                  ) : eligibleSources.length > 0 ? (
                    <UiText text="Only current sources with permitted usage can be attached to an upload." />
                  ) : (
                    <span>
                      <UiText text="No verified sources are available. Register and verify a source first." />{" "}
                      <Link
                        href="/manage/sources"
                        className="font-medium text-primary underline underline-offset-4"
                      >
                        <UiText text="Open sources" />
                      </Link>
                    </span>
                  )}
                </FieldDescription>
              )}
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => changeOpen(false)}
              disabled={busy}
            >
              <UiText text="Cancel" />
            </Button>
            <Button
              type="submit"
              disabled={busy || sourcesLoading || eligibleSources.length === 0}
            >
              <FileUp aria-hidden="true" />
              {busy ? t("Uploading…") : t("Upload document")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AdminSelect({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  const id = useId()

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        value={value || "all"}
        onValueChange={(next) => onValueChange(next === "all" ? "" : next)}
      >
        <SelectTrigger id={id} className="w-full min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem
                key={option.value || "all"}
                value={option.value || "all"}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}

function DocumentsView() {
  const t = useTranslations()

  const params = useSearchParams()
  const [uploadOpen, setUploadOpen] = useState(false)
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
    () =>
      listAdminDocuments({
        ...filters,
        uploaded_from: localDateStart(filters.uploaded_from),
        uploaded_to: localDateEnd(filters.uploaded_to),
      }),
    [filters]
  )
  const sourcesResource = useAdminResource(listAdminSources, [])
  const sources = sourcesResource.data
  const invalidDateRange = Boolean(
    filters.uploaded_from &&
    filters.uploaded_to &&
    filters.uploaded_from > filters.uploaded_to
  )

  useEffect(() => {
    if (!data?.items.some((document) => document.status === "processing")) {
      return
    }
    const timer = window.setTimeout(() => void reload(), 2500)
    return () => window.clearTimeout(timer)
  }, [data, error, reload])

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
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setUploadOpen(true)}>
              <FileUp aria-hidden="true" />
              <UiText text="Upload document" />
            </Button>
            <Button asChild variant="outline">
              <Link href="/manage/ingestion">
                <UiText text="Open ingestion" />
              </Link>
            </Button>
          </div>
        }
      />

      <FieldGroup className="grid items-end gap-4 rounded-lg border border-border bg-card p-4 md:grid-cols-2 xl:grid-cols-4">
        <Field className="xl:col-span-2">
          <FieldLabel htmlFor="documents-search">
            <UiText text="Search catalogue" />
          </FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              id="documents-search"
              placeholder={t("Title, id, agency, source")}
              value={filters.q}
              onChange={(event) => update({ q: event.target.value })}
            />
          </InputGroup>
        </Field>
        <AdminSelect
          label={t("Processing status")}
          value={filters.processing_status ?? ""}
          onValueChange={(value) => update({ processing_status: value })}
          options={[
            { value: "", label: t("All processing states") },
            { value: "ready", label: t("Ready") },
            { value: "processing", label: t("Processing") },
            { value: "error", label: t("Error") },
          ]}
        />
        <AdminSelect
          label={t("Publication status")}
          value={filters.publication_status ?? ""}
          onValueChange={(value) => update({ publication_status: value })}
          options={[
            { value: "", label: t("All publication states") },
            ...[
              "draft",
              "review",
              "approved",
              "published",
              "suspended",
              "expired",
              "archived",
            ].map((status) => ({ value: status, label: t(status) })),
          ]}
        />
        <AdminSelect
          label={t("Official source")}
          value={filters.source_id ?? ""}
          onValueChange={(value) => update({ source_id: value })}
          options={[
            { value: "", label: t("All sources") },
            ...(sources ?? []).map((source) => ({
              value: source.source_id,
              label: `${source.source_id} · ${t(source.verification_status)}`,
            })),
          ]}
        />
        <AdminSelect
          label={t("Visibility")}
          value={filters.visibility ?? ""}
          onValueChange={(value) => update({ visibility: value })}
          options={[
            { value: "", label: t("All visibility") },
            { value: "unclassified", label: t("Unclassified") },
            { value: "private", label: t("Private") },
            { value: "public", label: t("Public") },
          ]}
        />
        <Field data-invalid={invalidDateRange}>
          <FieldLabel htmlFor="documents-uploaded-from">
            <UiText text="Uploaded from" />
          </FieldLabel>
          <DatePicker
            id="documents-uploaded-from"
            value={filters.uploaded_from}
            max={filters.uploaded_to || undefined}
            aria-invalid={invalidDateRange}
            aria-describedby={
              invalidDateRange ? "documents-date-range-error" : undefined
            }
            onChange={(value) => update({ uploaded_from: value })}
          />
        </Field>
        <Field data-invalid={invalidDateRange}>
          <FieldLabel htmlFor="documents-uploaded-to">
            <UiText text="Uploaded to" />
          </FieldLabel>
          <DatePicker
            id="documents-uploaded-to"
            value={filters.uploaded_to}
            min={filters.uploaded_from || undefined}
            aria-invalid={invalidDateRange}
            aria-describedby={
              invalidDateRange ? "documents-date-range-error" : undefined
            }
            onChange={(value) => update({ uploaded_to: value })}
          />
          {invalidDateRange ? (
            <FieldError id="documents-date-range-error">
              <UiText text="From date must be on or before to date." />
            </FieldError>
          ) : null}
        </Field>
        <AdminSelect
          label={t("Sort")}
          value={`${filters.sort}:${filters.order}`}
          onValueChange={(value) => {
            const [sort, order] = value.split(":")
            update({ sort, order })
          }}
          options={[
            { value: "uploaded_at:desc", label: t("Newest first") },
            { value: "uploaded_at:asc", label: t("Oldest first") },
            { value: "name:asc", label: t("Name A–Z") },
            { value: "name:desc", label: t("Name Z–A") },
            { value: "publication_status:asc", label: t("Publication status") },
            { value: "status:asc", label: t("Processing status") },
          ]}
        />
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
      </FieldGroup>

      <div className="mt-6 flex flex-col gap-4">
        {loading ? <AdminLoading label={t("Reading catalogue…")} /> : null}
        {error ? <AdminErrorState error={error} onRetry={reload} /> : null}

        {data ? (
          data.items.length === 0 ? (
            <AdminEmptyState
              message={t("No documents match these filters.")}
              hint={t("Clear filters or upload an official document.")}
            />
          ) : (
            <Card className="gap-0 py-0">
              <Table className="min-w-[820px]">
                <TableCaption className="sr-only">
                  <UiText text="Document catalogue: processing and publication are independent states." />
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead scope="col">
                      <UiText text="Document" />
                    </TableHead>
                    <TableHead scope="col">
                      <UiText text="Processing" />
                    </TableHead>
                    <TableHead scope="col">
                      <UiText text="Publication" />
                    </TableHead>
                    <TableHead scope="col">
                      <UiText text="Source" />
                    </TableHead>
                    <TableHead className="text-right">
                      <UiText text="Rev" />
                    </TableHead>
                    <TableHead scope="col">
                      <UiText text="Uploaded" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((doc, index) => (
                    <TableRow key={doc.id}>
                      <TableCell className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {String(
                          (data.page - 1) * data.page_size + index + 1
                        ).padStart(2, "0")}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/manage/documents/${encodeURIComponent(doc.id)}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {doc.name}
                        </Link>
                        <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                          {doc.id}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={doc.status} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={doc.publication_status} />
                      </TableCell>
                      <TableCell className="text-xs">
                        {doc.source_id ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {doc.current_revision}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                        {doc.uploaded_at
                          ? new Date(doc.uploaded_at).toLocaleDateString(
                              t.locale
                            )
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-3 text-sm">
                <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
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
            </Card>
          )
        ) : null}
      </div>
      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        sources={sources}
        sourcesLoading={sourcesResource.loading}
        sourcesError={sourcesResource.error}
        onRetrySources={() => void sourcesResource.reload()}
        onUploaded={() =>
          setFilters((current) => ({
            ...current,
            q: "",
            processing_status: "",
            publication_status: "",
            visibility: "",
            source_id: "",
            uploaded_from: "",
            uploaded_to: "",
            page: 1,
          }))
        }
      />
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
