"use client"

import { UiText, useTranslations } from "@/components/i18n"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"
import { AdminPageHeader } from "@/components/admin/admin-shell"
import { AdminErrorState, AdminLoading } from "@/components/admin/admin-state"
import { StatusBadge } from "@/components/admin/status-badge"
import { getAdminStatus } from "@/lib/admin-api"
import { useAdminResource } from "@/hooks/useAdminResource"

export default function AdminStatusPage() {
  const t = useTranslations()

  const { data, error, loading, reload } = useAdminResource(getAdminStatus, [])

  return (
    <div>
      <AdminPageHeader
        kicker={t("System / 10")}
        title={t("System status")}
        actions={
          <Button variant="outline" disabled={loading} onClick={reload}>
            {" "}
            <UiText text="Refresh status" />{" "}
          </Button>
        }
        description={t(
          "Admin data-store availability. No credentials, hosts or infrastructure details are exposed."
        )}
      />

      {loading ? <AdminLoading label={t("Checking admin services…")} /> : null}
      {error ? <AdminErrorState error={error} onRetry={reload} /> : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Object.entries(data.checks).map(([name, state], index) => (
              <Card key={name} size="sm">
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <CardDescription className="min-w-0 capitalize">
                    {t(name.replaceAll("_", " "))}
                  </CardDescription>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </CardHeader>
                <CardContent>
                  <StatusBadge
                    value={state === "ok" ? "verified" : "revoked"}
                    label={state}
                  />
                </CardContent>
              </Card>
            ))}
            <Card size="sm">
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <CardDescription>
                  <UiText text="Role provider" />
                </CardDescription>
                <span className="shrink-0 text-xs text-muted-foreground">
                  <UiText text="RP" />
                </span>
              </CardHeader>
              <CardContent>
                <StatusBadge
                  value={
                    data.role_provider === "ok" ? "verified" : "unavailable"
                  }
                  label={data.role_provider}
                />
              </CardContent>
            </Card>
          </div>

          <p className="mt-4 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            {" "}
            <UiText text="Generated" />{" "}
            {new Date(data.generated_at).toLocaleString(t.locale)}
          </p>
        </>
      ) : null}
    </div>
  )
}
