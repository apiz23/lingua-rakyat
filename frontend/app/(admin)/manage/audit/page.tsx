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
import { Card } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

      <div className="grid min-w-0 gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="audit-action-filter">
            <UiText text="Filter by action" />
          </FieldLabel>
          <Input
            id="audit-action-filter"
            placeholder={t("Filter action prefix, e.g. review or source")}
            value={action}
            onChange={(event) => {
              setAction(event.target.value)
              setPage(1)
            }}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="audit-actor-filter">
            <UiText text="Filter by actor ID" />
          </FieldLabel>
          <Input
            id="audit-actor-filter"
            placeholder={t("Filter actor id")}
            value={actorId}
            onChange={(event) => {
              setActorId(event.target.value)
              setPage(1)
            }}
          />
        </Field>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {loading ? <AdminLoading label={t("Loading audit log…")} /> : null}
        {error ? <AdminErrorState error={error} onRetry={reload} /> : null}

        {data ? (
          data.items.length === 0 ? (
            <AdminEmptyState
              message={t("No audit entries match these filters.")}
            />
          ) : (
            <Card className="gap-0 py-0">
              <Table className="min-w-[900px]">
                <TableCaption className="sr-only">
                  <UiText text="Administrative activity, newest entries first." />
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">
                      <UiText text="When" />
                    </TableHead>
                    <TableHead scope="col">
                      <UiText text="Actor" />
                    </TableHead>
                    <TableHead scope="col">
                      <UiText text="Action" />
                    </TableHead>
                    <TableHead scope="col">
                      <UiText text="Target" />
                    </TableHead>
                    <TableHead scope="col">
                      <UiText text="Transition" />
                    </TableHead>
                    <TableHead scope="col">
                      <UiText text="Reason / details" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((entry, index) => (
                    <TableRow key={`${entry.id ?? index}`}>
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                        {entry.created_at
                          ? new Date(entry.created_at).toLocaleString(t.locale)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {entry.actor_id}
                        {entry.actor_role ? (
                          <div className="text-muted-foreground">
                            {entry.actor_role}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-medium">
                        {entry.action}
                      </TableCell>
                      <TableCell className="text-xs">
                        {entry.target_type} {entry.target_id ?? ""}
                      </TableCell>
                      <TableCell className="text-xs">
                        {entry.state_from ?? "—"} → {entry.state_to ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {entry.reason ? <div>{entry.reason}</div> : null}
                        {entry.details &&
                        Object.keys(entry.details).length > 0 ? (
                          <Collapsible className="mt-1">
                            <CollapsibleTrigger className="cursor-pointer text-left text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                              <UiText text="View event details" />
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <pre className="mt-1 max-w-md overflow-x-auto text-[11px] whitespace-pre-wrap">
                                {JSON.stringify(entry.details, null, 2)}
                              </pre>
                            </CollapsibleContent>
                          </Collapsible>
                        ) : null}
                        {entry.correlation_id ? (
                          <div className="mt-1 text-muted-foreground">
                            <UiText text="corr" /> {entry.correlation_id}
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-3 text-sm">
                <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
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
            </Card>
          )
        ) : null}
      </div>
    </div>
  )
}
