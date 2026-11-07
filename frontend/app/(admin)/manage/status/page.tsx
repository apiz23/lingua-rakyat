"use client"

import { Button } from "@/components/ui/button"
import { AdminPageHeader } from "@/components/admin/admin-shell"
import { AdminErrorState, AdminLoading } from "@/components/admin/admin-state"
import { StatusBadge } from "@/components/admin/status-badge"
import { getAdminStatus } from "@/lib/admin-api"
import { useAdminResource } from "@/hooks/useAdminResource"

export default function AdminStatusPage() {
  const { data, error, loading, reload } = useAdminResource(getAdminStatus, [])

  return (
    <div>
      <AdminPageHeader
        kicker="System / 10"
        title="System status"
        actions={<Button variant="outline" disabled={loading} onClick={reload}>Refresh status</Button>}
        description="Admin data-store availability. No credentials, hosts or infrastructure details are exposed."
      />

      {loading ? <AdminLoading label="Checking admin services…" /> : null}
      {error ? <AdminErrorState error={error} onRetry={reload} /> : null}

      {data ? (
        <>
          <div className="admin-ledger">
            {Object.entries(data.checks).map(([name, state], index) => (
              <div key={name} className="admin-ledger__cell">
                <span className="admin-ledger__label">
                  <span className="capitalize">{name.replaceAll("_", " ")}</span>
                  <span className="admin-index">{String(index + 1).padStart(2, "0")}</span>
                </span>
                <span className="mt-1">
                  <StatusBadge value={state === "ok" ? "verified" : "revoked"} label={state} />
                </span>
              </div>
            ))}
            <div className="admin-ledger__cell">
              <span className="admin-ledger__label">
                <span>Role provider</span>
                <span className="admin-index">RP</span>
              </span>
              <span className="mt-1">
                <StatusBadge
                  value={data.role_provider === "ok" ? "verified" : "unavailable"}
                  label={data.role_provider}
                />
              </span>
            </div>
          </div>

          <p className="admin-kicker mt-4">
            Generated {new Date(data.generated_at).toLocaleString()}
          </p>
        </>
      ) : null}
    </div>
  )
}
