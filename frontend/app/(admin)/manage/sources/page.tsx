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
  usage_rights: "public-info",
}

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
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      await createAdminSource({
        ...form,
        authority: form.authority || undefined,
        source_url: form.source_url || undefined,
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
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain"
        style={{ width: "min(34rem, calc(100vw - 4rem))", maxWidth: "none" }}
      >
        <DialogHeader>
          <DialogTitle>
            <UiText text="Register official source" />
          </DialogTitle>
          <DialogDescription>
            {" "}
            <UiText text="A source starts unverified. Verification requires evidence and a separate permission." />{" "}
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <label className="grid min-w-0 gap-1.5 text-sm">
            <UiText text="Source ID" />
            <Input
              value={form.source_id}
              onChange={(event) =>
                setForm({ ...form, source_id: event.target.value })
              }
            />
          </label>
          <label className="grid min-w-0 gap-1.5 text-sm">
            <UiText text="Organisation" />
            <Input
              value={form.issuing_organization}
              onChange={(event) =>
                setForm({ ...form, issuing_organization: event.target.value })
              }
            />
          </label>
          <label className="grid min-w-0 gap-1.5 text-sm">
            <UiText text="Source type" />
            <Input
              value={form.source_type}
              onChange={(event) =>
                setForm({ ...form, source_type: event.target.value })
              }
            />
          </label>
          <label className="grid min-w-0 gap-1.5 text-sm">
            <UiText text="Authority" />
            <Input
              value={form.authority}
              onChange={(event) =>
                setForm({ ...form, authority: event.target.value })
              }
            />
          </label>
          <label className="grid min-w-0 gap-1.5 text-sm sm:col-span-2">
            <UiText text="Official URL" />
            <Input
              value={form.source_url}
              onChange={(event) =>
                setForm({ ...form, source_url: event.target.value })
              }
              placeholder={t("https://")}
            />
          </label>
          <label className="grid min-w-0 gap-1.5 text-sm sm:col-span-2">
            <UiText text="Usage rights" />
            <Input
              value={form.usage_rights}
              onChange={(event) =>
                setForm({ ...form, usage_rights: event.target.value })
              }
            />
          </label>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            <UiText text="Cancel" />
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={
              busy ||
              !form.source_id.trim() ||
              !form.issuing_organization.trim() ||
              !form.source_type.trim()
            }
          >
            {" "}
            <UiText text="Register source" />{" "}
          </Button>
        </DialogFooter>
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
  const [freshness, setFreshness] = useState("365")
  const [usagePermitted, setUsagePermitted] = useState(true)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!source) return
    setBusy(true)
    try {
      await verifyAdminSource(source.source_id, {
        evidence,
        freshness_days: Number(freshness),
        usage_rights: source.usage_rights ?? undefined,
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
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain"
        style={{ width: "min(34rem, calc(100vw - 4rem))", maxWidth: "none" }}
      >
        <DialogHeader>
          <DialogTitle>
            <UiText text="Verify source" />
          </DialogTitle>
          <DialogDescription>
            {" "}
            <UiText text="Record what was checked. Verification is attributed to your account and audited." />{" "}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm">
            <UiText text="Verification evidence" />{" "}
            <Textarea
              className="mt-1"
              value={evidence}
              onChange={(event) => setEvidence(event.target.value)}
              placeholder={t(
                "Official portal URL, checked date, document reference…"
              )}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <UiText text="Freshness (days)" />
              <Input
                type="number"
                min={1}
                value={freshness}
                onChange={(event) => setFreshness(event.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input
                type="checkbox"
                checked={usagePermitted}
                onChange={(event) => setUsagePermitted(event.target.checked)}
              />{" "}
              <UiText text="Usage permitted" />{" "}
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            <UiText text="Cancel" />
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={busy || !evidence.trim()}
          >
            <UiText text="Verify source" />
          </Button>
        </DialogFooter>
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
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!source) return
    setBusy(true)
    try {
      await updateAdminSource(source.source_id, {
        issuing_organization: organization.trim(),
        authority: authority.trim() || undefined,
        source_url: url.trim() || undefined,
        source_type: sourceType.trim(),
        usage_rights: rights.trim() || undefined,
        usage_permitted: usagePermitted,
        freshness_days: freshness ? Number(freshness) : undefined,
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
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain"
        style={{ width: "min(34rem, calc(100vw - 4rem))", maxWidth: "none" }}
      >
        <DialogHeader>
          <DialogTitle>
            <UiText text="Edit source metadata" />
          </DialogTitle>
          <DialogDescription>
            {" "}
            <UiText text="Changes are audited. Verification status is changed only through Verify or Revoke." />{" "}
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <UiText text="Organisation" />
            <Input
              value={organization}
              onChange={(event) => setOrganization(event.target.value)}
            />
          </label>
          <label className="text-sm">
            <UiText text="Source type" />
            <Input
              value={sourceType}
              onChange={(event) => setSourceType(event.target.value)}
            />
          </label>
          <label className="text-sm">
            <UiText text="Authority" />
            <Input
              value={authority}
              onChange={(event) => setAuthority(event.target.value)}
            />
          </label>
          <label className="text-sm">
            <UiText text="Freshness (days)" />
            <Input
              type="number"
              min={1}
              value={freshness}
              onChange={(event) => setFreshness(event.target.value)}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <UiText text="Official URL" />
            <Input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <UiText text="Usage rights" />
            <Input
              value={rights}
              onChange={(event) => setRights(event.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={usagePermitted}
              onChange={(event) => setUsagePermitted(event.target.checked)}
            />{" "}
            <UiText text="Usage permitted" />{" "}
          </label>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            <UiText text="Cancel" />
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={busy || !organization.trim() || !sourceType.trim()}
          >
            <UiText text="Save changes" />
          </Button>
        </DialogFooter>
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

      <div className="admin-filterbar mb-4 sm:grid-cols-[minmax(0,1fr)_15rem]">
        <Input
          aria-label={t("Search sources")}
          placeholder={t("Search source id, organisation, URL")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          className="neo-input h-9 rounded-md px-2 text-sm"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label={t("Verification status")}
        >
          <option value="">
            <UiText text="All verification states" />
          </option>
          {["unverified", "pending", "verified", "revoked"].map((value) => (
            <option key={value} value={value}>
              {t(value)}
            </option>
          ))}
        </select>
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
                className="admin-record gap-4 p-4 sm:p-5"
              >
                <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                      <span className="admin-index">
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
