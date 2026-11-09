"use client"

import { UiText, useTranslations } from "@/components/i18n"
import { useState, type FormEvent } from "react"
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
  createAdminSource,
  listAdminSources,
  revokeAdminSource,
  updateAdminSource,
  verifyAdminSource,
  type AdminSource,
} from "@/lib/admin-api"
import { useAdminResource } from "@/hooks/useAdminResource"

const EMPTY_SOURCE = {
  source_id: "",
  issuing_organization: "",
  source_type: "official_gov",
  authority: "",
  source_url: "",
  usage_rights: "",
}

const SOURCE_TYPES = [
  { value: "official_gov", label: "Official government website" },
  { value: "government_website", label: "Government website listing" },
  { value: "html_listing", label: "HTML document listing" },
  { value: "rss_feed", label: "RSS or Atom feed" },
  { value: "open_dataset", label: "Open dataset (manual upload)" },
  { value: "manual_upload", label: "Manual upload source" },
] as const

function CreateSourceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const t = useTranslations()

  const [form, setForm] = useState(EMPTY_SOURCE)
  const [formError, setFormError] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError("")
    if (
      !form.source_id.trim() ||
      !form.issuing_organization.trim() ||
      !form.source_type.trim() ||
      !form.source_url.trim()
    ) {
      setFormError(t("Complete the required source fields."))
      return
    }
    setBusy(true)
    try {
      await createAdminSource({
        ...form,
        source_id: form.source_id.trim(),
        issuing_organization: form.issuing_organization.trim(),
        source_type: form.source_type.trim(),
        authority: form.authority.trim() || undefined,
        source_url: form.source_url.trim(),
        usage_rights: form.usage_rights.trim() || undefined,
      })
      toast.success(t("Source registered"))
      setForm(EMPTY_SOURCE)
      onOpenChange(false)
      onCreated()
    } catch (cause) {
      toast.error(
        cause instanceof AdminApiError
          ? t(cause.message)
          : t("Could not register source")
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <UiText text="Register official source" />
          </DialogTitle>
          <DialogDescription>
            {" "}
            <UiText text="A source starts unverified. Verification requires evidence and a separate permission." />{" "}
          </DialogDescription>
        </DialogHeader>
        <form
          id="create-source-form"
          onSubmit={submit}
          className="flex flex-col gap-5"
        >
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="create-source-id">
                <UiText text="Source ID" />
              </FieldLabel>
              <Input
                id="create-source-id"
                required
                maxLength={120}
                value={form.source_id}
                onChange={(event) =>
                  setForm({ ...form, source_id: event.target.value })
                }
              />
              <FieldDescription>
                <UiText text="Use a stable, unique source identifier." />
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="create-source-organization">
                <UiText text="Organisation" />
              </FieldLabel>
              <Input
                id="create-source-organization"
                required
                maxLength={200}
                value={form.issuing_organization}
                onChange={(event) =>
                  setForm({ ...form, issuing_organization: event.target.value })
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="create-source-type">
                <UiText text="Source type" />
              </FieldLabel>
              <Select
                value={form.source_type}
                onValueChange={(source_type) =>
                  setForm({ ...form, source_type })
                }
              >
                <SelectTrigger id="create-source-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {SOURCE_TYPES.map((sourceType) => (
                      <SelectItem
                        key={sourceType.value}
                        value={sourceType.value}
                      >
                        <UiText text={sourceType.label} />
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>
                <UiText text="Choose the listing format used by this source." />
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="create-source-authority">
                <UiText text="Authority" />
              </FieldLabel>
              <Input
                id="create-source-authority"
                maxLength={200}
                value={form.authority}
                onChange={(event) =>
                  setForm({ ...form, authority: event.target.value })
                }
              />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="create-source-url">
                <UiText text="Official URL" />
              </FieldLabel>
              <Input
                id="create-source-url"
                type="url"
                required
                maxLength={2000}
                value={form.source_url}
                onChange={(event) =>
                  setForm({ ...form, source_url: event.target.value })
                }
                placeholder="https://"
              />
              <FieldDescription>
                <UiText text="The source URL is used to discover official documents." />
              </FieldDescription>
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="create-source-rights">
                <UiText text="Usage rights" />
              </FieldLabel>
              <Input
                id="create-source-rights"
                maxLength={500}
                value={form.usage_rights}
                onChange={(event) =>
                  setForm({ ...form, usage_rights: event.target.value })
                }
                placeholder={t("For example, CC BY 4.0 with the licence URL")}
              />
            </Field>
          </FieldGroup>
          {formError ? <FieldError>{formError}</FieldError> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              <UiText text="Cancel" />
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? t("Registering source…") : t("Register source")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function VerifySourceDialog({
  source,
  onOpenChange,
  onVerified,
}: {
  source: AdminSource | null
  onOpenChange: (open: boolean) => void
  onVerified: () => void
}) {
  const t = useTranslations()

  const [evidence, setEvidence] = useState("")
  const [usageRights, setUsageRights] = useState("")
  const [freshness, setFreshness] = useState("")
  const [usagePermitted, setUsagePermitted] = useState(false)
  const [formError, setFormError] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError("")
    const freshnessDays = Number(freshness)
    if (
      !source ||
      !evidence.trim() ||
      !usageRights.trim() ||
      !Number.isInteger(freshnessDays) ||
      freshnessDays < 1 ||
      freshnessDays > 3650 ||
      !usagePermitted
    ) {
      setFormError(
        t("Complete the evidence, rights, freshness, and permission checks.")
      )
      return
    }
    setBusy(true)
    try {
      await verifyAdminSource(source.source_id, {
        evidence: evidence.trim(),
        freshness_days: freshnessDays,
        usage_rights: usageRights.trim(),
        usage_permitted: usagePermitted,
      })
      toast.success(t("Source verified"))
      onOpenChange(false)
      onVerified()
    } catch (cause) {
      toast.error(
        cause instanceof AdminApiError
          ? t(cause.message)
          : t("Verification failed")
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={Boolean(source)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <UiText text="Verify source" />
          </DialogTitle>
          <DialogDescription>
            {" "}
            <UiText text="Record what was checked. Verification is attributed to your account and audited." />{" "}
          </DialogDescription>
        </DialogHeader>
        <form
          id="verify-source-form"
          onSubmit={submit}
          className="flex flex-col gap-4"
        >
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="verify-source-evidence">
                <UiText text="Verification evidence" />
              </FieldLabel>
              <Textarea
                id="verify-source-evidence"
                className="mt-1 max-h-48 resize-y"
                value={evidence}
                onChange={(event) => {
                  setEvidence(event.target.value)
                  setFormError("")
                }}
                required
                maxLength={4000}
                rows={4}
                placeholder={t(
                  "Official portal URL, checked date, document reference…"
                )}
              />
              <FieldDescription>
                <UiText text="Record the official page checked, the date, and what it confirms." />
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="verify-source-rights">
                <UiText text="Usage rights" />
              </FieldLabel>
              <Input
                id="verify-source-rights"
                value={usageRights}
                onChange={(event) => {
                  setUsageRights(event.target.value)
                  setFormError("")
                }}
                placeholder={t("For example, CC BY 4.0 with the licence URL")}
                required
                maxLength={500}
              />
              <FieldDescription>
                <UiText text="Record the exact reuse terms and link to their official wording where available." />
              </FieldDescription>
            </Field>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="verify-source-freshness">
                  <UiText text="Freshness (days)" />
                </FieldLabel>
                <Input
                  id="verify-source-freshness"
                  type="number"
                  min={1}
                  max={3650}
                  step={1}
                  inputMode="numeric"
                  value={freshness}
                  onChange={(event) => {
                    setFreshness(event.target.value)
                    setFormError("")
                  }}
                  required
                />
                <FieldDescription>
                  <UiText text="How long this verification remains current before a re-check is required." />
                </FieldDescription>
              </Field>
              <Field className="gap-2 rounded-lg border border-border p-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="verify-source-usage-permitted"
                    checked={usagePermitted}
                    onCheckedChange={(checked) => {
                      setUsagePermitted(checked === true)
                      setFormError("")
                    }}
                    aria-required="true"
                    aria-describedby="verify-source-usage-description"
                  />
                  <div className="grid gap-1">
                    <FieldLabel htmlFor="verify-source-usage-permitted">
                      <UiText text="Usage permitted" />
                    </FieldLabel>
                    <FieldDescription id="verify-source-usage-description">
                      <UiText text="Confirm only when the recorded terms permit this platform to store and index the material." />
                    </FieldDescription>
                  </div>
                </div>
              </Field>
            </FieldGroup>
          </FieldGroup>
          {formError ? <FieldError>{formError}</FieldError> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              <UiText text="Cancel" />
            </Button>
            <Button
              type="submit"
              disabled={busy || !usagePermitted || !usageRights.trim()}
            >
              {busy ? t("Verifying source…") : t("Verify source")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditSourceDialog({
  source,
  onOpenChange,
  onSaved,
}: {
  source: AdminSource | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const t = useTranslations()

  const [organization, setOrganization] = useState(
    source?.issuing_organization ?? ""
  )
  const [authority, setAuthority] = useState(source?.authority ?? "")
  const [url, setUrl] = useState(source?.source_url ?? "")
  const [sourceType, setSourceType] = useState(source?.source_type ?? "")
  const [rights, setRights] = useState(source?.usage_rights ?? "")
  const [usagePermitted, setUsagePermitted] = useState(
    source?.usage_permitted ?? false
  )
  const [freshness, setFreshness] = useState(
    source?.freshness_days ? String(source.freshness_days) : ""
  )
  const [formError, setFormError] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!source) return
    setFormError("")
    const freshnessDays = freshness ? Number(freshness) : undefined
    if (
      !organization.trim() ||
      !sourceType.trim() ||
      ((usagePermitted || source.verification_status === "verified") &&
        !rights.trim()) ||
      (freshnessDays !== undefined &&
        (!Number.isInteger(freshnessDays) ||
          freshnessDays < 1 ||
          freshnessDays > 3650))
    ) {
      setFormError(t("Complete the required source fields with valid values."))
      return
    }
    setBusy(true)
    try {
      await updateAdminSource(source.source_id, {
        issuing_organization: organization.trim(),
        authority: authority.trim() || undefined,
        source_url: url.trim() || undefined,
        source_type: sourceType.trim(),
        usage_rights: rights.trim() || undefined,
        usage_permitted: usagePermitted,
        freshness_days: freshnessDays,
      })
      toast.success(t("Source updated"))
      onOpenChange(false)
      onSaved()
    } catch (cause) {
      toast.error(
        cause instanceof AdminApiError ? t(cause.message) : t("Update failed")
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={Boolean(source)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <UiText text="Edit source metadata" />
          </DialogTitle>
          <DialogDescription>
            {" "}
            <UiText text="Changes are audited. Verification status is changed only through Verify or Revoke." />{" "}
          </DialogDescription>
        </DialogHeader>
        <form
          id="edit-source-form"
          onSubmit={submit}
          className="flex flex-col gap-5"
        >
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="edit-source-organization">
                <UiText text="Organisation" />
              </FieldLabel>
              <Input
                id="edit-source-organization"
                required
                maxLength={200}
                value={organization}
                onChange={(event) => {
                  setOrganization(event.target.value)
                  setFormError("")
                }}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-source-type">
                <UiText text="Source type" />
              </FieldLabel>
              <Select value={sourceType} onValueChange={setSourceType}>
                <SelectTrigger id="edit-source-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {SOURCE_TYPES.map((sourceType) => (
                      <SelectItem
                        key={sourceType.value}
                        value={sourceType.value}
                      >
                        <UiText text={sourceType.label} />
                      </SelectItem>
                    ))}
                    {sourceType &&
                    !SOURCE_TYPES.some((item) => item.value === sourceType) ? (
                      <SelectItem value={sourceType}>{sourceType}</SelectItem>
                    ) : null}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-source-authority">
                <UiText text="Authority" />
              </FieldLabel>
              <Input
                id="edit-source-authority"
                maxLength={200}
                value={authority}
                onChange={(event) => setAuthority(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-source-freshness">
                <UiText text="Freshness (days)" />
              </FieldLabel>
              <Input
                id="edit-source-freshness"
                type="number"
                min={1}
                max={3650}
                step={1}
                value={freshness}
                onChange={(event) => {
                  setFreshness(event.target.value)
                  setFormError("")
                }}
                required={
                  usagePermitted || source?.verification_status === "verified"
                }
              />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="edit-source-url">
                <UiText text="Official URL" />
              </FieldLabel>
              <Input
                id="edit-source-url"
                type="url"
                maxLength={2000}
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value)
                  setFormError("")
                }}
              />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="edit-source-rights">
                <UiText text="Usage rights" />
              </FieldLabel>
              <Input
                id="edit-source-rights"
                maxLength={500}
                value={rights}
                onChange={(event) => {
                  setRights(event.target.value)
                  setFormError("")
                }}
                required={
                  usagePermitted || source?.verification_status === "verified"
                }
              />
            </Field>
            <Field className="grid-cols-[auto_minmax(0,1fr)] items-center gap-2 sm:col-span-2">
              <Checkbox
                id="edit-source-usage-permitted"
                checked={usagePermitted}
                onCheckedChange={(checked) => {
                  setUsagePermitted(checked === true)
                  setFormError("")
                }}
                aria-describedby="edit-source-usage-description"
              />
              <div className="grid gap-1">
                <FieldLabel htmlFor="edit-source-usage-permitted">
                  <UiText text="Usage permitted" />
                </FieldLabel>
                <FieldDescription id="edit-source-usage-description">
                  <UiText text="Changing this permission affects whether linked documents can be published." />
                </FieldDescription>
              </div>
            </Field>
          </FieldGroup>
          {formError ? <FieldError>{formError}</FieldError> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              <UiText text="Cancel" />
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? t("Saving source…") : t("Save changes")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminSourcesPage() {
  const t = useTranslations()

  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("")
  const { data, error, loading, reload } = useAdminResource(
    () => listAdminSources({ q: query, verification_status: status }),
    [query, status]
  )
  const [creating, setCreating] = useState(false)
  const [verifying, setVerifying] = useState<AdminSource | null>(null)
  const [editing, setEditing] = useState<AdminSource | null>(null)
  const [revoking, setRevoking] = useState<AdminSource | null>(null)

  return (
    <div className="mx-auto w-full max-w-5xl">
      <AdminPageHeader
        kicker={t("Registry / 04")}
        title={t("Official sources")}
        description={t(
          "The trusted registry of issuing organisations, rights, verification evidence and freshness policy. Verification is attributed and audited."
        )}
        actions={
          <Button onClick={() => setCreating(true)}>
            {" "}
            <UiText text="Register source" />{" "}
          </Button>
        }
      />

      <div className="mb-4 grid min-w-0 gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_15rem]">
        <Field>
          <FieldLabel htmlFor="sources-search">
            <UiText text="Search sources" />
          </FieldLabel>
          <Input
            id="sources-search"
            placeholder={t("Search source id, organisation, URL")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="sources-verification-filter">
            <UiText text="Verification status" />
          </FieldLabel>
          <Select
            value={status || "all"}
            onValueChange={(value) => setStatus(value === "all" ? "" : value)}
          >
            <SelectTrigger id="sources-verification-filter" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">
                  <UiText text="All verification states" />
                </SelectItem>
                {["unverified", "pending", "verified", "revoked"].map(
                  (value) => (
                    <SelectItem key={value} value={value}>
                      {t(value)}
                    </SelectItem>
                  )
                )}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </div>

      {loading ? <AdminLoading label={t("Loading sources…")} /> : null}
      {error ? <AdminErrorState error={error} onRetry={reload} /> : null}

      {data ? (
        data.length === 0 ? (
          <AdminEmptyState
            message={t("No official sources registered.")}
            hint={t("Register a source before approving documents.")}
          />
        ) : (
          <div>
            {data.map((source, index) => (
              <article
                key={source.source_id}
                className="mb-3 grid min-w-0 gap-4 rounded-lg border border-border bg-card p-4 [overflow-wrap:anywhere] text-card-foreground shadow-sm sm:p-5"
              >
                <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <h2 className="min-w-0 font-heading text-base font-semibold tracking-tight break-words sm:text-lg">
                        {source.issuing_organization}
                      </h2>
                      <StatusBadge value={source.verification_status} />
                      <StatusBadge
                        value={source.usage_permitted ? "success" : "warning"}
                        label={
                          source.usage_permitted
                            ? t("usage permitted")
                            : t("usage not permitted")
                        }
                      />
                    </div>
                    <p className="mt-2 font-mono text-[11px] tracking-wide break-all text-muted-foreground uppercase">
                      {source.source_id} · {source.source_type}
                    </p>
                    <dl className="mt-4 grid min-w-0 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                      <div className="min-w-0">
                        <dt className="text-xs font-medium text-muted-foreground">
                          <UiText text="Official URL" />
                        </dt>
                        <dd className="mt-0.5 break-all text-foreground">
                          {source.source_url ? (
                            <a
                              href={source.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="underline decoration-border underline-offset-2 hover:decoration-foreground"
                            >
                              {source.source_url}
                            </a>
                          ) : (
                            "—"
                          )}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs font-medium text-muted-foreground">
                          <UiText text="Issuing authority" />
                        </dt>
                        <dd className="mt-0.5 break-words">
                          {source.authority ?? "—"}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs font-medium text-muted-foreground">
                          <UiText text="Usage rights" />
                        </dt>
                        <dd className="mt-0.5 break-words">
                          {source.usage_rights ?? "—"}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs font-medium text-muted-foreground">
                          <UiText text="Verification" />
                        </dt>
                        <dd className="mt-0.5 break-words">
                          {source.last_verified_at
                            ? t("{value0} · {value1} day freshness", {
                                value0: new Date(
                                  source.last_verified_at
                                ).toLocaleDateString(t.locale),
                                value1: source.freshness_days ?? "—",
                              })
                            : t("Not yet verified")}
                          {source.verified_by
                            ? ` · by ${source.verified_by}`
                            : ""}
                        </dd>
                      </div>
                      <div className="min-w-0 sm:col-span-2">
                        <dt className="text-xs font-medium text-muted-foreground">
                          <UiText text="Evidence" />
                        </dt>
                        <dd className="mt-0.5 break-words">
                          {String(
                            (
                              source.metadata as {
                                verification_evidence?: string
                              }
                            )?.verification_evidence ??
                              "No verification evidence recorded"
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:w-auto lg:shrink-0">
                    <Button
                      asChild
                      size="sm"
                      variant="ghost"
                      className="w-full sm:w-auto"
                    >
                      <Link
                        href={`/manage/documents?source_id=${encodeURIComponent(source.source_id)}`}
                      >
                        {" "}
                        <UiText text="Documents" />{" "}
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => setEditing(source)}
                    >
                      {" "}
                      <UiText text="Edit" />{" "}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => setVerifying(source)}
                    >
                      {source.verification_status === "verified"
                        ? t("Re-verify")
                        : t("Verify")}
                    </Button>
                    {source.verification_status === "verified" ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="w-full sm:w-auto"
                        onClick={() => setRevoking(source)}
                      >
                        <UiText text="Revoke" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )
      ) : null}

      <CreateSourceDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={reload}
      />
      <VerifySourceDialog
        key={verifying?.source_id ?? "verify-source"}
        source={verifying}
        onOpenChange={(open) => !open && setVerifying(null)}
        onVerified={reload}
      />
      {editing ? (
        <EditSourceDialog
          key={editing.source_id}
          source={editing}
          onOpenChange={(open) => !open && setEditing(null)}
          onSaved={reload}
        />
      ) : null}
      <ActionDialog
        open={Boolean(revoking)}
        onOpenChange={(open) => !open && setRevoking(null)}
        title={t("Revoke source verification")}
        description={t(
          "Documents using this source stop being publishable and public eligibility is rechecked on every read."
        )}
        confirmLabel={t("Revoke")}
        destructive
        requireReason
        onConfirm={async (reason) => {
          if (!revoking) return
          try {
            await revokeAdminSource(revoking.source_id, reason)
            toast.success(t("Source revoked"))
            setRevoking(null)
            reload()
          } catch (cause) {
            toast.error(
              cause instanceof AdminApiError
                ? t(cause.message)
                : t("Revoke failed")
            )
          }
        }}
      />
    </div>
  )
}
