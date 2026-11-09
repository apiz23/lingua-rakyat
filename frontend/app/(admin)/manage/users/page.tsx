"use client"

import { UiText, useTranslations } from "@/components/i18n"
import { useState, type FormEvent } from "react"
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            <UiText text="Grant admin role" />
          </DialogTitle>
          <DialogDescription>
            {" "}
            <UiText text="Roles are stored server-side and audited. You cannot grant a role to yourself." />{" "}
          </DialogDescription>
        </DialogHeader>
        <form
          id="grant-admin-role-form"
          onSubmit={submit}
          className="flex flex-col gap-4"
        >
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="admin-role-actor-id">
                <UiText text="Clerk actor id" />
              </FieldLabel>
              <Input
                id="admin-role-actor-id"
                value={actorId}
                onChange={(event) => setActorId(event.target.value)}
                placeholder={t("user_…")}
                maxLength={200}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="admin-role-select">
                <UiText text="Role" />
              </FieldLabel>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="admin-role-select" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {roles.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(value)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="admin-role-reason">
                <UiText text="Reason" />
              </FieldLabel>
              <Input
                id="admin-role-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={2000}
              />
            </Field>
          </FieldGroup>
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
              <UiText text="Grant role" />
            </Button>
          </DialogFooter>
        </form>
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
          <div className="mb-6 rounded-lg border border-border bg-muted/50 p-4 text-sm">
            <p className="font-medium">
              <UiText text="Permission model" />
            </p>
            <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
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
              <div className="px-1">
                <Table className="min-w-[760px]">
                  <TableCaption className="sr-only">
                    <UiText text="Accounts and their assigned administrative roles." />
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">
                        <UiText text="Actor" />
                      </TableHead>
                      <TableHead scope="col">
                        <UiText text="Role" />
                      </TableHead>
                      <TableHead scope="col">
                        <UiText text="Granted" />
                      </TableHead>
                      <TableHead scope="col">
                        <UiText text="Status" />
                      </TableHead>
                      <TableHead scope="col">
                        <UiText text="Reason" />
                      </TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.roles.map((assignment, index) => (
                      <TableRow
                        key={`${assignment.id ?? index}`}
                        className="border-b border-border/40 last:border-0"
                      >
                        <TableCell className="px-3 py-2 font-mono text-xs">
                          {assignment.actor_id}
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          {t(assignment.role.replaceAll("_", " "))}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-xs text-muted-foreground">
                          {assignment.granted_at
                            ? new Date(assignment.granted_at).toLocaleString(
                                t.locale
                              )
                            : "—"}
                          <div>
                            <UiText text="by" /> {assignment.granted_by}
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          {assignment.revoked_at ? (
                            <StatusBadge value="revoked" />
                          ) : (
                            <StatusBadge value="verified" label={t("active")} />
                          )}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-xs">
                          {assignment.reason ?? "—"}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right">
                          {!assignment.revoked_at ? (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setRevoking(assignment)}
                            >
                              <UiText text="Revoke" />
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
