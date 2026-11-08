"use client"

import { UiText, useTranslations } from "@/components/i18n"
import { useState } from "react"

import { AdminPageHeader } from "@/components/admin/admin-shell"
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoading,
} from "@/components/admin/admin-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { listAdminAudit } from "@/lib/admin-api"
import { useAdminResource } from "@/hooks/useAdminResource"

export default function AdminAuditPage() {
  const t = useTranslations()

  const [action, setAction] = useState("")
  const [actorId, setActorId] = useState("")
  const [page, setPage] = useState(1)
  const { data, error, loading, reload } = useAdminResource(
    () => listAdminAudit({ action, actor_id: actorId, page }),
    [action, actorId, page]
  )

  return (
    <div>
      <AdminPageHeader
        kicker={t("Audit / 07")}
        title={t("Audit log")}
        description={t(
          "Append-only record of privileged administrative actions. Entries cannot be edited or deleted from this interface."
        )}
      />

      <div className="admin-filterbar mb-2 sm:grid-cols-2">
        <Input
          aria-label={t("Filter by action")}
          placeholder={t("Filter action prefix, e.g. review or source")}
          value={action}
          onChange={(event) => {
            setAction(event.target.value)
            setPage(1)
          }}
        />
        <Input
          aria-label={t("Filter by actor ID")}
          placeholder={t("Filter actor id")}
          value={actorId}
          onChange={(event) => {
            setActorId(event.target.value)
            setPage(1)
          }}
        />
      </div>

      {loading ? <AdminLoading label={t("Loading audit log…")} /> : null}
      {error ? <AdminErrorState error={error} onRetry={reload} /> : null}

      {data ? (
        data.items.length === 0 ? (
          <AdminEmptyState
            message={t("No audit entries match these filters.")}
          />
        ) : (
          <div className="admin-surface overflow-x-auto">
            <table className="admin-table min-w-[900px]">
              <caption className="sr-only">
                <UiText text="Administrative activity, newest entries first." />
              </caption>
              <thead>
                <tr>
                  <th scope="col">
                    <UiText text="When" />
                  </th>
                  <th scope="col">
                    <UiText text="Actor" />
                  </th>
                  <th scope="col">
                    <UiText text="Action" />
                  </th>
                  <th scope="col">
                    <UiText text="Target" />
                  </th>
                  <th scope="col">
                    <UiText text="Transition" />
                  </th>
                  <th scope="col">
                    <UiText text="Reason / details" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((entry, index) => (
                  <tr key={`${entry.id ?? index}`}>
                    <td className="text-xs whitespace-nowrap text-muted-foreground">
                      {entry.created_at
                        ? new Date(entry.created_at).toLocaleString(t.locale)
                        : "—"}
                    </td>
                    <td className="text-xs">
                      {entry.actor_id}
                      {entry.actor_role ? (
                        <div className="text-muted-foreground">
                          {entry.actor_role}
                        </div>
                      ) : null}
                    </td>
                    <td className="font-medium">{entry.action}</td>
                    <td className="text-xs">
                      {entry.target_type} {entry.target_id ?? ""}
                    </td>
                    <td className="text-xs">
                      {entry.state_from ?? "—"} → {entry.state_to ?? "—"}
                    </td>
                    <td className="text-xs">
                      {entry.reason ? <div>{entry.reason}</div> : null}
                      {entry.details &&
                      Object.keys(entry.details).length > 0 ? (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-muted-foreground">
                            <UiText text="View event details" />
                          </summary>
                          <pre className="mt-1 max-w-md overflow-x-auto text-[11px] whitespace-pre-wrap">
                            {JSON.stringify(entry.details, null, 2)}
                          </pre>
                        </details>
                      ) : null}
                      {entry.correlation_id ? (
                        <div className="mt-1 text-muted-foreground">
                          <UiText text="corr" /> {entry.correlation_id}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-3 text-sm">
              <span className="admin-kicker">
                {data.total} <UiText text="entries · page" /> {data.page}
              </span>
              <span className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  <UiText text="Previous" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * data.page_size >= data.total}
                  onClick={() => setPage((value) => value + 1)}
                >
                  <UiText text="Next" />
                </Button>
              </span>
            </div>
          </div>
        )
      ) : null}
    </div>
  )
}
