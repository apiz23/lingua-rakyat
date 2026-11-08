"use client"

import { UiText, useTranslations } from "@/components/i18n"
import { useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

export function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  requireReason,
  busy,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel: string
  destructive?: boolean
  requireReason?: boolean
  busy?: boolean
  onConfirm: (reason: string) => Promise<void> | void
}) {
  const t = useTranslations()

  const [reason, setReason] = useState("")
  const [touched, setTouched] = useState(false)

  const changeOpen = (next: boolean) => {
    if (busy) return
    if (!next) {
      setReason("")
      setTouched(false)
    }
    onOpenChange(next)
  }

  const blocked = Boolean(requireReason && !reason.trim())

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent aria-busy={busy}>
        <DialogHeader>
          <DialogTitle>{<UiText text={title} />}</DialogTitle>
          {description ? (
            <DialogDescription>
              {<UiText text={description} />}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="space-y-2">
          <label htmlFor="action-reason" className="text-sm font-medium">
            {requireReason ? t("Reason (required)") : t("Reason (optional)")}
          </label>
          <Textarea
            id="action-reason"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value)
              setTouched(true)
            }}
            placeholder={t("Recorded in the audit log and publication events.")}
            maxLength={2000}
            disabled={busy}
            aria-required={requireReason}
            aria-describedby={
              touched && blocked ? "action-reason-error" : undefined
            }
            aria-invalid={touched && blocked}
          />
          {touched && blocked ? (
            <p id="action-reason-error" className="text-xs text-destructive">
              <UiText text="Enter a reason before confirming." />
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => changeOpen(false)}
            disabled={busy}
          >
            {" "}
            <UiText text="Cancel" />{" "}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={busy || blocked}
            onClick={() => void onConfirm(reason.trim())}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {<UiText text={confirmLabel} />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
