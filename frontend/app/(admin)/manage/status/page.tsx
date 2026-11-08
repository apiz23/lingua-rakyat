"use client"

import { UiText, useTranslations } from "@/components/i18n"
import { Button } from "@/components/ui/button"
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
          <div className="admin-ledger">
            {Object.entries(data.checks).map(([name, state], index) => (
              <div key={name} className="admin-ledger__cell">
                <span className="admin-ledger__label">
                  <span className="capitalize">
                    {t(name.replaceAll("_", " "))}
                  </span>
                  <span className="admin-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </span>
                <span className="mt-1">
                  <StatusBadge
                    value={state === "ok" ? "verified" : "revoked"}
                    label={state}
                  />
                </span>
              </div>
            ))}
            <div className="admin-ledger__cell">
              <span className="admin-ledger__label">
                <span>
                  <UiText text="Role provider" />
                </span>
                <span className="admin-index">
                  <UiText text="RP" />
                </span>
              </span>
              <span className="mt-1">
                <StatusBadge
                  value={
                    data.role_provider === "ok" ? "verified" : "unavailable"
                  }
                  label={data.role_provider}
                />
              </span>
            </div>
          </div>

          <p className="admin-kicker mt-4">
            {" "}
            <UiText text="Generated" />{" "}
            {new Date(data.generated_at).toLocaleString(t.locale)}
          </p>
        </>
      ) : null}
    </div>
  )
}
