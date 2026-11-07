"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"

import { ActionDialog } from "@/components/admin/action-dialog"
import { AdminPageHeader } from "@/components/admin/admin-shell"
import { AdminEmptyState, AdminErrorState, AdminLoading } from "@/components/admin/admin-state"
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
      toast.success("Source registered")
      setForm(EMPTY_SOURCE)
      onOpenChange(false)
      onCreated()
    } catch (cause) {
      toast.error(cause instanceof AdminApiError ? cause.message : "Could not register source")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register official source</DialogTitle>
          <DialogDescription>
            A source starts unverified. Verification requires evidence and a separate permission.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Source ID<Input value={form.source_id} onChange={(event) => setForm({ ...form, source_id: event.target.value })} /></label>
          <label className="text-sm">Organisation<Input value={form.issuing_organization} onChange={(event) => setForm({ ...form, issuing_organization: event.target.value })} /></label>
          <label className="text-sm">Source type<Input value={form.source_type} onChange={(event) => setForm({ ...form, source_type: event.target.value })} /></label>
          <label className="text-sm">Authority<Input value={form.authority} onChange={(event) => setForm({ ...form, authority: event.target.value })} /></label>
          <label className="text-sm sm:col-span-2">Official URL<Input value={form.source_url} onChange={(event) => setForm({ ...form, source_url: event.target.value })} placeholder="https://" /></label>
          <label className="text-sm sm:col-span-2">Usage rights<Input value={form.usage_rights} onChange={(event) => setForm({ ...form, usage_rights: event.target.value })} /></label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={busy || !form.source_id.trim() || !form.issuing_organization.trim() || !form.source_type.trim()}>
            Register source
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
      toast.success("Source verified")
      onOpenChange(false)
      onVerified()
    } catch (cause) {
      toast.error(cause instanceof AdminApiError ? cause.message : "Verification failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={Boolean(source)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify source</DialogTitle>
          <DialogDescription>
            Record what was checked. Verification is attributed to your account and audited.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm">Verification evidence
            <Textarea className="mt-1" value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Official portal URL, checked date, document reference…" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Freshness (days)<Input type="number" min={1} value={freshness} onChange={(event) => setFreshness(event.target.value)} /></label>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input type="checkbox" checked={usagePermitted} onChange={(event) => setUsagePermitted(event.target.checked)} />
              Usage permitted
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={busy || !evidence.trim()}>Verify source</Button>
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
  const [organization, setOrganization] = useState(source?.issuing_organization ?? "")
  const [authority, setAuthority] = useState(source?.authority ?? "")
  const [url, setUrl] = useState(source?.source_url ?? "")
  const [sourceType, setSourceType] = useState(source?.source_type ?? "")
  const [rights, setRights] = useState(source?.usage_rights ?? "")
  const [usagePermitted, setUsagePermitted] = useState(source?.usage_permitted ?? false)
  const [freshness, setFreshness] = useState(source?.freshness_days ? String(source.freshness_days) : "")
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
      toast.success("Source updated")
      onOpenChange(false)
      onSaved()
    } catch (cause) {
      toast.error(cause instanceof AdminApiError ? cause.message : "Update failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={Boolean(source)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit source metadata</DialogTitle>
          <DialogDescription>
            Changes are audited. Verification status is changed only through Verify or Revoke.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Organisation<Input value={organization} onChange={(event) => setOrganization(event.target.value)} /></label>
          <label className="text-sm">Source type<Input value={sourceType} onChange={(event) => setSourceType(event.target.value)} /></label>
          <label className="text-sm">Authority<Input value={authority} onChange={(event) => setAuthority(event.target.value)} /></label>
          <label className="text-sm">Freshness (days)<Input type="number" min={1} value={freshness} onChange={(event) => setFreshness(event.target.value)} /></label>
          <label className="text-sm sm:col-span-2">Official URL<Input value={url} onChange={(event) => setUrl(event.target.value)} /></label>
          <label className="text-sm sm:col-span-2">Usage rights<Input value={rights} onChange={(event) => setRights(event.target.value)} /></label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={usagePermitted} onChange={(event) => setUsagePermitted(event.target.checked)} />
            Usage permitted
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={busy || !organization.trim() || !sourceType.trim()}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminSourcesPage() {
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
    <div>
      <AdminPageHeader
        kicker="Registry / 04"
        title="Official sources"
        description="The trusted registry of issuing organisations, rights, verification evidence and freshness policy. Verification is attributed and audited."
        actions={<Button onClick={() => setCreating(true)}>Register source</Button>}
      />

      <div className="admin-filterbar mb-2 sm:grid-cols-2">
        <Input placeholder="Search source id, organisation, URL" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select className="neo-input h-9 rounded-md px-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Verification status">
          <option value="">All verification states</option>
          {["unverified", "pending", "verified", "revoked"].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </div>

      {loading ? <AdminLoading label="Loading sources…" /> : null}
      {error ? <AdminErrorState error={error} onRetry={reload} /> : null}

      {data ? (
        data.length === 0 ? (
          <AdminEmptyState message="No official sources registered." hint="Register a source before approving documents." />
        ) : (
          <div>
            {data.map((source, index) => (
              <article key={source.source_id} className="admin-record">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="admin-index">{String(index + 1).padStart(2, "0")}</span>
                      <h2 className="font-heading text-lg font-semibold tracking-tight">{source.issuing_organization}</h2>
                      <StatusBadge value={source.verification_status} />
                      {source.usage_permitted ? <StatusBadge value="verified" label="usage permitted" /> : null}
                    </div>
                    <p className="mt-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                      {source.source_id} · {source.source_type}
                    </p>
                    <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                      <div className="truncate">URL: {source.source_url ?? "—"}</div>
                      <div>Authority: {source.authority ?? "—"}</div>
                      <div>Freshness: {source.freshness_days ?? "—"} days</div>
                      <div>Last verified: {source.last_verified_at ? new Date(source.last_verified_at).toLocaleDateString() : "—"}</div>
                      <div>Verified by: {source.verified_by ?? "—"}</div>
                      <div>Rights: {source.usage_rights ?? "—"}</div>
                      <div>
                        Next verification:{" "}
                        {source.last_verified_at && source.freshness_days
                          ? new Date(
                              new Date(source.last_verified_at).getTime() +
                                source.freshness_days * 86_400_000
                            ).toLocaleDateString()
                          : "—"}
                      </div>
                      <div className="truncate">
                        Evidence:{" "}
                        {String(
                          (source.metadata as { verification_evidence?: string })
                            ?.verification_evidence ?? "—"
                        )}
                      </div>
                    </dl>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/manage/documents?source_id=${encodeURIComponent(source.source_id)}`}>
                        Documents
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(source)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setVerifying(source)}>
                      {source.verification_status === "verified" ? "Re-verify" : "Verify"}
                    </Button>
                    {source.verification_status === "verified" ? (
                      <Button size="sm" variant="destructive" onClick={() => setRevoking(source)}>Revoke</Button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )
      ) : null}

      <CreateSourceDialog open={creating} onOpenChange={setCreating} onCreated={reload} />
      <VerifySourceDialog source={verifying} onOpenChange={(open) => !open && setVerifying(null)} onVerified={reload} />
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
        title="Revoke source verification"
        description="Documents using this source stop being publishable and public eligibility is rechecked on every read."
        confirmLabel="Revoke"
        destructive
        requireReason
        onConfirm={async (reason) => {
          if (!revoking) return
          try {
            await revokeAdminSource(revoking.source_id, reason)
            toast.success("Source revoked")
            setRevoking(null)
            reload()
          } catch (cause) {
            toast.error(cause instanceof AdminApiError ? cause.message : "Revoke failed")
          }
        }}
      />
    </div>
  )
}
