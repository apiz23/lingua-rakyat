"use client"

import { UiText, useTranslations } from "@/components/i18n"
import { useState } from "react"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  AdminApiError,
  grantAdminRole,
  listAdminRoles,
  revokeAdminRole,
  type RoleAssignment,
} from "@/lib/admin-api"
import { useAdminResource } from "@/hooks/useAdminResource"

function GrantRoleDialog({
  open,
  onOpenChange,
  roles,
  onGranted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  roles: string[]
  onGranted: () => void
}) {
  const t = useTranslations()

  const [actorId, setActorId] = useState("")
  const [role, setRole] = useState(roles[0] ?? "reviewer")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      await grantAdminRole({
        target_actor_id: actorId.trim(),
        role,
        reason: reason.trim() || undefined,
      })
      toast.success(t("Role granted"))
      onOpenChange(false)
      setActorId("")
      setReason("")
      onGranted()
    } catch (cause) {
      toast.error(
        cause instanceof AdminApiError
          ? t(cause.message)
          : t("Could not grant role")
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
            <UiText text="Grant admin role" />
          </DialogTitle>
          <DialogDescription>
            {" "}
            <UiText text="Roles are stored server-side and audited. You cannot grant a role to yourself." />{" "}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm">
            <UiText text="Clerk actor id" />{" "}
            <Input
              className="mt-1"
              value={actorId}
              onChange={(event) => setActorId(event.target.value)}
              placeholder={t("user_…")}
            />
          </label>
          <label className="block text-sm">
            <UiText text="Role" />{" "}
            <select
              className="neo-input mt-1 h-9 w-full rounded-md px-2 text-sm"
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              {roles.map((value) => (
                <option key={value} value={value}>
                  {t(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <UiText text="Reason" />{" "}
            <Input
              className="mt-1"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
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
            disabled={busy || !actorId.trim()}
          >
            <UiText text="Grant role" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminUsersPage() {
  const t = useTranslations()

  const { data, error, loading, reload } = useAdminResource(listAdminRoles, [])
  const [granting, setGranting] = useState(false)
  const [revoking, setRevoking] = useState<RoleAssignment | null>(null)

  return (
    <div>
      <AdminPageHeader
        kicker={t("Access / 09")}
        title={t("Users & roles")}
        description={t(
          "Server-side admin grants. Signing in never grants a role; roles are never read from client metadata."
        )}
        actions={
          data ? (
            <Button onClick={() => setGranting(true)}>
              {" "}
              <UiText text="Grant role" />{" "}
            </Button>
          ) : null
        }
      />

      {loading ? <AdminLoading label={t("Loading roles…")} /> : null}
      {error ? <AdminErrorState error={error} onRetry={reload} /> : null}

      {data ? (
        <>
          <div className="admin-callout mb-4 text-sm">
            <p className="font-medium">
              <UiText text="Permission model" />
            </p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {Object.entries(data.role_permissions).map(
                ([role, permissions]) => (
                  <li key={role}>
                    <span className="font-medium text-foreground">{role}</span>:{" "}
                    {permissions.join(", ")}
                  </li>
                )
              )}
            </ul>
          </div>

          {data.roles.length === 0 ? (
            <AdminEmptyState
              message={t("No admin roles granted.")}
              hint={t(
                "Bootstrap the first super admin through a reviewed server-side SQL insert."
              )}
            />
          ) : (
            <Card size="sm">
              <div className="overflow-x-auto px-1">
                <table className="admin-table min-w-[760px]">
                  <caption className="sr-only">
                    <UiText text="Accounts and their assigned administrative roles." />
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">
                        <UiText text="Actor" />
                      </th>
                      <th scope="col">
                        <UiText text="Role" />
                      </th>
                      <th scope="col">
                        <UiText text="Granted" />
                      </th>
                      <th scope="col">
                        <UiText text="Status" />
                      </th>
                      <th scope="col">
                        <UiText text="Reason" />
                      </th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.roles.map((assignment, index) => (
                      <tr
                        key={`${assignment.id ?? index}`}
                        className="border-b border-border/40 last:border-0"
                      >
                        <td className="px-3 py-2 font-mono text-xs">
                          {assignment.actor_id}
                        </td>
                        <td className="px-3 py-2">
                          {t(assignment.role.replaceAll("_", " "))}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {assignment.granted_at
                            ? new Date(assignment.granted_at).toLocaleString(
                                t.locale
                              )
                            : "—"}
                          <div>
                            <UiText text="by" /> {assignment.granted_by}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {assignment.revoked_at ? (
                            <StatusBadge value="revoked" />
                          ) : (
                            <StatusBadge value="verified" label={t("active")} />
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {assignment.reason ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {!assignment.revoked_at ? (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setRevoking(assignment)}
                            >
                              <UiText text="Revoke" />
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      ) : null}

      <GrantRoleDialog
        open={granting}
        onOpenChange={setGranting}
        roles={data?.available_roles ?? []}
        onGranted={reload}
      />
      <ActionDialog
        open={Boolean(revoking)}
        onOpenChange={(open) => !open && setRevoking(null)}
        title={t("Revoke admin role")}
        description={t("Revocation is immediate and audited.")}
        confirmLabel={t("Revoke")}
        destructive
        requireReason
        onConfirm={async (reason) => {
          if (!revoking) return
          try {
            await revokeAdminRole({
              target_actor_id: revoking.actor_id,
              role: revoking.role,
              reason,
            })
            toast.success(t("Role revoked"))
            setRevoking(null)
            reload()
          } catch (cause) {
            toast.error(
              cause instanceof AdminApiError
                ? t(cause.message)
                : t("Could not revoke role")
            )
          }
        }}
      />
    </div>
  )
}
